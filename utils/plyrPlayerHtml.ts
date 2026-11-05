import { Colors } from '@/constants/colors';

export const PLYR_VERSION = '3.8.4';
export const HLS_VERSION = '1.5.18';

/**
 * Builds the Plyr + hls.js player document used by the IPTV and direct-stream
 * players. The source URL may be HLS (`.m3u8`), DASH (`.mpd`), or a direct
 * progressive file (`.mp4`/`.m4v`/`.webm`).
 *
 * Posts `{ type: 'ready' | 'error' }` back through `ReactNativeWebView`
 * (native) or `window.parent` (web iframe).
 */
export const buildPlyrPlayerHtml = (streamUrl: string, title: string) => {
  const serializedSource = JSON.stringify({ streamUrl, title }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="https://cdn.plyr.io/${PLYR_VERSION}/plyr.css" />
    <style>
      :root {
        --plyr-color-main: ${Colors.accent};
        --plyr-video-background: #000;
        --plyr-video-control-color: ${Colors.text};
        --plyr-video-control-color-hover: ${Colors.text};
        --plyr-menu-background: ${Colors.surface};
        --plyr-menu-color: ${Colors.text};
        --plyr-font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      }
      html, body, #app, .plyr { width: 100%; height: 100%; margin: 0; background: #000; }
      video { width: 100%; height: 100%; }
      .plyr__menu__container { max-height: calc(100vh - 180px) !important; }
      .plyr__menu__container > div { max-height: calc(100vh - 180px) !important; overflow-y: auto !important; -webkit-overflow-scrolling: touch; }
      .plyr__menu__container [role=menu] { overscroll-behavior: contain; }
    </style>
  </head>
  <body>
    <div id="app"><video id="player" controls playsinline crossorigin="anonymous"></video></div>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@${HLS_VERSION}"></script>
    <script src="https://cdn.plyr.io/${PLYR_VERSION}/plyr.polyfilled.js"></script>
    <script>
      (function () {
        const source = ${serializedSource};
        const video = document.getElementById('player');
        const isDash = /\\.mpd(?:[?#]|$)/i.test(source.streamUrl);
        const isDirectFile = /\\.(mp4|m4v|webm)(?:[?#]|$)/i.test(source.streamUrl);
        const shouldTryHls = !isDash && !isDirectFile;

        const post = (type) => {
          try {
            const payload = JSON.stringify({ type: type });
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(payload);
            } else if (window.parent && window.parent !== window) {
              window.parent.postMessage(payload, '*');
            }
          } catch (_) {}
        };

        const player = new Plyr(video, {
          iconUrl: 'https://cdn.plyr.io/${PLYR_VERSION}/plyr.svg',
          loadSprite: true,
          title: source.title || '',
          captions: { active: false, update: true },
          settings: ['captions', 'speed', 'loop'],
          controls: ['play-large', 'restart', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
          fullscreen: { enabled: true, fallback: true, iosNative: false },
        });

        const play = () => video.play().catch(() => {});
        video.addEventListener('error', () => post('error'));

        if (shouldTryHls && window.Hls && window.Hls.isSupported()) {
          const hls = new window.Hls({ enableWorker: true, backBufferLength: 90 });
          hls.loadSource(source.streamUrl);
          hls.attachMedia(video);
          hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            post('ready');
            play();
          });
          hls.on(window.Hls.Events.ERROR, (_, data) => {
            if (data && data.fatal) {
              hls.destroy();
              post('error');
            }
          });
          return;
        }

        if ((shouldTryHls && video.canPlayType('application/vnd.apple.mpegurl')) || isDirectFile) {
          video.src = source.streamUrl;
          video.addEventListener('loadedmetadata', () => {
            post('ready');
            play();
          }, { once: true });
          return;
        }

        player.destroy();
        post('error');
      })();
    </script>
  </body>
</html>`;
};
