import { db, doc, getDoc } from './fb.js?v=20261003v';
/* site/hero: { type: 'image', data } or { type: 'video', mime, chunks } with heroChunks/0..n-1 = { d: base64 } */
export async function loadHero() {
  const s = await getDoc(doc(db, 'site', 'hero'));
  if (!s.exists()) return null;
  const h = s.data();
  if (h.type === 'image' && h.data) return { type: 'image', src: h.data };
  if (h.type === 'video' && h.chunks > 0) {
    const parts = await Promise.all(Array.from({ length: h.chunks }, (_, i) => getDoc(doc(db, 'heroChunks', String(i))).then(d => d.exists() ? d.data().d : '')));
    const bin = atob(parts.join('')), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return { type: 'video', src: URL.createObjectURL(new Blob([arr], { type: h.mime || 'video/mp4' })) };
  }
  return null;
}
