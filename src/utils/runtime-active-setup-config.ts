import { type ActiveSetupBootstrap } from '@/setup-types/core';

type RuntimeConfigExtra = {
  [key: string]: unknown;
  activeSetup?: unknown;
};

function isActiveSetupBootstrap(value: unknown): value is ActiveSetupBootstrap {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    setupType?: unknown;
    appVariant?: { id?: unknown; slug?: unknown };
    theme?: { accent?: unknown };
    standaloneRuntimeTenantId?: unknown;
  };

  return (
    (candidate.setupType === 'white-label-apps' ||
      candidate.setupType === 'single-app-runtime-tenants' ||
      candidate.setupType === 'generic-with-standalone-app-variants') &&
    typeof candidate.appVariant?.id === 'number' &&
    typeof candidate.appVariant.slug === 'string' &&
    typeof candidate.theme?.accent === 'string' &&
    (candidate.standaloneRuntimeTenantId === undefined ||
      typeof candidate.standaloneRuntimeTenantId === 'number')
  );
}

export function resolveRuntimeActiveSetupConfig(
  extra: RuntimeConfigExtra | null | undefined,
): ActiveSetupBootstrap {
  if (!isActiveSetupBootstrap(extra?.activeSetup)) {
    throw new Error('Missing Active Setup bootstrap data in Expo runtime config');
  }

  return extra.activeSetup;
}
