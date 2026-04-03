import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { getStreamProvider } from '@/constants/streamProviders';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

// Ad-blocking JavaScript to inject into the WebView
const hideAdsJS = `
  (function() {
    const css = 'iframe[src*="ads"], .ad-container, #pop-overlay { display: none !important; }';
    const head = document.head || document.getElementsByTagName('head')[0];
    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    head.appendChild(style);
    
    // Auto-click the play button if it's stuck behind an invisible ad div
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

  // Debug logging
  useEffect(() => {
    console.log('Player Screen - Params:', { id, type, title, season, episode });
    console.log('Player Screen - Type check:', type === 'movie' ? 'MOVIE' : 'TV SHOW');
  }, [id, type, title, season, episode]);

  useEffect(() => {
    // Lock to landscape on mount
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

    // Unlock on unmount
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  const constructStreamUrl = () => {
    // Get the selected provider
    const provider = getStreamProvider(streamProvider);
    
    console.log('=== STREAM URL CONSTRUCTION ===');
    console.log('Selected Provider ID:', streamProvider);
    console.log('Provider Object:', provider);
    console.log('Content Type:', type);
    console.log('Content ID:', id);
    console.log('Season:', season);
    console.log('Episode:', episode);
    
    let url: string;
    
    if (provider && provider.id !== 'custom') {
      // Use the provider's URL construction method
      url = provider.constructUrl({
        type,
        id,
        season,
        episode,
      });
      console.log('Using Provider URL Constructor');
    } else {
      // Use custom URL format (legacy support)
      url = type === 'movie' 
        ? `${streamUrl}/movie/${id}`
        : `${streamUrl}/tv/${id}/${season}/${episode}`;
      console.log('Using Custom URL Format');
    }
    
    console.log('Final Constructed URL:', url);
    console.log('===============================');
    return url;
  };

  const handleClose = () => {
    router.back();
  };

  const streamLink = constructStreamUrl();

  // Extract domain from streamUrl for ad-blocking
  const getAllowedDomains = () => {
    try {
      const url = new URL(streamUrl);
      return url.hostname;
    } catch {
      return '';
    }
  };

  const allowedDomain = getAllowedDomains();

  return (
    <View style={styles.container}>
      {controlsVisible && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
      )}

      <WebView
        source={{ uri: streamLink }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        setSupportMultipleWindows={false}
        allowsFullscreenVideo={true}
        mediaPlaybackRequiresUserAction={false}
        injectedJavaScript={hideAdsJS}
        onShouldStartLoadWithRequest={(request) => {
          const isMainPlayer = request.url.includes("vidsrc.to") || 
                               request.url.includes("videasy.net") ||
                               request.url.includes(allowedDomain);
          
          if (isMainPlayer) return true;
          
          return false;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  closeButton: {
    padding: 8,
    marginRight: 10,
  },
  title: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Bold,
  },
  webview: {
    flex: 1,
  },
});
