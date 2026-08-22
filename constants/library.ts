import { Movie } from '@/hooks/useTMDB';

export const WATCHLIST_LIMIT = 200;
export const CONTINUE_WATCHING_LIMIT = 20;

export type LibraryMediaType = 'movie' | 'tv';

export type WatchlistItem = {
  id: number;
  type: LibraryMediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  addedAt: number;
};

export type ContinueWatchingItem = {
  id: number;
  type: LibraryMediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  season?: number;
  episode?: number;
  updatedAt: number;
};

export const libraryItemKey = (id: number, type: LibraryMediaType) => `${type}:${id}`;

export const isWatchlistItem = (value: unknown): value is WatchlistItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<WatchlistItem>;
  return (
    typeof item.id === 'number' &&
    (item.type === 'movie' || item.type === 'tv') &&
    typeof item.title === 'string' &&
    (item.posterPath === null || typeof item.posterPath === 'string') &&
    (item.backdropPath === null || typeof item.backdropPath === 'string') &&
    typeof item.addedAt === 'number'
  );
};

export const isContinueWatchingItem = (value: unknown): value is ContinueWatchingItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ContinueWatchingItem>;
  return (
    typeof item.id === 'number' &&
    (item.type === 'movie' || item.type === 'tv') &&
    typeof item.title === 'string' &&
    (item.posterPath === null || typeof item.posterPath === 'string') &&
    (item.backdropPath === null || typeof item.backdropPath === 'string') &&
    typeof item.updatedAt === 'number' &&
    (item.season === undefined || typeof item.season === 'number') &&
    (item.episode === undefined || typeof item.episode === 'number')
  );
};

export const toMovieFromLibrary = (
  item: WatchlistItem | ContinueWatchingItem
): Movie => ({
  id: item.id,
  title: item.type === 'movie' ? item.title : undefined,
  name: item.type === 'tv' ? item.title : undefined,
  poster_path: item.posterPath,
  backdrop_path: item.backdropPath,
  overview: '',
  vote_average: 0,
  media_type: item.type,
});

export const continueWatchingCaption = (item: ContinueWatchingItem): string | undefined => {
  if (item.type === 'tv' && item.season != null && item.episode != null) {
    return `S${item.season} · E${item.episode}`;
  }
  return undefined;
};
