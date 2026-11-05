import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import type { DownloadCaption } from '@/utils/downloads';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

const PLAYER_LOAD_TIMEOUT_MS = 40_000;
const PLYR_VERSION = '3.8.4';
const HLS_VERSION = '1.5.18';

type PlayerMessage =
  | { type: 'ready' }
  | { type: 'error'; message?: string }
  | { type: 'status'; message?: string }
  | { type: 'downloadSource'; url: string; captions?: DownloadCaption[] };

interface VidyPlayerProps {
  title: string;
  type: 'movie' | 'tv';
  season?: string;
  episode?: string;
  tmdbId: number;
  onDownloadSource?: (source: { url: string; captions: DownloadCaption[] } | null) => void;
}

/**
 * Loads a real page on the Vidy origin so every subresource request (the
 * decrypt API and the stream CDN) carries the Referer those hosts require.
 */
const VIDY_EARLY_SCRIPT = `
(function () {
  try { window.open = function () { return null; }; } catch (_) {}
})();
true;
`;

const buildVidyPlayerScript = (options: {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  season: number;
  episode: number;
  title: string;
}) => {
  const config = JSON.stringify(options).replace(/</g, '\\u003c');

  return `
(function () {
  if (window.__yummyVidyPlayer) return;
  window.__yummyVidyPlayer = true;

  var config = ${config};

  var post = function (payload) {
    try {
      var encoded = JSON.stringify(payload);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(encoded);
      }
    } catch (_) {}
  };
  var fail = function (message) { post({ type: 'error', message: message }); };
  var status = function (message) { post({ type: 'status', message: message }); };

  try { document.body.innerHTML = ''; } catch (_) {}

  // ---------------------------------------------------------------------------
  // Vidy source protocol (ported verbatim from the site's bundle).
  // ---------------------------------------------------------------------------
  var L = [1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580];
  var MAGIC = [109,118,109,49];
  var isEven = function (e) { return ((e * (e + 1)) & 1) === 0; };
  var isOdd = function (e) { return ((e * (e + 1)) & 1) === 1; };
  var mix = function (e) { e >>>= 0; e ^= e >>> 16; e = Math.imul(e, 2246822507) >>> 0; e ^= e >>> 13; e = Math.imul(e, 3266489909) >>> 0; e ^= e >>> 16; return e >>> 0; };
  var rotl = function (e, t) { e >>>= 0; t &= 31; return t === 0 ? e >>> 0 : (e << t | e >>> (32 - t)) >>> 0; };

  var fnvUpdate = function (str) {
    var h = 1732584193;
    for (var i = 0; i < str.length; i++) h = rotl((h ^ Math.imul(str.charCodeAt(i), L[15 & i])) >>> 0, 5);
    return mix(h);
  };
  var fnv1a = function (str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
    return mix(h);
  };
  var rc4 = function (key) {
    var s = new Array(256);
    for (var i = 0; i < 256; i++) s[i] = i;
    var j = 0;
    for (var k = 0; k < 256; k++) {
      j = (j + s[k] + key.charCodeAt(k % key.length)) & 255;
      var tmp = s[k]; s[k] = s[j]; s[j] = tmp;
    }
    return s;
  };

  var makeState = function (seed, mediaId) {
    if (isOdd(seed.length)) {
      return { S: rc4(seed), acc: fnvUpdate(seed) };
    }
    var a = new Array(61);
    var s = mix(fnv1a(seed) ^ mix((mediaId >>> 0) ^ 2654435769)) >>> 0;
    for (var e = 0; e < 8; e++) {
      if (isEven(e)) {
        var t = s % 61;
        s = rotl(s + 2654435769 >>> 0, 7 + (7 & e));
        a[t] = (s ^ mix(s)) >>> 0;
        s = mix(s + t >>> 0);
      } else {
        a[e] = L[15 & e];
      }
    }
    return { S: a, acc: mix(2779096485 ^ s) >>> 0 };
  };

  var nextWord = function (state, index) {
    var S = state.S;
    var acc = state.acc;
    var d = acc % 61;
    var present = 0 - Number(d in S);
    var sv = S[d] >>> 0;
    var x = (sv ^ Math.imul(2654435769, index + 1)) >>> 0;
    var v = (((acc ^ x) >>> 0) | (acc & x & present) >>> 0) >>> 0;
    acc = mix(((rotl((v + acc) >>> 0, 31 & d) ^ rotl(acc, 31 & Math.imul(d, 7))) >>> 0) + 2654435769 >>> 0);
    S[d] = acc >>> 0;
    state.acc = acc;
    return acc >>> 0;
  };

  var keystream = function (length, seed, mediaId) {
    var state = makeState(seed, mediaId);
    var out = new Uint8Array(length);
    var n = 0;
    for (var i = 0; i < length;) {
      var w = nextWord(state, n++);
      out[i++] = w & 255;
      if (i < length) out[i++] = (w >>> 8) & 255;
      if (i < length) out[i++] = (w >>> 16) & 255;
      if (i < length) out[i++] = (w >>> 24) & 255;
    }
    return out;
  };

  var base64 = function (input) {
    var t = input.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    var bin = atob(t);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  var decrypt = function (cipher, seed, mediaId) {
    var data = base64(cipher);
    var key = keystream(data.length, seed, mediaId);
    for (var i = 0; i < data.length; i++) data[i] ^= key[i];
    for (var m = 0; m < MAGIC.length; m++) {
      if (data[m] !== MAGIC[m]) throw new Error('decrypt failed');
    }
    var body = data.subarray(MAGIC.length);
    return new TextDecoder('utf-8').decode(body);
  };

  var API = 'https://api.wecollege.net';

  // Vidy exposes one stream per server; those servers map to audio languages.
  var LANGUAGE_GROUPS = [
    { key: 'original', label: 'Original', servers: ['miami','boise','nashville','chicago','vegas','reno','oakland','seattle','phoenix','atlanta','portland','austin','dallas'] },
    { key: 'de', label: 'German', servers: ['munich','berlin'] },
    { key: 'fr', label: 'French', servers: ['paris'] },
    { key: 'hi', label: 'Hindi', servers: ['delhi'] },
    { key: 'es', label: 'Spanish', servers: ['cancun'] }
  ];

  var getSeed = function (mediaId) {
    return fetch(API + '/seed?mediaId=' + encodeURIComponent(mediaId), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.seed) throw new Error('no seed');
        return j.seed;
      });
  };

  var fetchServer = function (server, seed, params) {
    var query = new URLSearchParams(params);
    query.set('enc', '2');
    query.set('seed', seed);
    return fetch(API + '/' + server + '/sources?' + query.toString(), { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (cipher) { return JSON.parse(decrypt(cipher, seed, params.tmdbId)); })
      .then(function (data) {
        if (!data || !data.sources || !data.sources.length) throw new Error('empty');
        return { server: server, sources: data.sources, subtitles: data.subtitles || [] };
      });
  };

  var params = {
    title: encodeURIComponent(config.title || ''),
    mediaType: config.mediaType,
    seasonId: config.season,
    episodeId: config.episode,
    tmdbId: config.tmdbId
  };

  var rankQuality = function (q) {
    var s = String(q || '').toLowerCase();
    if (s.indexOf('2160') === 0 || s.indexOf('4k') === 0) return 0;
    if (s.indexOf('1080') === 0) return 1;
    if (s.indexOf('720') === 0) return 2;
    if (s.indexOf('480') === 0) return 3;
    if (s.indexOf('360') === 0) return 4;
    return 5;
  };

  // ---------------------------------------------------------------------------
  // Stage + Plyr chrome (matches the app's player theme).
  // ---------------------------------------------------------------------------
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
    '.plyr__caption { background: rgba(0,0,0,0.78); border-radius: 6px; font-weight: 600; line-height: 1.45; padding: 6px 14px; text-shadow: 0 1px 3px rgba(0,0,0,0.9); }',
    '.plyr__menu__container { max-height: calc(100vh - 180px) !important; }',
    '.plyr__menu__container > div { max-height: calc(100vh - 180px) !important; overflow-y: auto !important; -webkit-overflow-scrolling: touch; }',
    '.plyr__menu__container [role=menu] { overscroll-behavior: contain; min-width: 190px; }',
    '.plyr__menu__container .plyr__control { padding: 10px 14px; }'
  ].join('\\n');
  document.head.appendChild(style);

  var stage = document.createElement('div');
  stage.id = 'yummy-stage';
  document.body.appendChild(stage);

  var video = document.createElement('video');
  video.id = 'yummy-vidy-player';
  video.playsInline = true;
  video.setAttribute('crossorigin', 'anonymous');
  video.style.cssText = 'width:100%;height:100%;background:#000;';
  stage.appendChild(video);

  var loadScript = function (src, onload) {
    var existing = null;
    Array.prototype.forEach.call(document.querySelectorAll('script[src]'), function (s) {
      if (s.src === src) existing = s;
    });
    if (existing && existing.getAttribute('data-ym-loaded') === '1') { onload(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.onload = function () { s.setAttribute('data-ym-loaded', '1'); onload(); };
    s.onerror = function () { fail('Could not load the video engine.'); };
    document.head.appendChild(s);
  };

  var toVttDataUrl = function (vtt) {
    try { return 'data:text/vtt;base64,' + btoa(unescape(encodeURIComponent(vtt))); }
    catch (_) { return 'data:text/vtt;charset=utf-8,' + encodeURIComponent(vtt); }
  };
  var srtToVtt = function (srt) {
    return 'WEBVTT\\n\\n' + srt.replace(/\\r+/g, '').replace(
      /(\\d{2}:\\d{2}:\\d{2}),(\\d{3}) --> (\\d{2}:\\d{2}:\\d{2}),(\\d{3})/g,
      '$1.$2 --> $3.$4'
    );
  };

  // Transient in-player notice (non-fatal outcomes keep the stream playing).
  var notice = function (message) {
    post({ type: 'status', message: message });
    try {
      var host = document.getElementById('yummy-notice');
      if (!host) {
        host = document.createElement('div');
        host.id = 'yummy-notice';
        host.style.cssText = 'position:fixed;top:12%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);border:1px solid #333;border-radius:8px;padding:10px 16px;color:#fff;font:13px "SFMono-Regular",Menlo,Consolas,monospace;z-index:9999;pointer-events:none;transition:opacity .3s;opacity:0;';
        document.body.appendChild(host);
      }
      host.textContent = message;
      host.style.opacity = '1';
      clearTimeout(host.__hideTimer);
      host.__hideTimer = setTimeout(function () { host.style.opacity = '0'; }, 4000);
    } catch (_) {}
  };

  status('Resolving stream...');

  var state = {
    seed: null,
    langKey: null,
    result: null,
    sourceList: [],
    sourceIndex: 0,
    pendingTracks: [],
    plyr: null,
    hls: null,
    // Monotonic token: async continuations compare it and bail when a newer
    // selection was made, so a slow older response can never overwrite it.
    switchToken: 0
  };

  var tryServers = function (servers) {
    // Seeds expire (~30 s TTL); every attempt races a fresh seed so a later
    // language switch can never ride a stale one into guaranteed failure.
    return getSeed(config.tmdbId).then(function (freshSeed) {
      state.seed = freshSeed;
      return new Promise(function (resolve) {
        var failures = 0;
        var settled = false;
        servers.forEach(function (server) {
          fetchServer(server, state.seed, params).then(function (result) {
            if (!settled) { settled = true; resolve(result); }
          }).catch(function () {
            failures++;
            if (failures === servers.length && !settled) { settled = true; resolve(null); }
          });
        });
      });
    });
  };

  getSeed(config.tmdbId)
    .then(function (seed) {
      state.seed = seed;
      // Try the original-language server group first.
      return tryServers(LANGUAGE_GROUPS[0].servers);
    })
    .then(function (result) {
      if (!result) { fail('This title is not available on any Vidy server.'); return; }
      state.langKey = 'original';
      status('Loading player...');
      loadScript('https://cdn.jsdelivr.net/npm/hls.js@${HLS_VERSION}', function () {
        loadScript('https://cdn.plyr.io/${PLYR_VERSION}/plyr.polyfilled.js', function () {
          initPlayer();
          loadResult(result);
        });
      });
    })
    .catch(function () { fail('This title is not available on any Vidy server.'); });

  // ---------------------------------------------------------------------------
  // Result handling
  // ---------------------------------------------------------------------------
  var fetchCaptions = function (subtitles) {
    var selected = subtitles.filter(function (sub) { return sub && sub.url; }).slice(0, 25);
    return Promise.all(selected.map(function (sub) {
      var url = sub.url;
      return fetch(url, { cache: 'no-store' })
        .then(function (r) { return r.text(); })
        .then(function (text) {
          var isSrt = String(sub.type || '').toLowerCase() === 'srt' || /\\.srt(\\?|$)/i.test(url);
          var vtt = isSrt ? srtToVtt(text) : text;
          var track = document.createElement('track');
          track.kind = 'subtitles';
          track.label = sub.language || sub.lang || 'Subtitles';
          track.srclang = (sub.lang || 'und').toLowerCase().slice(0, 8);
          track.src = toVttDataUrl(vtt);
          return track;
        })
        .catch(function () { return null; });
    })).then(function (tracks) { return tracks.filter(Boolean); });
  };

  var attachCaptions = function () {
    state.pendingTracks.forEach(function (track) { video.appendChild(track); });
    state.pendingTracks = [];
  };

  var reportDownloadSource = function (result) {
    if (!result.sources || !result.sources.length) return;
    var best = result.sources.slice().sort(function (a, b) {
      return rankQuality(a.quality) - rankQuality(b.quality);
    })[0];
    var captions = (result.subtitles || [])
      .filter(function (sub) { return sub && sub.url; })
      .slice(0, 25)
      .map(function (sub) {
        return {
          url: sub.url,
          label: String(sub.language || sub.lang || 'Subtitles').slice(0, 80),
          language: String(sub.lang || 'und').slice(0, 32)
        };
      });
    // Prefer the sibling multivariant playlist so the download sheet can offer
    // every resolution; fall back to the single reported source when absent.
    var masterUrl = best.url.replace(/\\/[^/]+$/, '/master.m3u8');
    fetch(masterUrl, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (text) {
        var url = text.indexOf('#EXT-X-STREAM-INF') !== -1 ? masterUrl : best.url;
        post({ type: 'downloadSource', url: url, captions: captions });
      })
      .catch(function () { post({ type: 'downloadSource', url: best.url, captions: captions }); });
  };

  var loadResult = function (result, resumeAt) {
    var token = ++state.switchToken;
    var at = typeof resumeAt === 'number' ? resumeAt : 0;
    state.result = result;
    state.sourceList = result.sources
      .filter(function (s) { return s && s.url; })
      .slice()
      .sort(function (a, b) { return rankQuality(a.quality) - rankQuality(b.quality); });
    state.sourceIndex = 0;
    if (!state.sourceList.length) { fail('No playable stream found.'); return; }

    reportDownloadSource(result);
    fetchCaptions(result.subtitles || []).then(function (tracks) {
      if (token !== state.switchToken) return; // superseded mid-flight
      state.pendingTracks = tracks;
      loadStream(state.sourceList[0].url, at);
    });
  };

  var loadStream = function (url, resumeAt) {
    var at = typeof resumeAt === 'number' ? resumeAt : 0;
    var wasPlaying = !video.paused && !video.ended && video.readyState > 0;

    if (state.hls) { try { state.hls.destroy(); } catch (_) {} state.hls = null; }
    // Previous captions belong to the previous source; drop them so a
    // language switch can never show two languages' cues at once.
    Array.prototype.slice.call(video.querySelectorAll('track')).forEach(function (t) { t.remove(); });
    state.pendingTracks = [];

    if (window.Hls && window.Hls.isSupported()) {
      state.hls = new window.Hls({ enableWorker: true, backBufferLength: 90 });
      state.hls.loadSource(url);
      state.hls.attachMedia(video);
      state.hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
        attachCaptions();
        buildQualityPane();
        if (at > 0) { try { video.currentTime = at; } catch (_) {} }
        if (!hasStarted) markStarted();
        else if (wasPlaying) video.play().catch(function () {});
      });
      state.hls.on(window.Hls.Events.ERROR, function (_, data) {
        if (data && data.fatal) {
          if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) { state.hls.startLoad(); return; }
          state.hls.destroy();
          fail('Stream failed to play. Try again or pick another title.');
        }
      });
      return;
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', function () {
        attachCaptions();
        if (!hasStarted) markStarted();
        else if (wasPlaying) video.play().catch(function () {});
      }, { once: true });
      return;
    }

    fail('HLS playback is not supported on this device.');
  };

  var switchSource = function (index) {
    if (index < 0 || index >= state.sourceList.length) return;
    state.sourceIndex = index;
    loadStream(state.sourceList[index].url, video.currentTime || 0);
    if (qualityPane) {
      Array.prototype.forEach.call(qualityPane.list.children, function (c, i) {
        c.setAttribute('aria-checked', i === index ? 'true' : 'false');
      });
      qualityPane.value.textContent = state.sourceList[index].quality || 'Auto';
    }
  };

  var switchLanguage = function (langKey) {
    if (langKey === state.langKey) return;
    var group = null;
    LANGUAGE_GROUPS.forEach(function (g) { if (g.key === langKey) group = g; });
    if (!group) return;
    var token = ++state.switchToken;
    var fromLang = state.langKey;
    var resumeAt = video.currentTime || 0;
    state.langKey = langKey;
    renderLanguagePane();
    status('Switching audio...');
    // Only destroy after a replacement resolves; a failed switch keeps playing.
    tryServers(group.servers).then(function (result) {
      if (token !== state.switchToken) return; // superseded by a newer selection
      if (!result) {
        state.langKey = fromLang;
        renderLanguagePane();
        notice('That audio language is not available for this title.');
        return;
      }
      status('');
      loadResult(result, resumeAt);
    });
  };

  // ---------------------------------------------------------------------------
  // Player construction
  // ---------------------------------------------------------------------------
  var initPlayer = function () {
    try {
      state.plyr = new Plyr(video, {
        iconUrl: 'https://cdn.plyr.io/${PLYR_VERSION}/plyr.svg',
        loadSprite: true,
        title: config.title || '',
        captions: { active: false, update: true },
        settings: ['captions', 'speed'],
        controls: [
          'play-large','restart','rewind','play','fast-forward','progress',
          'current-time','duration','mute','volume','captions','settings','pip','fullscreen'
        ],
        fullscreen: { enabled: true, fallback: true, iosNative: false }
      });
    } catch (_) { state.plyr = null; }

    video.addEventListener('loadeddata', function () {
      if (!hasStarted) return;
      return;
    });
  };

  var hasStarted = false;
  var markStarted = function () {
    if (hasStarted) return;
    hasStarted = true;
    status('');
    post({ type: 'ready' });
    video.play().catch(function () {});
  };
  video.addEventListener('playing', markStarted, { once: false });
  // Also mark ready after manifest parse even if autoplay is blocked.
  document.addEventListener('click', function () { if (hasStarted || video.readyState > 0) markStarted(); }, true);

  // ---------------------------------------------------------------------------
  // Injected Plyr settings panes (Language / Quality).
  // ---------------------------------------------------------------------------
  var languagePane = null;
  var qualityPane = null;

  var settingsRoot = function () {
    if (!state.plyr) return null;
    var home = document.getElementById('plyr-settings-' + state.plyr.id + '-home');
    if (!home || !home.parentNode) return null;
    var menu = home.querySelector('[role="menu"]');
    if (!menu) return null;
    return { home: home, menu: menu, inner: home.parentNode };
  };
  var showPane = function (target) {
    var inner = target.parentNode; if (!inner) return;
    Array.prototype.forEach.call(inner.children, function (c) { c.hidden = c !== target; });
  };
  var createPane = function (name, idSuffix) {
    var root = settingsRoot(); if (!root) return null;
    var forward = document.createElement('button');
    forward.type = 'button';
    forward.className = 'plyr__control plyr__control--forward';
    forward.setAttribute('data-plyr', 'settings');
    forward.setAttribute('role', 'menuitem');
    forward.setAttribute('aria-haspopup', 'true');
    var flex = document.createElement('span'); flex.textContent = name;
    var value = document.createElement('span'); value.className = 'plyr__menu__value';
    flex.appendChild(value); forward.appendChild(flex);
    var pane = document.createElement('div');
    pane.id = 'plyr-settings-' + state.plyr.id + '-' + idSuffix;
    pane.hidden = true;
    var back = document.createElement('button');
    back.type = 'button'; back.className = 'plyr__control plyr__control--back';
    var backLabel = document.createElement('span'); backLabel.setAttribute('aria-hidden', 'true'); backLabel.textContent = name;
    var backSr = document.createElement('span'); backSr.className = 'plyr__sr-only'; backSr.textContent = 'Go back to previous menu';
    back.appendChild(backLabel); back.appendChild(backSr);
    var list = document.createElement('div'); list.setAttribute('role', 'menu');
    pane.appendChild(back); pane.appendChild(list);
    root.inner.appendChild(pane);
    forward.addEventListener('click', function () { showPane(pane); });
    back.addEventListener('click', function () { showPane(root.home); });
    root.menu.appendChild(forward);
    return { forward: forward, value: value, list: list };
  };
  var makeItem = function (label, selected, onSelect) {
    var item = document.createElement('button');
    item.type = 'button';
    item.className = 'plyr__control';
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', selected ? 'true' : 'false');
    var span = document.createElement('span'); span.textContent = label;
    item.appendChild(span);
    item.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onSelect(); });
    return item;
  };

  var renderLanguagePane = function () {
    if (!languagePane) return;
    languagePane.list.innerHTML = '';
    LANGUAGE_GROUPS.forEach(function (group) {
      var selected = group.key === state.langKey;
      languagePane.list.appendChild(makeItem(group.label, selected, function () { switchLanguage(group.key); }));
    });
    var current = null;
    LANGUAGE_GROUPS.forEach(function (g) { if (g.key === state.langKey) current = g; });
    languagePane.value.textContent = current ? current.label : 'Original';
  };
  var buildLanguagePane = function () {
    if (!languagePane) languagePane = createPane('Audio language', 'language');
    if (!languagePane) return;
    renderLanguagePane();
  };

  var renderQuality = function () {
    if (!qualityPane) return;
    qualityPane.list.innerHTML = '';
    state.sourceList.forEach(function (source, index) {
      qualityPane.list.appendChild(makeItem(source.quality || 'Auto', index === state.sourceIndex, function () {
        switchSource(index);
      }));
    });
    var first = state.sourceList[state.sourceIndex];
    qualityPane.value.textContent = first ? (first.quality || 'Auto') : 'Auto';
  };
  var buildQualityPane = function () {
    if (state.sourceList.length < 2) {
      if (qualityPane) { qualityPane.forward.hidden = true; }
      return;
    }
    if (!qualityPane) qualityPane = createPane('Quality', 'quality');
    if (!qualityPane) return;
    qualityPane.forward.hidden = false;
    renderQuality();
  };

  // Build both panes once Plyr's settings DOM is ready.
  var paneTimer = setInterval(function () {
    if (!state.plyr) return;
    if (!settingsRoot()) return;
    clearInterval(paneTimer);
    buildLanguagePane();
    if (state.sourceList.length >= 2) buildQualityPane();
  }, 400);
})();
true;
`;
};

export function VidyPlayer({
  title,
  type,
  season,
  episode,
  tmdbId,
  onDownloadSource,
}: VidyPlayerProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const isWeb = Platform.OS === 'web';

  const seasonNumber = season ? Number(season) || 1 : 1;
  const episodeNumber = episode ? Number(episode) || 1 : 1;

  const playerScript = useMemo(
    () =>
      buildVidyPlayerScript({
        tmdbId,
        mediaType: type,
        season: seasonNumber,
        episode: episodeNumber,
        title,
      }),
    [tmdbId, type, seasonNumber, episodeNumber, title]
  );

  useEffect(() => {
    if (hasLoaded || playerError) return;
    const timeout = setTimeout(
      () => setPlayerError('Stream is taking too long to load.'),
      PLAYER_LOAD_TIMEOUT_MS
    );
    return () => clearTimeout(timeout);
  }, [hasLoaded, playerError, retryKey]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        if (event.nativeEvent.data.length > 200_000) return;
        const message = JSON.parse(event.nativeEvent.data) as PlayerMessage;
        if (message.type === 'downloadSource') {
          if (typeof message.url !== 'string') return;
          const captions = Array.isArray(message.captions) ? message.captions.slice(0, 25) : [];
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
        // Ignore messages that are not ours
      }
    },
    [onDownloadSource]
  );

  if (isWeb) {
    return (
      <View style={styles.stateContainer}>
        <AlertCircle size={40} color={Colors.textSecondary} />
        <Text style={styles.stateTitle}>Native playback required</Text>
        <Text style={styles.stateText}>
          The Vidy source needs the mobile player. Use the Android/iOS build and pick another
          provider here.
        </Text>
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
        key={retryKey}
        source={{ uri: 'https://www.vidy.st/' }}
        style={styles.webview}
        originWhitelist={['https://*', 'about:*', 'blob:*', 'data:*']}
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        injectedJavaScriptBeforeContentLoaded={VIDY_EARLY_SCRIPT}
        injectedJavaScript={playerScript}
        injectedJavaScriptForMainFrameOnly
        onMessage={handleMessage}
        onError={() => setPlayerError('The player could not be loaded.')}
        onOpenWindow={() => {
          // Player pop-ups — discard
        }}
      />
      {!hasLoaded ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>{statusMessage || title}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
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
