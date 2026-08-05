export interface StreamProvider {
  id: string;
  name: string;
  displayName: string; // Funny name for non-admin users
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
    displayName: 'Meow',
    baseUrl: 'https://player.videasy.net',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://player.videasy.net/movie/${id}`;
      } else {
        return `https://player.videasy.net/tv/${id}/${season}/${episode}`;
      }
    },
  },
  {
    id: 'vidsrc',
    name: 'VidSrc',
    displayName: 'Penguin',
    baseUrl: 'https://vidsrc-embed.ru',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://vidsrc-embed.ru/embed/movie?tmdb=${id}`;
      } else {
        return `https://vidsrc-embed.ru/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`;
      }
    },
  },
  {
    id: 'vidnest',
    name: 'VidNest',
    displayName: 'Dolphin',
    baseUrl: 'https://vidnest.fun',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://vidnest.fun/movie/${id}`;
      } else {
        return `https://vidnest.fun/tv/${id}/${season}/${episode}`;
      }
    },
  },
  {
    id: '2embed',
    name: '2Embed',
    displayName: 'Koala',
    baseUrl: 'https://www.2embed.stream',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://www.2embed.stream/embed/movie/${id}`;
      } else {
        return `https://www.2embed.stream/embed/tv/${id}/${season}/${episode}`;
      }
    },
  },
  {
    id: 'vidplus',
    name: 'VidPlus',
    displayName: 'Panda',
    baseUrl: 'https://player.vidplus.to',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://player.vidplus.to/embed/movie/${id}`;
      } else {
        return `https://player.vidplus.to/embed/tv/${id}/${season}/${episode}`;
      }
    },
  },
  {
    id: 'rivestream',
    name: 'RiveStream',
    displayName: 'Otter',
    baseUrl: 'https://rivestream.net',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://rivestream.net/embed?type=movie&id=${id}`;
      } else {
        return `https://rivestream.net/embed?type=tv&id=${id}&season=${season}&episode=${episode}`;
      }
    },
  },
  {
    id: 'rivestream-torrent',
    name: 'RiveStream (Torrent)',
    displayName: 'Raccoon',
    baseUrl: 'https://rivestream.net',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://rivestream.net/embed/torrent?type=movie&id=${id}`;
      } else {
        return `https://rivestream.net/embed/torrent?type=tv&id=${id}&season=${season}&episode=${episode}`;
      }
    },
  },
  {
    id: 'rivestream-agg',
    name: 'RiveStream (Aggregator)',
    displayName: 'Squirrel',
    baseUrl: 'https://rivestream.net',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://rivestream.net/embed/agg?type=movie&id=${id}`;
      } else {
        return `https://rivestream.net/embed/agg?type=tv&id=${id}&season=${season}&episode=${episode}`;
      }
    },
  },
  {
    id: 'vidlink',
    name: 'VidLink',
    displayName: 'Fox',
    baseUrl: 'https://vidlink.pro',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://vidlink.pro/movie/${id}`;
      } else {
        return `https://vidlink.pro/tv/${id}/${season}/${episode}`;
      }
    },
  },
  {
    id: 'vidsrc-to',
    name: 'VidSrc.to',
    displayName: 'Owl',
    baseUrl: 'https://vidsrc.to',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://vidsrc.to/embed/movie/${id}`;
      } else {
        return `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
      }
    },
  },
  {
    id: 'vidsrc-sbs',
    name: 'VidSrc.sbs',
    displayName: 'Tiger',
    baseUrl: 'https://vidsrc.sbs',
    constructUrl: ({ type, id, season, episode }) => {
      if (type === 'movie') {
        return `https://vidsrc.sbs/embed/movie/${id}`;
      } else {
        return `https://vidsrc.sbs/embed/tv/${id}/${season}/${episode}`;
      }
    },
  },
  {
    id: 'custom',
    name: 'Custom URL',
    displayName: 'Custom',
    baseUrl: '',
    constructUrl: ({ type, id, season, episode }) => {
      // Custom URL will be handled separately
      return '';
    },
  },
];

export const getStreamProvider = (id: string): StreamProvider | undefined => {
  return STREAM_PROVIDERS.find(provider => provider.id === id);
};
