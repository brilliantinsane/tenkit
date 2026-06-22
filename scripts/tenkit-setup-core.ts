import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { type SetupType } from '../src/setup-types/core';
import { genericAppStarterData } from '../starter-data/generic-with-standalone-app-variants';
import { singleAppRuntimeTenantsStarterData } from '../starter-data/single-app-runtime-tenants';
import { whiteLabelAppsStarterSetup } from '../starter-data/white-label-apps';

export type SetupFileOperation =
  | {
      kind: 'write';
      path: string;
      contents: string;
    }
  | {
      kind: 'copy';
      from: string;
      path: string;
    }
  | {
      kind: 'delete';
      path: string;
    };

export type SetupFilePlan = {
  setupType: SetupType;
  operations: readonly SetupFileOperation[];
};

export type SetupFlags = {
  setupType?: string;
  yes?: boolean;
  force?: boolean;
  dryRun?: boolean;
};

export type ApplySetupPlanResult = {
  applied: boolean;
  blockedTargets: string[];
  operations: readonly SetupFileOperation[];
};

const IMPLEMENTED_SETUP_TYPES = [
  'white-label-apps',
  'single-app-runtime-tenants',
  'generic-with-standalone-app-variants',
] as const;

export function getImplementedSetupTypes(): SetupType[] {
  return [...IMPLEMENTED_SETUP_TYPES];
}

function createSingleAppRuntimeTenantsPlan(): SetupFilePlan {
  return {
    setupType: 'single-app-runtime-tenants',
    operations: [
      {
        kind: 'write',
        path: 'src/active-setup/manifest.ts',
        contents: renderSingleAppRuntimeTenantsManifest(),
      },
      {
        kind: 'write',
        path: 'src/active-setup/runtime-tenants.ts',
        contents: renderSingleAppRuntimeTenantsRuntimeData(),
      },
    ],
  };
}

function createWhiteLabelAppsPlan(): SetupFilePlan {
  return {
    setupType: 'white-label-apps',
    operations: [
      {
        kind: 'write',
        path: 'src/active-setup/manifest.ts',
        contents: renderWhiteLabelAppsManifest(),
      },
      {
        kind: 'delete',
        path: 'src/active-setup/runtime-tenants.ts',
      },
    ],
  };
}

function createGenericWithStandaloneAppVariantsPlan(): SetupFilePlan {
  return {
    setupType: 'generic-with-standalone-app-variants',
    operations: [
      {
        kind: 'write',
        path: 'src/active-setup/manifest.ts',
        contents: renderGenericWithStandaloneAppVariantsManifest(),
      },
      {
        kind: 'write',
        path: 'src/active-setup/runtime-tenants.ts',
        contents: renderGenericWithStandaloneAppVariantsRuntimeData(),
      },
    ],
  };
}

function quoteTsString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function formatTsValue(value: unknown, indent = 0): string {
  const padding = ' '.repeat(indent);
  const childPadding = ' '.repeat(indent + 2);

  if (typeof value === 'string') {
    return quoteTsString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    return `[\n${value
      .map((item) => `${childPadding}${formatTsValue(item, indent + 2)},`)
      .join('\n')}\n${padding}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      return '{}';
    }

    return `{\n${entries
      .map(
        ([key, entryValue]) => `${childPadding}${key}: ${formatTsValue(entryValue, indent + 2)},`,
      )
      .join('\n')}\n${padding}}`;
  }

  throw new Error(`Cannot render unsupported Starter Data value: ${String(value)}`);
}

function renderSingleAppRuntimeTenantsManifest(): string {
  return `import { defineSingleAppRuntimeTenantsSetup } from '@/setup-types/single-app-runtime-tenants';

export const activeSetup = defineSingleAppRuntimeTenantsSetup(${formatTsValue(singleAppRuntimeTenantsStarterData.setup)});
`;
}

function renderSingleAppRuntimeTenantsRuntimeData(): string {
  return `import { type RuntimeTenant } from '@/setup-types/single-app-runtime-tenants';

export const runtimeTenants = ${formatTsValue(singleAppRuntimeTenantsStarterData.runtimeTenants)} satisfies readonly RuntimeTenant[];
`;
}

function renderWhiteLabelAppsManifest(): string {
  return `import { defineWhiteLabelAppsSetup } from '@/setup-types/white-label-apps';

export const activeSetup = defineWhiteLabelAppsSetup(${formatTsValue(whiteLabelAppsStarterSetup)});
`;
}

function renderGenericWithStandaloneAppVariantsManifest(): string {
  return `import { defineGenericAppSetup } from '@/setup-types/generic-app';

export const activeSetup = defineGenericAppSetup(${formatTsValue(genericAppStarterData.setup)});
`;
}

function renderGenericWithStandaloneAppVariantsRuntimeData(): string {
  return `import { type RuntimeTenant } from '@/setup-types/generic-app';

// Runtime Tenants are all known business contexts for this Active Setup.
// App Variant access decides which Runtime Tenants each installed app can open.
export const runtimeTenants = ${formatTsValue(genericAppStarterData.runtimeTenants)} satisfies readonly RuntimeTenant[];
`;
}

export function planSetup(setupType: string): SetupFilePlan {
  if (setupType === 'white-label-apps') {
    return createWhiteLabelAppsPlan();
  }

  if (setupType === 'single-app-runtime-tenants') {
    return createSingleAppRuntimeTenantsPlan();
  }

  if (setupType === 'generic-with-standalone-app-variants') {
    return createGenericWithStandaloneAppVariantsPlan();
  }

  throw new Error(
    `Unsupported Setup Type ${JSON.stringify(setupType)}. Expected one of: ${getImplementedSetupTypes().join(', ')}`,
  );
}

function targetExists(projectRoot: string, operation: SetupFileOperation): boolean {
  return existsSync(join(projectRoot, operation.path));
}

function writeContentsMatch(
  projectRoot: string,
  operation: Extract<SetupFileOperation, { kind: 'write' }>,
) {
  const targetPath = join(projectRoot, operation.path);

  return existsSync(targetPath) && readFileSync(targetPath, 'utf8') === operation.contents;
}

export function findBlockedSetupTargets({
  plan,
  projectRoot,
  force = false,
}: {
  plan: SetupFilePlan;
  projectRoot: string;
  force?: boolean;
}): string[] {
  if (force) {
    return [];
  }

  return plan.operations
    .filter((operation) => {
      if (!targetExists(projectRoot, operation)) {
        return false;
      }

      return operation.kind !== 'write' || !writeContentsMatch(projectRoot, operation);
    })
    .map((operation) => operation.path);
}

function applyOperation(projectRoot: string, operation: SetupFileOperation) {
  const targetPath = join(projectRoot, operation.path);

  if (operation.kind === 'delete') {
    rmSync(targetPath, { recursive: true, force: true });
    return;
  }

  mkdirSync(dirname(targetPath), { recursive: true });

  if (operation.kind === 'write') {
    writeFileSync(targetPath, operation.contents);
    return;
  }

  cpSync(join(projectRoot, operation.from), targetPath, { recursive: true });
}

export function applySetupPlan({
  plan,
  projectRoot,
  force = false,
  dryRun = false,
}: {
  plan: SetupFilePlan;
  projectRoot: string;
  force?: boolean;
  dryRun?: boolean;
}): ApplySetupPlanResult {
  const blockedTargets = findBlockedSetupTargets({ plan, projectRoot, force });

  if (blockedTargets.length > 0) {
    return {
      applied: false,
      blockedTargets,
      operations: plan.operations,
    };
  }

  if (!dryRun) {
    for (const operation of plan.operations) {
      applyOperation(projectRoot, operation);
    }
  }

  return {
    applied: !dryRun,
    blockedTargets: [],
    operations: plan.operations,
  };
}

export function formatSetupFilePlan(plan: SetupFilePlan): string[] {
  return plan.operations.map((operation) => {
    if (operation.kind === 'copy') {
      return `copy ${operation.from} -> ${operation.path}`;
    }

    return `${operation.kind} ${operation.path}`;
  });
}
