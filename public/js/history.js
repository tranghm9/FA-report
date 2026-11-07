// Lịch sử dư nợ (M4), dựng lại từ Nhật ký. Hàm thuần, nhận `today` 'YYYY-MM-DD'.
//
// KHOẢN VAY còn lại tại mốc t  (ƯỚC TÍNH, dựng ngược):  dư nợ hiện tại + mọi khoản đã trả có Ngày ghi > t
//   (khoản vay có lịch cố định nên cộng ngược là đúng nếu Nhật ký ghi đủ; trước Ngày giải ngân thì chưa có khoản vay).
// THẺ: KHÔNG cộng ngược (thẻ phát sinh chi tiêu mới mỗi kỳ nên cộng ngược sẽ phóng đại). Thay vào đó dùng
//   "dư nợ kỳ" thật đã ghi trong Nhật ký (ĐÃ XÁC NHẬN): Toàn bộ = Thực tế đã trả; Đáo = Dư nợ kỳ đáo;
//   giữ nguyên giá trị gần nhất cho đến lần ghi sau. Mốc hôm nay dùng dư nợ kỳ trong Sheet.
//   Mốc nào có thẻ chưa có số nào trước đó -> thẻ và tổng ở mốc đó là "Chưa có" (không tính 0).
import { fold } from './parse.js';
import { cardMode } from './validate.js';
import { monthKey, addMonths } from './report.js';

const isPaid = (n) => fold(n.trangThai) === 'da tra';
const lastDay = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${key}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};
const monthShort = (key) => `Th${Number(key.slice(5))}/${key.slice(2, 4)}`;

export function buildHistory(d, person, today, maxMonths = 12) {
  const mine = (list) => (person === 'Tất cả' ? list : list.filter((r) => r.chu === person));
  const loans = mine(d.khoanVay), cards = mine(d.the);
  const warnings = [];
  const loanMas = new Set(loans.map((v) => v.ma)), cardMas = new Set(cards.map((t) => t.ma));
  const known = new Set([...d.khoanVay, ...d.the].map((r) => r.ma));
  const mineLog = d.nhatKy.filter((n) => n.ngayGhi && (loanMas.has(n.ma) || cardMas.has(n.ma)));
  const orphans = d.nhatKy.filter((n) => n.ma && !known.has(n.ma)).length;
  if (orphans) warnings.push(`${orphans} dòng Nhật ký có mã không còn trong Sheet, bỏ qua.`);

  const empty = { points: [], hasLoans: loans.length > 0, hasCards: cards.length > 0, warnings, enough: false, coverageStart: null };
  if (!mineLog.length) return empty;

  // --- dữ liệu nền
  const paid = mineLog.filter(isPaid);
  const loanState = [];
  for (const v of loans) {
    if (v.tongSoKy == null || v.kyKeTiep == null || v.soTienKy == null) { warnings.push(`${v.ma}: thiếu số kỳ hoặc số tiền/kỳ, không đưa vào đường khoản vay.`); continue; }
    const l0 = Math.max(0, v.tongSoKy - v.kyKeTiep + 1) * v.soTienKy;
    const pays = paid.filter((n) => n.ma === v.ma && n.thucTe != null);
    const expected = Math.max(0, Math.min(v.kyKeTiep - 1, v.tongSoKy));
    if (pays.length < expected) warnings.push(`${v.ma}: Nhật ký mới có ${pays.length}/${expected} kỳ đã trả, nên dư nợ khoản vay các mốc trước có thể thấp hơn thực tế.`);
    loanState.push({ v, l0, pays });
  }
  const cardState = cards.map((t) => ({
    t,
    obs: paid.filter((n) => n.ma === t.ma).map((n) => ({
      date: n.ngayGhi,
      value: cardMode(n.cheDo) === 'dao' ? n.duNoKyDao : n.thucTe,
    })).filter((o) => o.value != null).sort((a, b) => a.date.localeCompare(b.date)),
  }));

  // --- các mốc: cuối mỗi tháng từ tháng ghi đầu tiên đến tháng này (mốc cuối = hôm nay)
  const cur = monthKey(today);
  // mốc bắt đầu chung cho mọi người (ghi chép sớm nhất của cả sổ) để biểu đồ Trang/Dũng/Tất cả thẳng hàng
  const coverageStart = d.nhatKy.filter((n) => n.ngayGhi && known.has(n.ma)).map((n) => n.ngayGhi).sort()[0];
  let first = monthKey(coverageStart);
  const floor = addMonths(cur, -(maxMonths - 1));
  if (first < floor) first = floor;
  const keys = [];
  for (let k = first; k <= cur; k = addMonths(k, 1)) keys.push(k);

  const points = keys.map((key) => {
    const date = key === cur ? today : lastDay(key);
    const isToday = key === cur;
    // khoản vay
    let vay = null;
    for (const s of loanState) {
      if (s.v.ngayGiaiNgan && date < s.v.ngayGiaiNgan) continue;
      vay = (vay ?? 0) + s.l0 + s.pays.filter((n) => n.ngayGhi > date).reduce((a, n) => a + n.thucTe, 0);
    }
    // thẻ
    let the = null;
    const unknown = [];
    if (cardState.length) {
      the = 0;
      for (const c of cardState) {
        let val = null;
        if (isToday && c.t.duNoKy != null) val = c.t.duNoKy;
        else { const o = c.obs.filter((x) => x.date <= date).pop(); if (o) val = o.value; }
        if (val == null) unknown.push(c.t.ma); else the += val;
      }
      if (unknown.length) the = null;
    }
    const okParts = (loanState.length ? vay != null : true) && (cardState.length ? the != null : true) && (loanState.length || cardState.length);
    const total = okParts ? (vay ?? 0) + (the ?? 0) : null;
    return { key, label: `${Number(key.slice(5))}/${key.slice(2, 4)}`, short: monthShort(key), date, vay, the, total, unknownCards: unknown };
  });

  // --- cảnh báo phủ dữ liệu
  const logMonths = new Set(mineLog.map((n) => monthKey(n.ngayGhi)));
  const quiet = keys.filter((k) => k < cur && !logMonths.has(k)).map(monthShort);
  if (quiet.length) warnings.push(`Nhật ký không có ghi nhận nào trong: ${quiet.join(', ')}.`);
  const noCard = points.filter((p) => p.unknownCards.length && p.date !== today);
  if (noCard.length) warnings.push(`Chưa có dư nợ kỳ của thẻ ở ${noCard.map((p) => p.short).join(', ')} (Nhật ký chưa ghi), nên phần thẻ và tổng các mốc đó là "Chưa có".`);

  return { points, hasLoans: loanState.length > 0, hasCards: cardState.length > 0, warnings, enough: points.filter((p) => p.total != null).length >= 2, coverageStart };
}
