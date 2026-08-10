import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

import { resolve } from 'pathe';
import {
  isGeneratedNodeBackend,
  resolveGeneratedAppOptions,
  type GeneratedAppOptions,
  type RawGeneratedAppOptions,
} from '@tenkit/types/generated-app-option-definitions';
import {
  SUPPORTED_PUBLIC_SETUP_SLUGS,
  type GeneratedSetupType,
} from '@tenkit/types/setup-type-definitions';
import {
  normalizeGeneratedStylingChoice,
  SUPPORTED_GENERATED_STYLING_CHOICES,
  type GeneratedStylingChoice,
} from '@tenkit/types/styling-definitions';

import { formatSupportedGeneratedSetupTypes, normalizeGeneratedSetupType } from '../src/generator';
import { verifyGeneratedApp } from '../src/generated-app-verification';
import { createGeneratedAppCommandEnvironment } from '../src/generated-app-command-runner';

type ParsedArgs = {
  appVariantAccents?: string[];
  appVariantNames?: string[];
  generatedAppOptions: RawGeneratedAppOptions;
  setupType?: GeneratedSetupType;
  stylingChoice: GeneratedStylingChoice;
};

type ResolvedArgs = Omit<ParsedArgs, 'generatedAppOptions' | 'setupType'> & {
  generatedAppOptions: GeneratedAppOptions;
  setupType: GeneratedSetupType;
};

function usage(): string {
  return `Usage: pnpm -F @tenkit/template-generator verify -- --setup-type <${SUPPORTED_PUBLIC_SETUP_SLUGS.join('|')}> [--backend <none|express|nestjs|convex>] [--auth <none>] [--database <none>] [--orm <none>] [--styling <${SUPPORTED_GENERATED_STYLING_CHOICES.join('|')}>] [--variant-names <name,...>] [--variant-accents <#RRGGBB,...>]`;
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

function parseOrderedValues(value: string): string[] {
  return value.split(',').map((entry) => entry.trim());
}

function parseArgs(args: string[]): ResolvedArgs {
  const parsed: ParsedArgs = {
    generatedAppOptions: {},
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
    } else if (arg === '--backend') {
      parsed.generatedAppOptions.backend = readValue(args, index, arg);
      index += 1;
    } else if (arg === '--auth') {
      parsed.generatedAppOptions.auth = readValue(args, index, arg);
      index += 1;
    } else if (arg === '--database') {
      parsed.generatedAppOptions.database = readValue(args, index, arg);
      index += 1;
    } else if (arg === '--orm') {
      parsed.generatedAppOptions.orm = readValue(args, index, arg);
      index += 1;
    } else if (arg === '--styling') {
      parsed.stylingChoice = parseStylingChoice(readValue(args, index, arg));
      index += 1;
    } else if (arg === '--variant-names') {
      parsed.appVariantNames = parseOrderedValues(readValue(args, index, arg));
      index += 1;
    } else if (arg === '--variant-accents') {
      parsed.appVariantAccents = parseOrderedValues(readValue(args, index, arg));
      index += 1;
    } else {
      throw new Error(`Unknown argument ${arg}.\n${usage()}`);
    }
  }

  if (!parsed.setupType) {
    throw new Error(`Missing --setup-type.\n${usage()}`);
  }

  const generatedAppOptionsResolution = resolveGeneratedAppOptions(parsed.generatedAppOptions);
  if (generatedAppOptionsResolution.status === 'invalid') {
    throw new Error('Unsupported Generated App Option combination.');
  }

  return {
    ...parsed,
    generatedAppOptions: generatedAppOptionsResolution.selection,
    setupType: parsed.setupType,
  };
}

function acquireAvailablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate a local verification port.'));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePort(address.port);
      });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const packageRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
  const workspaceRoot = resolve(packageRoot, '..', '..');
  const isNodeBackend = isGeneratedNodeBackend(args.generatedAppOptions.backend);
  const port = isNodeBackend ? await acquireAvailablePort() : undefined;
  const environment = createGeneratedAppCommandEnvironment(
    port === undefined ? {} : { PORT: String(port), CLIENT_ORIGIN: 'http://localhost:8081' },
  );

  const evidence = await verifyGeneratedApp({
    setupType: args.setupType,
    appVariantAccents: args.appVariantAccents,
    appVariantNames: args.appVariantNames,
    generatedAppOptions: args.generatedAppOptions,
    stylingChoice: args.stylingChoice,
    workspaceRoot,
    environment,
    profile:
      args.generatedAppOptions.backend === 'convex'
        ? 'convex'
        : isNodeBackend
          ? 'node-server'
          : 'deterministic',
  });

  if (evidence.status === 'failed') {
    const firstFailure = evidence.failures[0];
    const retainedTarget = evidence.retainedTargetName
      ? ` Failed target retained in the system temporary directory as ${evidence.retainedTargetName}.`
      : '';
    throw new Error(
      firstFailure
        ? `Generated app verification failed during ${firstFailure.phase}: ${firstFailure.message}${retainedTarget}`
        : `Generated app verification failed without structured failure evidence.${retainedTarget}`,
    );
  }

  console.log(`Verified generated ${args.setupType} Expo app with ${args.stylingChoice} Styling.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
