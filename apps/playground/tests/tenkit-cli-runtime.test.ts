/// <reference types="node" />

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { type CommandPlan } from '../scripts/tenkit-cli-core';
import { runBuild, runReset } from '../scripts/tenkit-cli-runtime';
import { activeSetup } from '../src/active-setup/manifest';
import { type ActiveSetup } from '../src/setup-types/core';
import { defineSingleAppRuntimeTenantsSetup } from '../src/setup-types/single-app-runtime-tenants';
import { genericAppStarterData } from '../starter-data/generic-with-standalone-app-variants';

function withProjectIds(setup: ActiveSetup = activeSetup): ActiveSetup {
  if (setup.setupType === 'single-app-runtime-tenants') {
    return {
      ...setup,
      appVariant: {
        ...setup.appVariant,
        eas: {
          projectId: '11111111-1111-1111-1111-111111111111',
        },
      },
    };
  }

  if (setup.setupType === 'generic-with-standalone-app-variants') {
    return {
      ...setup,
      appVariants: setup.appVariants.map((appVariant, index) => ({
        ...appVariant,
        eas: {
          projectId: `${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}-1111-1111-1111-111111111111`,
        },
      })),
    };
  }

  return {
    ...setup,
    appVariants: setup.appVariants.map((appVariant, index) => ({
      ...appVariant,
      eas: {
        projectId: `${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}-1111-1111-1111-111111111111`,
      },
    })),
  };
}

function withoutFirstProjectId(): ActiveSetup {
  if (activeSetup.setupType !== 'white-label-apps') {
    throw new Error('test fixture expects the default Active Setup to be White Label Apps');
  }

  return {
    ...activeSetup,
    appVariants: activeSetup.appVariants.map((appVariant) => ({
      ...appVariant,
      eas: {
        projectId: appVariant.slug === 'first-tenant' ? '' : '22222222-2222-2222-2222-222222222222',
      },
    })),
  };
}

const singleAppRuntimeTenantsSetup = defineSingleAppRuntimeTenantsSetup({
  setupType: 'single-app-runtime-tenants',
  appVariant: {
    appVariantId: 1,
    slug: 'acme-app',
    name: 'Acme App',
    version: '1.0.0',
    scheme: 'acmeapp',
    bundleIdentifier: 'com.example.acmeapp',
    packageName: 'com.example.acmeapp',
    theme: {
      accent: '#2563eb',
    },
    eas: {
      projectId: '33333333-3333-3333-3333-333333333333',
    },
    runtimeTenantAccess: {
      selectionMode: 'selectable',
      defaultRuntimeTenantId: 100,
      allowedRuntimeTenantIds: [100, 101, 102],
    },
  },
});

const genericWithStandaloneSetup = withProjectIds(genericAppStarterData.setup);

function recordCommandAndWritePulledEnv(
  events: string[],
  command: CommandPlan,
  projectRoot: string,
) {
  events.push(
    `${command.bin} ${command.args.join(' ')} ${command.env?.APP_VARIANT_SLUG ?? ''}`.trim(),
  );

  if (command.bin === 'eas') {
    writeFileSync(
      join(projectRoot, '.env.local'),
      `APP_VARIANT_SLUG=${command.env?.APP_VARIANT_SLUG}\n`,
    );
  }
}

test('build preparation with missing App Variant EAS Project ID fails before auth or commands', async () => {
  const events: string[] = [];

  await assert.rejects(
    () =>
      runBuild(
        { slug: 'first-tenant', env: 'development', platform: 'ios' },
        {
          ci: false,
          expoToken: undefined,
          activeSetup: withoutFirstProjectId(),
          isEasInstalled: () => {
            events.push('checked EAS install');
            return true;
          },
          isEasLoggedIn: () => {
            events.push('checked EAS login');
            return true;
          },
          promptSelect: async () => {
            throw new Error('complete flags should not prompt');
          },
          runCommand: (command) => {
            events.push(command.bin);
          },
          log: (message) => events.push(message),
        },
      ),
    /App Variant "First Tenant" \(1\) is missing an EAS Project ID/,
  );

  assert.deepEqual(events, []);
});

test('build preparation with missing global Expo Owner fails before auth or commands', async () => {
  const events: string[] = [];

  await assert.rejects(
    () =>
      runBuild(
        { slug: 'first-tenant', env: 'development', platform: 'ios' },
        {
          ci: false,
          expoToken: undefined,
          expoOwner: '',
          activeSetup: withProjectIds(),
          isEasInstalled: () => {
            events.push('checked EAS install');
            return true;
          },
          isEasLoggedIn: () => {
            events.push('checked EAS login');
            return true;
          },
          promptSelect: async () => {
            throw new Error('complete flags should not prompt');
          },
          runCommand: (command) => {
            events.push(command.bin);
          },
          log: (message) => events.push(message),
        },
      ),
    /Missing Expo Owner/,
  );

  assert.deepEqual(events, []);
});

test('local build preparation logs in before EAS env pull and prebuild', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'app-variant-env-success-'));
  const events: string[] = [];

  try {
    await runBuild(
      { slug: 'first-tenant', env: 'development', platform: 'ios' },
      {
        ci: false,
        expoToken: undefined,
        activeSetup: withProjectIds(),
        projectRoot,
        isEasInstalled: () => true,
        isEasLoggedIn: () => false,
        promptSelect: async () => {
          throw new Error('complete flags should not prompt');
        },
        runCommand: (command) => {
          recordCommandAndWritePulledEnv(events, command, projectRoot);
        },
        log: (message) => events.push(message),
      },
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }

  assert.deepEqual(events, [
    'Preparing build',
    'Setup Type: white-label-apps',
    'App Variant: First Tenant (first-tenant)',
    'Environment: development',
    'Platform: ios',
    'Before pulling env vars from EAS you need to log in.',
    'eas login',
    'Running: APP_VARIANT_SLUG=first-tenant eas env:pull --environment development --path .env.local --non-interactive',
    'eas env:pull --environment development --path .env.local --non-interactive first-tenant',
    'Running: APP_VARIANT_SLUG=first-tenant pnpm expo prebuild --clean --platform ios',
    'pnpm expo prebuild --clean --platform ios first-tenant',
  ]);
});

test('build preparation fails before prebuild when EAS env pull does not create .env.local', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'app-variant-env-missing-'));
  const events: string[] = [];

  try {
    await assert.rejects(
      () =>
        runBuild(
          { slug: 'first-tenant', env: 'development', platform: 'ios' },
          {
            ci: false,
            expoToken: undefined,
            activeSetup: withProjectIds(),
            projectRoot,
            isEasInstalled: () => true,
            isEasLoggedIn: () => true,
            promptSelect: async () => {
              throw new Error('complete flags should not prompt');
            },
            runCommand: (command) => {
              events.push(command.bin);
            },
            log: (message) => events.push(message),
          },
        ),
      /\.env\.local was not created after eas env:pull/,
    );

    assert.deepEqual(events, [
      'Preparing build',
      'Setup Type: white-label-apps',
      'App Variant: First Tenant (first-tenant)',
      'Environment: development',
      'Platform: ios',
      'Running: APP_VARIANT_SLUG=first-tenant eas env:pull --environment development --path .env.local --non-interactive',
      'eas',
    ]);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('build preparation fails before prebuild when pulled .env.local omits APP_VARIANT_SLUG', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'app-variant-env-missing-key-'));
  const events: string[] = [];

  try {
    await assert.rejects(
      () =>
        runBuild(
          { slug: 'first-tenant', env: 'development', platform: 'ios' },
          {
            ci: false,
            expoToken: undefined,
            activeSetup: withProjectIds(),
            projectRoot,
            isEasInstalled: () => true,
            isEasLoggedIn: () => true,
            promptSelect: async () => {
              throw new Error('complete flags should not prompt');
            },
            runCommand: (command) => {
              events.push(command.bin);

              if (command.bin === 'eas') {
                writeFileSync(
                  join(projectRoot, '.env.local'),
                  'EXPO_PUBLIC_API_URL=https://example.com\n',
                );
              }
            },
            log: (message) => events.push(message),
          },
        ),
      /\.env\.local is missing APP_VARIANT_SLUG/,
    );

    assert.equal(events.includes('pnpm'), false);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('build preparation fails before prebuild when pulled APP_VARIANT_SLUG does not match selected Slug', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'app-variant-env-mismatch-'));
  const events: string[] = [];

  try {
    await assert.rejects(
      () =>
        runBuild(
          { slug: 'first-tenant', env: 'development', platform: 'ios' },
          {
            ci: false,
            expoToken: undefined,
            activeSetup: withProjectIds(),
            projectRoot,
            isEasInstalled: () => true,
            isEasLoggedIn: () => true,
            promptSelect: async () => {
              throw new Error('complete flags should not prompt');
            },
            runCommand: (command) => {
              events.push(command.bin);

              if (command.bin === 'eas') {
                writeFileSync(join(projectRoot, '.env.local'), 'APP_VARIANT_SLUG=second-tenant\n');
              }
            },
            log: (message) => events.push(message),
          },
        ),
      /\.env\.local APP_VARIANT_SLUG "second-tenant" does not match selected Slug "first-tenant"/,
    );

    assert.equal(events.includes('pnpm'), false);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('build reset prepares default App Variant development environment for both platforms without prompts', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'app-variant-env-reset-'));
  const events: string[] = [];

  try {
    await runReset({
      ci: false,
      expoToken: undefined,
      activeSetup: withProjectIds(),
      projectRoot,
      isEasInstalled: () => true,
      isEasLoggedIn: () => true,
      promptSelect: async () => {
        throw new Error('reset should not prompt');
      },
      runCommand: (command) => {
        recordCommandAndWritePulledEnv(events, command, projectRoot);
      },
      log: (message) => events.push(message),
    });
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }

  assert.deepEqual(events, [
    'Resetting build',
    'Setup Type: white-label-apps',
    'App Variant: First Tenant (first-tenant)',
    'Environment: development',
    'Platform: both',
    'Running: APP_VARIANT_SLUG=first-tenant eas env:pull --environment development --path .env.local --non-interactive',
    'eas env:pull --environment development --path .env.local --non-interactive first-tenant',
    'Running: APP_VARIANT_SLUG=first-tenant pnpm expo prebuild --clean',
    'pnpm expo prebuild --clean first-tenant',
  ]);
});

test('local White Label Apps build prompts for missing App Variant, platform, and App Variant Environment', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'app-variant-env-prompt-'));
  const prompts: string[] = [];
  const events: string[] = [];

  try {
    await runBuild(
      {},
      {
        ci: false,
        expoToken: undefined,
        activeSetup: withProjectIds(),
        projectRoot,
        isEasInstalled: () => true,
        isEasLoggedIn: () => true,
        promptSelect: async ({ message }) => {
          prompts.push(message);

          if (message === 'Select an App Variant:') {
            return 'second-tenant';
          }

          if (message === 'Select a platform:') {
            return 'android';
          }

          return 'preview';
        },
        runCommand: (command) => {
          recordCommandAndWritePulledEnv(events, command, projectRoot);
        },
        log: (message) => events.push(message),
      },
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }

  assert.deepEqual(prompts, [
    'Select an App Variant:',
    'Select a platform:',
    'Select an App Variant Environment:',
  ]);
  assert.deepEqual(events.slice(0, 5), [
    'Preparing build',
    'Setup Type: white-label-apps',
    'App Variant: Second Tenant (second-tenant)',
    'Environment: preview',
    'Platform: android',
  ]);
  assert.equal(events.at(-1), 'pnpm expo prebuild --clean --platform android second-tenant');
});

test('Single App Runtime Tenants build skips App Variant and Runtime Tenant prompts', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'single-app-runtime-tenants-prompt-'));
  const prompts: string[] = [];
  const events: string[] = [];

  try {
    await runBuild(
      {},
      {
        ci: false,
        expoToken: undefined,
        activeSetup: singleAppRuntimeTenantsSetup,
        projectRoot,
        isEasInstalled: () => true,
        isEasLoggedIn: () => true,
        promptSelect: async ({ message }) => {
          prompts.push(message);

          if (message === 'Select a platform:') {
            return 'ios';
          }

          return 'development';
        },
        runCommand: (command) => {
          recordCommandAndWritePulledEnv(events, command, projectRoot);
        },
        log: (message) => events.push(message),
      },
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }

  assert.deepEqual(prompts, ['Select a platform:', 'Select an App Variant Environment:']);
  assert.equal(events[1], 'Setup Type: single-app-runtime-tenants');
  assert.equal(events[2], 'App Variant: Acme App (acme-app)');
});

test('Generic With Standalone build prompts by App Variant name and resolves the selected Slug', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'generic-with-standalone-prompt-'));
  const prompts: string[] = [];
  let appVariantChoices: { name: string; value: string }[] = [];
  const events: string[] = [];

  try {
    await runBuild(
      {},
      {
        ci: false,
        expoToken: undefined,
        activeSetup: genericWithStandaloneSetup,
        projectRoot,
        isEasInstalled: () => true,
        isEasLoggedIn: () => true,
        promptSelect: async ({ message, choices }) => {
          prompts.push(message);

          if (message === 'Select an App Variant:') {
            appVariantChoices = choices;
            return 'west-studio';
          }

          if (message === 'Select a platform:') {
            return 'android';
          }

          return 'preview';
        },
        runCommand: (command) => {
          recordCommandAndWritePulledEnv(events, command, projectRoot);
        },
        log: (message) => events.push(message),
      },
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }

  assert.deepEqual(prompts, [
    'Select an App Variant:',
    'Select a platform:',
    'Select an App Variant Environment:',
  ]);
  assert.deepEqual(appVariantChoices, [
    { name: 'Atlas Network (atlas-network)', value: 'atlas-network' },
    { name: 'West Studio (west-studio)', value: 'west-studio' },
  ]);
  assert.equal(events[1], 'Setup Type: generic-with-standalone-app-variants');
  assert.equal(events[2], 'App Variant: West Studio (west-studio)');
  assert.equal(events.at(-1), 'pnpm expo prebuild --clean --platform android west-studio');
  assert.equal(prompts.includes('Select a Runtime Tenant:'), false);
});

test('Generic With Standalone reset prepares Atlas Network development environment for both platforms', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'generic-with-standalone-reset-'));
  const events: string[] = [];

  try {
    await runReset({
      ci: false,
      expoToken: undefined,
      activeSetup: genericWithStandaloneSetup,
      projectRoot,
      isEasInstalled: () => true,
      isEasLoggedIn: () => true,
      promptSelect: async () => {
        throw new Error('reset should not prompt');
      },
      runCommand: (command) => {
        recordCommandAndWritePulledEnv(events, command, projectRoot);
      },
      log: (message) => events.push(message),
    });
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }

  assert.deepEqual(events.slice(0, 5), [
    'Resetting build',
    'Setup Type: generic-with-standalone-app-variants',
    'App Variant: Atlas Network (atlas-network)',
    'Environment: development',
    'Platform: both',
  ]);
  assert.equal(events.at(-1), 'pnpm expo prebuild --clean atlas-network');
});
