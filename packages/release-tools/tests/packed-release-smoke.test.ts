import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, vi } from 'vitest';

import { verifyPackedReleaseSet } from '../src/packed-release-smoke';

test('installs one packed dependency chain, proves CLI identity, and reuses representative create flows', async () => {
  const commands: string[] = [];
  const runCommand = vi.fn(async ({ command, args, cwd }) => {
    commands.push(`${command} ${args.join(' ')}`);

    if (args.includes('tenkit') && args.includes('--version')) {
      return { stdout: '0.3.0\n', stderr: '' };
    }

    if (args.includes('create-tenkit')) {
      const name = args[args.indexOf('--name') + 1]!;
      const targetRoot = join(cwd, name);
      const setup = args[args.indexOf('--setup') + 1];
      const styling = args.includes('--styling') ? args[args.indexOf('--styling') + 1] : 'bare';
      const files =
        setup === 'runtime-tenants'
          ? ['src/constants/runtime-tenants.ts', 'src/theme/ThemeContext.tsx']
          : styling === 'uniwind'
            ? [
                'metro.config.js',
                'src/constants/runtime-tenants.ts',
                'src/global.css',
                'src/uniwind-env.d.ts',
              ]
            : ['babel.config.js', 'index.ts', 'src/constants/app-variants.ts', 'unistyles.ts'];
      const dependencies =
        styling === 'uniwind'
          ? { uniwind: '1.0.0' }
          : styling === 'unistyles'
            ? {
                'react-native-nitro-modules': '1.0.0',
                'react-native-unistyles': '1.0.0',
              }
            : {};

      for (const file of files) {
        await mkdir(join(targetRoot, file, '..'), { recursive: true });
        await writeFile(
          join(targetRoot, file),
          file === 'src/constants/app-variants.ts'
            ? 'Smoke North Smoke South #123ABC #F59E0B\n'
            : 'verified\n',
        );
      }

      await writeFile(
        join(targetRoot, 'package.json'),
        `${JSON.stringify({ dependencies }, null, 2)}\n`,
      );
    }

    return { stdout: '', stderr: '' };
  });

  await verifyPackedReleaseSet({
    artifactPaths: [
      '/artifacts/tenkit-template-generator-0.3.0.tgz',
      '/artifacts/tenkit-cli-0.3.0.tgz',
      '/artifacts/create-tenkit-0.3.0.tgz',
    ],
    expectedVersion: '0.3.0',
    runCommand,
  });

  expect(commands[0]).toBe('pnpm install --ignore-scripts');
  expect(commands[1]).toBe('pnpm exec tenkit --version');
  expect(commands.filter((command) => command.includes('exec create-tenkit'))).toHaveLength(3);
  expect(commands).toContain(
    'pnpm exec create-tenkit --name smoke-runtime-tenants-bare --setup runtime-tenants --yes --no-install --no-git',
  );
  expect(commands).toContain(
    'pnpm exec create-tenkit --name smoke-generic-standalone-uniwind --setup generic-standalone --styling uniwind --yes --no-install --no-git',
  );
  expect(commands).toContain(
    'pnpm exec create-tenkit --name smoke-white-label-unistyles --setup white-label --styling unistyles --variant-names Smoke North,Smoke South --variant-accents #123ABC,#F59E0B --yes --no-install --no-git',
  );
});
