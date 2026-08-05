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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height, width } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.48;
const CREDIT_WIDTH = width * 0.3;
const CREDIT_HEIGHT = CREDIT_WIDTH * 1.55;

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
  const insets = useSafeAreaInsets();
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [credits, setCredits] = useState<MovieCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllCredits, setShowAllCredits] = useState(false);

  useEffect(() => {
    loadPersonDetails();
  }, [id]);

  const loadPersonDetails = async () => {
    if (!id || !tmdbApiKey) return;
    setLoading(true);

    await Promise.all([fetchPersonDetails(), fetchPersonCredits()]);

    setLoading(false);
  };

  const fetchPersonDetails = async () => {
    try {
      const isBearer = tmdbApiKey.startsWith('eyJ') || tmdbApiKey.length > 100;
      const response = await fetch(
        `https://api.themoviedb.org/3/person/${id}${!isBearer ? `?api_key=${tmdbApiKey}` : ''}`,
        isBearer
          ? {
              headers: {
                accept: 'application/json',
                Authorization: `Bearer ${tmdbApiKey}`,
              },
            }
          : undefined
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
        isBearer
          ? {
              headers: {
                accept: 'application/json',
                Authorization: `Bearer ${tmdbApiKey}`,
              },
            }
          : undefined
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
      onPress={() =>
        router.push({
          pathname: '/details',
          params: { id: item.id, type: item.media_type },
        })
      }
      activeOpacity={0.85}
    >
      <Image
        source={{
          uri: item.poster_path
            ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
            : 'https://via.placeholder.com/342x513?text=No+Image',
        }}
        style={styles.creditImage}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.creditGradient}
      >
        <Text style={styles.creditTitle} numberOfLines={2}>
          {item.title || item.name}
        </Text>
      </LinearGradient>
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
          <AlertCircle size={48} color={Colors.textSecondary} />
          <Text style={styles.errorTitle}>Failed to load</Text>
          <Text style={styles.errorText}>Couldn’t load this person. Try again.</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadPersonDetails}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const profileUrl = person.profile_path
    ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
    : null;

  const age = person.birthday ? calculateAge(person.birthday) : null;
  const gender =
    person.gender === 1 ? 'Female' : person.gender === 2 ? 'Male' : null;
  const birthYear = person.birthday?.substring(0, 4);
  const department = person.known_for_department?.toUpperCase();

  const infoRows: { label: string; value: string }[] = [
    person.known_for_department
      ? { label: 'Known for', value: person.known_for_department }
      : null,
    person.birthday
      ? {
          label: 'Born',
          value: age != null ? `${person.birthday}  ·  Age ${age}` : person.birthday,
        }
      : null,
    person.place_of_birth
      ? { label: 'Place of birth', value: person.place_of_birth }
      : null,
    gender ? { label: 'Gender', value: gender } : null,
    credits.length > 0
      ? { label: 'Credits shown', value: String(credits.length) }
      : null,
    person.also_known_as?.[0]
      ? { label: 'Also known as', value: person.also_known_as[0] }
      : null,
    person.popularity && person.popularity > 0
      ? { label: 'Popularity', value: person.popularity.toFixed(1) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroContainer}>
          {profileUrl ? (
            <Image source={{ uri: profileUrl }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.placeholderImage]}>
              <User size={72} color={Colors.textSecondary} />
            </View>
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.55)', Colors.background]}
            locations={[0, 0.25, 0.65, 1]}
            style={styles.gradient}
          />

          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 8 }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>

          <Animated.View entering={FadeInDown.duration(250)} style={styles.heroContent}>
            {profileUrl ? (
              <Image source={{ uri: profileUrl }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.castPlaceholder]}>
                <User size={36} color={Colors.textSecondary} />
              </View>
            )}
            <View style={styles.heroTextContainer}>
              <View style={styles.heroMetaLine}>
                {department && <Text style={styles.heroMetaText}>{department}</Text>}
                {birthYear && (
                  <>
                    <Text style={styles.heroMetaDot}>·</Text>
                    <Text style={styles.heroMetaText}>{birthYear}</Text>
                  </>
                )}
                {age != null && (
                  <>
                    <Text style={styles.heroMetaDot}>·</Text>
                    <Text style={styles.heroMetaText}>{age} YRS</Text>
                  </>
                )}
              </View>
              <Text style={styles.name} numberOfLines={2}>
                {person.name}
              </Text>
            </View>
          </Animated.View>
        </View>

        <View style={styles.content}>
          {person.biography ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Biography</Text>
              <Text style={styles.bio}>{person.biography}</Text>
            </View>
          ) : null}

          {infoRows.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Details</Text>
              <View style={styles.infoList}>
                {infoRows.map((row) => (
                  <View key={row.label} style={styles.infoItem}>
                    <Text style={styles.infoLabel}>{row.label}</Text>
                    <Text style={styles.infoValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {credits.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Known For</Text>
                {credits.length > 10 && (
                  <TouchableOpacity onPress={() => setShowAllCredits(!showAllCredits)}>
                    <Text style={styles.seeAllText}>
                      {showAllCredits ? 'Show less' : `See all (${credits.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <FlatList
                data={showAllCredits ? credits : credits.slice(0, 10)}
                renderItem={renderCreditItem}
                keyExtractor={(item, index) => `${item.media_type}-${item.id}-${index}`}
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
    gap: 14,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    letterSpacing: 0.5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  errorTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: Fonts.GeistMono.Bold,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
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
  heroContainer: {
    position: 'relative',
    height: HERO_HEIGHT,
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
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  heroContent: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  profileImage: {
    width: 104,
    height: 104,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  castPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextContainer: {
    flex: 1,
    paddingBottom: 4,
  },
  heroMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Medium,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroMetaDot: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Medium,
  },
  name: {
    fontSize: 26,
    fontFamily: Fonts.GeistMono.Bold,
    color: '#fff',
    lineHeight: 32,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  bio: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    lineHeight: 22,
  },
  infoList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  infoItem: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  infoLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Medium,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    lineHeight: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllText: {
    color: Colors.accent,
    fontSize: 12,
    fontFamily: Fonts.GeistMono.SemiBold,
  },
  creditsList: {
    paddingRight: 8,
  },
  creditCard: {
    width: CREDIT_WIDTH,
    height: CREDIT_HEIGHT,
    marginRight: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  creditImage: {
    width: '100%',
    height: '100%',
  },
  creditGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 24,
    justifyContent: 'flex-end',
  },
  creditTitle: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Medium,
    lineHeight: 15,
  },
  bottomSpacer: {
    height: 48,
  },
});
