import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useMangaPlus } from '@/hooks/useMangaPlus';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, ChevronDown, ExternalLink, Heart } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface Chapter {
  id: string;
  title: string;
  chapter: string;
  pages?: number;
}

interface MangaDetails {
  id: string;
  title: string;
  coverImage: string;
  description: string;
  status: string;
  chapters?: number;
  genres?: string[];
  chapters_list?: Chapter[];
  source: 'mangadex' | 'anilist' | 'mangaplus';
  author?: string;
  viewCount?: number;
  rating?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MangaDetailsScreen() {
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    coverImage: string;
    description: string;
    status: string;
    chapters?: string;
    source: 'mangadex' | 'anilist' | 'mangaplus';
    author?: string;
    viewCount?: string;
  }>();

  const router = useRouter();
  const mangaPlus = useMangaPlus();
  const [details, setDetails] = useState<MangaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayedChapterCount, setDisplayedChapterCount] = useState(20);
  const [isFavorite, setIsFavorite] = useState(false);
  
  const CHAPTERS_PER_PAGE = 20;
  const PAGINATION_THRESHOLD = 30;

  useEffect(() => {
    // Wait for MangaPlus to initialize if needed
    if (params.source === 'mangaplus' && !mangaPlus.isInitialized) {
      // Wait a bit for initialization
      const timer = setTimeout(() => {
        if (mangaPlus.isInitialized) {
          loadMangaDetails();
        }
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      loadMangaDetails();
    }
  }, [params.id, params.source, mangaPlus.isInitialized]);

  const loadMangaDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      if (params.source === 'mangaplus') {
        await loadMangaPlusDetails();
      } else if (params.source === 'mangadex') {
        await loadMangaDexDetails();
      } else {
        await loadAniListDetails();
      }
    } catch (err: any) {
      console.error('Error loading manga details:', err);
      setError(err.message || 'Failed to load manga details');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreChapters = () => {
    const totalChapters = details?.chapters_list?.length || 0;
    const newCount = Math.min(displayedChapterCount + CHAPTERS_PER_PAGE, totalChapters);
    setDisplayedChapterCount(newCount);
  };

  const loadMangaPlusDetails = async () => {
    try {
      if (!mangaPlus.isInitialized) {
        console.log('Waiting for MangaPlus initialization...');
        // Wait up to 5 seconds for initialization
        let attempts = 0;
        while (!mangaPlus.isInitialized && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
        
        if (!mangaPlus.isInitialized) {
          throw new Error('MangaPlus initialization timeout. Please try again.');
        }
      }

      console.log('Fetching MangaPlus title details for ID:', params.id);
      const titleDetails = await mangaPlus.fetchTitleDetails(parseInt(params.id));
      
      if (!titleDetails) {
        throw new Error('Failed to fetch MangaPlus details');
      }

      console.log('MangaPlus title details received:', titleDetails.title.name);

      const allChapters: Chapter[] = [];
      
      (titleDetails.chapterListV2 || []).forEach((ch: any) => {
        allChapters.push({
          id: ch.chapterId.toString(),
          title: ch.subTitle || ch.name,
          chapter: ch.name.replace('#', ''),
          pages: 0,
        });
      });

      console.log('Total chapters found:', allChapters.length);

      setDetails({
        id: params.id,
        title: titleDetails.title.name,
        coverImage: titleDetails.titleImageUrl || titleDetails.title.portraitImageUrl,
        description: titleDetails.overview,
        status: titleDetails.isSimulReleased ? 'Ongoing' : 'Completed',
        chapters: allChapters.length,
        genres: titleDetails.tags.map((tag: any) => tag.tag),
        chapters_list: allChapters,
        source: 'mangaplus',
        author: titleDetails.title.author,
        viewCount: titleDetails.numberOfViews,
        rating: titleDetails.rating,
      });
    } catch (err) {
      console.error('MangaPlus details error:', err);
      throw new Error('Failed to load MangaPlus details. Please try again.');
    }
  };

  const loadMangaDexDetails = async () => {
    try {
      // Get manga details
      const response = await fetch(
        `https://api.mangadex.org/manga/${params.id}?includes[]=cover_art&includes[]=author&includes[]=artist`
      );
      const data = await response.json();

      // Get chapters
      const chaptersResponse = await fetch(
        `https://api.mangadex.org/manga/${params.id}/feed?translatedLanguage[]=en&order[chapter]=asc&limit=500`
      );
      const chaptersData = await chaptersResponse.json();

      const chapters_list = chaptersData.data.map((ch: any) => ({
        id: ch.id,
        title: ch.attributes.title || `Chapter ${ch.attributes.chapter}`,
        chapter: ch.attributes.chapter,
        pages: ch.attributes.pages,
      }));

      setDetails({
        id: params.id,
        title: params.title,
        coverImage: params.coverImage,
        description: params.description,
        status: params.status,
        chapters: chaptersData.total,
        genres: data.data.attributes.tags?.slice(0, 5).map((tag: any) => tag.attributes.name.en) || [],
        chapters_list,
        source: 'mangadex',
      });
    } catch (err) {
      throw new Error('Failed to load MangaDex details');
    }
  };

  const loadAniListDetails = async () => {
    try {
      const query = `
        query ($id: Int) {
          Media(id: $id, type: MANGA) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              extraLarge
            }
            bannerImage
            description
            status
            chapters
            genres
            averageScore
            siteUrl
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
          query,
          variables: { id: parseInt(params.id) },
        }),
      });

      const data = await response.json();
      const manga = data.data.Media;

      // AniList doesn't provide chapter reading, only metadata
      setDetails({
        id: params.id,
        title: manga.title.english || manga.title.romaji || manga.title.native,
        coverImage: manga.coverImage.extraLarge || manga.coverImage.large,
        description: manga.description,
        status: manga.status,
        chapters: manga.chapters,
        genres: manga.genres || [],
        chapters_list: undefined,
        source: 'anilist',
      });
    } catch (err) {
      console.error('loadAniListDetails error:', err);
      throw new Error('Failed to load AniList details');
    }
  };

  const toggleFavorite = async () => {
    if (params.source !== 'mangaplus') return;
    
    try {
      if (isFavorite) {
        await mangaPlus.removeFavorite(parseInt(params.id));
        setIsFavorite(false);
      } else {
        await mangaPlus.addFavorite(parseInt(params.id));
        setIsFavorite(true);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const openInBrowser = () => {
    if (params.source === 'mangadex') {
      Linking.openURL(`https://mangadex.org/title/${params.id}`);
    } else if (params.source === 'mangaplus') {
      Linking.openURL(`https://mangaplus.shueisha.co.jp/titles/${params.id}`);
    } else {
      Linking.openURL(`https://anilist.co/manga/${params.id}`);
    }
  };

  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading manga details...</Text>
        </View>
      </View>
    );
  }

  if (error || !details) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Error</Text>
          <Text style={styles.errorText}>{error || 'Failed to load manga'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMangaDetails}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <Image 
            source={{ uri: details.coverImage }} 
            style={styles.backdrop}
            blurRadius={5}
          />
          
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)', Colors.background]}
            style={styles.gradient}
          />

          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>

          {params.source === 'mangaplus' ? (
            <TouchableOpacity 
              style={styles.favoriteButton} 
              onPress={toggleFavorite}
            >
              <Heart 
                size={24} 
                color={isFavorite ? '#ff4444' : '#fff'} 
                fill={isFavorite ? '#ff4444' : 'none'}
              />
            </TouchableOpacity>
          ) : null}

          <View style={styles.heroContent}>
            <Image
              source={{ uri: details.coverImage }}
              style={styles.coverImage}
            />
            <View style={styles.heroInfo}>
              <Text style={styles.title} numberOfLines={3}>
                {details.title}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaText}>{details.status}</Text>
                </View>
                {details.chapters ? (
                  <View style={styles.metaChip}>
                    <BookOpen size={12} color={Colors.accent} />
                    <Text style={styles.metaText}>{details.chapters} ch</Text>
                  </View>
                ) : null}
                <View style={styles.metaChip}>
                  <Text style={styles.metaText}>{details.source}</Text>
                </View>
                {details.rating ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaText}>{details.rating}</Text>
                  </View>
                ) : null}
              </View>
              {details.author ? (
                <Text style={styles.authorText}>by {details.author}</Text>
              ) : null}
              {details.viewCount && details.viewCount > 0 ? (
                <Text style={styles.viewCountText}>
                  {details.viewCount.toLocaleString()} views
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Genres */}
          {details.genres && details.genres.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Genres</Text>
              <View style={styles.genresContainer}>
                {details.genres.map((genre, index) => (
                  <View key={index} style={styles.genreChip}>
                    <Text style={styles.genreText}>{genre}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Synopsis</Text>
            <Text style={styles.description}>{stripHtml(details.description)}</Text>
          </View>

          {/* Actions */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.actionButton} onPress={openInBrowser}>
              <ExternalLink size={20} color={Colors.text} />
              <Text style={styles.actionButtonText}>
                Open in {details.source === 'mangadex' ? 'MangaDex' : details.source === 'mangaplus' ? 'MangaPlus' : 'AniList'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Chapters */}
          {details.chapters_list && details.chapters_list.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chapters</Text>
              
              {details.chapters_list.slice(0, displayedChapterCount).map((chapter) => (
                <TouchableOpacity
                  key={chapter.id}
                  style={styles.chapterCard}
                  onPress={() => {
                    router.push({
                      pathname: '/manga-reader',
                      params: {
                        chapterId: chapter.id,
                        chapterTitle: chapter.title,
                        mangaId: details.id,
                        mangaTitle: details.title,
                        source: details.source,
                      },
                    });
                  }}
                >
                  <BookOpen size={20} color={Colors.accent} />
                  <View style={styles.chapterInfo}>
                    <Text style={styles.chapterTitle}>{chapter.title}</Text>
                    <Text style={styles.chapterMeta}>
                      Chapter {chapter.chapter}
                      {chapter.pages ? ` • ${chapter.pages} pages` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {details.chapters_list.length > PAGINATION_THRESHOLD && 
               displayedChapterCount < details.chapters_list.length ? (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={loadMoreChapters}
                >
                  <Text style={styles.loadMoreText}>
                    Load More ({displayedChapterCount} of {details.chapters_list.length})
                  </Text>
                  <ChevronDown size={16} color={Colors.accent} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Info Messages */}
          {details.source === 'anilist' && !details.chapters_list ? (
            <View style={styles.noteSection}>
              <Text style={styles.noteText}>
                📖 Reading Not Available{'\n\n'}
                AniList is a database and tracking service. It doesn't provide chapter reading.{'\n\n'}
                Options:{'\n'}
                • Click "Open in AniList" above to find official reading sources{'\n'}
                • Try searching for this manga on MangaDex or MangaPlus instead
              </Text>
            </View>
          ) : null}

          {details.source === 'mangaplus' && details.chapters_list && details.chapters_list.length > 0 ? (
            <View style={styles.noteSection}>
              <Text style={styles.noteText}>
                ✨ Official manga from Shueisha. Tap any chapter to start reading!
              </Text>
            </View>
          ) : null}

          {details.source === 'mangadex' && details.chapters_list && details.chapters_list.length > 0 ? (
            <View style={styles.noteSection}>
              <Text style={styles.noteText}>
                📚 Community scanlations. Tap any chapter to start reading!
              </Text>
            </View>
          ) : null}
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
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  heroContainer: {
    height: SCREEN_HEIGHT * 0.5,
    position: 'relative',
  },
  backdrop: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.5,
    position: 'absolute',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.3,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  favoriteButton: {
    position: 'absolute',
    top: 50,
    right: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  heroContent: {
    position: 'absolute',
    bottom: 20,
    left: 15,
    right: 15,
    flexDirection: 'row',
    gap: 15,
  },
  coverImage: {
    width: 120,
    height: 180,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  heroInfo: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.accent,
    textTransform: 'capitalize',
  },
  authorText: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  viewCountText: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.accent,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  contentSection: {
    padding: 15,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginBottom: 15,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreChip: {
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  genreText: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.text,
  },
  description: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
  },
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
    marginBottom: 4,
  },
  chapterMeta: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 10,
    marginTop: 10,
  },
  loadMoreText: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.accent,
  },
  noteSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  noteText: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    padding: 15,
    borderRadius: 8,
    lineHeight: 20,
  },
});
