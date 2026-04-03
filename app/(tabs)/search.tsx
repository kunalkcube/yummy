import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useSettings } from '@/contexts/SettingsContext';
import { Movie, useTMDB } from '@/hooks/useTMDB';
import { useRouter } from 'expo-router';
import { AlertCircle, Calendar, Film, Key, Search, Star, Tv, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');

export default function SearchScreen() {
  const { searchContent } = useTMDB();
  const { tmdbApiKey } = useSettings();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [results]);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length > 2) {
      setIsSearching(true);
      const data = await searchContent(text);
      setResults(data);
      setIsSearching(false);
    } else {
      setResults([]);
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
  };

  const handlePress = (movie: Movie) => {
    const type = movie.media_type || (movie.title ? 'movie' : 'tv');
    router.push({
      pathname: '/details',
      params: { id: movie.id, type },
    });
  };

  const renderItem = ({ item, index }: { item: Movie; index: number }) => {
    const posterUrl = item.poster_path
      ? `https://image.tmdb.org/t/p/w300${item.poster_path}`
      : 'https://via.placeholder.com/300x450?text=No+Image';
    
    const title = item.title || item.name || 'Unknown';
    const year = item.release_date || item.first_air_date;
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <TouchableOpacity 
          style={styles.resultItem} 
          onPress={() => handlePress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.posterContainer}>
            <Image source={{ uri: posterUrl }} style={styles.poster} />
            {item.media_type && (
              <View style={[styles.badge, item.media_type === 'movie' ? styles.movieBadge : styles.tvBadge]}>
                {item.media_type === 'movie' ? (
                  <Film size={12} color="#fff" />
                ) : (
                  <Tv size={12} color="#fff" />
                )}
                <Text style={styles.badgeText}>{item.media_type === 'movie' ? 'Movie' : 'TV'}</Text>
              </View>
            )}
          </View>
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            <View style={styles.metadata}>
              {year && (
                <View style={styles.metaItem}>
                  <Calendar size={14} color={Colors.textSecondary} />
                  <Text style={styles.metaText}>{year.substring(0, 4)}</Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <Star size={14} color="#FFD700" fill="#FFD700" />
                <Text style={styles.metaText}>{rating}</Text>
              </View>
            </View>
            {item.overview && (
              <Text style={styles.overview} numberOfLines={3}>{item.overview}</Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (!tmdbApiKey) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Key size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>API Key Required</Text>
          <Text style={styles.emptyText}>Please set your TMDB API key in Settings to search</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search movies and TV shows..."
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {query.length === 0 ? (
                <>
                  <Search size={64} color={Colors.textSecondary} />
                  <Text style={styles.emptyTitle}>Discover Content</Text>
                  <Text style={styles.emptyText}>Start typing to search for movies and TV shows</Text>
                </>
              ) : query.length <= 2 ? (
                <>
                  <Film size={64} color={Colors.textSecondary} />
                  <Text style={styles.emptyTitle}>Keep Typing</Text>
                  <Text style={styles.emptyText}>Enter at least 3 characters to search</Text>
                </>
              ) : (
                <>
                  <AlertCircle size={64} color={Colors.textSecondary} />
                  <Text style={styles.emptyTitle}>No Results Found</Text>
                  <Text style={styles.emptyText}>Try searching with different keywords</Text>
                </>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginBottom: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Regular,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 5,
  },
  list: {
    padding: 20,
    paddingTop: 10,
  },
  resultItem: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  posterContainer: {
    position: 'relative',
  },
  poster: {
    width: 100,
    height: 150,
    backgroundColor: Colors.surface,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  movieBadge: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
  },
  tvBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: Fonts.GeistMono.Bold,
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: Fonts.GeistMono.SemiBold,
    marginBottom: 8,
    lineHeight: 22,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
  },
  overview: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    lineHeight: 18,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 22,
    fontFamily: Fonts.GeistMono.Bold,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Regular,
    textAlign: 'center',
    lineHeight: 22,
  },
});
