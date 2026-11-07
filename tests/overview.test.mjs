import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize } from '../public/js/data.js';
import { debtSummary, dueItems, upcoming, overdueUnlogged, daysBetween, todayLocal } from '../public/js/overview.js';

const load = (n) => normalize(JSON.parse(readFileSync(new URL(`../fixtures/${n}.json`, import.meta.url), 'utf8')));
const TODAY = '2026-11-07';

test('daysBetween & todayLocal', () => {
  assert.equal(daysBetween('2026-11-07', '2026-11-14'), 7);
  assert.equal(daysBetween('2026-11-07', '2026-11-05'), -2);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(todayLocal(new Date(2026, 10, 7, 23, 59)), '2026-11-07');
});

test('debtSummary Trang: vay còn lại (ước tính) + thẻ dư nợ kỳ', () => {
  const s = debtSummary(load('sample'), 'Trang');
  assert.equal(s.loans.total, 3 * 500000 + 2 * 350000); // V01: kỳ 10/12 -> 3 kỳ; V02: kỳ 5/6 -> 2 kỳ
  assert.equal(s.cards.total, 3000000 + 5000000 + 600000);
  assert.equal(s.total, 10800000);
  assert.equal(s.dueNow, 500000 + 350000 + 8600000);
  assert.deepEqual(s.missing, []);
});

test('debtSummary Dũng', () => {
  const s = debtSummary(load('sample'), 'Dũng');
  assert.equal(s.total, 3 * 420000 + 2 * 800000 + 8000000 + 1250000);
  assert.equal(s.dueNow, 420000 + 800000 + 9250000);
});

test('debtSummary: thiếu dữ liệu -> bị loại khỏi tổng và báo, không tính 0; không có dòng nào -> hasData=false', () => {
  const d = load('sample');
  d.khoanVay[0].soTienKy = null;
  d.the[0].duNoKy = null;
  const s = debtSummary(d, 'Trang');
  assert.equal(s.missing.length, 2);
  assert.equal(s.loans.count, 1);
  assert.equal(s.total, 2 * 350000 + 5000000 + 600000);
  assert.equal(debtSummary(d, 'Người lạ').hasData, false);
});

test('debtSummary: khoản vay đã trả hết thì không còn nợ', () => {
  const d = load('sample');
  d.khoanVay[0].kyKeTiep = 13; // > tổng 12 kỳ
  const s = debtSummary(d, 'Trang');
  assert.equal(s.loans.total, 2 * 350000);
  assert.equal(s.dueNow, 350000 + 8600000);
});

test('đến hạn 7 ngày (gồm ngày thứ 7), sắp theo ngày', () => {
  const { items } = dueItems(load('sample'));
  const soon = upcoming(items, TODAY, 7);
  assert.deepEqual(soon.map((i) => i.ma), ['T01', 'T04', 'V01', 'T03']);
  assert.equal(soon.find((i) => i.ma === 'T03').due, '2026-11-14');
  assert.equal(upcoming(items, TODAY, 6).some((i) => i.ma === 'T03'), false);
});

test('nhãn số tiền: thẻ Toàn bộ = đã xác nhận, thẻ Đáo = ước tính, khoản vay = đã xác nhận', () => {
  const { items } = dueItems(load('sample'));
  const k = (ma) => items.find((i) => i.ma === ma).amountKind;
  assert.equal(k('T01'), 'confirmed');
  assert.equal(k('T02'), 'estimate');
  assert.equal(k('V01'), 'confirmed');
});

test('quá hạn chưa có ghi nhận: V02 (05/11) bị báo; có ghi nhận khớp thì không báo', () => {
  const d = load('sample');
  let { items } = dueItems(d);
  assert.deepEqual(overdueUnlogged(items, TODAY).map((i) => i.ma), ['V02']);
  d.nhatKy.push({ ngayGhi: '2026-11-06', chu: 'Trang', ma: 'V02', donVi: 'Mcredit Momo', hanThucTe: '2026-11-05', trangThai: 'Đã trả', thucTe: 350000 });
  ({ items } = dueItems(d));
  assert.deepEqual(overdueUnlogged(items, TODAY), []);
  // ghi nhận cho kỳ khác (hạn khác) thì KHÔNG che khoản quá hạn
  d.nhatKy.pop();
  d.nhatKy.push({ ngayGhi: '2026-11-06', chu: 'Trang', ma: 'V02', hanThucTe: '2026-10-05', trangThai: 'Đã trả', thucTe: 350000 });
  assert.deepEqual(overdueUnlogged(dueItems(d).items, TODAY).map((i) => i.ma), ['V02']);
});

test('thiếu hạn -> vào danh sách missing, không biến mất lặng lẽ', () => {
  const d = load('sample');
  d.khoanVay[1].hanKyKeTiep = null;
  d.the[2].hanThanhToan = null;
  const r = dueItems(d);
  assert.equal(r.missing.length, 2);
  assert.equal(r.items.some((i) => i.ma === 'V02'), false);
});
