/**
 * Player WebView ad blocking: network host blocklist + injected scripts.
 * Intentionally host-based (not full EasyList) so video CDNs/mirrors still load.
 */

/** Known ad / popunder / tracker hosts used by embed players. */
export const PLAYER_AD_HOSTS: string[] = [
  // Google ads
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'googletagservices.com',
  'adservice.google.com',
  'pagead2.googlesyndication.com',
  'adssettings.google.com',
  // Common pop / redirect networks
  'popads.net',
  'popcash.net',
  'propellerads.com',
  'propellerclick.com',
  'adsterra.com',
  'hilltopads.com',
  'exoclick.com',
  'juicyads.com',
  'trafficjunky.net',
  'ad-maven.com',
  'admaven.com',
  'clickadu.com',
  'adcash.com',
  'bidvertiser.com',
  'mgid.com',
  'outbrain.com',
  'taboola.com',
  'revcontent.com',
  'adnxs.com',
  'adsrvr.org',
  'adform.net',
  'criteo.com',
  'criteo.net',
  'pubmatic.com',
  'openx.net',
  'rubiconproject.com',
  'casalemedia.com',
  'smartadserver.com',
  'servenobid.com',
  'lijit.com',
  'sovrn.com',
  'onetag.com',
  '33across.com',
  'sharethrough.com',
  'amazon-adsystem.com',
  'moatads.com',
  'scorecardresearch.com',
  'quantserve.com',
  'outbrainimg.com',
  // Embed / streaming popunder favorites
  'tsyndicate.com',
  'trafficstars.com',
  'adexchangegate.com',
  'adexchangescript.com',
  'profitableratecpm.com',
  'highcpmrevenuegate.com',
  'onclickalgo.com',
  'onclickperformance.com',
  'pushground.com',
  'berush.com',
  'udbaa.com',
  'punyu.com',
  'shorte.st',
  'shortest-route.com',
  'ouo.io',
  'adk2x.com',
  'adsymptotic.com',
  'advertising.com',
  'adtechus.com',
  'advertiseserve.com',
  'adblade.com',
  'adcolony.com',
  'adsafeprotected.com',
  'adskeeper.co.uk',
  'adskeeper.com',
  'betweendigital.com',
  'bidr.io',
  'contextweb.com',
  'districtm.io',
  'emxdgt.com',
  'gumgum.com',
  'inmobi.com',
  'media.net',
  'mediaiqdigital.com',
  'mixpanel.com',
  'nativeads.com',
  'presage.io',
  'rfihub.com',
  'rlcdn.com',
  'smaato.net',
  'spotxchange.com',
  'stickyadstv.com',
  'teads.tv',
  'tremorhub.com',
  'triplelift.com',
  'yieldmo.com',
  'zekreativ.com',
  'ztorm.com',
  'facebook.net',
  'connect.facebook.net',
];

/** Path / query tokens that almost always mean ad creatives. */
const AD_PATH_MARKERS = [
  '/ads/',
  '/ad/',
  '/advert',
  'popunder',
  'pop-under',
  'popads',
  'popcash',
  'doubleclick',
  'googlesyndication',
  'pagead',
  'adsystem',
  'adserver',
  'adserve',
  'getad',
  'bannerad',
  'sponsor',
];

function hostMatches(hostname: string, blocked: string): boolean {
  return hostname === blocked || hostname.endsWith(`.${blocked}`);
}

export function isAdUrl(url: string): boolean {
  if (!url) return false;

  const lower = url.toLowerCase();

  // Non-web schemes used by ad deep-links
  if (
    lower.startsWith('intent:') ||
    lower.startsWith('market:') ||
    lower.startsWith('intent://') ||
    lower.startsWith('fb://') ||
    lower.startsWith('whatsapp:') ||
    lower.startsWith('tg:') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  ) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (PLAYER_AD_HOSTS.some((blocked) => hostMatches(host, blocked.toLowerCase()))) {
      return true;
    }

    const pathAndQuery = `${parsed.pathname}${parsed.search}`.toLowerCase();
    // Only apply path markers when host looks like an ad CDN (avoid blocking /tv/ ads-free paths)
    if (
      AD_PATH_MARKERS.some((marker) => pathAndQuery.includes(marker)) &&
      /(^|\.)(ad|ads|banner|track|pixel|click|pop)/i.test(host)
    ) {
      return true;
    }
  } catch {
    // Malformed URL — block non-http junk
    if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
      return true;
    }
  }

  return false;
}

export function shouldAllowPlayerRequest(url: string): boolean {
  if (!url) return true;

  if (
    url.startsWith('about:') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return true;
  }

  if (!(url.startsWith('http://') || url.startsWith('https://'))) {
    return false;
  }

  return !isAdUrl(url);
}

/**
 * Runs before page JS — kills popup APIs early.
 * Must end with true; for react-native-webview.
 */
export const PLAYER_AD_BLOCK_BEFORE_JS = `
(function () {
  if (window.__yummyAdBlockEarly) return;
  window.__yummyAdBlockEarly = true;

  var noop = function () { return null; };
  var noFalse = function () { return false; };

  try {
    window.open = noop;
    window.alert = noop;
    window.confirm = noFalse;
    window.prompt = noop;
  } catch (e) {}

  try {
    Object.defineProperty(window, 'open', {
      configurable: true,
      writable: true,
      value: noop,
    });
  } catch (e) {}
})();
true;
`;

/**
 * Ongoing DOM / click / iframe cleanup for embed players.
 * Avoids wiping real players (video / known player classes).
 */
export const PLAYER_AD_BLOCK_JS = `
(function () {
  if (window.__yummyAdBlock) return true;
  window.__yummyAdBlock = true;

  var noop = function () { return null; };
  try { window.open = noop; } catch (e) {}

  var STYLE_ID = 'yummy-adblock-css';
  var css = [
    'iframe[src*="doubleclick"],',
    'iframe[src*="googlesyndication"],',
    'iframe[src*="googleadservices"],',
    'iframe[src*="adservice"],',
    'iframe[src*="popads"],',
    'iframe[src*="popcash"],',
    'iframe[id*="google_ads"],',
    'iframe[id*="ad_iframe"],',
    'iframe[class*="ads"],',
    '[id*="google_ads"],',
    '[id*="ad-container"],',
    '[id*="ad_container"],',
    '[class*="ad-container"],',
    '[class*="ad_container"],',
    '[class*="adsbox"],',
    '[class*="ad-box"],',
    '[class*="adbox"],',
    '#pop-overlay, .pop-overlay,',
    '[class*="pop-under"],',
    '[class*="popunder"],',
    '[id*="popunder"],',
    '[class*="sponsored"],',
    'ins.adsbygoogle {',
    '  display: none !important;',
    '  visibility: hidden !important;',
    '  pointer-events: none !important;',
    '  width: 0 !important;',
    '  height: 0 !important;',
    '  opacity: 0 !important;',
    '}'
  ].join('\\n');

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var head = document.head || document.documentElement;
    if (!head) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    head.appendChild(style);
  }

  function isPlayerNode(el) {
    if (!el || !el.querySelector) return false;
    return !!el.querySelector(
      'video, audio, .plyr, .jwplayer, .video-js, [class*="player"], [id*="player"], iframe[src*="embed"], iframe[src*="player"]'
    );
  }

  var AD_IFRAME_RE = /(doubleclick|googlesyndication|googleadservices|adservice|popads|popcash|exoclick|juicyads|propeller|adsterra|hilltopads|adnxs|outbrain|taboola|tsyndicate|trafficstars|adexchangegate|profitableratecpm|onclickalgo|pushground)/i;

  function scrubIframes(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var iframes = scope.querySelectorAll ? scope.querySelectorAll('iframe') : [];
    for (var i = 0; i < iframes.length; i++) {
      var frame = iframes[i];
      var src = frame.getAttribute('src') || frame.src || '';
      var id = frame.id || '';
      var cls = frame.className || '';
      if (AD_IFRAME_RE.test(src) || AD_IFRAME_RE.test(id) || /ads?/i.test(String(cls))) {
        frame.remove();
      }
    }
  }

  function removeClickStealers() {
    var vw = window.innerWidth || 0;
    var vh = window.innerHeight || 0;
    if (vw < 100 || vh < 100) return;

    var nodes = document.querySelectorAll('div, a, section, aside, span');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (isPlayerNode(el)) continue;

      var style;
      try {
        style = window.getComputedStyle(el);
      } catch (e) {
        continue;
      }
      if (!style) continue;
      if (style.position !== 'fixed' && style.position !== 'absolute') continue;

      var z = parseInt(style.zIndex, 10);
      if (isNaN(z) || z < 1000) continue;

      var rect = el.getBoundingClientRect();
      if (rect.width < vw * 0.7 || rect.height < vh * 0.5) continue;

      // Full-viewport high-z overlay without a player = click-stealer / pop overlay
      el.remove();
    }
  }

  function scrub(root) {
    injectCss();
    scrubIframes(root);
    removeClickStealers();
  }

  // Stop ad links / blank targets from navigating the top frame
  document.addEventListener(
    'click',
    function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var a = t.closest('a');
      if (!a) return;

      var href = a.getAttribute('href') || '';
      var target = (a.getAttribute('target') || '').toLowerCase();

      if (target === '_blank' || target === '_new') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (
        /doubleclick|googlesyndication|popads|popcash|exoclick|juicyads|propeller|adsterra|outbrain|taboola|onclick|pushground|adexchange|profitableratecpm/i.test(
          href
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  // Block synthetic popups
  document.addEventListener(
    'mousedown',
    function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[class*="pop"], [id*="pop"], [class*="overlay"]') && !isPlayerNode(t.closest('div'))) {
        var overlay = t.closest('[class*="pop"], [id*="pop"], [class*="overlay"]');
        if (overlay && !isPlayerNode(overlay)) {
          var zs = parseInt(window.getComputedStyle(overlay).zIndex, 10);
          if (!isNaN(zs) && zs >= 1000) {
            e.preventDefault();
            e.stopPropagation();
            overlay.remove();
          }
        }
      }
    },
    true
  );

  injectCss();
  scrub(document);

  try {
    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.addedNodes && m.addedNodes.length) {
          scrub(m.target);
          break;
        }
      }
    });
    obs.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  } catch (e) {}

  setInterval(function () {
    scrub(document);
  }, 1500);

  true;
})();
true;
`;
