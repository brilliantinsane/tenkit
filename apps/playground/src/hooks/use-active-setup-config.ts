import Constants from 'expo-constants';

import { type ActiveSetupBootstrap } from '@/setup-types/core';
import { resolveRuntimeActiveSetupConfig } from '@/utils/runtime-active-setup-config';

export const useActiveSetupConfig = (): ActiveSetupBootstrap => {
  return resolveRuntimeActiveSetupConfig(Constants.expoConfig?.extra);
};
