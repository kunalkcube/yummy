import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { IptvChannel } from '@/constants/iptv';
import { useSettings } from '@/contexts/SettingsContext';
import { fetchIptvChannels } from '@/hooks/useIptv';
import { useRouter } from 'expo-router';
import { AlertCircle, Heart, Radio, Search, Star, Trash2, X } from 'lucide-react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ALL_GROUPS = 'All';

export default function IptvScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const loadPlaylist = useCallback(
    async (playlistId: string) => {
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
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load this playlist.'
        );
      } finally {
        if (requestId === playlistRequestId.current) {
          setLoading(false);
        }
      }
    },
    [iptvPlaylists]
  );

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
    () => [
      ALL_GROUPS,
      ...Array.from(new Set(channels.map((channel) => channel.group))).sort((a, b) =>
        a.localeCompare(b)
      ),
    ],
    [channels]
  );

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredChannels = useMemo(
    () =>
      channels.filter((channel) => {
        const matchesGroup = selectedGroup === ALL_GROUPS || channel.group === selectedGroup;
        const matchesQuery =
          !normalizedQuery ||
          [channel.name, channel.group, channel.tvgId]
            .filter(Boolean)
            .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
        return matchesGroup && matchesQuery;
      }),
    [channels, normalizedQuery, selectedGroup]
  );

  const favoriteIds = useMemo(
    () => new Set(iptvFavorites.map((channel) => channel.id)),
    [iptvFavorites]
  );
  const favoritesForPlaylist = useMemo(
    () => iptvFavorites.filter((channel) => channel.playlistId === selectedPlaylist?.id),
    [iptvFavorites, selectedPlaylist?.id]
  );
  const recentsForPlaylist = useMemo(
    () =>
      iptvRecentChannels.filter(
        (channel) => channel.playlistId === selectedPlaylist?.id || channel.isCustom
      ),
    [iptvRecentChannels, selectedPlaylist?.id]
  );

  const openChannel = useCallback(
    (channel: IptvChannel) => {
      void recordIptvRecent(channel);
      router.push({
        pathname: '/iptv-player',
        params: {
          channelName: channel.name,
          streamUrl: channel.streamUrl,
        },
      });
    },
    [recordIptvRecent, router]
  );

  const renderLogo = (channel: IptvChannel, compact = false) =>
    channel.logoUrl ? (
      <Image
        source={{ uri: channel.logoUrl }}
        style={compact ? styles.quickLogo : styles.logo}
        resizeMode="contain"
      />
    ) : (
      <View style={[compact ? styles.quickLogo : styles.logo, styles.logoFallback]}>
        <Radio size={compact ? 16 : 20} color={Colors.accent} />
      </View>
    );

  const renderQuickChannel = (channel: IptvChannel) => (
    <TouchableOpacity
      key={channel.id}
      style={styles.quickChannel}
      onPress={() => openChannel(channel)}
      activeOpacity={0.85}
    >
      {renderLogo(channel, true)}
      <Text style={styles.quickChannelName} numberOfLines={2}>
        {channel.name}
      </Text>
    </TouchableOpacity>
  );

  const renderChannel = ({ item }: { item: IptvChannel }) => {
    const isFavorite = favoriteIds.has(item.id);

    return (
      <View style={styles.channelRow}>
        <TouchableOpacity
          style={styles.channelPressable}
          onPress={() => openChannel(item)}
          accessibilityLabel={`Play ${item.name}`}
          activeOpacity={0.85}
        >
          {renderLogo(item)}
          <View style={styles.channelInfo}>
            <Text style={styles.channelName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.channelGroup} numberOfLines={1}>
              {item.group}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.channelActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => void toggleIptvFavorite(item)}
            accessibilityLabel={
              isFavorite
                ? `Remove ${item.name} from favorites`
                : `Add ${item.name} to favorites`
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Heart
              size={18}
              color={isFavorite ? Colors.accent : Colors.textSecondary}
              fill={isFavorite ? Colors.accent : 'transparent'}
            />
          </TouchableOpacity>
          {item.isCustom && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => removeIptvChannel(item.id)}
              accessibilityLabel={`Remove ${item.name}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const listHeader = (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerLabel}>IPTV</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipList}
      >
        {iptvPlaylists.map((playlist) => {
          const active = selectedPlaylist?.id === playlist.id;
          return (
            <TouchableOpacity
              key={playlist.id}
              style={[styles.playlistChip, active && styles.playlistChipActive]}
              onPress={() => setSelectedPlaylistId(playlist.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.playlistChipText, active && styles.playlistChipTextActive]}>
                {playlist.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search channels..."
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search IPTV channels"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {favoritesForPlaylist.length > 0 && (
        <View style={styles.quickSection}>
          <View style={styles.sectionHeading}>
            <Heart size={14} color={Colors.accent} fill={Colors.accent} />
            <Text style={styles.sectionLabel}>Favorites</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickList}
          >
            {favoritesForPlaylist.map(renderQuickChannel)}
          </ScrollView>
        </View>
      )}

      {iptvChannels.length > 0 && (
        <View style={styles.quickSection}>
          <View style={styles.sectionHeading}>
            <Radio size={14} color={Colors.accent} />
            <Text style={styles.sectionLabel}>Custom</Text>
            <Text style={styles.resultCount}>{iptvChannels.length}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickList}
          >
            {iptvChannels.map(renderQuickChannel)}
          </ScrollView>
        </View>
      )}

      {recentsForPlaylist.length > 0 && (
        <View style={styles.quickSection}>
          <View style={styles.sectionHeading}>
            <Star size={14} color={Colors.accent} />
            <Text style={styles.sectionLabel}>Recent</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickList}
          >
            {recentsForPlaylist.map(renderQuickChannel)}
          </ScrollView>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipList}
      >
        {groups.map((group) => {
          const active = selectedGroup === group;
          return (
            <TouchableOpacity
              key={group}
              style={[styles.groupChip, active && styles.groupChipActive]}
              onPress={() => setSelectedGroup(group)}
              activeOpacity={0.85}
            >
              <Text style={[styles.groupChipText, active && styles.groupChipTextActive]}>
                {group}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.resultHeader}>
        <Text style={styles.sectionLabel}>
          {selectedGroup === ALL_GROUPS ? 'Channels' : selectedGroup}
        </Text>
        <Text style={styles.resultCount}>
          {filteredChannels.length} channel{filteredChannels.length === 1 ? '' : 's'}
        </Text>
      </View>
    </>
  );

  if (loading) {
    return (
      <ScreenContainer style={styles.stateContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.stateText}>
          Loading {selectedPlaylist?.name ?? 'playlist'}...
        </Text>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer style={styles.stateContainer}>
        <AlertCircle size={40} color={Colors.textSecondary} />
        <Text style={styles.errorTitle}>Playlist unavailable</Text>
        <Text style={styles.stateText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => selectedPlaylist && void loadPlaylist(selectedPlaylist.id)}
          activeOpacity={0.85}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container}>
    <FlatList
      style={styles.container}
      data={filteredChannels}
      keyExtractor={(item) => item.id}
      renderItem={renderChannel}
      ListHeaderComponent={listHeader}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={16}
      windowSize={7}
      maxToRenderPerBatch={16}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Radio size={40} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>No channels found</Text>
          <Text style={styles.stateText}>
            Try another group or a different search term.
          </Text>
        </View>
      }
    />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 48,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerLabel: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  chipList: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  playlistChip: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  playlistChipActive: {
    backgroundColor: Colors.card,
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
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    color: Colors.text,
    flex: 1,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 15,
    paddingVertical: 0,
  },
  quickSection: {
    marginBottom: 18,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.SemiBold,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  quickList: {
    gap: 10,
    paddingHorizontal: 16,
  },
  quickChannel: {
    alignItems: 'center',
    width: 88,
  },
  quickLogo: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    height: 56,
    marginBottom: 8,
    width: 88,
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
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.card,
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
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  resultCount: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Medium,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  channelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 4,
    marginHorizontal: 16,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  channelPressable: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
    paddingVertical: 10,
  },
  logo: {
    backgroundColor: Colors.surface,
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
  actionButton: {
    padding: 12,
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
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorTitle: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.Bold,
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#000',
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
    fontSize: 16,
  },
});
