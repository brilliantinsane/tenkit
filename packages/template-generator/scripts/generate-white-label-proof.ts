import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolve } from 'pathe';

import { runWhiteLabelGenerationProof, tryCommitInitialGitSnapshot } from '../src/local-proof';

type ParsedArgs = {
  target?: string;
  force: boolean;
  install: boolean;
  projectName?: string;
  packageName?: string;
};

type ResolvedArgs = ParsedArgs & {
  target: string;
};

function usage(): string {
  return `Usage: pnpm -F @tenkit/template-generator generate:white-label-proof -- --target <folder> [--force] [--no-install] [--project-name <name>] [--package-name <name>]`;
}

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.\n${usage()}`);
  }

  return value;
}

function parseArgs(args: string[]): ResolvedArgs {
  const parsed: ParsedArgs = {
    force: false,
    install: true,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') {
      continue;
    }

    if (arg === '--target') {
      parsed.target = readValue(args, index, arg);
      index += 1;
    } else if (arg === '--force') {
      parsed.force = true;
    } else if (arg === '--no-install') {
      parsed.install = false;
    } else if (arg === '--project-name') {
      parsed.projectName = readValue(args, index, arg);
      index += 1;
    } else if (arg === '--package-name') {
      parsed.packageName = readValue(args, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown argument ${arg}.\n${usage()}`);
    }
  }

  if (!parsed.target) {
    throw new Error(`Missing --target.\n${usage()}`);
  }

  return parsed as ResolvedArgs;
}

function resolveFromInitialWorkingDirectory(path: string): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

function runPnpmInstall(cwd: string): Promise<boolean> {
  return new Promise((resolveInstall, reject) => {
    const child = spawn('pnpm', ['install'], {
      cwd,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolveInstall(true);
        return;
      }

      resolveInstall(false);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const packageRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
  const workspaceRoot = resolve(packageRoot, '..', '..');
  const targetDir = resolveFromInitialWorkingDirectory(args.target);

  const result = await runWhiteLabelGenerationProof({
    targetDir,
    force: args.force,
    git: 'init',
    projectName: args.projectName,
    packageName: args.packageName,
    playgroundDir: resolve(workspaceRoot, 'apps/playground'),
  });

  if (args.install) {
    console.log(`Installing dependencies in ${result.targetDir}`);
    const installed = await runPnpmInstall(result.targetDir);

    if (!installed) {
      console.log('Dependency installation failed. Continuing with generated files in place.');
    }
  }

  const committed = await tryCommitInitialGitSnapshot(result.targetDir);

  if (!committed) {
    console.log('Initial git commit was skipped. Configure git identity and commit when ready.');
  }

  console.log('');
  console.log('Your Tenkit White Label app is ready!');
  console.log('');
  console.log('To run your project:');
  console.log(`- cd ${result.targetDir}`);
  console.log('- pnpm run android');
  console.log('- pnpm run ios');
  console.log('- pnpm run web');
  console.log('');
  console.log('To inspect a different App Variant:');
  console.log('- APP_VARIANT_SLUG=second-tenant pnpm expo:config');

  if (!args.install) {
    console.log('');
    console.log(
      'Dependencies were not installed. Run pnpm install in the generated project first.',
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
