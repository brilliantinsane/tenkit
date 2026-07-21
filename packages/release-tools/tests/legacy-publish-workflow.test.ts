import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, test } from 'vitest';
import { parse } from 'yaml';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const workflowPath = resolve(workspaceRoot, '.github/workflows/publish.yml');
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
  return requireRecord(parse(await readFile(workflowPath, 'utf8')) as unknown, 'Publish workflow');
}

function step(workflow: Record<string, unknown>, name: string): Record<string, unknown> {
  const publishJob = requireRecord(
    requireRecord(workflow.jobs, 'workflow jobs').publish,
    'publish job',
  );

  if (!Array.isArray(publishJob.steps)) {
    throw new Error('Publish job steps must be an array.');
  }

  const matchingStep = publishJob.steps.find(
    (candidate) => requireRecord(candidate, 'workflow step').name === name,
  );
  return requireRecord(matchingStep, `${name} step`);
}

describe('legacy Publish workflow', () => {
  test('smokes the exact published version through an isolated representative create flow', async () => {
    const workflow = await readWorkflow();
    const metadataScript = step(workflow, 'Resolve release metadata').run;
    const smokeScript = step(workflow, 'Smoke published create command').run;

    expect(metadataScript).toEqual(expect.stringContaining('RELEASE_VERSION=$release_version'));
    expect(smokeScript).toEqual(expect.any(String));

    if (typeof smokeScript !== 'string') {
      throw new Error('Published create smoke must be a shell step.');
    }

    expect(smokeScript).not.toContain('release:published-smoke');

    const operationRoot = await mkdtemp(join(tmpdir(), 'tenkit-legacy-publish-rehearsal-'));
    tempRoots.push(operationRoot);
    const fakeBin = join(operationRoot, 'bin');
    const commandLog = join(operationRoot, 'pnpm-command.log');
    await mkdir(fakeBin);
    const fakePnpm = join(fakeBin, 'pnpm');
    await writeFile(
      fakePnpm,
      `#!/bin/bash
set -euo pipefail
printf '%s\\n' "$*" > "$COMMAND_LOG"
project_name=''
while (( $# > 0 )); do
  if [ "$1" = '--name' ]; then project_name="$2"; break; fi
  shift
done
test -n "$project_name"
mkdir -p "$PWD/$project_name/src/constants"
touch "$PWD/$project_name/package.json"
touch "$PWD/$project_name/src/constants/runtime-tenants.ts"
`,
    );
    await chmod(fakePnpm, 0o755);

    await execFileAsync('/bin/bash', ['-euo', 'pipefail', '-c', smokeScript], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
        COMMAND_LOG: commandLog,
        RELEASE_VERSION: '0.4.0',
        RUNNER_TEMP: operationRoot,
      },
    });

    expect(await readFile(commandLog, 'utf8')).toBe(
      '--config.minimumReleaseAge=0 create tenkit@0.4.0 --name tenkit-published-smoke --setup runtime-tenants --styling bare --package-manager pnpm --yes --no-install --no-git\n',
    );
  });
});
