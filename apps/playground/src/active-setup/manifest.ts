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
      bundleIdentifier: 'com.example.firsttenant',
      packageName: 'com.example.firsttenant',
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
      bundleIdentifier: 'com.example.secondtenant',
      packageName: 'com.example.secondtenant',
      theme: {
        accent: '#ef8520',
      },
      eas: {
        projectId: '',
      },
    },
  ],
});
