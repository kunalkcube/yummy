import { AppTabBar } from '@/components/AppTabBar';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="manga" options={{ title: 'Manga' }} />
      <Tabs.Screen name="iptv" options={{ title: 'IPTV' }} />
    </Tabs>
  );
}
