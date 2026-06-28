import { ThemedView } from '@/components/ui/themed-view';
import { globalStyles } from '@/constants/globals';
import { useActiveRuntimeTenant } from '@/hooks/use-active-runtime-tenant';
import { useTheme } from '@/theme/ThemeContext';
import { FieldGroup, Host, Picker, Row, Spacer, Text } from '@expo/ui';
import { scrollContentBackground } from '@expo/ui/swift-ui/modifiers';

const SettingsScreen = () => {
  const { colors, dark } = useTheme();
  const colorScheme = dark ? 'dark' : 'light';
  const {
    activeRuntimeTenantId,
    allowedRuntimeTenantIds,
    hasRuntimeTenantSelection,
    setActiveRuntimeTenantId,
  } = useActiveRuntimeTenant();

  return (
    <ThemedView style={[globalStyles.container]}>
      <Host style={{ flex: 1 }} colorScheme={colorScheme}>
        <FieldGroup
          style={{
            backgroundColor: colors.background,
          }}
          modifiers={[scrollContentBackground('hidden')]}
        >
          {hasRuntimeTenantSelection && activeRuntimeTenantId ? (
            <Row alignment="center">
              <Text>Active tenant</Text>

              <Spacer flexible />

              <Picker
                selectedValue={activeRuntimeTenantId}
                onValueChange={setActiveRuntimeTenantId}
              >
                {allowedRuntimeTenantIds.map((runtimeTenantId) => (
                  <Picker.Item
                    key={runtimeTenantId}
                    label={runtimeTenantId.toString()}
                    value={runtimeTenantId}
                  />
                ))}
              </Picker>
            </Row>
          ) : null}
        </FieldGroup>
      </Host>
    </ThemedView>
  );
};

export default SettingsScreen;
