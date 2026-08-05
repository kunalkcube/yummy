import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { AlertCircle, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, TouchableWithoutFeedback } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

const PLYR_VERSION = '3.8.4';
const PLAYER_LOAD_TIMEOUT_MS = 25_000;

type PlayerMessage = {
  type?: 'ready' | 'error';
};

const isPlayableUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password;
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
        --plyr-video-background: ${Colors.background};
        --plyr-video-control-color: ${Colors.text};
        --plyr-video-control-color-hover: ${Colors.text};
        --plyr-menu-background: ${Colors.surface};
        --plyr-menu-color: ${Colors.text};
        --plyr-font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      }
      html, body, #app, .plyr { width: 100%; height: 100%; margin: 0; background: ${Colors.background}; }
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
        const isDash = /\.mpd(?:[?#]|$)/i.test(source.streamUrl);
        const isDirectFile = /\.(mp4|m4v|webm)(?:[?#]|$)/i.test(source.streamUrl);
        const shouldTryHls = !isDash && !isDirectFile;

        const post = (type) => {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type }));
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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showControls = () => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  };

  const playableStreamUrl = useMemo(() => (isPlayableUrl(streamUrl) ? streamUrl : ''), [streamUrl]);
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
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    showControls();
    return () => {
      void ScreenOrientation.unlockAsync();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!playableStreamUrl || hasLoaded || hasError) return;

    const timeout = setTimeout(() => setHasError(true), PLAYER_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [hasError, hasLoaded, playableStreamUrl]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as PlayerMessage;
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

  if (!playableStreamUrl || hasError) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <X size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.stateContainer}>
          <AlertCircle size={48} color={Colors.accent} />
          <Text style={styles.stateTitle}>Channel unavailable</Text>
          <Text style={styles.stateText}>
            This channel could not be played in Plyr. It may be offline, protected, or unsupported by the device.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={showControls}>
      <View style={styles.container}>
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
        {controlsVisible && (
          <View style={styles.header} pointerEvents="box-none">
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.channelName} numberOfLines={1}>{channelName}</Text>
          </View>
        )}
        {!hasLoaded && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Loading channel...</Text>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  webview: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  closeButton: {
    padding: 8,
  },
  channelName: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.GeistMono.SemiBold,
    fontSize: 15,
    marginLeft: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 14,
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
    fontSize: 22,
  },
  stateText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
