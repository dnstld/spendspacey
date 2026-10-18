import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Model only our exact paths/trailing splats. Pages matches the path, ignoring query
// parameters, combines matching custom rules, and otherwise revalidates static files.
// Hosted behavior still requires the separate PM delivery acceptance.
export function matchPagesHeaders(source: string, requestPath: string) {
  const pathname = new URL(requestPath, 'https://synthetic-app.pages.dev').pathname;
  const headers: Record<string, string> = {};
  let matches = false;
  for (const line of source.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (!line.startsWith(' ')) {
      matches = line.endsWith('*') ? pathname.startsWith(line.slice(0, -1)) : pathname === line;
    } else if (matches) {
      const colon = line.indexOf(':');
      const name = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
    }
  }
  return { 'cache-control': 'public, max-age=0, must-revalidate', ...headers };
}

export function pagesHeadersFor(buildDir: string, requestPath: string) {
  return matchPagesHeaders(readFileSync(resolve(buildDir, '_headers'), 'utf8'), requestPath);
}
