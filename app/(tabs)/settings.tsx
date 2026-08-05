import { AppAlert } from '@/components/AppAlert';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { getStreamProvider, STREAM_PROVIDERS } from '@/constants/streamProviders';
import { useSettings } from '@/contexts/SettingsContext';
import axios from 'axios';
import Constants from 'expo-constants';
import { Check, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const getPlaylistHost = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Invalid URL';
  }
};

export default function SettingsScreen() {
  const {
    streamUrl,
    tmdbApiKey,
    streamProvider,
    iptvPlaylists,
    iptvChannels,
    setStreamUrl,
    setTmdbApiKey,
    setStreamProvider,
    addIptvPlaylist,
    removeIptvPlaylist,
    addIptvChannel,
    removeIptvChannel,
  } = useSettings();
  const insets = useSafeAreaInsets();
  const [localStreamUrl, setLocalStreamUrl] = useState(streamUrl);
  const [localApiKey, setLocalApiKey] = useState(tmdbApiKey);
  const [localProvider, setLocalProvider] = useState(streamProvider);
  const [iptvPlaylistName, setIptvPlaylistName] = useState('');
  const [iptvPlaylistUrl, setIptvPlaylistUrl] = useState('');
  const [iptvChannelName, setIptvChannelName] = useState('');
  const [iptvChannelUrl, setIptvChannelUrl] = useState('');

  const handleSaveProvider = async () => {
    await setStreamProvider(localProvider);

    if (localProvider !== 'custom') {
      const provider = getStreamProvider(localProvider);
      if (provider) {
        await setStreamUrl(provider.baseUrl);
        setLocalStreamUrl(provider.baseUrl);
      }
    }

    AppAlert.alert('Success', 'Stream provider saved successfully');
  };

  const handleSaveStreamUrl = async () => {
    await setStreamUrl(localStreamUrl);
    AppAlert.alert('Success', 'Stream URL saved successfully');
  };

  const handleSaveApiKey = async () => {
    await setTmdbApiKey(localApiKey);
    AppAlert.alert('Success', 'TMDB API Key saved successfully');
  };

  const handleAddIptvPlaylist = async () => {
    try {
      await addIptvPlaylist({ name: iptvPlaylistName, url: iptvPlaylistUrl });
      setIptvPlaylistName('');
      setIptvPlaylistUrl('');
      AppAlert.alert('Playlist added', 'It is ready to load from the IPTV tab.');
    } catch (error) {
      AppAlert.alert(
        'Playlist not added',
        error instanceof Error ? error.message : 'Please check the playlist details.'
      );
    }
  };

  const handleAddIptvChannel = async () => {
    try {
      await addIptvChannel({ name: iptvChannelName, url: iptvChannelUrl });
      setIptvChannelName('');
      setIptvChannelUrl('');
      AppAlert.alert('Channel added', 'It is ready to play from the IPTV tab.');
    } catch (error) {
      AppAlert.alert(
        'Channel not added',
        error instanceof Error ? error.message : 'Please check the channel details.'
      );
    }
  };

  const confirmRemoveIptvChannel = (channelId: string, channelName: string) => {
    AppAlert.alert('Remove channel', `Remove ${channelName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removeIptvChannel(channelId),
      },
    ]);
  };

  const confirmRemoveIptvPlaylist = (playlistId: string, playlistName: string) => {
    AppAlert.alert('Remove playlist', `Remove ${playlistName} and its saved channels?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeIptvPlaylist(playlistId);
        },
      },
    ]);
  };

  const testAPI = async () => {
    if (!localApiKey) {
      AppAlert.alert('Error', 'Please enter an API key first');
      return;
    }

    try {
      const isBearerToken = localApiKey.startsWith('eyJ') || localApiKey.length > 100;

      let response;
      if (isBearerToken) {
        response = await axios.get('https://api.themoviedb.org/3/trending/all/week', {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${localApiKey}`,
          },
        });
      } else {
        response = await axios.get('https://api.themoviedb.org/3/trending/all/week', {
          params: { api_key: localApiKey },
        });
      }

      AppAlert.alert(
        'Success!',
        `${isBearerToken ? 'Bearer token' : 'API key'} is valid!\nGot ${response.data.results.length} trending items.`
      );
    } catch (error: any) {
      const errorMsg = error.response?.data?.status_message || error.message;
      AppAlert.alert('API Test Failed', errorMsg);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerLabel}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Stream Provider</Text>
        <Text style={styles.hint}>Choose where playback embeds load from.</Text>

        {STREAM_PROVIDERS.map((provider) => {
          const selected = localProvider === provider.id;
          return (
            <TouchableOpacity
              key={provider.id}
              style={[styles.providerOption, selected && styles.providerOptionSelected]}
              onPress={() => setLocalProvider(provider.id)}
              activeOpacity={0.85}
            >
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>
                  {provider.displayName || provider.name}
                </Text>
                {provider.id === 'custom' ? (
                  <Text style={styles.providerUrl}>Use your own streaming URL</Text>
                ) : provider.baseUrl ? (
                  <Text style={styles.providerUrl} numberOfLines={1}>
                    {provider.baseUrl}
                  </Text>
                ) : null}
                {selected && provider.id !== 'custom' && provider.baseUrl ? (
                  <View style={styles.exampleUrls}>
                    <Text style={styles.exampleUrl} numberOfLines={1}>
                      Movie · {provider.constructUrl({ type: 'movie', id: '299534' })}
                    </Text>
                    <Text style={styles.exampleUrl} numberOfLines={1}>
                      TV ·{' '}
                      {provider.constructUrl({
                        type: 'tv',
                        id: '1399',
                        season: '1',
                        episode: '1',
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>
              {selected && <Check size={18} color={Colors.accent} />}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSaveProvider}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Save Provider</Text>
        </TouchableOpacity>
      </View>

      {localProvider === 'custom' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Custom Stream URL</Text>
          <TextInput
            style={styles.input}
            value={localStreamUrl}
            onChangeText={setLocalStreamUrl}
            placeholder="https://your-custom-player.com"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSaveStreamUrl}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Save Custom URL</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            Format: {'{base}'}/movie/{'{id}'} or {'{base}'}/tv/{'{id}'}/{'{season}'}/
            {'{episode}'}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>IPTV Playlists</Text>
        <Text style={styles.hint}>Add an HTTPS M3U playlist.</Text>
        <TextInput
          style={styles.input}
          value={iptvPlaylistName}
          onChangeText={setIptvPlaylistName}
          placeholder="Playlist name"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={iptvPlaylistUrl}
          onChangeText={setIptvPlaylistUrl}
          placeholder="https://example.com/channels.m3u"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleAddIptvPlaylist}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Add Playlist</Text>
        </TouchableOpacity>

        <View style={styles.list}>
          {iptvPlaylists.map((playlist) => (
            <View key={playlist.id} style={styles.listItem}>
              <View style={styles.listInfo}>
                <Text style={styles.listName}>{playlist.name}</Text>
                <Text style={styles.listMeta}>{getPlaylistHost(playlist.url)}</Text>
              </View>
              {playlist.isBuiltIn ? (
                <Text style={styles.builtInLabel}>Built-in</Text>
              ) : (
                <TouchableOpacity
                  accessibilityLabel={`Remove ${playlist.name} playlist`}
                  style={styles.removeButton}
                  onPress={() => confirmRemoveIptvPlaylist(playlist.id, playlist.name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Custom Channels</Text>
        <Text style={styles.hint}>Add an individual direct stream URL.</Text>
        <TextInput
          style={styles.input}
          value={iptvChannelName}
          onChangeText={setIptvChannelName}
          placeholder="Channel name"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={iptvChannelUrl}
          onChangeText={setIptvChannelUrl}
          placeholder="https://example.com/stream.m3u8"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleAddIptvChannel}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Add Channel</Text>
        </TouchableOpacity>

        {iptvChannels.length > 0 && (
          <View style={styles.list}>
            {iptvChannels.map((channel) => (
              <View key={channel.id} style={styles.listItem}>
                <View style={styles.listInfo}>
                  <Text style={styles.listName}>{channel.name}</Text>
                  <Text style={styles.listMeta} numberOfLines={1}>
                    {channel.streamUrl}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityLabel={`Remove ${channel.name}`}
                  style={styles.removeButton}
                  onPress={() => confirmRemoveIptvChannel(channel.id, channel.name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TMDB API</Text>
        <Text style={styles.hint}>
          API Key (v3) or Bearer token — the app auto-detects which you use.
        </Text>
        <TextInput
          style={styles.input}
          value={localApiKey}
          onChangeText={setLocalApiKey}
          placeholder="Enter your TMDB API key"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.primaryButton, styles.buttonHalf]}
            onPress={handleSaveApiKey}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, styles.buttonHalf]}
            onPress={testAPI}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Test</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>About</Text>
        <Text style={styles.aboutText}>Yummy v{Constants.expoConfig?.version}</Text>
        <Text style={styles.aboutMeta}>Personal streaming app powered by TMDB</Text>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 16,
  },
  headerLabel: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 24,
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
    marginBottom: 10,
  },
  hint: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 8,
    fontSize: 15,
    fontFamily: Fonts.GeistMono.Regular,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Bold,
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Bold,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonHalf: {
    flex: 1,
  },
  aboutText: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: Fonts.GeistMono.SemiBold,
    marginBottom: 4,
  },
  aboutMeta: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
  },
  providerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  providerOptionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.card,
  },
  providerInfo: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  providerName: {
    fontSize: 15,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
    marginBottom: 4,
  },
  providerUrl: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
  exampleUrls: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: 4,
  },
  exampleUrl: {
    fontSize: 10,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
  },
  list: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  listInfo: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  listName: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.SemiBold,
    fontSize: 14,
    marginBottom: 3,
  },
  listMeta: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 12,
  },
  builtInLabel: {
    color: Colors.accent,
    fontFamily: Fonts.GeistMono.SemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  removeButton: {
    padding: 8,
  },
  bottomSpacer: {
    height: 48,
  },
});
