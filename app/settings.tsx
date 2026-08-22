import { AppAlert } from '@/components/AppAlert';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { webInputReset } from '@/constants/inputStyles';
import {
  STREAM_DISCLAIMER_MESSAGE,
  STREAM_DISCLAIMER_TITLE,
} from '@/constants/streamDisclaimer';
import {
  getProviderHostname,
  getStreamProvider,
  STREAM_PROVIDERS,
} from '@/constants/streamProviders';
import { useSettings } from '@/contexts/SettingsContext';
import axios from 'axios';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Linking,
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
    streamDisclaimerAccepted,
    iptvPlaylists,
    iptvChannels,
    setStreamUrl,
    setTmdbApiKey,
    setStreamProvider,
    acceptStreamDisclaimer,
    addIptvPlaylist,
    removeIptvPlaylist,
    addIptvChannel,
    removeIptvChannel,
  } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [localStreamUrl, setLocalStreamUrl] = useState(streamUrl);
  const [localApiKey, setLocalApiKey] = useState(tmdbApiKey);
  const [localProvider, setLocalProvider] = useState(streamProvider);
  const [iptvPlaylistName, setIptvPlaylistName] = useState('');
  const [iptvPlaylistUrl, setIptvPlaylistUrl] = useState('');
  const [iptvChannelName, setIptvChannelName] = useState('');
  const [iptvChannelUrl, setIptvChannelUrl] = useState('');

  useEffect(() => {
    setLocalProvider(streamProvider);
  }, [streamProvider]);

  useEffect(() => {
    setLocalStreamUrl(streamUrl);
  }, [streamUrl]);

  const handleAcceptDisclaimer = async () => {
    await acceptStreamDisclaimer();
    AppAlert.alert(
      'Notice accepted',
      'You can choose a third-party embed provider below. You use it at your own risk.'
    );
  };

  const handleSaveProvider = async () => {
    if (!streamDisclaimerAccepted) {
      AppAlert.alert(
        STREAM_DISCLAIMER_TITLE,
        'Accept the third-party stream notice before choosing a provider.'
      );
      return;
    }

    if (!localProvider) {
      AppAlert.alert('No provider selected', 'Pick an embed provider or Custom URL.');
      return;
    }

    await setStreamProvider(localProvider);

    if (localProvider !== 'custom') {
      const provider = getStreamProvider(localProvider);
      if (provider) {
        await setStreamUrl(provider.baseUrl);
        setLocalStreamUrl(provider.baseUrl);
      }
    }

    AppAlert.alert('Saved', 'Stream provider saved.');
  };

  const handleSaveStreamUrl = async () => {
    if (!streamDisclaimerAccepted) {
      AppAlert.alert(
        STREAM_DISCLAIMER_TITLE,
        'Accept the third-party stream notice before saving a custom URL.'
      );
      return;
    }

    await setStreamUrl(localStreamUrl);
    AppAlert.alert('Saved', 'Custom stream URL saved.');
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
    <ScreenContainer style={styles.container}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Stream Provider</Text>
        <Text style={styles.hint}>
          Unofficial third-party embeds. Yummy does not host video. Use at your own risk.
        </Text>

        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>{STREAM_DISCLAIMER_TITLE}</Text>
          <Text style={styles.disclaimerBody}>{STREAM_DISCLAIMER_MESSAGE}</Text>
          {streamDisclaimerAccepted ? (
            <Text style={styles.disclaimerAccepted}>Accepted on this device</Text>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleAcceptDisclaimer}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>I understand — unlock providers</Text>
            </TouchableOpacity>
          )}
        </View>

        {!streamDisclaimerAccepted ? (
          <Text style={styles.lockedHint}>
            Accept the notice above to choose a provider. Real hostnames are shown for transparency.
          </Text>
        ) : null}

        {STREAM_PROVIDERS.map((provider) => {
          const selected = localProvider === provider.id;
          const host = getProviderHostname(provider.baseUrl);
          return (
            <TouchableOpacity
              key={provider.id}
              style={[
                styles.providerOption,
                selected && styles.providerOptionSelected,
                !streamDisclaimerAccepted && styles.providerOptionLocked,
              ]}
              onPress={() => {
                if (!streamDisclaimerAccepted) {
                  AppAlert.alert(
                    STREAM_DISCLAIMER_TITLE,
                    'Accept the third-party stream notice first.'
                  );
                  return;
                }
                setLocalProvider(provider.id);
              }}
              activeOpacity={0.85}
              disabled={!streamDisclaimerAccepted}
            >
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{provider.name}</Text>
                {provider.id === 'custom' ? (
                  <Text style={styles.providerUrl}>Paste your own HTTPS embed base URL</Text>
                ) : host ? (
                  <Text style={styles.providerUrl} numberOfLines={1}>
                    {host}
                  </Text>
                ) : null}
                {selected && streamDisclaimerAccepted && provider.id !== 'custom' && provider.baseUrl ? (
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
              {selected && streamDisclaimerAccepted ? (
                <Check size={18} color={Colors.accent} />
              ) : null}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.primaryButton, !streamDisclaimerAccepted && styles.primaryButtonDisabled]}
          onPress={handleSaveProvider}
          activeOpacity={0.85}
          disabled={!streamDisclaimerAccepted}
        >
          <Text style={styles.primaryButtonText}>Save Provider</Text>
        </TouchableOpacity>
      </View>

      {streamDisclaimerAccepted && localProvider === 'custom' && (
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
        <TouchableOpacity
          onPress={() => Linking.openURL('https://github.com/kunalkcube')}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="Built by kunalkcube, opens GitHub"
        >
          <Text style={styles.aboutCredit}>
            Built by <Text style={styles.aboutCreditLink}>kunalkcube</Text>
          </Text>
        </TouchableOpacity>
        <Text style={[styles.aboutMeta, styles.privacyNote]}>
          Privacy: Yummy has no backend. TMDB credentials, IPTV playlists/channels, favorites,
          watchlist, continue-watching, watch history, episode progress, and stream-disclaimer acceptance stay on this device
          (AsyncStorage). Network requests go only to the third-party APIs you use (TMDB, IPTV
          playlists, manga sources, stream embeds).
        </Text>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
    </ScreenContainer>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  headerLabel: {
    fontSize: 13,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
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
  disclaimerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.card,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.text,
  },
  disclaimerBody: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Regular,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  disclaimerAccepted: {
    fontSize: 12,
    fontFamily: Fonts.GeistMono.SemiBold,
    color: Colors.accent,
  },
  lockedHint: {
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
    ...webInputReset,
  },
  primaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
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
  aboutCredit: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.GeistMono.Regular,
    marginTop: 8,
  },
  aboutCreditLink: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.SemiBold,
    textDecorationLine: 'underline',
  },
  privacyNote: {
    marginTop: 12,
    lineHeight: 20,
    fontSize: 12,
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
  providerOptionLocked: {
    opacity: 0.45,
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
