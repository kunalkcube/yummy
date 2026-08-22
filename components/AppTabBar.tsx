import { CONTENT_MAX_WIDTH } from '@/components/layout/ScreenContainer';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { BookOpen, Home, Radio, Search } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_META: Record<
  string,
  { label: string; Icon: typeof Home }
> = {
  index: { label: 'Home', Icon: Home },
  search: { label: 'Search', Icon: Search },
  manga: { label: 'Manga', Icon: BookOpen },
  iptv: { label: 'IPTV', Icon: Radio },
};

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const isDesktop = useIsDesktop();

  const tabs = (
    <>
      <View style={styles.rule} />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const meta = TAB_META[route.name] ?? {
            label: options.title ?? route.name,
            Icon: Home,
          };
          const { Icon, label } = meta;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              void Haptics.selectionAsync();
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const color = focused ? Colors.text : Colors.textSecondary;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.item}
            >
              <View style={[styles.indicator, focused && styles.indicatorActive]} />
              <Icon
                size={22}
                color={focused ? Colors.accent : color}
                strokeWidth={focused ? 2.25 : 1.75}
              />
              <Text
                style={[styles.label, focused ? styles.labelActive : styles.labelIdle]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  if (!isDesktop) {
    return <View style={[styles.wrapMobile, { paddingBottom: bottomPad }]}>{tabs}</View>;
  }

  return (
    <View style={[styles.outer, { paddingBottom: bottomPad }]}>
      <View style={styles.wrapDesktop}>{tabs}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    backgroundColor: Colors.background,
  },
  wrapMobile: {
    backgroundColor: Colors.background,
    paddingTop: 0,
  },
  wrapDesktop: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: Colors.background,
    paddingTop: 0,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    paddingBottom: 4,
    minHeight: 52,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: Colors.accent,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.GeistMono.Medium,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  labelActive: {
    color: Colors.text,
  },
  labelIdle: {
    color: Colors.textSecondary,
  },
});
