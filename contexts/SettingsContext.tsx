import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface SettingsContextType {
  streamUrl: string;
  tmdbApiKey: string;
  streamProvider: string;
  setStreamUrl: (url: string) => Promise<void>;
  setTmdbApiKey: (key: string) => Promise<void>;
  setStreamProvider: (provider: string) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEYS = {
  STREAM_URL: '@stream_url',
  TMDB_API_KEY: '@tmdb_api_key',
  STREAM_PROVIDER: '@stream_provider',
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [streamUrl, setStreamUrlState] = useState('https://player.videasy.net');
  const [tmdbApiKey, setTmdbApiKeyState] = useState('');
  const [streamProvider, setStreamProviderState] = useState('videasy');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      console.log('Loading settings from AsyncStorage...');
      const savedStreamUrl = await AsyncStorage.getItem(STORAGE_KEYS.STREAM_URL);
      const savedApiKey = await AsyncStorage.getItem(STORAGE_KEYS.TMDB_API_KEY);
      const savedProvider = await AsyncStorage.getItem(STORAGE_KEYS.STREAM_PROVIDER);
      
      console.log('Loaded stream URL:', savedStreamUrl);
      console.log('Loaded API key:', savedApiKey ? savedApiKey.substring(0, 8) + '...' : 'none');
      console.log('Loaded provider:', savedProvider);
      
      if (savedStreamUrl) setStreamUrlState(savedStreamUrl);
      if (savedApiKey) setTmdbApiKeyState(savedApiKey);
      if (savedProvider) setStreamProviderState(savedProvider);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const setStreamUrl = async (url: string) => {
    try {
      console.log('Saving stream URL:', url);
      await AsyncStorage.setItem(STORAGE_KEYS.STREAM_URL, url);
      setStreamUrlState(url);
      console.log('Stream URL saved successfully');
    } catch (error) {
      console.error('Error saving stream URL:', error);
    }
  };

  const setTmdbApiKey = async (key: string) => {
    try {
      console.log('Saving TMDB API key:', key.substring(0, 8) + '...');
      await AsyncStorage.setItem(STORAGE_KEYS.TMDB_API_KEY, key);
      setTmdbApiKeyState(key);
      console.log('TMDB API key saved successfully');
    } catch (error) {
      console.error('Error saving TMDB API key:', error);
    }
  };

  const setStreamProvider = async (provider: string) => {
    try {
      console.log('Saving stream provider:', provider);
      await AsyncStorage.setItem(STORAGE_KEYS.STREAM_PROVIDER, provider);
      setStreamProviderState(provider);
      console.log('Stream provider saved successfully');
    } catch (error) {
      console.error('Error saving stream provider:', error);
    }
  };

  return (
    <SettingsContext.Provider value={{ streamUrl, tmdbApiKey, streamProvider, setStreamUrl, setTmdbApiKey, setStreamProvider }}>
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
