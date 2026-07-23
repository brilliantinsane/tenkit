import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const workflowRoot = resolve(workspaceRoot, '.github/workflows');
const legacyWorkflowPath = resolve(workflowRoot, 'publish.yml');
const legacyReleaseNotesScriptPath = resolve(workspaceRoot, 'scripts/generate-release-notes.mjs');
const legacyReleaseNotesConfigPath = resolve(workspaceRoot, 'changelogithub.config.mjs');

function isWorkflowFilename(filename: string): boolean {
  return filename.endsWith('.yml') || filename.endsWith('.yaml');
}

function requireRecord(value: unknown, description: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object.`);
  }

  return value as Record<string, unknown>;
}

describe('release workflow cutover', () => {
  test('removes the combined publishing workflow after replacement checks exist', async () => {
    await expect(access(legacyWorkflowPath)).rejects.toMatchObject({ code: 'ENOENT' });

    const workflowFiles = (await readdir(workflowRoot)).filter(isWorkflowFilename).sort();
    expect(workflowFiles).toContain('release-draft.yml');
    expect(workflowFiles).not.toContain('publish.yml');
  });

  test('removes scripts used only by the combined publishing workflow', async () => {
    const packageMetadata = requireRecord(
      JSON.parse(await readFile(resolve(workspaceRoot, 'package.json'), 'utf8')) as unknown,
      'workspace package metadata',
    );
    const scripts = requireRecord(packageMetadata.scripts, 'workspace package scripts');

    expect(scripts).not.toHaveProperty('release:notes');
    await expect(access(legacyReleaseNotesScriptPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(legacyReleaseNotesConfigPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('keeps npm mutation and GitHub write authority in separate jobs', async () => {
    const workflowFiles = (await readdir(workflowRoot)).filter(isWorkflowFilename);

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
        const serializedJob = JSON.stringify(job);
        const hasNpmMutationAuthority =
          permissions['id-token'] === 'write' ||
          /\bnpm (?:stage publish|dist-tag add)\b/.test(serializedJob);
        const hasGitHubWriteAuthority =
          permissions.contents === 'write' || /\bgh release\b/.test(serializedJob);

        expect(
          hasNpmMutationAuthority && hasGitHubWriteAuthority,
          `${workflowFile} job ${jobName} combines npm mutation and GitHub write authority`,
        ).toBe(false);
        expect(serializedJob).not.toMatch(/\bnpm publish\b|\bnpm stage approve\b|\bgit tag\b/);
      }
    }
  });

  test('creates only a source-bound draft for manual Finalize', async () => {
    const draftWorkflowText = await readFile(resolve(workflowRoot, 'release-draft.yml'), 'utf8');

    expect(draftWorkflowText).toContain('gh release create "v$VERSION"');
    expect(draftWorkflowText).toContain('--draft');
    expect(draftWorkflowText).toContain('--target "$SOURCE_SHA"');
    expect(draftWorkflowText).not.toMatch(
      /gh release (?:edit|upload).*--draft=false|gh release publish/,
    );
  });
});
