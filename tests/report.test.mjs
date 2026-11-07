import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize } from '../public/js/data.js';
import { buildReport, unitShares, addMonths, monthLabel, kindOf } from '../public/js/report.js';

const load = () => normalize(JSON.parse(readFileSync(new URL('../fixtures/sample.json', import.meta.url), 'utf8')));
const TODAY = '2026-11-07';

test('addMonths / monthLabel / kindOf', () => {
  assert.equal(addMonths('2026-11', 2), '2027-01');
  assert.equal(addMonths('2026-01', 12), '2027-01');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(monthLabel('2027-01'), 'Th1/27');
  assert.equal(kindOf(1, 0), 'confirmed');
  assert.equal(kindOf(0, 1), 'estimate');
  assert.equal(kindOf(1, 1), 'mixed');
  assert.equal(kindOf(0, 0), null);
});

test('báo cáo 7 tháng, tất cả: khoản vay theo lịch hợp đồng, thẻ kỳ này + ước tính các tháng sau', () => {
  const r = buildReport(load(), 'Tất cả', TODAY);
  assert.deepEqual(r.keys, ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05']);
  const [nov, dec, jan, feb] = r.months;
  // Tháng 11: 4 khoản vay; thẻ Toàn bộ (T01, T04, T05) = đã xác nhận; thẻ Đáo (T02, T03) = ước tính
  assert.equal(nov.vay, 500000 + 350000 + 420000 + 800000);
  assert.equal(nov.theOk, 3000000 + 1250000 + 600000);
  assert.equal(nov.theEst, 227600 + 240000);
  assert.equal(nov.total, 7387600);
  // Tháng 12: V02, V04 còn kỳ cuối; mọi thẻ chỉ là ước tính
  assert.equal(dec.vay, 2070000);
  assert.equal(dec.theOk, 0);
  assert.equal(dec.theEst, 3000000 + 227600 + 240000 + 1250000 + 600000);
  assert.equal(jan.vay, 500000 + 420000);
  assert.equal(feb.vay, 0);
  assert.equal(feb.theEst, 5317600);
  assert.equal(r.totals.all, r.months.reduce((a, m) => a + m.total, 0));
  assert.deepEqual(r.missing, []);
});

test('tách người: Trang + Dũng = Tất cả', () => {
  const d = load();
  const all = buildReport(d, 'Tất cả', TODAY), t = buildReport(d, 'Trang', TODAY), g = buildReport(d, 'Dũng', TODAY);
  assert.equal(t.months[0].vay, 850000);
  assert.equal(t.months[0].theOk, 3600000);
  assert.equal(t.months[0].theEst, 227600);
  assert.equal(t.totals.all + g.totals.all, all.totals.all);
  assert.deepEqual(all.months[0].byPerson, { Trang: t.months[0].total, Dũng: g.months[0].total });
});

test('thiếu dữ liệu -> bị loại và báo, không tính 0', () => {
  const d = load();
  d.khoanVay[0].hanKyKeTiep = null;
  d.the[1].duKien = null;
  const r = buildReport(d, 'Trang', TODAY);
  assert.equal(r.missing.length, 2);
  assert.equal(r.months[0].vay, 350000);
  assert.equal(r.months[0].theEst, 0);
});

test('thẻ có sao kê cũ: không tính là xác nhận, có ghi chú; hạn rơi sang tháng sau: tháng này chưa có số', () => {
  const d = load();
  d.the[0].hanThanhToan = '2026-10-09'; // T01 cũ
  d.the[1].hanThanhToan = '2026-12-09'; // T02 hạn tháng sau
  const r = buildReport(d, 'Trang', TODAY);
  assert.equal(r.months[0].theOk, 600000); // chỉ còn T05
  assert.ok(r.months[0].theEst >= 3000000); // T01 ước tính từ tháng này
  assert.equal(r.months[0].byUnit['Thẻ VIB'], undefined); // T02: tháng này chưa có số
  assert.equal(r.months[1].byUnit['Thẻ VIB'].est, 227600);
  assert.equal(r.notes.length, 2);
});

test('kỳ vay quá hạn từ trước tháng này đi vào "earlier", không vào biểu đồ', () => {
  const d = load();
  d.khoanVay[1].hanKyKeTiep = '2026-10-05'; // V02: kỳ 5 hạn tháng 10, kỳ 6 hạn tháng 11
  const r = buildReport(d, 'Trang', TODAY);
  assert.deepEqual(r.earlier, { amount: 350000, count: 1 });
  assert.equal(r.months[0].vay, 500000 + 350000);
});

test('unitShares: tháng này, gộp "Khác", tỷ lệ cộng đủ 100%', () => {
  const r = buildReport(load(), 'Tất cả', TODAY);
  const s = unitShares(r, 'month');
  assert.equal(s.total, 7387600);
  assert.equal(s.rows.length, 7); // 9 đơn vị -> 6 + Khác
  assert.equal(s.rows[0].name, 'Thẻ VPB');
  assert.ok(s.rows[6].other);
  assert.ok(Math.abs(s.rows.reduce((a, x) => a + x.pct, 0) - 1) < 1e-9);
  assert.equal(s.rows.find((x) => x.name === 'Thẻ VIB' || x.other).kind !== undefined, true);
  const all = unitShares(r, 'all');
  assert.equal(all.total, r.totals.all);
});
