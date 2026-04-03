import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useSettings } from '@/contexts/SettingsContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, ArrowLeft, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { height } = Dimensions.get('window');

interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string;
  place_of_birth: string;
  profile_path: string | null;
  known_for_department: string;
  also_known_as: string[];
  gender: number;
  popularity?: number;
}

interface MovieCredit {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  character?: string;
  job?: string;
  media_type: 'movie' | 'tv';
}

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tmdbApiKey } = useSettings();
  const router = useRouter();
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [credits, setCredits] = useState<MovieCredit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPersonDetails();
  }, [id]);

  const loadPersonDetails = async () => {
    if (!id || !tmdbApiKey) return;
    setLoading(true);
    
    await Promise.all([
      fetchPersonDetails(),
      fetchPersonCredits()
    ]);
    
    setLoading(false);
  };

  const fetchPersonDetails = async () => {
    try {
      const isBearer = tmdbApiKey.startsWith('eyJ') || tmdbApiKey.length > 100;
      const response = await fetch(
        `https://api.themoviedb.org/3/person/${id}${!isBearer ? `?api_key=${tmdbApiKey}` : ''}`,
        isBearer ? {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${tmdbApiKey}`,
          },
        } : undefined
      );
      const data = await response.json();
      setPerson(data);
    } catch (error) {
      console.error('Failed to load person details:', error);
    }
  };

  const fetchPersonCredits = async () => {
    try {
      const isBearer = tmdbApiKey.startsWith('eyJ') || tmdbApiKey.length > 100;
      const response = await fetch(
        `https://api.themoviedb.org/3/person/${id}/combined_credits${!isBearer ? `?api_key=${tmdbApiKey}` : ''}`,
        isBearer ? {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${tmdbApiKey}`,
          },
        } : undefined
      );
      const data = await response.json();
      setCredits(data.cast?.slice(0, 20) || []);
    } catch (error) {
      console.error('Failed to load person credits:', error);
    }
  };

  const calculateAge = (birthday: string) => {
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const renderCreditItem = ({ item }: { item: MovieCredit }) => (
    <TouchableOpacity
      style={styles.creditCard}
      onPress={() => router.push({ 
        pathname: '/details', 
        params: { id: item.id, type: item.media_type } 
      })}
    >
      <Image
        source={{ 
          uri: item.poster_path 
            ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
            : 'https://via.placeholder.com/342x513?text=No+Image'
        }}
        style={styles.creditImage}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!person) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.errorContainer}>
          <AlertCircle size={64} color={Colors.textSecondary} />
          <Text style={styles.errorText}>Failed to load person details</Text>
        </View>
      </View>
    );
  }

  const profileUrl = person.profile_path
    ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
    : null;

  const age = person.birthday ? calculateAge(person.birthday) : null;
  const gender = person.gender === 1 ? 'Feminine' : person.gender === 2 ? 'Masculine' : 'Other';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          {profileUrl ? (
            <Image source={{ uri: profileUrl }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.placeholderImage]}>
              <User size={120} color={Colors.textSecondary} />
            </View>
          )}
          
          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)', Colors.background]}
            style={styles.gradient}
          />

          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>

          {/* Name and Character Overlay */}
          <View style={styles.heroContent}>
            <View style={styles.profileImageContainer}>
              {profileUrl && (
                <Image source={{ uri: profileUrl }} style={styles.profileImage} />
              )}
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.name}>{person.name}</Text>
              <Text style={styles.character}>{person.known_for_department}</Text>
            </View>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          {/* Biography */}
          {person.biography && (
            <View style={styles.section}>
              <Text style={styles.bio}>{person.biography}</Text>
            </View>
          )}

          {/* Popularity Section - Only show if available */}
          {person.popularity && person.popularity > 0 && (
            <View style={styles.popularitySection}>
              <Text style={styles.popularityLabel}>Popularity Score</Text>
              <Text style={styles.popularityText}>{person.popularity.toFixed(1)}</Text>
            </View>
          )}

          {/* Info Grid */}
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Know for:</Text>
              <Text style={styles.infoValue}>{person.known_for_department}</Text>
            </View>
            {person.birthday && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Birth:</Text>
                <Text style={styles.infoValue}>
                  {person.birthday} (Age {age})
                </Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Credited in:</Text>
              <Text style={styles.infoValue}>{credits.length}</Text>
            </View>
            {person.place_of_birth && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Place of birth:</Text>
                <Text style={styles.infoValue}>{person.place_of_birth}</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Genre:</Text>
              <Text style={styles.infoValue}>{gender}</Text>
            </View>
            {person.also_known_as && person.also_known_as.length > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Also known as:</Text>
                <Text style={styles.infoValue}>{person.also_known_as[0]}</Text>
              </View>
            )}
          </View>

          {/* Known For Section */}
          {credits.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Know for</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>See all</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={credits}
                renderItem={renderCreditItem}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.creditsList}
              />
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  heroContainer: {
    position: 'relative',
    height: height * 0.6,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  heroContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 15,
  },
  profileImageContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: '#fff',
  },
  heroTextContainer: {
    flex: 1,
    paddingBottom: 10,
  },
  name: {
    fontSize: 32,
    fontFamily: Fonts.GeistMono.Bold,
    color: '#fff',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  character: {
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Regular,
    color: '#fff',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  bio: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Regular,
    lineHeight: 24,
  },
  popularitySection: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    alignItems: 'center',
  },
  popularityLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    marginBottom: 8,
  },
  popularityText: {
    color: Colors.accent,
    fontSize: 32,
    fontFamily: Fonts.GeistMono.Bold,
  },
  infoGrid: {
    marginBottom: 30,
  },
  infoItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Regular,
    width: 140,
  },
  infoValue: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Regular,
    flex: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
  },
  seeAllText: {
    color: Colors.accent,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.SemiBold,
  },
  creditsList: {
    paddingRight: 20,
  },
  creditCard: {
    width: 140,
    height: 210,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  creditImage: {
    width: '100%',
    height: '100%',
  },
  bottomSpacer: {
    height: 40,
  },
});
