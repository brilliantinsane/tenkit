import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, test } from 'vitest';
import { parse } from 'yaml';

import { planReleaseSet } from '../src/release-plan';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const workflowPath = resolve(workspaceRoot, '.github/workflows/release-draft.yml');
const draftBuildEntrypoint = resolve(
  workspaceRoot,
  'packages/release-tools/scripts/build-draft-release-set.ts',
);
const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

function requireRecord(value: unknown, description: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object.`);
  }

  return value as Record<string, unknown>;
}

async function readWorkflow(): Promise<Record<string, unknown>> {
  const contents = await readFile(workflowPath, 'utf8');
  return requireRecord(parse(contents) as unknown, 'Draft workflow');
}

function job(workflow: Record<string, unknown>, name: string): Record<string, unknown> {
  return requireRecord(requireRecord(workflow.jobs, 'workflow jobs')[name], `${name} job`);
}

function step(workflowJob: Record<string, unknown>, name: string): Record<string, unknown> {
  if (!Array.isArray(workflowJob.steps)) {
    throw new Error('Workflow job steps must be an array.');
  }

  const matchingStep = workflowJob.steps.find(
    (candidate) => requireRecord(candidate, 'workflow step').name === name,
  );
  return requireRecord(matchingStep, `${name} step`);
}

function shell(stepDefinition: Record<string, unknown>): string {
  if (typeof stepDefinition.run !== 'string') {
    throw new Error('Workflow shell step must define run.');
  }

  return stepDefinition.run;
}

async function writeExecutable(path: string, contents: string): Promise<void> {
  await writeFile(path, contents);
  await chmod(path, 0o755);
}

async function runWorkflowShell(input: {
  script: string;
  cwd: string;
  fakeBin: string;
  env: Record<string, string>;
}) {
  return execFileAsync('/bin/bash', ['-euo', 'pipefail', '-c', input.script], {
    cwd: input.cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${input.fakeBin}:${process.env.PATH ?? ''}`,
      ...input.env,
    },
  });
}

type DraftRehearsalChannel = 'stable' | 'rc';

async function createDraftRehearsal(channel: DraftRehearsalChannel = 'stable') {
  const workflow = await readWorkflow();
  const stageJob = job(workflow, 'stage');
  const createDraftReleaseJob = job(workflow, 'create-draft-release');
  const operationRoot = await mkdtemp(join(tmpdir(), 'tenkit-draft-rehearsal-'));
  tempRoots.push(operationRoot);
  const fakeBin = join(operationRoot, 'bin');
  const artifactRoot = join(operationRoot, 'release-artifacts');
  const operationLog = join(operationRoot, 'operations.log');
  const summary = join(operationRoot, 'summary.md');
  const sourceSha = 'a'.repeat(40);
  const plan = planReleaseSet({
    channel,
    sourceSha,
    previousStableTag: {
      name: 'v0.3.0',
      version: '0.3.0',
      sha: 'b'.repeat(40),
    },
    releaseCandidateTags: [],
    commits: [
      {
        sha: sourceSha,
        message: 'feat(cli): rehearse coordinated release readiness',
        paths: ['packages/cli/src/index.ts'],
      },
    ],
  });

  if (plan.kind === 'no-release') {
    throw new Error('Draft rehearsal requires a release plan.');
  }

  const { version, npmDistTag, gitTag, githubReleaseType } = plan;
  const packageOrder = JSON.stringify(plan.dependencyApprovalOrder);
  await mkdir(fakeBin);
  await mkdir(artifactRoot);
  const artifacts = [
    `tenkit-template-generator-${version}.tgz`,
    `tenkit-cli-${version}.tgz`,
    `create-tenkit-${version}.tgz`,
  ] as const;
  const shasums: string[] = [];

  for (const artifact of artifacts) {
    const bytes = Buffer.from(`disposable ${artifact}`);
    await writeFile(join(artifactRoot, artifact), bytes);
    shasums.push(createHash('sha1').update(bytes).digest('hex'));
  }

  await writeExecutable(join(fakeBin, 'sha1sum'), '#!/bin/bash\nexec /usr/bin/shasum -a 1 "$@"\n');
  await writeExecutable(
    join(fakeBin, 'npm'),
    `#!/bin/bash
set -euo pipefail
printf 'npm %s\\n' "$*" >> "$OPERATION_LOG"
if [ "$1 $2" != 'stage publish' ]; then exit 64; fi
artifact=$3
if [[ "$artifact" != ./* ]]; then exit 69; fi
printf 'RAW_NPM_RESPONSE_SENTINEL package-auth-details\\n'
case "$artifact" in
  *tenkit-template-generator*) stage_id='11111111-1111-1111-1111-111111111111' ;;
  *tenkit-cli*) stage_id='22222222-2222-2222-2222-222222222222' ;;
  *create-tenkit*) stage_id='33333333-3333-3333-3333-333333333333' ;;
  *) exit 65 ;;
esac
shasum=$(/usr/bin/shasum -a 1 "$artifact" | cut -d ' ' -f1)
printf '{"stageId":"%s","shasum":"%s"}\\n' "$stage_id" "$shasum"
if [ -n "\${FAIL_ARTIFACT:-}" ] && [[ "$artifact" == *"$FAIL_ARTIFACT"* ]]; then exit 68; fi
`,
  );
  await writeExecutable(
    join(fakeBin, 'gh'),
    `#!/bin/bash
set -euo pipefail
printf 'gh %s\\n' "$*" >> "$OPERATION_LOG"
if [ "$1" = 'api' ]; then
  printf '%s\\n' "$EXISTING_GITHUB_RELEASES"
  exit 0
fi
if [ "$1 $2" = 'release create' ]; then
  printf 'https://github.com/opx/tenkit/releases/tag/untagged-disposable\\n'
  exit 0
fi
exit 66
`,
  );
  await writeExecutable(
    join(fakeBin, 'git'),
    '#!/bin/bash\nprintf \'git %s\\n\' "$*" >> "$OPERATION_LOG"\nexit 67\n',
  );

  return {
    operationRoot,
    fakeBin,
    operationLog,
    summary,
    stageJob,
    createDraftReleaseJob,
    commonEnv: {
      OPERATION_LOG: operationLog,
      RUNNER_TEMP: operationRoot,
      GITHUB_STEP_SUMMARY: summary,
      RELEASE_CHANNEL: channel,
      SOURCE_SHA: sourceSha,
      VERSION: version,
      NPM_DIST_TAG: npmDistTag,
      GIT_TAG: gitTag,
      GITHUB_RELEASE_TYPE: githubReleaseType,
      PACKAGE_ORDER: packageOrder,
      EXISTING_GITHUB_RELEASES: '[[]]',
    },
    artifactEnv: {
      TEMPLATE_ARTIFACT: `./release-artifacts/${artifacts[0]}`,
      CLI_ARTIFACT: `./release-artifacts/${artifacts[1]}`,
      CREATE_ARTIFACT: `./release-artifacts/${artifacts[2]}`,
      TEMPLATE_SHASUM: shasums[0]!,
      CLI_SHASUM: shasums[1]!,
      CREATE_SHASUM: shasums[2]!,
    },
    sourceSha,
    version,
    npmDistTag,
    gitTag,
    githubReleaseType,
    packageOrder,
  };
}

describe('Draft Release workflow', () => {
  test('accepts only a channel and captures the default-branch event SHA for planning', async () => {
    const workflow = await readWorkflow();
    const dispatch = requireRecord(
      requireRecord(workflow.on, 'workflow triggers').workflow_dispatch,
      'dispatch',
    );
    const concurrency = requireRecord(workflow.concurrency, 'workflow concurrency');

    expect(workflow.name).toBe('Draft Release');
    expect(dispatch).toEqual({
      inputs: {
        channel: {
          description: 'Final release channel',
          required: true,
          type: 'choice',
          options: ['stable', 'rc'],
          default: 'stable',
        },
      },
    });
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(concurrency).toEqual({
      group: 'release-set-draft',
      'cancel-in-progress': false,
    });

    const build = requireRecord(requireRecord(workflow.jobs, 'workflow jobs').build, 'build job');
    const buildSteps = build.steps;
    expect(Array.isArray(buildSteps)).toBe(true);
    const enforceDefaultBranch = step(build, 'Enforce default-branch dispatch');
    const checkout = step(build, 'Checkout captured source');
    const recordSource = step(build, 'Record exact source SHA');
    const serializedBuildSteps = JSON.stringify(buildSteps);
    expect(serializedBuildSteps).toContain('github.event.repository.default_branch');
    expect(serializedBuildSteps).toContain('inputs.channel');
    expect(serializedBuildSteps).not.toContain('inputs.source_sha');
    expect(serializedBuildSteps).not.toContain('inputs.version');
    expect(serializedBuildSteps).not.toContain('Validate requested source SHA');
    expect(
      requireRecord(enforceDefaultBranch.env, 'default-branch guard environment').DISPATCH_REF,
    ).toBe('${{ github.ref }}');
    expect(enforceDefaultBranch.run).toContain('refs/heads/$DEFAULT_BRANCH');
    expect(requireRecord(checkout.with, 'captured source checkout inputs').ref).toBe(
      '${{ github.sha }}',
    );
    expect(requireRecord(recordSource.env, 'record source environment').DISPATCH_SOURCE_SHA).toBe(
      '${{ github.sha }}',
    );
    expect(serializedBuildSteps).toContain('steps.source.outputs.source-sha');
    expect(serializedBuildSteps.indexOf('Record exact source SHA')).toBeLessThan(
      serializedBuildSteps.indexOf('Plan Release Set'),
    );
    expect(serializedBuildSteps).not.toMatch(/"(?:patch|minor|major)"/);

    const outputs = requireRecord(build.outputs, 'build outputs');
    expect(outputs).toMatchObject({
      channel: '${{ steps.plan.outputs.channel }}',
      'source-sha': '${{ steps.plan.outputs.source-sha }}',
      version: '${{ steps.plan.outputs.version }}',
      'npm-dist-tag': '${{ steps.plan.outputs.npm-dist-tag }}',
      'git-tag': '${{ steps.plan.outputs.git-tag }}',
      'github-release-type': '${{ steps.plan.outputs.github-release-type }}',
      'package-order': '${{ steps.plan.outputs.package-order }}',
    });

    const planReleaseSet = step(build, 'Plan Release Set');
    const serializedPlan = JSON.stringify(planReleaseSet);
    expect(shell(planReleaseSet)).toContain('--channel "$RELEASE_CHANNEL"');
    expect(serializedPlan).toContain('.channel');
    expect(serializedPlan).toContain('.npmDistTag');
    expect(serializedPlan).toContain('.gitTag');
    expect(serializedPlan).toContain('.githubReleaseType');
    expect(serializedPlan).toContain('.dependencyApprovalOrder');
  });

  test('plans, checks, and canonically packs in the read-only build job', async () => {
    const workflow = await readWorkflow();
    const build = job(workflow, 'build');
    const serializedBuild = JSON.stringify(build);

    expect(build.permissions).toEqual({ contents: 'read' });
    expect(serializedBuild).toMatch(/pnpm (?:--silent )?release:plan/);
    expect(serializedBuild).toContain('pnpm release:check');
    expect(serializedBuild).toContain('pnpm --silent -F @tenkit/release-tools draft:build');
    expect(serializedBuild).not.toContain('build-draft-release-set.ts');
    expect(serializedBuild).not.toContain('exec tsx');
    expect(serializedBuild).not.toContain('tsx -e');
    expect(serializedBuild).not.toContain("?? ''");
    expect(serializedBuild).toContain('release-artifacts/*.tgz');
    expect(serializedBuild).not.toMatch(/id-token|contents":"write|npm stage|gh release/);
    expect(serializedBuild).not.toMatch(/NPM_READ_TOKEN|NODE_AUTH_TOKEN|secrets\./);

    const actions = Array.isArray(build.steps)
      ? build.steps.flatMap((step) => {
          const uses = requireRecord(step, 'build step').uses;
          return typeof uses === 'string' ? [uses] : [];
        })
      : [];
    expect(actions).not.toHaveLength(0);
    expect(actions.every((action) => /@[0-9a-f]{40}$/.test(action))).toBe(true);
    expect(serializedBuild).toContain('persist-credentials":false');

    const environment = { ...process.env };
    delete environment.WORKSPACE_ROOT;
    delete environment.SOURCE_SHA;
    delete environment.VERSION;
    await expect(
      execFileAsync(process.execPath, ['--import', 'tsx/esm', draftBuildEntrypoint], {
        cwd: resolve(import.meta.dirname, '..'),
        env: environment,
        encoding: 'utf8',
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('WORKSPACE_ROOT is required to build the Draft Release Set.'),
    });
  });

  test('stages the exact tarballs in dependency order with only repository read and OIDC', async () => {
    const workflow = await readWorkflow();
    const stage = job(workflow, 'stage');
    const serializedStage = JSON.stringify(stage);

    expect(stage.needs).toBe('build');
    expect(stage.permissions).toEqual({ contents: 'read', 'id-token': 'write' });
    expect(stage.env).toEqual({
      RELEASE_CHANNEL: '${{ needs.build.outputs.channel }}',
      SOURCE_SHA: '${{ needs.build.outputs.source-sha }}',
      VERSION: '${{ needs.build.outputs.version }}',
      NPM_DIST_TAG: '${{ needs.build.outputs.npm-dist-tag }}',
      GIT_TAG: '${{ needs.build.outputs.git-tag }}',
      GITHUB_RELEASE_TYPE: '${{ needs.build.outputs.github-release-type }}',
      PACKAGE_ORDER: '${{ needs.build.outputs.package-order }}',
    });
    expect(serializedStage).not.toMatch(
      /contents":"write|NODE_AUTH_TOKEN|npm publish|stage approve/,
    );
    expect(serializedStage).toContain('package-manager-cache\":false');
    expect(serializedStage).not.toContain('"cache":');
    expect(serializedStage).toContain('persist-credentials\":false');
    expect(serializedStage).toContain('sha1sum');
    expect(serializedStage.match(/\.\/release-artifacts\//g)).toHaveLength(3);

    expect(serializedStage.match(/npm stage publish/g)).toHaveLength(1);
    expect(serializedStage.match(/stage_package /g)).toHaveLength(3);
    expect(serializedStage).toMatch(/npm stage publish[^\n]+--tag \\"\$NPM_DIST_TAG\\"/);
    expect(
      [...serializedStage.matchAll(/stage_package '([^']+)'/g)].map((match) => match[1]),
    ).toEqual(['@tenkit/template-generator', '@tenkit/cli', 'create-tenkit']);
    expect(serializedStage).not.toContain('--tag candidate');
    expect(serializedStage).toContain('--access public');
    expect(serializedStage).toContain('--provenance');
    expect(serializedStage).toContain('failure()');
    expect(serializedStage).not.toContain('always()');
    const actions = Array.isArray(stage.steps)
      ? stage.steps.flatMap((step) => {
          const uses = requireRecord(step, 'stage step').uses;
          return typeof uses === 'string' ? [uses] : [];
        })
      : [];
    expect(actions.every((action) => /@[0-9a-f]{40}$/.test(action))).toBe(true);
  });

  test('creates only a draft GitHub Release from untrusted diagnostics', async () => {
    const workflow = await readWorkflow();
    const createDraftRelease = job(workflow, 'create-draft-release');
    const serializedCreateDraftRelease = JSON.stringify(createDraftRelease);

    expect(createDraftRelease.needs).toEqual(['build', 'stage']);
    expect(createDraftRelease.permissions).toEqual({ contents: 'write' });
    expect(createDraftRelease.env).toEqual({
      RELEASE_CHANNEL: '${{ needs.build.outputs.channel }}',
      SOURCE_SHA: '${{ needs.build.outputs.source-sha }}',
      VERSION: '${{ needs.build.outputs.version }}',
      NPM_DIST_TAG: '${{ needs.build.outputs.npm-dist-tag }}',
      GIT_TAG: '${{ needs.build.outputs.git-tag }}',
      GITHUB_RELEASE_TYPE: '${{ needs.build.outputs.github-release-type }}',
      PACKAGE_ORDER: '${{ needs.build.outputs.package-order }}',
    });
    expect(serializedCreateDraftRelease).not.toMatch(
      /id-token|\bnpm (?:stage publish|stage approve|publish|dist-tag add)|actions\/checkout|\bgit tag/,
    );
    expect(serializedCreateDraftRelease).toContain('gh release create');
    expect(serializedCreateDraftRelease).toContain('--draft');
    expect(serializedCreateDraftRelease).toContain('GITHUB_RELEASE_TYPE');
    expect(serializedCreateDraftRelease).toContain('--prerelease');
    expect(serializedCreateDraftRelease).toContain('$GIT_TAG');
    expect(serializedCreateDraftRelease).not.toContain('gh release create \\"v$VERSION\\"');
    expect(serializedCreateDraftRelease).toMatch(/--target \\"\$SOURCE_SHA\\"/);
  });

  test('reuses one exact matching draft without creating another Release', async () => {
    const rehearsal = await createDraftRehearsal('stable');
    await runWorkflowShell({
      script: shell(step(rehearsal.createDraftReleaseJob, 'Prepare Draft handoff')),
      cwd: rehearsal.operationRoot,
      fakeBin: rehearsal.fakeBin,
      env: rehearsal.commonEnv,
    });
    const draftUrl = 'https://github.com/opx/tenkit/releases/tag/existing-draft';
    const outputPath = join(rehearsal.operationRoot, 'release-output');

    await runWorkflowShell({
      script: shell(step(rehearsal.createDraftReleaseJob, 'Create draft GitHub Release')),
      cwd: rehearsal.operationRoot,
      fakeBin: rehearsal.fakeBin,
      env: {
        ...rehearsal.commonEnv,
        EXISTING_GITHUB_RELEASES: JSON.stringify([
          [
            {
              tag_name: rehearsal.gitTag,
              target_commitish: rehearsal.sourceSha,
              draft: true,
              prerelease: false,
              html_url: draftUrl,
            },
          ],
        ]),
        GITHUB_OUTPUT: outputPath,
        GH_REPO: 'opx/tenkit',
        GH_TOKEN: 'disposable-token',
      },
    });

    const operations = (await readFile(rehearsal.operationLog, 'utf8')).trim().split('\n');
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatch(/^gh api /);
    expect(await readFile(outputPath, 'utf8')).toBe(`draft-url=${draftUrl}\n`);
  });

  test.each([
    ['published identity', { draft: false }, 1, 'Existing GitHub Release does not match'],
    [
      'wrong source identity',
      { target_commitish: 'b'.repeat(40) },
      1,
      'Existing GitHub Release does not match',
    ],
    [
      'wrong Release type identity',
      { prerelease: true },
      1,
      'Existing GitHub Release does not match',
    ],
    ['duplicate identity', {}, 2, 'Multiple GitHub Releases use'],
  ] as const)(
    'stops when an existing tag has a %s',
    async (_case, override, releaseCount, expectedError) => {
      const rehearsal = await createDraftRehearsal('stable');
      await runWorkflowShell({
        script: shell(step(rehearsal.createDraftReleaseJob, 'Prepare Draft handoff')),
        cwd: rehearsal.operationRoot,
        fakeBin: rehearsal.fakeBin,
        env: rehearsal.commonEnv,
      });

      await expect(
        runWorkflowShell({
          script: shell(step(rehearsal.createDraftReleaseJob, 'Create draft GitHub Release')),
          cwd: rehearsal.operationRoot,
          fakeBin: rehearsal.fakeBin,
          env: {
            ...rehearsal.commonEnv,
            EXISTING_GITHUB_RELEASES: JSON.stringify([
              Array.from({ length: releaseCount }, () => ({
                tag_name: rehearsal.gitTag,
                target_commitish: rehearsal.sourceSha,
                draft: true,
                prerelease: false,
                html_url: 'https://github.com/opx/tenkit/releases/tag/mismatch',
                ...override,
              })),
            ]),
            GITHUB_OUTPUT: join(rehearsal.operationRoot, 'release-output'),
            GH_REPO: 'opx/tenkit',
            GH_TOKEN: 'disposable-token',
          },
        }),
      ).rejects.toMatchObject({
        stdout: expect.stringContaining(expectedError),
      });

      const operations = (await readFile(rehearsal.operationLog, 'utf8')).trim().split('\n');
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatch(/^gh api /);
    },
  );

  test.each([
    { channel: 'stable' as const, includesPrereleaseFlag: false },
    { channel: 'rc' as const, includesPrereleaseFlag: true },
  ])(
    'rehearses $channel staging and its concise Draft handoff',
    async ({ channel, includesPrereleaseFlag }) => {
      const rehearsal = await createDraftRehearsal(channel);
      const stageExecution = await runWorkflowShell({
        script: shell(step(rehearsal.stageJob, 'Stage Release Set in dependency order')),
        cwd: rehearsal.operationRoot,
        fakeBin: rehearsal.fakeBin,
        env: {
          ...rehearsal.commonEnv,
          ...rehearsal.artifactEnv,
          GITHUB_OUTPUT: join(rehearsal.operationRoot, 'stage-output'),
        },
      });
      expect(stageExecution.stdout).not.toContain('RAW_NPM_RESPONSE_SENTINEL');
      await runWorkflowShell({
        script: shell(step(rehearsal.createDraftReleaseJob, 'Prepare Draft handoff')),
        cwd: rehearsal.operationRoot,
        fakeBin: rehearsal.fakeBin,
        env: {
          ...rehearsal.commonEnv,
          TEMPLATE_STAGE_ID: '11111111-1111-1111-1111-111111111111',
          CLI_STAGE_ID: '22222222-2222-2222-2222-222222222222',
          CREATE_STAGE_ID: '33333333-3333-3333-3333-333333333333',
          TEMPLATE_INTEGRITY: 'sha512-template',
          CLI_INTEGRITY: 'sha512-cli',
          CREATE_INTEGRITY: 'sha512-create',
          TEMPLATE_SHASUM: rehearsal.artifactEnv.TEMPLATE_SHASUM,
          CLI_SHASUM: rehearsal.artifactEnv.CLI_SHASUM,
          CREATE_SHASUM: rehearsal.artifactEnv.CREATE_SHASUM,
        },
      });
      await runWorkflowShell({
        script: shell(step(rehearsal.createDraftReleaseJob, 'Create draft GitHub Release')),
        cwd: rehearsal.operationRoot,
        fakeBin: rehearsal.fakeBin,
        env: {
          ...rehearsal.commonEnv,
          GITHUB_OUTPUT: join(rehearsal.operationRoot, 'release-output'),
          GH_REPO: 'opx/tenkit',
          GH_TOKEN: 'disposable-token',
        },
      });
      await runWorkflowShell({
        script: shell(step(rehearsal.createDraftReleaseJob, 'Summarize Draft handoff')),
        cwd: rehearsal.operationRoot,
        fakeBin: rehearsal.fakeBin,
        env: {
          ...rehearsal.commonEnv,
          DRAFT_URL: 'https://github.com/opx/tenkit/releases/tag/untagged-disposable',
        },
      });

      const operations = (await readFile(rehearsal.operationLog, 'utf8')).trim().split('\n');
      expect(operations.filter((operation) => operation.startsWith('npm stage publish'))).toEqual([
        expect.stringContaining(
          `tenkit-template-generator-${rehearsal.version}.tgz --tag ${rehearsal.npmDistTag}`,
        ),
        expect.stringContaining(
          `tenkit-cli-${rehearsal.version}.tgz --tag ${rehearsal.npmDistTag}`,
        ),
        expect.stringContaining(
          `create-tenkit-${rehearsal.version}.tgz --tag ${rehearsal.npmDistTag}`,
        ),
      ]);
      expect(operations.join('\n')).not.toMatch(/npm (?:publish|stage approve|dist-tag)|^git tag/m);
      expect(operations.filter((operation) => operation.startsWith('gh api '))).toHaveLength(1);
      const [createReleaseOperation] = operations.filter((operation) =>
        operation.startsWith('gh release create'),
      );
      expect(createReleaseOperation).toContain(`release create ${rehearsal.gitTag}`);
      expect(createReleaseOperation).toContain(`--title ${rehearsal.gitTag}`);
      expect(createReleaseOperation).toContain(`--target ${rehearsal.sourceSha}`);
      expect(createReleaseOperation?.includes('--prerelease')).toBe(includesPrereleaseFlag);

      const summary = await readFile(rehearsal.summary, 'utf8');
      expect(summary).toContain(`Channel: \`${channel}\``);
      expect(summary).toContain(`Version: \`${rehearsal.version}\``);
      expect(summary).toContain(`npm dist-tag: \`${rehearsal.npmDistTag}\``);
      expect(summary).toContain(`Git tag: \`${rehearsal.gitTag}\``);
      expect(summary).toContain(`GitHub Release type: \`${rehearsal.githubReleaseType}\``);
      expect(summary).toContain(`Source SHA: \`${rehearsal.sourceSha}\``);
      expect(summary).toContain(
        `Untouched npm dist-tag: \`${channel === 'stable' ? 'next' : 'latest'}\``,
      );
      expect(summary).toContain(
        'Package approval order: `@tenkit/template-generator -> @tenkit/cli -> create-tenkit`',
      );
      expect(summary).toContain(
        `pnpm release:verify -- --source-sha ${rehearsal.sourceSha} --version ${rehearsal.version}`,
      );
      expect(summary).toContain(
        'Next action: Run the Release Verification command above. Approve nothing until it passes and names one package.',
      );
      expect(summary.match(/^Next action:/gm)).toHaveLength(1);
      expect(summary).not.toMatch(
        /Website visibility gate|External alias cleanup|Observed state|Stage reference|sha512-|11111111-1111-1111-1111-111111111111/,
      );
    },
  );

  test.each(['stable', 'rc'] as const)(
    'summarizes $channel partial staging with evidence and one STOP action',
    async (channel) => {
      const rehearsal = await createDraftRehearsal(channel);
      const partialEnv = {
        ...rehearsal.commonEnv,
        ...rehearsal.artifactEnv,
        GITHUB_OUTPUT: join(rehearsal.operationRoot, 'stage-output'),
        FAIL_ARTIFACT: 'tenkit-cli',
      };
      let partialOutputLog = '';

      try {
        await runWorkflowShell({
          script: shell(step(rehearsal.stageJob, 'Stage Release Set in dependency order')),
          cwd: rehearsal.operationRoot,
          fakeBin: rehearsal.fakeBin,
          env: partialEnv,
        });
        throw new Error('Partial staging rehearsal unexpectedly succeeded.');
      } catch (error) {
        const failure = requireRecord(error, 'partial staging failure');
        partialOutputLog = typeof failure.stdout === 'string' ? failure.stdout : '';
      }

      await runWorkflowShell({
        script: shell(step(rehearsal.stageJob, 'Summarize stopped staging')),
        cwd: rehearsal.operationRoot,
        fakeBin: rehearsal.fakeBin,
        env: partialEnv,
      });
      expect(partialOutputLog).not.toContain('RAW_NPM_RESPONSE_SENTINEL');
      expect(partialOutputLog).toContain(
        'npm returned stage reference 22222222-2222-2222-2222-222222222222 for @tenkit/cli.',
      );
      const summary = await readFile(rehearsal.summary, 'utf8');
      expect(summary).toContain(
        '@tenkit/template-generator: `11111111-1111-1111-1111-111111111111`',
      );
      expect(summary).toContain('@tenkit/cli: `22222222-2222-2222-2222-222222222222`');
      expect(summary).toContain(`Channel: \`${channel}\``);
      expect(summary).toContain(`Source SHA: \`${rehearsal.sourceSha}\``);
      expect(summary).toContain(
        'Next action: STOP. Do not retry or mutate npm. Follow the local uncommon recovery reference from this exact observed state.',
      );
      expect(summary.match(/^Next action:/gm)).toHaveLength(1);
      expect(summary).not.toMatch(
        /npm view|npm stage list|Release-Fix-Forward|Re-run failed jobs|reject all|partial-public fix-forward/,
      );

      const operations = (await readFile(rehearsal.operationLog, 'utf8')).trim().split('\n');
      expect(operations).toHaveLength(2);
      expect(operations).not.toContainEqual(expect.stringMatching(/^gh release create/));
    },
  );
});
