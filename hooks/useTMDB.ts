import { useSettings } from '@/contexts/SettingsContext';
import axios from 'axios';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export interface Movie {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: 'movie' | 'tv';
  number_of_seasons?: number;
  seasons?: Season[];
}

export interface Season {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  overview: string;
  poster_path: string | null;
  air_date: string;
}

export interface Episode {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
  overview: string;
  still_path: string | null;
  air_date: string;
  runtime: number;
}

// Helper to determine if the key is a Bearer token or API key
const isBearerToken = (key: string): boolean => {
  const isBearer = key.startsWith('eyJ') || key.length > 100;
  console.log('Auth type check:', isBearer ? 'Bearer Token' : 'API Key', '(length:', key.length + ')');
  return isBearer;
};

// Helper to create axios config with proper auth
const getAxiosConfig = (tmdbApiKey: string, params?: any) => {
  if (isBearerToken(tmdbApiKey)) {
    // Use Bearer token in header
    console.log('Using Bearer token authentication');
    return {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${tmdbApiKey}`,
      },
      params,
    };
  } else {
    // Use API key in query params
    console.log('Using API key authentication');
    return {
      params: { ...params, api_key: tmdbApiKey },
    };
  }
};

export const useTMDB = () => {
  const { tmdbApiKey } = useSettings();

  const fetchTrending = async (): Promise<Movie[]> => {
    if (!tmdbApiKey) {
      console.log('No API key set');
      return [];
    }
    try {
      console.log('=== FETCHING TRENDING ===');
      console.log('API Key/Token length:', tmdbApiKey.length);
      console.log('First 20 chars:', tmdbApiKey.substring(0, 20));
      
      const config = getAxiosConfig(tmdbApiKey);
      console.log('Request config:', JSON.stringify(config, null, 2));
      
      const url = `${TMDB_BASE_URL}/trending/all/week`;
      console.log('Request URL:', url);
      
      const response = await axios.get(url, config);
      console.log('✅ Success! Trending results:', response.data.results.length);
      return response.data.results;
    } catch (error: any) {
      console.error('❌ Error fetching trending:');
      console.error('Status:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      console.error('Error data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Error message:', error.message);
      return [];
    }
  };

  const fetchPopular = async (type: 'movie' | 'tv' = 'movie', providerId?: number): Promise<Movie[]> => {
    if (!tmdbApiKey) {
      console.log('No API key set');
      return [];
    }
    try {
      console.log(`Fetching popular ${type}${providerId ? ` for provider ${providerId}` : ''}...`);
      
      let endpoint = `${TMDB_BASE_URL}/${type}/popular`;
      const params: any = {};
      
      // If provider is specified, use discover endpoint instead
      if (providerId) {
        endpoint = `${TMDB_BASE_URL}/discover/${type}`;
        params.with_watch_providers = providerId;
        params.watch_region = 'IN'; // Changed to India for Indian streaming providers
        params.sort_by = 'popularity.desc';
        // Include all monetization types to get more results
        params.with_watch_monetization_types = 'flatrate|free|ads|rent|buy';
      }
      
      const config = getAxiosConfig(tmdbApiKey, params);
      const response = await axios.get(endpoint, config);
      console.log(`Popular ${type} results:`, response.data.results.length);
      return response.data.results;
    } catch (error: any) {
      console.error(`Error fetching popular ${type}:`, error.response?.data || error.message);
      return [];
    }
  };

  const searchContent = async (query: string): Promise<Movie[]> => {
    if (!tmdbApiKey) {
      console.log('No API key set');
      return [];
    }
    try {
      console.log('Searching for:', query);
      const config = getAxiosConfig(tmdbApiKey, { query });
      const response = await axios.get(`${TMDB_BASE_URL}/search/multi`, config);
      const filtered = response.data.results.filter((item: Movie) => 
        item.media_type === 'movie' || item.media_type === 'tv'
      );
      console.log('Search results:', filtered.length);
      return filtered;
    } catch (error: any) {
      console.error('Error searching:', error.response?.data || error.message);
      return [];
    }
  };

  const fetchDetails = async (id: number, type: 'movie' | 'tv'): Promise<Movie | null> => {
    if (!tmdbApiKey) {
      console.log('No API key set');
      return null;
    }
    try {
      console.log(`Fetching details for ${type} ${id}...`);
      const config = getAxiosConfig(tmdbApiKey);
      const response = await axios.get(`${TMDB_BASE_URL}/${type}/${id}`, config);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching details:', error.response?.data || error.message);
      return null;
    }
  };

  const fetchSeasonDetails = async (tvId: number, seasonNumber: number): Promise<Episode[]> => {
    if (!tmdbApiKey) {
      console.log('No API key set');
      return [];
    }
    try {
      console.log(`Fetching season ${seasonNumber} for TV show ${tvId}...`);
      const config = getAxiosConfig(tmdbApiKey);
      const response = await axios.get(
        `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}`,
        config
      );
      return response.data.episodes || [];
    } catch (error: any) {
      console.error('Error fetching season details:', error.response?.data || error.message);
      return [];
    }
  };

  return { fetchTrending, fetchPopular, searchContent, fetchDetails, fetchSeasonDetails };
};
