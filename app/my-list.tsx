import { AppAlert } from '@/components/AppAlert';
import { CONTENT_MAX_WIDTH, ScreenContainer } from '@/components/layout/ScreenContainer';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { LibraryMediaType, WatchlistItem } from '@/constants/library';
import { useLibrary } from '@/contexts/LibraryContext';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bookmark, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Filter = 'all' | LibraryMediaType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV' },
];

const HERO_INTERVAL_MS = 4500;

const heroImageUri = (item: WatchlistItem) =>
  item.backdropPath
    ? `https://image.tmdb.org/t/p/w1280${item.backdropPath}`
    : item.posterPath
      ? `https://image.tmdb.org/t/p/w780${item.posterPath}`
      : null;

export default function MyListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isDesktop = useIsDesktop();
  const { watchlist, toggleWatchlist } = useLibrary();
  const [filter, setFilter] = useState<Filter>('all');
  const [heroIndex, setHeroIndex] = useState(0);
  const heroListRef = useRef<FlatList<WatchlistItem>>(null);

  const columns = isDesktop ? 4 : 3;
  const gap = 8;
  const pad = 16;
  const contentWidth = isDesktop ? Math.min(width, CONTENT_MAX_WIDTH) : width;
  const tileWidth = (contentWidth - pad * 2 - gap * (columns - 1)) / columns;
  const tileHeight = tileWidth * 1.5;
  const heroHeight = isDesktop ? Math.min(height * 0.36, 320) : height * 0.36;

  const filtered = useMemo(
    () => (filter === 'all' ? watchlist : watchlist.filter((item) => item.type === filter)),
    [filter, watchlist]
  );

  const heroSlides = useMemo(
    () => filtered.filter((item) => heroImageUri(item) != null),
    [filtered]
  );

  const currentHero = heroSlides[heroIndex] ?? heroSlides[0] ?? null;

  useEffect(() => {
    setHeroIndex(0);
    heroListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filter, watchlist.length]);

  useEffect(() => {
    if (heroSlides.length <= 1) return;

    const timer = setInterval(() => {
      setHeroIndex((prev) => {
        const next = (prev + 1) % heroSlides.length;
        heroListRef.current?.scrollToOffset({
          offset: next * contentWidth,
          animated: true,
        });
        return next;
      });
    }, HERO_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [heroSlides.length, contentWidth]);

  const onHeroScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / contentWidth);
    if (index >= 0 && index < heroSlides.length) {
      setHeroIndex(index);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const openDetails = (item: WatchlistItem) => {
    router.push({
      pathname: '/details',
      params: { id: item.id, type: item.type },
    });
  };

  const confirmRemove = (item: WatchlistItem) => {
    AppAlert.alert('Remove from My List', `Remove ${item.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void toggleWatchlist({
            id: item.id,
            type: item.type,
            title: item.title,
            posterPath: item.posterPath,
            backdropPath: item.backdropPath,
          });
        },
      },
    ]);
  };

  const renderItem = ({ item, index }: { item: WatchlistItem; index: number }) => {
    const posterUrl = item.posterPath
      ? `https://image.tmdb.org/t/p/w500${item.posterPath}`
      : 'https://via.placeholder.com/500x750?text=No+Image';

    return (
      <View
        style={[
          styles.tile,
          {
            width: tileWidth,
            height: tileHeight,
            marginRight: (index + 1) % columns === 0 ? 0 : gap,
            marginBottom: gap,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.tilePress}
          onPress={() => openDetails(item)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={item.title}
        >
          <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={styles.tileGradient}
          />
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.type === 'tv' ? 'TV' : 'MOVIE'}</Text>
          </View>
          <View style={styles.tileInfo}>
            <Text style={styles.tileTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeChip}
          onPress={() => confirmRemove(item)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.title}`}
        >
          <X size={14} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    );
  };

  const listHeader = (
    <>
      <View style={[styles.heroContainer, { height: heroHeight }]}>
        {heroSlides.length > 0 ? (
          <FlatList
            ref={heroListRef}
            data={heroSlides}
            keyExtractor={(item) => `hero-${item.type}-${item.id}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onHeroScrollEnd}
            getItemLayout={(_, index) => ({
              length: contentWidth,
              offset: contentWidth * index,
              index,
            })}
            renderItem={({ item }) => {
              const uri = heroImageUri(item)!;
              return (
                <View style={{ width: contentWidth, height: heroHeight }}>
                  <Image source={{ uri }} style={styles.backdrop} resizeMode="cover" />
                </View>
              );
            }}
          />
        ) : (
          <View style={[styles.backdrop, styles.placeholderBackdrop]}>
            <Bookmark size={48} color={Colors.textSecondary} />
          </View>
        )}

        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.55)', Colors.background]}
          locations={[0, 0.25, 0.65, 1]}
          style={[styles.heroGradient, { pointerEvents: 'none' }]}
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

        <View style={[styles.heroContent, { pointerEvents: 'none' }]}>
          <Text style={styles.heroTitle}>My List</Text>
          {currentHero && (
            <Text style={styles.heroCurrent} numberOfLines={1}>
              {currentHero.title}
            </Text>
          )}
          {watchlist.length > 0 && (
            <Text style={styles.heroCount}>
              {watchlist.length} title{watchlist.length === 1 ? '' : 's'}
            </Text>
          )}
        </View>
      </View>

      {watchlist.length > 0 && (
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
      )}
    </>
  );

  return (
    <ScreenContainer style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderItem}
        numColumns={columns}
        key={columns}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty]}
        columnWrapperStyle={filtered.length > 0 ? styles.columnRow : undefined}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bookmark size={40} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>
              {watchlist.length === 0 ? 'Your list is empty' : 'No matches'}
            </Text>
            <Text style={styles.emptyText}>
              {watchlist.length === 0
                ? 'Save titles from the details bookmark'
                : 'Try another filter'}
            </Text>
          </View>
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
  heroContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  backdrop: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
  },
  placeholderBackdrop: {
    justifyContent: 'center',
    alignItems: 'center',
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
  list: {
    paddingBottom: 48,
  },
  listEmpty: {
    flexGrow: 1,
  },
  columnRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tile: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  tilePress: {
    flex: 1,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  tileGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontFamily: Fonts.GeistMono.Bold,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.8,
  },
  removeChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tileInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  tileTitle: {
    color: '#fff',
    fontSize: 11,
    fontFamily: Fonts.GeistMono.SemiBold,
    lineHeight: 14,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Bold,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    textAlign: 'center',
    lineHeight: 20,
  },
});
