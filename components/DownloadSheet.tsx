import { AppAlert } from '@/components/AppAlert';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import {
  DownloadOptions, DownloadSource, prepareDownload, releaseDownloadOptions, startDownload,
} from '@/utils/downloads';
import { Check, Download, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

export function DownloadSheet({ source, onClose }: { source: DownloadSource; onClose: () => void }) {
  const [options, setOptions] = useState<DownloadOptions | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [audio, setAudio] = useState(-1);
  const [caption, setCaption] = useState('none');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const tokenRef = useRef('');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    void prepareDownload(source).then((result) => {
      if (cancelled) { releaseDownloadOptions(result.token); return; }
      tokenRef.current = result.token;
      setOptions(result);
      setQuality(result.qualities[0].id);
      setAudio(result.qualities[0].audioIds[0] ?? -1);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load download options.');
    });
    return () => {
      cancelled = true;
      alive.current = false;
      if (tokenRef.current) releaseDownloadOptions(tokenRef.current);
    };
  }, [source]);

  const selected = options?.qualities.find((item) => item.id === quality);
  const audioTracks = options?.audio.filter((track) => selected?.audioIds.includes(track.id)) ?? [];
  const captions = options?.captions.filter((track) => track.id.startsWith('external:') || selected?.captionIds.includes(Number(track.id.slice(4)))) ?? [];

  const begin = async () => {
    if (!options || quality === null || starting) return;
    setStarting(true);
    try {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      await startDownload({ token: options.token, quality, audio, caption });
      if (!alive.current) return;
      onClose();
      AppAlert.alert('Download queued', 'You can keep watching. Find progress and offline videos in More → Downloads.');
    } catch (reason) {
      if (!alive.current) return;
      setError(reason instanceof Error ? reason.message : 'Could not start download. Open Download again to retry.');
      setStarting(false);
    }
  };

  const option = (label: string, checked: boolean, onPress: () => void, key: string) => (
    <TouchableOpacity key={key} style={[styles.option, checked && styles.selected]} onPress={onPress}
      accessibilityRole="radio" accessibilityState={{ checked, disabled: starting }} disabled={starting} activeOpacity={0.85}>
      <Text style={styles.optionText}>{label}</Text>
      {checked && <Check size={14} color={Colors.accent} />}
    </TouchableOpacity>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { if (!starting) onClose(); }} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Save offline</Text>
              <Text style={styles.subtitle} numberOfLines={2}>{source.title}</Text>
            </View>
            <TouchableOpacity style={styles.close} onPress={onClose} disabled={starting} accessibilityRole="button" accessibilityLabel="Close download options">
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {!options && !error ? <View style={styles.loading}><ActivityIndicator color={Colors.accent} /><Text style={styles.hint}>Reading available tracks…</Text></View> : null}
            {options && !error && (
              <>
                <Text style={styles.label}>Resolution</Text>
                <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Download resolution">
                  {options.qualities.map((item) => option(item.label, quality === item.id, () => {
                    setQuality(item.id); setAudio(item.audioIds[0] ?? -1); setCaption('none');
                  }, String(item.id)))}
                </View>
                <Text style={styles.label}>Audio</Text>
                <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Download audio">
                  {audioTracks.length ? audioTracks.map((track) => option(track.label, audio === track.id, () => setAudio(track.id), String(track.id)))
                    : option('Original audio', true, () => {}, 'original')}
                </View>
                <Text style={styles.label}>Captions</Text>
                <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Download captions">
                  {option('None', caption === 'none', () => setCaption('none'), 'none')}
                  {captions.map((track) => option(track.label, caption === track.id, () => setCaption(track.id), track.id))}
                </View>
                <Text style={styles.hint}>Only the selected tracks are saved. Videos stay inside Yummy and can be played without a connection after download completes.</Text>
              </>
            )}
            {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
          </ScrollView>
          {options && !error ? (
            <TouchableOpacity style={[styles.primary, starting && styles.disabled]} onPress={() => void begin()} disabled={starting} activeOpacity={0.85}
              accessibilityRole="button" accessibilityState={{ busy: starting, disabled: starting }}>
              {starting ? <ActivityIndicator color={Colors.background} /> : <Download size={18} color={Colors.background} />}
              <Text style={styles.primaryText}>{starting ? 'Starting download…' : 'Download video'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '90%', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 18 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.text },
  subtitle: { fontSize: 12, lineHeight: 18, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, marginTop: 6 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 12 },
  loading: { paddingVertical: 24, gap: 12, alignItems: 'center' },
  label: { fontSize: 11, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.textSecondary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  option: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', gap: 8, alignItems: 'center' },
  selected: { borderColor: Colors.accent, backgroundColor: Colors.background },
  optionText: { fontSize: 12, fontFamily: Fonts.GeistMono.Medium, color: Colors.text, flexShrink: 1 },
  hint: { fontSize: 11, lineHeight: 18, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary },
  error: { fontSize: 12, lineHeight: 20, fontFamily: Fonts.GeistMono.Regular, color: Colors.text, paddingVertical: 16 },
  primary: { minHeight: 48, backgroundColor: Colors.text, borderRadius: 8, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 13, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.background },
  disabled: { opacity: 0.4 },
});
