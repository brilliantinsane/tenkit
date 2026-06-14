import { ThemedView } from '@/components/ui/themed-view';
import { globalStyles } from '@/constants/globals';
import { useTheme } from '@/hooks/use-theme';
import { FieldGroup, Host, Row, Spacer, Switch, Text } from '@expo/ui';
import { scrollContentBackground } from '@expo/ui/swift-ui/modifiers';

const SettingsScreen = () => {
  const { scheme, setScheme } = useTheme();
  const { colors } = useTheme();

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
        </FieldGroup>
      </Host>
    </ThemedView>
  );
};

export default SettingsScreen;
