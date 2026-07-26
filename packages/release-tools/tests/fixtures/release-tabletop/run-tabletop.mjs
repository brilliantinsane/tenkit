import { createReleaseState, transition } from './release-machine.mjs';

const RC_1 = {
  channel: 'rc',
  version: '0.4.0-rc.1',
  sourceSha: '1111111111111111111111111111111111111111',
  latest: '0.3.0',
};
const RC_2 = {
  channel: 'rc',
  version: '0.4.0-rc.2',
  sourceSha: '2222222222222222222222222222222222222222',
  latest: '0.3.0',
  next: '0.4.0-rc.1',
};
const STABLE = {
  channel: 'stable',
  version: '0.4.0',
  sourceSha: '3333333333333333333333333333333333333333',
  latest: '0.3.0',
  next: '0.4.0-rc.2',
};

function run(initial, actions) {
  return actions.reduce((state, type) => transition(state, { type }), createReleaseState(initial));
}

const HAPPY_PATH = [
  'draft',
  'verify',
  'approve',
  'verify',
  'approve',
  'verify',
  'approve',
  'verify',
  'publish-github',
  'verify',
];

const scenarios = [
  {
    name: 'First RC',
    state: run(RC_1, HAPPY_PATH),
    expect: (state) =>
      state.complete && state.tags.next === '0.4.0-rc.1' && state.tags.latest === '0.3.0',
  },
  {
    name: 'Second RC',
    state: run(RC_2, HAPPY_PATH),
    expect: (state) =>
      state.complete && state.tags.next === '0.4.0-rc.2' && state.tags.latest === '0.3.0',
  },
  {
    name: 'Stable after RC',
    state: run(STABLE, HAPPY_PATH),
    expect: (state) =>
      state.complete && state.tags.latest === '0.4.0' && state.tags.next === '0.4.0-rc.2',
  },
  {
    name: 'Pause after first approval resumes at CLI',
    state: run(RC_1, ['draft', 'verify', 'approve', 'verify']),
    expect: (state) => state.publicPrefix === 1 && state.nextAction.includes('@tenkit/cli'),
  },
  {
    name: 'Ambiguous registry read authorizes no mutation',
    state: run(RC_1, ['draft', 'verify', 'approve', 'inject-stale-read', 'verify']),
    expect: (state) => state.readAmbiguous && state.nextAction.includes('Retry read-only'),
  },
  {
    name: 'Bounded retry restores one next action',
    state: run(RC_1, [
      'draft',
      'verify',
      'approve',
      'inject-stale-read',
      'verify',
      'resolve-stale-read',
      'verify',
    ]),
    expect: (state) => !state.readAmbiguous && state.nextAction.includes('@tenkit/cli'),
  },
  {
    name: 'Mismatched GitHub draft stops',
    state: run(RC_1, ['draft', 'inject-draft-mismatch', 'verify']),
    expect: (state) => state.nextAction.startsWith('STOP:'),
  },
  {
    name: 'Defect before approval discards private attempt',
    state: run(RC_1, ['draft', 'verify', 'confirm-defect']),
    expect: (state) =>
      state.defect === 'private' && state.nextAction.includes('Reject all private stages'),
  },
  {
    name: 'Stable defect after approval requires fix-forward',
    state: run(STABLE, ['draft', 'verify', 'approve', 'verify', 'confirm-defect']),
    expect: (state) =>
      state.defect === 'partial-public' && state.nextAction.includes('Release-Fix-Forward: 0.4.0'),
  },
  {
    name: 'GitHub failure never repeats npm',
    state: run(RC_1, [
      'draft',
      'verify',
      'approve',
      'verify',
      'approve',
      'verify',
      'approve',
      'verify',
      'inject-github-failure',
    ]),
    expect: (state) => state.publicPrefix === 3 && state.nextAction.includes('Do not touch npm'),
  },
  {
    name: 'Same GitHub draft can be retried',
    state: run(RC_1, [
      'draft',
      'verify',
      'approve',
      'verify',
      'approve',
      'verify',
      'approve',
      'verify',
      'inject-github-failure',
      'retry-github',
      'verify',
    ]),
    expect: (state) => state.complete && state.githubStatus === 'published',
  },
  {
    name: 'next equal to Stable latest stops',
    state: run(RC_1, ['draft', 'inject-channel-collision', 'verify']),
    expect: (state) => state.nextAction.startsWith('STOP:'),
  },
];

const rcPartialPublicDefect = run(RC_1, ['draft', 'verify', 'approve', 'verify', 'confirm-defect']);

if (!rcPartialPublicDefect.nextAction.startsWith('STOP:')) {
  throw new Error('RC partial-public defects must stop without Stable-only fix-forward advice.');
}

let failures = 0;
for (const scenario of scenarios) {
  const passed = scenario.expect(scenario.state);
  failures += passed ? 0 : 1;
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${scenario.name}`);
  console.log(`      ${scenario.state.nextAction}`);
}

console.log(
  `\n${scenarios.length - failures}/${scenarios.length} scenarios produced the expected terminal state.`,
);
process.exitCode = failures === 0 ? 0 : 1;
