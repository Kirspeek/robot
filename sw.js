// Робот против людей: keeps the game on the device, so single play works without internet.
// The page itself is fetched fresh when there is a connection (to get updates) and taken from the cache when there is not.
const CACHE = 'robot-v4';
const CORE = ['./', 'index.html', 'i18n.js', 'manifest.webmanifest', 'vendor/three.min.js', 'vendor/peerjs.min.js', 'vendor/mqtt.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.pathname.endsWith('/api/info') || url.pathname.endsWith('version.json')) return;   // never cached                       // the local game server: never cached
  const page = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if(url.origin === location.origin && page){
    // the game page: network first, the cache when offline
    e.respondWith(fetch(req, {cache:'no-store'}).then(r => { if(r.ok){ const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); } return r; })
      .catch(() => caches.match('index.html').then(r => r || caches.match('./'))));
    return;
  }
  if(url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    // files and fonts: from the cache, refreshed in the background
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { if(r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  }
});
