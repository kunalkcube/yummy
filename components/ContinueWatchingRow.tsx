import { HorizontalScrollRow } from '@/components/HorizontalScrollRow';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import {
  continueWatchingCaption,
  ContinueWatchingItem,
} from '@/constants/library';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, X } from 'lucide-react-native';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

type ContinueWatchingRowProps = {
  items: ContinueWatchingItem[];
  onResume: (item: ContinueWatchingItem) => void;
  onRemove: (item: ContinueWatchingItem) => void;
  onOpenDetails: (item: ContinueWatchingItem) => void;
};

export function ContinueWatchingRow({
  items,
  onResume,
  onRemove,
  onOpenDetails,
}: ContinueWatchingRowProps) {
  const { width } = useWindowDimensions();
  const isDesktop = useIsDesktop();
  const cardWidth = isDesktop
    ? Math.min(300, Math.max(240, width * 0.28))
    : Math.min(268, width * 0.72);
  const cardHeight = cardWidth * 0.56;

  const renderCard = (item: ContinueWatchingItem) => {
    const imagePath = item.backdropPath || item.posterPath;
    const imageUrl = imagePath
      ? `https://image.tmdb.org/t/p/w780${imagePath}`
      : 'https://via.placeholder.com/780x440?text=No+Image';
    const caption = continueWatchingCaption(item);

    return (
      <View key={`${item.type}-${item.id}`} style={[styles.cardWrap, { width: cardWidth }]}>
        <TouchableOpacity
          style={[styles.card, { height: cardHeight }]}
          onPress={() => onResume(item)}
          onLongPress={() => onOpenDetails(item)}
          delayLongPress={350}
          activeOpacity={0.9}
          accessibilityLabel={`Resume ${item.title}`}
        >
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.gradient}
          />

          <View style={styles.playOverlay} pointerEvents="none">
            <View style={styles.playBadge}>
              <Play size={16} color="#000" fill="#000" />
            </View>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemove(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Remove ${item.title} from continue watching`}
          >
            <X size={14} color="#fff" />
          </TouchableOpacity>

          <View style={styles.cardMeta}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {caption ? (
              <Text style={styles.cardCaption} numberOfLines={1}>
                {caption}
              </Text>
            ) : (
              <Text style={styles.cardCaption}>Resume</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Continue Watching</Text>
      {isDesktop ? (
        <HorizontalScrollRow contentContainerStyle={styles.list} buttonTop="42%">
          {items.map(renderCard)}
        </HorizontalScrollRow>
      ) : (
        <FlatList
          data={items}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={({ item }) => renderCard(item)}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
    marginLeft: 16,
  },
  list: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  cardWrap: {
    marginRight: 12,
  },
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 18,
  },
  playBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  cardMeta: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 14,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    marginBottom: 2,
  },
  cardCaption: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Regular,
  },
});
