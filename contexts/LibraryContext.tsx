import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CONTINUE_WATCHING_LIMIT,
  ContinueWatchingItem,
  isContinueWatchingItem,
  isWatchlistItem,
  LibraryMediaType,
  WATCHLIST_LIMIT,
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
};

type LibraryContextType = {
  watchlist: WatchlistItem[];
  continueWatching: ContinueWatchingItem[];
  isInWatchlist: (id: number, type: LibraryMediaType) => boolean;
  getContinueItem: (id: number, type: LibraryMediaType) => ContinueWatchingItem | undefined;
  toggleWatchlist: (input: LibraryTitleInput) => Promise<void>;
  recordContinueWatching: (input: RecordProgressInput) => Promise<void>;
  removeContinueWatching: (id: number, type: LibraryMediaType) => Promise<void>;
};

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

const STORAGE_KEYS = {
  WATCHLIST: '@library_watchlist',
  CONTINUE: '@library_continue_watching',
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

export const LibraryProvider = ({ children }: { children: ReactNode }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [savedWatchlist, savedContinue] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.WATCHLIST),
          AsyncStorage.getItem(STORAGE_KEYS.CONTINUE),
        ]);
        setWatchlist(parseStoredArray(savedWatchlist, isWatchlistItem));
        setContinueWatching(parseStoredArray(savedContinue, isContinueWatchingItem));
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

  const recordContinueWatching = useCallback(async (input: RecordProgressInput) => {
    setContinueWatching((prev) => {
      const nextItem: ContinueWatchingItem = {
        id: input.id,
        type: input.type,
        title: input.title,
        posterPath: input.posterPath,
        backdropPath: input.backdropPath,
        season: input.type === 'tv' ? input.season : undefined,
        episode: input.type === 'tv' ? input.episode : undefined,
        updatedAt: Date.now(),
      };
      const next = [
        nextItem,
        ...prev.filter((item) => !(item.id === input.id && item.type === input.type)),
      ].slice(0, CONTINUE_WATCHING_LIMIT);

      void AsyncStorage.setItem(STORAGE_KEYS.CONTINUE, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeContinueWatching = useCallback(async (id: number, type: LibraryMediaType) => {
    setContinueWatching((prev) => {
      const next = prev.filter((item) => !(item.id === id && item.type === type));
      void AsyncStorage.setItem(STORAGE_KEYS.CONTINUE, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      watchlist,
      continueWatching,
      isInWatchlist,
      getContinueItem,
      toggleWatchlist,
      recordContinueWatching,
      removeContinueWatching,
    }),
    [
      watchlist,
      continueWatching,
      isInWatchlist,
      getContinueItem,
      toggleWatchlist,
      recordContinueWatching,
      removeContinueWatching,
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
