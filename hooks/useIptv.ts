import { IptvChannel, IptvPlaylist } from '@/constants/iptv';

const MAX_PLAYLIST_BYTES = 10_000_000;
const MAX_CHANNELS_PER_PLAYLIST = 20_000;
const MAX_URL_LENGTH = 4_096;

type M3uEntry = Omit<IptvChannel, 'id' | 'playlistId'>;

const isPrivateIpv4Address = (hostname: string) => {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

const isUnsafeIptvHost = (hostname: string) => {
  const normalizedHost = hostname.toLocaleLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalizedHost === 'localhost' ||
    normalizedHost.endsWith('.localhost') ||
    normalizedHost === '::1' ||
    normalizedHost.startsWith('fc') ||
    normalizedHost.startsWith('fd') ||
    normalizedHost.startsWith('fe8') ||
    normalizedHost.startsWith('fe9') ||
    normalizedHost.startsWith('fea') ||
    normalizedHost.startsWith('feb') ||
    isPrivateIpv4Address(normalizedHost)
  );
};

const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      !parsed.username &&
      !parsed.password &&
      !isUnsafeIptvHost(parsed.hostname) &&
      value.length <= MAX_URL_LENGTH
    );
  } catch {
    return false;
  }
};

export const isIptvPlaylistUrl = (value: string) => {
  const normalizedUrl = value.trim();

  try {
    const parsed = new URL(normalizedUrl);
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      !isUnsafeIptvHost(parsed.hostname) &&
      normalizedUrl.length <= MAX_URL_LENGTH
    );
  } catch {
    return false;
  }
};

export const isIptvStreamUrl = (value: string) => isHttpUrl(value);

const sanitizeText = (value: string, fallback: string) => {
  const sanitized = value.replace(/\s+/g, ' ').trim().slice(0, 200);
  return sanitized || fallback;
};

const parseAttributes = (value: string) => {
  const attributes: Record<string, string> = {};
  const attributePattern = /([\w-]+)=(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;

  let match: RegExpExecArray | null;
  while ((match = attributePattern.exec(value)) !== null) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }

  return attributes;
};

const splitExtinf = (value: string) => {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === '"' || character === "'") && (!quote || quote === character)) {
      quote = quote === character ? null : character;
      continue;
    }

    if (character === ',' && !quote) {
      return {
        attributes: value.slice(0, index),
        name: value.slice(index + 1),
      };
    }
  }

  return { attributes: value, name: '' };
};

export const parseM3uPlaylist = (content: string, playlistId: string): IptvChannel[] => {
  const channels: IptvChannel[] = [];
  const seenStreamUrls = new Set<string>();
  let pendingEntry: M3uEntry | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const metadata = splitExtinf(line.slice('#EXTINF:'.length));
      const attributes = parseAttributes(metadata.attributes);
      const logoUrl = attributes['tvg-logo'];

      pendingEntry = {
        name: sanitizeText(metadata.name, 'Unnamed channel'),
        group: sanitizeText(attributes['group-title'] || '', 'Other'),
        logoUrl: logoUrl && isHttpUrl(logoUrl) ? logoUrl : undefined,
        tvgId: sanitizeText(attributes['tvg-id'] || '', ''),
        streamUrl: '',
      };
      continue;
    }

    if (line.startsWith('#')) continue;
    if (!pendingEntry || !isHttpUrl(line) || seenStreamUrls.has(line)) {
      pendingEntry = null;
      continue;
    }

    channels.push({
      ...pendingEntry,
      id: `${playlistId}:${encodeURIComponent(line)}`,
      playlistId,
      streamUrl: line,
    });
    seenStreamUrls.add(line);
    pendingEntry = null;

    if (channels.length >= MAX_CHANNELS_PER_PLAYLIST) break;
  }

  return channels;
};

export const fetchIptvChannels = async (playlist: IptvPlaylist): Promise<IptvChannel[]> => {
  if (!isIptvPlaylistUrl(playlist.url)) {
    throw new Error('Playlist URLs must use public HTTPS and cannot include credentials.');
  }

  const response = await fetch(playlist.url, {
    headers: { Accept: 'application/x-mpegURL, application/vnd.apple.mpegurl, text/plain, */*' },
  });

  if (!response.ok) {
    throw new Error(`Playlist request failed (${response.status}).`);
  }

  if (response.url && !isIptvPlaylistUrl(response.url)) {
    throw new Error('Playlist redirect target is not a public HTTPS URL.');
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_PLAYLIST_BYTES) {
    throw new Error('Playlist is too large to load on this device.');
  }

  const content = await response.text();
  if (content.length > MAX_PLAYLIST_BYTES) {
    throw new Error('Playlist is too large to load on this device.');
  }

  const channels = parseM3uPlaylist(content, playlist.id);
  if (channels.length === 0) {
    throw new Error('No playable HTTP or HTTPS streams were found in this playlist.');
  }

  return channels;
};
