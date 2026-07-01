/// <reference types="node" />

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { assert, expect, test } from 'vitest';

import {
  applySetupPlan,
  findBlockedSetupTargets,
  formatSetupFilePlan,
  getImplementedSetupTypes,
  planSetup,
} from '../scripts/tenkit-setup-core';
import { runSetup } from '../scripts/tenkit-setup-runtime';

function createProjectRoot() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'tenkit-setup-'));
  const files = [
    'assets/acme-app/icons/icon.png',
    'assets/acme-app/icons/android-icon-foreground.png',
    'assets/acme-app/icons/android-icon-background.png',
    'assets/acme-app/icons/android-icon-monochrome.png',
    'assets/acme-app/icons/splash-icon.png',
    'assets/acme-app/app.icon/icon.json',
    'assets/acme-app/app.icon/Assets/base.svg',
  ];

  for (const file of files) {
    const filePath = join(projectRoot, file);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, file);
  }

  return projectRoot;
}

test('setup lists installable Setup Types', () => {
  assert.deepEqual(getImplementedSetupTypes(), [
    'white-label-apps',
    'single-app-runtime-tenants',
    'generic-with-standalone-app-variants',
  ]);
});

test('setup dry-run prints the Single App Runtime Tenants file plan without writing', async () => {
  const projectRoot = createProjectRoot();
  const events: string[] = [];

  try {
    const result = await runSetup(
      { setupType: 'single-app-runtime-tenants', yes: true, dryRun: true },
      {
        ci: true,
        projectRoot,
        promptSelect: async () => {
          throw new Error('non-interactive setup should not prompt');
        },
        promptConfirm: async () => {
          throw new Error('dry-run with --yes should not confirm');
        },
        log: (message) => events.push(message),
        formatFiles: () => events.push('format'),
      },
    );

    assert.equal(result.applied, false);
    assert.equal(existsSync(join(projectRoot, 'src/active-setup/manifest.ts')), false);
    assert.equal(events[0], 'Setup Type: single-app-runtime-tenants');
    assert.equal(events[1], 'Active Setup changes:');
    assert.ok(events.includes('- write src/active-setup/manifest.ts'));
    assert.equal(events.includes('format'), false);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('setup prompt offers all installable Setup Types', async () => {
  const projectRoot = createProjectRoot();
  let choices: { name: string; value: string }[] = [];

  try {
    await runSetup(
      { yes: true, dryRun: true },
      {
        ci: false,
        activeSetupType: 'white-label-apps',
        projectRoot,
        promptSelect: async (input) => {
          choices = input.choices;
          return 'white-label-apps';
        },
        promptConfirm: async () => {
          throw new Error('dry-run with --yes should not confirm');
        },
        log: () => {},
        formatFiles: () => {},
      },
    );

    assert.deepEqual(choices, [
      { name: 'white-label-apps (current)', value: 'white-label-apps' },
      { name: 'single-app-runtime-tenants', value: 'single-app-runtime-tenants' },
      {
        name: 'generic-with-standalone-app-variants',
        value: 'generic-with-standalone-app-variants',
      },
    ]);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('setup dry-run prints the Generic With Standalone file plan without writing', async () => {
  const projectRoot = createProjectRoot();
  const events: string[] = [];

  try {
    const result = await runSetup(
      {
        setupType: 'generic-with-standalone-app-variants',
        yes: true,
        dryRun: true,
      },
      {
        ci: true,
        projectRoot,
        promptSelect: async () => {
          throw new Error('non-interactive setup should not prompt');
        },
        promptConfirm: async () => {
          throw new Error('dry-run with --yes should not confirm');
        },
        log: (message) => events.push(message),
        formatFiles: () => events.push('format'),
      },
    );

    assert.equal(result.applied, false);
    assert.equal(existsSync(join(projectRoot, 'src/active-setup/manifest.ts')), false);
    assert.equal(events[0], 'Setup Type: generic-with-standalone-app-variants');
    assert.equal(events[1], 'Active Setup changes:');
    assert.ok(events.includes('- write src/active-setup/manifest.ts'));
    assert.ok(events.includes('- write src/active-setup/runtime-tenants.ts'));
    assert.equal(events.includes('format'), false);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('non-interactive setup requires explicit setup type and confirmation', async () => {
  const projectRoot = createProjectRoot();

  try {
    await expect(
      runSetup(
        { setupType: 'single-app-runtime-tenants' },
        {
          ci: true,
          projectRoot,
          promptSelect: async () => 'single-app-runtime-tenants',
          promptConfirm: async () => true,
          log: () => {},
          formatFiles: () => {},
        },
      ),
    ).rejects.toThrow(/Non-interactive setup requires --setup-type and --yes/);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('interactive setup confirmation replaces existing setup-owned targets', async () => {
  const projectRoot = createProjectRoot();
  const events: string[] = [];
  let confirmationDefault: boolean | undefined;

  try {
    mkdirSync(join(projectRoot, 'src/active-setup'), { recursive: true });
    writeFileSync(join(projectRoot, 'src/active-setup/manifest.ts'), 'existing setup');

    const result = await runSetup(
      { setupType: 'single-app-runtime-tenants' },
      {
        ci: false,
        projectRoot,
        promptSelect: async () => {
          throw new Error('explicit setup type should not prompt for setup selection');
        },
        promptConfirm: async (input) => {
          confirmationDefault = input.defaultValue;
          return true;
        },
        log: (message) => events.push(message),
        formatFiles: () => events.push('format'),
      },
    );

    assert.equal(result.applied, true);
    assert.equal(confirmationDefault, true);
    assert.match(
      readFileSync(join(projectRoot, 'src/active-setup/manifest.ts'), 'utf8'),
      /setupType: 'single-app-runtime-tenants'/,
    );
    assert.match(
      readFileSync(join(projectRoot, 'src/active-setup/runtime-tenants.ts'), 'utf8'),
      /runtimeTenantId: 100/,
    );
    assert.ok(events.includes('Setup applied.'));
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('local --yes does not replace existing setup-owned targets without force', async () => {
  const projectRoot = createProjectRoot();

  try {
    mkdirSync(join(projectRoot, 'src/active-setup'), { recursive: true });
    writeFileSync(join(projectRoot, 'src/active-setup/manifest.ts'), 'existing setup');

    await expect(
      runSetup(
        { setupType: 'single-app-runtime-tenants', yes: true },
        {
          ci: false,
          projectRoot,
          promptSelect: async () => {
            throw new Error('explicit setup type should not prompt for setup selection');
          },
          promptConfirm: async () => {
            throw new Error('--yes should not prompt for confirmation');
          },
          log: () => {},
          formatFiles: () => {},
        },
      ),
    ).rejects.toThrow(/Re-run interactively or use --force/);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('setup file plan checks only target paths and refuses dirty targets without force', () => {
  const projectRoot = createProjectRoot();
  const plan = planSetup('single-app-runtime-tenants');

  try {
    mkdirSync(join(projectRoot, 'src/active-setup'), { recursive: true });
    writeFileSync(join(projectRoot, 'src/active-setup/manifest.ts'), 'locally changed');
    writeFileSync(join(projectRoot, 'unrelated.txt'), 'leave me alone');

    assert.deepEqual(findBlockedSetupTargets({ plan, projectRoot }), [
      'src/active-setup/manifest.ts',
    ]);

    const result = applySetupPlan({ plan, projectRoot });

    assert.equal(result.applied, false);
    assert.deepEqual(result.blockedTargets, ['src/active-setup/manifest.ts']);
    assert.equal(readFileSync(join(projectRoot, 'unrelated.txt'), 'utf8'), 'leave me alone');
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('White Label Apps setup writes the Active Setup Manifest and removes Single App runtime data', () => {
  const projectRoot = createProjectRoot();
  const plan = planSetup('white-label-apps');

  try {
    mkdirSync(join(projectRoot, 'src/active-setup'), { recursive: true });
    writeFileSync(join(projectRoot, 'src/active-setup/manifest.ts'), 'single app manifest');
    writeFileSync(join(projectRoot, 'src/active-setup/runtime-tenants.ts'), 'runtime data');

    assert.deepEqual(findBlockedSetupTargets({ plan, projectRoot }), [
      'src/active-setup/manifest.ts',
      'src/active-setup/runtime-tenants.ts',
    ]);

    const result = applySetupPlan({ plan, projectRoot, force: true });

    assert.equal(result.applied, true);
    assert.match(
      readFileSync(join(projectRoot, 'src/active-setup/manifest.ts'), 'utf8'),
      /setupType: 'white-label-apps'/,
    );
    assert.equal(existsSync(join(projectRoot, 'src/active-setup/runtime-tenants.ts')), false);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('forced setup applies the scaffold output and uses starter-provided assets', () => {
  const projectRoot = createProjectRoot();
  const plan = planSetup('single-app-runtime-tenants');

  try {
    mkdirSync(join(projectRoot, 'src/active-setup'), { recursive: true });
    writeFileSync(join(projectRoot, 'src/active-setup/manifest.ts'), 'locally changed');

    const result = applySetupPlan({ plan, projectRoot, force: true });

    assert.equal(result.applied, true);
    assert.match(
      readFileSync(join(projectRoot, 'src/active-setup/manifest.ts'), 'utf8'),
      /setupType: 'single-app-runtime-tenants'/,
    );
    assert.match(
      readFileSync(join(projectRoot, 'src/active-setup/runtime-tenants.ts'), 'utf8'),
      /runtimeTenantId: 100/,
    );
    assert.equal(existsSync(join(projectRoot, 'assets/acme-app/icons/icon.png')), true);
    assert.equal(existsSync(join(projectRoot, 'assets/acme-app/app.icon/icon.json')), true);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('Generic With Standalone setup writes manifest and Runtime Tenant data without assets', () => {
  const projectRoot = createProjectRoot();
  const plan = planSetup('generic-with-standalone-app-variants');

  try {
    mkdirSync(join(projectRoot, 'src/active-setup'), { recursive: true });
    writeFileSync(join(projectRoot, 'src/active-setup/manifest.ts'), 'locally changed');
    writeFileSync(join(projectRoot, 'src/active-setup/runtime-tenants.ts'), 'locally changed');

    assert.deepEqual(findBlockedSetupTargets({ plan, projectRoot }), [
      'src/active-setup/manifest.ts',
      'src/active-setup/runtime-tenants.ts',
    ]);

    const result = applySetupPlan({ plan, projectRoot, force: true });

    assert.equal(result.applied, true);

    const manifest = readFileSync(join(projectRoot, 'src/active-setup/manifest.ts'), 'utf8');
    const runtimeData = readFileSync(
      join(projectRoot, 'src/active-setup/runtime-tenants.ts'),
      'utf8',
    );

    assert.match(manifest, /setupType: 'generic-with-standalone-app-variants'/);
    assert.match(manifest, /slug: 'atlas-network'/);
    assert.match(manifest, /slug: 'west-studio'/);
    assert.match(manifest, /role: 'generic'/);
    assert.match(manifest, /role: 'standalone'/);
    assert.match(runtimeData, /North Studio/);
    assert.match(runtimeData, /South Studio/);
    assert.match(runtimeData, /East Studio/);
    assert.match(runtimeData, /West Studio/);
    assert.equal(existsSync(join(projectRoot, 'assets/atlas-network/icons/icon.png')), false);
    assert.equal(existsSync(join(projectRoot, 'assets/west-studio/icons/icon.png')), false);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('setup file plan describes setup-owned writes', () => {
  const plan = planSetup('single-app-runtime-tenants');

  assert.deepEqual(formatSetupFilePlan(plan), [
    'write src/active-setup/manifest.ts',
    'write src/active-setup/runtime-tenants.ts',
  ]);
});

test('Generic With Standalone setup file plan describes setup-owned writes', () => {
  const plan = planSetup('generic-with-standalone-app-variants');

  assert.deepEqual(formatSetupFilePlan(plan), [
    'write src/active-setup/manifest.ts',
    'write src/active-setup/runtime-tenants.ts',
  ]);
});

test('White Label Apps setup file plan describes manifest write and runtime data cleanup', () => {
  const plan = planSetup('white-label-apps');

  assert.deepEqual(formatSetupFilePlan(plan), [
    'write src/active-setup/manifest.ts',
    'delete src/active-setup/runtime-tenants.ts',
  ]);
});
