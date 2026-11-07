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
});
