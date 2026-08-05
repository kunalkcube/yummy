import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import {
  PLAYER_AD_BLOCK_BEFORE_JS,
  PLAYER_AD_BLOCK_JS,
  shouldAllowPlayerRequest,
} from '@/constants/playerAdBlock';
import { getStreamProvider } from '@/constants/streamProviders';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function PlayerScreen() {
  const params = useLocalSearchParams<{
    id: string;
    type: 'movie' | 'tv';
    title: string;
    season?: string;
    episode?: string;
  }>();

  const { id, type, title } = params;
  const season = params.season || '1';
  const episode = params.episode || '1';

  const { streamUrl, streamProvider } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showControls = () => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  };

  useEffect(() => {
    showControls();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  const constructStreamUrl = () => {
    const provider = getStreamProvider(streamProvider);

    if (provider && provider.id !== 'custom') {
      return provider.constructUrl({
        type,
        id,
        season,
        episode,
      });
    }

    return type === 'movie'
      ? `${streamUrl}/movie/${id}`
      : `${streamUrl}/tv/${id}/${season}/${episode}`;
  };

  const handleClose = () => {
    router.back();
  };

  const onShouldStartLoadWithRequest = useCallback((request: { url: string }) => {
    return shouldAllowPlayerRequest(request.url || '');
  }, []);

  const streamLink = constructStreamUrl();
  const metaLabel =
    type === 'tv' ? `S${season}  ·  E${episode}` : type === 'movie' ? 'Movie' : '';

  const headerPadding = {
    paddingTop: Math.max(insets.top, 10),
    paddingLeft: Math.max(insets.left, 12),
    paddingRight: Math.max(insets.right, 12),
  };

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: streamLink }}
        style={styles.webview}
        originWhitelist={['http://*', 'https://*', 'about:*', 'blob:*', 'data:*']}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        nestedScrollEnabled
        injectedJavaScriptBeforeContentLoaded={PLAYER_AD_BLOCK_BEFORE_JS}
        injectedJavaScript={PLAYER_AD_BLOCK_JS}
        injectedJavaScriptForMainFrameOnly={false}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onOpenWindow={() => {
          // Pop-up ads — discard; do not open a second window
        }}
      />

      {controlsVisible ? (
        <View style={[styles.header, headerPadding]} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.85}
            accessibilityLabel="Close player"
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo} pointerEvents="none">
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {metaLabel ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {metaLabel}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <Pressable
          style={[styles.revealStrip, { height: Math.max(insets.top, 12) + 36 }]}
          onPress={showControls}
          accessibilityLabel="Show player controls"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    zIndex: 10,
    gap: 10,
  },
  revealStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: Fonts.GeistMono.SemiBold,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
