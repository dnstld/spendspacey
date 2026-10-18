import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Test harness for this file's exact paths and trailing splats, not a Pages emulator.
export function pagesHeadersFor(buildDir: string, pathname: string) {
  const headers: Record<string, string> = {};
  const source = readFileSync(resolve(buildDir, '_headers'), 'utf8');
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
  return headers;
}
