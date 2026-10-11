import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Same-origin download bridge for embedded previews. Browsers often block
 * blob: downloads inside sandboxed iframes, while a normal HTTP response with
 * Content-Disposition is allowed. Files live in memory for five minutes. */
function pdfDownloadBridge(): Plugin {
  const files = new Map<string, { data: Buffer; name: string; expires: number }>();
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/__pdf_download') {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size <= 50 * 1024 * 1024) chunks.push(chunk);
      });
      req.on('end', () => {
        if (!size || size > 50 * 1024 * 1024) {
          res.statusCode = 413;
          res.end('Invalid PDF size');
          return;
        }
        const id = randomUUID();
        const raw = req.headers['x-pdf-filename'];
        const name = decodeURIComponent(Array.isArray(raw) ? raw[0] : raw ?? 'document.pdf').replace(/[^a-zA-Z0-9._ -]/g, '-');
        files.set(id, { data: Buffer.concat(chunks), name, expires: Date.now() + 5 * 60_000 });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ url: `/__pdf_download/${id}` }));
      });
      return;
    }
    const match = /^\/__pdf_download\/([a-f0-9-]+)$/.exec(url.pathname);
    if (req.method === 'GET' && match) {
      const file = files.get(match[1]);
      if (!file || file.expires < Date.now()) {
        files.delete(match[1]);
        res.statusCode = 404;
        res.end('Download expired');
        return;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', file.data.length);
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.end(file.data);
      return;
    }
    next();
  };
  return {
    name: 'pdf-download-bridge',
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}

export default defineConfig({
  // PDF compiler files also run inside a Web Worker, where React Fast Refresh cannot run.
  plugins: [react({ exclude: /src\/pdf\// }), pdfDownloadBridge()],
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { chunkSizeWarningLimit: 4000 },
});
