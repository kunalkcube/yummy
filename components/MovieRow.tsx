import { HorizontalScrollRow } from '@/components/HorizontalScrollRow';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { Movie } from '@/hooks/useTMDB';
import { useRouter } from 'expo-router';
import { LucideIcon } from 'lucide-react-native';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { MovieCard } from './MovieCard';

interface MovieRowProps {
  title: string;
  movies: Movie[];
  icon?: LucideIcon;
  mediaType?: 'movie' | 'tv';
  getCaption?: (movie: Movie) => string | undefined;
}

export const MovieRow = ({ title, movies, icon: Icon, mediaType, getCaption }: MovieRowProps) => {
  const router = useRouter();
  const isDesktop = useIsDesktop();

  const handlePress = (movie: Movie) => {
    const type = mediaType || movie.media_type || (movie.title ? 'movie' : 'tv');
    router.push({
      pathname: '/details',
      params: { id: movie.id, type },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        {Icon && <Icon size={16} color={Colors.accent} strokeWidth={2} />}
        <Text style={styles.title}>{title}</Text>
      </View>
      {isDesktop ? (
        <HorizontalScrollRow contentContainerStyle={styles.list}>
          {movies.map((item) => (
            <MovieCard
              key={`${item.media_type || mediaType || 'unknown'}-${item.id}`}
              movie={item}
              caption={getCaption?.(item)}
              onPress={() => handlePress(item)}
            />
          ))}
        </HorizontalScrollRow>
      ) : (
        <FlatList
          data={movies}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => `${item.media_type || mediaType || 'unknown'}-${item.id}`}
          renderItem={({ item }) => (
            <MovieCard
              movie={item}
              caption={getCaption?.(item)}
              onPress={() => handlePress(item)}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    marginLeft: 16,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
    letterSpacing: 0.4,
  },
  list: {
    paddingLeft: 16,
    paddingRight: 8,
  },
});
