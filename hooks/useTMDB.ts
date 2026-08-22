import { useSettings } from '@/contexts/SettingsContext';
import axios from 'axios';
import { useCallback } from 'react';

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

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string;
  place_of_birth: string;
  profile_path: string | null;
  known_for_department: string;
  also_known_as: string[];
  gender: number;
  popularity?: number;
}

export interface PersonCredit {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  character?: string;
  job?: string;
  media_type: 'movie' | 'tv';
}

const isBearerToken = (key: string): boolean =>
  key.startsWith('eyJ') || key.length > 100;

const getAxiosConfig = (tmdbApiKey: string, params?: Record<string, unknown>) => {
  if (isBearerToken(tmdbApiKey)) {
    return {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${tmdbApiKey}`,
      },
      params,
    };
  }

  return {
    params: { ...params, api_key: tmdbApiKey },
  };
};

export const useTMDB = () => {
  const { tmdbApiKey } = useSettings();

  const fetchTrending = useCallback(async (): Promise<Movie[]> => {
    if (!tmdbApiKey) return [];
    try {
      const response = await axios.get(
        `${TMDB_BASE_URL}/trending/all/week`,
        getAxiosConfig(tmdbApiKey)
      );
      return response.data.results || [];
    } catch {
      return [];
    }
  }, [tmdbApiKey]);

  const fetchPopular = useCallback(
    async (type: 'movie' | 'tv' = 'movie', providerId?: number): Promise<Movie[]> => {
      if (!tmdbApiKey) return [];
      try {
        let endpoint = `${TMDB_BASE_URL}/${type}/popular`;
        const params: Record<string, unknown> = {};

        if (providerId) {
          endpoint = `${TMDB_BASE_URL}/discover/${type}`;
          params.with_watch_providers = providerId;
          params.watch_region = 'IN';
          params.sort_by = 'popularity.desc';
          params.with_watch_monetization_types = 'flatrate|free|ads|rent|buy';
        }

        const response = await axios.get(endpoint, getAxiosConfig(tmdbApiKey, params));
        return response.data.results || [];
      } catch {
        return [];
      }
    },
    [tmdbApiKey]
  );

  const fetchTopRated = useCallback(
    async (type: 'movie' | 'tv' = 'movie'): Promise<Movie[]> => {
      if (!tmdbApiKey) return [];
      try {
        const response = await axios.get(
          `${TMDB_BASE_URL}/${type}/top_rated`,
          getAxiosConfig(tmdbApiKey)
        );
        return response.data.results || [];
      } catch {
        return [];
      }
    },
    [tmdbApiKey]
  );

  const fetchUpcoming = useCallback(async (): Promise<Movie[]> => {
    if (!tmdbApiKey) return [];
    try {
      const response = await axios.get(
        `${TMDB_BASE_URL}/movie/upcoming`,
        getAxiosConfig(tmdbApiKey)
      );
      return response.data.results || [];
    } catch {
      return [];
    }
  }, [tmdbApiKey]);

  const searchContent = useCallback(
    async (query: string): Promise<Movie[]> => {
      if (!tmdbApiKey) return [];
      try {
        const response = await axios.get(
          `${TMDB_BASE_URL}/search/multi`,
          getAxiosConfig(tmdbApiKey, { query })
        );
        return (response.data.results || []).filter(
          (item: Movie) => item.media_type === 'movie' || item.media_type === 'tv'
        );
      } catch {
        return [];
      }
    },
    [tmdbApiKey]
  );

  const fetchDetails = useCallback(
    async (id: number, type: 'movie' | 'tv'): Promise<Movie | null> => {
      if (!tmdbApiKey) return null;
      try {
        const response = await axios.get(
          `${TMDB_BASE_URL}/${type}/${id}`,
          getAxiosConfig(tmdbApiKey)
        );
        return response.data;
      } catch {
        return null;
      }
    },
    [tmdbApiKey]
  );

  const fetchCredits = useCallback(
    async (id: number, type: 'movie' | 'tv'): Promise<CastMember[]> => {
      if (!tmdbApiKey) return [];
      try {
        const response = await axios.get(
          `${TMDB_BASE_URL}/${type}/${id}/credits`,
          getAxiosConfig(tmdbApiKey)
        );
        return response.data.cast || [];
      } catch {
        return [];
      }
    },
    [tmdbApiKey]
  );

  const fetchRecommendations = useCallback(
    async (id: number, type: 'movie' | 'tv'): Promise<Movie[]> => {
      if (!tmdbApiKey) return [];
      try {
        const response = await axios.get(
          `${TMDB_BASE_URL}/${type}/${id}/recommendations`,
          getAxiosConfig(tmdbApiKey)
        );
        return response.data.results || [];
      } catch {
        return [];
      }
    },
    [tmdbApiKey]
  );

  const fetchPersonDetails = useCallback(
    async (id: number): Promise<PersonDetails | null> => {
      if (!tmdbApiKey) return null;
      try {
        const response = await axios.get(
          `${TMDB_BASE_URL}/person/${id}`,
          getAxiosConfig(tmdbApiKey)
        );
        return response.data;
      } catch {
        return null;
      }
    },
    [tmdbApiKey]
  );

  const fetchPersonCredits = useCallback(
    async (id: number): Promise<PersonCredit[]> => {
      if (!tmdbApiKey) return [];
      try {
        const response = await axios.get(
          `${TMDB_BASE_URL}/person/${id}/combined_credits`,
          getAxiosConfig(tmdbApiKey)
        );
        return (response.data.cast || []).slice(0, 20);
      } catch {
        return [];
      }
    },
    [tmdbApiKey]
  );

  const fetchSeasonDetails = useCallback(
    async (tvId: number, seasonNumber: number): Promise<Episode[]> => {
      if (!tmdbApiKey) return [];
      try {
        const response = await axios.get(
          `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}`,
          getAxiosConfig(tmdbApiKey)
        );
        return response.data.episodes || [];
      } catch {
        return [];
      }
    },
    [tmdbApiKey]
  );

  return {
    tmdbApiKey,
    fetchTrending,
    fetchPopular,
    fetchTopRated,
    fetchUpcoming,
    searchContent,
    fetchDetails,
    fetchCredits,
    fetchRecommendations,
    fetchPersonDetails,
    fetchPersonCredits,
    fetchSeasonDetails,
  };
};
