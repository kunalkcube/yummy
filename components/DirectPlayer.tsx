import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { buildPlyrPlayerHtml } from '@/utils/plyrPlayerHtml';
import { AlertCircle } from 'lucide-react-native';
import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

const PLAYER_LOAD_TIMEOUT_MS = 30_000;

type PlayerMessage = { type?: 'ready' | 'error' };

const isPlayableUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
};

interface DirectPlayerProps {
  streamUrl: string;
  title: string;
}

/**
 * Plays a direct media URL (HLS / DASH / progressive file) through Plyr +
 * hls.js. Used for Custom URL sources that point at an actual stream rather
 * than an embed page.
 */
export function DirectPlayer({ streamUrl, title }: DirectPlayerProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isWeb = Platform.OS === 'web';

  const playable = useMemo(() => isPlayableUrl(streamUrl), [streamUrl]);
  const origin = useMemo(() => {
    try {
      return new URL(streamUrl).origin;
    } catch {
      return 'https://localhost';
    }
  }, [streamUrl]);
  const html = useMemo(
    () => (playable ? buildPlyrPlayerHtml(streamUrl, title) : ''),
    [playable, streamUrl, title]
  );

  useEffect(() => {
    if (!playable || hasLoaded || hasError) return;
    const timeout = setTimeout(() => setHasError(true), PLAYER_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [hasError, hasLoaded, playable]);

  const applyMessage = useCallback((raw: string) => {
    try {
      const message = JSON.parse(raw) as PlayerMessage;
      if (message.type === 'ready') {
        setHasLoaded(true);
        return;
      }
      if (message.type === 'error') {
        setHasError(true);
      }
    } catch {
      setHasError(true);
    }
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => applyMessage(event.nativeEvent.data),
    [applyMessage]
  );

  useEffect(() => {
    if (!isWeb) return;
    const onWindowMessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') applyMessage(event.data);
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [applyMessage, isWeb]);

  if (!playable || hasError) {
    return (
      <View style={styles.stateContainer}>
        <AlertCircle size={40} color={Colors.textSecondary} />
        <Text style={styles.stateTitle}>Stream unavailable</Text>
        <Text style={styles.stateText}>
          This custom URL could not be played. It may be offline, protected, or not a direct
          stream link.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isWeb
        ? createElement('iframe', {
            srcDoc: html,
            style: { width: '100%', height: '100%', border: 'none', backgroundColor: '#000' },
            allow: 'autoplay; fullscreen; encrypted-media',
            allowFullScreen: true,
          })
        : (
          <WebView
            source={{ html, baseUrl: origin }}
            style={styles.webview}
            originWhitelist={['http://*', 'https://*', 'about:*', 'blob:*', 'data:*']}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            onError={() => setHasError(true)}
            onMessage={handleMessage}
          />
        )}
      {!hasLoaded ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading stream...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    backgroundColor: '#000',
  },
  stateTitle: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.Bold,
    fontSize: 16,
  },
  stateText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
