/* Service Worker do Leitor SAEC — estratégia Cache First (cache primeiro, rede depois).
 * Ao publicar uma nova versão do app, aumente CACHE_VERSION para renovar o cache. */
const CACHE_VERSION = 'v1';
const CACHE = 'leitor-saec-' + CACHE_VERSION;

// Precisa ser IDÊNTICA à OPENCV_URL do index.html
const OPENCV_URL = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.2/dist/opencv.js';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

// INSTALL: guarda o app e, principalmente, o OpenCV.js do CDN.
// Se o download do OpenCV falhar, a instalação falha e o navegador tenta de novo depois,
// evitando um app "instalado" que não funciona offline.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL);

    const res = await fetch(OPENCV_URL, { mode: 'cors', cache: 'reload' });
    if (!res.ok) throw new Error('Falha ao baixar o OpenCV.js (HTTP ' + res.status + ')');
    await cache.put(OPENCV_URL, res);

    await self.skipWaiting();
  })());
});

// ACTIVATE: remove caches de versões antigas e assume o controle das abas abertas.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n.startsWith('leitor-saec-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// FETCH: cache primeiro; se não houver, rede (e guarda a resposta para a próxima vez).
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

  event.respondWith((async () => {
    const emCache = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (emCache) return emCache;   // inclui o OpenCV.js do CDN, mesmo sem internet

    try {
      const res = await fetch(req);
      const mesmaOrigem = new URL(req.url).origin === self.location.origin;
      if (res.ok && (mesmaOrigem || req.url === OPENCV_URL)) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      // Offline e fora do cache: para navegação, devolve o app; no resto, falha normalmente.
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
