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

export const STREAM_PROVIDERS: StreamProvider[] = [
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
    id: 'vidsrc',
    name: 'VidSrc',
    baseUrl: 'https://vidsrc-embed.ru',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://vidsrc-embed.ru/embed/movie?tmdb=${id}`;
      }
      return `https://vidsrc-embed.ru/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`;
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
    id: 'vidplus',
    name: 'VidPlus',
    baseUrl: 'https://player.vidplus.to',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://player.vidplus.to/embed/movie/${id}`;
      }
      return `https://player.vidplus.to/embed/tv/${id}/${season}/${episode}`;
    },
  },
  {
    id: 'rivestream',
    name: 'RiveStream',
    baseUrl: 'https://rivestream.net',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://rivestream.net/embed?type=movie&id=${id}`;
      }
      return `https://rivestream.net/embed?type=tv&id=${id}&season=${season}&episode=${episode}`;
    },
  },
  {
    id: 'rivestream-torrent',
    name: 'RiveStream (Torrent)',
    baseUrl: 'https://rivestream.net',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://rivestream.net/embed/torrent?type=movie&id=${id}`;
      }
      return `https://rivestream.net/embed/torrent?type=tv&id=${id}&season=${season}&episode=${episode}`;
    },
  },
  {
    id: 'rivestream-agg',
    name: 'RiveStream (Aggregator)',
    baseUrl: 'https://rivestream.net',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://rivestream.net/embed/agg?type=movie&id=${id}`;
      }
      return `https://rivestream.net/embed/agg?type=tv&id=${id}&season=${season}&episode=${episode}`;
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
    id: 'vidsrc-sbs',
    name: 'VidSrc.sbs',
    baseUrl: 'https://vidsrc.sbs',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://vidsrc.sbs/embed/movie/${id}`;
      }
      return `https://vidsrc.sbs/embed/tv/${id}/${season}/${episode}`;
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
