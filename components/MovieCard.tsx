import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { Movie } from '@/hooks/useTMDB';
import { LinearGradient } from 'expo-linear-gradient';
import { Star } from 'lucide-react-native';
import { Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

interface MovieCardProps {
  movie: Movie;
  onPress: () => void;
}

export const MovieCard = ({ movie, onPress }: MovieCardProps) => {
  const { width } = useWindowDimensions();
  const isDesktop = useIsDesktop();
  const cardWidth = isDesktop
    ? Math.max(110, Math.min(width * 0.3, 170))
    : width * 0.3;
  const cardHeight = cardWidth * 1.55;

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : 'https://via.placeholder.com/500x750?text=No+Image';

  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null;
  const year = (movie.release_date || movie.first_air_date)?.substring(0, 4);

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth, height: cardHeight }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.gradient}
      />

      {rating && (
        <View style={styles.ratingBadge}>
          <Star size={10} color="#FFD700" fill="#FFD700" />
          <Text style={styles.ratingText}>{rating}</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {movie.title || movie.name}
        </Text>
        {year && <Text style={styles.year}>{year}</Text>}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginRight: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  ratingText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: Fonts.GeistMono.Bold,
  },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 4,
  },
  title: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Medium,
    marginBottom: 2,
    lineHeight: 15,
  },
  year: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 10,
    fontFamily: Fonts.GeistMono.Regular,
  },
});
