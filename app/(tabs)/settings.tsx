import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { getStreamProvider, STREAM_PROVIDERS } from '@/constants/streamProviders';
import { useSettings } from '@/contexts/SettingsContext';
import axios from 'axios';
import Constants from 'expo-constants';
import { Check, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

    Alert.alert('Success', 'Stream provider saved successfully');
  };

  const handleSaveStreamUrl = async () => {
    await setStreamUrl(localStreamUrl);
    Alert.alert('Success', 'Stream URL saved successfully');
  };

  const handleSaveApiKey = async () => {
    await setTmdbApiKey(localApiKey);
    Alert.alert('Success', 'TMDB API Key saved successfully');
  };

  const handleAddIptvPlaylist = async () => {
    try {
      await addIptvPlaylist({ name: iptvPlaylistName, url: iptvPlaylistUrl });
      setIptvPlaylistName('');
      setIptvPlaylistUrl('');
      Alert.alert('Playlist added', 'It is ready to load from the IPTV tab.');
    } catch (error) {
      Alert.alert('Playlist not added', error instanceof Error ? error.message : 'Please check the playlist details.');
    }
  };

  const handleAddIptvChannel = async () => {
    try {
      await addIptvChannel({ name: iptvChannelName, url: iptvChannelUrl });
      setIptvChannelName('');
      setIptvChannelUrl('');
      Alert.alert('Channel added', 'It is ready to play from the IPTV tab.');
    } catch (error) {
      Alert.alert('Channel not added', error instanceof Error ? error.message : 'Please check the channel details.');
    }
  };

  const confirmRemoveIptvChannel = (channelId: string, channelName: string) => {
    Alert.alert('Remove channel', `Remove ${channelName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removeIptvChannel(channelId),
      },
    ]);
  };

  const confirmRemoveIptvPlaylist = (playlistId: string, playlistName: string) => {
    Alert.alert('Remove playlist', `Remove ${playlistName} and its saved channels?`, [
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
      Alert.alert('Error', 'Please enter an API key first');
      return;
    }

    try {
      console.log('Testing API key/token...');
      
      const isBearerToken = localApiKey.startsWith('eyJ') || localApiKey.length > 100;
      
      let response;
      if (isBearerToken) {
        console.log('Using Bearer token authentication');
        response = await axios.get(
          'https://api.themoviedb.org/3/trending/all/week',
          {
            headers: {
              accept: 'application/json',
              Authorization: `Bearer ${localApiKey}`,
            },
          }
        );
      } else {
        console.log('Using API key authentication');
        response = await axios.get(
          'https://api.themoviedb.org/3/trending/all/week',
          { params: { api_key: localApiKey } }
        );
      }
      
      console.log('API test successful, got', response.data.results.length, 'results');
      Alert.alert(
        'Success!', 
        `${isBearerToken ? 'Bearer token' : 'API key'} is valid!\nGot ${response.data.results.length} trending items.`
      );
    } catch (error: any) {
      console.error('API test failed:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.status_message || error.message;
      Alert.alert('API Test Failed', errorMsg);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stream Provider</Text>
        <Text style={styles.label}>Choose your streaming provider</Text>

        {STREAM_PROVIDERS.map((provider) => (
          <TouchableOpacity
            key={provider.id}
            style={[
              styles.providerOption,
              localProvider === provider.id && styles.providerOptionSelected,
            ]}
            onPress={() => setLocalProvider(provider.id)}
          >
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>{provider.name}</Text>
              {provider.baseUrl && provider.id !== 'custom' && (
                <>
                  <Text style={styles.providerUrl}>{provider.baseUrl}</Text>
                  <View style={styles.exampleUrls}>
                    <Text style={styles.exampleLabel}>Example URLs:</Text>
                    <Text style={styles.exampleUrl}>
                      Movie: {provider.constructUrl({ type: 'movie', id: '299534' })}
                    </Text>
                    <Text style={styles.exampleUrl}>
                      TV: {provider.constructUrl({ type: 'tv', id: '1399', season: '1', episode: '1' })}
                    </Text>
                  </View>
                </>
              )}
              {provider.id === 'custom' && (
                <Text style={styles.providerUrl}>Use your own streaming URL</Text>
              )}
            </View>
            {localProvider === provider.id && (
              <Check size={20} color={Colors.accent} />
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.button} onPress={handleSaveProvider}>
          <Text style={styles.buttonText}>Save Provider</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Select a streaming provider. Each provider has different content availability and quality.
          {'\n\n'}You can also use a custom URL.
        </Text>
      </View>

      {localProvider === 'custom' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Stream URL</Text>
          <Text style={styles.label}>Base Stream URL</Text>
          <TextInput
            style={styles.input}
            value={localStreamUrl}
            onChangeText={setLocalStreamUrl}
            placeholder="https://your-custom-player.com"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.button} onPress={handleSaveStreamUrl}>
            <Text style={styles.buttonText}>Save Custom URL</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            Enter your custom streaming URL.{'\n'}
            Format: {'{base_url}'}/movie/{'{id}'} or {'{base_url}'}/tv/{'{id}'}/{'{season}'}/{'{episode}'}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>IPTV Playlists</Text>
        <Text style={styles.label}>Add an HTTPS M3U playlist</Text>
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
        <TouchableOpacity style={styles.button} onPress={handleAddIptvPlaylist}>
          <Text style={styles.buttonText}>Add Playlist</Text>
        </TouchableOpacity>

        <View style={styles.playlistList}>
          {iptvPlaylists.map((playlist) => (
            <View key={playlist.id} style={styles.playlistItem}>
              <View style={styles.playlistInfo}>
                <Text style={styles.playlistName}>{playlist.name}</Text>
                <Text style={styles.playlistHost}>{getPlaylistHost(playlist.url)}</Text>
              </View>
              {playlist.isBuiltIn ? (
                <Text style={styles.builtInLabel}>Built-in</Text>
              ) : (
                <TouchableOpacity
                  accessibilityLabel={`Remove ${playlist.name} playlist`}
                  style={styles.removePlaylistButton}
                  onPress={() => confirmRemoveIptvPlaylist(playlist.id, playlist.name)}
                >
                  <Trash2 size={18} color={Colors.accent} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        <Text style={styles.hint}>
          IPTV-org is included by default. Only public, direct streams that allow browser playback can open in Plyr.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Channels</Text>
        <Text style={styles.label}>Add an individual channel stream URL</Text>
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
        <TouchableOpacity style={styles.button} onPress={handleAddIptvChannel}>
          <Text style={styles.buttonText}>Add Channel</Text>
        </TouchableOpacity>

        {iptvChannels.length > 0 && (
          <View style={styles.playlistList}>
            {iptvChannels.map((channel) => (
              <View key={channel.id} style={styles.playlistItem}>
                <View style={styles.playlistInfo}>
                  <Text style={styles.playlistName}>{channel.name}</Text>
                  <Text style={styles.playlistHost}>{channel.streamUrl}</Text>
                </View>
                <TouchableOpacity
                  accessibilityLabel={`Remove ${channel.name}`}
                  style={styles.removePlaylistButton}
                  onPress={() => confirmRemoveIptvChannel(channel.id, channel.name)}
                >
                  <Trash2 size={18} color={Colors.accent} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.hint}>
          Add individual direct stream URLs (HLS, MP4, etc.). They will appear in the IPTV tab and can be played through Plyr.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TMDB API</Text>
        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          value={localApiKey}
          onChangeText={setLocalApiKey}
          placeholder="Enter your TMDB API key"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.buttonHalf]} onPress={handleSaveApiKey}>
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.buttonHalf, styles.buttonSecondary]} onPress={testAPI}>
            <Text style={styles.buttonText}>Test</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Get your credentials from themoviedb.org/settings/api{'\n'}
          You can use either:{'\n'}
          • API Key (v3 auth) - 32 characters{'\n'}
          • Bearer Token (API Read Access Token) - Long JWT token{'\n'}
          Both work! The app will auto-detect which one you're using.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>Yummy v{Constants.expoConfig?.version}</Text>
        <Text style={styles.aboutText}>A personal streaming app powered by TMDB</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 15,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
  },
  section: {
    padding: 15,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.GeistMono.Bold,
    color: Colors.text,
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.text,
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Regular,
    marginBottom: 15,
  },
  button: {
    backgroundColor: Colors.accent,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonHalf: {
    flex: 1,
  },
  buttonSecondary: {
    backgroundColor: Colors.card,
  },
  buttonText: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: Fonts.GeistMono.Bold,
  },
  hint: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    marginTop: 10,
    lineHeight: 18,
  },
  aboutText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.GeistMono.Regular,
    marginBottom: 5,
  },
  providerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  providerOptionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.card,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
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
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.textSecondary + '20',
  },
  exampleLabel: {
    fontSize: 11,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  exampleUrl: {
    fontSize: 10,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  playlistList: {
    marginTop: 16,
    gap: 10,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
  },
  playlistInfo: {
    flex: 1,
    marginRight: 12,
  },
  playlistName: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.SemiBold,
    fontSize: 14,
    marginBottom: 3,
  },
  playlistHost: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 12,
  },
  builtInLabel: {
    color: Colors.accent,
    fontFamily: Fonts.GeistMono.SemiBold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  removePlaylistButton: {
    padding: 8,
  },
});
