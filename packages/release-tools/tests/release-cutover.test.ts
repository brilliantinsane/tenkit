import { spawn } from 'node:child_process';
import { access, appendFile, copyFile, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const workflowRoot = resolve(workspaceRoot, '.github/workflows');
const legacyWorkflowPath = resolve(workflowRoot, 'publish.yml');
const legacyReleaseNotesScriptPath = resolve(workspaceRoot, 'scripts/generate-release-notes.mjs');
const legacyReleaseNotesConfigPath = resolve(workspaceRoot, 'changelogithub.config.mjs');
const retiredReleaseToolPaths = [
  'packages/release-tools/scripts/promote-release.ts',
  'packages/release-tools/scripts/smoke-candidate.ts',
  'packages/release-tools/src/candidate-smoke-command.ts',
  'packages/release-tools/src/promotion-command.ts',
  'packages/release-tools/src/public-candidate-release-set.ts',
  'packages/release-tools/tests/candidate-smoke-command.test.ts',
  'packages/release-tools/tests/promotion-command.test.ts',
].map((path) => resolve(workspaceRoot, path));
const activeReleaseDocumentationPaths = [
  resolve(workspaceRoot, 'package.json'),
  resolve(workspaceRoot, 'README.md'),
  resolve(workspaceRoot, 'CONTEXT.md'),
  resolve(workspaceRoot, 'docs/release.md'),
  resolve(workspaceRoot, 'docs/adr/0012-adopt-direct-stable-and-rc-release-sets.md'),
  resolve(workspaceRoot, 'packages/release-tools/package.json'),
];
const localOperatorGuidancePaths = [
  resolve(workspaceRoot, '.scratch/release-process-rederivation/handbook/maintainer-guide.md'),
  resolve(workspaceRoot, '.scratch/release-process-rederivation/handbook/maintainer-guide.html'),
  resolve(workspaceRoot, '.scratch/release-process-rederivation/handbook/recovery-reference.md'),
  resolve(workspaceRoot, '.scratch/release-process-rederivation/tabletop-rehearsal.md'),
  resolve(
    workspaceRoot,
    '.scratch/release-process-rederivation/handbook/render-maintainer-guide.rb',
  ),
];
const retiredOperationalPatterns = [
  /\brelease:(?:promote|smoke)\b/,
  /\b(?:promote-release|smoke-candidate|promotion-command|candidate-smoke-command|public-candidate-release-set)\b/,
  /\b(?:runPromotionCommand|runCandidateSmokeCommand|readPublicCandidateReleaseSet|PublicCandidatePackage(?:Error|Metadata))\b/,
  /\b(?:Candidate Smoke|Candidate tags|Promotion (?:preview|apply)|Manual Finalize):/,
  /(?<!Release )\bCandidate[- ](?:state|handoff|tags?)\b/,
  /(?<!Release )\bCandidate\b[^\n.!?]{0,100}\b(?:approval complete|hand[ -]?off|next action|proceed|ready for)\b/i,
  /\bPromotion step\b/,
  /\b(?:next action:?\s*|proceed to\s+|hand[ -]?off to\s+|ready for\s+)(?:the\s+)?promot(?:e|ion)\b/i,
  /\bFinalize (?:publication|step|the release)\b/,
  /\b(?:next action|proceed|continue|then|now|must|should|ready)\b[^\n.!?]{0,100}\bFinalize\b/i,
  /\b(?:run|perform|start|continue|resume|complete|apply|execute|use)\s+(?:the\s+)?(?:Candidate Smoke|Promotion|Finalize)\b/i,
  /\bFinalize:/,
  /\bname:\s*(?:Candidate Smoke|Promotion|Finalize)\b/,
  /\b(?:complete|partial|public) Candidate\b/,
  /\bdist-tags\.candidate\b/,
  /\b(?:[A-Z_]*TAG|[A-Za-z]*Tag|tag)\s*(?:=|:)\s*['"]candidate['"]/,
  /['"]?candidate['"]?\s*:/,
  /['"]candidate['"]/,
  /--tag(?:=|\s+)candidate\b/,
  /\bnpm dist-tag add\b[^\n]*\blatest\b/,
  /(?:--mode(?:=|\s+)|\bmode\s*[:=]\s*['"]?)candidate\b/,
] as const;

async function existingLocalOperatorGuidancePaths(): Promise<string[]> {
  const paths = await Promise.all(
    localOperatorGuidancePaths.map(async (path) => {
      try {
        await access(path);
        return path;
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          return undefined;
        }

        throw error;
      }
    }),
  );

  return paths.filter((path): path is string => path !== undefined);
}

async function activeReleaseArchitecturePaths(): Promise<string[]> {
  const roots = [
    workflowRoot,
    resolve(workspaceRoot, 'packages/release-tools/container'),
    resolve(workspaceRoot, 'packages/release-tools/scripts'),
    resolve(workspaceRoot, 'packages/release-tools/src'),
  ];
  const entries = await Promise.all(
    roots.map(async (root) => (await readdir(root)).map((filename) => resolve(root, filename))),
  );

  return [
    ...activeReleaseDocumentationPaths,
    ...(await existingLocalOperatorGuidancePaths()),
    ...entries.flat(),
  ].sort();
}

function isWorkflowFilename(filename: string): boolean {
  return filename.endsWith('.yml') || filename.endsWith('.yaml');
}

function requireRecord(value: unknown, description: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function runRuby(
  scriptPath: string,
  args: readonly string[],
): Promise<{ exitCode: number | null; output: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('ruby', [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      output += chunk;
    });
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolvePromise({ exitCode, output });
    });
  });
}

describe('release workflow cutover', () => {
  test('removes Candidate Smoke and Promotion release-tool files', async () => {
    await Promise.all(
      retiredReleaseToolPaths.map(async (path) => {
        await expect(access(path)).rejects.toMatchObject({ code: 'ENOENT' });
      }),
    );
  });

  test('keeps retired release behavior out of active architecture surfaces', async () => {
    const activePaths = await activeReleaseArchitecturePaths();

    for (const path of activePaths) {
      expect(path).not.toMatch(/(?:candidate-smoke|promotion|finalize)/i);

      const source = await readFile(path, 'utf8');

      for (const retiredPattern of retiredOperationalPatterns) {
        expect(source, path).not.toMatch(retiredPattern);
      }
    }
  });

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

  test('creates only a plan-identified source-bound draft for Release Publication', async () => {
    const draftWorkflowText = await readFile(resolve(workflowRoot, 'release-draft.yml'), 'utf8');

    expect(draftWorkflowText).toContain('gh release create "$GIT_TAG"');
    expect(draftWorkflowText).toContain('--draft');
    expect(draftWorkflowText).toContain('prerelease) set -- --prerelease');
    expect(draftWorkflowText).toContain('--target "$SOURCE_SHA"');
    expect(draftWorkflowText).not.toMatch(
      /gh release (?:edit|upload).*--draft=false|gh release publish/,
    );
  });

  test('keeps local operator guidance synchronized with executable Stable and RC behavior', async () => {
    const existingGuidancePaths = await existingLocalOperatorGuidancePaths();

    if (existingGuidancePaths.length === 0) {
      return;
    }

    expect(existingGuidancePaths).toHaveLength(localOperatorGuidancePaths.length);

    const guide = await readFile(localOperatorGuidancePaths[0]!, 'utf8');
    const generatedGuide = await readFile(localOperatorGuidancePaths[1]!, 'utf8');
    const recoveryReference = await readFile(localOperatorGuidancePaths[2]!, 'utf8');
    const tabletop = await readFile(localOperatorGuidancePaths[3]!, 'utf8');
    const stableProcedureStart = guide.indexOf('## Normal Stable procedure');
    const rcProcedureStart = guide.indexOf('## Normal RC procedure');

    expect(stableProcedureStart).toBeGreaterThan(-1);
    expect(rcProcedureStart).toBeGreaterThan(stableProcedureStart);

    const stableProcedure = guide.slice(stableProcedureStart, rcProcedureStart);
    const rcProcedure = guide.slice(rcProcedureStart);

    for (const procedure of [stableProcedure, rcProcedure]) {
      expect(procedure).toContain(
        'pnpm release:verify -- --source-sha <full-source-sha> --version <exact-version>',
      );
      expect(procedure).toContain('@tenkit/template-generator');
      expect(procedure).toContain('@tenkit/cli');
      expect(procedure).toContain('create-tenkit');
      expect(procedure).toContain('npm 2FA');
      expect(procedure).toContain('Publish the existing GitHub draft');
      expect(procedure).toContain('rerun the same Release Verification command');
    }

    expect(stableProcedure).toContain('pnpm create tenkit@latest --version');
    expect(rcProcedure).not.toContain('pnpm create tenkit@latest --version');
    expect(generatedGuide).toContain('href="recovery-reference.md"');
    expect(generatedGuide).not.toContain('recovery-reference_md.html');

    const stableGeneratedProcedure = generatedGuide.slice(
      generatedGuide.indexOf('Normal+Stable+procedure'),
      generatedGuide.indexOf('Normal+RC+procedure'),
    );
    const rcGeneratedProcedure = generatedGuide.slice(
      generatedGuide.indexOf('Normal+RC+procedure'),
      generatedGuide.indexOf('If+the+normal+path+stops'),
    );

    expect(stableGeneratedProcedure.match(/<ol(?: start="\d+")?>/g)).toEqual([
      '<ol>',
      '<ol start="4">',
      '<ol start="5">',
      '<ol start="6">',
      '<ol start="7">',
    ]);
    expect(rcGeneratedProcedure.match(/<ol(?: start="\d+")?>/g)).toEqual([
      '<ol>',
      '<ol start="4">',
      '<ol start="5">',
      '<ol start="6">',
      '<ol start="7">',
    ]);

    for (const state of [
      'fully private',
      'partial public (1/3)',
      'partial public (2/3)',
      'complete public',
      'published',
      'eventual-consistency',
      'nonstandard',
    ]) {
      expect(recoveryReference).toContain(state);
    }

    expect(recoveryReference).toContain(
      'Aliases already processed in the ordered list are absent.',
    );
    expect(recoveryReference).toContain(
      'Aliases not yet processed still match their recorded baseline values.',
    );
    expect(recoveryReference).toContain(
      'After all six removals and readbacks, require this final state:',
    );

    expect(tabletop).toContain('State: fully private');
    expect(tabletop).toContain('State: complete public');
    expect(tabletop).toContain('State: published');

    for (const document of [guide, recoveryReference, tabletop]) {
      expect(document).toMatch(/not safe for live release use until ticket 14/i);
    }
  });

  test('detects drift in the generated maintainer guide', async () => {
    const existingGuidancePaths = await existingLocalOperatorGuidancePaths();

    if (existingGuidancePaths.length === 0) {
      return;
    }

    const operationRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-docs-'));

    try {
      for (const path of [
        localOperatorGuidancePaths[0]!,
        localOperatorGuidancePaths[1]!,
        localOperatorGuidancePaths[4]!,
      ]) {
        await copyFile(path, join(operationRoot, basename(path)));
      }

      const rendererPath = join(operationRoot, 'render-maintainer-guide.rb');
      const synchronizedCheck = await runRuby(rendererPath, ['--check']);

      expect(synchronizedCheck.exitCode, synchronizedCheck.output).toBe(0);

      await appendFile(join(operationRoot, 'maintainer-guide.html'), '\n<!-- drift -->\n');

      const driftCheck = await runRuby(rendererPath, ['--check']);

      expect(driftCheck.exitCode, driftCheck.output).toBe(1);
      expect(driftCheck.output).toContain(
        'maintainer-guide.html is out of date; regenerate it from maintainer-guide.md.',
      );
    } finally {
      await rm(operationRoot, { recursive: true });
    }
  });
});
