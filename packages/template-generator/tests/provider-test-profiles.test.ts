import { expect, test } from 'vitest';

import { resolveProviderTestProfile } from '../src/provider-test-profiles';

test('Clerk Node profile maps explicit inputs without retaining secret values in evidence', () => {
  const resolved = resolveProviderTestProfile({
    baseEnvironment: { PATH: '/safe/bin' },
    inputs: {
      clerkPublishableKey: 'pk_test_provider_value',
      clerkSecretKey: 'sk_test_provider_value',
    },
    profile: 'clerk-node',
    sourceName: 'ci-clerk-development',
  });

  expect(resolved.values).toEqual({
    CLERK_PUBLISHABLE_KEY: 'pk_test_provider_value',
    CLERK_SECRET_KEY: 'sk_test_provider_value',
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_provider_value',
    PATH: '/safe/bin',
  });
  expect(resolved.evidence).toEqual({
    environmentKeys: [
      'CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
      'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'PATH',
    ],
    profile: 'clerk-node',
    resourceClasses: ['preprovisioned-clerk-development'],
    sourceName: 'ci-clerk-development',
  });
  expect(JSON.stringify(resolved.evidence)).not.toContain('provider_value');
});

test('hosted Convex profiles map only their exact provider requirements', () => {
  const resolved = resolveProviderTestProfile({
    baseEnvironment: { PATH: '/safe/bin' },
    inputs: {
      betterAuthSecret: 'better-auth-provider-secret',
      convexDeployment: 'dev:example',
      convexSiteUrl: 'https://example.convex.site',
      convexUrl: 'https://example.convex.cloud',
    },
    profile: 'convex-better-auth',
    sourceName: 'maintainer-convex-development',
  });

  expect(resolved.values).toEqual({
    BETTER_AUTH_SECRET: 'better-auth-provider-secret',
    CONVEX_DEPLOYMENT: 'dev:example',
    CONVEX_SITE_URL: 'https://example.convex.site',
    CONVEX_URL: 'https://example.convex.cloud',
    EXPO_PUBLIC_CONVEX_SITE_URL: 'https://example.convex.site',
    EXPO_PUBLIC_CONVEX_URL: 'https://example.convex.cloud',
    PATH: '/safe/bin',
    SITE_URL: 'https://example.convex.site',
  });
  expect(resolved.evidence.resourceClasses).toEqual([
    'preprovisioned-convex-development',
    'preprovisioned-better-auth-development',
  ]);
});

test('provider profiles reject missing, extra, empty, and unsafe source metadata', () => {
  expect(() =>
    resolveProviderTestProfile({
      baseEnvironment: {},
      inputs: { clerkPublishableKey: 'pk_test_value' },
      profile: 'clerk-node',
      sourceName: 'ci-clerk-development',
    }),
  ).toThrow(/Missing provider input: clerkSecretKey/);

  expect(() =>
    resolveProviderTestProfile({
      baseEnvironment: {},
      inputs: {
        clerkPublishableKey: 'pk_test_value',
        clerkSecretKey: 'sk_test_value',
        unexpected: 'must-not-pass',
      },
      profile: 'clerk-node',
      sourceName: 'ci-clerk-development',
    }),
  ).toThrow(/Unexpected provider input: unexpected/);

  expect(() =>
    resolveProviderTestProfile({
      baseEnvironment: {},
      inputs: {
        clerkPublishableKey: 'pk_test_value',
        clerkSecretKey: '  ',
      },
      profile: 'clerk-node',
      sourceName: 'ci-clerk-development',
    }),
  ).toThrow(/Provider input clerkSecretKey must be non-empty/);

  expect(() =>
    resolveProviderTestProfile({
      baseEnvironment: {},
      inputs: {
        clerkPublishableKey: 'pk_test_value',
        clerkSecretKey: 'sk_test_value',
      },
      profile: 'clerk-node',
      sourceName: '/private/provider.env',
    }),
  ).toThrow(/safe source name/);

  expect(() =>
    resolveProviderTestProfile({
      baseEnvironment: { PATH: '/safe/bin', SECRET_TOKEN: 'must-not-pass' },
      inputs: {
        clerkPublishableKey: 'pk_test_value',
        clerkSecretKey: 'sk_test_value',
      },
      profile: 'clerk-node',
      sourceName: 'ci-clerk-development',
    }),
  ).toThrow(/Unexpected host environment key: SECRET_TOKEN/);
});
