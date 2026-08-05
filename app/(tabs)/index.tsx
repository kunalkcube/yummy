import { MovieRow } from '@/components/MovieRow';
import { ProviderChips } from '@/components/ProviderChips';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { STREAMING_PROVIDERS } from '@/constants/providers';
import { Movie, useTMDB } from '@/hooks/useTMDB';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Film, Play, Sparkles, Star, TrendingUp, Tv } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.6;

export default function HomeScreen() {
  const {
    tmdbApiKey,
    fetchTrending,
    fetchPopular,
    fetchTopRated,
    fetchUpcoming,
  } = useTMDB();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [trending, setTrending] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [popularTV, setPopularTV] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<Movie[]>([]);
  const [featuredMovie, setFeaturedMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, [tmdbApiKey, selectedProvider]);

  const loadContent = async () => {
    if (!tmdbApiKey) {
      setLoading(false);
      return;
    }

    setLoading(true);

    if (selectedProvider) {
      const [moviesData, tvData] = await Promise.all([
        fetchPopular('movie', selectedProvider),
        fetchPopular('tv', selectedProvider),
      ]);
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
      setTrending(trendingData);
      setPopularMovies(moviesData);
      setPopularTV(tvData);
      setTopRatedMovies(topRatedData);
      setUpcomingMovies(upcomingData);
      setFeaturedMovie(trendingData[0] || moviesData[0] || null);
    }

    setLoading(false);
  };

  const handleProviderSelect = (providerId: number | null) => {
    setSelectedProvider(providerId);
  };

  const getProviderName = () => {
    if (!selectedProvider) return null;
    const provider = STREAMING_PROVIDERS.find((p) => p.id === selectedProvider);
    return provider?.name || 'Provider';
  };

  const handleFeaturedPress = () => {
    if (!featuredMovie) return;
    const type = featuredMovie.media_type || (featuredMovie.title ? 'movie' : 'tv');
    router.push({
      pathname: '/details',
      params: { id: featuredMovie.id, type },
    });
  };

  const heroYear = (featuredMovie?.release_date || featuredMovie?.first_air_date)?.substring(0, 4);
  const heroRating = featuredMovie?.vote_average
    ? featuredMovie.vote_average.toFixed(1)
    : null;
  const heroLabel = selectedProvider ? getProviderName()?.toUpperCase() : 'TRENDING';

  if (!tmdbApiKey) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyLabel}>YUMMY</Text>
          <Text style={styles.emptyText}>Please set your TMDB API key in Settings</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading content...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {featuredMovie && (
          <TouchableOpacity
            style={styles.heroSection}
            activeOpacity={0.95}
            onPress={handleFeaturedPress}
          >
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

            <Text style={[styles.wordmark, { top: insets.top + 12 }]}>YUMMY</Text>

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
              <TouchableOpacity
                style={styles.playButton}
                onPress={handleFeaturedPress}
                activeOpacity={0.85}
              >
                <Play size={18} color="#000" fill="#000" />
                <Text style={styles.playButtonText}>Watch Now</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>
            {selectedProvider ? getProviderName() : 'Explore'}
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
    </View>
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
    width,
    height: HERO_HEIGHT,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  wordmark: {
    position: 'absolute',
    left: 20,
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 13,
    paddingHorizontal: 26,
    borderRadius: 8,
    alignSelf: 'flex-start',
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
