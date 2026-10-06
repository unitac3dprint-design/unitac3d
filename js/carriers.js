/* parcel carriers: official tracking pages + 17TRACK (fills the number in automatically) */
export const CARRIERS = {
  flash: { name: 'Flash Express', url: (n) => 'https://www.flashexpress.co.th/fle/tracking?se=' + encodeURIComponent(n) },
  thp: { name: 'ไปรษณีย์ไทย', url: (n) => 'https://track.thailandpost.co.th/?trackNumber=' + encodeURIComponent(n) },
  kex: { name: 'KEX Express', url: (n) => 'https://th.kerryexpress.com/th/track/?track=' + encodeURIComponent(n) },
  jt: { name: 'J&T Express', url: () => 'https://www.jtexpress.co.th/service/track' },
  other: { name: 'ขนส่งอื่น', url: null }
};
export const track17 = (n) => 'https://t.17track.net/th#nums=' + encodeURIComponent(n);
export function trackPage(n, c) { return new URL('track.html?n=' + encodeURIComponent(n) + '&c=' + encodeURIComponent(c || 'flash'), location.href).href; }
export function cleanTrack(s) { return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30); }

/* our own tracking timeline is paused for now: links go straight to the courier's site */
export const TRACK_PAGE_ON = false;
export function trackLink(n, c) {
  if (TRACK_PAGE_ON) return trackPage(n, c);
  const k = CARRIERS[c] && CARRIERS[c].url ? c : 'flash';
  return CARRIERS[k].url ? CARRIERS[k].url(n) : track17(n);
}
