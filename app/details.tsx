import { SeasonsList } from '@/components/SeasonsList';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useSettings } from '@/contexts/SettingsContext';
import { Movie, useTMDB } from '@/hooks/useTMDB';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, ArrowLeft, Calendar, Film, Layers, Star, Tv, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { height } = Dimensions.get('window');

interface Cast {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface Genre {
  id: number;
  name: string;
}

export default function DetailsScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: 'movie' | 'tv' }>();
  const { fetchDetails } = useTMDB();
  const { tmdbApiKey } = useSettings();
  const router = useRouter();
  const [details, setDetails] = useState<Movie | null>(null);
  const [cast, setCast] = useState<Cast[]>([]);
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllCast, setShowAllCast] = useState(false);
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);

  useEffect(() => {
    loadDetails();
  }, [id, type]);

  const loadDetails = async () => {
    if (!id || !type) return;
    setLoading(true);
    const data = await fetchDetails(Number(id), type);
    setDetails(data);
    
    // Fetch cast and recommendations
    await Promise.all([
      loadCast(),
      loadRecommendations()
    ]);
    
    setLoading(false);
  };

  const loadCast = async () => {
    if (!tmdbApiKey) return;
    try {
      const isBearer = tmdbApiKey.startsWith('eyJ') || tmdbApiKey.length > 100;
      const config = isBearer
        ? {
            headers: {
              accept: 'application/json',
              Authorization: `Bearer ${tmdbApiKey}`,
            },
          }
        : { params: { api_key: tmdbApiKey } };
      
      const response = await fetch(
        `https://api.themoviedb.org/3/${type}/${id}/credits${!isBearer ? `?api_key=${tmdbApiKey}` : ''}`,
        isBearer ? { headers: config.headers } : undefined
      );
      const data = await response.json();
      setCast(data.cast || []);
    } catch (error) {
      console.error('Failed to load cast:', error);
    }
  };

  const loadRecommendations = async () => {
    if (!tmdbApiKey) return;
    try {
      const isBearer = tmdbApiKey.startsWith('eyJ') || tmdbApiKey.length > 100;
      const response = await fetch(
        `https://api.themoviedb.org/3/${type}/${id}/recommendations${!isBearer ? `?api_key=${tmdbApiKey}` : ''}`,
        isBearer ? {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${tmdbApiKey}`,
          },
        } : undefined
      );
      const data = await response.json();
      setRecommendations(data.results || []);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    }
  };

  const handleWatchNow = (season?: number, episode?: number) => {
    const params: any = { 
      id, 
      type,
      title: details?.title || details?.name || 'Unknown',
    };
    
    // Only add season/episode for TV shows
    if (type === 'tv') {
      params.season = season?.toString() || '1';
      params.episode = episode?.toString() || '1';
    }
    
    console.log('Navigating to player with params:', params);
    
    router.push({
      pathname: '/player',
      params,
    });
  };

  const handleEpisodePress = (season: number, episode: number) => {
    handleWatchNow(season, episode);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      </View>
    );
  }

  if (!details) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.errorContainer}>
          <AlertCircle size={64} color={Colors.textSecondary} />
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorText}>Failed to load details</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDetails}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const backdropUrl = details.backdrop_path
    ? `https://image.tmdb.org/t/p/original${details.backdrop_path}`
    : null;

  const posterUrl = details.poster_path
    ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
    : null;

  const title = details.title || details.name || 'Unknown';
  const year = details.release_date || details.first_air_date;
  const rating = details.vote_average?.toFixed(1) || 'N/A';
  const genres = (details as any).genres as Genre[] | undefined;
  const runtime = (details as any).runtime;
  const episodeRuntime = (details as any).episode_run_time?.[0];

  const renderCastItem = ({ item }: { item: Cast }) => (
    <TouchableOpacity 
      style={styles.castCard}
      onPress={() => router.push({ pathname: '/person', params: { id: item.id } })}
    >
      {item.profile_path ? (
        <Image
          source={{ uri: `https://image.tmdb.org/t/p/w185${item.profile_path}` }}
          style={styles.castImage}
        />
      ) : (
        <View style={[styles.castImage, styles.castPlaceholder]}>
          <User size={40} color={Colors.textSecondary} />
        </View>
      )}
      <Text style={styles.castName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.castCharacter} numberOfLines={1}>{item.character}</Text>
    </TouchableOpacity>
  );

  const renderRecommendationItem = ({ item }: { item: Movie }) => (
    <TouchableOpacity
      style={styles.recommendationCard}
      onPress={() => router.push({ pathname: '/details', params: { id: item.id, type } })}
    >
      <Image
        source={{ 
          uri: item.poster_path 
            ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
            : 'https://via.placeholder.com/342x513?text=No+Image'
        }}
        style={styles.recommendationImage}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)']}
        style={styles.recommendationGradient}
      >
        <Text style={styles.recommendationTitle} numberOfLines={2}>
          {item.title || item.name}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section with Backdrop */}
        <View style={styles.heroContainer}>
          {backdropUrl ? (
            <Image source={{ uri: backdropUrl }} style={styles.backdrop} />
          ) : (
            <View style={[styles.backdrop, styles.placeholderBackdrop]}>
              <Film size={80} color={Colors.textSecondary} />
            </View>
          )}
          
          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)', Colors.background]}
            style={styles.gradient}
          />

          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>

          {/* Poster and Title Overlay */}
          <View style={styles.heroContent}>
            {posterUrl && (
              <View style={styles.posterContainer}>
                <Image source={{ uri: posterUrl }} style={styles.poster} />
              </View>
            )}
            <View style={styles.heroTextContainer}>
              <Text style={styles.title} numberOfLines={2}>{title}</Text>
              <View style={styles.heroMeta}>
                {year && (
                  <View style={styles.metaChip}>
                    <Calendar size={14} color="#fff" />
                    <Text style={styles.metaChipText}>{year.substring(0, 4)}</Text>
                  </View>
                )}
                <View style={styles.metaChip}>
                  <Star size={14} color="#FFD700" fill="#FFD700" />
                  <Text style={styles.metaChipText}>{rating}</Text>
                </View>
                <View style={[styles.metaChip, type === 'movie' ? styles.movieChip : styles.tvChip]}>
                  {type === 'movie' ? <Film size={14} color="#fff" /> : <Tv size={14} color="#fff" />}
                  <Text style={styles.metaChipText}>{type === 'movie' ? 'Movie' : 'TV Show'}</Text>
                </View>
                {runtime && (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>{runtime} min</Text>
                  </View>
                )}
                {episodeRuntime && (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>{episodeRuntime} min/ep</Text>
                  </View>
                )}
              </View>
              {genres && genres.length > 0 && (
                <View style={styles.genresContainer}>
                  {genres.slice(0, 3).map((genre) => (
                    <View key={genre.id} style={styles.genreChip}>
                      <Text style={styles.genreText}>{genre.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          {/* Additional Info */}
          {type === 'tv' && details.number_of_seasons && (
            <View style={styles.infoCard}>
              <Layers size={20} color={Colors.accent} />
              <Text style={styles.infoCardText}>
                {details.number_of_seasons} Season{details.number_of_seasons > 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/* Continue Watch Button */}
          <TouchableOpacity 
            style={styles.continueButton} 
            onPress={() => handleWatchNow()}
            activeOpacity={0.9}
          >
            <Text style={styles.continueButtonText}>Watch Now</Text>
          </TouchableOpacity>

          {/* Overview Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIndicator} />
              <Text style={styles.sectionTitle}>Overview</Text>
            </View>
            <Text style={styles.overview}>
              {details.overview || 'No overview available for this title.'}
            </Text>
          </View>

          {/* Cast Section */}
          {cast.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitleSimple}>The cast</Text>
                {cast.length > 10 && (
                  <TouchableOpacity onPress={() => setShowAllCast(!showAllCast)}>
                    <Text style={styles.seeAllText}>
                      {showAllCast ? 'Show less' : `See all (${cast.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <FlatList
                data={showAllCast ? cast : cast.slice(0, 10)}
                renderItem={renderCastItem}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.castList}
              />
            </View>
          )}

          {/* Seasons List for TV Shows */}
          {type === 'tv' && details.seasons && details.seasons.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIndicator} />
                <Text style={styles.sectionTitle}>Seasons & Episodes</Text>
              </View>
              <SeasonsList
                seasons={details.seasons}
                tvId={id!}
                tvTitle={title}
                onEpisodePress={handleEpisodePress}
              />
            </View>
          )}

          {/* Recommendations Section */}
          {recommendations.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitleSimple}>Maybe you like</Text>
                {recommendations.length > 10 && (
                  <TouchableOpacity onPress={() => setShowAllRecommendations(!showAllRecommendations)}>
                    <Text style={styles.seeAllText}>
                      {showAllRecommendations ? 'Show less' : `See all (${recommendations.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <FlatList
                data={showAllRecommendations ? recommendations : recommendations.slice(0, 10)}
                renderItem={renderRecommendationItem}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recommendationList}
              />
            </View>
          )}

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Regular,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 15,
  },
  errorTitle: {
    color: Colors.text,
    fontSize: 24,
    fontFamily: Fonts.GeistMono.Bold,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Regular,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Fonts.GeistMono.SemiBold,
  },
  heroContainer: {
    position: 'relative',
    height: height * 0.5,
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
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  heroContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 15,
  },
  posterContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  poster: {
    width: 120,
    height: 180,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  heroTextContainer: {
    flex: 1,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.GeistMono.Bold,
    color: '#fff',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  movieChip: {
    backgroundColor: 'rgba(220, 38, 38, 0.8)',
  },
  tvChip: {
    backgroundColor: 'rgba(37, 99, 235, 0.8)',
  },
  metaChipText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.GeistMono.SemiBold,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  genreChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  genreText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Medium,
  },
  content: {
    padding: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  infoCardText: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.SemiBold,
  },
  watchButton: {
    marginBottom: 25,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  watchButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 12,
  },
  watchButtonText: {
    color: '#fff',
    fontSize: 20,
    fontFamily: Fonts.GeistMono.Bold,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
  },
  sectionIndicator: {
    width: 4,
    height: 24,
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
  },
  overview: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Regular,
    lineHeight: 24,
  },
  bottomSpacer: {
    height: 40,
  },
  continueButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 25,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: Fonts.GeistMono.Bold,
  },
  sectionTitleSimple: {
    fontSize: 20,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginBottom: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  seeAllText: {
    color: Colors.accent,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.SemiBold,
  },
  castList: {
    paddingRight: 20,
  },
  castCard: {
    width: 100,
    marginRight: 15,
  },
  castImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    marginBottom: 8,
  },
  castPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  castName: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.SemiBold,
    textAlign: 'center',
    marginBottom: 4,
  },
  castCharacter: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    textAlign: 'center',
  },
  recommendationList: {
    paddingRight: 20,
  },
  recommendationCard: {
    width: 140,
    height: 210,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  recommendationImage: {
    width: '100%',
    height: '100%',
  },
  recommendationGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    justifyContent: 'flex-end',
  },
  recommendationTitle: {
    color: '#fff',
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
  },
});
