import { ThemedView } from '@/components/ui/themed-view';
import { globalStyles } from '@/constants/globals';
import { useActiveRuntimeTenant } from '@/hooks/use-active-runtime-tenant';
import { useTheme } from '@/hooks/use-theme';
import { FieldGroup, Host, Picker, Row, Spacer, Switch, Text } from '@expo/ui';
import { scrollContentBackground } from '@expo/ui/swift-ui/modifiers';

const SettingsScreen = () => {
  const { colors, scheme, setScheme } = useTheme();
  const {
    activeRuntimeTenantId,
    allowedRuntimeTenantIds,
    hasRuntimeTenantSelection,
    setActiveRuntimeTenantId,
  } = useActiveRuntimeTenant();

  return (
    <ThemedView style={[globalStyles.container]}>
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        <FieldGroup
          style={{
            backgroundColor: colors.background,
          }}
          modifiers={[scrollContentBackground('hidden')]}
        >
          <Row alignment="center">
            <Text>Dark appearance</Text>

            <Spacer flexible />

            <Switch
              value={scheme === 'dark'}
              onValueChange={(value) => {
                setScheme(value ? 'dark' : 'light');
              }}
            />
          </Row>
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
