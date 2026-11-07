// Tính toán cho màn Tổng quan (M2). Hàm thuần, nhận `today` dạng 'YYYY-MM-DD' để dễ test.
import { cardMode } from './validate.js';
import { cardAmountKind } from './format.js';

export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);
}

export function todayLocal(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Dư nợ hiện tại của một người (cách 1):
 *  - Khoản vay còn lại (ƯỚC TÍNH) = số kỳ chưa trả (tổng - kỳ kế tiếp + 1) x số tiền/kỳ, cộng mọi hợp đồng.
 *  - Thẻ: tổng "dư nợ kỳ" (ĐÃ XÁC NHẬN từ sao kê). Phần trả góp thẻ chưa lên sao kê không có trong Sheet nên không tính.
 *  - Dư nợ đến kỳ (ĐÃ XÁC NHẬN) = số tiền kỳ tới của các khoản vay còn nợ + dư nợ kỳ của thẻ.
 * Dòng thiếu dữ liệu bị loại khỏi tổng và được liệt kê trong `missing` (không coi là 0).
 */
export function debtSummary(d, person) {
  const loans = d.khoanVay.filter((v) => v.chu === person);
  const cards = d.the.filter((t) => t.chu === person);
  const missing = [];
  let loansRemaining = 0, loansNext = 0, loanCount = 0, cardsDue = 0, cardCount = 0;
  for (const v of loans) {
    if (v.tongSoKy == null || v.kyKeTiep == null || v.soTienKy == null) { missing.push(`${v.ma ?? 'Khoản vay'}: thiếu số kỳ hoặc số tiền/kỳ`); continue; }
    const left = Math.max(0, v.tongSoKy - v.kyKeTiep + 1);
    loansRemaining += left * v.soTienKy;
    if (left > 0) loansNext += v.soTienKy;
    loanCount++;
  }
  for (const t of cards) {
    if (t.duNoKy == null) { missing.push(`${t.ma ?? 'Thẻ'}: thiếu dư nợ kỳ`); continue; }
    cardsDue += t.duNoKy;
    cardCount++;
  }
  return {
    hasData: loanCount + cardCount > 0,
    loans: { total: loansRemaining, count: loanCount },
    cards: { total: cardsDue, count: cardCount },
    total: loansRemaining + cardsDue,
    dueNow: loansNext + cardsDue,
    missing,
  };
}

/** Mọi khoản có hạn thanh toán, kèm bản ghi Nhật ký khớp (cùng mã + hạn thực tế = hạn). */
export function dueItems(d) {
  const items = [];
  const missing = [];
  const add = (it) => {
    it.log = it.ma ? d.nhatKy.find((n) => n.ma === it.ma && n.hanThucTe === it.due) ?? null : null;
    items.push(it);
  };
  for (const v of d.khoanVay) {
    if (v.tongSoKy != null && v.kyKeTiep != null && v.kyKeTiep > v.tongSoKy) continue; // đã trả hết
    if (!v.hanKyKeTiep) { missing.push({ chu: v.chu, msg: `${v.ma ?? 'Khoản vay'}: chưa có hạn kỳ kế tiếp` }); continue; }
    add({ type: 'vay', ma: v.ma, chu: v.chu, name: v.donVi ?? v.ma, due: v.hanKyKeTiep, amount: v.soTienKy, amountKind: 'confirmed' });
  }
  for (const t of d.the) {
    if (!t.hanThanhToan) { missing.push({ chu: t.chu, msg: `${t.ma ?? 'Thẻ'}: chưa có hạn thanh toán` }); continue; }
    add({ type: 'the', ma: t.ma, chu: t.chu, name: t.ten ?? t.ma, due: t.hanThanhToan, amount: t.duKien, amountKind: cardAmountKind(cardMode(t.cheDo)) });
  }
  for (const l of d.linhHoat) {
    if (!l.hanThanhToan) { missing.push({ chu: l.chu, msg: `${l.ma ?? 'Khoản linh hoạt'}: chưa có hạn thanh toán` }); continue; }
    add({ type: 'linhhoat', ma: l.ma, chu: l.chu, name: l.donVi ?? l.moTa ?? l.ma, due: l.hanThanhToan, amount: l.soTien, amountKind: 'confirmed' });
  }
  return { items, missing };
}

const byDue = (a, b) => a.due.localeCompare(b.due) || String(a.ma).localeCompare(String(b.ma));

/** Đến hạn từ hôm nay đến hôm nay + `days` ngày (tính cả hai đầu). */
export const upcoming = (items, today, days = 7) =>
  items.filter((i) => { const k = daysBetween(today, i.due); return k >= 0 && k <= days; }).sort(byDue);

/** Đã quá hạn và Nhật ký không có bản ghi nào cho đúng khoản/hạn đó. */
export const overdueUnlogged = (items, today) =>
  items.filter((i) => daysBetween(today, i.due) < 0 && !i.log).sort(byDue);
