import { MovieRow } from '@/components/MovieRow';
import { ProviderChips } from '@/components/ProviderChips';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { STREAMING_PROVIDERS } from '@/constants/providers';
import { useSettings } from '@/contexts/SettingsContext';
import { Movie, useTMDB } from '@/hooks/useTMDB';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Calendar, Film, Play, Sparkles, Star, TrendingUp, Tv } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const { fetchTrending, fetchPopular } = useTMDB();
  const { tmdbApiKey } = useSettings();
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [trending, setTrending] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [popularTV, setPopularTV] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<Movie[]>([]);
  const [featuredMovie, setFeaturedMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('HomeScreen: tmdbApiKey changed:', tmdbApiKey ? 'SET' : 'NOT SET');
    loadContent();
  }, [tmdbApiKey, selectedProvider]);

  const loadContent = async () => {
    console.log('HomeScreen: loadContent called, API key:', tmdbApiKey ? 'SET' : 'NOT SET');
    if (!tmdbApiKey) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    // If provider is selected, only fetch provider-specific content
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
      // Show all content
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
    
    console.log('HomeScreen: Data loaded');
    setLoading(false);
  };

  const fetchTopRated = async (type: 'movie' | 'tv') => {
    if (!tmdbApiKey) return [];
    try {
      const isBearer = tmdbApiKey.startsWith('eyJ') || tmdbApiKey.length > 100;
      const response = await fetch(
        `https://api.themoviedb.org/3/${type}/top_rated${!isBearer ? `?api_key=${tmdbApiKey}` : ''}`,
        isBearer ? {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${tmdbApiKey}`,
          },
        } : undefined
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Failed to fetch top rated:', error);
      return [];
    }
  };

  const fetchUpcoming = async () => {
    if (!tmdbApiKey) return [];
    try {
      const isBearer = tmdbApiKey.startsWith('eyJ') || tmdbApiKey.length > 100;
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/upcoming${!isBearer ? `?api_key=${tmdbApiKey}` : ''}`,
        isBearer ? {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${tmdbApiKey}`,
          },
        } : undefined
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Failed to fetch upcoming:', error);
      return [];
    }
  };

  const handleProviderSelect = (providerId: number | null) => {
    setSelectedProvider(providerId);
  };

  const getProviderName = () => {
    if (!selectedProvider) return null;
    const provider = STREAMING_PROVIDERS.find(p => p.id === selectedProvider);
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

  if (!tmdbApiKey) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
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
        {/* Featured Hero Section */}
        {featuredMovie && (
          <TouchableOpacity 
            style={styles.heroSection} 
            activeOpacity={0.9}
            onPress={handleFeaturedPress}
          >
            <Image
              source={{ 
                uri: featuredMovie.backdrop_path 
                  ? `https://image.tmdb.org/t/p/original${featuredMovie.backdrop_path}`
                  : `https://image.tmdb.org/t/p/w500${featuredMovie.poster_path}`
              }}
              style={styles.heroImage}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)', Colors.background]}
              style={styles.heroGradient}
            />
            <View style={styles.heroContent}>
              <View style={styles.trendingBadge}>
                <TrendingUp size={16} color="#fff" />
                <Text style={styles.trendingText}>Trending Now</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {featuredMovie.title || featuredMovie.name}
              </Text>
              <View style={styles.heroMeta}>
                {featuredMovie.vote_average && (
                  <View style={styles.heroMetaItem}>
                    <Star size={16} color="#FFD700" fill="#FFD700" />
                    <Text style={styles.heroMetaText}>
                      {featuredMovie.vote_average.toFixed(1)}
                    </Text>
                  </View>
                )}
                {(featuredMovie.release_date || featuredMovie.first_air_date) && (
                  <View style={styles.heroMetaItem}>
                    <Calendar size={16} color="#fff" />
                    <Text style={styles.heroMetaText}>
                      {(featuredMovie.release_date || featuredMovie.first_air_date)?.substring(0, 4)}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.playButton} onPress={handleFeaturedPress}>
                <Play size={20} color="#000" fill="#000" />
                <Text style={styles.playButtonText}>Watch Now</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {selectedProvider ? getProviderName() : 'Explore'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {selectedProvider ? 'Available Content' : 'Discover amazing content'}
          </Text>
        </View>
        
        <ProviderChips
          providers={STREAMING_PROVIDERS}
          selectedProvider={selectedProvider}
          onSelectProvider={handleProviderSelect}
        />
        
        {trending.length > 0 && (
          <MovieRow 
            title="Trending Now" 
            movies={trending} 
            icon={TrendingUp}
          />
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
        
        {trending.length === 0 && popularMovies.length === 0 && popularTV.length === 0 && !loading && (
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
    width: width,
    height: height * 0.65,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  heroContent: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 15,
    gap: 6,
  },
  trendingText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 36,
    fontFamily: Fonts.GeistMono.Bold,
    color: '#fff',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 20,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Fonts.GeistMono.SemiBold,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignSelf: 'flex-start',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  playButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Bold,
  },
  header: {
    paddingTop: 30,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Regular,
    textAlign: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Regular,
    marginTop: 10,
  },
  bottomSpacer: {
    height: 40,
  },
});
