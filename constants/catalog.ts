/**
 * Generic OTT catalog client constants.
 *
 * Yummy ships **no** service domain. The user supplies one in Settings, and
 * every request — search, details, episodes, playlist, and the WebView origin
 * used for playback — is built from that value.
 *
 * Protocol shape (service-agnostic):
 *  1. Activation: GET {domain}/mobile/home?app=1 sets an "addhash" cookie used
 *     by the service's ad verification. Opening the ad URL in a browser and
 *     polling /mobile/verify2.php until "All Done" sets a session cookie
 *     (~12h) that unlocks details/episodes/playlist endpoints.
 *  2. Catalog: {domain}/search.php works unverified; {domain}/mobile/post.php,
 *     /mobile/episodes.php, and /mobile/playlist.php need the session cookie.
 *  3. Playback: resolved HLS lives on rotating CDNs that require a
 *     "Referer: {domain}/" header, so the player runs inside a WebView page
 *     loaded at the user's own origin.
 */

/** Session lifetime on the service, in milliseconds. */
export const CATALOG_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Storage key for the activated session (device-local only). */
export const CATALOG_STORAGE_KEYS = {
  SESSION_SET: '@catalog_session',
  DOMAIN: '@catalog_domain',
} as const;

/** API home path (used by the activation screen). */
export const CATALOG_HOME_PATH = '/mobile/home?app=1';

/** Endpoint that reports whether a session can read protected endpoints. */
export const CATALOG_STATUS_PATH = '/mobile/post.php';

/**
 * Headers used by the catalog client. Services behind this protocol expect a
 * mobile WebView user agent, so the string is kept verbatim.
 *
 * The `/OS.Gatu v3.0` suffix identifies the client this protocol was
 * reverse-engineered from. It is the one service-specific fingerprint left in
 * the app. If you want it gone, delete that suffix and re-test against your
 * domain — some deployments reject requests without it, so verify before
 * shipping the change.
 */
export const CATALOG_HEADERS: Record<string, string> = {
  'X-Requested-With': '',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 13; M2101K7AI) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 /OS.Gatu v3.0',
};

/**
 * Subdomain used for the ad-verification host during activation.
 *
 * The service observed during development served its ad page on a sibling
 * subdomain of the catalog host. This is derived rather than discovered, so
 * activation is the first thing to check if a different domain misbehaves.
 */
export const CATALOG_AD_SUBDOMAIN = 'userver';

/** Derive the ad-verification URL for a catalog domain. */
export const catalogAdHost = (domain: string): string => {
  try {
    const { hostname, protocol } = new URL(domain);
    return `${protocol}//${CATALOG_AD_SUBDOMAIN}.${hostname}`;
  } catch {
    return '';
  }
};

/**
 * Normalize user input into an `https://host` origin.
 * Accepts `example.com`, `https://example.com`, or a URL with a path.
 * Returns null when the value is not a usable public HTTPS origin.
 */
export const normalizeCatalogDomain = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'https:') return null;
    if (!parsed.hostname.includes('.')) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
};

export interface CatalogSearchItem {
  id: string;
  title: string;
}

export interface CatalogSearchHit extends CatalogSearchItem {
  ott: CatalogOtt;
  /** From the PV/HS search "r" field ("Series" or a runtime like "2h 17m"). */
  kindHint: 'm' | 't' | null;
  year: string | null;
}

export interface CatalogLanguage {
  l: string;
  s: string;
}

export interface CatalogSeason {
  s: string;
  id: string;
  ep: string;
}

export interface CatalogEpisode {
  id: string;
  title: string;
  season: string;
  episode: string;
  time: string;
}

export interface CatalogDetails {
  title: string | null;
  year: string | null;
  type: 'm' | 't' | null;
  desc: string | null;
  genre: string | null;
  runtime: string | null;
  d_lang: string | null;
  /** Comma-separated top-billed cast, used to verify a title match. */
  cast: string | null;
  /** Movie director(s); empty for most series. */
  director: string | null;
  /** Series creator; empty for movies. */
  creator: string | null;
  lang: CatalogLanguage[];
  seasons: CatalogSeason[];
  episodes: CatalogEpisode[];
  hasEpisodes: boolean;
}

/**
 * Catalog namespaces. A single service can mirror several catalogs under
 * separate path prefixes, each with its own search/post/episodes/playlist
 * endpoints (e.g. /mobile/pv/post.php). `nf` is the default namespace served
 * at the root of /mobile.
 */
export type CatalogOtt = 'nf' | 'pv' | 'hs';

export const CATALOG_OTT_NAMESPACES: CatalogOtt[] = ['nf', 'pv', 'hs'];

/** URL path prefix for a namespace ("/mobile" for nf, "/mobile/pv" for pv, ...). */
export const catalogOttPath = (ott: CatalogOtt): string =>
  ott === 'nf' ? '/mobile' : `/mobile/${ott}`;

/** URL path prefix for a namespace's search endpoint. */
export const catalogSearchPath = (ott: CatalogOtt): string =>
  ott === 'nf' ? '/search.php' : `/mobile/${ott}/search.php`;

export interface CatalogStreamSource {
  file: string;
  label: string;
  type: string;
  default?: string;
}

export interface CatalogTrack {
  kind: string;
  file: string;
  label: string;
  language?: string;
}

export interface CatalogPlaylist {
  image2: string;
  sources: CatalogStreamSource[];
  tracks: CatalogTrack[];
}

export interface CatalogSubtitle {
  label: string;
  url: string;
  language?: string;
}

export interface CatalogResolvedStream {
  masterUrl: string;
  qualityLabel: string;
  subtitles: CatalogSubtitle[];
}
