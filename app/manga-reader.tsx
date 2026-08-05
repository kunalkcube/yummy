import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useMangaPlus } from '@/hooks/useMangaPlus';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  RotateCcw,
} from 'lucide-react-native';
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
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const mangaPlus = useMangaPlus();
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

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
      setError(err.message || 'Failed to load chapter pages');
    } finally {
      setLoading(false);
    }
  };

  const loadMangaPlusPages = async () => {
    try {
      const chapterId = parseInt(params.chapterId);
      if (isNaN(chapterId)) {
        throw new Error('Invalid chapter ID');
      }

      const pageUrls = await mangaPlus.fetchChapterPages(chapterId);

      if (!pageUrls || pageUrls.length === 0) {
        throw new Error('No pages found for this chapter. It may not be available yet.');
      }

      setPages(
        pageUrls.map((url, index) => ({
          url,
          index,
        }))
      );
    } catch (err: any) {
      throw new Error(err.message || 'Failed to load MangaPlus pages');
    }
  };

  const loadMangaDexPages = async () => {
    try {
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
      const pageFiles = data.chapter.data;

      setPages(
        pageFiles.map((filename: string, index: number) => ({
          url: `${baseUrl}/data/${chapterHash}/${filename}`,
          index,
        }))
      );
    } catch (err) {
      throw new Error('Failed to load MangaDex pages');
    }
  };

  const loadAniListPages = async () => {
    try {
      const response = await fetch(
        `https://api.consumet.org/meta/anilist-manga/read?chapterId=${encodeURIComponent(params.chapterId)}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch chapter from Consumet API');
      }

      const text = await response.text();

      if (text.trim().startsWith('<')) {
        throw new Error(
          'Consumet API is currently unavailable. This manga may not be available for reading.'
        );
      }

      const data = JSON.parse(text);

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No pages found for this chapter');
      }

      setPages(
        data.map((page: any, index: number) => ({
          url: page.img || page.page || page.url || page,
          index,
        }))
      );
    } catch (err: any) {
      throw new Error(
        err.message ||
          'Failed to load AniList pages. This manga may not be available for reading.'
      );
    }
  };

  const resetZoom = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  };

  const goToNextPage = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
      setImageLoading(true);
      resetZoom();
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setImageLoading(true);
      resetZoom();
    }
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
    setShowControls(!fullscreen);
  };

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

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = e.translationX;
        translateY.value = e.translationY;
      }
    })
    .onEnd(() => {
      if (Math.abs(translateX.value) > SCREEN_WIDTH / 2) {
        translateX.value = withSpring(0);
      }
      if (Math.abs(translateY.value) > SCREEN_HEIGHT / 2) {
        translateY.value = withSpring(0);
      }
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const renderChromeHeader = (opts?: { title?: string; subtitle?: string }) => (
    <View style={[styles.chromeHeader, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => router.back()}
        activeOpacity={0.85}
        accessibilityLabel="Go back"
      >
        <ArrowLeft size={20} color="#fff" />
      </TouchableOpacity>
      {(opts?.title || opts?.subtitle) && (
        <View style={styles.headerInfo}>
          {opts.title ? (
            <Text style={styles.headerTitle} numberOfLines={1}>
              {opts.title}
            </Text>
          ) : null}
          {opts.subtitle ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {opts.subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        {renderChromeHeader({
          title: 'Loading…',
          subtitle: params.chapterTitle,
        })}
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
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        {renderChromeHeader()}
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={Colors.textSecondary} />
          <Text style={styles.errorTitle}>Failed to load</Text>
          <Text style={styles.errorText}>{error || 'No pages found'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadChapterPages}
            activeOpacity={0.85}
          >
            <RotateCcw size={16} color="#000" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const atStart = currentPage === 0;
  const atEnd = currentPage === pages.length - 1;

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000"
        hidden={fullscreen && !showControls}
      />
      <View style={styles.container}>
        <View style={styles.readerContainer}>
          <GestureDetector gesture={composed}>
            <Pressable style={styles.imageContainer} onPress={toggleControls}>
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
          <View
            style={[styles.header, { paddingTop: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.back()}
              activeOpacity={0.85}
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {params.chapterTitle}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {params.mangaTitle}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={resetZoom}
              activeOpacity={0.85}
              accessibilityLabel="Reset zoom"
            >
              <RotateCcw size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={toggleFullscreen}
              activeOpacity={0.85}
              accessibilityLabel="Enter fullscreen"
            >
              <Maximize2 size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {showControls && !fullscreen && (
          <View
            style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 12) }]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={[styles.navButton, atStart && styles.navButtonDisabled]}
              onPress={goToPreviousPage}
              disabled={atStart}
              activeOpacity={0.85}
            >
              <ChevronLeft size={20} color={atStart ? Colors.textSecondary : '#fff'} />
              <Text style={[styles.navButtonText, atStart && styles.navButtonTextDisabled]}>
                Prev
              </Text>
            </TouchableOpacity>

            <View style={styles.pageIndicator}>
              <Text style={styles.pageIndicatorText}>
                {currentPage + 1} / {pages.length}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.navButton, atEnd && styles.navButtonDisabled]}
              onPress={goToNextPage}
              disabled={atEnd}
              activeOpacity={0.85}
            >
              <Text style={[styles.navButtonText, atEnd && styles.navButtonTextDisabled]}>
                Next
              </Text>
              <ChevronRight size={20} color={atEnd ? Colors.textSecondary : '#fff'} />
            </TouchableOpacity>
          </View>
        )}

        {fullscreen && showControls && (
          <TouchableOpacity
            style={[styles.fullscreenExit, { top: insets.top + 8 }]}
            onPress={toggleFullscreen}
            activeOpacity={0.85}
            accessibilityLabel="Exit fullscreen"
          >
            <Minimize2 size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  chromeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.72)',
    gap: 8,
    zIndex: 100,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  fullscreenExit: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
  },
  loadingSubtext: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    textAlign: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  readerContainer: {
    flex: 1,
    backgroundColor: '#000',
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
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.72)',
    zIndex: 100,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    gap: 4,
    minWidth: 88,
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
  },
  navButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  pageIndicator: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  pageIndicatorText: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
});
