import { IptvChannel } from '@/constants/iptv';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useSettings } from '@/contexts/SettingsContext';
import { fetchIptvChannels } from '@/hooks/useIptv';
import { useRouter } from 'expo-router';
import { Heart, Radio, Search, Star, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const ALL_GROUPS = 'All';

export default function IptvScreen() {
  const router = useRouter();
  const {
    iptvPlaylists,
    iptvChannels,
    iptvFavorites,
    iptvRecentChannels,
    toggleIptvFavorite,
    recordIptvRecent,
    removeIptvChannel,
  } = useSettings();
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('iptv-org-categories');
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [selectedGroup, setSelectedGroup] = useState(ALL_GROUPS);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const playlistRequestId = useRef(0);

  const selectedPlaylist = useMemo(
    () => iptvPlaylists.find((playlist) => playlist.id === selectedPlaylistId) ?? iptvPlaylists[0],
    [iptvPlaylists, selectedPlaylistId]
  );

  const loadPlaylist = useCallback(async (playlistId: string) => {
    const playlist = iptvPlaylists.find((item) => item.id === playlistId);
    if (!playlist) return;

    const requestId = playlistRequestId.current + 1;
    playlistRequestId.current = requestId;
    setLoading(true);
    setError(null);
    setSelectedGroup(ALL_GROUPS);

    try {
      const loadedChannels = await fetchIptvChannels(playlist);
      if (requestId !== playlistRequestId.current) return;
      setChannels(loadedChannels);
    } catch (loadError) {
      if (requestId !== playlistRequestId.current) return;
      setChannels([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this playlist.');
    } finally {
      if (requestId === playlistRequestId.current) {
        setLoading(false);
      }
    }
  }, [iptvPlaylists]);

  useEffect(() => {
    if (!selectedPlaylist && iptvPlaylists[0]) {
      setSelectedPlaylistId(iptvPlaylists[0].id);
    }
  }, [iptvPlaylists, selectedPlaylist]);

  useEffect(() => {
    if (selectedPlaylist) {
      void loadPlaylist(selectedPlaylist.id);
    }
  }, [loadPlaylist, selectedPlaylist]);

  const groups = useMemo(
    () => [ALL_GROUPS, ...Array.from(new Set(channels.map((channel) => channel.group))).sort((a, b) => a.localeCompare(b))],
    [channels]
  );

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredChannels = useMemo(
    () => channels.filter((channel) => {
      const matchesGroup = selectedGroup === ALL_GROUPS || channel.group === selectedGroup;
      const matchesQuery = !normalizedQuery || [channel.name, channel.group, channel.tvgId]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
      return matchesGroup && matchesQuery;
    }),
    [channels, normalizedQuery, selectedGroup]
  );

  const favoriteIds = useMemo(() => new Set(iptvFavorites.map((channel) => channel.id)), [iptvFavorites]);
  const favoritesForPlaylist = useMemo(
    () => iptvFavorites.filter((channel) => channel.playlistId === selectedPlaylist?.id),
    [iptvFavorites, selectedPlaylist?.id]
  );
  const recentsForPlaylist = useMemo(
    () => iptvRecentChannels.filter((channel) => channel.playlistId === selectedPlaylist?.id || channel.isCustom),
    [iptvRecentChannels, selectedPlaylist?.id]
  );

  const openChannel = useCallback((channel: IptvChannel) => {
    void recordIptvRecent(channel);
    router.push({
      pathname: '/iptv-player',
      params: {
        channelName: channel.name,
        streamUrl: channel.streamUrl,
      },
    });
  }, [recordIptvRecent, router]);

  const renderLogo = (channel: IptvChannel, compact = false) => (
    channel.logoUrl ? (
      <Image source={{ uri: channel.logoUrl }} style={compact ? styles.quickLogo : styles.logo} resizeMode="contain" />
    ) : (
      <View style={[compact ? styles.quickLogo : styles.logo, styles.logoFallback]}>
        <Radio size={compact ? 18 : 22} color={Colors.accent} />
      </View>
    )
  );

  const renderQuickChannel = (channel: IptvChannel) => (
    <TouchableOpacity key={channel.id} style={styles.quickChannel} onPress={() => openChannel(channel)}>
      {renderLogo(channel, true)}
      <Text style={styles.quickChannelName} numberOfLines={2}>{channel.name}</Text>
    </TouchableOpacity>
  );

  const renderChannel = ({ item }: { item: IptvChannel }) => {
    const isFavorite = favoriteIds.has(item.id);

    return (
      <View style={styles.channelCard}>
        <TouchableOpacity
          style={styles.channelPressable}
          onPress={() => openChannel(item)}
          accessibilityLabel={`Play ${item.name}`}
        >
          {renderLogo(item)}
          <View style={styles.channelInfo}>
            <Text style={styles.channelName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.channelGroup} numberOfLines={1}>{item.group}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.channelActions}>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => void toggleIptvFavorite(item)}
            accessibilityLabel={isFavorite ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`}
          >
            <Heart size={20} color={isFavorite ? Colors.accent : Colors.textSecondary} fill={isFavorite ? Colors.accent : 'transparent'} />
          </TouchableOpacity>
          {item.isCustom && (
            <TouchableOpacity
              style={styles.removeChannelButton}
              onPress={() => removeIptvChannel(item.id)}
              accessibilityLabel={`Remove ${item.name}`}
            >
              <Trash2 size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const listHeader = (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>IPTV</Text>
        <Text style={styles.headerSubtitle}>Live public channels from your saved playlists</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList}>
        {iptvPlaylists.map((playlist) => (
          <TouchableOpacity
            key={playlist.id}
            style={[styles.playlistChip, selectedPlaylist?.id === playlist.id && styles.playlistChipActive]}
            onPress={() => setSelectedPlaylistId(playlist.id)}
          >
            <Text style={[styles.playlistChipText, selectedPlaylist?.id === playlist.id && styles.playlistChipTextActive]}>
              {playlist.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.searchContainer}>
        <Search size={19} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search channels"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search IPTV channels"
        />
      </View>

      {favoritesForPlaylist.length > 0 && (
        <View style={styles.quickSection}>
          <View style={styles.sectionHeading}>
            <Heart size={18} color={Colors.accent} fill={Colors.accent} />
            <Text style={styles.sectionTitle}>Favorites</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickList}>
            {favoritesForPlaylist.map(renderQuickChannel)}
          </ScrollView>
        </View>
      )}

      {iptvChannels.length > 0 && (
        <View style={styles.quickSection}>
          <View style={styles.sectionHeading}>
            <Radio size={18} color={Colors.accent} />
            <Text style={styles.sectionTitle}>Custom Channels</Text>
            <Text style={styles.resultCount}>{iptvChannels.length}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickList}>
            {iptvChannels.map(renderQuickChannel)}
          </ScrollView>
        </View>
      )}

      {recentsForPlaylist.length > 0 && (
        <View style={styles.quickSection}>
          <View style={styles.sectionHeading}>
            <Star size={18} color={Colors.accent} />
            <Text style={styles.sectionTitle}>Recently watched</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickList}>
            {recentsForPlaylist.map(renderQuickChannel)}
          </ScrollView>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList}>
        {groups.map((group) => (
          <TouchableOpacity
            key={group}
            style={[styles.groupChip, selectedGroup === group && styles.groupChipActive]}
            onPress={() => setSelectedGroup(group)}
          >
            <Text style={[styles.groupChipText, selectedGroup === group && styles.groupChipTextActive]}>{group}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>{selectedGroup === ALL_GROUPS ? 'Channels' : selectedGroup}</Text>
        <Text style={styles.resultCount}>{filteredChannels.length}</Text>
      </View>
    </>
  );

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.stateText}>Loading {selectedPlaylist?.name ?? 'playlist'}...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.errorTitle}>Playlist unavailable</Text>
        <Text style={styles.stateText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => selectedPlaylist && void loadPlaylist(selectedPlaylist.id)}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={filteredChannels}
      keyExtractor={(item) => item.id}
      renderItem={renderChannel}
      ListHeaderComponent={listHeader}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      initialNumToRender={16}
      windowSize={7}
      maxToRenderPerBatch={16}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Radio size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>No channels found</Text>
          <Text style={styles.stateText}>Try another group or a different search term.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 36,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  headerTitle: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.Bold,
    fontSize: 32,
  },
  headerSubtitle: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  chipList: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  playlistChip: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  playlistChipActive: {
    backgroundColor: `${Colors.accent}22`,
    borderColor: Colors.accent,
  },
  playlistChipText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.SemiBold,
    fontSize: 12,
  },
  playlistChipTextActive: {
    color: Colors.text,
  },
  searchContainer: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    marginHorizontal: 16,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: Colors.text,
    flex: 1,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 15,
    height: 48,
  },
  quickSection: {
    marginBottom: 18,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.Bold,
    fontSize: 17,
  },
  quickList: {
    gap: 10,
    paddingHorizontal: 16,
  },
  quickChannel: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 10,
    width: 100,
  },
  quickLogo: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    height: 48,
    marginBottom: 8,
    width: 80,
  },
  quickChannelName: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  groupChip: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  groupChipActive: {
    backgroundColor: Colors.accent,
  },
  groupChipText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.SemiBold,
    fontSize: 11,
  },
  groupChipTextActive: {
    color: Colors.text,
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  resultTitle: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.Bold,
    fontSize: 20,
  },
  resultCount: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 12,
  },
  channelCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    flexDirection: 'row',
    marginBottom: 8,
    marginHorizontal: 16,
    minHeight: 72,
  },
  channelPressable: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
    padding: 10,
  },
  logo: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    height: 48,
    width: 64,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelInfo: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  channelName: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.SemiBold,
    fontSize: 14,
  },
  channelGroup: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 12,
    marginTop: 4,
  },
  channelActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteButton: {
    padding: 16,
  },
  removeChannelButton: {
    padding: 16,
    paddingLeft: 4,
  },
  stateContainer: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  stateText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  errorTitle: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.Bold,
    fontSize: 22,
  },
  retryButton: {
    backgroundColor: Colors.accent,
    borderRadius: 9,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.Bold,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
    paddingTop: 56,
  },
  emptyTitle: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.Bold,
    fontSize: 20,
  },
});
