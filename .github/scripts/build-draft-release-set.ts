import { buildDraftReleaseSet } from '../../packages/release-tools/src/draft-release-set.ts';

function requireEnvironmentVariable(name: 'SOURCE_SHA' | 'VERSION' | 'WORKSPACE_ROOT'): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required to build the Draft Release Set.`);
  }

  return value;
}

async function main(): Promise<void> {
  const diagnostics = await buildDraftReleaseSet({
    workspaceRoot: requireEnvironmentVariable('WORKSPACE_ROOT'),
    sourceSha: requireEnvironmentVariable('SOURCE_SHA'),
    version: requireEnvironmentVariable('VERSION'),
  });

  process.stdout.write(JSON.stringify(diagnostics));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
