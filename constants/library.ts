import { Movie } from '@/hooks/useTMDB';

export const WATCHLIST_LIMIT = 200;
export const CONTINUE_WATCHING_LIMIT = 20;
export const WATCH_HISTORY_LIMIT = 100;

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

export type WatchHistoryItem = {
  id: number;
  type: LibraryMediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  season?: number;
  episode?: number;
  watchedAt: number;
};

/** Persist map: tvId string → ["season:episode", ...] */
export type WatchedEpisodesStore = Record<string, string[]>;

export type SeasonEpisodeCount = {
  season_number: number;
  episode_count: number;
};

export const libraryItemKey = (id: number, type: LibraryMediaType) => `${type}:${id}`;

export const episodeKey = (season: number, episode: number) => `${season}:${episode}`;

export const parseEpisodeKey = (
  key: string
): { season: number; episode: number } | null => {
  const [seasonRaw, episodeRaw] = key.split(':');
  const season = Number(seasonRaw);
  const episode = Number(episodeRaw);
  if (!Number.isFinite(season) || !Number.isFinite(episode)) return null;
  return { season, episode };
};

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

export const isWatchHistoryItem = (value: unknown): value is WatchHistoryItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<WatchHistoryItem>;
  return (
    typeof item.id === 'number' &&
    (item.type === 'movie' || item.type === 'tv') &&
    typeof item.title === 'string' &&
    (item.posterPath === null || typeof item.posterPath === 'string') &&
    (item.backdropPath === null || typeof item.backdropPath === 'string') &&
    typeof item.watchedAt === 'number' &&
    (item.season === undefined || typeof item.season === 'number') &&
    (item.episode === undefined || typeof item.episode === 'number')
  );
};

export const isWatchedEpisodesStore = (value: unknown): value is WatchedEpisodesStore => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value as Record<string, unknown>).every(([tvId, keys]) => {
    if (!/^\d+$/.test(tvId) || !Array.isArray(keys)) return false;
    return keys.every((key) => typeof key === 'string' && parseEpisodeKey(key) != null);
  });
};

export const toMovieFromLibrary = (
  item: WatchlistItem | ContinueWatchingItem | WatchHistoryItem
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
    return `Up next · S${item.season} · E${item.episode}`;
  }
  return undefined;
};

export const historyCaption = (item: WatchHistoryItem): string | undefined => {
  if (item.type === 'tv' && item.season != null && item.episode != null) {
    return `S${item.season} · E${item.episode}`;
  }
  if (item.type === 'movie') return 'Movie';
  if (item.type === 'tv') return 'TV';
  return undefined;
};

/** Next episode after (season, episode), or null if the show is finished. */
export const getNextEpisode = (
  season: number,
  episode: number,
  seasons?: SeasonEpisodeCount[]
): { season: number; episode: number } | null => {
  if (!seasons || seasons.length === 0) {
    return { season, episode: episode + 1 };
  }

  const ordered = seasons
    .filter((entry) => entry.season_number > 0 && entry.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);

  const current = ordered.find((entry) => entry.season_number === season);
  if (current && episode < current.episode_count) {
    return { season, episode: episode + 1 };
  }

  const nextSeason = ordered.find((entry) => entry.season_number > season);
  if (nextSeason) {
    return { season: nextSeason.season_number, episode: 1 };
  }

  return null;
};

/** First unwatched episode walking seasons in order, or null if all watched / unknown. */
export const getFirstUnwatchedEpisode = (
  seasons: SeasonEpisodeCount[],
  watchedKeys: ReadonlySet<string>
): { season: number; episode: number } | null => {
  const ordered = seasons
    .filter((entry) => entry.season_number > 0 && entry.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);

  for (const entry of ordered) {
    for (let episode = 1; episode <= entry.episode_count; episode += 1) {
      if (!watchedKeys.has(episodeKey(entry.season_number, episode))) {
        return { season: entry.season_number, episode };
      }
    }
  }

  return null;
};

export const formatRelativeWatchedAt = (watchedAt: number, now = Date.now()): string => {
  const deltaMs = Math.max(0, now - watchedAt);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};
