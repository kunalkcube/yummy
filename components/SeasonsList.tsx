import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Episode, Season, useTMDB } from '@/hooks/useTMDB';
import { ChevronDown, ChevronUp, PlayCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SeasonsListProps {
  seasons: Season[];
  tvId: string;
  tvTitle: string;
  onEpisodePress: (season: number, episode: number) => void;
}

export const SeasonsList = ({ seasons, tvId, tvTitle, onEpisodePress }: SeasonsListProps) => {
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<{ [key: number]: Episode[] }>({});
  const [loadingSeasons, setLoadingSeasons] = useState<{ [key: number]: boolean }>({});
  const [displayedEpisodeCount, setDisplayedEpisodeCount] = useState<{ [key: number]: number }>({});
  const { fetchSeasonDetails } = useTMDB();

  const EPISODES_PER_PAGE = 20;
  const PAGINATION_THRESHOLD = 30;

  const toggleSeason = async (seasonNumber: number) => {
    if (expandedSeason === seasonNumber) {
      setExpandedSeason(null);
      return;
    }

    setExpandedSeason(seasonNumber);

    // Fetch episodes if not already loaded
    if (!seasonEpisodes[seasonNumber]) {
      setLoadingSeasons({ ...loadingSeasons, [seasonNumber]: true });
      const episodes = await fetchSeasonDetails(Number(tvId), seasonNumber);
      setSeasonEpisodes({ ...seasonEpisodes, [seasonNumber]: episodes });
      setLoadingSeasons({ ...loadingSeasons, [seasonNumber]: false });
      
      // Initialize displayed count - show first page or all if under threshold
      const initialCount = episodes.length > PAGINATION_THRESHOLD ? EPISODES_PER_PAGE : episodes.length;
      setDisplayedEpisodeCount({ ...displayedEpisodeCount, [seasonNumber]: initialCount });
    }
  };

  const loadMoreEpisodes = (seasonNumber: number) => {
    const currentCount = displayedEpisodeCount[seasonNumber] || EPISODES_PER_PAGE;
    const totalEpisodes = seasonEpisodes[seasonNumber]?.length || 0;
    const newCount = Math.min(currentCount + EPISODES_PER_PAGE, totalEpisodes);
    setDisplayedEpisodeCount({ ...displayedEpisodeCount, [seasonNumber]: newCount });
  };

  const renderEpisode = (episode: Episode, seasonNumber: number) => {
    const imageUrl = episode.still_path
      ? `https://image.tmdb.org/t/p/w300${episode.still_path}`
      : 'https://via.placeholder.com/300x169?text=No+Image';

    return (
      <TouchableOpacity
        key={episode.id}
        style={styles.episodeItem}
        onPress={() => onEpisodePress(seasonNumber, episode.episode_number)}
      >
        <Image source={{ uri: imageUrl }} style={styles.episodeImage} />
        <View style={styles.episodeInfo}>
          <View style={styles.episodeHeader}>
            <Text style={styles.episodeNumber}>{episode.episode_number}</Text>
            <Text style={styles.episodeTitle} numberOfLines={1}>
              {episode.name || `Episode ${episode.episode_number}`}
            </Text>
          </View>
          <Text style={styles.episodeOverview} numberOfLines={2}>
            {episode.overview || 'No description available.'}
          </Text>
          {episode.runtime && (
            <Text style={styles.episodeRuntime}>{episode.runtime} min</Text>
          )}
        </View>
        <PlayCircle size={32} color={Colors.accent} />
      </TouchableOpacity>
    );
  };

  const renderSeason = ({ item }: { item: Season }) => {
    const isExpanded = expandedSeason === item.season_number;
    const isLoading = loadingSeasons[item.season_number];
    const episodes = seasonEpisodes[item.season_number] || [];
    const displayCount = displayedEpisodeCount[item.season_number] || EPISODES_PER_PAGE;
    const displayedEpisodes = episodes.slice(0, displayCount);
    const hasMore = displayCount < episodes.length;
    const needsPagination = episodes.length > PAGINATION_THRESHOLD;
    
    // Skip season 0 (specials) for now
    if (item.season_number === 0) return null;

    return (
      <View style={styles.seasonContainer}>
        <TouchableOpacity
          style={styles.seasonHeader}
          onPress={() => toggleSeason(item.season_number)}
        >
          <View style={styles.seasonInfo}>
            <Text style={styles.seasonTitle}>{item.name}</Text>
            <Text style={styles.seasonMeta}>
              {item.episode_count} Episodes
              {item.air_date && ` • ${item.air_date.substring(0, 4)}`}
            </Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={20} color={Colors.textSecondary} />
          ) : (
            <ChevronDown size={20} color={Colors.textSecondary} />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.episodesContainer}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.loadingText}>Loading episodes...</Text>
              </View>
            ) : (
              <>
                {displayedEpisodes.map((episode) => renderEpisode(episode, item.season_number))}
                {needsPagination && hasMore && (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={() => loadMoreEpisodes(item.season_number)}
                  >
                    <Text style={styles.loadMoreText}>
                      Load More ({displayCount} of {episodes.length})
                    </Text>
                    <ChevronDown size={16} color={Colors.accent} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Seasons & Episodes</Text>
      <FlatList
        data={seasons}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderSeason}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginBottom: 15,
  },
  seasonContainer: {
    marginBottom: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
  },
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
  },
  seasonInfo: {
    flex: 1,
  },
  seasonTitle: {
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginBottom: 4,
  },
  seasonMeta: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
  episodesContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
  },
  episodeItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  episodeImage: {
    width: 120,
    height: 68,
    borderRadius: 6,
    backgroundColor: Colors.card,
  },
  episodeInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  episodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  episodeNumber: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.accent,
  },
  episodeTitle: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
    flex: 1,
  },
  episodeOverview: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 4,
  },
  episodeRuntime: {
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  loadMoreText: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.accent,
  },
});
