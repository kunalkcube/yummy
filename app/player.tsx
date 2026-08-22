import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import {
  PLAYER_AD_BLOCK_BEFORE_JS,
  PLAYER_AD_BLOCK_JS,
  shouldAllowPlayerRequest,
} from '@/constants/playerAdBlock';
import { getStreamProvider } from '@/constants/streamProviders';
import { useSettings } from '@/contexts/SettingsContext';
import { isStreamPlaybackConfigured } from '@/utils/streamPlaybackGate';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { X } from 'lucide-react-native';
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  const { streamUrl, streamProvider, streamDisclaimerAccepted } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWeb = Platform.OS === 'web';
  const playbackReady = isStreamPlaybackConfigured(
    streamDisclaimerAccepted,
    streamProvider,
    streamUrl
  );

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  useEffect(() => {
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (isWeb) return;
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      void ScreenOrientation.unlockAsync();
    };
  }, [isWeb]);

  const constructStreamUrl = () => {
    if (!playbackReady) return '';

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

  if (!playbackReady) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, headerPadding]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.85}
            accessibilityLabel="Close player"
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.title} numberOfLines={1}>
              Stream not ready
            </Text>
          </View>
        </View>
        <View style={styles.blockedBody}>
          <Text style={styles.blockedTitle}>Accept notice & choose a source</Text>
          <Text style={styles.blockedText}>
            Third-party embeds stay locked until you accept the stream notice and pick a provider
            (or custom URL) in Settings.
          </Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push('/settings')}
            activeOpacity={0.85}
          >
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      {...(isWeb
        ? {
            onMouseMove: showControls,
            onTouchStart: showControls,
          }
        : {})}
    >
      {isWeb
        ? createElement('iframe', {
            src: streamLink,
            style: { width: '100%', height: '100%', border: 'none', backgroundColor: '#000' },
            allow: 'autoplay; fullscreen; encrypted-media',
            allowFullScreen: true,
          })
        : (
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
        )}

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
  blockedBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  blockedTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.SemiBold,
  },
  blockedText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    lineHeight: 20,
  },
  settingsButton: {
    marginTop: 8,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#000',
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Bold,
  },
});
