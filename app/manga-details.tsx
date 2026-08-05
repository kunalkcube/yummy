import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useMangaPlus } from '@/hooks/useMangaPlus';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ExternalLink,
  Heart,
} from 'lucide-react-native';
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.48;

const CHAPTERS_PER_PAGE = 20;
const PAGINATION_THRESHOLD = 30;

const SOURCE_LABELS = {
  mangadex: 'MangaDex',
  mangaplus: 'MangaPlus',
  anilist: 'AniList',
} as const;

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
  const insets = useSafeAreaInsets();
  const mangaPlus = useMangaPlus();
  const [details, setDetails] = useState<MangaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayedChapterCount, setDisplayedChapterCount] = useState(20);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (params.source === 'mangaplus' && !mangaPlus.isInitialized) {
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
        let attempts = 0;
        while (!mangaPlus.isInitialized && attempts < 10) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          attempts++;
        }

        if (!mangaPlus.isInitialized) {
          throw new Error('MangaPlus initialization timeout. Please try again.');
        }
      }

      const titleDetails = await mangaPlus.fetchTitleDetails(parseInt(params.id));

      if (!titleDetails) {
        throw new Error('Failed to fetch MangaPlus details');
      }

      const allChapters: Chapter[] = [];

      (titleDetails.chapterListV2 || []).forEach((ch: any) => {
        allChapters.push({
          id: ch.chapterId.toString(),
          title: ch.subTitle || ch.name,
          chapter: ch.name.replace('#', ''),
          pages: 0,
        });
      });

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
      const response = await fetch(
        `https://api.mangadex.org/manga/${params.id}?includes[]=cover_art&includes[]=author&includes[]=artist`
      );
      const data = await response.json();

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
        genres:
          data.data.attributes.tags?.slice(0, 5).map((tag: any) => tag.attributes.name.en) ||
          [],
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
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { id: parseInt(params.id) },
        }),
      });

      const data = await response.json();
      const manga = data.data.Media;

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
          <AlertCircle size={48} color={Colors.textSecondary} />
          <Text style={styles.errorTitle}>Failed to load</Text>
          <Text style={styles.errorText}>{error || 'Couldn’t load this manga.'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadMangaDetails}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const sourceLabel = SOURCE_LABELS[details.source];
  const statusLabel = details.status?.replace(/_/g, ' ');
  const firstChapter = details.chapters_list?.[0];

  const openChapter = (chapter: Chapter) => {
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
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroContainer}>
          <Image source={{ uri: details.coverImage }} style={styles.backdrop} blurRadius={8} />

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

          {params.source === 'mangaplus' ? (
            <TouchableOpacity
              style={[styles.favoriteButton, { top: insets.top + 8 }]}
              onPress={toggleFavorite}
              activeOpacity={0.85}
              accessibilityLabel={isFavorite ? 'Remove favorite' : 'Add favorite'}
            >
              <Heart
                size={20}
                color={isFavorite ? Colors.accent : '#fff'}
                fill={isFavorite ? Colors.accent : 'none'}
              />
            </TouchableOpacity>
          ) : null}

          <Animated.View entering={FadeInDown.duration(250)} style={styles.heroContent}>
            <Image source={{ uri: details.coverImage }} style={styles.coverImage} />
            <View style={styles.heroInfo}>
              <View style={styles.heroMetaLine}>
                <Text style={styles.heroMetaText}>{sourceLabel.toUpperCase()}</Text>
                {statusLabel ? (
                  <>
                    <Text style={styles.heroMetaDot}>·</Text>
                    <Text style={styles.heroMetaText}>{statusLabel.toUpperCase()}</Text>
                  </>
                ) : null}
                {details.chapters ? (
                  <>
                    <Text style={styles.heroMetaDot}>·</Text>
                    <Text style={styles.heroMetaText}>{details.chapters} CH</Text>
                  </>
                ) : null}
                {details.rating ? (
                  <>
                    <Text style={styles.heroMetaDot}>·</Text>
                    <Text style={styles.heroMetaText}>{details.rating}</Text>
                  </>
                ) : null}
              </View>

              <Text style={styles.title} numberOfLines={3}>
                {details.title}
              </Text>

              {details.author ? (
                <Text style={styles.authorText} numberOfLines={1}>
                  {details.author}
                </Text>
              ) : null}

              {details.viewCount && details.viewCount > 0 ? (
                <Text style={styles.viewCountText}>
                  {details.viewCount.toLocaleString()} views
                </Text>
              ) : null}
            </View>
          </Animated.View>
        </View>

        <View style={styles.content}>
          {firstChapter ? (
            <TouchableOpacity
              style={styles.readButton}
              onPress={() => openChapter(firstChapter)}
              activeOpacity={0.85}
            >
              <BookOpen size={18} color="#000" />
              <Text style={styles.readButtonText}>Read Chapter {firstChapter.chapter}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.readButton}
              onPress={openInBrowser}
              activeOpacity={0.85}
            >
              <ExternalLink size={18} color="#000" />
              <Text style={styles.readButtonText}>Open in {sourceLabel}</Text>
            </TouchableOpacity>
          )}

          {details.genres && details.genres.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Genres</Text>
              <Text style={styles.genreLine} numberOfLines={2}>
                {details.genres.join('  ·  ')}
              </Text>
            </View>
          ) : null}

          {details.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Synopsis</Text>
              <Text style={styles.description}>{stripHtml(details.description)}</Text>
            </View>
          ) : null}

          {firstChapter ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={openInBrowser}
              activeOpacity={0.85}
            >
              <ExternalLink size={16} color={Colors.text} />
              <Text style={styles.secondaryButtonText}>Open in {sourceLabel}</Text>
            </TouchableOpacity>
          ) : null}

          {details.chapters_list && details.chapters_list.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Chapters</Text>
              <View style={styles.chapterList}>
                {details.chapters_list.slice(0, displayedChapterCount).map((chapter) => (
                  <TouchableOpacity
                    key={chapter.id}
                    style={styles.chapterRow}
                    onPress={() => openChapter(chapter)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.chapterNumber}>{chapter.chapter}</Text>
                    <View style={styles.chapterInfo}>
                      <Text style={styles.chapterTitle} numberOfLines={1}>
                        {chapter.title}
                      </Text>
                      {chapter.pages ? (
                        <Text style={styles.chapterMeta}>{chapter.pages} pages</Text>
                      ) : null}
                    </View>
                    <BookOpen size={18} color={Colors.accent} />
                  </TouchableOpacity>
                ))}
              </View>

              {details.chapters_list.length > PAGINATION_THRESHOLD &&
              displayedChapterCount < details.chapters_list.length ? (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={loadMoreChapters}
                  activeOpacity={0.85}
                >
                  <Text style={styles.loadMoreText}>
                    Load More ({displayedChapterCount} of {details.chapters_list.length})
                  </Text>
                  <ChevronDown size={16} color={Colors.accent} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {details.source === 'anilist' && !details.chapters_list ? (
            <View style={styles.noteSection}>
              <Text style={styles.noteText}>
                AniList is a database and doesn’t provide chapter reading. Open in AniList for
                official sources, or search this title on MangaDex / MangaPlus.
              </Text>
            </View>
          ) : null}

          {details.source === 'mangaplus' &&
          details.chapters_list &&
          details.chapters_list.length > 0 ? (
            <View style={styles.noteSection}>
              <Text style={styles.noteText}>
                Official Shueisha manga. Tap a chapter to start reading.
              </Text>
            </View>
          ) : null}

          {details.source === 'mangadex' &&
          details.chapters_list &&
          details.chapters_list.length > 0 ? (
            <View style={styles.noteSection}>
              <Text style={styles.noteText}>
                Community scanlations. Tap a chapter to start reading.
              </Text>
            </View>
          ) : null}

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
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
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
    fontSize: 18,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
  },
  errorText: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
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
    height: HERO_HEIGHT,
    position: 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  favoriteButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
  coverImage: {
    width: 104,
    height: 156,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  heroInfo: {
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
  title: {
    fontSize: 24,
    fontFamily: Fonts.GeistMono.Bold,
    color: '#fff',
    lineHeight: 30,
    letterSpacing: -0.4,
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  authorText: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  viewCountText: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: 'rgba(255,255,255,0.55)',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    marginBottom: 28,
  },
  readButtonText: {
    color: '#000',
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Bold,
    letterSpacing: 0.3,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 28,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
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
  genreLine: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    lineHeight: 20,
  },
  description: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  chapterList: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  chapterNumber: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.accent,
    minWidth: 36,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
    marginBottom: 2,
  },
  chapterMeta: {
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 8,
    marginTop: 10,
  },
  loadMoreText: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.accent,
  },
  noteSection: {
    marginBottom: 20,
  },
  noteText: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 8,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 48,
  },
});
