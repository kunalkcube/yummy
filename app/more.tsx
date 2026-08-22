import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bookmark, ChevronRight, Settings } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LINKS = [
  {
    key: 'my-list',
    label: 'My List',
    hint: 'Saved movies and TV shows',
    Icon: Bookmark,
    href: '/my-list' as const,
  },
  {
    key: 'settings',
    label: 'Settings',
    hint: 'Stream provider, TMDB, IPTV',
    Icon: Settings,
    href: '/settings' as const,
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={goBack}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerLabel}>More</Text>
        </View>

        <View style={styles.list}>
          {LINKS.map(({ key, label, hint, Icon, href }) => (
            <TouchableOpacity
              key={key}
              style={styles.row}
              onPress={() => router.push(href)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <View style={styles.rowIcon}>
                <Icon size={20} color={Colors.text} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowHint}>{hint}</Text>
              </View>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  headerLabel: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
    marginBottom: 3,
  },
  rowHint: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
});
