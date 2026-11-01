import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { downloadsAvailable } from '@/utils/downloads';
import { requireNativeView } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, NativeSyntheticEvent, Pressable, StyleSheet, Text, TouchableOpacity, View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OfflineVideoProps extends ViewProps {
  downloadId: string;
  onReady: () => void;
  onPlaybackError: (event: NativeSyntheticEvent<{ message: string }>) => void;
}
const OfflineVideo = downloadsAvailable ? requireNativeView<OfflineVideoProps>('YummyDownloads') : null;

export default function DownloadPlayerScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [controls, setControls] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reveal = useCallback(() => {
    setControls(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setControls(false), 3_000);
  }, []);

  useEffect(() => {
    if (!downloadsAvailable) return;
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    reveal();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void ScreenOrientation.unlockAsync();
    };
  }, [reveal]);

  return (
    <View style={styles.container}>
      {OfflineVideo && id ? <OfflineVideo style={styles.video} downloadId={id} onReady={() => setLoading(false)}
        onPlaybackError={(event) => { setLoading(false); setError(event.nativeEvent.message); }} /> : null}
      {(loading || error || !OfflineVideo) && (
        <View style={styles.state} pointerEvents={error || !OfflineVideo ? 'auto' : 'none'}>
          {loading && OfflineVideo && !error ? <ActivityIndicator color={Colors.accent} size="large" /> : null}
          <Text style={styles.message}>{error || (!OfflineVideo ? 'Offline playback requires an Android build.' : 'Opening offline video…')}</Text>
        </View>
      )}
      {controls || loading || error ? (
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 10), paddingLeft: Math.max(insets.left, 12), paddingRight: Math.max(insets.right, 12) }]} pointerEvents="box-none">
          <TouchableOpacity style={styles.close} onPress={() => router.canGoBack() ? router.back() : router.replace('/downloads')} accessibilityRole="button" accessibilityLabel="Close offline player">
            <X size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy} pointerEvents="none"><Text style={styles.title} numberOfLines={1}>{title || 'Offline video'}</Text><Text style={styles.meta}>OFFLINE · SAVED ON THIS DEVICE</Text></View>
        </View>
      ) : <Pressable style={[styles.reveal, { height: Math.max(insets.top, 12) + 36 }]} onPress={reveal} accessibilityLabel="Show player controls" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  video: { flex: 1 },
  state: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  message: { fontSize: 13, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, alignItems: 'center', paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.72)' },
  close: { width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 15, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.text },
  meta: { fontSize: 10, fontFamily: Fonts.GeistMono.Medium, color: Colors.textSecondary, letterSpacing: 0.8, marginTop: 4 },
  reveal: { position: 'absolute', top: 0, left: 0, right: 0 },
});
