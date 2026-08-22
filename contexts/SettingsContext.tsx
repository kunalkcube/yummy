import AsyncStorage from '@react-native-async-storage/async-storage';
import { IPTV_ORG_PLAYLIST, IPTV_RECENT_CHANNEL_LIMIT, IptvChannel, IptvPlaylist } from '@/constants/iptv';
import { isIptvPlaylistUrl, isIptvStreamUrl } from '@/hooks/useIptv';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface SettingsContextType {
  streamUrl: string;
  tmdbApiKey: string;
  streamProvider: string;
  streamDisclaimerAccepted: boolean;
  iptvPlaylists: IptvPlaylist[];
  iptvChannels: IptvChannel[];
  iptvFavorites: IptvChannel[];
  iptvRecentChannels: IptvChannel[];
  setStreamUrl: (url: string) => Promise<void>;
  setTmdbApiKey: (key: string) => Promise<void>;
  setStreamProvider: (provider: string) => Promise<void>;
  acceptStreamDisclaimer: () => Promise<void>;
  addIptvPlaylist: (input: { name: string; url: string }) => Promise<void>;
  removeIptvPlaylist: (playlistId: string) => Promise<void>;
  addIptvChannel: (input: { name: string; url: string }) => Promise<void>;
  removeIptvChannel: (channelId: string) => Promise<void>;
  toggleIptvFavorite: (channel: IptvChannel) => Promise<void>;
  recordIptvRecent: (channel: IptvChannel) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEYS = {
  STREAM_URL: '@stream_url',
  TMDB_API_KEY: '@tmdb_api_key',
  STREAM_PROVIDER: '@stream_provider',
  STREAM_DISCLAIMER: '@stream_disclaimer_accepted',
  IPTV_PLAYLISTS: '@iptv_playlists',
  IPTV_CHANNELS: '@iptv_channels',
  IPTV_FAVORITES: '@iptv_favorites',
  IPTV_RECENTS: '@iptv_recent_channels',
};

const isStoredChannel = (value: unknown): value is IptvChannel => {
  if (!value || typeof value !== 'object') return false;

  const channel = value as Partial<IptvChannel>;
  return (
    typeof channel.id === 'string' &&
    typeof channel.playlistId === 'string' &&
    typeof channel.name === 'string' &&
    typeof channel.streamUrl === 'string' &&
    typeof channel.group === 'string' &&
    channel.isCustom !== true
  );
};

const isStoredPlaylist = (value: unknown): value is IptvPlaylist => {
  if (!value || typeof value !== 'object') return false;

  const playlist = value as Partial<IptvPlaylist>;
  return (
    typeof playlist.id === 'string' &&
    typeof playlist.name === 'string' &&
    typeof playlist.url === 'string' &&
    playlist.isBuiltIn !== true &&
    isIptvPlaylistUrl(playlist.url)
  );
};

const isStoredCustomChannel = (value: unknown): value is IptvChannel => {
  if (!value || typeof value !== 'object') return false;

  const channel = value as Partial<IptvChannel>;
  return (
    typeof channel.id === 'string' &&
    typeof channel.playlistId === 'string' &&
    typeof channel.name === 'string' &&
    typeof channel.streamUrl === 'string' &&
    typeof channel.group === 'string' &&
    channel.isCustom === true
  );
};

const parseStoredArray = <T,>(rawValue: string | null, isValid: (value: unknown) => value is T): T[] => {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter(isValid) : [];
  } catch {
    return [];
  }
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [streamUrl, setStreamUrlState] = useState('');
  const [tmdbApiKey, setTmdbApiKeyState] = useState('');
  const [streamProvider, setStreamProviderState] = useState('');
  const [streamDisclaimerAccepted, setStreamDisclaimerAccepted] = useState(false);
  const [iptvPlaylists, setIptvPlaylists] = useState<IptvPlaylist[]>([IPTV_ORG_PLAYLIST]);
  const [iptvChannels, setIptvChannels] = useState<IptvChannel[]>([]);
  const [iptvFavorites, setIptvFavorites] = useState<IptvChannel[]>([]);
  const [iptvRecentChannels, setIptvRecentChannels] = useState<IptvChannel[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedStreamUrl = await AsyncStorage.getItem(STORAGE_KEYS.STREAM_URL);
      const savedApiKey = await AsyncStorage.getItem(STORAGE_KEYS.TMDB_API_KEY);
      const savedProvider = await AsyncStorage.getItem(STORAGE_KEYS.STREAM_PROVIDER);
      const savedDisclaimer = await AsyncStorage.getItem(STORAGE_KEYS.STREAM_DISCLAIMER);
      const savedIptvPlaylists = await AsyncStorage.getItem(STORAGE_KEYS.IPTV_PLAYLISTS);
      const savedIptvChannels = await AsyncStorage.getItem(STORAGE_KEYS.IPTV_CHANNELS);
      const savedIptvFavorites = await AsyncStorage.getItem(STORAGE_KEYS.IPTV_FAVORITES);
      const savedIptvRecents = await AsyncStorage.getItem(STORAGE_KEYS.IPTV_RECENTS);

      if (savedStreamUrl) setStreamUrlState(savedStreamUrl);
      if (savedApiKey) setTmdbApiKeyState(savedApiKey);
      if (savedProvider) setStreamProviderState(savedProvider);
      setStreamDisclaimerAccepted(savedDisclaimer === '1');
      setIptvPlaylists([
        IPTV_ORG_PLAYLIST,
        ...parseStoredArray(savedIptvPlaylists, isStoredPlaylist),
      ]);
      setIptvChannels(parseStoredArray(savedIptvChannels, isStoredCustomChannel));
      setIptvFavorites(parseStoredArray(savedIptvFavorites, isStoredChannel));
      setIptvRecentChannels(parseStoredArray(savedIptvRecents, isStoredChannel).slice(0, IPTV_RECENT_CHANNEL_LIMIT));
    } catch {
      // Keep defaults if storage is unavailable
    }
  };

  const setStreamUrl = async (url: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STREAM_URL, url);
      setStreamUrlState(url);
    } catch {
      // Ignore persistence failures
    }
  };

  const setTmdbApiKey = async (key: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TMDB_API_KEY, key);
      setTmdbApiKeyState(key);
    } catch {
      // Ignore persistence failures
    }
  };

  const setStreamProvider = async (provider: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STREAM_PROVIDER, provider);
      setStreamProviderState(provider);
    } catch {
      // Ignore persistence failures
    }
  };

  const acceptStreamDisclaimer = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STREAM_DISCLAIMER, '1');
      setStreamDisclaimerAccepted(true);
    } catch {
      setStreamDisclaimerAccepted(true);
    }
  };

  const addIptvPlaylist = async ({ name, url }: { name: string; url: string }) => {
    const normalizedName = name.trim().slice(0, 80);
    const normalizedUrl = url.trim();

    if (!normalizedName || !isIptvPlaylistUrl(normalizedUrl)) {
      throw new Error('Enter a playlist name and an HTTPS M3U URL without embedded credentials.');
    }

    if (iptvPlaylists.some((playlist) => playlist.url === normalizedUrl)) {
      throw new Error('This playlist has already been added.');
    }

    const playlist: IptvPlaylist = {
      id: `iptv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: normalizedName,
      url: normalizedUrl,
    };
    const updatedPlaylists = [...iptvPlaylists, playlist];

    await AsyncStorage.setItem(
      STORAGE_KEYS.IPTV_PLAYLISTS,
      JSON.stringify(updatedPlaylists.filter((item) => !item.isBuiltIn))
    );
    setIptvPlaylists(updatedPlaylists);
  };

  const removeIptvPlaylist = async (playlistId: string) => {
    const playlist = iptvPlaylists.find((item) => item.id === playlistId);
    if (!playlist || playlist.isBuiltIn) return;

    const updatedPlaylists = iptvPlaylists.filter((item) => item.id !== playlistId);
    const updatedFavorites = iptvFavorites.filter((channel) => channel.playlistId !== playlistId);
    const updatedRecents = iptvRecentChannels.filter((channel) => channel.playlistId !== playlistId);

    await Promise.all([
      AsyncStorage.setItem(
        STORAGE_KEYS.IPTV_PLAYLISTS,
        JSON.stringify(updatedPlaylists.filter((item) => !item.isBuiltIn))
      ),
      AsyncStorage.setItem(STORAGE_KEYS.IPTV_FAVORITES, JSON.stringify(updatedFavorites)),
      AsyncStorage.setItem(STORAGE_KEYS.IPTV_RECENTS, JSON.stringify(updatedRecents)),
    ]);

    setIptvPlaylists(updatedPlaylists);
    setIptvFavorites(updatedFavorites);
    setIptvRecentChannels(updatedRecents);
  };

  const addIptvChannel = async ({ name, url }: { name: string; url: string }) => {
    const normalizedName = name.trim().slice(0, 80);
    const normalizedUrl = url.trim();

    if (!normalizedName || !isIptvStreamUrl(normalizedUrl)) {
      throw new Error('Enter a channel name and a valid public HTTP(S) stream URL.');
    }

    if (iptvChannels.some((channel) => channel.streamUrl === normalizedUrl)) {
      throw new Error('This channel URL has already been added.');
    }

    const id = `iptv-custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel: IptvChannel = {
      id,
      playlistId: 'custom-channels',
      name: normalizedName,
      streamUrl: normalizedUrl,
      group: 'Custom',
      isCustom: true,
    };
    const updatedChannels = [...iptvChannels, channel];

    await AsyncStorage.setItem(STORAGE_KEYS.IPTV_CHANNELS, JSON.stringify(updatedChannels));
    setIptvChannels(updatedChannels);
  };

  const removeIptvChannel = async (channelId: string) => {
    const updatedChannels = iptvChannels.filter((channel) => channel.id !== channelId);
    const updatedFavorites = iptvFavorites.filter((channel) => channel.id !== channelId);
    const updatedRecents = iptvRecentChannels.filter((channel) => channel.id !== channelId);

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.IPTV_CHANNELS, JSON.stringify(updatedChannels)),
      AsyncStorage.setItem(STORAGE_KEYS.IPTV_FAVORITES, JSON.stringify(updatedFavorites)),
      AsyncStorage.setItem(STORAGE_KEYS.IPTV_RECENTS, JSON.stringify(updatedRecents)),
    ]);

    setIptvChannels(updatedChannels);
    setIptvFavorites(updatedFavorites);
    setIptvRecentChannels(updatedRecents);
  };

  const toggleIptvFavorite = async (channel: IptvChannel) => {
    const exists = iptvFavorites.some((item) => item.id === channel.id);
    const updatedFavorites = exists
      ? iptvFavorites.filter((item) => item.id !== channel.id)
      : [channel, ...iptvFavorites];

    await AsyncStorage.setItem(STORAGE_KEYS.IPTV_FAVORITES, JSON.stringify(updatedFavorites));
    setIptvFavorites(updatedFavorites);
  };

  const recordIptvRecent = async (channel: IptvChannel) => {
    const updatedRecents = [channel, ...iptvRecentChannels.filter((item) => item.id !== channel.id)]
      .slice(0, IPTV_RECENT_CHANNEL_LIMIT);

    await AsyncStorage.setItem(STORAGE_KEYS.IPTV_RECENTS, JSON.stringify(updatedRecents));
    setIptvRecentChannels(updatedRecents);
  };

  return (
    <SettingsContext.Provider value={{
      streamUrl,
      tmdbApiKey,
      streamProvider,
      streamDisclaimerAccepted,
      iptvPlaylists,
      iptvChannels,
      iptvFavorites,
      iptvRecentChannels,
      setStreamUrl,
      setTmdbApiKey,
      setStreamProvider,
      acceptStreamDisclaimer,
      addIptvPlaylist,
      removeIptvPlaylist,
      addIptvChannel,
      removeIptvChannel,
      toggleIptvFavorite,
      recordIptvRecent,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
