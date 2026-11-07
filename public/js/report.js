// Báo cáo tháng (M3): số tiền dự kiến phải trả trong tháng này và 6 tháng tới. Hàm thuần, nhận `today` 'YYYY-MM-DD'.
//  - Khoản vay (+ Linh hoạt): theo lịch hợp đồng, mỗi kỳ chưa trả rơi vào một tháng  -> ĐÃ XÁC NHẬN.
//  - Thẻ: kỳ hiện tại = "Số tiền dự kiến" ở tháng của Hạn thanh toán (Toàn bộ: ĐÃ XÁC NHẬN; Đáo: ƯỚC TÍNH);
//    các tháng sau chưa có sao kê nên lấy như kỳ hiện tại -> ƯỚC TÍNH (người dùng chọn cách này).
import { cardMode } from './validate.js';

export const monthKey = (iso) => iso.slice(0, 7);
export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
export const monthLabel = (key) => `Th${Number(key.slice(5))}/${key.slice(2, 4)}`;
export const monthLong = (key) => `Tháng ${Number(key.slice(5))}/${key.slice(0, 4)}`;

/** 'confirmed' | 'estimate' | 'mixed' | null (không có số nào) */
export function kindOf(ok, est) {
  if (ok > 0 && est > 0) return 'mixed';
  if (est > 0) return 'estimate';
  if (ok > 0) return 'confirmed';
  return null;
}

export function buildReport(d, person, today, horizon = 7) {
  const cur = monthKey(today);
  const keys = Array.from({ length: horizon }, (_, i) => addMonths(cur, i));
  const idx = Object.fromEntries(keys.map((k, i) => [k, i]));
  const months = keys.map((key) => ({ key, vay: 0, theOk: 0, theEst: 0, total: 0, byUnit: {}, byPerson: {} }));
  const mine = (list) => (person === 'Tất cả' ? list : list.filter((r) => r.chu === person));
  const missing = [];
  const notes = [];
  const earlier = { amount: 0, count: 0 };

  const put = (chu, unit, key, amount, bucket) => {
    const m = months[idx[key]];
    if (!m) return;
    m[bucket] += amount;
    m.total += amount;
    const u = (m.byUnit[unit] ??= { ok: 0, est: 0 });
    if (bucket === 'theEst') u.est += amount; else u.ok += amount;
    const who = chu ?? 'Chưa rõ';
    m.byPerson[who] = (m.byPerson[who] ?? 0) + amount;
  };

  for (const v of mine(d.khoanVay)) {
    if (v.tongSoKy == null || v.kyKeTiep == null || v.soTienKy == null || !v.hanKyKeTiep) {
      missing.push(`${v.ma ?? 'Khoản vay'}: thiếu số kỳ, số tiền/kỳ hoặc hạn kỳ kế tiếp`);
      continue;
    }
    const base = monthKey(v.hanKyKeTiep);
    for (let i = 0; i <= v.tongSoKy - v.kyKeTiep; i++) {
      const key = addMonths(base, i);
      if (key < cur) { earlier.amount += v.soTienKy; earlier.count++; } else put(v.chu, v.donVi ?? v.ma ?? '?', key, v.soTienKy, 'vay');
    }
  }
  for (const l of mine(d.linhHoat)) {
    if (l.soTien == null || !l.hanThanhToan) { missing.push(`${l.ma ?? 'Khoản linh hoạt'}: thiếu số tiền hoặc hạn`); continue; }
    const key = monthKey(l.hanThanhToan);
    if (key < cur) { earlier.amount += l.soTien; earlier.count++; } else put(l.chu, l.donVi ?? l.ma ?? '?', key, l.soTien, 'vay');
  }
  for (const t of mine(d.the)) {
    if (t.duKien == null || !t.hanThanhToan) { missing.push(`${t.ma ?? 'Thẻ'}: thiếu số dự kiến hoặc hạn thanh toán`); continue; }
    const baseKey = monthKey(t.hanThanhToan);
    const stale = baseKey < cur;
    const start = stale ? cur : baseKey;
    if (stale) notes.push(`${t.ma}: sao kê đã cũ (hạn ${t.hanThanhToan.slice(8)}/${t.hanThanhToan.slice(5, 7)}), cần cập nhật; các tháng đều là ước tính.`);
    else if (start > cur) notes.push(`${t.ma}: chưa có số cho tháng này (hạn thanh toán kỳ gần nhất rơi vào ${monthLabel(start)}).`);
    for (const key of keys) {
      if (key < start) continue;
      const confirmed = key === baseKey && !stale && cardMode(t.cheDo) === 'toan_bo';
      put(t.chu, t.ten ?? t.ma ?? '?', key, t.duKien, confirmed ? 'theOk' : 'theEst');
    }
  }

  const sum = (f) => months.reduce((a, m) => a + f(m), 0);
  return {
    person, keys, months, missing, notes, earlier,
    totals: { vay: sum((m) => m.vay), theOk: sum((m) => m.theOk), theEst: sum((m) => m.theEst), all: sum((m) => m.total) },
  };
}

/** Cơ cấu theo đơn vị cho tháng đầu ('month') hoặc cả kỳ ('all'); giữ tối đa `top` đơn vị, phần còn lại gộp "Khác". */
export function unitShares(report, scope = 'month', top = 6) {
  const src = scope === 'all' ? report.months : report.months.slice(0, 1);
  const acc = {};
  for (const m of src) for (const [name, u] of Object.entries(m.byUnit)) {
    const a = (acc[name] ??= { name, ok: 0, est: 0 });
    a.ok += u.ok; a.est += u.est;
  }
  let rows = Object.values(acc).map((r) => ({ ...r, total: r.ok + r.est })).filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  if (rows.length > top + 1) {
    const rest = rows.slice(top);
    rows = rows.slice(0, top);
    const o = { name: `Khác (${rest.length} đơn vị)`, ok: 0, est: 0, other: true };
    for (const r of rest) { o.ok += r.ok; o.est += r.est; }
    o.total = o.ok + o.est;
    rows.push(o);
  }
  const total = rows.reduce((a, r) => a + r.total, 0);
  return { rows: rows.map((r) => ({ ...r, pct: total ? r.total / total : 0, kind: kindOf(r.ok, r.est) })), total };
}
