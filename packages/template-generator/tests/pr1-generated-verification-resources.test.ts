import { describe, expect, test } from 'vitest';

import { createPr1VerificationResourceResolver } from '../src/pr1-generated-verification-resources';
import { createPr1BaselineCells } from '../src/pr1-generated-verification-plan';

function baselineCell(backend: 'express' | 'nestjs', database: 'postgresql' | 'mysql') {
  const cell = createPr1BaselineCells().find(
    ({ selection }) =>
      selection.generatedAppOptions.backend === backend &&
      selection.generatedAppOptions.auth === 'better-auth' &&
      selection.generatedAppOptions.database === database &&
      selection.generatedAppOptions.orm === 'prisma',
  );
  if (cell === undefined) {
    throw new Error('Expected PR1 baseline cell is missing.');
  }
  return cell;
}

function healthyDocker() {
  let containerExists = false;
  const commands: string[][] = [];
  const run = async (args: readonly string[]): Promise<string> => {
    commands.push([...args]);
    if (args[0] === 'run') {
      containerExists = true;
      return 'container-id';
    }
    if (args[0] === 'rm') {
      containerExists = false;
      return '';
    }
    if (args[0] === 'inspect' && args[1] === '--format') {
      return 'healthy';
    }
    if (args[0] === 'inspect' && containerExists) {
      return '{}';
    }
    throw new Error('Container is absent.');
  };
  return { commands, run };
}

describe('PR1 verification resources', () => {
  test.each([
    ['disposable-postgresql', 'postgres:17-alpine', 'postgresql://'],
    ['disposable-mysql-8-4', 'mysql:8.4', 'mysql://'],
  ] as const)('acquires and proves cleanup for %s', async (resourceClass, image, urlPrefix) => {
    const docker = healthyDocker();
    const cell = baselineCell(
      'express',
      resourceClass === 'disposable-postgresql' ? 'postgresql' : 'mysql',
    );
    const resource = createPr1VerificationResourceResolver(docker.run)(cell, resourceClass);

    const acquired = await resource.acquire();

    expect(acquired.environment.DATABASE_URL).toMatch(new RegExp(`^${urlPrefix}`));
    expect(docker.commands.find(([command]) => command === 'run')).toContain(image);
    await expect(acquired.cleanup()).resolves.toEqual({ leaked: false });
  });

  test('reports a leak when Docker cannot prove container removal', async () => {
    const docker = healthyDocker();
    const cell = baselineCell('nestjs', 'postgresql');
    const baseRun = docker.run;
    const resource = createPr1VerificationResourceResolver(async (args) => {
      if (args[0] === 'rm') {
        throw new Error('Docker removal failed.');
      }
      return baseRun(args);
    })(cell, 'disposable-postgresql');
    const acquired = await resource.acquire();

    await expect(acquired.cleanup()).resolves.toEqual({ leaked: true });
  });
});
