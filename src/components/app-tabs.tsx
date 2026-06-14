import { useTheme } from '@/hooks/use-theme';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

const AppTabs = () => {
  const { colors } = useTheme();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      labelStyle={{
        selected: { color: colors.accent },
      }}
      iconColor={{
        selected: colors.accent,
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gear" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
};

export default AppTabs;
