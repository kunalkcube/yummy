import { useIsDesktop } from '@/hooks/useIsDesktop';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export const CONTENT_MAX_WIDTH = 896;

type ScreenContainerProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  maxWidth?: number;
};

export function ScreenContainer({
  children,
  style,
  contentStyle,
  maxWidth = CONTENT_MAX_WIDTH,
}: ScreenContainerProps) {
  const isDesktop = useIsDesktop();

  // Mobile: single wrapper — same as pre-desktop screen roots.
  if (!isDesktop) {
    return <View style={[styles.outer, style]}>{children}</View>;
  }

  return (
    <View style={[styles.outer, style]}>
      <View style={[styles.inner, { maxWidth }, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
  },
  inner: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
});
