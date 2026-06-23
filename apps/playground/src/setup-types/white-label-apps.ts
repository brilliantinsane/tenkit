import { defineActiveSetup, type WhiteLabelAppsSetup } from './core';

export type { WhiteLabelAppsSetup } from './core';

export function defineWhiteLabelAppsSetup<TSetup extends WhiteLabelAppsSetup>(
  activeSetup: TSetup,
): TSetup {
  for (const appVariant of activeSetup.appVariants) {
    if (appVariant.runtimeTenantAccess) {
      throw new Error('White Label Apps App Variants must not declare Runtime Tenant Access');
    }
  }

  return defineActiveSetup(activeSetup);
}
