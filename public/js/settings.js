// Cấu hình nguồn dữ liệu lưu trên chính thiết bị (localStorage), để bản đã đưa lên mạng KHÔNG chứa địa chỉ/khóa.
// Thứ tự ưu tiên: cấu hình trên máy > .env lúc build/dev (window.APP_CONFIG) > dữ liệu mẫu.
const CFG_KEY = 'sono.cfg';
const LAST_KEY = 'sono.last';

const store = (s) => s ?? (typeof localStorage !== 'undefined' ? localStorage : null);
function get(key, s) { try { const v = store(s)?.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
function set(key, val, s) { try { store(s).setItem(key, JSON.stringify(val)); return true; } catch { return false; } }
function del(key, s) { try { store(s)?.removeItem(key); } catch { /* bỏ qua */ } }

export const readStored = (s) => get(CFG_KEY, s);
export const writeStored = (cfg, s) => set(CFG_KEY, { dataUrl: cfg.dataUrl, dataKey: cfg.dataKey }, s);
export const clearStored = (s) => del(CFG_KEY, s);
export const readLast = (s) => get(LAST_KEY, s);
export const writeLast = (raw, s, now = new Date()) => set(LAST_KEY, { savedAt: now.toISOString(), raw }, s);
export const clearLast = (s) => del(LAST_KEY, s);

export function resolveConfig(env, stored) {
  if (stored?.dataUrl) return { mode: 'live', dataUrl: stored.dataUrl, dataKey: stored.dataKey || '', source: 'device' };
  if (env?.mode === 'live' && env.dataUrl) return { ...env, source: 'env' };
  return { mode: 'fixture', dataUrl: '', dataKey: '', source: 'demo' };
}

/** null nếu hợp lệ, ngược lại là câu báo lỗi tiếng Việt. */
export function checkDataUrl(v) {
  let u;
  try { u = new URL(String(v ?? '').trim()); } catch { return 'Địa chỉ chưa đúng. Hãy dán nguyên địa chỉ "Ứng dụng web" từ Apps Script.'; }
  if (u.protocol !== 'https:') return 'Địa chỉ phải bắt đầu bằng https://';
  return null;
}

// ---- Giao diện sáng/tối do người dùng chọn: 'system' (theo điện thoại) | 'light' | 'dark'
const THEME_KEY = 'sono.theme';
export const THEMES = ['system', 'light', 'dark'];
export const THEME_COLOR = { light: '#fbc9db', dark: '#1f1419' }; // màu thanh trạng thái trình duyệt

export function readTheme(s) {
  const v = get(THEME_KEY, s);
  return THEMES.includes(v) ? v : 'system';
}
export const writeTheme = (mode, s) => THEMES.includes(mode) && set(THEME_KEY, mode, s);

/**
 * Áp dụng giao diện: 'light'/'dark' gắn data-theme lên <html> (đè lên cài đặt điện thoại);
 * 'system' chỉ gỡ cái do chính app đã gắn (CSS tự theo prefers-color-scheme). Trả về giao diện đang hiển thị.
 */
export function applyTheme(mode, { root, meta, prefersDark = false } = {}) {
  const effective = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
  if (root) {
    if (mode === 'system') { if (root.dataset.sonoTheme) { delete root.dataset.theme; delete root.dataset.sonoTheme; } }
    else { root.dataset.theme = mode; root.dataset.sonoTheme = '1'; }
  }
  if (meta) meta.setAttribute('content', THEME_COLOR[effective]);
  return effective;
}
