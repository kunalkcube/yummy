import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Episode, Season, useTMDB } from '@/hooks/useTMDB';
import { Check, ChevronDown, ChevronUp, PlayCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SeasonsListProps {
  seasons: Season[];
  tvId: string;
  tvTitle: string;
  onEpisodePress: (season: number, episode: number) => void;
  isEpisodeWatched?: (season: number, episode: number) => boolean;
  onToggleEpisodeWatched?: (season: number, episode: number) => void;
}

export const SeasonsList = ({
  seasons,
  tvId,
  tvTitle,
  onEpisodePress,
  isEpisodeWatched,
  onToggleEpisodeWatched,
}: SeasonsListProps) => {
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
    const watched = isEpisodeWatched?.(seasonNumber, episode.episode_number) ?? false;

    return (
      <View key={episode.id} style={[styles.episodeItem, watched && styles.episodeItemWatched]}>
        <TouchableOpacity
          style={styles.episodeMain}
          onPress={() => onEpisodePress(seasonNumber, episode.episode_number)}
          activeOpacity={0.85}
        >
          <View style={styles.episodeThumb}>
            <Image source={{ uri: imageUrl }} style={styles.episodeImage} resizeMode="cover" />
          </View>
          <View style={styles.episodeInfo}>
            <View style={styles.episodeHeader}>
              <Text style={styles.episodeNumber}>{episode.episode_number}</Text>
              <Text
                style={[styles.episodeTitle, watched && styles.episodeTitleWatched]}
                numberOfLines={1}
              >
                {episode.name || `Episode ${episode.episode_number}`}
              </Text>
            </View>
            <Text style={styles.episodeOverview} numberOfLines={2}>
              {episode.overview || 'No description available.'}
            </Text>
            {episode.runtime ? (
              <Text style={styles.episodeRuntime}>{episode.runtime} min</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.episodeActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onEpisodePress(seasonNumber, episode.episode_number)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Play episode ${episode.episode_number}`}
          >
            <PlayCircle size={28} color={Colors.accent} />
          </TouchableOpacity>
          {onToggleEpisodeWatched ? (
            <TouchableOpacity
              style={[styles.checkButton, watched && styles.checkButtonWatched]}
              onPress={() => onToggleEpisodeWatched(seasonNumber, episode.episode_number)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: watched }}
              accessibilityLabel={
                watched
                  ? `Mark episode ${episode.episode_number} unwatched`
                  : `Mark episode ${episode.episode_number} watched`
              }
            >
              {watched ? <Check size={14} color="#000" strokeWidth={3} /> : null}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
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
    marginBottom: 4,
  },
  seasonContainer: {
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
  },
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  seasonInfo: {
    flex: 1,
  },
  seasonTitle: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
    marginBottom: 4,
  },
  seasonMeta: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
  episodesContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
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
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
  },
  episodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    minHeight: 88,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  episodeItemWatched: {
    opacity: 0.72,
  },
  episodeMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    minWidth: 0,
  },
  episodeActions: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButton: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonWatched: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  episodeThumb: {
    width: 128,
    alignSelf: 'stretch',
    backgroundColor: Colors.card,
    overflow: 'hidden',
    borderRadius: 6,
  },
  episodeImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  episodeInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  episodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  episodeNumber: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.accent,
  },
  episodeTitle: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
    flex: 1,
  },
  episodeTitleWatched: {
    color: Colors.textSecondary,
  },
  episodeOverview: {
    fontSize: 11,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 4,
  },
  episodeRuntime: {
    fontSize: 10,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
    backgroundColor: Colors.card,
  },
  loadMoreText: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.accent,
  },
});
