import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export interface DownloadCaption {
  url: string;
  label: string;
  language?: string;
}

export interface DownloadSource {
  id: string;
  title: string;
  url: string;
  referer: string;
  captions: DownloadCaption[];
  posterUrl?: string;
  tmdbId?: number;
  mediaType?: 'movie' | 'tv';
  showTitle?: string;
  season?: number;
  episode?: number;
}

export interface DownloadTrack { id: number; label: string; language: string }
export interface DownloadOptions {
  token: string;
  durationMs: number;
  qualities: { id: number; label: string; height: number; audioIds: number[]; captionIds: number[] }[];
  audio: DownloadTrack[];
  captions: { id: string; label: string; language: string }[];
}

export interface OfflineDownload {
  id: string;
  title: string;
  quality: string;
  audio: string;
  caption: string;
  durationMs: number;
  createdAt: number;
  state: 'queued' | 'downloading' | 'waiting' | 'paused' | 'completed' | 'failed' | 'removing';
  bytes: number;
  percent: number;
  posterUri?: string;
  tmdbId?: number;
  mediaType?: 'movie' | 'tv';
  hasPosterSource?: boolean;
  showTitle?: string;
  season?: number;
  episode?: number;
}

interface DownloadsModule {
  prepare(input: string): Promise<DownloadOptions>;
  releasePreparation(token: string): void;
  start(input: string): Promise<void>;
  list(): Promise<OfflineDownload[]>;
  control(id: string, action: 'pause' | 'resume' | 'remove'): Promise<void>;
  requestPoster(id: string, url: string): Promise<void>;
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<DownloadsModule>('YummyDownloads') : null;
export const downloadsAvailable = native !== null;

const requireDownloads = () => {
  if (!native) throw new Error('Offline downloads require an Android build of Yummy.');
  return native;
};

export const prepareDownload = (source: DownloadSource) => requireDownloads().prepare(JSON.stringify(source));
export const releaseDownloadOptions = (token: string) => native?.releasePreparation(token);
export const startDownload = (selection: { token: string; quality: number; audio: number; caption: string }) =>
  requireDownloads().start(JSON.stringify(selection));
export const listDownloads = () => requireDownloads().list();
export const controlDownload = (id: string, action: 'pause' | 'resume' | 'remove') => requireDownloads().control(id, action);
export const requestDownloadPoster = (id: string, url: string) => requireDownloads().requestPoster(id, url);

export const isDownloadUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
};

export const formatDownloadBytes = (bytes: number) => bytes >= 1024 ** 3
  ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
  : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
