import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useMangaPlus } from '@/hooks/useMangaPlus';
import { useRouter } from 'expo-router';
import { BookOpen, Search, TrendingUp } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface MangaResult {
  id: string;
  title: string;
  coverImage: string;
  description?: string;
  status?: string;
  chapters?: number;
  source: 'mangadex' | 'anilist' | 'mangaplus';
  author?: string;
  viewCount?: number;
}

export default function MangaScreen() {
  const router = useRouter();
  const mangaPlus = useMangaPlus();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<MangaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<'mangadex' | 'anilist' | 'mangaplus'>('mangaplus');
  const [trendingManga, setTrendingManga] = useState<MangaResult[]>([]);

  // Load trending manga from MangaPlus on mount
  useEffect(() => {
    if (mangaPlus.isInitialized && selectedSource === 'mangaplus') {
      loadMangaPlusTrending();
    }
  }, [mangaPlus.isInitialized, selectedSource]);

  const loadMangaPlusTrending = async () => {
    try {
      const rankings = await mangaPlus.fetchRanking('hottest');
      // Filter to show only English versions
      const trending = rankings.slice(0, 20).flatMap(ranking => 
        ranking.titles
          .filter(title => title.language === 'ENGLISH')
          .map(title => ({
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
    } catch (error) {
      console.error('Error loading MangaPlus trending:', error);
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
          title: manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title',
          coverImage,
          description: manga.attributes.description?.en || 'No description available',
          status: manga.attributes.status,
          source: 'mangadex' as const,
        };
      });
    } catch (error) {
      console.error('MangaDex search error:', error);
      return [];
    }
  };

  const searchAniList = async (query: string) => {
    try {
      console.log('Searching AniList for:', query);
      
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
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables: { search: query }
        })
      });
      
      console.log('AniList response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`AniList API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('AniList response received');
      
      if (!data.data?.Page?.media) {
        console.error('Unexpected AniList response format:', data);
        return [];
      }
      
      return data.data.Page.media.map((manga: any) => ({
        id: manga.id,
        title: manga.title?.english || manga.title?.romaji || manga.title?.native || 'Unknown Title',
        coverImage: manga.coverImage?.large || manga.coverImage?.medium || 'https://via.placeholder.com/256x384?text=No+Cover',
        description: manga.description || 'No description available',
        status: manga.status,
        chapters: manga.chapters,
        source: 'anilist' as const,
      }));
    } catch (error: any) {
      console.error('AniList search error:', error);
      console.error('Error message:', error.message);
      throw new Error('AniList API is currently unavailable. Try MangaDex instead.');
    }
  };

  const searchMangaPlus = async (query: string) => {
    try {
      console.log('Searching MangaPlus for:', query);
      const titleGroups = await mangaPlus.searchTitles(query);
      
      // Filter to show only English versions
      return titleGroups.flatMap(group => 
        group.titles
          .filter(title => title.language === 'ENGLISH')
          .map(title => ({
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
    } catch (error) {
      console.error('MangaPlus search error:', error);
      return [];
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      // If no search query, show trending for MangaPlus
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
    } catch (error: any) {
      console.error('Search error:', error);
      setError(error.message || `Failed to search ${selectedSource}. Please try again.`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '').substring(0, 150) + '...';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manga</Text>
        <Text style={styles.headerSubtitle}>Discover and read manga</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.sourceSelector}>
          <TouchableOpacity
            style={[
              styles.sourceButton,
              selectedSource === 'mangaplus' && styles.sourceButtonActive,
            ]}
            onPress={() => {
              setSelectedSource('mangaplus');
              setResults([]);
              setSearchQuery('');
            }}
          >
            <Text
              style={[
                styles.sourceButtonText,
                selectedSource === 'mangaplus' && styles.sourceButtonTextActive,
              ]}
            >
              MangaPlus
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sourceButton,
              selectedSource === 'mangadex' && styles.sourceButtonActive,
            ]}
            onPress={() => {
              setSelectedSource('mangadex');
              setResults([]);
              setSearchQuery('');
            }}
          >
            <Text
              style={[
                styles.sourceButtonText,
                selectedSource === 'mangadex' && styles.sourceButtonTextActive,
              ]}
            >
              MangaDex
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sourceButton,
              selectedSource === 'anilist' && styles.sourceButtonActive,
            ]}
            onPress={() => {
              setSelectedSource('anilist');
              setResults([]);
              setSearchQuery('');
            }}
          >
            <Text
              style={[
                styles.sourceButtonText,
                selectedSource === 'anilist' && styles.sourceButtonTextActive,
              ]}
            >
              AniList
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search manga..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Search size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.resultsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Searching {selectedSource}...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>⚠️ Error</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleSearch}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : results.length > 0 ? (
          <View style={styles.resultsGrid}>
            {results.map((manga) => (
              <TouchableOpacity
                key={manga.id}
                style={styles.mangaCard}
                onPress={() => {
                  console.log('Open manga:', manga.title);
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
                }}
              >
                <Image
                  source={{ uri: manga.coverImage }}
                  style={styles.mangaCover}
                  resizeMode="cover"
                />
                <View style={styles.mangaInfo}>
                  <Text style={styles.mangaTitle} numberOfLines={2}>
                    {manga.title}
                  </Text>
                  {manga.author ? (
                    <Text style={styles.mangaAuthor} numberOfLines={1}>
                      {manga.author}
                    </Text>
                  ) : null}
                  {manga.status ? (
                    <Text style={styles.mangaStatus}>{manga.status}</Text>
                  ) : null}
                  {manga.chapters ? (
                    <Text style={styles.mangaChapters}>{manga.chapters} chapters</Text>
                  ) : null}
                  {manga.viewCount && manga.viewCount > 0 ? (
                    <Text style={styles.mangaViews}>
                      {manga.viewCount.toLocaleString()} views
                    </Text>
                  ) : null}
                  {manga.description ? (
                    <Text style={styles.mangaDescription} numberOfLines={2}>
                      {stripHtml(manga.description)}
                    </Text>
                  ) : null}
                  <View style={styles.sourceTag}>
                    <Text style={styles.sourceTagText}>{manga.source}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : selectedSource === 'mangaplus' && trendingManga.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>
                <TrendingUp size={16} color="#fff" /> Trending on MangaPlus</Text>
            <View style={styles.resultsGrid}>
              {trendingManga.map((manga) => (
                <TouchableOpacity
                  key={manga.id}
                  style={styles.mangaCard}
                  onPress={() => {
                    router.push({
                      pathname: '/manga-details',
                      params: {
                        id: manga.id,
                        title: manga.title,
                        coverImage: manga.coverImage,
                        description: manga.description || '',
                        status: manga.status || '',
                        source: manga.source,
                        author: manga.author || '',
                        viewCount: manga.viewCount?.toString() || '',
                      },
                    });
                  }}
                >
                  <Image
                    source={{ uri: manga.coverImage }}
                    style={styles.mangaCover}
                    resizeMode="cover"
                  />
                  <View style={styles.mangaInfo}>
                    <Text style={styles.mangaTitle} numberOfLines={2}>
                      {manga.title}
                    </Text>
                    {manga.author ? (
                      <Text style={styles.mangaAuthor} numberOfLines={1}>
                        {manga.author}
                      </Text>
                    ) : null}
                    {manga.viewCount && manga.viewCount > 0 ? (
                      <Text style={styles.mangaViews}>
                        {manga.viewCount.toLocaleString()} views
                      </Text>
                    ) : null}
                    <View style={styles.sourceTag}>
                      <Text style={styles.sourceTagText}>{manga.source}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <BookOpen size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyStateTitle}>Search for Manga</Text>
            <Text style={styles.emptyStateText}>
              MangaPlus: Official Shueisha manga • MangaDex: High-quality scans • AniList: Comprehensive database
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
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 15,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    marginTop: 5,
  },
  searchContainer: {
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  sourceSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  sourceButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  sourceButtonActive: {
    backgroundColor: Colors.accent,
  },
  sourceButtonText: {
    fontFamily: Fonts.GeistMono.SemiBold,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sourceButtonTextActive: {
    color: Colors.text,
  },
  searchInputContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    color: Colors.text,
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Regular,
  },
  searchButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 15,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
  resultsGrid: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  mangaCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
  },
  mangaCover: {
    width: 100,
    height: 150,
  },
  mangaInfo: {
    flex: 1,
    padding: 12,
  },
  mangaTitle: {
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginBottom: 5,
  },
  mangaAuthor: {
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    marginBottom: 3,
    fontStyle: 'italic',
  },
  mangaStatus: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.accent,
    marginBottom: 3,
    textTransform: 'capitalize',
  },
  mangaChapters: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  mangaViews: {
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  mangaDescription: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    paddingHorizontal: 15,
    marginBottom: 15,
    marginTop: 10,
  },
  sourceTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sourceTagText: {
    fontSize: 10,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Bold,
  },
});
