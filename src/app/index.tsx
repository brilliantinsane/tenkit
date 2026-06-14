import { ThemedText } from '@/components/ui/themed-text';
import { ThemedView } from '@/components/ui/themed-view';
import { globalStyles } from '@/constants/globals';
import { useTenantConfig } from '@/hooks/use-tenant-config';
import { StyleSheet } from 'react-native';

export default function Index() {
  const { tenantId } = useTenantConfig();
  return (
    <ThemedView style={[globalStyles.centeredContainer, styles.screen]}>
      <ThemedText>TenantKit</ThemedText>
      <ThemedText>Current tenantId: {tenantId}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 12,
  },
});
