import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStored, writeStored, clearStored, readLast, writeLast, clearLast, resolveConfig, checkDataUrl } from '../public/js/settings.js';

const fake = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('resolveConfig: cấu hình trên máy > .env > dữ liệu mẫu', () => {
  assert.equal(resolveConfig(undefined, null).mode, 'fixture');
  assert.equal(resolveConfig({ mode: 'fixture' }, null).source, 'demo');
  const env = { mode: 'live', dataUrl: 'https://e/x', dataKey: 'k1' };
  assert.deepEqual(resolveConfig(env, null), { ...env, source: 'env' });
  const r = resolveConfig(env, { dataUrl: 'https://d/y', dataKey: 'k2' });
  assert.equal(r.source, 'device'); assert.equal(r.dataUrl, 'https://d/y'); assert.equal(r.dataKey, 'k2');
  assert.equal(resolveConfig({ mode: 'live', dataUrl: '' }, null).mode, 'fixture');
});

test('lưu/đọc/xóa cấu hình và bản sao dữ liệu', () => {
  const s = fake();
  assert.equal(readStored(s), null);
  assert.equal(writeStored({ dataUrl: 'https://a/b', dataKey: 'k' }, s), true);
  assert.deepEqual(readStored(s), { dataUrl: 'https://a/b', dataKey: 'k' });
  clearStored(s); assert.equal(readStored(s), null);
  writeLast({ tabs: {} }, s, new Date('2026-11-07T01:02:03Z'));
  assert.equal(readLast(s).savedAt, '2026-11-07T01:02:03.000Z');
  clearLast(s); assert.equal(readLast(s), null);
});

test('localStorage hỏng/không có -> không văng lỗi', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.equal(readStored(broken), null);
  assert.equal(writeStored({ dataUrl: 'https://a', dataKey: 'k' }, broken), false);
  assert.doesNotThrow(() => clearStored(broken));
  assert.equal(readLast({ getItem: () => '{hỏng' }), null);
});

test('checkDataUrl', () => {
  assert.equal(checkDataUrl('https://script.google.com/macros/s/AKfy/exec'), null);
  assert.match(checkDataUrl('abc'), /chưa đúng/);
  assert.match(checkDataUrl('http://script.google.com/x'), /https/);
  assert.match(checkDataUrl(''), /chưa đúng/);
  assert.match(checkDataUrl('https://docs.google.com/spreadsheets/d/abc/edit'), /Google Sheet, không phải/);
  assert.match(checkDataUrl('https://script.google.com/macros/s/AKfy/edit'), /\/exec/);
  assert.equal(checkDataUrl('https://script.google.com/macros/s/AKfy/exec'), null);
});

import { readTheme, writeTheme, applyTheme, THEME_COLOR } from '../public/js/settings.js';

test('giao diện: mặc định theo điện thoại; chỉ nhận giá trị hợp lệ', () => {
  const s = fake();
  assert.equal(readTheme(s), 'system');
  assert.equal(writeTheme('dark', s), true);
  assert.equal(readTheme(s), 'dark');
  assert.equal(writeTheme('xanh', s), false);
  assert.equal(readTheme(s), 'dark');
  s.setItem('sono.theme', '"lạ"'); assert.equal(readTheme(s), 'system');
});

test('applyTheme: Sáng/Tối đè lên điện thoại; Theo điện thoại gỡ đúng phần app đã gắn', () => {
  const root = { dataset: {} }; const meta = { c: '', setAttribute(_, v) { this.c = v; } };
  assert.equal(applyTheme('dark', { root, meta, prefersDark: false }), 'dark');
  assert.equal(root.dataset.theme, 'dark'); assert.equal(meta.c, THEME_COLOR.dark);
  assert.equal(applyTheme('light', { root, meta, prefersDark: true }), 'light'); // điện thoại tối nhưng chọn sáng
  assert.equal(root.dataset.theme, 'light'); assert.equal(meta.c, THEME_COLOR.light);
  assert.equal(applyTheme('system', { root, meta, prefersDark: true }), 'dark');
  assert.equal(root.dataset.theme, undefined); assert.equal(meta.c, THEME_COLOR.dark);
  const host = { dataset: { theme: 'dark' } }; // thuộc tính do nơi khác gắn: không đụng tới
  applyTheme('system', { root: host });
  assert.equal(host.dataset.theme, 'dark');
});
