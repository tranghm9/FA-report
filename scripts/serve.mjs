// Máy chủ thử nghiệm: phục vụ public/ + fixtures/ + config.js (từ .env). Chạy: npm run dev
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { makeConfig, configJs } from './config.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PORT = Number(process.env.PORT) || 8080;

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  if (p === '/config.js') { res.writeHead(200, { 'Content-Type': MIME['.js'] }); return res.end(configJs(makeConfig())); }
  const isFx = p.startsWith('/fixtures/');
  const base = isFx ? 'fixtures' : 'public';
  const file = normalize(join(base, isFx ? p.slice('/fixtures/'.length) : p));
  if (!file.startsWith(base + '/')) { res.writeHead(403); return res.end(); }
  try {
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('Không tìm thấy'); }
}).listen(PORT, () => console.log(`Mở http://localhost:${PORT}`));
