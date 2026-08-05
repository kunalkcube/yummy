import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useMangaPlus } from '@/hooks/useMangaPlus';
import { useRouter } from 'expo-router';
import { AlertCircle, BookOpen, Search, TrendingUp, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MangaSource = 'mangadex' | 'anilist' | 'mangaplus';

interface MangaResult {
  id: string;
  title: string;
  coverImage: string;
  description?: string;
  status?: string;
  chapters?: number;
  source: MangaSource;
  author?: string;
  viewCount?: number;
}

const SOURCES: { id: MangaSource; label: string }[] = [
  { id: 'mangaplus', label: 'MangaPlus' },
  { id: 'mangadex', label: 'MangaDex' },
  { id: 'anilist', label: 'AniList' },
];

export default function MangaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mangaPlus = useMangaPlus();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<MangaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<MangaSource>('mangaplus');
  const [trendingManga, setTrendingManga] = useState<MangaResult[]>([]);

  useEffect(() => {
    if (mangaPlus.isInitialized && selectedSource === 'mangaplus') {
      loadMangaPlusTrending();
    }
  }, [mangaPlus.isInitialized, selectedSource]);

  const loadMangaPlusTrending = async () => {
    try {
      const rankings = await mangaPlus.fetchRanking('hottest');
      const trending = rankings.slice(0, 20).flatMap((ranking) =>
        ranking.titles
          .filter((title) => title.language === 'ENGLISH')
          .map((title) => ({
            id: title.titleId.toString(),
            title: title.name,
            coverImage: title.portraitImageUrl,
            description: '',
            status: title.titleUpdateStatus,
            author: title.author,
            viewCount: title.viewCount,
            source: 'mangaplus' as const,
          }))
      );
      setTrendingManga(trending);
    } catch (err) {
      console.error('Error loading MangaPlus trending:', err);
    }
  };

  const searchMangaDex = async (query: string) => {
    try {
      const response = await fetch(
        `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=20&includes[]=cover_art`
      );
      const data = await response.json();

      return data.data.map((manga: any) => {
        const coverArt = manga.relationships.find((rel: any) => rel.type === 'cover_art');
        const coverFileName = coverArt?.attributes?.fileName;
        const coverImage = coverFileName
          ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.256.jpg`
          : 'https://via.placeholder.com/256x384?text=No+Cover';

        return {
          id: manga.id,
          title:
            manga.attributes.title.en ||
            Object.values(manga.attributes.title)[0] ||
            'Unknown Title',
          coverImage,
          description: manga.attributes.description?.en || 'No description available',
          status: manga.attributes.status,
          source: 'mangadex' as const,
        };
      });
    } catch (err) {
      console.error('MangaDex search error:', err);
      return [];
    }
  };

  const searchAniList = async (query: string) => {
    try {
      const graphqlQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 20) {
            media(search: $search, type: MANGA) {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
                medium
              }
              description
              status
              chapters
              genres
            }
          }
        }
      `;

      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables: { search: query },
        }),
      });

      if (!response.ok) {
        throw new Error(`AniList API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data?.Page?.media) {
        return [];
      }

      return data.data.Page.media.map((manga: any) => ({
        id: manga.id,
        title:
          manga.title?.english ||
          manga.title?.romaji ||
          manga.title?.native ||
          'Unknown Title',
        coverImage:
          manga.coverImage?.large ||
          manga.coverImage?.medium ||
          'https://via.placeholder.com/256x384?text=No+Cover',
        description: manga.description || 'No description available',
        status: manga.status,
        chapters: manga.chapters,
        source: 'anilist' as const,
      }));
    } catch (err: any) {
      console.error('AniList search error:', err);
      throw new Error('AniList API is currently unavailable. Try MangaDex instead.');
    }
  };

  const searchMangaPlus = async (query: string) => {
    try {
      const titleGroups = await mangaPlus.searchTitles(query);

      return titleGroups.flatMap((group) =>
        group.titles
          .filter((title) => title.language === 'ENGLISH')
          .map((title) => ({
            id: title.titleId.toString(),
            title: title.name,
            coverImage: title.portraitImageUrl,
            description: '',
            status: title.titleUpdateStatus,
            author: title.author,
            viewCount: title.viewCount,
            source: 'mangaplus' as const,
          }))
      );
    } catch (err) {
      console.error('MangaPlus search error:', err);
      return [];
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      if (selectedSource === 'mangaplus') {
        setResults(trendingManga);
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let searchResults: MangaResult[] = [];

      if (selectedSource === 'mangadex') {
        searchResults = await searchMangaDex(searchQuery);
      } else if (selectedSource === 'anilist') {
        searchResults = await searchAniList(searchQuery);
      } else if (selectedSource === 'mangaplus') {
        searchResults = await searchMangaPlus(searchQuery);
      }

      setResults(searchResults);

      if (searchResults.length === 0) {
        setError('No results found. Try a different search term.');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || `Failed to search ${selectedSource}. Please try again.`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setResults([]);
    setError(null);
  };

  const openManga = (manga: MangaResult) => {
    router.push({
      pathname: '/manga-details',
      params: {
        id: manga.id,
        title: manga.title,
        coverImage: manga.coverImage,
        description: manga.description || '',
        status: manga.status || '',
        chapters: manga.chapters?.toString() || '',
        source: manga.source,
        author: manga.author || '',
        viewCount: manga.viewCount?.toString() || '',
      },
    });
  };

  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '').substring(0, 120) + (html.length > 120 ? '…' : '');
  };

  const renderMangaRow = (manga: MangaResult) => {
    const metaParts = [
      manga.source.toUpperCase(),
      manga.status?.replace(/_/g, ' '),
      manga.chapters ? `${manga.chapters} ch` : null,
      manga.viewCount && manga.viewCount > 0
        ? `${manga.viewCount.toLocaleString()} views`
        : null,
    ].filter(Boolean);

    return (
      <TouchableOpacity
        key={`${manga.source}-${manga.id}`}
        style={styles.mangaRow}
        onPress={() => openManga(manga)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: manga.coverImage }}
          style={styles.mangaCover}
          resizeMode="cover"
        />
        <View style={styles.mangaInfo}>
          <Text style={styles.metaLine} numberOfLines={1}>
            {metaParts.join('  ·  ')}
          </Text>
          <Text style={styles.mangaTitle} numberOfLines={2}>
            {manga.title}
          </Text>
          {manga.author ? (
            <Text style={styles.mangaAuthor} numberOfLines={1}>
              {manga.author}
            </Text>
          ) : null}
          {manga.description ? (
            <Text style={styles.mangaDescription} numberOfLines={2}>
              {stripHtml(manga.description)}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const showingResults = results.length > 0;
  const showingTrending =
    !showingResults &&
    !loading &&
    !error &&
    selectedSource === 'mangaplus' &&
    trendingManga.length > 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerLabel}>Manga</Text>

        <View style={styles.sourceSelector}>
          {SOURCES.map((source) => {
            const active = selectedSource === source.id;
            return (
              <TouchableOpacity
                key={source.id}
                style={[styles.sourceButton, active && styles.sourceButtonActive]}
                onPress={() => {
                  setSelectedSource(source.id);
                  setResults([]);
                  setSearchQuery('');
                  setError(null);
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.sourceButtonText, active && styles.sourceButtonTextActive]}
                >
                  {source.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search manga..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            activeOpacity={0.85}
          >
            <Text style={styles.searchButtonText}>Go</Text>
          </TouchableOpacity>
        </View>

        {showingResults && (
          <Text style={styles.resultCount}>
            {results.length} result{results.length === 1 ? '' : 's'}
          </Text>
        )}
      </View>

      <ScrollView
        style={styles.resultsContainer}
        contentContainerStyle={styles.resultsContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Searching {selectedSource}...</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyContainer}>
            <AlertCircle size={40} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>Something went wrong</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleSearch}
              activeOpacity={0.85}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : showingResults ? (
          <View style={styles.list}>{results.map(renderMangaRow)}</View>
        ) : showingTrending ? (
          <View>
            <View style={styles.sectionHeader}>
              <TrendingUp size={14} color={Colors.accent} />
              <Text style={styles.sectionLabel}>Trending</Text>
            </View>
            <View style={styles.list}>{trendingManga.map(renderMangaRow)}</View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <BookOpen size={40} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>Discover manga</Text>
            <Text style={styles.emptyText}>
              MangaPlus for official titles, MangaDex for scans, AniList for discovery
            </Text>
          </View>
        )}
      </ScrollView>
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
  sourceSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sourceButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  sourceButtonActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.card,
  },
  sourceButtonText: {
    fontFamily: Fonts.GeistMono.SemiBold,
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  sourceButtonTextActive: {
    color: Colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingLeft: 14,
    paddingRight: 6,
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
  searchButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  searchButtonText: {
    color: '#000',
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Bold,
  },
  resultCount: {
    marginTop: 12,
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Medium,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsContent: {
    paddingBottom: 48,
    flexGrow: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  list: {
    paddingHorizontal: 16,
  },
  mangaRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  mangaCover: {
    width: 72,
    height: 108,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  mangaInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 2,
  },
  metaLine: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  mangaTitle: {
    fontSize: 15,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  mangaAuthor: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  mangaDescription: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    gap: 14,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
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
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#000',
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Bold,
  },
});
