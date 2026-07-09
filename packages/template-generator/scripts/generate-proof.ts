import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolve } from 'pathe';

import {
  formatSupportedGeneratedSetupTypes,
  normalizeGeneratedAccentColor,
  normalizeGeneratedStylingChoice,
  normalizeGeneratedSetupType,
  SUPPORTED_GENERATED_STYLING_CHOICES,
  SUPPORTED_PUBLIC_SETUP_SLUGS,
  type GeneratedSetupType,
  type GeneratedAccentColor,
  type GeneratedStylingChoice,
} from '../src/generator';
import { getGeneratedSetupTypeDefinition } from '../src/generated-setup-types';
import { runGenerationProof, tryCommitInitialGitSnapshot } from '../src/local-proof';

type ParsedArgs = {
  accent?: GeneratedAccentColor;
  setupType?: GeneratedSetupType;
  target?: string;
  force: boolean;
  install: boolean;
  projectName?: string;
  packageName?: string;
  stylingChoice: GeneratedStylingChoice;
};

type ResolvedArgs = ParsedArgs & {
  setupType: GeneratedSetupType;
  target: string;
};

function usage(): string {
  return `Usage: pnpm -F @tenkit/template-generator proof -- --setup-type <${SUPPORTED_PUBLIC_SETUP_SLUGS.join('|')}> --target <folder> [--styling <${SUPPORTED_GENERATED_STYLING_CHOICES.join('|')}>] [--accent <#RRGGBB>] [--force] [--no-install] [--project-name <name>] [--package-name <name>]`;
}

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.\n${usage()}`);
  }

  return value;
}

function parseSetupType(value: string): GeneratedSetupType {
  try {
    return normalizeGeneratedSetupType(value);
  } catch {
    throw new Error(
      `Unsupported generated Setup Type ${JSON.stringify(value)}. Expected ${formatSupportedGeneratedSetupTypes()}.`,
    );
  }
}

function parseStylingChoice(value: string): GeneratedStylingChoice {
  try {
    return normalizeGeneratedStylingChoice(value);
  } catch {
    throw new Error(
      `Unsupported generated Styling Choice ${JSON.stringify(value)}. Expected one of: ${SUPPORTED_GENERATED_STYLING_CHOICES.join(', ')}.`,
    );
  }
}

function parseAccent(value: string): GeneratedAccentColor {
  const accent = normalizeGeneratedAccentColor(value);

  if (accent === undefined) {
    throw new Error('--accent requires a value.');
  }

  return accent;
}

function parseArgs(args: string[]): ResolvedArgs {
  const parsed: ParsedArgs = {
    force: false,
    install: true,
    stylingChoice: 'bare',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') {
      continue;
    }

    if (arg === '--setup-type') {
      parsed.setupType = parseSetupType(readValue(args, index, arg));
      index += 1;
    } else if (arg === '--target') {
      parsed.target = readValue(args, index, arg);
      index += 1;
    } else if (arg === '--styling') {
      parsed.stylingChoice = parseStylingChoice(readValue(args, index, arg));
      index += 1;
    } else if (arg === '--accent') {
      parsed.accent = parseAccent(readValue(args, index, arg));
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

  if (!parsed.setupType) {
    throw new Error(`Missing --setup-type.\n${usage()}`);
  }

  if (!parsed.target) {
    throw new Error(`Missing --target.\n${usage()}`);
  }

  return {
    ...parsed,
    setupType: parsed.setupType,
    target: parsed.target,
  };
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
  const displayTargetDir = args.target;

  const result = await runGenerationProof({
    setupType: args.setupType,
    accent: args.accent,
    targetDir,
    force: args.force,
    git: 'init',
    projectName: args.projectName,
    packageName: args.packageName,
    stylingChoice: args.stylingChoice,
    workspaceRoot,
  });

  if (args.install) {
    console.log('Installing dependencies...');
    const installed = await runPnpmInstall(result.targetDir);

    if (!installed) {
      console.log('Dependency installation failed. Continuing with generated files in place.');
    }
  }

  if (!result.gitInitialized) {
    if (result.gitSkippedBecauseTargetWasNotEmpty) {
      console.log('Initial git repository was skipped because the target folder was not empty.');
    } else {
      console.log('Initial git repository was skipped. Initialize git and commit when ready.');
    }
  }

  const committed = result.gitInitialized
    ? await tryCommitInitialGitSnapshot(result.targetDir)
    : false;

  if (result.gitInitialized && !committed) {
    console.log('Initial git commit was skipped. Configure git identity and commit when ready.');
  }

  console.log('');
  console.log(getGeneratedSetupTypeDefinition(args.setupType).readyMessage);
  console.log('');
  console.log('To run your project:');
  console.log(`- cd ${displayTargetDir}`);
  console.log('- pnpm run android');
  console.log('- pnpm run ios');
  console.log('- pnpm run web');
  console.log('');
  console.log('To inspect config:');
  console.log('- pnpm expo:config');

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
