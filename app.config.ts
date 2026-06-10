import 'tsx/cjs';

import { TenantSlug } from '@/types/tenant-config.types';
import { ConfigContext, ExpoConfig } from 'expo/config';
import { configs } from './tenant-configs';

const defaultTenantSlug: TenantSlug = 'first-tenant';
const tenant = (process.env.TENANT_SLUG ?? defaultTenantSlug) as TenantSlug;

const getDynamicAppConfig = () => configs[tenant];

const COLORS = {
  light: '#F2F2F2',
  dark: '#0D0D0D',
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const { name, slug, version, scheme, bundleIdentifier, packageName, theme, extra } =
    getDynamicAppConfig();

  const assetPath = `./assets/${slug}`;
  const icons = `${assetPath}/icons`;
  const iosIcon = `${assetPath}/app.icon`;

  return {
    ...config,
    name,
    slug,
    version,
    scheme,
    icon: `${icons}/icon.png`,
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier,
      icon: iosIcon,
    },
    android: {
      softwareKeyboardLayoutMode: 'pan',
      package: packageName,
      adaptiveIcon: {
        backgroundColor: COLORS.light,
        foregroundImage: `${icons}/android-icon-foreground.png`,
        backgroundImage: `${icons}/android-icon-background.png`,
        monochromeImage: `${icons}/android-icon-monochrome.png`,
      },
      predictiveBackGestureEnabled: false,
    },
    extra: {
      ...extra,
      slug,
      theme,
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: COLORS.light,
          image: `${icons}/splash-icon.png`,
          dark: {
            backgroundColor: COLORS.dark,
          },
        },
      ],
    ],
  };
};
