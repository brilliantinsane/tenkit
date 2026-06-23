import { defineWhiteLabelAppsSetup } from '@/setup-types/white-label-apps';

export const activeSetup = defineWhiteLabelAppsSetup({
  setupType: 'white-label-apps',
  defaultAppVariantId: 1,
  appVariants: [
    {
      appVariantId: 1,
      slug: 'first-tenant',
      name: 'First Tenant',
      version: '1.0.0',
      scheme: 'firsttenant',
      bundleIdentifier: 'com.brilliantinsane.firsttenant',
      packageName: 'com.brilliantinsane.firsttenant',
      theme: {
        accent: '#208AEF',
      },
      eas: {
        projectId: '',
      },
    },
    {
      appVariantId: 2,
      slug: 'second-tenant',
      name: 'Second Tenant',
      version: '1.0.0',
      scheme: 'secondtenant',
      bundleIdentifier: 'com.brilliantinsane.secondtenant',
      packageName: 'com.brilliantinsane.secondtenant',
      theme: {
        accent: '#ef8520',
      },
      eas: {
        projectId: '',
      },
    },
  ],
});
