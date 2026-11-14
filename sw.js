// Paper Passer service worker: network first, falls back to what was cached, so the game works offline after one visit
// and a changed index.html is never stale while online.
const CACHE = 'paper-passer-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (r.headers.has('range')) { e.respondWith(fetch(r).catch(() => cachedRange(r))); return; }   // (audio range requests: network, else sliced from the cache so offline audio never stalls)
  e.respondWith(fetch(r).then(res => {
    if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
async function cachedRange(r) {   // a 206 built from the cached whole file
  const m = await caches.match(r.url, { ignoreSearch: true });
  if (!m) return Response.error();
  const buf = await m.arrayBuffer(), mt = /bytes=(\d*)-(\d*)/.exec(r.headers.get('range') || '') || [];
  const a = mt[1] ? +mt[1] : 0, b = mt[2] ? Math.min(+mt[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(a, b + 1), { status: 206, headers: { 'Content-Type': m.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${a}-${b}/${buf.byteLength}`, 'Content-Length': String(b - a + 1), 'Accept-Ranges': 'bytes' } });
}
