import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, parsePercent, parseDate, parseLast4, parseText, fold } from '../public/js/parse.js';

test('parseNumber: số, chuỗi kiểu VN, thiếu -> null (không phải 0)', () => {
  assert.equal(parseNumber(2914311), 2914311);
  assert.equal(parseNumber('2.914.311'), 2914311);
  assert.equal(parseNumber('2.914.311 đ'), 2914311);
  assert.equal(parseNumber('1.234,5'), 1234.5);
  assert.equal(parseNumber('0'), 0);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber(null), null);
  assert.equal(parseNumber('#REF!'), null);
  assert.equal(parseNumber('abc'), null);
});

test('parsePercent', () => {
  assert.equal(parsePercent('3,0%'), 0.03);
  assert.equal(parsePercent(0.03), 0.03);
  assert.equal(parsePercent(3), 0.03);
  assert.equal(parsePercent(''), null);
});

test('parseDate: ISO, dd/mm/yyyy, ngày không tồn tại, trống', () => {
  assert.equal(parseDate('2026-11-09'), '2026-11-09');
  assert.equal(parseDate('2026-11-09T17:00:00.000Z'), '2026-11-09');
  assert.equal(parseDate('9/11/2026'), '2026-11-09');
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate(''), null);
  assert.equal(parseDate('hôm qua'), null);
});

test('parseLast4 giữ số 0 đầu; parseText; fold', () => {
  assert.equal(parseLast4(1), '0001');
  assert.equal(parseLast4('0748'), '0748');
  assert.equal(parseLast4(''), null);
  assert.equal(parseText('  a '), 'a');
  assert.equal(fold('Đã trả'), 'da tra');
  assert.equal(fold('Toàn  bộ'), 'toan bo');
});
