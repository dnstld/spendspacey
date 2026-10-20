export function staticPath(path: string): boolean {
  return (
    /^\/assets\/[\w.-]+-[\w-]{8,}\.(js|css)$/.test(path) ||
    [
      '/',
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
export function mimeFor(path: string): string {
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.webmanifest')) return 'application/manifest+json';
  return path === '/' ? 'text/html' : '';
}
// Match only the application's existing callback route semantics: case-insensitive,
// trailing slashes and decoded path segments. Encoded separators do not add routes.
// This is not a cache URL/key expansion; callback URLs are never stored.
export function callbackPath(path: string): boolean {
  try {
    return /^\/auth\/callback\/*$/i.test(
      path
        .split('/')
        .map((segment) => decodeURIComponent(segment).replace(/\//g, '%2F'))
        .join('/'),
    );
  } catch {
    return false;
  }
}
export function routeRequest(request: Request, origin: string, approved: Set<string>) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== origin || request.headers.has('authorization'))
    return 'network';
  if (request.mode === 'navigate' && callbackPath(url.pathname)) return 'callback';
  if (url.search || url.hash) return 'network';
  if (request.mode === 'navigate' && url.pathname === '/') return 'shell';
  return staticPath(url.pathname) && approved.has(url.href) ? 'static' : 'network';
}
export function validStaticResponse(path: string, response: Response): boolean {
  return (
    response.status === 200 &&
    !response.redirected &&
    !['opaque', 'opaqueredirect', 'error'].includes(response.type) &&
    response.headers.get('content-type')?.split(';')[0].trim() === mimeFor(path)
  );
}
