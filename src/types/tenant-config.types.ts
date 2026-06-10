import { Android, IOS } from '@expo/config-types';
import { ExpoConfig } from 'expo/config';

export const TENANT_SLUGS = ['first-tenant', 'second-tenant'];

export type TenantSlug = (typeof TENANT_SLUGS)[number];

export type TenantColors = {
  accent: string;
};

export type TenantTheme = TenantColors;

export type ExtraConfig = ExpoConfig['extra'] & {};

type TenantConfig = {
  name: ExpoConfig['name'];
  slug: TenantSlug;
  version: ExpoConfig['version'];
  scheme: string;
  bundleIdentifier: IOS['bundleIdentifier'];
  packageName: Android['package'];
  theme: TenantTheme;
  extra: ExtraConfig;
  // add more to your liking
};

export type TenantAppConfig = {
  [key in TenantSlug]: TenantConfig;
};
