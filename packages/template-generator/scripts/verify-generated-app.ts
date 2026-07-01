import { fileURLToPath } from 'node:url';

import { resolve } from 'pathe';

import {
  formatSupportedGeneratedSetupTypes,
  normalizeGeneratedSetupType,
  SUPPORTED_PUBLIC_SETUP_SLUGS,
  type GeneratedSetupType,
} from '../src/generator';
import { verifyGeneratedApp } from '../src/generated-app-verification';

function usage(): string {
  return `Usage: pnpm -F @tenkit/template-generator verify -- --setup-type <${SUPPORTED_PUBLIC_SETUP_SLUGS.join('|')}>`;
}

function parseSetupType(args: string[]): GeneratedSetupType {
  const setupTypeIndex = args.indexOf('--setup-type');
  const setupType = setupTypeIndex === -1 ? undefined : args[setupTypeIndex + 1];

  if (!setupType) {
    throw new Error(`Missing --setup-type.\n${usage()}`);
  }

  try {
    return normalizeGeneratedSetupType(setupType);
  } catch {
    throw new Error(
      `Unsupported generated Setup Type ${JSON.stringify(setupType)}. Expected ${formatSupportedGeneratedSetupTypes()}.`,
    );
  }
}

async function main() {
  const setupType = parseSetupType(process.argv.slice(2));
  const packageRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
  const workspaceRoot = resolve(packageRoot, '..', '..');

  await verifyGeneratedApp({ setupType, workspaceRoot });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
