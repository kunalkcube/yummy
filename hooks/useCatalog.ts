import {
  CATALOG_HEADERS,
  CATALOG_STATUS_PATH,
  CATALOG_OTT_NAMESPACES,
  CATALOG_SESSION_TTL_MS,
  CatalogDetails,
  CatalogEpisode,
  CatalogOtt,
  CatalogPlaylist,
  CatalogResolvedStream,
  CatalogSearchHit,
  catalogAdHost,
  catalogOttPath,
  catalogSearchPath,
} from '@/constants/catalog';
import { CatalogSession, useSettings } from '@/contexts/SettingsContext';
import {
  CatalogMatchCriteria,
  evaluateCatalogMatch,
  rankCatalogHits,
} from '@/utils/catalogMatch';
import axios, { AxiosInstance } from 'axios';
import { useCallback } from 'react';

/**
 * Generic OTT catalog client for the user-supplied service domain.
 *
 * One origin drives everything: search, details, episodes, playlist, and the
 * WebView document origin that supplies the Referer the CDNs require.
 *
 * Services implementing this protocol mirror several catalogs under separate
 * path namespaces (nf = default, pv, hs). Search and playback resolution probe
 * all namespaces and pick the one that actually has the title, so the user
 * never selects a catalog.
 */

const VERIFY_POLL_INTERVAL_MS = 5_000;
const VERIFY_TIMEOUT_MS = 180_000;

const createClient = (baseUrl: string, cookie?: string): AxiosInstance => {
  const headers: Record<string, string> = { ...CATALOG_HEADERS };
  if (cookie) {
    headers.Cookie = cookie;
  }
  return axios.create({
    baseURL: baseUrl,
    headers,
    timeout: 15_000,
    validateStatus: () => true,
  });
};

const cookieHeaderValues = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof value === 'string') return [value];
  return [];
};

/** Read the session cookie from a Set-Cookie header, whatever its name. */
const readSessionCookie = (setCookieHeader: unknown): string | null => {
  for (const header of cookieHeaderValues(setCookieHeader)) {
    const match = header.match(/(?:^|[;,])\s*(t_hash_t=[^;,]+)/i);
    if (match) {
      return decodeURIComponent(match[1].replace(/^t_hash_t=/i, ''));
    }
  }
  return null;
};

const extractAddHash = (html: string): string | null => {
  const match = html.match(/data-addhash="([^"]+)"/);
  return match ? match[1] : null;
};

const searchOneNamespace = async (
  client: AxiosInstance,
  ott: CatalogOtt,
  query: string
): Promise<CatalogSearchHit[]> => {
  try {
    const response = await client.get(catalogSearchPath(ott), {
      params: { s: query },
    });

    // The default namespace's /search.php always returns real results;
    // namespace variants may answer type 1 = "Top Searches" when unverified.
    if (Number(response.data?.type) === 1) return [];

    const results = response.data?.searchResult;
    if (!Array.isArray(results)) return [];

    return results
      .filter(
        (item: unknown): item is { id: string | number; t: string; y?: string; r?: string } =>
          Boolean(item) &&
          (typeof (item as { id?: unknown }).id === 'string' ||
            typeof (item as { id?: unknown }).id === 'number') &&
          typeof (item as { t?: unknown }).t === 'string'
      )
      .map((item) => ({
        id: String(item.id),
        title: item.t,
        ott,
        kindHint:
          typeof item.r === 'string'
            ? item.r.toLowerCase().includes('series')
              ? 't'
              : 'm'
            : null,
        year: typeof item.y === 'string' ? item.y : null,
      }));
  } catch {
    return [];
  }
};

export interface CatalogPlaybackTarget {
  playbackId: string;
  ott: CatalogOtt;
  label: string;
  /**
   * `true` when the candidate agreed with the expected TMDB metadata, `false`
   * when it disagreed, `null` when there was nothing to compare.
   */
  verified: boolean | null;
}

type FetchEpisodesFn = (
  seasonId: string,
  seriesId: string,
  page?: number,
  ott?: CatalogOtt
) => Promise<{ episodes: CatalogEpisode[]; hasMore: boolean }>;

/**
 * Read one page of a season and pick the requested episode, retrying the next
 * page when the season is deeper than the first page returned.
 */
const findEpisodeEntry = async (
  fetchEpisodes: FetchEpisodesFn,
  seasonId: string,
  seriesId: string,
  episodeNumber: number,
  ott: CatalogOtt
): Promise<CatalogEpisode | null> => {
  const page = Math.max(1, Math.ceil(episodeNumber / 10));
  const firstPage = await fetchEpisodes(seasonId, seriesId, page, ott);
  let entry =
    firstPage.episodes.find((item) => item.episode === `E${episodeNumber}`) ??
    firstPage.episodes[episodeNumber - (page - 1) * 10 - 1];

  if (!entry && firstPage.hasMore) {
    const nextPage = await fetchEpisodes(seasonId, seriesId, page + 1, ott);
    entry =
      nextPage.episodes.find((item) => item.episode === `E${episodeNumber}`) ??
      nextPage.episodes[0];
  }

  return entry ?? null;
};

/**
 * Turn a kind-matched candidate into a play target: a movie plays from its own
 * id, a series needs the requested season + episode id resolved first.
 */
const resolveCandidateTarget = async (
  fetchEpisodes: FetchEpisodesFn,
  details: CatalogDetails,
  hit: CatalogSearchHit,
  seasonNumber: number,
  episodeNumber: number,
  verified: boolean | null
): Promise<CatalogPlaybackTarget | null> => {
  const label = details.title || hit.title;

  if (details.type === 'm') {
    return { playbackId: hit.id, ott: hit.ott, label, verified };
  }

  const season =
    details.seasons.find((entry) => Number(entry.s) === seasonNumber) ?? details.seasons[0];
  if (!season) return null;

  const episode = await findEpisodeEntry(
    fetchEpisodes,
    season.id,
    hit.id,
    episodeNumber,
    hit.ott
  );
  if (!episode) return null;

  return {
    playbackId: episode.id,
    ott: hit.ott,
    label: `${label} · S${seasonNumber} E${episodeNumber}`,
    verified,
  };
};

export const useCatalog = () => {
  const { catalogDomain, catalogSession, saveCatalogSession, clearCatalogSession } = useSettings();

  const isConfigured = Boolean(catalogDomain);

  const isSessionFresh = Boolean(
    catalogSession &&
      catalogDomain &&
      catalogSession.baseUrl === catalogDomain &&
      Date.now() - catalogSession.setAt < CATALOG_SESSION_TTL_MS
  );

  const sessionCookie =
    catalogSession && catalogSession.tHashT ? `t_hash_t=${catalogSession.tHashT}` : undefined;

  /** Search every catalog namespace (deduplicated by title + namespace). */
  const searchAll = useCallback(
    async (query: string): Promise<CatalogSearchHit[]> => {
      const trimmed = query.trim();
      if (!trimmed || !catalogDomain) return [];

      const client = createClient(catalogDomain, sessionCookie);
      const settled = await Promise.all(
        CATALOG_OTT_NAMESPACES.map((ott) => searchOneNamespace(client, ott, trimmed))
      );
      return settled.flat();
    },
    [catalogDomain, sessionCookie]
  );

  /** Search within one namespace (used for targeted retries). */
  const search = useCallback(
    async (query: string, ott?: CatalogOtt): Promise<CatalogSearchHit[]> => {
      const trimmed = query.trim();
      if (!trimmed || !catalogDomain) return [];

      const client = createClient(catalogDomain, sessionCookie);
      if (ott) {
        return searchOneNamespace(client, ott, trimmed);
      }
      return searchAll(trimmed);
    },
    [catalogDomain, searchAll, sessionCookie]
  );

  /** Fetch title details (includes seasons + first episode page). */
  const fetchDetails = useCallback(
    async (id: string, ott: CatalogOtt = 'nf'): Promise<CatalogDetails | null> => {
      if (!catalogSession || !catalogDomain) return null;

      const client = createClient(catalogDomain, sessionCookie);
      const response = await client.get(`${catalogOttPath(ott)}/post.php`, {
        params: { id },
      });
      const data = response.data;

      if (!data || data.status !== 'y' || !data.title) return null;

      const seasons = Array.isArray(data.season)
        ? data.season.filter(
            (season: unknown): season is { s: string; id: string; ep: string } =>
              Boolean(season) &&
              (typeof (season as { id?: unknown }).id === 'string' ||
                typeof (season as { id?: unknown }).id === 'number') &&
              typeof (season as { s?: unknown }).s === 'string'
          )
        : [];

      const episodes = Array.isArray(data.episodes)
        ? data.episodes
            .filter(
              (episode: unknown): episode is Record<string, string | number> =>
                Boolean(episode) &&
                (typeof (episode as { id?: unknown }).id === 'string' ||
                  typeof (episode as { id?: unknown }).id === 'number')
            )
            .map(
              (episode: Record<string, string | number>): CatalogEpisode => ({
                id: String(episode.id),
                title: String(episode.t ?? ''),
                season: String(episode.s ?? ''),
                episode: String(episode.ep ?? ''),
                time: String(episode.time ?? ''),
              })
            )
        : [];

      const lang = Array.isArray(data.lang)
        ? data.lang.filter(
            (entry: unknown): entry is { l: string; s: string } =>
              Boolean(entry) &&
              typeof (entry as { l?: unknown }).l === 'string' &&
              typeof (entry as { s?: unknown }).s === 'string'
          )
        : [];

      return {
        title: data.title ?? null,
        year: data.year ?? null,
        type: data.type ?? null,
        desc: data.desc ?? null,
        genre: data.genre ?? null,
        runtime: data.runtime ?? null,
        d_lang: data.d_lang ?? null,
        cast: data.cast ?? null,
        director: data.director ?? null,
        creator: data.creator ?? null,
        lang,
        seasons,
        episodes,
        hasEpisodes: data.type === 't',
      };
    },
    [catalogDomain, catalogSession, sessionCookie]
  );

  /** Fetch one page of episodes (10 per page) for a season id. */
  const fetchEpisodes = useCallback(
    async (
      seasonId: string,
      seriesId: string,
      page = 1,
      ott: CatalogOtt = 'nf'
    ): Promise<{ episodes: CatalogEpisode[]; hasMore: boolean }> => {
      if (!catalogSession || !catalogDomain) return { episodes: [], hasMore: false };

      const client = createClient(catalogDomain, sessionCookie);
      const response = await client.get(`${catalogOttPath(ott)}/episodes.php`, {
        params: { s: seasonId, series: seriesId, page },
      });
      const data = response.data;

      const episodes = Array.isArray(data?.episodes)
        ? data.episodes
            .filter(
              (episode: unknown): episode is Record<string, string | number> =>
                Boolean(episode) &&
                (typeof (episode as { id?: unknown }).id === 'string' ||
                  typeof (episode as { id?: unknown }).id === 'number')
            )
            .map(
              (episode: Record<string, string | number>): CatalogEpisode => ({
                id: String(episode.id),
                title: String(episode.t ?? ''),
                season: String(episode.s ?? ''),
                episode: String(episode.ep ?? ''),
                time: String(episode.time ?? ''),
              })
            )
        : [];

      return { episodes, hasMore: String(data?.nextPageShow ?? '0') === '1' };
    },
    [catalogDomain, catalogSession, sessionCookie]
  );

  /** Resolve playable HLS sources + subtitle tracks for a title/episode id. */
  const resolveStream = useCallback(
    async (id: string, ott: CatalogOtt = 'nf'): Promise<CatalogResolvedStream | null> => {
      if (!catalogSession || !catalogDomain) return null;

      const client = createClient(catalogDomain, sessionCookie);
      const response = await client.get(`${catalogOttPath(ott)}/playlist.php`, {
        params: { id },
      });
      const payload = Array.isArray(response.data)
        ? (response.data[0] as CatalogPlaylist)
        : null;

      const sources = payload?.sources?.filter(
        (source) => source && typeof source.file === 'string'
      );
      if (!sources || sources.length === 0) return null;

      const preferred =
        sources.find((source) => source.label.toLowerCase() === 'auto') ??
        sources.find((source) => source.default === 'true') ??
        sources.find((source) => source.label.toLowerCase().includes('mid')) ??
        sources[0];

      const masterUrl = new URL(preferred.file, `${catalogDomain}/`).toString();

      const subtitles = (payload?.tracks ?? [])
        .filter((track) => track.kind === 'captions' && typeof track.file === 'string')
        .map((track) => ({
          label: track.label || 'Subtitles',
          url: new URL(track.file, `${catalogDomain}/`).toString(),
          language: track.language,
        }));

      return {
        masterUrl,
        qualityLabel: preferred.label || 'Auto',
        subtitles,
      };
    },
    [catalogDomain, catalogSession, sessionCookie]
  );

  /**
   * Map a TMDB title to a catalog playback id by probing every namespace.
   *
   * Search matches on title text alone, so a hit is only a candidate. When
   * criteria (year / cast / director) are supplied, candidates are confirmed
   * against them first; the best-ranked candidate that at least matches the
   * requested kind is used when nothing confirms, so playback still works on
   * catalogs that expose little metadata.
   *
   * Episode ids are resolved only for candidates we are about to play, so a
   * confirmed match costs no more than before.
   */
  const resolvePlaybackTarget = useCallback(
    async (params: {
      title: string;
      type: string;
      season?: number;
      episode?: number;
      criteria?: CatalogMatchCriteria;
    }): Promise<CatalogPlaybackTarget | null> => {
      const hits = await searchAll(params.title);
      if (hits.length === 0) return null;

      const wantedKind = params.type === 'tv' ? 't' : 'm';
      const ranked = rankCatalogHits(hits, params.title, wantedKind, params.criteria);

      const seasonNumber = params.season ?? 1;
      const episodeNumber = params.episode ?? 1;

      type Candidate = { details: CatalogDetails; hit: CatalogSearchHit; verified: boolean | null };
      const unconfirmed: Candidate[] = [];

      for (const hit of ranked.slice(0, 4)) {
        try {
          const details = await fetchDetails(hit.id, hit.ott);
          if (!details || !details.type) continue;
          if (details.type !== wantedKind) continue;

          const { verified } = evaluateCatalogMatch(details, params.criteria);

          if (verified === true) {
            const target = await resolveCandidateTarget(
              fetchEpisodes,
              details,
              hit,
              seasonNumber,
              episodeNumber,
              true
            );
            if (target) return target;
            continue;
          }

          unconfirmed.push({ details, hit, verified });
        } catch {
          continue;
        }
      }

      // Nothing confirmed. Prefer candidates we could not check over ones we
      // checked and that disagreed — absence of evidence is the weaker signal.
      const ordered = [
        ...unconfirmed.filter((entry) => entry.verified === null),
        ...unconfirmed.filter((entry) => entry.verified === false),
      ];

      for (const entry of ordered) {
        try {
          const target = await resolveCandidateTarget(
            fetchEpisodes,
            entry.details,
            entry.hit,
            seasonNumber,
            episodeNumber,
            entry.verified
          );
          if (target) return target;
        } catch {
          continue;
        }
      }

      return null;
    },
    [fetchDetails, fetchEpisodes, searchAll]
  );

  /** Probe that the activated session can read protected endpoints. */
  const verifySession = useCallback(
    async (baseUrl: string): Promise<boolean> => {
      const client = createClient(baseUrl);
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          // id=1 is invalid, but a verified session still answers status "y"
          // (an unverified session returns status "n" / "Invalid User").
          const response = await client.get(CATALOG_STATUS_PATH, { params: { id: '1' } });
          if (response.data?.status === 'y') {
            return true;
          }
        } catch {
          // Retry below
        }
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      return false;
    },
    []
  );

  /** Step 1 of activation: get an addhash + the ad URL to open in a browser. */
  const startActivation = useCallback(async (): Promise<{
    baseUrl: string;
    addHash: string;
    adUrl: string;
  } | null> => {
    if (!catalogDomain) return null;

    const client = createClient(catalogDomain);
    const homeResponse = await client.get('/mobile/home', { params: { app: 1 } });
    const addHash = extractAddHash(String(homeResponse.data ?? ''));
    if (!addHash) return null;

    const adHost = catalogAdHost(catalogDomain);
    if (!adHost) return null;

    return {
      baseUrl: catalogDomain,
      addHash,
      adUrl: `${adHost}/?ffr455=${encodeURIComponent(addHash)}&a=y&t=${Date.now()}`,
    };
  }, [catalogDomain]);

  /**
   * Step 2 of activation: poll verify2.php until "All Done". The session cookie
   * is captured from the response when React Native exposes it; otherwise the
   * platform cookie jar keeps it and the WebView player uses it.
   */
  const pollActivation = useCallback(
    async (
      baseUrl: string,
      addHash: string,
      onStatus?: (status: string) => void
    ): Promise<CatalogSession | null> => {
      const client = createClient(baseUrl);
      const startedAt = Date.now();

      while (Date.now() - startedAt < VERIFY_TIMEOUT_MS) {
        try {
          const response = await client.post(
            '/mobile/verify2.php',
            `verify=${encodeURIComponent(addHash)}`,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
          );

          const status = String(response.data?.statusup ?? '');
          onStatus?.(status);

          if (status === 'All Done') {
            const headerValue = response.headers?.['set-cookie'];
            const tHashT = readSessionCookie(headerValue);

            // Give the cookie jar a moment to ingest the response cookie, then
            // confirm the session actually unlocks protected endpoints.
            await new Promise((resolve) => setTimeout(resolve, 1_000));
            const usable = tHashT ? true : await verifySession(baseUrl);
            if (!usable) {
              onStatus?.('Activation did not unlock the catalog. Please try again.');
              return null;
            }

            const session: CatalogSession = {
              tHashT: tHashT ?? '',
              baseUrl,
              setAt: Date.now(),
            };
            await saveCatalogSession(session);
            return session;
          }
        } catch {
          // Keep polling across transient network errors until timeout.
        }

        await new Promise((resolve) => setTimeout(resolve, VERIFY_POLL_INTERVAL_MS));
      }

      return null;
    },
    [saveCatalogSession, verifySession]
  );

  const deactivate = useCallback(async () => {
    await clearCatalogSession();
  }, [clearCatalogSession]);

  return {
    isConfigured,
    isActive: Boolean(catalogSession),
    isSessionFresh,
    session: catalogSession,
    search,
    searchAll,
    fetchDetails,
    fetchEpisodes,
    resolveStream,
    resolvePlaybackTarget,
    startActivation,
    pollActivation,
    deactivate,
  };
};
