import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize } from '../public/js/data.js';
import { validate } from '../public/js/validate.js';
import { buildHistory } from '../public/js/history.js';

const load = () => normalize(JSON.parse(readFileSync(new URL('../fixtures/sample.json', import.meta.url), 'utf8')));
const TODAY = '2026-11-07';

test('dữ liệu mẫu vẫn sạch cảnh báo sau khi thêm lịch sử', () => {
  assert.deepEqual(validate(load()), []);
});

test('lịch sử Tất cả: khoản vay dựng ngược, thẻ lấy dư nợ kỳ đã ghi, mốc cuối = hôm nay', () => {
  const h = buildHistory(load(), 'Tất cả', TODAY);
  assert.deepEqual(h.points.map((p) => p.key), ['2026-08', '2026-09', '2026-10', '2026-11']);
  assert.deepEqual(h.points.map((p) => p.date), ['2026-08-31', '2026-09-30', '2026-10-31', TODAY]);
  const [aug, sep, oct, nov] = h.points;
  // Khoản vay: V04 chưa giải ngân ở cuối tháng 8
  assert.equal(aug.vay, 6000000);
  assert.equal(sep.vay, 7130000);
  assert.equal(oct.vay, 5060000);
  assert.equal(nov.vay, 5060000);
  // Thẻ: tháng 8 chưa có số nào -> null (không phải 0)
  assert.equal(aug.the, null);
  assert.equal(aug.total, null);
  assert.equal(sep.the, 2100000 + 4500000 + 7200000 + 1100000 + 520000);
  assert.equal(oct.the, 2400000 + 4800000 + 7600000 + 1180000 + 560000);
  assert.equal(nov.the, 3000000 + 5000000 + 8000000 + 1250000 + 600000); // dư nợ kỳ trong Sheet
  assert.equal(sep.total, 22550000);
  assert.equal(oct.total, 21600000);
  assert.equal(nov.total, 22910000); // khớp tổng dư nợ hiện tại ở màn Tổng quan (10.800.000 + 12.110.000)
  assert.equal(h.enough, true);
  assert.ok(h.warnings.some((w) => w.includes('Th8/26')));
});

test('tách người: Trang + Dũng = Tất cả ở mọi mốc có đủ số', () => {
  const d = load();
  const a = buildHistory(d, 'Tất cả', TODAY), t = buildHistory(d, 'Trang', TODAY), g = buildHistory(d, 'Dũng', TODAY);
  for (const k of [1, 2, 3]) assert.equal(t.points[k].total + g.points[k].total, a.points[k].total);
});

test('Nhật ký thiếu kỳ đã trả -> cảnh báo, dư nợ vay các mốc trước thấp hơn thực tế', () => {
  const d = load();
  d.nhatKy = d.nhatKy.filter((n) => !(n.ma === 'V01' && n.ngayGhi === '2026-09-10'));
  const h = buildHistory(d, 'Trang', TODAY);
  assert.ok(h.warnings.some((w) => w.startsWith('V01: Nhật ký mới có 2/3')));
});

test('khoản trả trạng thái khác "Đã trả" không bị cộng ngược', () => {
  const d = load();
  d.nhatKy.find((n) => n.ma === 'V03' && n.ngayGhi === '2026-10-20').trangThai = 'Hoãn';
  const h = buildHistory(d, 'Dũng', TODAY);
  const sepV03Less = buildHistory(load(), 'Dũng', TODAY).points[1].vay - 420000;
  assert.equal(h.points[1].vay, sepV03Less);
});

test('thiếu số thực tế bị bỏ qua; không có Nhật ký -> không đủ dữ liệu', () => {
  const d = load();
  d.nhatKy = [];
  const h = buildHistory(d, 'Tất cả', TODAY);
  assert.equal(h.enough, false);
  assert.deepEqual(h.points, []);
});

test('chỉ có thẻ hoặc chỉ có khoản vay: tổng không bị null vì phần không có', () => {
  const d = load();
  d.the = d.the.filter((t) => t.chu !== 'Trang'); // Trang không còn thẻ
  const h = buildHistory(d, 'Trang', TODAY);
  assert.equal(h.hasCards, false);
  const oct = h.points.find((p) => p.key === '2026-10');
  assert.equal(oct.the, null);
  assert.equal(oct.total, oct.vay);
});

test('giới hạn số tháng', () => {
  const h = buildHistory(load(), 'Tất cả', TODAY, 2);
  assert.deepEqual(h.points.map((p) => p.key), ['2026-10', '2026-11']);
});

import { toCsv, forecastRows, historyRows } from '../public/js/export.js';

test('CSV: BOM, dấu ; , trích dẫn, CRLF', () => {
  const t = toCsv([['a;b', 'c"d', 1], ['', null, 'x']]);
  assert.equal(t, '﻿"a;b";"c""d";1\r\n;;x\r\n');
});

test('CSV dự kiến: mọi số đều có nhãn; Tất cả xuất kèm từng người', () => {
  const d = load();
  const rows = forecastRows(d, 'Tất cả', TODAY);
  assert.equal(rows.length, 1 + 3 * 7);
  const trangNov = rows.find((r) => r[0] === 'Trang' && r[1] === '2026-11');
  assert.deepEqual(trangNov, ['Trang', '2026-11', 850000, 'Đã xác nhận', 3827600, 'Gồm ước tính', 4677600, 'Gồm ước tính']);
  const feb = rows.find((r) => r[0] === 'Tất cả' && r[1] === '2027-02');
  assert.equal(feb[2], ''); // không có khoản vay -> ô trống, không phải 0
  assert.equal(feb[5], 'Ước tính');
  assert.equal(forecastRows(d, 'Dũng', TODAY).length, 8);
});

test('CSV lịch sử: thiếu số -> ô trống không nhãn; số có nhãn', () => {
  const rows = historyRows(load(), 'Tất cả', TODAY);
  const aug = rows.find((r) => r[0] === 'Tất cả' && r[1] === '2026-08-31');
  assert.deepEqual(aug, ['Tất cả', '2026-08-31', 6000000, 'Ước tính', '', '', '', '']);
  const nov = rows.find((r) => r[0] === 'Tất cả' && r[1] === TODAY);
  assert.deepEqual(nov, ['Tất cả', TODAY, 5060000, 'Ước tính', 17850000, 'Đã xác nhận', 22910000, 'Gồm ước tính']);
});
