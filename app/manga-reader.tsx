import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useMangaPlus } from '@/hooks/useMangaPlus';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2, RotateCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

interface Page {
  url: string;
  index: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MangaReaderScreen() {
  const params = useLocalSearchParams<{
    chapterId: string;
    chapterTitle: string;
    mangaId: string;
    mangaTitle: string;
    source: 'mangadex' | 'anilist' | 'mangaplus';
  }>();

  const router = useRouter();
  const mangaPlus = useMangaPlus();
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  // Zoom animation values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    loadChapterPages();
  }, [params.chapterId]);

  const loadChapterPages = async () => {
    setLoading(true);
    setError(null);

    try {
      if (params.source === 'mangadex') {
        await loadMangaDexPages();
      } else if (params.source === 'mangaplus') {
        await loadMangaPlusPages();
      } else {
        await loadAniListPages();
      }
    } catch (err: any) {
      console.error('Error loading pages:', err);
      setError(err.message || 'Failed to load chapter pages');
    } finally {
      setLoading(false);
    }
  };

  const loadMangaPlusPages = async () => {
    try {
      console.log('📖 Loading MangaPlus chapter:', params.chapterId);
      
      const chapterId = parseInt(params.chapterId);
      if (isNaN(chapterId)) {
        throw new Error('Invalid chapter ID');
      }

      // Simply fetch - the hook will handle initialization
      console.log('🚀 Fetching chapter pages for:', chapterId);
      const pageUrls = await mangaPlus.fetchChapterPages(chapterId);
      
      if (!pageUrls || pageUrls.length === 0) {
        throw new Error('No pages found for this chapter. It may not be available yet.');
      }

      console.log(`✅ Loaded ${pageUrls.length} pages from MangaPlus`);

      const pages = pageUrls.map((url, index) => ({
        url,
        index,
      }));

      setPages(pages);
    } catch (err: any) {
      console.error('❌ MangaPlus pages error:', err);
      throw new Error(err.message || 'Failed to load MangaPlus pages');
    }
  };

  const loadMangaDexPages = async () => {
    try {
      // Get chapter pages from MangaDex At-Home server
      const response = await fetch(
        `https://api.mangadex.org/at-home/server/${params.chapterId}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch chapter pages');
      }

      const data = await response.json();
      
      if (!data.chapter || !data.chapter.data) {
        throw new Error('No pages found for this chapter');
      }

      const baseUrl = data.baseUrl;
      const chapterHash = data.chapter.hash;
      const pageFiles = data.chapter.data; // High quality pages

      const pageUrls = pageFiles.map((filename: string, index: number) => ({
        url: `${baseUrl}/data/${chapterHash}/${filename}`,
        index,
      }));

      setPages(pageUrls);
    } catch (err) {
      throw new Error('Failed to load MangaDex pages');
    }
  };

  const loadAniListPages = async () => {
    try {
      console.log('Loading AniList chapter:', params.chapterId);
      
      // Use Consumet API to get chapter pages
      const response = await fetch(
        `https://api.consumet.org/meta/anilist-manga/read?chapterId=${encodeURIComponent(params.chapterId)}`
      );
      
      console.log('Consumet response status:', response.status);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chapter from Consumet API');
      }

      const text = await response.text();
      
      // Check if response is HTML (error page)
      if (text.trim().startsWith('<')) {
        console.error('Consumet returned HTML instead of JSON');
        throw new Error('Consumet API is currently unavailable. This manga may not be available for reading.');
      }
      
      const data = JSON.parse(text);
      console.log('Consumet data received, pages:', data.length);
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No pages found for this chapter');
      }

      // Consumet returns array of page objects with 'img' or 'page' property
      const pageUrls = data.map((page: any, index: number) => ({
        url: page.img || page.page || page.url || page,
        index,
      }));

      setPages(pageUrls);
    } catch (err: any) {
      console.error('AniList pages error:', err);
      throw new Error(err.message || 'Failed to load AniList pages. This manga may not be available for reading.');
    }
  };

  const goToNextPage = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
      setImageLoading(true);
      scale.value = withSpring(1);
      savedScale.value = 1;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setImageLoading(true);
      scale.value = withSpring(1);
      savedScale.value = 1;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    }
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
    setShowControls(!fullscreen); // Show controls when exiting fullscreen
  };

  const resetZoom = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  };

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      } else if (scale.value > 3) {
        scale.value = withSpring(3);
        savedScale.value = 3;
      }
    });

  // Pan gesture for moving zoomed image
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = e.translationX;
        translateY.value = e.translationY;
      }
    })
    .onEnd(() => {
      // Reset if panned too far
      if (Math.abs(translateX.value) > SCREEN_WIDTH / 2) {
        translateX.value = withSpring(0);
      }
      if (Math.abs(translateY.value) > SCREEN_HEIGHT / 2) {
        translateY.value = withSpring(0);
      }
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.loadingHeader}>
          <TouchableOpacity 
            style={styles.backButtonLoading} 
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={Colors.text} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading chapter...</Text>
          <Text style={styles.loadingSubtext}>{params.chapterTitle}</Text>
        </View>
      </View>
    );
  }

  if (error || pages.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.loadingHeader}>
          <TouchableOpacity 
            style={styles.backButtonLoading} 
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={Colors.text} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Error</Text>
          <Text style={styles.errorText}>{error || 'No pages found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadChapterPages}>
            <RotateCcw size={20} color={Colors.text} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={showControls && !fullscreen ? Colors.surface : '#000'} 
        hidden={fullscreen}
      />
      <View style={styles.container}>
        <View style={styles.readerContainer}>
          <GestureDetector gesture={composed}>
            <Pressable 
              style={styles.imageContainer}
              onPress={toggleControls}
            >
              <Animated.View style={animatedStyle}>
                <Image
                  source={{ uri: pages[currentPage].url }}
                  style={styles.pageImage}
                  resizeMode="contain"
                  onLoadStart={() => setImageLoading(true)}
                  onLoadEnd={() => setImageLoading(false)}
                />
              </Animated.View>
              {imageLoading && (
                <View style={styles.imageLoadingOverlay}>
                  <ActivityIndicator size="large" color={Colors.accent} />
                </View>
              )}
            </Pressable>
          </GestureDetector>
        </View>

        {showControls && !fullscreen && (
          <View style={styles.header} pointerEvents="box-none">
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => {
                console.log('Back button pressed');
                router.back();
              }}
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color={Colors.text} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {params.chapterTitle}
              </Text>
              <Text style={styles.headerSubtitle}>
                {params.mangaTitle}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => {
                console.log('Reset zoom pressed');
                resetZoom();
              }}
              activeOpacity={0.7}
            >
              <RotateCcw size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => {
                console.log('Fullscreen pressed');
                toggleFullscreen();
              }}
              activeOpacity={0.7}
            >
              <Maximize2 size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {showControls && !fullscreen && (
          <View style={styles.controls} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.navButton, currentPage === 0 && styles.navButtonDisabled]}
              onPress={goToPreviousPage}
              disabled={currentPage === 0}
              activeOpacity={0.7}
            >
              <ChevronLeft size={24} color={currentPage === 0 ? Colors.textSecondary : Colors.text} />
              <Text style={[styles.navButtonText, currentPage === 0 && styles.navButtonTextDisabled]}>
                Previous
              </Text>
            </TouchableOpacity>

            <View style={styles.pageIndicator}>
              <Text style={styles.pageIndicatorText}>
                {currentPage + 1} / {pages.length}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.navButton,
                currentPage === pages.length - 1 && styles.navButtonDisabled,
              ]}
              onPress={goToNextPage}
              disabled={currentPage === pages.length - 1}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.navButtonText,
                  currentPage === pages.length - 1 && styles.navButtonTextDisabled,
                ]}
              >
                Next
              </Text>
              <ChevronRight
                size={24}
                color={currentPage === pages.length - 1 ? Colors.textSecondary : Colors.text}
              />
            </TouchableOpacity>
          </View>
        )}

        {fullscreen && showControls && (
          <TouchableOpacity 
            style={styles.fullscreenExit} 
            onPress={toggleFullscreen}
            activeOpacity={0.7}
          >
            <Minimize2 size={24} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingHeader: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: Colors.surface,
  },
  backButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 100,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    marginRight: 10,
  },
  iconButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  fullscreenExit: {
    position: 'absolute',
    top: 50,
    right: 15,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    zIndex: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
  },
  loadingSubtext: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  readerContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: Colors.surface,
    zIndex: 100,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: Colors.card,
    borderRadius: 8,
    gap: 5,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
  },
  navButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  pageIndicator: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 8,
  },
  pageIndicatorText: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.accent,
  },
});
