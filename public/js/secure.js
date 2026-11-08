// Khóa ứng dụng bằng mã PIN (tùy chọn). Khi bật: địa chỉ + khóa Google Sheet và bản dữ liệu lưu trên máy được MÃ HÓA
// (AES-GCM 256-bit, khóa sinh từ PIN bằng PBKDF2-SHA256 200.000 vòng). Khi chưa mở khóa, trong bộ nhớ không có dữ liệu nào.
// Giới hạn: PIN 6-12 chữ số chỉ chống được người cầm máy xem lén/lục thông thường, không chống được kẻ tấn công chuyên nghiệp
// có bản sao bộ nhớ trình duyệt và đủ thời gian đoán PIN.
import { readStored, writeStored, clearStored, readLast, writeLast, clearLast } from './settings.js';

const VAULT_KEY = 'sono.vault';
const ITER = 200000;
export const PIN_RE = /^\d{6,12}$/;

const te = new TextEncoder(), td = new TextDecoder();
const b64 = (buf) => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin, salt, iter) {
  const base = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
  return { iv: b64(iv), data: b64(ct) };
}
const open = async (key, rec) => JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, key, unb64(rec.data))));

export function createSecure(storage) {
  const st = () => storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  let key = null;
  let mirror = null; // { cfg, last } chỉ tồn tại trong bộ nhớ khi đã mở khóa
  const rec = () => { try { const v = st()?.getItem(VAULT_KEY); return v ? JSON.parse(v) : null; } catch { return null; } };
  const put = (r) => { try { st().setItem(VAULT_KEY, JSON.stringify(r)); return true; } catch { return false; } };
  const persist = async () => put({ ...rec(), ...(await seal(key, mirror)) });
  const unlocked = () => api.enabled && !!key;

  const api = {
    get enabled() { return !!rec(); },
    get locked() { return !!rec() && !key; },

    // Truy cập cấu hình/bản sao dữ liệu: dùng chỗ lưu thường khi chưa bật khóa, dùng bản trong bộ nhớ khi đã mở khóa.
    getCfg() { return api.enabled ? (unlocked() ? mirror.cfg : null) : readStored(storage); },
    getLast() { return api.enabled ? (unlocked() ? mirror.last : null) : readLast(storage); },
    async setCfg(cfg) {
      if (!api.enabled) return writeStored(cfg, storage);
      if (!unlocked()) return false;
      mirror.cfg = { dataUrl: cfg.dataUrl, dataKey: cfg.dataKey };
      return persist();
    },
    async setLast(raw) {
      if (!api.enabled) return writeLast(raw, storage);
      if (!unlocked()) return false;
      mirror.last = { savedAt: new Date().toISOString(), raw };
      return persist();
    },
    async clearCfg() { if (!api.enabled) return clearStored(storage); if (unlocked()) { mirror.cfg = null; await persist(); } },
    async clearLast() { if (!api.enabled) return clearLast(storage); if (unlocked()) { mirror.last = null; await persist(); } },

    async enable(pin) {
      if (!PIN_RE.test(pin)) throw new Error('Mã PIN gồm 6 đến 12 chữ số.');
      if (api.enabled) throw new Error('Đã bật khóa.');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const k = await derive(pin, salt, ITER);
      const m = { cfg: readStored(storage), last: readLast(storage) }; // chuyển dữ liệu đang lưu rõ vào kho mã hóa
      if (!put({ v: 1, salt: b64(salt), iter: ITER, ...(await seal(k, m)) })) throw new Error('Không lưu được trên thiết bị này.');
      clearStored(storage); clearLast(storage); // xóa bản không mã hóa
      key = k; mirror = m;
    },
    /** Trả về nội dung nếu đúng PIN, null nếu sai. */
    async verify(pin) {
      const r = rec();
      if (!r || !PIN_RE.test(String(pin))) return null;
      try { return await open(await derive(pin, unb64(r.salt), r.iter), r); } catch { return null; }
    },
    async unlock(pin) {
      const r = rec();
      if (!r || !PIN_RE.test(String(pin))) return false;
      try { const k = await derive(pin, unb64(r.salt), r.iter); mirror = await open(k, r); key = k; return true; } catch { return false; }
    },
    lock() { key = null; mirror = null; },
    /** Tắt khóa (phải đúng PIN): đưa dữ liệu về lại chỗ lưu thường. */
    async disable(pin) {
      const m = await api.verify(pin);
      if (!m) return false;
      try { st().removeItem(VAULT_KEY); } catch { return false; }
      if (m.cfg) writeStored(m.cfg, storage);
      if (m.last) writeLast(m.last.raw, storage, new Date(m.last.savedAt));
      key = null; mirror = null;
      return true;
    },
    /** Quên PIN: xóa sạch mọi dữ liệu trên máy này (phải nhập lại địa chỉ + khóa). */
    wipe() { try { st()?.removeItem(VAULT_KEY); } catch { /* bỏ qua */ } clearStored(storage); clearLast(storage); key = null; mirror = null; },
  };
  return api;
}
