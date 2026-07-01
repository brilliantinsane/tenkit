import { writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import { generate } from 'changelogithub';

import config from '../changelogithub.config.mjs';

const tag = process.argv[2] || process.env.GITHUB_REF_NAME;
const workspaceRoot = resolve(import.meta.dirname, '..');
const outputPath = resolve(workspaceRoot, process.argv[3] || 'release-notes.md');
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (!tag) {
  console.error('Usage: pnpm release:notes -- <tag> [output-path]');
  process.exit(1);
}

const relativeOutputPath = relative(workspaceRoot, outputPath);

if (relativeOutputPath.startsWith('..') || relativeOutputPath === '') {
  throw new Error('Release notes output path must be inside the workspace.');
}

const changelog = await generate({
  to: tag,
  ...config,
  token: githubToken,
});

await writeFile(outputPath, `## ${tag}\n\n${changelog.output}\n`);
console.log(`Wrote release notes for ${tag}.`);
