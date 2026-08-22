import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { AlertCircle, X } from 'lucide-react-native';
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

const PLYR_VERSION = '3.8.4';
const PLAYER_LOAD_TIMEOUT_MS = 25_000;

type PlayerMessage = {
  type?: 'ready' | 'error';
};

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

const buildIptvPlayerHtml = (streamUrl: string, channelName: string) => {
  const serializedSource = JSON.stringify({ streamUrl, channelName }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="https://cdn.plyr.io/${PLYR_VERSION}/plyr.css" />
    <style>
      :root {
        --plyr-color-main: ${Colors.accent};
        --plyr-video-background: #000;
        --plyr-video-control-color: ${Colors.text};
        --plyr-video-control-color-hover: ${Colors.text};
        --plyr-menu-background: ${Colors.surface};
        --plyr-menu-color: ${Colors.text};
        --plyr-font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      }
      html, body, #app, .plyr { width: 100%; height: 100%; margin: 0; background: #000; }
      video { width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="app"><video id="player" controls playsinline crossorigin="anonymous"></video></div>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.18"></script>
    <script src="https://cdn.plyr.io/${PLYR_VERSION}/plyr.polyfilled.js"></script>
    <script>
      (function () {
        const source = ${serializedSource};
        const video = document.getElementById('player');
        const isDash = /\\.mpd(?:[?#]|$)/i.test(source.streamUrl);
        const isDirectFile = /\\.(mp4|m4v|webm)(?:[?#]|$)/i.test(source.streamUrl);
        const shouldTryHls = !isDash && !isDirectFile;

        const post = (type) => {
          try {
            const payload = JSON.stringify({ type: type });
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(payload);
            } else if (window.parent && window.parent !== window) {
              window.parent.postMessage(payload, '*');
            }
          } catch (_) {}
        };

        const player = new Plyr(video, {
          iconUrl: 'https://cdn.plyr.io/${PLYR_VERSION}/plyr.svg',
          loadSprite: true,
          title: source.channelName || 'Live channel',
          captions: { active: false, update: true },
          settings: ['captions', 'speed', 'loop'],
          controls: ['play-large', 'restart', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
          fullscreen: { enabled: true, fallback: true, iosNative: false },
        });

        const play = () => video.play().catch(() => {});
        video.addEventListener('error', () => post('error'));

        if (shouldTryHls && window.Hls && window.Hls.isSupported()) {
          const hls = new window.Hls({ enableWorker: true, backBufferLength: 90 });
          hls.loadSource(source.streamUrl);
          hls.attachMedia(video);
          hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            post('ready');
            play();
          });
          hls.on(window.Hls.Events.ERROR, (_, data) => {
            if (data && data.fatal) {
              hls.destroy();
              post('error');
            }
          });
          return;
        }

        if ((shouldTryHls && video.canPlayType('application/vnd.apple.mpegurl')) || isDirectFile) {
          video.src = source.streamUrl;
          video.addEventListener('loadedmetadata', () => {
            post('ready');
            play();
          }, { once: true });
          return;
        }

        player.destroy();
        post('error');
      })();
    </script>
  </body>
</html>`;
};

export default function IptvPlayerScreen() {
  const { channelName = 'Live channel', streamUrl = '' } = useLocalSearchParams<{
    channelName?: string;
    streamUrl?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWeb = Platform.OS === 'web';

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  const playableStreamUrl = useMemo(
    () => (isPlayableUrl(streamUrl) ? streamUrl : ''),
    [streamUrl]
  );
  const streamOrigin = useMemo(() => {
    try {
      return new URL(playableStreamUrl).origin;
    } catch {
      return 'https://localhost';
    }
  }, [playableStreamUrl]);
  const playerHtml = useMemo(
    () => (playableStreamUrl ? buildIptvPlayerHtml(playableStreamUrl, channelName) : ''),
    [channelName, playableStreamUrl]
  );

  useEffect(() => {
    if (!isWeb) {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    return () => {
      if (!isWeb) {
        void ScreenOrientation.unlockAsync();
      }
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isWeb]);

  useEffect(() => {
    if (!playableStreamUrl || hasLoaded || hasError) return;

    const timeout = setTimeout(() => setHasError(true), PLAYER_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [hasError, hasLoaded, playableStreamUrl]);

  const applyPlayerMessage = useCallback((raw: string) => {
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
    (event: WebViewMessageEvent) => {
      applyPlayerMessage(event.nativeEvent.data);
    },
    [applyPlayerMessage]
  );

  useEffect(() => {
    if (!isWeb) return;

    const onWindowMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      applyPlayerMessage(event.data);
    };

    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [applyPlayerMessage, isWeb]);

  const headerPadding = {
    paddingTop: Math.max(insets.top, 10),
    paddingLeft: Math.max(insets.left, 12),
    paddingRight: Math.max(insets.right, 12),
  };

  if (!playableStreamUrl || hasError) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, headerPadding]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
            activeOpacity={0.85}
            accessibilityLabel="Close player"
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.stateContainer}>
          <AlertCircle size={40} color={Colors.textSecondary} />
          <Text style={styles.stateTitle}>Channel unavailable</Text>
          <Text style={styles.stateText}>
            This channel could not be played. It may be offline, protected, or unsupported on
            this device.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
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
            srcDoc: playerHtml,
            style: { width: '100%', height: '100%', border: 'none', backgroundColor: '#000' },
            allow: 'autoplay; fullscreen; encrypted-media',
            allowFullScreen: true,
          })
        : (
          <WebView
            source={{ html: playerHtml, baseUrl: streamOrigin }}
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
      {controlsVisible ? (
        <View style={[styles.header, headerPadding]} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
            activeOpacity={0.85}
            accessibilityLabel="Close player"
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo} pointerEvents="none">
            <Text style={styles.channelName} numberOfLines={1}>
              {channelName}
            </Text>
            <Text style={styles.liveLabel}>Live</Text>
          </View>
        </View>
      ) : (
        <Pressable
          style={[styles.revealStrip, { height: Math.max(insets.top, 12) + 36 }]}
          onPress={showControls}
          accessibilityLabel="Show player controls"
        />
      )}
      {!hasLoaded && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading channel...</Text>
        </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingBottom: 12,
    gap: 10,
    zIndex: 10,
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
  channelName: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.SemiBold,
    fontSize: 15,
  },
  liveLabel: {
    color: Colors.accent,
    fontFamily: Fonts.GeistMono.Medium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
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
  retryButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#000',
    fontFamily: Fonts.GeistMono.Bold,
    fontSize: 14,
  },
});
