// Service worker: keeps the app shell on the phone so the scanner opens
// without a connection (trade-show Wi-Fi). Leads themselves live in
// IndexedDB and sync through teamSync.js; nothing here touches them.
//
// - Page loads: network first (to pick up new releases), falling back to
//   the cached page after NAV_TIMEOUT_MS or when offline.
// - /assets/*: content-hashed by Vite, so cache first.
// - Everything else (API, Supabase, other origins) is left to the network.

const CACHE = 'lead-scanner-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg'];
const NAV_TIMEOUT_MS = 3000;

// The hashed JS/CSS files referenced by a copy of index.html.
function assetsIn(html) {
  return [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
}

// Caches the page and its assets, and drops assets of older releases.
async function cacheRelease(cache, html) {
  const assets = assetsIn(html);
  await cache.addAll(assets);
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/assets/') && !assets.includes(path)) await cache.delete(request);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      const page = await cache.match('/');
      if (page) await cacheRelease(cache, await page.text());
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put('/', response.clone());
      cacheRelease(cache, await response.clone().text()).catch(() => {});
    }
    return response;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
  } catch {
    // Offline: fall through to the cached page.
  }
  return (await cache.match('/')) || network;
}

async function handleAsset(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
  } else if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith(handleAsset(request));
  }
});
