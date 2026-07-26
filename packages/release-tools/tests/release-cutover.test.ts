import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const workflowRoot = resolve(workspaceRoot, '.github/workflows');
const retiredReleaseToolPaths = [
  'packages/release-tools/scripts/promote-release.ts',
  'packages/release-tools/scripts/smoke-candidate.ts',
  'packages/release-tools/src/candidate-smoke-command.ts',
  'packages/release-tools/src/promotion-command.ts',
  'packages/release-tools/src/public-candidate-release-set.ts',
  'packages/release-tools/tests/candidate-smoke-command.test.ts',
  'packages/release-tools/tests/promotion-command.test.ts',
].map((path) => resolve(workspaceRoot, path));

function requireRecord(value: unknown, description: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object.`);
  }

  return value as Record<string, unknown>;
}

describe('release workflow cutover', () => {
  test('removes Candidate Smoke and Promotion release-tool files', async () => {
    await Promise.all(
      retiredReleaseToolPaths.map((path) =>
        expect(access(path)).rejects.toMatchObject({ code: 'ENOENT' }),
      ),
    );
  });

  test('replaces the superseded publishing workflow', async () => {
    await expect(access(resolve(workflowRoot, 'publish.yml'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(resolve(workflowRoot, 'release-draft.yml'))).resolves.toBeUndefined();
  });

  test('keeps npm mutation and GitHub write authority separate without legacy mutations', async () => {
    const workflowFiles = (await readdir(workflowRoot)).filter(
      (filename) => filename.endsWith('.yml') || filename.endsWith('.yaml'),
    );

    for (const workflowFile of workflowFiles) {
      const workflow = requireRecord(
        parse(await readFile(resolve(workflowRoot, workflowFile), 'utf8')) as unknown,
        workflowFile,
      );
      const jobs = requireRecord(workflow.jobs, `${workflowFile} jobs`);

      for (const [jobName, jobValue] of Object.entries(jobs)) {
        const job = requireRecord(jobValue, `${workflowFile} ${jobName} job`);
        const permissions = requireRecord(
          job.permissions ?? {},
          `${workflowFile} ${jobName} permissions`,
        );
        const executableJob = JSON.stringify(job);
        const hasNpmMutationAuthority =
          permissions['id-token'] === 'write' || /\bnpm stage publish\b/.test(executableJob);
        const hasGitHubWriteAuthority =
          permissions.contents === 'write' || /\bgh release\b/.test(executableJob);

        expect(
          hasNpmMutationAuthority && hasGitHubWriteAuthority,
          `${workflowFile} job ${jobName} combines npm and GitHub mutation authority`,
        ).toBe(false);
        expect(`${workflowFile} ${jobName} ${executableJob}`).not.toMatch(
          /\bnpm publish\b|\bnpm stage approve\b|\bnpm dist-tag add\b|--tag[ =]candidate\b|\bgit tag\b|\b(?:Candidate Smoke|Promotion|Finalize)\b/,
        );
      }
    }
  });
});
