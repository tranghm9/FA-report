import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSecure } from '../public/js/secure.js';
import { writeStored, readStored, writeLast, readLast } from '../public/js/settings.js';

const fake = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const CFG = { dataUrl: 'https://script.google.com/macros/s/AKfyBI-DU-LIEU-RIENG/exec', dataKey: 'khoa-bi-mat-rat-dai-123' };
const RAW = { tabs: { 'Khoản vay': { headers: ['Mã'], rows: [['V99-SO-LIEU-RIENG']] } } };
const all = (s) => JSON.stringify([...s.m.entries()]);

test('chưa bật khóa: hoạt động như cũ (lưu thường)', async () => {
  const s = fake(), sec = createSecure(s);
  assert.equal(sec.enabled, false);
  await sec.setCfg(CFG);
  assert.deepEqual(sec.getCfg(), CFG);
  assert.deepEqual(readStored(s), CFG);
});

test('bật khóa: dữ liệu rõ bị xóa, kho mã hóa không lộ nội dung', async () => {
  const s = fake(), sec = createSecure(s);
  writeStored(CFG, s); writeLast(RAW, s);
  await sec.enable('123456');
  assert.equal(sec.enabled, true); assert.equal(sec.locked, false);
  assert.equal(readStored(s), null); assert.equal(readLast(s), null); // không còn bản rõ
  const blob = all(s);
  for (const secret of ['AKfyBI-DU-LIEU-RIENG', 'khoa-bi-mat-rat-dai-123', 'V99-SO-LIEU-RIENG', 'script.google.com']) assert.ok(!blob.includes(secret), `lộ: ${secret}`);
  assert.deepEqual(sec.getCfg(), CFG);
  assert.equal(sec.getLast().raw.tabs['Khoản vay'].rows[0][0], 'V99-SO-LIEU-RIENG');
});

test('khóa lại: trong bộ nhớ không còn gì; sai PIN không mở được; đúng PIN mở được', async () => {
  const s = fake(), sec = createSecure(s);
  writeStored(CFG, s);
  await sec.enable('123456');
  sec.lock();
  assert.equal(sec.locked, true); assert.equal(sec.getCfg(), null); assert.equal(sec.getLast(), null);
  assert.equal(await sec.unlock('654321'), false); assert.equal(sec.locked, true);
  assert.equal(await sec.unlock('abc'), false);
  assert.equal(await sec.unlock('123456'), true);
  assert.deepEqual(sec.getCfg(), CFG);
  // phiên mới (như tải lại trang): vẫn bị khóa, mở được bằng PIN
  const sec2 = createSecure(s);
  assert.equal(sec2.locked, true);
  assert.equal(await sec2.unlock('123456'), true);
  assert.deepEqual(sec2.getCfg(), CFG);
});

test('ghi dữ liệu khi đã khóa bị từ chối; khi đã mở thì được mã hóa và nhớ qua phiên', async () => {
  const s = fake(), sec = createSecure(s);
  await sec.enable('123456');
  await sec.setLast(RAW); await sec.setCfg(CFG);
  assert.ok(!all(s).includes('V99-SO-LIEU-RIENG'));
  sec.lock();
  assert.equal(await sec.setCfg({ dataUrl: 'https://x', dataKey: 'y' }), false);
  const sec2 = createSecure(s); await sec2.unlock('123456');
  assert.deepEqual(sec2.getCfg(), CFG);
  assert.ok(sec2.getLast().savedAt);
  await sec2.clearLast(); assert.equal(sec2.getLast(), null);
});

test('PIN không hợp lệ bị từ chối khi bật', async () => {
  const sec = createSecure(fake());
  await assert.rejects(sec.enable('12345'), /6 đến 12/);
  await assert.rejects(sec.enable('12ab56'), /6 đến 12/);
  await assert.rejects(sec.enable('1'.repeat(13)), /6 đến 12/);
});

test('tắt khóa cần đúng PIN và trả dữ liệu về chỗ lưu thường', async () => {
  const s = fake(), sec = createSecure(s);
  writeStored(CFG, s); writeLast(RAW, s);
  await sec.enable('123456');
  assert.equal(await sec.disable('000000'), false); assert.equal(sec.enabled, true);
  assert.equal(await sec.disable('123456'), true);
  assert.equal(sec.enabled, false);
  assert.deepEqual(readStored(s), CFG); assert.equal(readLast(s).raw.tabs['Khoản vay'].rows[0][0], 'V99-SO-LIEU-RIENG');
});

test('quên PIN: xóa sạch mọi thứ', async () => {
  const s = fake(), sec = createSecure(s);
  writeStored(CFG, s);
  await sec.enable('123456'); sec.lock();
  sec.wipe();
  assert.equal(sec.enabled, false); assert.equal(sec.getCfg(), null);
  assert.equal(all(s), '[]');
});

test('dữ liệu mã hóa bị sửa -> không mở được (chống giả mạo)', async () => {
  const s = fake(), sec = createSecure(s);
  await sec.enable('123456'); sec.lock();
  const r = JSON.parse(s.getItem('sono.vault')); r.data = r.data.slice(0, -4) + 'AAAA';
  s.setItem('sono.vault', JSON.stringify(r));
  assert.equal(await sec.unlock('123456'), false);
});
