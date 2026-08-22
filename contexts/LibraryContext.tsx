import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CONTINUE_WATCHING_LIMIT,
  ContinueWatchingItem,
  episodeKey,
  getNextEpisode,
  isContinueWatchingItem,
  isWatchHistoryItem,
  isWatchedEpisodesStore,
  isWatchlistItem,
  LibraryMediaType,
  SeasonEpisodeCount,
  WATCH_HISTORY_LIMIT,
  WATCHLIST_LIMIT,
  WatchHistoryItem,
  WatchedEpisodesStore,
  WatchlistItem,
} from '@/constants/library';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type LibraryTitleInput = {
  id: number;
  type: LibraryMediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
};

type RecordProgressInput = LibraryTitleInput & {
  season?: number;
  episode?: number;
  /** When true (default for TV plays from details), continue jumps to the next episode. */
  advance?: boolean;
  seasons?: SeasonEpisodeCount[];
};

type ToggleEpisodeInput = LibraryTitleInput & {
  season: number;
  episode: number;
  seasons?: SeasonEpisodeCount[];
};

type LibraryContextType = {
  watchlist: WatchlistItem[];
  continueWatching: ContinueWatchingItem[];
  watchHistory: WatchHistoryItem[];
  isInWatchlist: (id: number, type: LibraryMediaType) => boolean;
  getContinueItem: (id: number, type: LibraryMediaType) => ContinueWatchingItem | undefined;
  isEpisodeWatched: (tvId: number, season: number, episode: number) => boolean;
  getWatchedEpisodeKeys: (tvId: number) => ReadonlySet<string>;
  isMovieWatched: (id: number) => boolean;
  toggleWatchlist: (input: LibraryTitleInput) => Promise<void>;
  recordContinueWatching: (input: RecordProgressInput) => Promise<void>;
  removeContinueWatching: (id: number, type: LibraryMediaType) => Promise<void>;
  toggleEpisodeWatched: (input: ToggleEpisodeInput) => Promise<void>;
  toggleMovieWatched: (input: LibraryTitleInput) => Promise<void>;
  removeFromHistory: (id: number, type: LibraryMediaType) => Promise<void>;
  clearWatchHistory: () => Promise<void>;
};

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

const STORAGE_KEYS = {
  WATCHLIST: '@library_watchlist',
  CONTINUE: '@library_continue_watching',
  HISTORY: '@library_watch_history',
  WATCHED_EPISODES: '@library_watched_episodes',
  WATCHED_MOVIES: '@library_watched_movies',
};

const parseStoredArray = <T,>(
  rawValue: string | null,
  isValid: (value: unknown) => value is T
): T[] => {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter(isValid) : [];
  } catch {
    return [];
  }
};

const parseWatchedEpisodes = (rawValue: string | null): WatchedEpisodesStore => {
  if (!rawValue) return {};
  try {
    const parsed = JSON.parse(rawValue);
    return isWatchedEpisodesStore(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const parseWatchedMovies = (rawValue: string | null): number[] => {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
      : [];
  } catch {
    return [];
  }
};

const withEpisodeMarked = (
  store: WatchedEpisodesStore,
  tvId: number,
  season: number,
  episode: number,
  watched: boolean
): WatchedEpisodesStore => {
  const key = String(tvId);
  const episodeId = episodeKey(season, episode);
  const current = new Set(store[key] ?? []);
  if (watched) {
    current.add(episodeId);
  } else {
    current.delete(episodeId);
  }
  const next = { ...store };
  if (current.size === 0) {
    delete next[key];
  } else {
    next[key] = Array.from(current);
  }
  return next;
};

export const LibraryProvider = ({ children }: { children: ReactNode }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [watchedEpisodes, setWatchedEpisodes] = useState<WatchedEpisodesStore>({});
  const [watchedMovies, setWatchedMovies] = useState<number[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [savedWatchlist, savedContinue, savedHistory, savedWatched, savedMovies] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.WATCHLIST),
            AsyncStorage.getItem(STORAGE_KEYS.CONTINUE),
            AsyncStorage.getItem(STORAGE_KEYS.HISTORY),
            AsyncStorage.getItem(STORAGE_KEYS.WATCHED_EPISODES),
            AsyncStorage.getItem(STORAGE_KEYS.WATCHED_MOVIES),
          ]);
        setWatchlist(parseStoredArray(savedWatchlist, isWatchlistItem));
        setContinueWatching(parseStoredArray(savedContinue, isContinueWatchingItem));
        setWatchHistory(parseStoredArray(savedHistory, isWatchHistoryItem));
        setWatchedEpisodes(parseWatchedEpisodes(savedWatched));
        setWatchedMovies(parseWatchedMovies(savedMovies));
      } catch {
        // Keep empty defaults
      }
    })();
  }, []);

  const isInWatchlist = useCallback(
    (id: number, type: LibraryMediaType) =>
      watchlist.some((item) => item.id === id && item.type === type),
    [watchlist]
  );

  const getContinueItem = useCallback(
    (id: number, type: LibraryMediaType) =>
      continueWatching.find((item) => item.id === id && item.type === type),
    [continueWatching]
  );

  const isEpisodeWatched = useCallback(
    (tvId: number, season: number, episode: number) =>
      (watchedEpisodes[String(tvId)] ?? []).includes(episodeKey(season, episode)),
    [watchedEpisodes]
  );

  const getWatchedEpisodeKeys = useCallback(
    (tvId: number) => new Set(watchedEpisodes[String(tvId)] ?? []),
    [watchedEpisodes]
  );

  const isMovieWatched = useCallback(
    (id: number) => watchedMovies.includes(id),
    [watchedMovies]
  );

  const toggleWatchlist = useCallback(async (input: LibraryTitleInput) => {
    setWatchlist((prev) => {
      const exists = prev.some((item) => item.id === input.id && item.type === input.type);
      const next = exists
        ? prev.filter((item) => !(item.id === input.id && item.type === input.type))
        : [
            {
              id: input.id,
              type: input.type,
              title: input.title,
              posterPath: input.posterPath,
              backdropPath: input.backdropPath,
              addedAt: Date.now(),
            },
            ...prev,
          ].slice(0, WATCHLIST_LIMIT);

      void AsyncStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(next));
      return next;
    });
  }, []);

  const upsertHistory = useCallback((input: RecordProgressInput, watchedAt: number) => {
    setWatchHistory((prev) => {
      const nextItem: WatchHistoryItem = {
        id: input.id,
        type: input.type,
        title: input.title,
        posterPath: input.posterPath,
        backdropPath: input.backdropPath,
        season: input.type === 'tv' ? input.season : undefined,
        episode: input.type === 'tv' ? input.episode : undefined,
        watchedAt,
      };
      const next = [
        nextItem,
        ...prev.filter((item) => !(item.id === input.id && item.type === input.type)),
      ].slice(0, WATCH_HISTORY_LIMIT);

      void AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(next));
      return next;
    });
  }, []);

  const recordContinueWatching = useCallback(
    async (input: RecordProgressInput) => {
      const now = Date.now();
      const shouldAdvance = input.advance !== false && input.type === 'tv';
      const playedSeason = input.type === 'tv' ? input.season : undefined;
      const playedEpisode = input.type === 'tv' ? input.episode : undefined;

      let continueSeason = playedSeason;
      let continueEpisode = playedEpisode;

      if (
        shouldAdvance &&
        typeof playedSeason === 'number' &&
        typeof playedEpisode === 'number'
      ) {
        const nextEpisode = getNextEpisode(playedSeason, playedEpisode, input.seasons);
        if (nextEpisode) {
          continueSeason = nextEpisode.season;
          continueEpisode = nextEpisode.episode;
        }
      }

      upsertHistory(
        {
          ...input,
          season: playedSeason,
          episode: playedEpisode,
        },
        now
      );

      if (
        input.type === 'tv' &&
        typeof playedSeason === 'number' &&
        typeof playedEpisode === 'number'
      ) {
        setWatchedEpisodes((prev) => {
          const next = withEpisodeMarked(prev, input.id, playedSeason, playedEpisode, true);
          void AsyncStorage.setItem(STORAGE_KEYS.WATCHED_EPISODES, JSON.stringify(next));
          return next;
        });
      }

      if (input.type === 'movie') {
        setWatchedMovies((prev) => {
          if (prev.includes(input.id)) return prev;
          const next = [input.id, ...prev];
          void AsyncStorage.setItem(STORAGE_KEYS.WATCHED_MOVIES, JSON.stringify(next));
          return next;
        });

        // Watched movies belong in history, not continue watching
        setContinueWatching((prev) => {
          const next = prev.filter((item) => !(item.id === input.id && item.type === 'movie'));
          void AsyncStorage.setItem(STORAGE_KEYS.CONTINUE, JSON.stringify(next));
          return next;
        });
        return;
      }

      setContinueWatching((prev) => {
        const nextItem: ContinueWatchingItem = {
          id: input.id,
          type: input.type,
          title: input.title,
          posterPath: input.posterPath,
          backdropPath: input.backdropPath,
          season: continueSeason,
          episode: continueEpisode,
          updatedAt: now,
        };
        const next = [
          nextItem,
          ...prev.filter((item) => !(item.id === input.id && item.type === input.type)),
        ].slice(0, CONTINUE_WATCHING_LIMIT);

        void AsyncStorage.setItem(STORAGE_KEYS.CONTINUE, JSON.stringify(next));
        return next;
      });
    },
    [upsertHistory]
  );

  const removeContinueWatching = useCallback(async (id: number, type: LibraryMediaType) => {
    setContinueWatching((prev) => {
      const next = prev.filter((item) => !(item.id === id && item.type === type));
      void AsyncStorage.setItem(STORAGE_KEYS.CONTINUE, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleEpisodeWatched = useCallback(
    async (input: ToggleEpisodeInput) => {
      const key = episodeKey(input.season, input.episode);
      const currentlyWatched = (watchedEpisodes[String(input.id)] ?? []).includes(key);
      const nextWatched = !currentlyWatched;
      const now = Date.now();

      setWatchedEpisodes((prev) => {
        const next = withEpisodeMarked(prev, input.id, input.season, input.episode, nextWatched);
        void AsyncStorage.setItem(STORAGE_KEYS.WATCHED_EPISODES, JSON.stringify(next));
        return next;
      });

      if (!nextWatched) return;

      upsertHistory(
        {
          id: input.id,
          type: 'tv',
          title: input.title,
          posterPath: input.posterPath,
          backdropPath: input.backdropPath,
          season: input.season,
          episode: input.episode,
        },
        now
      );

      setContinueWatching((prev) => {
        const existing = prev.find((item) => item.id === input.id && item.type === 'tv');
        const shouldAdvance =
          !existing ||
          (existing.season === input.season && existing.episode === input.episode);

        if (!shouldAdvance) {
          return prev;
        }

        const nextEpisode = getNextEpisode(input.season, input.episode, input.seasons);
        const nextItem: ContinueWatchingItem = {
          id: input.id,
          type: 'tv',
          title: input.title,
          posterPath: input.posterPath,
          backdropPath: input.backdropPath,
          season: nextEpisode?.season ?? input.season,
          episode: nextEpisode?.episode ?? input.episode,
          updatedAt: now,
        };

        const next = [
          nextItem,
          ...prev.filter((item) => !(item.id === input.id && item.type === 'tv')),
        ].slice(0, CONTINUE_WATCHING_LIMIT);

        void AsyncStorage.setItem(STORAGE_KEYS.CONTINUE, JSON.stringify(next));
        return next;
      });
    },
    [upsertHistory, watchedEpisodes]
  );

  const toggleMovieWatched = useCallback(
    async (input: LibraryTitleInput) => {
      const currentlyWatched = watchedMovies.includes(input.id);
      const nextWatched = !currentlyWatched;
      const now = Date.now();

      setWatchedMovies((prev) => {
        const next = nextWatched
          ? [input.id, ...prev.filter((id) => id !== input.id)]
          : prev.filter((id) => id !== input.id);
        void AsyncStorage.setItem(STORAGE_KEYS.WATCHED_MOVIES, JSON.stringify(next));
        return next;
      });

      if (nextWatched) {
        upsertHistory(
          {
            id: input.id,
            type: 'movie',
            title: input.title,
            posterPath: input.posterPath,
            backdropPath: input.backdropPath,
          },
          now
        );

        setContinueWatching((prev) => {
          const next = prev.filter((item) => !(item.id === input.id && item.type === 'movie'));
          void AsyncStorage.setItem(STORAGE_KEYS.CONTINUE, JSON.stringify(next));
          return next;
        });
      }
    },
    [upsertHistory, watchedMovies]
  );

  const removeFromHistory = useCallback(async (id: number, type: LibraryMediaType) => {
    setWatchHistory((prev) => {
      const next = prev.filter((item) => !(item.id === id && item.type === type));
      void AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearWatchHistory = useCallback(async () => {
    setWatchHistory([]);
    void AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));
  }, []);

  const value = useMemo(
    () => ({
      watchlist,
      continueWatching,
      watchHistory,
      isInWatchlist,
      getContinueItem,
      isEpisodeWatched,
      getWatchedEpisodeKeys,
      isMovieWatched,
      toggleWatchlist,
      recordContinueWatching,
      removeContinueWatching,
      toggleEpisodeWatched,
      toggleMovieWatched,
      removeFromHistory,
      clearWatchHistory,
    }),
    [
      watchlist,
      continueWatching,
      watchHistory,
      isInWatchlist,
      getContinueItem,
      isEpisodeWatched,
      getWatchedEpisodeKeys,
      isMovieWatched,
      toggleWatchlist,
      recordContinueWatching,
      removeContinueWatching,
      toggleEpisodeWatched,
      toggleMovieWatched,
      removeFromHistory,
      clearWatchHistory,
    ]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within LibraryProvider');
  }
  return context;
};
