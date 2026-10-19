export const CACHE_PREFIX = 'spendspacey-static-';
export const CACHE_POLICY = 'v1';

export function staticPath(path: string): boolean {
  return (
    /^\/assets\/[\w.-]+-[\w-]{8,}\.(js|css)$/.test(path) ||
    [
      '/index.html',
      '/manifest.webmanifest',
      '/google-g.png',
      '/fonts/google-sans-medium.woff2',
      '/icons/app-192.png',
      '/icons/app-512.png',
      '/icons/maskable-512.png',
      '/icons/apple-touch-icon.png',
    ].includes(path)
  );
}

export function routeRequest(request: Request, origin: string, approved: Set<string>) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== origin || request.headers.has('authorization'))
    return 'network';
  if (request.mode === 'navigate' && url.pathname === '/auth/callback') return 'callback';
  if (url.search) return 'network';
  if (request.mode === 'navigate' && url.pathname === '/') return 'shell';
  return staticPath(url.pathname) && approved.has(url.href) ? 'static' : 'network';
}

export function validStaticResponse(path: string, response: Response): boolean {
  if (response.status !== 200 || response.redirected) return false;
  const type = response.headers.get('content-type')?.split(';')[0].trim();
  if (path.endsWith('.js')) return /^(application|text)\/javascript$/.test(type ?? '');
  if (path.endsWith('.css')) return type === 'text/css';
  if (path.endsWith('.png')) return type === 'image/png';
  if (path.endsWith('.woff2')) return type === 'font/woff2';
  if (path.endsWith('.webmanifest')) return type === 'application/manifest+json';
  return path === '/index.html' && type === 'text/html';
}
