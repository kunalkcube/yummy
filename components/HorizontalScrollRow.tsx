import { DESKTOP_MIN_WIDTH } from '@/hooks/useIsDesktop';
import { Colors } from '@/constants/colors';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ReactNode, useCallback, useRef } from 'react';
import {
  DimensionValue,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';

type HorizontalScrollRowProps = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Vertical offset for overlay chevrons (percent or px). */
  buttonTop?: DimensionValue;
};

export function HorizontalScrollRow({
  children,
  contentContainerStyle,
  style,
  buttonTop = '40%',
}: HorizontalScrollRowProps) {
  const { width: windowWidth } = useWindowDimensions();
  const showNavButtons = windowWidth >= DESKTOP_MIN_WIDTH;
  const scrollRef = useRef<ScrollView>(null);
  const offsetX = useRef(0);
  const viewportWidth = useRef(0);
  const contentWidth = useRef(0);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetX.current = event.nativeEvent.contentOffset.x;
    contentWidth.current = event.nativeEvent.contentSize.width;
    viewportWidth.current = event.nativeEvent.layoutMeasurement.width;
  }, []);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    viewportWidth.current = event.nativeEvent.layout.width;
  }, []);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const width = viewportWidth.current;
    if (!width) return;

    // Step by most of one viewport so the next/prev cards come into view.
    const step = Math.max(160, width * 0.75);
    const maxOffset = Math.max(0, contentWidth.current - width);
    const nextX = Math.min(maxOffset, Math.max(0, offsetX.current + direction * step));

    offsetX.current = nextX;
    scrollRef.current?.scrollTo({ x: nextX, animated: true });
  }, []);

  return (
    <View style={[styles.rowContainer, style]} onLayout={onLayout}>
      {showNavButtons ? (
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonLeft, { top: buttonTop }]}
          onPress={() => scrollByPage(-1)}
          activeOpacity={0.85}
          accessibilityLabel="Scroll left"
        >
          <ChevronLeft size={18} color={Colors.text} />
        </TouchableOpacity>
      ) : null}

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={contentContainerStyle}
        onScroll={showNavButtons ? onScroll : undefined}
        scrollEventThrottle={showNavButtons ? 16 : undefined}
        onContentSizeChange={
          showNavButtons
            ? (width) => {
                contentWidth.current = width;
              }
            : undefined
        }
      >
        {children}
      </ScrollView>

      {showNavButtons ? (
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonRight, { top: buttonTop }]}
          onPress={() => scrollByPage(1)}
          activeOpacity={0.85}
          accessibilityLabel="Scroll right"
        >
          <ChevronRight size={18} color={Colors.text} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    position: 'relative',
  },
  navButton: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  navButtonLeft: {
    left: 6,
  },
  navButtonRight: {
    right: 6,
  },
});
