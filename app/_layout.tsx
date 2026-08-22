import { AlertProvider } from '@/components/AppAlert';
import UpdateAlert from '@/components/UpdateAlert';
import { WebInputReset } from '@/components/WebInputReset';
import { LibraryProvider } from '@/contexts/LibraryContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-gesture-handler';
import 'react-native-reanimated';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'GeistMono-Regular': require('../assets/fonts/GeistMono-Regular.ttf'),
    'GeistMono-Medium': require('../assets/fonts/GeistMono-Medium.ttf'),
    'GeistMono-SemiBold': require('../assets/fonts/GeistMono-SemiBold.ttf'),
    'GeistMono-Bold': require('../assets/fonts/GeistMono-Bold.ttf'),
  });

  const { updateInfo, isLoading } = useVersionCheck();
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    if (updateInfo?.hasUpdate && !isLoading) {
      setShowAlert(true);
    }
  }, [updateInfo, isLoading]);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SettingsProvider>
      <LibraryProvider>
      <AlertProvider>
        <ThemeProvider value={DarkTheme}>
          <WebInputReset />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="details" options={{ headerShown: false }} />
            <Stack.Screen name="player" options={{ headerShown: false }} />
            <Stack.Screen name="iptv-player" options={{ headerShown: false }} />
            <Stack.Screen name="person" options={{ headerShown: false }} />
            <Stack.Screen name="manga-details" options={{ headerShown: false }} />
            <Stack.Screen name="manga-reader" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="light" />
          {updateInfo && (
            <UpdateAlert
              visible={showAlert}
              latestVersion={updateInfo.latestVersion}
              currentVersion={updateInfo.currentVersion}
              releaseNotes={updateInfo.releaseNotes}
              downloadUrl={updateInfo.downloadUrl}
              onDismiss={() => setShowAlert(false)}
            />
          )}
        </ThemeProvider>
      </AlertProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}
