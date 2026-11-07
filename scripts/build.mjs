import { rmSync, cpSync, writeFileSync, mkdirSync } from 'node:fs';
import { makeConfig, configJs } from './config.mjs';

const c = makeConfig();
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
writeFileSync('dist/config.js', configJs(c));
if (c.mode === 'fixture') cpSync('fixtures', 'dist/fixtures', { recursive: true });
console.log(`Build xong -> dist/ (chế độ: ${c.mode})`);
