import { rmSync, cpSync, writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { makeConfig, configJs } from './config.mjs';

const walk = (dir, base = dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p, base) : [p.slice(base.length + 1)];
});

const c = makeConfig();
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
writeFileSync('dist/config.js', configJs(c));
if (c.mode === 'fixture') cpSync('fixtures', 'dist/fixtures', { recursive: true });

// Service worker: gắn danh sách tệp và mã phiên bản (đổi khi nội dung đổi -> máy người dùng tự cập nhật)
const files = walk('dist').filter((f) => f !== 'sw.js').sort();
const h = createHash('sha1');
for (const f of files) h.update(f).update(readFileSync(join('dist', f)));
const sw = readFileSync('dist/sw.js', 'utf8').replace('__BUILD__', h.digest('hex').slice(0, 10)).replace("['__SHELL__']", JSON.stringify(['./', ...files]));
writeFileSync('dist/sw.js', sw);
console.log(`Build xong -> dist/ (chế độ: ${c.mode}, ${files.length} tệp)`);
