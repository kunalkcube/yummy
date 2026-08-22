import { AppAlert } from '@/components/AppAlert';
import { CONTENT_MAX_WIDTH, ScreenContainer } from '@/components/layout/ScreenContainer';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import {
  formatRelativeWatchedAt,
  historyCaption,
  LibraryMediaType,
  WatchHistoryItem,
} from '@/constants/library';
import { useLibrary } from '@/contexts/LibraryContext';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Clock, Film, Trash2, Tv, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Filter = 'all' | LibraryMediaType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV' },
];

const backdropUri = (item: WatchHistoryItem) =>
  item.backdropPath
    ? `https://image.tmdb.org/t/p/w1280${item.backdropPath}`
    : item.posterPath
      ? `https://image.tmdb.org/t/p/w780${item.posterPath}`
      : null;

const posterUri = (item: WatchHistoryItem) =>
  item.posterPath ? `https://image.tmdb.org/t/p/w342${item.posterPath}` : null;

export default function WatchHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isDesktop = useIsDesktop();
  const { watchHistory, removeFromHistory, clearWatchHistory } = useLibrary();
  const [filter, setFilter] = useState<Filter>('all');

  const contentWidth = isDesktop ? Math.min(width, CONTENT_MAX_WIDTH) : width;
  const heroHeight = isDesktop ? Math.min(height * 0.36, 320) : height * 0.36;
  const columns = isDesktop ? 2 : 1;
  const cardGap = 10;
  const cardPad = 16;
  const cardHeight = isDesktop ? 148 : Math.min(140, width * 0.36);
  const cardWidth =
    columns > 1 ? (contentWidth - cardPad * 2 - cardGap) / 2 : contentWidth - cardPad * 2;

  const filtered = useMemo(
    () =>
      filter === 'all' ? watchHistory : watchHistory.filter((item) => item.type === filter),
    [filter, watchHistory]
  );

  const featured = filtered[0] ?? null;
  const featuredBackdrop = featured ? backdropUri(featured) : null;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const openDetails = (item: WatchHistoryItem) => {
    router.push({
      pathname: '/details',
      params: { id: item.id, type: item.type },
    });
  };

  const confirmRemove = (item: WatchHistoryItem) => {
    AppAlert.alert('Remove from history', `Remove ${item.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removeFromHistory(item.id, item.type),
      },
    ]);
  };

  const confirmClear = () => {
    AppAlert.alert('Clear watch history', 'Remove all titles from history? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => void clearWatchHistory(),
      },
    ]);
  };

  const renderItem = ({ item, index }: { item: WatchHistoryItem; index: number }) => {
    const image = backdropUri(item);
    const poster = posterUri(item);
    const caption = historyCaption(item);
    const TypeIcon = item.type === 'tv' ? Tv : Film;
    const when = formatRelativeWatchedAt(item.watchedAt);
    const metaParts = [caption, when].filter(Boolean);

    return (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(280)}
        style={[
          { width: cardWidth, marginBottom: columns === 1 ? 10 : 0 },
          columns === 1 && styles.cardSingleWrap,
        ]}
      >
        <TouchableOpacity
          style={[styles.card, { height: cardHeight }]}
          onPress={() => openDetails(item)}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${metaParts.join(', ')}`}
        >
          {image ? (
            <Image source={{ uri: image }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={[styles.cardImage, styles.cardImageFallback]}>
              <TypeIcon size={28} color={Colors.textSecondary} />
            </View>
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.82)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.2)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.cardGradient}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.cardGradientBottom}
          />

          {poster ? (
            <View style={styles.cardPosterWrap}>
              <Image source={{ uri: poster }} style={styles.cardPoster} resizeMode="cover" />
            </View>
          ) : null}

          <View style={[styles.cardBody, !poster && styles.cardBodyNoPoster]}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {metaParts.length > 0 ? (
              <Text style={styles.cardMeta} numberOfLines={1}>
                {metaParts.join('  ·  ')}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.removeChip}
            onPress={() => confirmRemove(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Remove ${item.title} from history`}
          >
            <X size={14} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const listHeader = (
    <>
      <View style={[styles.heroContainer, { height: heroHeight }]}>
        {featuredBackdrop ? (
          <Image source={{ uri: featuredBackdrop }} style={styles.backdrop} resizeMode="cover" />
        ) : (
          <View style={[styles.backdrop, styles.placeholderBackdrop]}>
            <Clock size={48} color={Colors.textSecondary} />
          </View>
        )}

        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.55)', Colors.background]}
          locations={[0, 0.28, 0.68, 1]}
          style={styles.heroGradient}
          pointerEvents="none"
        />

        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={goBack}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color="#fff" />
        </TouchableOpacity>

        {watchHistory.length > 0 ? (
          <TouchableOpacity
            style={[styles.clearButton, { top: insets.top + 8 }]}
            onPress={confirmClear}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Clear watch history"
          >
            <Trash2 size={18} color="#fff" />
          </TouchableOpacity>
        ) : null}

        <View style={styles.heroContent} pointerEvents="none">
          <Text style={styles.heroTitle}>Watch History</Text>
          {featured ? (
            <Text style={styles.heroCurrent} numberOfLines={1}>
              {featured.title}
              {historyCaption(featured) ? `  ·  ${historyCaption(featured)}` : ''}
            </Text>
          ) : null}
          {filtered.length > 0 ? (
            <Text style={styles.heroCount}>
              {filtered.length} title{filtered.length === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
      </View>

      {watchHistory.length > 0 ? (
        <View style={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(item.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {filtered.length > 0 ? (
        <Text style={styles.sectionLabel}>Your trail</Text>
      ) : null}
    </>
  );

  return (
    <ScreenContainer style={styles.container}>
      <FlatList
        key={`${filter}-${columns}`}
        data={filtered}
        keyExtractor={(item) => `${item.type}-${item.id}-${item.watchedAt}`}
        renderItem={renderItem}
        numColumns={columns}
        ListHeaderComponent={listHeader}
        columnWrapperStyle={
          columns > 1 && filtered.length > 0
            ? [styles.columnRow, { gap: cardGap, paddingHorizontal: cardPad }]
            : undefined
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 28, maxWidth: contentWidth, width: '100%' },
          filtered.length === 0 && watchHistory.length === 0 && styles.listEmpty,
        ]}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          watchHistory.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Clock size={28} color={Colors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyHint}>
                Play a movie or episode and it shows up as your trail.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyFilter}>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptyHint}>Try another filter.</Text>
            </View>
          )
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    flex: 1,
  },
  listContent: {
    alignSelf: 'center',
    flexGrow: 1,
  },
  listEmpty: {
    flexGrow: 1,
  },
  heroContainer: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    marginBottom: 4,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  placeholderBackdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  heroGradient: {
    ...StyleSheet.absoluteFill,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  clearButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  heroContent: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: Fonts.GeistMono.Bold,
    color: '#fff',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroCurrent: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: 'rgba(255,255,255,0.9)',
  },
  heroCount: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Medium,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.card,
  },
  filterText: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  filterTextActive: {
    color: Colors.text,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  columnRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  cardSingleWrap: {
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  cardImage: {
    ...StyleSheet.absoluteFill,
  },
  cardImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  cardGradient: {
    ...StyleSheet.absoluteFill,
  },
  cardGradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  cardPosterWrap: {
    position: 'absolute',
    left: 12,
    top: 12,
    bottom: 12,
    width: 78,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cardPoster: {
    width: '100%',
    height: '100%',
  },
  cardBody: {
    position: 'absolute',
    left: 104,
    right: 44,
    bottom: 14,
    top: 14,
    justifyContent: 'flex-end',
  },
  cardBodyNoPoster: {
    left: 16,
    right: 44,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: '#fff',
    lineHeight: 20,
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardMeta: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.2,
  },
  removeChip: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 48,
    gap: 10,
  },
  emptyFilter: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 32,
    gap: 8,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
