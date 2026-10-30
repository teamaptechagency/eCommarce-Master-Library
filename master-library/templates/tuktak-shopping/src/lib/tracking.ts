// src/lib/tracking.ts
// Admin theke deya Pixel / GTM ID diye storefront-e tracking script inject kore.

export interface TrackingSettings {
  facebook_pixel_id?: string;
  gtm_id?: string;
  tiktok_pixel_id?: string;
}

// Format validation (script injection theke bachar jonno)
export const isValidFbPixelId = (v: string) => /^\d{8,20}$/.test(v);
export const isValidGtmId = (v: string) => /^GTM-[A-Z0-9]{4,10}$/.test(v);
export const isValidTikTokPixelId = (v: string) => /^[A-Z0-9]{10,30}$/.test(v);

const SCRIPT_ATTR = 'data-tracking';

const removeExisting = (name: string) => {
  document.querySelectorAll(`[${SCRIPT_ATTR}="${name}"]`).forEach((el) => el.remove());
};

const addScript = (name: string, code: string, target: HTMLElement = document.head) => {
  const s = document.createElement('script');
  s.setAttribute(SCRIPT_ATTR, name);
  s.text = code;
  target.appendChild(s);
};

const injectFacebookPixel = (id: string) => {
  removeExisting('fb');
  if (!isValidFbPixelId(id)) return;
  addScript(
    'fb',
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${id}');fbq('track','PageView');`
  );
};

const injectGtm = (id: string) => {
  removeExisting('gtm');
  if (!isValidGtmId(id)) return;
  addScript(
    'gtm',
    `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`
  );
  const ns = document.createElement('noscript');
  ns.setAttribute(SCRIPT_ATTR, 'gtm');
  ns.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
  document.body.insertBefore(ns, document.body.firstChild);
};

const injectTikTokPixel = (id: string) => {
  removeExisting('tiktok');
  if (!isValidTikTokPixelId(id)) return;
  addScript(
    'tiktok',
    `!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],
ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,
ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${id}');ttq.page();}(window, document, 'ttq');`
  );
};

export const applyTracking = (s: TrackingSettings) => {
  if (typeof document === 'undefined') return;
  injectFacebookPixel((s.facebook_pixel_id || '').trim());
  injectGtm((s.gtm_id || '').trim().toUpperCase());
  injectTikTokPixel((s.tiktok_pixel_id || '').trim().toUpperCase());
};

// Event helpers (checkout / add to cart e call korte paro)
export const trackEvent = (
  name: 'AddToCart' | 'InitiateCheckout' | 'Purchase' | 'ViewContent',
  data?: Record<string, unknown>
) => {
  const w = window as any;
  try {
    if (w.fbq) w.fbq('track', name, data);
    if (w.ttq) {
      const map: Record<string, string> = {
        AddToCart: 'AddToCart',
        InitiateCheckout: 'InitiateCheckout',
        Purchase: 'CompletePayment',
        ViewContent: 'ViewContent',
      };
      w.ttq.track(map[name], data);
    }
    if (w.dataLayer) w.dataLayer.push({ event: name, ...data });
  } catch {
    /* tracking error kokhono site bhangbe na */
  }
};

// Admin full snippet paste korleo ID ber kore ney; shudhu ID dilew cholbe.
export const extractTrackingId = (kind: 'fb' | 'gtm' | 'tiktok', raw: string): string => {
  const v = (raw || '').trim();
  if (!v) return '';
  if (kind === 'fb') {
    const m = v.match(/fbq\(\s*['"]init['"]\s*,\s*['"]?(\d{8,20})['"]?/i) || v.match(/\b(\d{8,20})\b/);
    return m ? m[1] : v;
  }
  if (kind === 'gtm') {
    const m = v.match(/GTM-[A-Z0-9]{4,10}/i);
    return m ? m[0].toUpperCase() : v.toUpperCase();
  }
  const m = v.match(/ttq\.load\(\s*['"]([A-Za-z0-9]{10,30})['"]/) || v.match(/sdkid=([A-Za-z0-9]{10,30})/);
  return m ? m[1].toUpperCase() : v.toUpperCase();
};