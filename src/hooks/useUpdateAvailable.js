import { useEffect, useState } from 'react';

const CHECK_INTERVAL_MS = 5 * 60_000;

// The hashed script of a copy of index.html, e.g. /assets/index-DURNsUOD.js.
// It changes with every release.
export function releaseScript(html) {
  return html.match(/<script[^>]+src="(\/assets\/[^"]+\.js)"/)?.[1] ?? null;
}

function runningScript() {
  return document.querySelector('script[type="module"][src^="/assets/"]')?.getAttribute('src');
}

// True once the server has a newer release than the one running. Phones keep
// the app open for days at a show, so they would otherwise never update.
export function useUpdateAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const current = runningScript();
    if (!import.meta.env.PROD || !current) return undefined;

    async function check() {
      if (!navigator.onLine || document.visibilityState !== 'visible') return;
      try {
        // /index.html (not /) so the service worker does not answer from its cache.
        const response = await fetch(`/index.html?check=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const latest = releaseScript(await response.text());
        if (latest && latest !== current) setAvailable(true);
      } catch {
        // Offline or server unreachable: try again later.
      }
    }

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
    };
  }, []);

  return available;
}
