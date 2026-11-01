import { AppAlert } from '@/components/AppAlert';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useTMDB } from '@/hooks/useTMDB';
import {
  controlDownload, downloadsAvailable, formatDownloadBytes, listDownloads, OfflineDownload, requestDownloadPoster,
} from '@/utils/downloads';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Download, Film, Pause, Play, RefreshCw, Trash2 } from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PILL_LABEL: Record<OfflineDownload['state'], string> = {
  queued: 'Queued', downloading: 'Downloading', waiting: 'Waiting', paused: 'Paused',
  completed: 'Ready', failed: 'Failed', removing: 'Removing…',
};
const FILTERS = [{ id: 'all', label: 'All' }, { id: 'active', label: 'In progress' }, { id: 'ready', label: 'Ready' }] as const;
type Filter = typeof FILTERS[number]['id'];

const showTitleOf = (item: OfflineDownload) =>
  item.showTitle?.trim() || item.title.split(' · ')[0]?.trim() || item.title || 'TV show';

interface SeasonGroup { season: number; items: OfflineDownload[] }
interface ShowGroup {
  key: string;
  title: string;
  lead: OfflineDownload;
  items: OfflineDownload[];
  seasons: SeasonGroup[];
  bytes: number;
  ready: number;
  notReady: number;
  active: number;
  latest: number;
}

const groupShows = (items: OfflineDownload[]): ShowGroup[] => {
  const byShow = new Map<string, OfflineDownload[]>();
  for (const item of items) {
    const title = showTitleOf(item);
    const list = byShow.get(title);
    if (list) list.push(item); else byShow.set(title, [item]);
  }
  const groups: ShowGroup[] = [];
  for (const [title, list] of byShow) {
    const bySeason = new Map<number, OfflineDownload[]>();
    for (const item of list) {
      const season = item.season && item.season > 0 ? item.season : 0;
      const episodes = bySeason.get(season);
      if (episodes) episodes.push(item); else bySeason.set(season, [item]);
    }
    const seasons: SeasonGroup[] = Array.from(bySeason.entries())
      .map(([season, episodes]) => ({
        season,
        items: episodes.slice().sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0) || a.createdAt - b.createdAt),
      }))
      .sort((a, b) => a.season - b.season);
    const lead = list.slice().sort((a, b) => a.createdAt - b.createdAt)[0];
    groups.push({
      key: `${lead.tmdbId && lead.tmdbId > 0 ? lead.tmdbId : 'show'}:${title}`,
      title,
      lead,
      items: list,
      seasons,
      bytes: list.reduce((total, item) => total + item.bytes, 0),
      ready: list.filter((item) => item.state === 'completed').length,
      notReady: list.filter((item) => item.state !== 'completed').length,
      active: list.filter((item) => item.state === 'downloading' || item.state === 'waiting' || item.state === 'queued').length,
      latest: Math.max(...list.map((item) => item.createdAt)),
    });
  }
  return groups.sort((a, b) => b.latest - a.latest);
};

const DownloadPoster = memo(function DownloadPoster({ id, uri, tmdbId, mediaType, hasPosterSource }: {
  id: string; uri?: string; tmdbId?: number; mediaType?: 'movie' | 'tv'; hasPosterSource?: boolean;
}) {
  const { fetchDetails } = useTMDB();
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);
  useEffect(() => {
    if (uri) return;
    if (hasPosterSource) { void requestDownloadPoster(id, '').catch(() => {}); return; }
    if (!tmdbId || !mediaType) return;
    let cancelled = false;
    void fetchDetails(tmdbId, mediaType).then((details) => {
      if (!cancelled && details?.poster_path) {
        return requestDownloadPoster(id, `https://image.tmdb.org/t/p/w342${details.poster_path}`);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [id, uri, tmdbId, mediaType, hasPosterSource, fetchDetails]);
  return (
    <View style={styles.poster}>
      {uri && !failed ? <Image source={{ uri }} style={styles.posterImage} resizeMode="cover" onError={() => setFailed(true)} />
        : <Film size={26} color={Colors.textSecondary} />}
    </View>
  );
});

const StatusPill = ({ item }: { item: OfflineDownload }) => {
  const complete = item.state === 'completed';
  const failed = item.state === 'failed';
  const active = item.state === 'downloading' || item.state === 'queued';
  return (
    <View style={[
      styles.pill,
      complete && styles.pillReady,
      active && styles.pillActive,
      failed && styles.pillFailed,
    ]}>
      {complete ? <Check size={9} color={Colors.background} strokeWidth={3} /> : null}
      <Text style={[styles.pillText, complete && styles.pillTextReady, failed && styles.pillTextFailed]}>
        {PILL_LABEL[item.state]}
      </Text>
    </View>
  );
};

const durationLabel = (milliseconds: number) => {
  const minutes = Math.round(milliseconds / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
};

const metaLine = (item: OfflineDownload) => {
  const parts = [item.quality];
  if (item.durationMs > 0) parts.push(durationLabel(item.durationMs));
  parts.push(formatDownloadBytes(item.bytes));
  if (item.state !== 'completed' && item.percent > 0) parts.push(`${Math.floor(item.percent)}%`);
  return parts.filter(Boolean).join(' · ');
};

const trackLine = (item: OfflineDownload) =>
  `${item.audio}${item.caption === 'None' ? '' : ` · CC ${item.caption}`}`;

type Entry =
  | { kind: 'label'; label: string }
  | { kind: 'movie'; item: OfflineDownload }
  | { kind: 'show'; show: ShowGroup };

const seasonLabel = (season: number) => (season > 0 ? `Season ${season}` : 'Episodes');

export default function DownloadsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<OfflineDownload[]>([]);
  const [loading, setLoading] = useState(downloadsAvailable);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [groupBusy, setGroupBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [openShows, setOpenShows] = useState<Set<string>>(new Set());
  const [openSeasons, setOpenSeasons] = useState<Set<string>>(new Set());
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const revealedShows = useRef<Set<string>>(new Set());

  useFocusEffect(useCallback(() => {
    if (!downloadsAvailable) return;
    let cancelled = false;
    let polling = false;
    const refresh = async () => {
      if (polling) return;
      polling = true;
      try {
        const result = await listDownloads();
        if (!cancelled) { setItems(result); setError(''); }
      } catch {
        if (!cancelled) setError('Could not load downloads. Tap to retry.');
      } finally {
        polling = false;
        if (!cancelled) setLoading(false);
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const timer = setInterval(() => void refresh(), 1_000);
    return () => { cancelled = true; clearInterval(timer); refreshRef.current = async () => {}; };
  }, []));

  // Reveal new shows as they appear, so fresh download progress is visible
  // without extra taps. A revealed show is never forced open again.
  useEffect(() => {
    const pending = groupShows(items.filter((item) => item.mediaType === 'tv'))
      .filter((show) => show.notReady > 0 && !revealedShows.current.has(show.key));
    if (pending.length === 0) return;
    for (const show of pending) revealedShows.current.add(show.key);
    setOpenShows((current) => {
      const next = new Set(current);
      for (const show of pending) next.add(show.key);
      return next;
    });
    setOpenSeasons((current) => {
      const next = new Set(current);
      for (const show of pending) {
        for (const season of show.seasons) {
          if (season.items.some((item) => item.state === 'downloading' || item.state === 'waiting' || item.state === 'queued')) {
            next.add(`${show.key}:S${season.season}`);
          }
        }
        if (show.seasons.length === 1) next.add(`${show.key}:S${show.seasons[0].season}`);
      }
      return next;
    });
  }, [items]);

  const toggleShow = (show: ShowGroup) => {
    const willOpen = !openShows.has(show.key);
    setOpenShows((current) => {
      const next = new Set(current);
      if (next.has(show.key)) next.delete(show.key); else next.add(show.key);
      return next;
    });
    if (willOpen && show.seasons.length === 1) {
      const seasonKey = `${show.key}:S${show.seasons[0].season}`;
      setOpenSeasons((current) => {
        const next = new Set(current);
        next.add(seasonKey);
        return next;
      });
    }
  };
  const toggleSeason = (key: string) => setOpenSeasons((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const act = async (item: OfflineDownload, action: 'pause' | 'resume' | 'remove') => {
    setBusy(item.id);
    try { await controlDownload(item.id, action); await refreshRef.current(); }
    catch { AppAlert.alert('Download not changed', 'Please try again.'); }
    finally { setBusy(null); }
  };
  const actMany = async (key: string, targets: OfflineDownload[], action: 'pause' | 'resume') => {
    if (groupBusy) return;
    setGroupBusy(key);
    try {
      for (const item of targets) {
        try { await controlDownload(item.id, action); } catch { /* keep going */ }
      }
      await refreshRef.current();
    } finally { setGroupBusy(null); }
  };
  const remove = (item: OfflineDownload) => {
    const complete = item.state === 'completed';
    AppAlert.alert(complete ? 'Delete offline video' : 'Cancel download',
      `${complete ? 'Delete' : 'Cancel and remove'} ${item.title}, its tracks, and artwork from this device?`, [
        { text: 'Keep', style: 'cancel' },
        { text: complete ? 'Delete' : 'Cancel download', style: 'destructive', onPress: () => void act(item, 'remove') },
      ]);
  };
  const removeShow = (show: ShowGroup) => {
    AppAlert.alert('Delete show downloads',
      `Remove ${show.items.length} downloaded episode${show.items.length > 1 ? 's' : ''} of ${show.title}, their tracks, and artwork from this device?`, [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete all', style: 'destructive',
          onPress: () => void (async () => {
            for (const item of show.items) {
              try { await controlDownload(item.id, 'remove'); } catch { /* continue with the rest */ }
            }
            await refreshRef.current();
          })(),
        },
      ]);
  };
  const play = (item: OfflineDownload) => router.push({ pathname: '/download-player', params: { id: item.id, title: item.title } });
  const manualRefresh = async () => {
    setRefreshing(true);
    try { await refreshRef.current(); } finally { setRefreshing(false); }
  };

  const readyCount = items.filter((item) => item.state === 'completed').length;
  const activeCount = items.length - readyCount;
  const settleCount = items.filter((item) => item.state === 'paused' || item.state === 'failed').length;
  const filtered = items.filter((item) => filter === 'all' || (filter === 'ready' ? item.state === 'completed' : item.state !== 'completed'));

  const entries: Entry[] = [];
  const movies = filtered.filter((item) => item.mediaType !== 'tv');
  const shows = groupShows(filtered.filter((item) => item.mediaType === 'tv'));
  if (movies.length) {
    entries.push({ kind: 'label', label: `Movies · ${movies.length}` });
    for (const movie of movies) entries.push({ kind: 'movie', item: movie });
  }
  if (shows.length) {
    entries.push({ kind: 'label', label: `TV Shows · ${shows.length}` });
    for (const show of shows) entries.push({ kind: 'show', show });
  }

  const progressValue = (item: OfflineDownload) => ({
    min: 0, max: 100, now: Math.max(0, Math.min(100, Math.floor(item.percent))),
  });

  const renderMovie = (item: OfflineDownload) => {
    const complete = item.state === 'completed';
    const paused = item.state === 'paused' || item.state === 'failed';
    const removing = item.state === 'removing';
    const disabled = busy === item.id || removing;
    return (
      <View style={styles.item}>
        <TouchableOpacity
          style={styles.mediaRow}
          onPress={() => complete ? play(item) : undefined}
          disabled={!complete}
          activeOpacity={0.85}
          accessibilityRole={complete ? 'button' : 'text'}
          accessibilityLabel={`Play ${item.title} offline`}
        >
          <DownloadPoster id={item.id} uri={item.posterUri} tmdbId={item.tmdbId} mediaType={item.mediaType} hasPosterSource={item.hasPosterSource} />
          <View style={styles.itemCopy}>
            <StatusPill item={item} />
            <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.hint} numberOfLines={1}>{metaLine(item)}</Text>
            <Text style={styles.captionMeta} numberOfLines={1}>{trackLine(item)}</Text>
          </View>
        </TouchableOpacity>
        {!complete && !removing && (
          <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={progressValue(item)}>
            <View style={[styles.progressFill, { width: `${progressValue(item).now}%` }]} />
          </View>
        )}
        {item.state === 'failed' && <Text style={styles.hint}>Retry, or delete and download again if the source link expired.</Text>}
        {item.state === 'waiting' && <Text style={styles.hint}>Resumes when connected.</Text>}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.action, complete && styles.playAction, disabled && styles.disabled]} disabled={disabled}
            onPress={() => complete ? play(item) : void act(item, paused ? 'resume' : 'pause')}
            accessibilityRole="button" accessibilityLabel={`${complete ? 'Play offline' : paused ? 'Resume download' : 'Pause download'} ${item.title}`}>
            {disabled ? <ActivityIndicator size="small" color={complete ? Colors.background : Colors.text} />
              : complete ? <Play size={16} color={Colors.background} /> : paused ? <RefreshCw size={16} color={Colors.text} /> : <Pause size={16} color={Colors.text} />}
            <Text style={[styles.actionText, complete && styles.playText]}>{removing ? 'Removing…' : complete ? 'Play offline' : item.state === 'failed' ? 'Retry download' : paused ? 'Resume download' : 'Pause download'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.remove, disabled && styles.disabled]} onPress={() => remove(item)} disabled={disabled}
            accessibilityRole="button" accessibilityLabel={`${complete ? 'Delete' : 'Cancel download'} ${item.title}`}>
            <Trash2 size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEpisode = (show: ShowGroup, item: OfflineDownload) => {
    const complete = item.state === 'completed';
    const paused = item.state === 'paused' || item.state === 'failed';
    const removing = item.state === 'removing';
    const disabled = busy === item.id || removing;
    return (
      <View key={item.id} style={styles.episodeRow}>
        <View style={styles.episodeCopy}>
          <View style={styles.episodeTop}>
            <Text style={styles.episodeNumber}>E{item.episode && item.episode > 0 ? item.episode : '?'}</Text>
            <StatusPill item={item} />
          </View>
          <Text style={styles.hint} numberOfLines={1}>{metaLine(item)}</Text>
          <Text style={styles.captionMeta} numberOfLines={1}>{trackLine(item)}</Text>
          {!complete && !removing && (
            <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={progressValue(item)}>
              <View style={[styles.progressFill, { width: `${progressValue(item).now}%` }]} />
            </View>
          )}
        </View>
        <View style={styles.episodeActions}>
          <TouchableOpacity style={[styles.episodeButton, complete && styles.episodePlay, disabled && styles.disabled]} disabled={disabled}
            onPress={() => complete ? play(item) : void act(item, paused ? 'resume' : 'pause')}
            accessibilityRole="button" accessibilityLabel={`${complete ? 'Play offline' : paused ? 'Resume download' : 'Pause download'} ${item.title}`}>
            {disabled ? <ActivityIndicator size="small" color={complete ? Colors.background : Colors.text} />
              : complete ? <Play size={16} color={Colors.background} />
                : paused ? <RefreshCw size={16} color={Colors.text} /> : <Pause size={16} color={Colors.text} />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.episodeButton, disabled && styles.disabled]} disabled={disabled} onPress={() => remove(item)}
            accessibilityRole="button" accessibilityLabel={`${complete ? 'Delete' : 'Cancel download'} ${item.title}`}>
            <Trash2 size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderShow = (show: ShowGroup) => {
    const expanded = openShows.has(show.key);
    const readyEpisodes = show.items.filter((item) => item.state === 'completed')
      .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0));
    const firstReady = readyEpisodes[0];
    const showBusy = groupBusy === show.key;
    const inlineAction = firstReady
      ? { label: `Play offline ${show.title}`, icon: <Play size={17} color={Colors.background} />, primary: true, onPress: () => play(firstReady) }
      : show.active > 0
        ? { label: `Pause downloads ${show.title}`, icon: <Pause size={17} color={Colors.text} />, primary: false,
            onPress: () => void actMany(show.key, show.items.filter((item) => item.state !== 'completed' && item.state !== 'removing'), 'pause') }
        : { label: `Resume downloads ${show.title}`, icon: <RefreshCw size={16} color={Colors.text} />, primary: false,
            onPress: () => void actMany(show.key, show.items.filter((item) => item.state === 'paused' || item.state === 'failed'), 'resume') };
    return (
      <View style={styles.item}>
        <View style={styles.mediaRow}>
          <TouchableOpacity style={styles.showToggle} onPress={() => toggleShow(show)} activeOpacity={0.85}
            accessibilityRole="button" accessibilityLabel={`Downloaded episodes of ${show.title}`}
            accessibilityState={{ expanded }}>
            <DownloadPoster id={show.lead.id} uri={show.lead.posterUri} tmdbId={show.lead.tmdbId} mediaType="tv" hasPosterSource={show.lead.hasPosterSource} />
            <View style={styles.itemCopy}>
              <View style={styles.pillRow}>
                <View style={[styles.pill, show.notReady === 0 && styles.pillReady, show.notReady > 0 && styles.pillActive]}>
                  {show.notReady === 0 ? <Check size={9} color={Colors.background} strokeWidth={3} /> : <Download size={9} color={Colors.text} />}
                  <Text style={[styles.pillText, show.notReady === 0 && styles.pillTextReady]}>
                    {show.notReady === 0 ? 'Ready' : `${show.ready} of ${show.items.length} ready`}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemTitle} numberOfLines={2}>{show.title}</Text>
              <Text style={styles.hint} numberOfLines={1}>
                {show.seasons.length > 1 ? `${show.seasons.length} seasons · ` : ''}
                {show.items.length} episode{show.items.length > 1 ? 's' : ''} · {formatDownloadBytes(show.bytes)}
              </Text>
            </View>
            {expanded ? <ChevronUp size={18} color={Colors.textSecondary} /> : <ChevronDown size={18} color={Colors.textSecondary} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.showInlineAction, inlineAction.primary && styles.showInlinePlay, showBusy && styles.disabled]}
            onPress={inlineAction.onPress}
            disabled={showBusy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={inlineAction.label}
            accessibilityState={{ disabled: showBusy }}
          >
            {showBusy ? <ActivityIndicator size="small" color={inlineAction.primary ? Colors.background : Colors.text} /> : inlineAction.icon}
          </TouchableOpacity>
        </View>
        {expanded && (
          <View style={styles.showBody}>
            {show.seasons.map((seasonGroup) => {
              const seasonKey = `${show.key}:S${seasonGroup.season}`;
              const seasonOpen = openSeasons.has(seasonKey);
              const seasonReady = seasonGroup.items.filter((item) => item.state === 'completed').length;
              const seasonBytes = seasonGroup.items.reduce((total, item) => total + item.bytes, 0);
              return (
                <View key={seasonKey} style={styles.seasonBlock}>
                  <TouchableOpacity style={styles.seasonHeader} onPress={() => toggleSeason(seasonKey)} activeOpacity={0.85}
                    accessibilityRole="button" accessibilityLabel={`${seasonLabel(seasonGroup.season)} of ${show.title}`}
                    accessibilityState={{ expanded: seasonOpen }}>
                    <View style={styles.seasonInfo}>
                      <Text style={styles.seasonTitle}>{seasonLabel(seasonGroup.season)}</Text>
                      <Text style={styles.hint}>{seasonGroup.items.length} episode{seasonGroup.items.length > 1 ? 's' : ''} · {seasonReady} ready · {formatDownloadBytes(seasonBytes)}</Text>
                    </View>
                    {seasonOpen ? <ChevronUp size={16} color={Colors.textSecondary} /> : <ChevronDown size={16} color={Colors.textSecondary} />}
                  </TouchableOpacity>
                  {seasonOpen && seasonGroup.items.map((item) => renderEpisode(show, item))}
                </View>
              );
            })}
            <TouchableOpacity style={styles.showFooterButton} onPress={() => removeShow(show)} activeOpacity={0.85}
              accessibilityRole="button" accessibilityLabel={`Delete all downloaded episodes of ${show.title}`}>
              <Trash2 size={15} color={Colors.textSecondary} />
              <Text style={styles.showFooterText}>Delete show</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const globalAction = activeCount > 0
    ? { label: 'Pause all downloads', icon: <Pause size={14} color={Colors.text} />,
        onPress: () => void actMany('all', items.filter((item) => item.state !== 'completed' && item.state !== 'removing'), 'pause') }
    : settleCount > 0
      ? { label: 'Resume all downloads', icon: <RefreshCw size={14} color={Colors.text} />,
          onPress: () => void actMany('all', items.filter((item) => item.state === 'paused' || item.state === 'failed'), 'resume') }
      : null;

  return (
    <ScreenContainer style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/more')}
          accessibilityRole="button" accessibilityLabel="Go back"><ArrowLeft size={20} color={Colors.text} /></TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Downloads</Text>
          <Text style={styles.hint}>{items.length ? `${readyCount} ready · ${formatDownloadBytes(items.reduce((total, item) => total + item.bytes, 0))} saved` : 'Your offline library'}</Text>
        </View>
      </View>
      {items.length > 0 && (
        <View style={styles.filters} accessibilityRole="tablist">
          {FILTERS.map((tab) => {
            const count = tab.id === 'all' ? items.length : tab.id === 'ready' ? readyCount : activeCount;
            return <TouchableOpacity key={tab.id} style={[styles.filter, filter === tab.id && styles.filterSelected]}
              onPress={() => setFilter(tab.id)} accessibilityRole="tab" accessibilityState={{ selected: filter === tab.id }} activeOpacity={0.85}>
              <Text style={[styles.filterText, filter === tab.id && styles.filterTextSelected]}>{tab.label} · {count}</Text>
            </TouchableOpacity>;
          })}
          {globalAction && (
            <TouchableOpacity style={[styles.filter, styles.filterAction]} onPress={globalAction.onPress}
              disabled={groupBusy === 'all'} activeOpacity={0.85}
              accessibilityRole="button" accessibilityLabel={globalAction.label} accessibilityState={{ disabled: groupBusy === 'all' }}>
              {groupBusy === 'all' ? <ActivityIndicator size="small" color={Colors.text} /> : globalAction.icon}
              <Text style={[styles.filterText, styles.filterTextSelected]}>{activeCount > 0 ? 'Pause all' : 'Resume all'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {error && <TouchableOpacity style={styles.error} onPress={() => void manualRefresh()} accessibilityRole="button" accessibilityLabel="Retry loading downloads">
        <RefreshCw size={16} color={Colors.textSecondary} /><Text style={styles.hint}>{error}</Text>
      </TouchableOpacity>}
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.kind === 'label' ? `label:${entry.label}` : entry.kind === 'movie' ? entry.item.id : entry.show.key}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }, !entries.length && styles.emptyList]}
        refreshControl={downloadsAvailable ? (
          <RefreshControl refreshing={refreshing} onRefresh={() => void manualRefresh()} tintColor={Colors.accent} colors={[Colors.accent]} progressBackgroundColor={Colors.surface} />
        ) : undefined}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>{loading ? <ActivityIndicator size="large" color={Colors.accent} /> : <Download size={30} color={Colors.textSecondary} />}</View>
            <Text style={styles.emptyTitle}>{loading ? 'Loading downloads…' : !downloadsAvailable ? 'Android downloads' : items.length ? filter === 'ready' ? 'Nothing ready yet' : 'All caught up' : 'A little cinema, offline'}</Text>
            <Text style={styles.emptyText}>{!downloadsAvailable ? 'Offline downloads are available in the Android build of Yummy.'
              : items.length ? filter === 'ready' ? 'Completed videos will appear here, ready to play without a connection.' : 'Your saved videos are waiting under All.'
                : 'Tap the download icon beside Watch Now or on an episode to choose quality, audio, and captions. Use Catalog Service as your source.'}</Text>
            {items.length > 0 && <TouchableOpacity style={styles.emptyAction} onPress={() => setFilter('all')} accessibilityRole="button"><Text style={styles.actionText}>View all downloads</Text></TouchableOpacity>}
          </View>
        }
        renderItem={({ item: entry }) => {
          if (entry.kind === 'label') {
            return <Text style={styles.sectionLabel}>{entry.label}</Text>;
          }
          if (entry.kind === 'movie') return renderMovie(entry.item);
          return renderShow(entry.show);
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerCopy: { flex: 1, gap: 5 },
  title: { fontSize: 24, fontFamily: Fonts.GeistMono.Bold, color: Colors.text },
  iconButton: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 11, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, lineHeight: 18 },
  captionMeta: { fontSize: 10, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, lineHeight: 17, flexShrink: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 20 },
  filter: { minHeight: 44, paddingHorizontal: 11, paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterSelected: { borderColor: Colors.accent },
  filterAction: { borderColor: Colors.accent },
  filterText: { fontSize: 11, fontFamily: Fonts.GeistMono.Medium, color: Colors.textSecondary },
  filterTextSelected: { color: Colors.text },
  content: { paddingHorizontal: 16 },
  emptyList: { flexGrow: 1 },
  empty: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  emptyIcon: { width: 64, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, marginBottom: 6 },
  emptyTitle: { fontSize: 17, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.text, textAlign: 'center' },
  emptyText: { fontSize: 12, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, lineHeight: 21, textAlign: 'center' },
  emptyAction: { minHeight: 44, padding: 12, justifyContent: 'center' },
  sectionLabel: { fontSize: 13, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.textSecondary, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4, marginBottom: 12 },
  item: { backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 14, gap: 12 },
  mediaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  showToggle: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12, minWidth: 0 },
  poster: { width: 76, height: 114, borderRadius: 6, backgroundColor: Colors.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  posterImage: { width: '100%', height: '100%' },
  itemCopy: { flex: 1, minWidth: 0, gap: 4 },
  itemTitle: { fontSize: 14, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.text, lineHeight: 21 },
  pillRow: { flexDirection: 'row' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, paddingHorizontal: 7, paddingVertical: 3 },
  pillReady: { backgroundColor: Colors.text, borderColor: Colors.text },
  pillActive: { borderColor: Colors.accent },
  pillFailed: { borderColor: Colors.accent, backgroundColor: `${Colors.accent}15` },
  pillText: { fontSize: 9, fontFamily: Fonts.GeistMono.Bold, color: Colors.textSecondary, letterSpacing: 0.5 },
  pillTextReady: { color: Colors.background },
  pillTextFailed: { color: Colors.accent },
  progress: { height: 3, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: Colors.accent },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  action: { flex: 1, flexDirection: 'row', minHeight: 44, gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  playAction: { backgroundColor: Colors.text, borderColor: Colors.text },
  actionText: { fontSize: 12, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.text, flexShrink: 1 },
  playText: { color: Colors.background },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 8 },
  showInlineAction: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  showInlinePlay: { backgroundColor: Colors.text, borderColor: Colors.text },
  showBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, paddingTop: 6, gap: 4 },
  seasonBlock: { marginBottom: 4 },
  seasonHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 8 },
  seasonInfo: { flex: 1, minWidth: 0, gap: 2 },
  seasonTitle: { fontSize: 13, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.text },
  episodeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, paddingLeft: 12, paddingRight: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  episodeCopy: { flex: 1, minWidth: 0, gap: 4 },
  episodeTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  episodeNumber: { fontSize: 12, fontFamily: Fonts.GeistMono.Bold, color: Colors.accent },
  episodeActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  episodeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 8 },
  episodePlay: { backgroundColor: Colors.text, borderColor: Colors.text },
  showFooterButton: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  showFooterText: { fontSize: 12, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.textSecondary },
  disabled: { opacity: 0.4 },
  error: { marginHorizontal: 16, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
