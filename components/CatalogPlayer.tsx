import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { CATALOG_SESSION_TTL_MS } from '@/constants/catalog';
import { useCatalog } from '@/hooks/useCatalog';
import { useTMDB } from '@/hooks/useTMDB';
import type { CatalogMatchCriteria } from '@/utils/catalogMatch';
import { DownloadCaption, isDownloadUrl } from '@/utils/downloads';
import { useRouter } from 'expo-router';
import { AlertCircle, KeyRound, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

const PLAYER_LOAD_TIMEOUT_MS = 40_000;
const PLYR_VERSION = '3.8.4';
const HLS_VERSION = '1.5.18';

type PlayerMessage =
  | { type: 'ready' }
  | { type: 'error'; message?: string }
  | { type: 'status'; message?: string }
  | { type: 'downloadSource'; url: string; captions?: DownloadCaption[] };

interface CatalogPlayerProps {
  title: string;
  type: 'movie' | 'tv';
  season?: string;
  episode?: string;
  /** User-supplied service origin, e.g. https://example.com */
  baseUrl: string;
  /**
   * TMDB id for the title being played. When present, its year/cast/director
   * are used to confirm the catalog search hit before playing.
   */
  tmdbId?: number;
  onDownloadSource?: (source: { url: string; captions: DownloadCaption[] } | null) => void;
}

/**
 * Early script: runs before the site's own scripts. Neutralizes ad popups and
 * strips the addhash attribute that drives the site's verification polling
 * (which can reload the page mid-playback).
 */
const CATALOG_PLAYER_EARLY_SCRIPT = `
(function () {
  try {
    window.open = function () { return null; };
  } catch (_) {}

  document.addEventListener('DOMContentLoaded', function () {
    try {
      var body = document.body;
      if (body) {
        body.removeAttribute('data-addhash');
      }
    } catch (_) {}
  });
})();
true;
`;

/**
 * Injected into a real page on the user's own service domain (so the document
 * origin — and therefore the Referer header the CDNs require — is correct).
 * Replaces the page with a Plyr + hls.js player that resolves the tokenized
 * playlist same-origin and exposes audio-track, caption, and quality menus when
 * the stream provides them.
 */
const buildPlayerScript = (options: {
  playbackId: string;
  playlistPath: string;
  title: string;
  tHashT: string | null;
}) => {
  const serialized = JSON.stringify({
    id: options.playbackId,
    playlistPath: options.playlistPath,
    title: options.title,
    tHashT: options.tHashT ?? '',
  }).replace(/</g, '\\u003c');

  return `
(function () {
  if (window.__yummyCatalogPlayer) return;
  window.__yummyCatalogPlayer = true;

  var config = ${serialized};

  var post = function (payload) {
    try {
      var serialized = JSON.stringify(payload);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(serialized);
      }
    } catch (_) {}
  };

  var fail = function (message) {
    post({ type: 'error', message: message });
  };

  var status = function (message) {
    post({ type: 'status', message: message });
  };

  try {
    document.body.removeAttribute('data-addhash');
    document.body.innerHTML = '';
  } catch (_) {}

  if (config.tHashT) {
    try {
      document.cookie = 't_hash_t=' + config.tHashT + '; path=/';
    } catch (_) {}
  }

  // ---------- stage / theme ----------
  // Plyr's stylesheet is loaded first so the app theme below wins the cascade.
  var plyrCss = document.createElement('link');
  plyrCss.rel = 'stylesheet';
  plyrCss.href = 'https://cdn.plyr.io/${PLYR_VERSION}/plyr.css';
  document.head.appendChild(plyrCss);

  var style = document.createElement('style');
  style.textContent = [
    ':root {',
    '  --plyr-color-main: ${Colors.accent};',
    '  --plyr-video-background: #000;',
    '  --plyr-video-control-color: ${Colors.text};',
    '  --plyr-video-control-color-hover: ${Colors.text};',
    '  --plyr-menu-background: ${Colors.surface};',
    '  --plyr-menu-color: ${Colors.text};',
    "  --plyr-font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;",
    '  --plyr-control-icon-size: 20px;',
    '  --plyr-control-spacing: 12px;',
    '  --plyr-range-thumb-height: 14px;',
    '  --plyr-font-size-menu: 14px;',
    '  --plyr-font-size-time: 14px;',
    '  --plyr-font-size-large: 18px;',
    '  --plyr-font-size-xlarge: 21px;',
    '}',
    'html, body, #yummy-stage, .plyr { width:100%; height:100%; margin:0; background:#000; overflow:hidden; }',
    /* Readable captions: larger text, stronger contrast, softer edges */
    '.plyr__caption { background: rgba(0,0,0,0.78); border-radius: 6px; font-weight: 600; line-height: 1.45; padding: 6px 14px; text-shadow: 0 1px 3px rgba(0,0,0,0.9); }',
    /* Roomier menu items for touch */
    '.plyr__menu__container .plyr__control { padding: 10px 14px; }',
    '.plyr__menu__container [role=menu] { min-width: 190px; }',
    /* Plyr menus open upward from the control bar with no height cap, so long
       lists (captions with many languages) run off the top of the screen.
       Cap the height and make the list scrollable instead. */
    '.plyr__menu__container { max-height: calc(100vh - 180px) !important; }',
    '.plyr__menu__container > div { max-height: calc(100vh - 180px) !important; overflow-y: auto !important; -webkit-overflow-scrolling: touch; }',
    '.plyr__menu__container [role=menu] { overscroll-behavior: contain; }'
  ].join('\\n');
  document.head.appendChild(style);

  var stage = document.createElement('div');
  stage.id = 'yummy-stage';
  document.body.appendChild(stage);

  // ---------- helpers ----------
  var loadScript = function (src, onload, onerror) {
    var existing = null;
    document.querySelectorAll('script[src]').forEach(function (s) {
      if (s.src === src) existing = s;
    });
    if (existing && existing.getAttribute('data-ym-loaded') === '1') { onload(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.onload = function () { s.setAttribute('data-ym-loaded', '1'); onload(); };
    s.onerror = onerror || function () { fail('Could not load the video engine.'); };
    document.head.appendChild(s);
  };

  var serializeVtt = function (srt) {
    return (
      'WEBVTT\\n\\n' +
      srt
        .replace(/\\r+/g, '')
        .replace(
          /(\\d{2}:\\d{2}:\\d{2}),(\\d{3}) --> (\\d{2}:\\d{2}:\\d{2}),(\\d{3})/g,
          '$1.$2 --> $3.$4'
        )
    );
  };

  var labelRank = function (label) {
    var lower = (label || '').toLowerCase();
    if (lower.indexOf('english') === 0 && lower.indexOf('[cc]') !== -1) return 0;
    if (lower.indexOf('english') === 0) return 1;
    return 2;
  };

  // Android WebView loads blob: track URLs (readyState 2) but never parses
  // their cues, so captions silently stay empty. data: URLs parse correctly
  // on every WebView version tested.
  var toVttDataUrl = function (vtt) {
    try {
      return 'data:text/vtt;base64,' + btoa(unescape(encodeURIComponent(vtt)));
    } catch (_) {
      return 'data:text/vtt;charset=utf-8,' + encodeURIComponent(vtt);
    }
  };

  // ---------- main flow ----------
  status('Resolving stream...');

  fetch(config.playlistPath + '?id=' + encodeURIComponent(config.id), {
    credentials: 'include',
    cache: 'no-store',
  })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      var entry = Array.isArray(data) ? data[0] : null;
      var sources = entry && Array.isArray(entry.sources) ? entry.sources : [];
      if (!sources.length) {
        fail('No playable stream found for this title.');
        return;
      }

      var pick =
        sources.find(function (source) {
          return (source.label || '').toLowerCase() === 'auto';
        }) ||
        sources.find(function (source) { return source.default === 'true'; }) ||
        sources[0];

      var masterUrl = pick.file || '';
      if (!masterUrl) {
        fail('No playable stream found for this title.');
        return;
      }
      if (masterUrl.indexOf('http') !== 0) {
        masterUrl = location.origin + masterUrl;
      }

      var captionTracks =
        entry && Array.isArray(entry.tracks)
          ? entry.tracks
              .filter(function (track) {
                return track && track.kind === 'captions' && track.file;
              })
              .sort(function (a, b) { return labelRank(a.label) - labelRank(b.label); })
          : [];

      preparePlayer(masterUrl, captionTracks);
    })
    .catch(function (error) {
      fail('Could not reach the service. ' + (error && error.message ? error.message : ''));
    });

  // ---------- player build ----------
  var preparePlayer = function (masterUrl, captionTracks) {
    status('Loading player...');

    var unique = [];
    var seen = {};
    for (var i = 0; i < captionTracks.length && unique.length < 25; i++) {
      var key = captionTracks[i].file || captionTracks[i].label;
      if (!seen[key]) {
        seen[key] = true;
        unique.push(captionTracks[i]);
      }
    }

    post({ type: 'downloadSource', url: masterUrl, captions: unique.map(function (track) {
      return { url: new URL(track.file, location.origin).href, label: track.label || 'Subtitles', language: track.language || 'und' };
    }) });

    // Pre-load captions so they are ready to attach once playback starts.
    Promise.all(
      unique.map(function (track) {
        var url = track.file.indexOf('http') === 0 ? track.file : 'https:' + track.file;
        return fetch(url)
          .then(function (response) { return response.text(); })
          .then(function (srt) {
            return {
              label: (track.label || 'Subtitles').replace(/\\s+/g, ' ').trim(),
              vtt: serializeVtt(srt),
            };
          })
          .catch(function () { return null; });
      })
    ).then(function (converted) {
      buildVideo(masterUrl, converted.filter(Boolean));
    });
  };

  // Attaching a media source (hls.js MSE or a direct src) resets the video
  // element and wipes already-parsed track cues, and tracks never re-parse —
  // so caption <track> elements must be appended AFTER the source is live.
  var pendingCaptions = [];
  var attachCaptions = function (video) {
    pendingCaptions.forEach(function (caption, index) {
      var track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = caption.label;
      track.srclang = index === 0 ? 'en' : 'und';
      track.default = index === 0;
      track.src = toVttDataUrl(caption.vtt);
      video.appendChild(track);
    });
    pendingCaptions = [];
  };

  var buildVideo = function (masterUrl, captions) {
    var video = document.createElement('video');
    video.id = 'yummy-nm-player';
    video.playsInline = true;
    video.setAttribute('crossorigin', 'anonymous');
    video.style.cssText = 'width:100%;height:100%;background:#000;';
    stage.appendChild(video);

    pendingCaptions = captions;

    loadScript('https://cdn.jsdelivr.net/npm/hls.js@${HLS_VERSION}', function () {
      initWithHls(masterUrl);
    });
  };

  var plyrPlayer = null;
  var hlsInstance = null;

  // ---------- native Plyr settings panes (Audio / Quality) ----------
  // Plyr builds its settings menu (captions/speed/...) from config; audio
  // tracks and hls.js levels are only known after the manifest loads, so
  // matching panes are injected into Plyr's own menu DOM once available.
  var settingsRoot = function () {
    if (!plyrPlayer) return null;
    var home = document.getElementById('plyr-settings-' + plyrPlayer.id + '-home');
    if (!home || !home.parentNode) return null;
    var menu = home.querySelector('[role="menu"]');
    if (!menu) return null;
    return { home: home, menu: menu, inner: home.parentNode };
  };

  var showPane = function (target) {
    var inner = target.parentNode;
    if (!inner) return;
    Array.prototype.forEach.call(inner.children, function (child) {
      child.hidden = child !== target;
    });
  };

  var createPane = function (name, isAudio) {
    var root = settingsRoot();
    if (!root) return null;

    var forward = document.createElement('button');
    forward.type = 'button';
    forward.className = 'plyr__control plyr__control--forward';
    forward.setAttribute('data-plyr', 'settings');
    forward.setAttribute('role', 'menuitem');
    forward.setAttribute('aria-haspopup', 'true');
    forward.hidden = true;

    var flex = document.createElement('span');
    flex.textContent = name;
    var value = document.createElement('span');
    value.className = 'plyr__menu__value';
    flex.appendChild(value);
    forward.appendChild(flex);

    var pane = document.createElement('div');
    pane.id = 'plyr-settings-' + plyrPlayer.id + '-' + name.toLowerCase();
    pane.hidden = true;

    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'plyr__control plyr__control--back';
    var backLabel = document.createElement('span');
    backLabel.setAttribute('aria-hidden', 'true');
    backLabel.textContent = name;
    var backSr = document.createElement('span');
    backSr.className = 'plyr__sr-only';
    backSr.textContent = 'Go back to previous menu';
    back.appendChild(backLabel);
    back.appendChild(backSr);

    var list = document.createElement('div');
    list.setAttribute('role', 'menu');

    pane.appendChild(back);
    pane.appendChild(list);
    root.inner.appendChild(pane);

    forward.addEventListener('click', function () { showPane(pane); });
    back.addEventListener('click', function () { showPane(root.home); });

    // Keep the home order stable: Captions, Audio, Quality, Speed...
    var anchor = null;
    if (isAudio && qualityPane) {
      anchor = qualityPane.forward;
    } else if (!isAudio && audioPane) {
      anchor = audioPane.forward.nextElementSibling;
    } else {
      anchor = root.menu.children[1] || null;
    }
    root.menu.insertBefore(forward, anchor);

    return { forward: forward, value: value, list: list };
  };

  var makeMenuItem = function (label, value, checked, onSelect) {
    var item = document.createElement('button');
    item.type = 'button';
    item.className = 'plyr__control';
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', checked ? 'true' : 'false');
    item.value = String(value);
    var span = document.createElement('span');
    span.textContent = label;
    item.appendChild(span);
    item.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      onSelect();
    });
    return item;
  };

  var clearList = function (list) {
    while (list.firstChild) list.removeChild(list.firstChild);
  };

  var setChecked = function (list, value) {
    Array.prototype.forEach.call(list.children, function (item) {
      item.setAttribute('aria-checked', Number(item.value) === value ? 'true' : 'false');
    });
  };

  // ---------- audio pane ----------
  var audioPane = null;

  var audioLabel = function (track) {
    if (!track) return 'Default';
    return (track.name || track.lang || 'Default').replace(/^\\d+\\.\\s*/, '');
  };

  var renderAudioPane = function () {
    if (!audioPane || !hlsInstance) return;
    clearList(audioPane.list);
    var current = hlsInstance.audioTrack;
    hlsInstance.audioTracks.forEach(function (track, index) {
      audioPane.list.appendChild(
        makeMenuItem(audioLabel(track), index, index === current, function () {
          try { hlsInstance.audioTrack = index; } catch (_) {}
          setChecked(audioPane.list, hlsInstance.audioTrack);
          audioPane.value.textContent = audioLabel(hlsInstance.audioTracks[hlsInstance.audioTrack]);
        })
      );
    });
    audioPane.value.textContent = audioLabel(hlsInstance.audioTracks[current]);
  };

  var refreshAudioValue = function () {
    if (!audioPane || !hlsInstance) return;
    setChecked(audioPane.list, hlsInstance.audioTrack);
    audioPane.value.textContent = audioLabel(hlsInstance.audioTracks[hlsInstance.audioTrack]);
  };

  var buildAudioPane = function () {
    if (!hlsInstance) return;
    var tracks = hlsInstance.audioTracks || [];
    if (tracks.length < 2) return;
    if (!audioPane) audioPane = createPane('Audio', true);
    if (!audioPane) return;
    renderAudioPane();
    audioPane.forward.hidden = false;
  };

  // ---------- quality pane ----------
  var qualityPane = null;

  var qualityText = function () {
    if (!hlsInstance) return 'Auto';
    if (hlsInstance.autoLevelEnabled) {
      var level = hlsInstance.levels[hlsInstance.currentLevel];
      return 'Auto' + (level && level.height ? ' (' + level.height + 'p)' : '');
    }
    var current = hlsInstance.levels[hlsInstance.currentLevel];
    return current && current.height ? current.height + 'p' : 'Auto';
  };

  var renderQualityPane = function () {
    if (!qualityPane || !hlsInstance) return;
    clearList(qualityPane.list);

    qualityPane.list.appendChild(
      makeMenuItem('Auto', -1, hlsInstance.autoLevelEnabled, function () {
        hlsInstance.currentLevel = -1;
        qualityPane.value.textContent = qualityText();
        setChecked(qualityPane.list, -1);
      })
    );

    var sorted = hlsInstance.levels
      .map(function (level, index) { return { level: level, index: index }; })
      .sort(function (a, b) { return (b.level.height || 0) - (a.level.height || 0); });

    sorted.forEach(function (entry) {
      var label = (entry.level.height ? entry.level.height + 'p' : 'Level ' + entry.index) +
        (entry.level.bitrate ? ' \\u00b7 ' + Math.round(entry.level.bitrate / 1000) + ' kbps' : '');
      var selected = !hlsInstance.autoLevelEnabled && hlsInstance.currentLevel === entry.index;
      qualityPane.list.appendChild(
        makeMenuItem(label, entry.index, selected, function () {
          hlsInstance.currentLevel = entry.index;
          qualityPane.value.textContent = qualityText();
          setChecked(qualityPane.list, entry.index);
        })
      );
    });

    qualityPane.value.textContent = qualityText();
  };

  var refreshQualityValue = function () {
    if (!qualityPane || !hlsInstance) return;
    setChecked(qualityPane.list, hlsInstance.autoLevelEnabled ? -1 : hlsInstance.currentLevel);
    qualityPane.value.textContent = qualityText();
  };

  var buildQualityPane = function () {
    if (!hlsInstance) return;
    var levels = hlsInstance.levels || [];
    if (levels.length < 2) return;
    if (!qualityPane) qualityPane = createPane('Quality', false);
    if (!qualityPane) return;
    renderQualityPane();
    qualityPane.forward.hidden = false;
  };

  // ---------- init ----------
  var initWithHls = function (masterUrl) {
    var video = document.getElementById('yummy-nm-player');
    if (!video) {
      fail('Player element missing.');
      return;
    }

    loadScript('https://cdn.plyr.io/${PLYR_VERSION}/plyr.polyfilled.js', function () {
      try {
        plyrPlayer = new Plyr(video, {
          iconUrl: 'https://cdn.plyr.io/${PLYR_VERSION}/plyr.svg',
          loadSprite: true,
          title: config.title || '',
          captions: { active: false, update: true },
          settings: ['captions', 'speed', 'loop'],
          controls: [
            'play-large', 'restart', 'rewind', 'play', 'fast-forward',
            'progress', 'current-time', 'duration', 'mute', 'volume',
            'captions', 'settings', 'pip', 'airplay', 'fullscreen'
          ],
          fullscreen: { enabled: true, fallback: true, iosNative: false },
        });
      } catch (_) {
        plyrPlayer = null;
      }

      var ready = function () {
        status('');
        post({ type: 'ready' });
        video.play().catch(function () {});
      };

      if (window.Hls && window.Hls.isSupported()) {
        // renderTextTracksNatively:false keeps hls.js from force-disabling
        // the page's own <track> caption elements (Plyr manages them).
        hlsInstance = new window.Hls({
          enableWorker: true,
          backBufferLength: 90,
          renderTextTracksNatively: false,
        });
        hlsInstance.loadSource(masterUrl);
        hlsInstance.attachMedia(video);
        hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, function () {
          attachCaptions(video);
          buildQualityPane();
          ready();
        });
        // Audio tracks only appear after the first level starts loading
        // (hls.audioTracks is empty at MANIFEST_PARSED), so build the pane
        // whenever hls.js publishes the track list.
        hlsInstance.on(window.Hls.Events.AUDIO_TRACKS_UPDATED, function () {
          if ((hlsInstance.audioTracks || []).length >= 2) {
            buildAudioPane();
          }
        });
        hlsInstance.on(window.Hls.Events.LEVEL_SWITCHED, refreshQualityValue);
        hlsInstance.on(window.Hls.Events.AUDIO_TRACK_SWITCHED, refreshAudioValue);
        hlsInstance.on(window.Hls.Events.ERROR, function (_, data) {
          if (data && data.fatal) {
            if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
              hlsInstance.startLoad();
              return;
            }
            hlsInstance.destroy();
            fail('Stream failed to play. Try again or pick another title.');
          }
        });
        return;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = masterUrl;
        video.addEventListener(
          'loadedmetadata',
          function () {
            attachCaptions(video);
            ready();
          },
          { once: true }
        );
        return;
      }

      fail('HLS playback is not supported on this device.');
    });
  };
})();
true;
`;
};

export function CatalogPlayer({
  title,
  type,
  season,
  episode,
  baseUrl,
  tmdbId,
  onDownloadSource,
}: CatalogPlayerProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isConfigured, isActive, isSessionFresh, session, resolvePlaybackTarget } = useCatalog();
  const { fetchMatchCriteria } = useTMDB();
  const apiBaseUrl = session?.baseUrl || baseUrl;
  const [playbackId, setPlaybackId] = useState<string | null>(null);
  const [playlistPath, setPlaylistPath] = useState<string>('/mobile/playlist.php');
  const [resolvedLabel, setResolvedLabel] = useState('');
  /** null = nothing to compare, true = confirmed, false = checked and disagreed. */
  const [matchVerified, setMatchVerified] = useState<boolean | null>(null);
  const [resolveState, setResolveState] = useState<'idle' | 'resolving' | 'failed'>('idle');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const isWeb = Platform.OS === 'web';

  const seasonNumber = season ? Number(season) || 1 : 1;
  const episodeNumber = episode ? Number(episode) || 1 : 1;

  const resolveTarget = useCallback(async () => {
    if (!isActive) return;
    setResolveState('resolving');
    setPlayerError(null);
    setPlaybackId(null);
    setHasLoaded(false);
    onDownloadSource?.(null);

    try {
      // Confirm the catalog hit with TMDB metadata when we have the title id.
      // A missing criteria set just means the resolver falls back to
      // title-only matching.
      let criteria: CatalogMatchCriteria | undefined;
      if (tmdbId != null && Number.isFinite(tmdbId)) {
        try {
          criteria = await fetchMatchCriteria(tmdbId, type);
        } catch {
          criteria = undefined;
        }
      }

      const target = await resolvePlaybackTarget({
        title,
        type,
        season: seasonNumber,
        episode: episodeNumber,
        criteria,
      });
      if (target) {
        setPlaybackId(target.playbackId);
        setPlaylistPath(
          target.ott === 'nf'
            ? '/mobile/playlist.php'
            : `/mobile/${target.ott}/playlist.php`
        );
        setResolvedLabel(target.label);
        setMatchVerified(target.verified);
        setResolveState('idle');
        return;
      }
    } catch {
      // Fall through to failure state
    }

    setResolveState('failed');
  }, [
    episodeNumber,
    fetchMatchCriteria,
    isActive,
    resolvePlaybackTarget,
    seasonNumber,
    title,
    tmdbId,
    type,
    onDownloadSource,
  ]);

  useEffect(() => {
    void resolveTarget();
  }, [resolveTarget, retryKey]);

  const playerScript = useMemo(() => {
    if (!playbackId) return '';
    return buildPlayerScript({
      playbackId,
      playlistPath,
      title,
      tHashT: session?.tHashT || null,
    });
  }, [playbackId, playlistPath, session?.tHashT, title]);

  useEffect(() => {
    if (!playbackId || hasLoaded || playerError) return;
    const timeout = setTimeout(
      () => setPlayerError('Stream is taking too long to load.'),
      PLAYER_LOAD_TIMEOUT_MS
    );
    return () => clearTimeout(timeout);
  }, [hasLoaded, playbackId, playerError]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      if (event.nativeEvent.data.length > 100_000) return;
      const message = JSON.parse(event.nativeEvent.data) as PlayerMessage;
      if (message.type === 'downloadSource' && isDownloadUrl(message.url)) {
        const captions = Array.isArray(message.captions) ? message.captions.slice(0, 25).filter((track: DownloadCaption) =>
          track && isDownloadUrl(track.url) && typeof track.label === 'string'
        ).map((track: DownloadCaption) => ({ url: track.url, label: track.label.slice(0, 80), language: typeof track.language === 'string' ? track.language.slice(0, 32) : 'und' })) : [];
        onDownloadSource?.({ url: message.url, captions });
        return;
      }
      if (message.type === 'ready') {
        setHasLoaded(true);
        setPlayerError(null);
        setStatusMessage('');
        return;
      }
      if (message.type === 'status') {
        setStatusMessage(message.message || '');
        return;
      }
      if (message.type === 'error') {
        setPlayerError(message.message || 'Stream failed to play.');
      }
    } catch {
      // Ignore malformed messages from the player page
    }
  }, [onDownloadSource]);

  const handleShouldStartLoad = useCallback(
    (request: { url?: string }) => {
      const url = request.url || '';
      if (
        url.startsWith('about:') ||
        url.startsWith('blob:') ||
        url.startsWith('data:')
      ) {
        return true;
      }
      return url.startsWith(`${apiBaseUrl}/`);
    },
    [apiBaseUrl]
  );

  if (!isConfigured) {
    return (
      <View style={styles.stateContainer}>
        <KeyRound size={40} color={Colors.textSecondary} />
        <Text style={styles.stateTitle}>Add your service domain</Text>
        <Text style={styles.stateText}>
          This source needs the domain of your OTT service. Open Settings, enter it under
          Catalog Service, and then activate the session.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/settings')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isActive) {
    return (
      <View style={styles.stateContainer}>
        <KeyRound size={40} color={Colors.textSecondary} />
        <Text style={styles.stateTitle}>Activate this source</Text>
        <Text style={styles.stateText}>
          This source needs a one-time activation in Settings. Open Settings, tap Activate under
          Catalog Service, and wait for the confirmation.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/settings')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isSessionFresh) {
    return (
      <View style={styles.stateContainer}>
        <KeyRound size={40} color={Colors.textSecondary} />
        <Text style={styles.stateTitle}>Session expired</Text>
        <Text style={styles.stateText}>
          The session is older than {Math.round(CATALOG_SESSION_TTL_MS / 3_600_000)}
          {' '}hours. Re-activate in Settings to keep watching.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/settings')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isWeb) {
    return (
      <View style={styles.stateContainer}>
        <AlertCircle size={40} color={Colors.textSecondary} />
        <Text style={styles.stateTitle}>Native playback required</Text>
        <Text style={styles.stateText}>
          This source needs the mobile player. Use the Android/iOS build for it and pick another
          provider here.
        </Text>
      </View>
    );
  }

  if (resolveState === 'resolving' || (resolveState === 'idle' && !playbackId && !playerError)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>
          {resolveState === 'resolving' ? 'Matching title...' : 'Loading stream...'}
        </Text>
      </View>
    );
  }

  if (resolveState === 'failed' && !playbackId) {
    return (
      <View style={styles.stateContainer}>
        <AlertCircle size={40} color={Colors.textSecondary} />
        <Text style={styles.stateTitle}>Title not found</Text>
        <Text style={styles.stateText}>
          This title could not be matched. Try another provider or check back later.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => setRetryKey((value) => value + 1)}
          activeOpacity={0.85}
        >
          <RefreshCw size={16} color="#fff" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (playerError) {
    return (
      <View style={styles.stateContainer}>
        <AlertCircle size={40} color={Colors.textSecondary} />
        <Text style={styles.stateTitle}>Stream unavailable</Text>
        <Text style={styles.stateText}>{playerError}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setHasLoaded(false);
            setPlayerError(null);
            setRetryKey((value) => value + 1);
          }}
          activeOpacity={0.85}
        >
          <RefreshCw size={16} color="#fff" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        key={`${playbackId}-${retryKey}`}
        source={{ uri: `${apiBaseUrl}/mobile/home?app=1` }}
        style={styles.webview}
        originWhitelist={['https://*', 'about:*', 'blob:*', 'data:*']}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        webviewDebuggingEnabled
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        injectedJavaScriptBeforeContentLoaded={CATALOG_PLAYER_EARLY_SCRIPT}
        injectedJavaScript={playerScript}
        injectedJavaScriptForMainFrameOnly
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onError={() => setPlayerError('The player could not be loaded.')}
        onOpenWindow={() => {
          // Player pop-ups — discard, never open a second window
        }}
      />
      {!hasLoaded ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>{statusMessage || resolvedLabel || title}</Text>
        </View>
      ) : null}
      {matchVerified !== true && hasLoaded && !playerError ? (
        <View
          style={[
            styles.unverifiedBadge,
            // Sit below the player screen's absolute header (close button +
            // title) so the badge is never painted over by it.
            { top: Math.max(insets.top, 10) + 52 },
          ]}
          pointerEvents="none"
        >
          <AlertCircle size={13} color={matchVerified === false ? Colors.accent : Colors.rating} />
          <Text
            style={[
              styles.unverifiedText,
              matchVerified === false ? styles.unverifiedTextMismatch : null,
            ]}
          >
            {matchVerified === false ? 'Possible mismatch' : 'Match unchecked'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 13,
    letterSpacing: 0.5,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  unverifiedBadge: {
    position: 'absolute',
    // `top` is supplied at render time from the safe-area inset.
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
    borderColor: Colors.rating,
    zIndex: 20,
  },
  unverifiedText: {
    color: Colors.rating,
    fontFamily: Fonts.GeistMono.Medium,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  /** "Possible mismatch" reads as a warning, so use the accent border/colour. */
  unverifiedTextMismatch: {
    color: Colors.accent,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    backgroundColor: '#000',
  },
  stateTitle: {
    color: Colors.text,
    fontFamily: Fonts.GeistMono.Bold,
    fontSize: 16,
  },
  stateText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.GeistMono.Regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontFamily: Fonts.GeistMono.Bold,
    fontSize: 14,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontFamily: Fonts.GeistMono.Bold,
    fontSize: 14,
  },
});
