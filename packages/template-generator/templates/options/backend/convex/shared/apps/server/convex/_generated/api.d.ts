/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `pnpm run codegen` from apps/server.
 * @module
 */

import type * as businessProfileAccess from '../businessProfileAccess.js';
import type * as businessProfiles from '../businessProfiles.js';
import type * as health from '../health.js';
import type * as setupType from '../setupType.js';
import type * as starterData from '../starterData.js';

import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server';

declare const fullApi: ApiFromModules<{
  businessProfileAccess: typeof businessProfileAccess;
  businessProfiles: typeof businessProfiles;
  health: typeof health;
  setupType: typeof setupType;
  starterData: typeof starterData;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<'query' | 'mutation' | 'action', 'public'>
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<'query' | 'mutation' | 'action', 'internal'>
>;
export declare const components: {};
