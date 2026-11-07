// Đọc .env (và biến môi trường) -> cấu hình cho app. Dùng chung cho dev và build.
import { readFileSync, existsSync } from 'node:fs';

export function readEnv(file = '.env') {
  const env = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  for (const k of ['DATA_URL', 'DATA_KEY', 'DATA_MODE']) if (process.env[k]) env[k] = process.env[k];
  return env;
}

export function makeConfig() {
  const env = readEnv();
  const live = env.DATA_MODE === 'live' && env.DATA_URL;
  return { mode: live ? 'live' : 'fixture', dataUrl: live ? env.DATA_URL : '', dataKey: live ? env.DATA_KEY || '' : '' };
}

export const configJs = (c) => `window.APP_CONFIG=${JSON.stringify(c)};\n`;
