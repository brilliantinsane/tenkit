import { useCallback, useEffect, useMemo } from 'react';
import { useMMKVNumber } from 'react-native-mmkv';

import { useActiveSetupConfig } from '@/hooks/use-active-setup-config';
import type { RuntimeTenantId } from '@/setup-types/core';
import { ACTIVE_RUNTIME_TENANT_ID_KEY, appPreferencesStorage } from '@/storage/app-preferences';

const EMPTY_RUNTIME_TENANT_IDS: readonly RuntimeTenantId[] = [];

function isAllowedRuntimeTenantId(
  runtimeTenantId: number | undefined,
  allowedRuntimeTenantIds: readonly RuntimeTenantId[],
): runtimeTenantId is RuntimeTenantId {
  return runtimeTenantId !== undefined && allowedRuntimeTenantIds.includes(runtimeTenantId);
}

export function useActiveRuntimeTenant() {
  const { runtimeTenantAccess } = useActiveSetupConfig();
  const [storedRuntimeTenantId, setStoredRuntimeTenantId] = useMMKVNumber(
    ACTIVE_RUNTIME_TENANT_ID_KEY,
    appPreferencesStorage,
  );

  const allowedRuntimeTenantIds =
    runtimeTenantAccess?.allowedRuntimeTenantIds ?? EMPTY_RUNTIME_TENANT_IDS;
  const defaultRuntimeTenantId = runtimeTenantAccess?.defaultRuntimeTenantId ?? null;
  const activeRuntimeTenantId = useMemo(() => {
    if (!runtimeTenantAccess) {
      return null;
    }

    if (isAllowedRuntimeTenantId(storedRuntimeTenantId, allowedRuntimeTenantIds)) {
      return storedRuntimeTenantId;
    }

    return runtimeTenantAccess.defaultRuntimeTenantId;
  }, [allowedRuntimeTenantIds, runtimeTenantAccess, storedRuntimeTenantId]);

  useEffect(() => {
    if (!runtimeTenantAccess) {
      return;
    }

    if (!isAllowedRuntimeTenantId(storedRuntimeTenantId, allowedRuntimeTenantIds)) {
      setStoredRuntimeTenantId(runtimeTenantAccess.defaultRuntimeTenantId);
    }
  }, [
    allowedRuntimeTenantIds,
    runtimeTenantAccess,
    setStoredRuntimeTenantId,
    storedRuntimeTenantId,
  ]);

  const setActiveRuntimeTenantId = useCallback(
    (runtimeTenantId: RuntimeTenantId) => {
      if (allowedRuntimeTenantIds.includes(runtimeTenantId)) {
        setStoredRuntimeTenantId(runtimeTenantId);
      }
    },
    [allowedRuntimeTenantIds, setStoredRuntimeTenantId],
  );

  return {
    activeRuntimeTenantId,
    allowedRuntimeTenantIds,
    defaultRuntimeTenantId,
    hasRuntimeTenantSelection: runtimeTenantAccess?.selectionMode === 'selectable',
    setActiveRuntimeTenantId,
  };
}
