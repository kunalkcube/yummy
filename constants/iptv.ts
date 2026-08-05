export interface IptvPlaylist {
  id: string;
  name: string;
  url: string;
  isBuiltIn?: boolean;
}

export interface IptvChannel {
  id: string;
  playlistId: string;
  name: string;
  streamUrl: string;
  group: string;
  logoUrl?: string;
  tvgId?: string;
  isCustom?: boolean;
}

export const IPTV_ORG_PLAYLIST: IptvPlaylist = {
  id: 'iptv-org-categories',
  name: 'IPTV-org Categories',
  url: 'https://iptv-org.github.io/iptv/index.category.m3u',
  isBuiltIn: true,
};

export const IPTV_RECENT_CHANNEL_LIMIT = 20;
