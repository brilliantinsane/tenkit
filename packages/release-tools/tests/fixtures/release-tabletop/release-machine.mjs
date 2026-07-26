export const RELEASE_PACKAGES = ['@tenkit/template-generator', '@tenkit/cli', 'create-tenkit'];

const CHANNELS = {
  rc: {
    npmTag: 'next',
    githubType: 'Prerelease',
    versionPattern: /^\d+\.\d+\.\d+-rc\.\d+$/,
  },
  stable: {
    npmTag: 'latest',
    githubType: 'Normal Release',
    versionPattern: /^\d+\.\d+\.\d+$/,
  },
};

function appendHistory(state, message) {
  return { ...state, history: [...state.history, message] };
}

function nextActionFor(state) {
  if (state.stopReason) {
    return `STOP: ${state.stopReason}`;
  }

  if (state.readAmbiguous) {
    return 'Retry read-only observation within the bounded window. Do not mutate.';
  }

  if (state.defect === 'private') {
    return 'Reject all private stages, delete the matching draft, fix the source, then rerun Draft.';
  }

  if (state.defect === 'partial-public') {
    if (state.channel === 'rc') {
      return 'STOP: preserve the RC public prefix and request owner review; Stable-only Release-Fix-Forward is invalid.';
    }

    return `Reject remaining stages, preserve public versions, and use Release-Fix-Forward: ${state.version} on the reviewed fix commit.`;
  }

  if (state.githubPublishFailed) {
    return 'Retry publication of the same matching GitHub draft. Do not touch npm.';
  }

  if (!state.draftStarted) {
    return `Dispatch Draft with channel ${state.channel}.`;
  }

  if (!state.verified) {
    return 'Run the one Release Verification command.';
  }

  if (state.publicPrefix < RELEASE_PACKAGES.length) {
    return `Approve ${RELEASE_PACKAGES[state.publicPrefix]} with npm 2FA, then rerun verification.`;
  }

  if (state.githubStatus === 'draft') {
    return 'Publish the existing matching GitHub draft.';
  }

  if (!state.complete) {
    return 'Rerun Release Verification against public npm and Git/GitHub state.';
  }

  if (state.channel === 'stable') {
    return `Release complete. Keep dependent website work separate until default @latest resolves ${state.version}.`;
  }

  return 'Release complete. latest remained unchanged and next identifies the RC.';
}

function withNextAction(state) {
  return { ...state, nextAction: nextActionFor(state) };
}

function channelInvariantViolation(state) {
  if (state.channel === 'rc' && state.version === state.tags.latest) {
    return 'RC version equals the Stable latest version.';
  }

  if (state.tags.next && !/^\d+\.\d+\.\d+-rc\.\d+$/.test(state.tags.next)) {
    return 'next points to a non-RC version.';
  }

  if (state.tags.next && state.tags.next === state.tags.latest) {
    return 'next and latest point to the same version.';
  }

  return null;
}

export function createReleaseState({ channel, version, sourceSha, latest, next = null }) {
  const channelModel = CHANNELS[channel];
  if (!channelModel || !channelModel.versionPattern.test(version)) {
    throw new Error(`Invalid ${channel} release version: ${version}`);
  }

  return withNextAction({
    channel,
    version,
    sourceSha,
    npmTag: channelModel.npmTag,
    gitTag: `v${version}`,
    githubType: channelModel.githubType,
    phase: 'ready',
    draftStarted: false,
    privateStages: 0,
    publicPrefix: 0,
    verified: false,
    githubStatus: 'absent',
    githubPublishFailed: false,
    readAmbiguous: false,
    defect: null,
    stopReason: null,
    complete: false,
    tags: { latest, next, candidate: null },
    history: [
      `Selected ${channel} ${version} from ${sourceSha}.`,
      `Observed latest=${latest}; next=${next ?? 'absent'}; candidate=absent.`,
    ],
  });
}

export function transition(inputState, action) {
  let state = { ...inputState };

  if (state.stopReason && action.type !== 'reset-stop') {
    return withNextAction(appendHistory(state, `Ignored ${action.type}: state is stopped.`));
  }

  switch (action.type) {
    case 'draft': {
      if (state.draftStarted) {
        return withNextAction(appendHistory(state, 'Draft already exists; no mutation repeated.'));
      }
      state = {
        ...state,
        phase: 'private',
        draftStarted: true,
        privateStages: RELEASE_PACKAGES.length,
        githubStatus: 'draft',
        verified: false,
      };
      state = appendHistory(
        state,
        `Draft staged three packages under ${state.npmTag} and created ${state.gitTag} as a draft.`,
      );
      break;
    }

    case 'verify': {
      if (!state.draftStarted) {
        state = { ...state, stopReason: 'No Draft exists to verify.' };
        break;
      }
      if (state.readAmbiguous) {
        state = appendHistory(
          state,
          'Verification observed ambiguous registry state; no mutation authorized.',
        );
        break;
      }
      const invariantViolation = channelInvariantViolation(state);
      if (invariantViolation) {
        state = { ...state, stopReason: invariantViolation, verified: false };
        break;
      }
      if (state.githubStatus === 'mismatch') {
        state = {
          ...state,
          stopReason: 'GitHub draft identity does not match version, channel, tag, and source SHA.',
          verified: false,
        };
        break;
      }
      state = { ...state, verified: true };
      if (state.publicPrefix === RELEASE_PACKAGES.length && state.githubStatus === 'published') {
        state = { ...state, phase: 'complete', complete: true };
      }
      state = appendHistory(
        state,
        `Verified public prefix ${state.publicPrefix}/3 and ${state.privateStages} matching private stages.`,
      );
      break;
    }

    case 'approve': {
      if (!state.verified || state.publicPrefix >= RELEASE_PACKAGES.length) {
        state = appendHistory(state, 'Approval refused: verification did not name a next package.');
        break;
      }
      const packageName = RELEASE_PACKAGES[state.publicPrefix];
      const publicPrefix = state.publicPrefix + 1;
      const tags = { ...state.tags, [state.npmTag]: state.version };
      state = {
        ...state,
        phase: publicPrefix === RELEASE_PACKAGES.length ? 'public' : 'partial-public',
        publicPrefix,
        privateStages: RELEASE_PACKAGES.length - publicPrefix,
        tags,
        verified: false,
      };
      state = appendHistory(
        state,
        `Approved ${packageName} with 2FA; public prefix is now ${publicPrefix}/3.`,
      );
      break;
    }

    case 'publish-github': {
      if (
        !state.verified ||
        state.publicPrefix !== RELEASE_PACKAGES.length ||
        state.githubStatus !== 'draft'
      ) {
        state = appendHistory(
          state,
          'GitHub publication refused: complete verified npm state and one matching draft are required.',
        );
        break;
      }
      state = {
        ...state,
        phase: 'published',
        githubStatus: 'published',
        verified: false,
        githubPublishFailed: false,
      };
      state = appendHistory(
        state,
        `Published ${state.gitTag} at ${state.sourceSha}; npm was not mutated.`,
      );
      break;
    }

    case 'inject-stale-read': {
      state = { ...state, readAmbiguous: true, verified: false };
      state = appendHistory(
        state,
        'Injected an ambiguous registry read after a possible mutation.',
      );
      break;
    }

    case 'resolve-stale-read': {
      state = { ...state, readAmbiguous: false, verified: false };
      state = appendHistory(state, 'Bounded read-only retry produced one unambiguous state.');
      break;
    }

    case 'inject-draft-mismatch': {
      state = { ...state, githubStatus: 'mismatch', verified: false };
      state = appendHistory(state, 'Injected a GitHub draft with a mismatched identity.');
      break;
    }

    case 'inject-channel-collision': {
      state = { ...state, tags: { ...state.tags, next: state.tags.latest }, verified: false };
      state = appendHistory(state, 'Injected next == latest with a Stable version.');
      break;
    }

    case 'confirm-defect': {
      const defect = state.publicPrefix === 0 ? 'private' : 'partial-public';
      state = { ...state, defect, verified: false, phase: 'defect' };
      state = appendHistory(
        state,
        `Confirmed a defect with public prefix ${state.publicPrefix}/3.`,
      );
      break;
    }

    case 'inject-github-failure': {
      if (!state.verified || state.publicPrefix !== RELEASE_PACKAGES.length) {
        state = appendHistory(state, 'GitHub failure injection refused before npm completion.');
        break;
      }
      state = { ...state, githubPublishFailed: true, verified: false };
      state = appendHistory(
        state,
        'GitHub publication failed after npm completion; npm remains complete.',
      );
      break;
    }

    case 'retry-github': {
      if (!state.githubPublishFailed || state.githubStatus !== 'draft') {
        state = appendHistory(
          state,
          'GitHub retry refused: no matching failed publication exists.',
        );
        break;
      }
      state = {
        ...state,
        githubPublishFailed: false,
        githubStatus: 'published',
        phase: 'published',
        verified: false,
      };
      state = appendHistory(
        state,
        `Retried the same draft and published ${state.gitTag}; npm was not mutated.`,
      );
      break;
    }

    default:
      throw new Error(`Unknown rehearsal action: ${action.type}`);
  }

  return withNextAction(state);
}

export function summarizeState(state) {
  return {
    release: `${state.channel} ${state.version}`,
    sourceSha: state.sourceSha,
    phase: state.phase,
    npmTag: state.npmTag,
    tags: state.tags,
    privateStages: state.privateStages,
    publicPrefix: `${state.publicPrefix}/3`,
    publicPackages: RELEASE_PACKAGES.slice(0, state.publicPrefix),
    verified: state.verified,
    github: `${state.githubStatus} ${state.gitTag} (${state.githubType})`,
    defect: state.defect,
    complete: state.complete,
    nextAction: state.nextAction,
  };
}
