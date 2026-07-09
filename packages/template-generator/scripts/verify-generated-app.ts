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
import { verifyGeneratedApp } from '../src/generated-app-verification';

type ParsedArgs = {
  accent?: GeneratedAccentColor;
  setupType?: GeneratedSetupType;
  stylingChoice: GeneratedStylingChoice;
};

type ResolvedArgs = Omit<ParsedArgs, 'setupType'> & {
  setupType: GeneratedSetupType;
};

function usage(): string {
  return `Usage: pnpm -F @tenkit/template-generator verify -- --setup-type <${SUPPORTED_PUBLIC_SETUP_SLUGS.join('|')}> [--styling-choice <${SUPPORTED_GENERATED_STYLING_CHOICES.join('|')}>] [--accent <#RRGGBB>]`;
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
    } else if (arg === '--styling-choice') {
      parsed.stylingChoice = parseStylingChoice(readValue(args, index, arg));
      index += 1;
    } else if (arg === '--accent') {
      parsed.accent = parseAccent(readValue(args, index, arg));
      index += 1;
    } else {
      throw new Error(`Unknown argument ${arg}.\n${usage()}`);
    }
  }

  if (!parsed.setupType) {
    throw new Error(`Missing --setup-type.\n${usage()}`);
  }

  return {
    ...parsed,
    setupType: parsed.setupType,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const packageRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
  const workspaceRoot = resolve(packageRoot, '..', '..');

  await verifyGeneratedApp({
    setupType: args.setupType,
    accent: args.accent,
    stylingChoice: args.stylingChoice,
    workspaceRoot,
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
