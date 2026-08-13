import { assert, test } from 'vitest';

import {
  DEFAULT_GENERATED_APP_OPTIONS,
  getGeneratedAppOptionChoiceState,
  isGeneratedNodeBackend,
  resolveGeneratedAppOptions,
  SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS,
  SUPPORTED_GENERATED_AUTH_VALUES,
  SUPPORTED_GENERATED_BACKEND_VALUES,
  SUPPORTED_GENERATED_DATABASE_VALUES,
  SUPPORTED_GENERATED_ORM_VALUES,
} from '@tenkit/types/generated-app-option-definitions';

test('exposes every public Generated App Option value and the zero-service defaults', () => {
  assert.deepEqual(SUPPORTED_GENERATED_BACKEND_VALUES, ['none', 'express', 'nestjs', 'convex']);
  assert.deepEqual(SUPPORTED_GENERATED_AUTH_VALUES, ['none', 'better-auth', 'clerk']);
  assert.deepEqual(SUPPORTED_GENERATED_DATABASE_VALUES, ['none', 'postgresql', 'mysql']);
  assert.deepEqual(SUPPORTED_GENERATED_ORM_VALUES, ['none', 'prisma', 'drizzle']);
  assert.deepEqual(DEFAULT_GENERATED_APP_OPTIONS, {
    backend: 'none',
    auth: 'none',
    database: 'none',
    orm: 'none',
  });
});

test('identifies only the generated Node Backends', () => {
  assert.equal(isGeneratedNodeBackend('none'), false);
  assert.equal(isGeneratedNodeBackend('express'), true);
  assert.equal(isGeneratedNodeBackend('nestjs'), true);
  assert.equal(isGeneratedNodeBackend('convex'), false);
});

test('owns one supported-combinations list containing the released service slices', () => {
  assert.deepEqual(SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS, [
    {
      backend: 'none',
      auth: 'none',
      database: 'none',
      orm: 'none',
    },
    {
      backend: 'express',
      auth: 'none',
      database: 'none',
      orm: 'none',
    },
    {
      backend: 'nestjs',
      auth: 'none',
      database: 'none',
      orm: 'none',
    },
    {
      backend: 'convex',
      auth: 'none',
      database: 'none',
      orm: 'none',
    },
    {
      backend: 'express',
      auth: 'clerk',
      database: 'none',
      orm: 'none',
    },
    {
      backend: 'nestjs',
      auth: 'clerk',
      database: 'none',
      orm: 'none',
    },
    {
      backend: 'express',
      auth: 'none',
      database: 'postgresql',
      orm: 'prisma',
    },
    {
      backend: 'express',
      auth: 'better-auth',
      database: 'postgresql',
      orm: 'prisma',
    },
    {
      backend: 'express',
      auth: 'clerk',
      database: 'postgresql',
      orm: 'prisma',
    },
    {
      backend: 'nestjs',
      auth: 'none',
      database: 'postgresql',
      orm: 'prisma',
    },
    {
      backend: 'nestjs',
      auth: 'better-auth',
      database: 'postgresql',
      orm: 'prisma',
    },
    {
      backend: 'nestjs',
      auth: 'clerk',
      database: 'postgresql',
      orm: 'prisma',
    },
  ]);
});

test('resolves omitted and explicit zero-service selections to the same supported combination', () => {
  assert.deepEqual(resolveGeneratedAppOptions({}), {
    status: 'resolved',
    selection: DEFAULT_GENERATED_APP_OPTIONS,
  });
  assert.deepEqual(
    resolveGeneratedAppOptions({
      backend: 'none',
      auth: 'none',
      database: 'none',
      orm: 'none',
    }),
    {
      status: 'resolved',
      selection: DEFAULT_GENERATED_APP_OPTIONS,
    },
  );
});

test('does not expose mutable references to the canonical compatibility catalog', () => {
  const resolution = resolveGeneratedAppOptions({});
  assert.equal(resolution.status, 'resolved');
  if (resolution.status !== 'resolved') {
    return;
  }

  assert.equal(Reflect.set(resolution.selection, 'backend', 'express'), false);
  assert.deepEqual(resolveGeneratedAppOptions({}), {
    status: 'resolved',
    selection: DEFAULT_GENERATED_APP_OPTIONS,
  });
  assert.deepEqual(SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS, [
    DEFAULT_GENERATED_APP_OPTIONS,
    {
      backend: 'express',
      auth: 'none',
      database: 'none',
      orm: 'none',
    },
    {
      backend: 'nestjs',
      auth: 'none',
      database: 'none',
      orm: 'none',
    },
    {
      backend: 'convex',
      auth: 'none',
      database: 'none',
      orm: 'none',
    },
    {
      backend: 'express',
      auth: 'clerk',
      database: 'none',
      orm: 'none',
    },
    {
      backend: 'nestjs',
      auth: 'clerk',
      database: 'none',
      orm: 'none',
    },
    {
      backend: 'express',
      auth: 'none',
      database: 'postgresql',
      orm: 'prisma',
    },
    {
      backend: 'express',
      auth: 'better-auth',
      database: 'postgresql',
      orm: 'prisma',
    },
    {
      backend: 'express',
      auth: 'clerk',
      database: 'postgresql',
      orm: 'prisma',
    },
    {
      backend: 'nestjs',
      auth: 'none',
      database: 'postgresql',
      orm: 'prisma',
    },
    {
      backend: 'nestjs',
      auth: 'better-auth',
      database: 'postgresql',
      orm: 'prisma',
    },
    {
      backend: 'nestjs',
      auth: 'clerk',
      database: 'postgresql',
      orm: 'prisma',
    },
  ]);
});

test('returns structured invalid-value and unsupported-combination facts', () => {
  assert.deepEqual(resolveGeneratedAppOptions({ backend: 'hono' }), {
    status: 'invalid',
    issues: [
      {
        code: 'unsupported-value',
        option: 'backend',
        value: 'hono',
        supportedValues: SUPPORTED_GENERATED_BACKEND_VALUES,
      },
    ],
  });

  assert.deepEqual(resolveGeneratedAppOptions({ backend: 'express' }), {
    status: 'resolved',
    selection: {
      backend: 'express',
      auth: 'none',
      database: 'none',
      orm: 'none',
    },
  });
});

test('derives dependency-aware partial choices from the same supported list', () => {
  assert.deepEqual(getGeneratedAppOptionChoiceState({}), {
    status: 'available',
    backend: { status: 'selectable', values: ['none', 'express', 'nestjs', 'convex'] },
    auth: { status: 'selectable', values: ['none', 'clerk', 'better-auth'] },
    database: { status: 'selectable', values: ['none', 'postgresql'] },
    orm: { status: 'selectable', values: ['none', 'prisma'] },
  });

  assert.deepEqual(getGeneratedAppOptionChoiceState({ backend: 'none' }), {
    status: 'available',
    backend: { status: 'selected', values: ['none'], value: 'none' },
    auth: { status: 'resolved', values: ['none'], value: 'none' },
    database: { status: 'resolved', values: ['none'], value: 'none' },
    orm: { status: 'resolved', values: ['none'], value: 'none' },
  });

  assert.deepEqual(getGeneratedAppOptionChoiceState({ backend: 'express' }), {
    status: 'available',
    backend: { status: 'selected', values: ['express'], value: 'express' },
    auth: { status: 'selectable', values: ['none', 'clerk', 'better-auth'] },
    database: { status: 'selectable', values: ['none', 'postgresql'] },
    orm: { status: 'selectable', values: ['none', 'prisma'] },
  });

  assert.deepEqual(
    getGeneratedAppOptionChoiceState({
      backend: 'express',
      auth: 'none',
      database: 'postgresql',
    }),
    {
      status: 'available',
      backend: { status: 'selected', values: ['express'], value: 'express' },
      auth: { status: 'selected', values: ['none'], value: 'none' },
      database: { status: 'selected', values: ['postgresql'], value: 'postgresql' },
      orm: { status: 'resolved', values: ['prisma'], value: 'prisma' },
    },
  );

  assert.deepEqual(getGeneratedAppOptionChoiceState({ backend: 'express', auth: 'clerk' }), {
    status: 'available',
    backend: { status: 'selected', values: ['express'], value: 'express' },
    auth: { status: 'selected', values: ['clerk'], value: 'clerk' },
    database: { status: 'selectable', values: ['none', 'postgresql'] },
    orm: { status: 'selectable', values: ['none', 'prisma'] },
  });

  assert.deepEqual(
    getGeneratedAppOptionChoiceState({
      backend: 'express',
      auth: 'clerk',
      database: 'postgresql',
    }),
    {
      status: 'available',
      backend: { status: 'selected', values: ['express'], value: 'express' },
      auth: { status: 'selected', values: ['clerk'], value: 'clerk' },
      database: { status: 'selected', values: ['postgresql'], value: 'postgresql' },
      orm: { status: 'resolved', values: ['prisma'], value: 'prisma' },
    },
  );

  assert.deepEqual(getGeneratedAppOptionChoiceState({ backend: 'express', auth: 'better-auth' }), {
    status: 'available',
    backend: { status: 'selected', values: ['express'], value: 'express' },
    auth: { status: 'selected', values: ['better-auth'], value: 'better-auth' },
    database: { status: 'resolved', values: ['postgresql'], value: 'postgresql' },
    orm: { status: 'resolved', values: ['prisma'], value: 'prisma' },
  });

  assert.deepEqual(getGeneratedAppOptionChoiceState({ backend: 'nestjs' }), {
    status: 'available',
    backend: { status: 'selected', values: ['nestjs'], value: 'nestjs' },
    auth: { status: 'selectable', values: ['none', 'clerk', 'better-auth'] },
    database: { status: 'selectable', values: ['none', 'postgresql'] },
    orm: { status: 'selectable', values: ['none', 'prisma'] },
  });

  assert.deepEqual(getGeneratedAppOptionChoiceState({ backend: 'nestjs', auth: 'better-auth' }), {
    status: 'available',
    backend: { status: 'selected', values: ['nestjs'], value: 'nestjs' },
    auth: { status: 'selected', values: ['better-auth'], value: 'better-auth' },
    database: { status: 'resolved', values: ['postgresql'], value: 'postgresql' },
    orm: { status: 'resolved', values: ['prisma'], value: 'prisma' },
  });

  assert.deepEqual(
    getGeneratedAppOptionChoiceState({
      backend: 'nestjs',
      auth: 'none',
      database: 'postgresql',
    }),
    {
      status: 'available',
      backend: { status: 'selected', values: ['nestjs'], value: 'nestjs' },
      auth: { status: 'selected', values: ['none'], value: 'none' },
      database: { status: 'selected', values: ['postgresql'], value: 'postgresql' },
      orm: { status: 'resolved', values: ['prisma'], value: 'prisma' },
    },
  );

  assert.deepEqual(getGeneratedAppOptionChoiceState({ backend: 'nestjs', auth: 'clerk' }), {
    status: 'available',
    backend: { status: 'selected', values: ['nestjs'], value: 'nestjs' },
    auth: { status: 'selected', values: ['clerk'], value: 'clerk' },
    database: { status: 'selectable', values: ['none', 'postgresql'] },
    orm: { status: 'selectable', values: ['none', 'prisma'] },
  });

  assert.deepEqual(
    getGeneratedAppOptionChoiceState({
      backend: 'nestjs',
      auth: 'clerk',
      database: 'postgresql',
    }),
    {
      status: 'available',
      backend: { status: 'selected', values: ['nestjs'], value: 'nestjs' },
      auth: { status: 'selected', values: ['clerk'], value: 'clerk' },
      database: { status: 'selected', values: ['postgresql'], value: 'postgresql' },
      orm: { status: 'resolved', values: ['prisma'], value: 'prisma' },
    },
  );

  assert.deepEqual(getGeneratedAppOptionChoiceState({ backend: 'convex' }), {
    status: 'available',
    backend: { status: 'selected', values: ['convex'], value: 'convex' },
    auth: { status: 'resolved', values: ['none'], value: 'none' },
    database: { status: 'resolved', values: ['none'], value: 'none' },
    orm: { status: 'resolved', values: ['none'], value: 'none' },
  });
});

test('accepts exactly the combinations present in the one supported list', () => {
  const accepted: string[] = [];

  for (const backend of SUPPORTED_GENERATED_BACKEND_VALUES) {
    for (const auth of SUPPORTED_GENERATED_AUTH_VALUES) {
      for (const database of SUPPORTED_GENERATED_DATABASE_VALUES) {
        for (const orm of SUPPORTED_GENERATED_ORM_VALUES) {
          const resolution = resolveGeneratedAppOptions({ backend, auth, database, orm });
          if (resolution.status === 'resolved') {
            accepted.push(`${backend}:${auth}:${database}:${orm}`);
          }
        }
      }
    }
  }

  assert.deepEqual(accepted, [
    'none:none:none:none',
    'express:none:none:none',
    'express:none:postgresql:prisma',
    'express:better-auth:postgresql:prisma',
    'express:clerk:none:none',
    'express:clerk:postgresql:prisma',
    'nestjs:none:none:none',
    'nestjs:none:postgresql:prisma',
    'nestjs:better-auth:postgresql:prisma',
    'nestjs:clerk:none:none',
    'nestjs:clerk:postgresql:prisma',
    'convex:none:none:none',
  ]);
});
