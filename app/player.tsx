import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { getStreamProvider } from '@/constants/streamProviders';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const hideAdsJS = `
  (function() {
    const css = 'iframe[src*="ads"], .ad-container, #pop-overlay { display: none !important; }';
    const head = document.head || document.getElementsByTagName('head')[0];
    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    head.appendChild(style);

    setInterval(() => {
      const overlays = document.querySelectorAll('div[style*="z-index: 9999"]');
      overlays.forEach(el => el.remove());
    }, 1000);
  })();
`;

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

  const streamLink = constructStreamUrl();

  const getAllowedDomains = () => {
    try {
      const url = new URL(streamUrl);
      return url.hostname;
    } catch {
      return '';
    }
  };

  const allowedDomain = getAllowedDomains();
  const metaLabel =
    type === 'tv' ? `S${season}  ·  E${episode}` : type === 'movie' ? 'Movie' : '';

  return (
    <TouchableWithoutFeedback onPress={showControls}>
      <View style={styles.container}>
        {controlsVisible && (
          <View
            style={[
              styles.header,
              {
                paddingTop: Math.max(insets.top, 10),
                paddingLeft: Math.max(insets.left, 12),
                paddingRight: Math.max(insets.right, 12),
              },
            ]}
            pointerEvents="box-none"
          >
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
                {title}
              </Text>
              {metaLabel ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {metaLabel}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        <WebView
          source={{ uri: streamLink }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          injectedJavaScript={hideAdsJS}
          onShouldStartLoadWithRequest={(request) => {
            const isMainPlayer =
              request.url.includes('vidsrc.to') ||
              request.url.includes('vidsrc.sbs') ||
              request.url.includes('videasy.net') ||
              request.url.includes(allowedDomain);

            return isMainPlayer;
          }}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
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
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});
