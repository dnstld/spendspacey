import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pagesHeadersFor } from '../test/pagesHeaders';

const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};
export async function pwaServer() {
  const state = { directory: 'dist', broken: false, requests: [] as string[], privateRequests: 0 };
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url!, 'http://localhost');
      const path = decodeURIComponent(url.pathname);
      state.requests.push(path + url.search);
      if (
        request.headers.authorization ||
        request.method !== 'GET' ||
        url.searchParams.has('private') ||
        /\/(api|auth\/v1|oauth|rest\/v1)\//.test(path)
      ) {
        state.privateRequests++;
        response.writeHead(200, { 'content-type': 'text/plain' }).end('synthetic-private-marker');
        return;
      }
      const file = path === '/' || path === '/auth/callback' ? 'index.html' : path.slice(1);
      if (file.includes('..')) {
        response.writeHead(400).end();
        return;
      }
      async function send(file: string, response: ServerResponse) {
        const bytes = await readFile(resolve(state.directory, file));
        const extension = file.slice(file.lastIndexOf('.'));
        response
          .writeHead(200, {
            'content-type': types[extension] ?? 'application/octet-stream',
            ...pagesHeadersFor(state.directory, path),
          })
          .end(bytes);
      }
      try {
        if (state.broken && /^assets\/index-.*\.js$/.test(file))
          throw new Error('Synthetic missing chunk');
        await send(file, response);
      } catch {
        // Native Pages fallback: missing chunks returning 200 HTML must be rejected.
        await send('index.html', response);
      }
    })().catch(() => {
      response.writeHead(500).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(5173, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP server');
  return {
    state,
    origin: `http://localhost:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
