// Service worker: lưu sẵn "khung" app để mở được khi mất mạng. Không lưu dữ liệu từ Google (dữ liệu được lưu riêng trên máy bởi app).
const CACHE = 'sono-__BUILD__';
const SHELL = ['__SHELL__']; // build.mjs thay bằng danh sách tệp thật

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('sono-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // dữ liệu Google đi thẳng ra mạng
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; } // mở ngay từ bản đã lưu, cập nhật ngầm cho lần sau
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
    return Response.error();
  })());
});
