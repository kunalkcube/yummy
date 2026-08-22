import { ContinueWatchingRow } from '@/components/ContinueWatchingRow';
import { MovieRow } from '@/components/MovieRow';
import { ProviderChips } from '@/components/ProviderChips';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import {
  ContinueWatchingItem,
} from '@/constants/library';
import { STREAMING_PROVIDERS } from '@/constants/providers';
import { useLibrary } from '@/contexts/LibraryContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { Movie, useTMDB } from '@/hooks/useTMDB';
import { ensureStreamPlaybackReady } from '@/utils/streamPlaybackGate';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { EllipsisVertical, Film, Play, Sparkles, Star, TrendingUp, Tv } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const {
    tmdbApiKey,
    fetchTrending,
    fetchPopular,
    fetchTopRated,
    fetchUpcoming,
  } = useTMDB();
  const { continueWatching, removeContinueWatching, recordContinueWatching } =
    useLibrary();
  const {
    streamDisclaimerAccepted,
    streamProvider,
    streamUrl,
    acceptStreamDisclaimer,
  } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isDesktop = useIsDesktop();
  const heroHeight = isDesktop ? Math.min(height * 0.6, 520) : height * 0.6;
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [trending, setTrending] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [popularTV, setPopularTV] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<Movie[]>([]);
  const [featuredMovie, setFeaturedMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);

  const openMore = () => {
    router.push('/more');
  };

  const openSettings = () => {
    router.push('/settings');
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!tmdbApiKey) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        if (selectedProvider) {
          const [moviesData, tvData] = await Promise.all([
            fetchPopular('movie', selectedProvider),
            fetchPopular('tv', selectedProvider),
          ]);
          if (cancelled) return;
          setTrending([]);
          setPopularMovies(moviesData);
          setPopularTV(tvData);
          setTopRatedMovies([]);
          setUpcomingMovies([]);
          setFeaturedMovie(moviesData[0] || null);
        } else {
          const [trendingData, moviesData, tvData, topRatedData, upcomingData] = await Promise.all([
            fetchTrending(),
            fetchPopular('movie'),
            fetchPopular('tv'),
            fetchTopRated('movie'),
            fetchUpcoming(),
          ]);
          if (cancelled) return;
          setTrending(trendingData);
          setPopularMovies(moviesData);
          setPopularTV(tvData);
          setTopRatedMovies(topRatedData);
          setUpcomingMovies(upcomingData);
          setFeaturedMovie(trendingData[0] || moviesData[0] || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    tmdbApiKey,
    selectedProvider,
    fetchPopular,
    fetchTrending,
    fetchTopRated,
    fetchUpcoming,
  ]);

  const handleProviderSelect = (providerId: number | null) => {
    setSelectedProvider(providerId);
  };

  const getProviderName = () => {
    if (!selectedProvider) return null;
    const provider = STREAMING_PROVIDERS.find((p) => p.id === selectedProvider);
    return provider?.name || 'Provider';
  };

  const handleResume = (item: ContinueWatchingItem) => {
    const params: Record<string, string> = {
      id: String(item.id),
      type: item.type,
      title: item.title,
    };
    if (item.type === 'tv') {
      params.season = String(item.season ?? 1);
      params.episode = String(item.episode ?? 1);
    }

    ensureStreamPlaybackReady({
      streamDisclaimerAccepted,
      streamProvider,
      streamUrl,
      acceptStreamDisclaimer,
      openSettings,
      onReady: () => {
        void recordContinueWatching({
          id: item.id,
          type: item.type,
          title: item.title,
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
          season: item.season,
          episode: item.episode,
          advance: false,
        });
        router.push({
          pathname: '/player',
          params,
        });
      },
    });
  };

  const handleOpenContinueDetails = (item: ContinueWatchingItem) => {
    router.push({
      pathname: '/details',
      params: { id: item.id, type: item.type },
    });
  };

  const handleFeaturedPlay = () => {
    if (!featuredMovie) return;
    const type = (featuredMovie.media_type ||
      (featuredMovie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
    const title = featuredMovie.title || featuredMovie.name || 'Unknown';
    const params: Record<string, string> = {
      id: String(featuredMovie.id),
      type,
      title,
    };
    if (type === 'tv') {
      params.season = '1';
      params.episode = '1';
    }

    ensureStreamPlaybackReady({
      streamDisclaimerAccepted,
      streamProvider,
      streamUrl,
      acceptStreamDisclaimer,
      openSettings,
      onReady: () => {
        void recordContinueWatching({
          id: featuredMovie.id,
          type,
          title,
          posterPath: featuredMovie.poster_path,
          backdropPath: featuredMovie.backdrop_path,
          season: type === 'tv' ? 1 : undefined,
          episode: type === 'tv' ? 1 : undefined,
          advance: type === 'tv',
        });
        router.push({
          pathname: '/player',
          params,
        });
      },
    });
  };

  const heroYear = (featuredMovie?.release_date || featuredMovie?.first_air_date)?.substring(0, 4);
  const heroRating = featuredMovie?.vote_average
    ? featuredMovie.vote_average.toFixed(1)
    : null;
  const heroLabel = selectedProvider ? getProviderName()?.toUpperCase() : 'TRENDING';

  if (!tmdbApiKey) {
    return (
      <ScreenContainer style={styles.container}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.topBarWordmark}>YUMMY</Text>
          <TouchableOpacity
            onPress={openMore}
            style={styles.moreButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Open more"
          >
            <EllipsisVertical size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyLabel}>YUMMY</Text>
          <Text style={styles.emptyText}>
            Add your TMDB API key in Settings to browse movies and TV
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={openSettings}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyCtaText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (loading) {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading content...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {!featuredMovie && (
          <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.topBarWordmark}>YUMMY</Text>
            <TouchableOpacity
              onPress={openMore}
              style={styles.moreButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Open more"
            >
              <EllipsisVertical size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
        )}

        {featuredMovie && (
          <View style={[styles.heroSection, { height: heroHeight }]}>
            <Image
              source={{
                uri: featuredMovie.backdrop_path
                  ? `https://image.tmdb.org/t/p/original${featuredMovie.backdrop_path}`
                  : `https://image.tmdb.org/t/p/w500${featuredMovie.poster_path}`,
              }}
              style={styles.heroImage}
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.55)', Colors.background]}
              locations={[0, 0.28, 0.62, 1]}
              style={styles.heroGradient}
            />

            <View style={[styles.heroTopBar, { top: insets.top + 12 }]}>
              <Text style={styles.wordmark}>YUMMY</Text>
              <TouchableOpacity
                onPress={openMore}
                style={styles.moreButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Open more"
              >
                <EllipsisVertical size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Animated.View
              entering={FadeInDown.duration(250)}
              style={styles.heroContent}
            >
              <View style={styles.heroMetaLine}>
                <Text style={styles.heroMetaText}>{heroLabel}</Text>
                {heroRating && (
                  <>
                    <Text style={styles.heroMetaDot}>·</Text>
                    <View style={styles.heroRating}>
                      <Star size={10} color="#FFD700" fill="#FFD700" />
                      <Text style={styles.heroMetaText}>{heroRating}</Text>
                    </View>
                  </>
                )}
                {heroYear && (
                  <>
                    <Text style={styles.heroMetaDot}>·</Text>
                    <Text style={styles.heroMetaText}>{heroYear}</Text>
                  </>
                )}
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {featuredMovie.title || featuredMovie.name}
              </Text>
              <View style={styles.heroActions}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={handleFeaturedPlay}
                  activeOpacity={0.85}
                >
                  <Play size={18} color="#000" fill="#000" />
                  <Text style={styles.playButtonText}>Play</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        )}

        {continueWatching.length > 0 && (
          <ContinueWatchingRow
            items={continueWatching}
            onResume={handleResume}
            onRemove={(item) => void removeContinueWatching(item.id, item.type)}
            onOpenDetails={handleOpenContinueDetails}
          />
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>
            {selectedProvider ? getProviderName() : 'Browse by service'}
          </Text>
        </View>

        <ProviderChips
          providers={STREAMING_PROVIDERS}
          selectedProvider={selectedProvider}
          onSelectProvider={handleProviderSelect}
        />

        {trending.length > 0 && (
          <MovieRow title="Trending Now" movies={trending} icon={TrendingUp} />
        )}
        {popularMovies.length > 0 && (
          <MovieRow
            title={selectedProvider ? `${getProviderName()} Movies` : 'Popular Movies'}
            movies={popularMovies}
            icon={Film}
            mediaType="movie"
          />
        )}
        {topRatedMovies.length > 0 && (
          <MovieRow
            title="Top Rated Movies"
            movies={topRatedMovies}
            icon={Star}
            mediaType="movie"
          />
        )}
        {popularTV.length > 0 && (
          <MovieRow
            title={selectedProvider ? `${getProviderName()} TV Shows` : 'Popular TV Shows'}
            movies={popularTV}
            icon={Tv}
            mediaType="tv"
          />
        )}
        {upcomingMovies.length > 0 && (
          <MovieRow
            title="Coming Soon"
            movies={upcomingMovies}
            icon={Sparkles}
            mediaType="movie"
          />
        )}

        {trending.length === 0 &&
          popularMovies.length === 0 &&
          popularTV.length === 0 &&
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {selectedProvider
                  ? `No content found for ${getProviderName()}`
                  : 'No content loaded. Check console for errors.'}
              </Text>
            </View>
          )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    width: '100%',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
  },
  heroGradient: {
    ...StyleSheet.absoluteFill,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBarWordmark: {
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    letterSpacing: 4,
  },
  heroTopBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  moreButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    right: 20,
  },
  heroMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Medium,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroMetaDot: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Medium,
  },
  heroRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroTitle: {
    fontSize: 34,
    fontFamily: Fonts.GeistMono.Bold,
    color: '#fff',
    marginBottom: 18,
    lineHeight: 40,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 13,
    paddingHorizontal: 26,
    borderRadius: 8,
    gap: 8,
  },
  playButtonText: {
    color: '#000',
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Bold,
    letterSpacing: 0.3,
  },
  sectionHeader: {
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginTop: 48,
    minHeight: 200,
  },
  emptyLabel: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.accent,
    letterSpacing: 4,
    marginBottom: 16,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCta: {
    marginTop: 20,
    backgroundColor: '#fff',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyCtaText: {
    color: '#000',
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Bold,
    letterSpacing: 0.3,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    marginTop: 14,
    letterSpacing: 0.5,
  },
  bottomSpacer: {
    height: 48,
  },
});
