export interface StreamProvider {
  id: string;
  name: string;
  baseUrl: string;
  constructUrl: (params: {
    type: 'movie' | 'tv';
    id: string;
    season?: string;
    episode?: string;
  }) => string;
}

/**
 * Catalog service provider.
 *
 * Ships with no service name or domain: the user supplies the domain in
 * Settings and activates a session against it. `baseUrl` stays empty so
 * nothing service-specific is bundled; the player resolves the origin from
 * settings at runtime.
 */
export const CATALOG_PROVIDER_ID = 'catalog';

export const STREAM_PROVIDERS: StreamProvider[] = [
  {
    id: CATALOG_PROVIDER_ID,
    name: 'Catalog Service',
    baseUrl: '',
    constructUrl: () => '',
  },
  {
    id: 'videasy',
    name: 'Videasy',
    baseUrl: 'https://player.videasy.net',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://player.videasy.net/movie/${id}`;
      }
      return `https://player.videasy.net/tv/${id}/${season}/${episode}`;
    },
  },
  {
    id: 'vidy',
    name: 'Vidy',
    baseUrl: 'https://www.vidy.st',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://www.vidy.st/movie/${id}`;
      }
      return `https://www.vidy.st/tv/${id}/${season}/${episode}`;
    },
  },
  {
    id: 'vidnest',
    name: 'VidNest',
    baseUrl: 'https://vidnest.fun',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://vidnest.fun/movie/${id}`;
      }
      return `https://vidnest.fun/tv/${id}/${season}/${episode}`;
    },
  },
  {
    id: '2embed',
    name: '2Embed',
    baseUrl: 'https://www.2embed.stream',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://www.2embed.stream/embed/movie/${id}`;
      }
      return `https://www.2embed.stream/embed/tv/${id}/${season}/${episode}`;
    },
  },
  {
    id: 'vidlink',
    name: 'VidLink',
    baseUrl: 'https://vidlink.pro',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://vidlink.pro/movie/${id}`;
      }
      return `https://vidlink.pro/tv/${id}/${season}/${episode}`;
    },
  },
  {
    id: 'vidsrc-to',
    name: 'VidSrc.to',
    baseUrl: 'https://vidsrc.to',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://vidsrc.to/embed/movie/${id}`;
      }
      return `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
    },
  },
  {
    id: 'custom',
    name: 'Custom URL',
    baseUrl: '',
    constructUrl: () => '',
  },
];

export const getStreamProvider = (id: string): StreamProvider | undefined => {
  return STREAM_PROVIDERS.find((provider) => provider.id === id);
};

export const getProviderHostname = (baseUrl: string): string => {
  if (!baseUrl) return '';
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return baseUrl;
  }
};
