import { ThemedView } from '@/components/themed-view';
import { globalStyles } from '@/constants/globals';
import { useTheme } from '@/hooks/use-theme';
import { Host, List, Switch } from '@expo/ui';

const SettingsScreen = () => {
  const { scheme, setScheme } = useTheme();

  return (
    <ThemedView style={globalStyles.container}>
      <Host style={{ flex: 1 }}>
        <List>
          <Switch
            label="Dark appearance"
            value={scheme === 'dark'}
            onValueChange={(value) => {
              setScheme(value ? 'dark' : 'light');
            }}
          />
        </List>
      </Host>
    </ThemedView>
  );
};

export default SettingsScreen;
