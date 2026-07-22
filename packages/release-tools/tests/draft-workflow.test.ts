import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, test } from 'vitest';
import { parse } from 'yaml';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const githubRoot = resolve(workspaceRoot, '.github');
const workflowPath = resolve(workspaceRoot, '.github/workflows/release-draft.yml');
const releaseToolsPackagePath = resolve(workspaceRoot, 'packages/release-tools/package.json');
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

async function createDraftRehearsal() {
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
  const version = '0.4.0';
  await mkdir(fakeBin);
  await mkdir(artifactRoot);
  const artifacts = [
    'tenkit-template-generator-0.4.0.tgz',
    'tenkit-cli-0.4.0.tgz',
    'create-tenkit-0.4.0.tgz',
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
if [ "$1 $2" != 'release create' ]; then exit 66; fi
printf 'https://github.com/opx/tenkit/releases/tag/untagged-disposable\\n'
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
      SOURCE_SHA: sourceSha,
      VERSION: version,
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
  };
}

describe('Draft Release workflow', () => {
  test('captures the default-branch dispatch SHA before automatic stable planning', async () => {
    const workflow = await readWorkflow();
    const dispatch = requireRecord(
      requireRecord(workflow.on, 'workflow triggers').workflow_dispatch,
      'dispatch',
    );
    const concurrency = requireRecord(workflow.concurrency, 'workflow concurrency');

    expect(workflow.name).toBe('Draft Release');
    expect(dispatch).toEqual({});
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(concurrency).toEqual({
      group: 'stable-release-set',
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
    expect(serializedBuildSteps).not.toContain('inputs.source_sha');
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
      serializedBuildSteps.indexOf('Plan automatic stable Release Set version'),
    );
    expect(serializedBuildSteps).not.toMatch(/"(?:patch|minor|major)"/);
  });

  test('plans, checks, and canonically packs in the read-only build job', async () => {
    const workflow = await readWorkflow();
    const build = job(workflow, 'build');
    const serializedBuild = JSON.stringify(build);
    const githubFiles = await readdir(githubRoot, { recursive: true });
    const releaseToolsPackage = requireRecord(
      JSON.parse(await readFile(releaseToolsPackagePath, 'utf8')) as unknown,
      'release-tools package metadata',
    );
    const releaseToolsScripts = requireRecord(
      releaseToolsPackage.scripts,
      'release-tools package scripts',
    );

    expect(build.permissions).toEqual({ contents: 'read' });
    expect(serializedBuild).toMatch(/pnpm (?:--silent )?release:plan/);
    expect(serializedBuild).toContain('pnpm release:check');
    expect(serializedBuild).toContain('pnpm --silent -F @tenkit/release-tools draft:build');
    expect(releaseToolsScripts['draft:build']).toBe('tsx scripts/build-draft-release-set.ts');
    expect(githubFiles.filter((file) => file.endsWith('.ts'))).toEqual([]);
    expect(serializedBuild).not.toContain('build-draft-release-set.ts');
    expect(serializedBuild).not.toContain('exec tsx');
    expect(serializedBuild).not.toContain('tsx -e');
    expect(serializedBuild).not.toContain("?? ''");
    expect(serializedBuild).toContain('release-artifacts/*.tgz');
    expect(serializedBuild).not.toMatch(/id-token|contents":"write|npm stage|gh release/);

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
    expect(serializedStage.indexOf('tenkit-template-generator-')).toBeLessThan(
      serializedStage.indexOf('tenkit-cli-'),
    );
    expect(serializedStage.indexOf('tenkit-cli-')).toBeLessThan(
      serializedStage.indexOf('create-tenkit-'),
    );
    expect(serializedStage).toMatch(/npm stage publish[^\n]+--tag candidate/);
    expect(serializedStage).toContain('--access public');
    expect(serializedStage).toContain('--provenance');
    expect(serializedStage).toContain('always()');
    expect(serializedStage).toContain('npm stage list @tenkit/template-generator');
    expect(serializedStage).toContain('npm stage list @tenkit/cli');
    expect(serializedStage).toContain('npm stage list create-tenkit');
    expect(serializedStage).toContain('do not retry this run or combine its stages');
    expect(serializedStage).not.toContain(`printf '%s\\n' "$OUTPUT"`);

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
    expect(serializedCreateDraftRelease).not.toMatch(
      /id-token|\bnpm (?:stage|publish|dist-tag)|actions\/checkout|git tag/,
    );
    expect(serializedCreateDraftRelease).toContain('gh release create');
    expect(serializedCreateDraftRelease).toContain('--draft');
    expect(serializedCreateDraftRelease).toMatch(/--target \\"\$SOURCE_SHA\\"/);
    expect(serializedCreateDraftRelease).toContain('Untrusted Draft diagnostics');
    expect(serializedCreateDraftRelease).toContain('pnpm release:verify -- --source-sha');
    expect(serializedCreateDraftRelease).toContain('needs.stage.outputs.template-stage-id');
    expect(serializedCreateDraftRelease).toContain('needs.stage.outputs.cli-stage-id');
    expect(serializedCreateDraftRelease).toContain('needs.stage.outputs.create-stage-id');
  });

  test('rehearses successful private staging and one draft Release', async () => {
    const rehearsal = await createDraftRehearsal();
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
      script: shell(step(rehearsal.stageJob, 'Record partial-staging recovery instructions')),
      cwd: rehearsal.operationRoot,
      fakeBin: rehearsal.fakeBin,
      env: rehearsal.commonEnv,
    });
    await runWorkflowShell({
      script: shell(
        step(rehearsal.createDraftReleaseJob, 'Materialize untrusted Draft diagnostics'),
      ),
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

    const operations = (await readFile(rehearsal.operationLog, 'utf8')).trim().split('\n');
    expect(operations).toHaveLength(4);
    expect(
      operations.filter((operation) => operation.startsWith('npm stage publish')),
    ).toHaveLength(3);
    expect(operations.join('\n')).not.toMatch(/npm (?:publish|stage approve|dist-tag)|^git tag/m);
    expect(operations.filter((operation) => operation.startsWith('gh release create'))).toEqual([
      expect.stringMatching(new RegExp(`--draft .*--target ${rehearsal.sourceSha} .*--notes-file`)),
    ]);
    await expect(readFile(rehearsal.summary, 'utf8')).resolves.toContain(
      `Source SHA: \`${rehearsal.sourceSha}\``,
    );
    await expect(readFile(rehearsal.summary, 'utf8')).resolves.toContain(
      `Version: \`${rehearsal.version}\``,
    );
  });

  test('rehearses partial-staging recovery without retrying or creating a Release', async () => {
    const rehearsal = await createDraftRehearsal();
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
      script: shell(step(rehearsal.stageJob, 'Record partial-staging recovery instructions')),
      cwd: rehearsal.operationRoot,
      fakeBin: rehearsal.fakeBin,
      env: partialEnv,
    });
    expect(partialOutputLog).not.toContain('RAW_NPM_RESPONSE_SENTINEL');
    expect(partialOutputLog).toContain(
      'npm returned stage reference 22222222-2222-2222-2222-222222222222 for @tenkit/cli.',
    );
    await expect(readFile(rehearsal.summary, 'utf8')).resolves.toContain(
      '@tenkit/template-generator: `11111111-1111-1111-1111-111111111111`',
    );
    await expect(readFile(rehearsal.summary, 'utf8')).resolves.toContain(
      '@tenkit/cli: `22222222-2222-2222-2222-222222222222`',
    );
    await expect(readFile(rehearsal.summary, 'utf8')).resolves.toContain(
      'npm stage list @tenkit/cli',
    );
    await expect(readFile(rehearsal.summary, 'utf8')).resolves.toContain(
      `Source SHA: \`${rehearsal.sourceSha}\``,
    );
    const operations = (await readFile(rehearsal.operationLog, 'utf8')).trim().split('\n');
    expect(operations).toHaveLength(2);
    expect(operations).not.toContainEqual(expect.stringMatching(/^gh release create/));
  });
});
