import { ThemedText } from '@/components/ui/themed-text';
import { ThemedView } from '@/components/ui/themed-view';
import { globalStyles } from '@/constants/globals';
import { useActiveRuntimeTenant } from '@/hooks/use-active-runtime-tenant';
import { useActiveSetupConfig } from '@/hooks/use-active-setup-config';
import { StyleSheet } from 'react-native';

export default function Index() {
  const { setupType, appVariant } = useActiveSetupConfig();
  const { activeRuntimeTenantId } = useActiveRuntimeTenant();

  return (
    <ThemedView style={[globalStyles.centeredContainer, styles.screen]}>
      <ThemedText>TenantKit</ThemedText>
      <ThemedText>Setup Type: {setupType}</ThemedText>
      <ThemedText>App Variant: {appVariant.id}</ThemedText>
      {activeRuntimeTenantId ? (
        <ThemedText>Active Tenant: {activeRuntimeTenantId}</ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 12,
  },
});
