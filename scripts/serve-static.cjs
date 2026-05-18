const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const OUT_DIR = path.join(__dirname, '..', 'out');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join('; '),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '0',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const server = http.createServer((req, res) => {
  let pathname = req.url.split('?')[0];
  if (pathname.endsWith('/')) pathname = path.join(pathname, 'index.html');
  let filePath = path.join(OUT_DIR, pathname === '/' ? 'index.html' : pathname);
  const tryHtml = () => path.join(OUT_DIR, 'index.html');

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      const html = tryHtml();
      fs.readFile(html, (e2, data) => {
        if (e2) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store',
          ...securityHeaders,
        });
        res.end(data);
      });
      return;
    }

    fs.readFile(filePath, (er, data) => {
      if (er) {
        res.writeHead(500);
        res.end('Server Error');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      let contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const isStaticNext =
        req.url.includes('/_next/static/');
      const isWasm = ext === '.wasm';
      const isJsWorker =
        req.url.endsWith('.js') &&
        (req.url.includes('wasm_exec') ||
          req.url.includes('pdf-worker'));

      let cache = 'no-store';
      if (isStaticNext) {
        cache = 'public, max-age=31536000, immutable';
      } else if (isWasm || isJsWorker) {
        contentType = isWasm ? 'application/wasm' : contentType;
        cache = 'public, max-age=86400, stale-while-revalidate=604800';
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': cache,
        ...securityHeaders,
      });
      res.end(data);
    });
  });
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

server.listen(PORT, () => {
  console.log(`Static server at http://localhost:${PORT}`);
  console.log(`Serving: ${OUT_DIR}`);
});
