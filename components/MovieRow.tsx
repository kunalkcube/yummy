import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
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
}

export const MovieRow = ({ title, movies, icon: Icon, mediaType }: MovieRowProps) => {
  const router = useRouter();

  const handlePress = (movie: Movie) => {
    // Use provided mediaType first, then media_type from movie, then fallback to title detection
    const type = mediaType || movie.media_type || (movie.title ? 'movie' : 'tv');
    router.push({
      pathname: '/details',
      params: { id: movie.id, type },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        {Icon && <Icon size={22} color={Colors.accent} />}
        <Text style={styles.title}>{title}</Text>
      </View>
      <FlatList
        data={movies}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <MovieCard movie={item} onPress={() => handlePress(item)} />
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 25,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: 15,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  list: {
    paddingLeft: 15,
    paddingRight: 5,
  },
});
