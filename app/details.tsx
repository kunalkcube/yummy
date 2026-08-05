import { SeasonsList } from '@/components/SeasonsList';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useSettings } from '@/contexts/SettingsContext';
import { Movie, useTMDB } from '@/hooks/useTMDB';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, ArrowLeft, Film, Play, Star, Tv, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.48;

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
  const insets = useSafeAreaInsets();
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

    await Promise.all([loadCast(), loadRecommendations()]);

    setLoading(false);
  };

  const loadCast = async () => {
    if (!tmdbApiKey) return;
    try {
      const isBearer = tmdbApiKey.startsWith('eyJ') || tmdbApiKey.length > 100;
      const response = await fetch(
        `https://api.themoviedb.org/3/${type}/${id}/credits${!isBearer ? `?api_key=${tmdbApiKey}` : ''}`,
        isBearer
          ? {
              headers: {
                accept: 'application/json',
                Authorization: `Bearer ${tmdbApiKey}`,
              },
            }
          : undefined
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
        isBearer
          ? {
              headers: {
                accept: 'application/json',
                Authorization: `Bearer ${tmdbApiKey}`,
              },
            }
          : undefined
      );
      const data = await response.json();
      setRecommendations(data.results || []);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    }
  };

  const handleWatchNow = (season?: number, episode?: number) => {
    const params: Record<string, string> = {
      id: String(id),
      type: String(type),
      title: details?.title || details?.name || 'Unknown',
    };

    if (type === 'tv') {
      params.season = season?.toString() || '1';
      params.episode = episode?.toString() || '1';
    }

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
          <AlertCircle size={48} color={Colors.textSecondary} />
          <Text style={styles.errorTitle}>Failed to load</Text>
          <Text style={styles.errorText}>Couldn’t load this title. Try again.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDetails} activeOpacity={0.85}>
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
  const year = (details.release_date || details.first_air_date)?.substring(0, 4);
  const rating = details.vote_average?.toFixed(1);
  const genres = (details as any).genres as Genre[] | undefined;
  const runtime = (details as any).runtime;
  const episodeRuntime = (details as any).episode_run_time?.[0];
  const typeLabel = type === 'movie' ? 'Movie' : 'TV';
  const runtimeLabel = runtime
    ? `${runtime} min`
    : episodeRuntime
      ? `${episodeRuntime} min/ep`
      : null;
  const seasonsLabel =
    type === 'tv' && details.number_of_seasons
      ? `${details.number_of_seasons} Season${details.number_of_seasons > 1 ? 's' : ''}`
      : null;

  const renderCastItem = ({ item }: { item: Cast }) => (
    <TouchableOpacity
      style={styles.castCard}
      onPress={() => router.push({ pathname: '/person', params: { id: item.id } })}
      activeOpacity={0.85}
    >
      {item.profile_path ? (
        <Image
          source={{ uri: `https://image.tmdb.org/t/p/w185${item.profile_path}` }}
          style={styles.castImage}
        />
      ) : (
        <View style={[styles.castImage, styles.castPlaceholder]}>
          <User size={28} color={Colors.textSecondary} />
        </View>
      )}
      <Text style={styles.castName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.castCharacter} numberOfLines={1}>
        {item.character}
      </Text>
    </TouchableOpacity>
  );

  const renderRecommendationItem = ({ item }: { item: Movie }) => (
    <TouchableOpacity
      style={styles.recommendationCard}
      onPress={() => router.push({ pathname: '/details', params: { id: item.id, type } })}
      activeOpacity={0.85}
    >
      <Image
        source={{
          uri: item.poster_path
            ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
            : 'https://via.placeholder.com/342x513?text=No+Image',
        }}
        style={styles.recommendationImage}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
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
        <View style={styles.heroContainer}>
          {backdropUrl ? (
            <Image source={{ uri: backdropUrl }} style={styles.backdrop} />
          ) : (
            <View style={[styles.backdrop, styles.placeholderBackdrop]}>
              <Film size={64} color={Colors.textSecondary} />
            </View>
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.55)', Colors.background]}
            locations={[0, 0.25, 0.65, 1]}
            style={styles.gradient}
          />

          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 8 }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>

          <Animated.View
            entering={FadeInDown.duration(250)}
            style={styles.heroContent}
          >
            {posterUrl && (
              <Image source={{ uri: posterUrl }} style={styles.poster} />
            )}
            <View style={styles.heroTextContainer}>
              <View style={styles.heroMetaLine}>
                <Text style={styles.heroMetaText}>{typeLabel.toUpperCase()}</Text>
                {rating && (
                  <>
                    <Text style={styles.heroMetaDot}>·</Text>
                    <View style={styles.heroRating}>
                      <Star size={10} color="#FFD700" fill="#FFD700" />
                      <Text style={styles.heroMetaText}>{rating}</Text>
                    </View>
                  </>
                )}
                {year && (
                  <>
                    <Text style={styles.heroMetaDot}>·</Text>
                    <Text style={styles.heroMetaText}>{year}</Text>
                  </>
                )}
                {runtimeLabel && (
                  <>
                    <Text style={styles.heroMetaDot}>·</Text>
                    <Text style={styles.heroMetaText}>{runtimeLabel}</Text>
                  </>
                )}
              </View>

              <Text style={styles.title} numberOfLines={3}>
                {title}
              </Text>

              {genres && genres.length > 0 && (
                <Text style={styles.genreLine} numberOfLines={1}>
                  {genres
                    .slice(0, 3)
                    .map((g) => g.name)
                    .join('  ·  ')}
                </Text>
              )}
            </View>
          </Animated.View>
        </View>

        <View style={styles.content}>
          {seasonsLabel && (
            <View style={styles.seasonsHint}>
              {type === 'tv' ? (
                <Tv size={14} color={Colors.accent} />
              ) : (
                <Film size={14} color={Colors.accent} />
              )}
              <Text style={styles.seasonsHintText}>{seasonsLabel}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.watchButton}
            onPress={() => handleWatchNow()}
            activeOpacity={0.85}
          >
            <Play size={18} color="#000" fill="#000" />
            <Text style={styles.watchButtonText}>Watch Now</Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Overview</Text>
            <Text style={styles.overview}>
              {details.overview || 'No overview available for this title.'}
            </Text>
          </View>

          {cast.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Cast</Text>
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

          {type === 'tv' && details.seasons && details.seasons.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Seasons & Episodes</Text>
              <SeasonsList
                seasons={details.seasons}
                tvId={id!}
                tvTitle={title}
                onEpisodePress={handleEpisodePress}
              />
            </View>
          )}

          {recommendations.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>More Like This</Text>
                {recommendations.length > 10 && (
                  <TouchableOpacity
                    onPress={() => setShowAllRecommendations(!showAllRecommendations)}
                  >
                    <Text style={styles.seeAllText}>
                      {showAllRecommendations
                        ? 'Show less'
                        : `See all (${recommendations.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <FlatList
                data={
                  showAllRecommendations ? recommendations : recommendations.slice(0, 10)
                }
                renderItem={renderRecommendationItem}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recommendationList}
              />
            </View>
          )}

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
    gap: 14,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    letterSpacing: 0.5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  errorTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: Fonts.GeistMono.Bold,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#000',
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Bold,
  },
  heroContainer: {
    position: 'relative',
    height: HERO_HEIGHT,
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
    ...StyleSheet.absoluteFillObject,
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
    bottom: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  poster: {
    width: 104,
    height: 156,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  heroTextContainer: {
    flex: 1,
    paddingBottom: 4,
  },
  heroMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Medium,
    letterSpacing: 1,
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
  title: {
    fontSize: 26,
    fontFamily: Fonts.GeistMono.Bold,
    color: '#fff',
    lineHeight: 32,
    letterSpacing: -0.4,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  genreLine: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    letterSpacing: 0.2,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  seasonsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  seasonsHintText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Medium,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    marginBottom: 28,
  },
  watchButtonText: {
    color: '#000',
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Bold,
    letterSpacing: 0.3,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  overview: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    lineHeight: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllText: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: Fonts.GeistMono.SemiBold,
  },
  castList: {
    paddingRight: 8,
  },
  castCard: {
    width: 88,
    marginRight: 12,
  },
  castImage: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    marginBottom: 8,
  },
  castPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  castName: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: Fonts.GeistMono.SemiBold,
    marginBottom: 2,
  },
  castCharacter: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Regular,
  },
  recommendationList: {
    paddingRight: 8,
  },
  recommendationCard: {
    width: Dimensions.get('window').width * 0.3,
    height: Dimensions.get('window').width * 0.3 * 1.55,
    marginRight: 10,
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
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 24,
    justifyContent: 'flex-end',
  },
  recommendationTitle: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Medium,
    lineHeight: 15,
  },
  bottomSpacer: {
    height: 48,
  },
});
