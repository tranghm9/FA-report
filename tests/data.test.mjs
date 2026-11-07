import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize } from '../public/js/data.js';
import { validate, cardMode, expectedDao } from '../public/js/validate.js';
import { esc, filterPerson } from '../public/js/views.js';

const load = (n) => JSON.parse(readFileSync(new URL(`../fixtures/${n}.json`, import.meta.url), 'utf8'));

test('normalize: dữ liệu mẫu đọc đủ 4 tab + thông số', () => {
  const d = normalize(load('sample'));
  assert.equal(d.khoanVay.length, 4);
  assert.equal(d.the.length, 5);
  assert.equal(d.nhatKy.length, 18);
  assert.equal(d.linhHoat.length, 0);
  assert.deepEqual(d.params, { phiDao: 0.03, hanMucMucTieu: 200000, nhacTruocNgay: 3 });
  assert.equal(d.the[0].khaDung, null, 'ô trống phải là null, không phải 0');
  assert.equal(d.the[0].soCuoi, '0001');
  assert.equal(d.khoanVay[0].hanKyKeTiep, '2026-11-10');
});

test('normalize: chịu được chuỗi kiểu Sheet tiếng Việt và đổi thứ tự cột', () => {
  const raw = { tabs: { 'Thông số': { headers: [], rows: [['Phí đáo thẻ dùng làm ngân sách (%)', '3,0%']] },
    'Khoản vay': { headers: ['Số tiền / kỳ (VND)', 'Mã', 'Hạn kỳ kế tiếp'], rows: [['229.300', 'V09', '01/12/2026']] } } };
  const d = normalize(raw);
  assert.equal(d.params.phiDao, 0.03);
  assert.equal(d.khoanVay[0].soTienKy, 229300);
  assert.equal(d.khoanVay[0].hanKyKeTiep, '2026-12-01');
  assert.equal(d.khoanVay[0].tongSoKy, null);
  assert.ok(d.missingTabs.includes('Thẻ'));
  assert.ok(d.missingColumns.some((c) => c.tab === 'Khoản vay' && c.column === 'Chủ'));
});

test('normalize: phát hiện ô lỗi công thức, bỏ dòng trống', () => {
  const d = normalize({ tabs: { 'Khoản vay': { headers: ['Mã', 'Hạn kỳ kế tiếp'], rows: [['V1', '#REF!'], ['', ''], [null, null]] } } });
  assert.equal(d.khoanVay.length, 1);
  assert.equal(d.cellErrors.length, 1);
  assert.ok(validate(d).some((w) => w.msg.includes('Ô lỗi')));
});

test('normalize: từ chối dữ liệu sai định dạng', () => {
  assert.throws(() => normalize({}), /định dạng/);
  assert.throws(() => normalize(null));
});

test('cardMode & công thức đáo', () => {
  assert.equal(cardMode('Toàn bộ'), 'toan_bo');
  assert.equal(cardMode('Đáo'), 'dao');
  assert.equal(cardMode('khác'), null);
  const p = { phiDao: 0.03, hanMucMucTieu: 200000 };
  const e = expectedDao({ duNoKy: 5000000, khaDung: 120000 }, p);
  assert.equal(e.soNap, 80000);
  assert.equal(Math.round(e.phi), 147600);
  assert.equal(Math.round(e.tong), 227600);
  assert.equal(expectedDao({ duNoKy: 5000000, khaDung: 500000 }, p).soNap, 0, 'đã đạt mục tiêu -> không nạp');
  assert.equal(expectedDao({ duNoKy: 5000000, khaDung: null }, p), null, 'thiếu khả dụng -> không tự tính');
});

test('validate: dữ liệu mẫu sạch không có cảnh báo', () => {
  assert.deepEqual(validate(normalize(load('sample'))), []);
});

test('validate: dữ liệu mâu thuẫn bị báo, không bị bỏ qua', () => {
  const w = validate(normalize(load('sample-conflict')));
  assert.equal(w.length, 4);
  assert.ok(w.some((x) => x.msg.startsWith('V03')));
  assert.ok(w.some((x) => x.msg.startsWith('T03') && x.msg.includes('lệch công thức')));
  assert.ok(w.some((x) => x.msg.startsWith('T04') && x.msg.includes('hạn mức')));
  assert.ok(w.some((x) => x.msg.startsWith('T04') && x.msg.includes('Toàn bộ')));
});

test('validate: mã trùng, chủ lạ, Đã trả thiếu số thực tế', () => {
  const d = normalize({ tabs: {
    'Khoản vay': { headers: ['Mã', 'Chủ'], rows: [['X1', 'Trang'], ['X1', 'Ai đó']] },
    'Nhật ký': { headers: ['Ngày ghi', 'Mã', 'Trạng thái', 'Thực tế (VND)'], rows: [['2026-11-01', 'X1', 'Đã trả', '']] } } });
  const msgs = validate(d).map((w) => w.msg).join('\n');
  assert.match(msgs, /xuất hiện hai lần/);
  assert.match(msgs, /không phải Trang hoặc Dũng/);
  assert.match(msgs, /thiếu số thực tế/);
});

test('views: esc chống chèn HTML; filterPerson tách Trang/Dũng', () => {
  assert.equal(esc('<img src=x onerror=1>'), '&lt;img src=x onerror=1&gt;');
  const d = normalize(load('sample'));
  assert.equal(filterPerson(d.khoanVay, 'Trang').length, 2);
  assert.equal(filterPerson(d.khoanVay, 'Dũng').length, 2);
  assert.equal(filterPerson(d.khoanVay, 'Tất cả').length, 4);
});
