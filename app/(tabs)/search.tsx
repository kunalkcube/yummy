import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useSettings } from '@/contexts/SettingsContext';
import { Movie, useTMDB } from '@/hooks/useTMDB';
import { useRouter } from 'expo-router';
import { AlertCircle, Film, Key, Search, Star, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SearchScreen() {
  const { searchContent } = useTMDB();
  const { tmdbApiKey } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  const renderItem = ({ item }: { item: Movie }) => {
    const posterUrl = item.poster_path
      ? `https://image.tmdb.org/t/p/w300${item.poster_path}`
      : 'https://via.placeholder.com/300x450?text=No+Image';

    const title = item.title || item.name || 'Unknown';
    const year = (item.release_date || item.first_air_date)?.substring(0, 4);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
    const typeLabel = item.media_type === 'tv' ? 'TV' : item.media_type === 'movie' ? 'Movie' : null;

    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handlePress(item)}
        activeOpacity={0.85}
      >
        <Image source={{ uri: posterUrl }} style={styles.poster} />
        <View style={styles.info}>
          <View style={styles.metaLine}>
            {typeLabel && <Text style={styles.metaText}>{typeLabel.toUpperCase()}</Text>}
            {rating && (
              <>
                {typeLabel && <Text style={styles.metaDot}>·</Text>}
                <View style={styles.rating}>
                  <Star size={10} color="#FFD700" fill="#FFD700" />
                  <Text style={styles.metaText}>{rating}</Text>
                </View>
              </>
            )}
            {year && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{year}</Text>
              </>
            )}
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {item.overview ? (
            <Text style={styles.overview} numberOfLines={2}>
              {item.overview}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  if (!tmdbApiKey) {
    return (
      <View style={styles.container}>
        <View style={[styles.emptyContainer, { paddingTop: insets.top + 80 }]}>
          <Key size={40} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>API Key Required</Text>
          <Text style={styles.emptyText}>
            Set your TMDB API key in Settings to search
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerLabel}>Search</Text>
        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Movies, TV shows..."
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={clearSearch}
              style={styles.clearButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        {results.length > 0 && !isSearching && (
          <Text style={styles.resultCount}>
            {results.length} result{results.length === 1 ? '' : 's'}
          </Text>
        )}
      </View>

      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, index) =>
            `${item.media_type || 'unknown'}-${item.id}-${index}`
          }
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {query.length === 0 ? (
                <>
                  <Search size={40} color={Colors.textSecondary} />
                  <Text style={styles.emptyTitle}>Discover</Text>
                  <Text style={styles.emptyText}>
                    Start typing to search movies and TV shows
                  </Text>
                </>
              ) : query.length <= 2 ? (
                <>
                  <Film size={40} color={Colors.textSecondary} />
                  <Text style={styles.emptyTitle}>Keep typing</Text>
                  <Text style={styles.emptyText}>
                    Enter at least 3 characters to search
                  </Text>
                </>
              ) : (
                <>
                  <AlertCircle size={40} color={Colors.textSecondary} />
                  <Text style={styles.emptyTitle}>No results</Text>
                  <Text style={styles.emptyText}>
                    Try different keywords
                  </Text>
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
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerLabel: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Regular,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 2,
  },
  resultCount: {
    marginTop: 12,
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Medium,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    flexGrow: 1,
  },
  resultItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  poster: {
    width: 72,
    height: 108,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 2,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metaDot: {
    color: Colors.border,
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Medium,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: Fonts.GeistMono.SemiBold,
    marginBottom: 6,
    lineHeight: 20,
  },
  overview: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    lineHeight: 18,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
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
