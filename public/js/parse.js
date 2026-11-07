// Chuyển giá trị thô từ Sheet (số, chuỗi kiểu Việt Nam, ngày) sang dạng chuẩn. Thiếu/không hiểu -> null (KHÔNG phải 0).

/** Bỏ dấu + hạ chữ thường, để so khớp tiêu đề cột/giá trị ổn định. */
export function fold(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim().replace(/\s+/g, ' ');
}

const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export function parseText(v) {
  return blank(v) ? null : String(v).trim();
}

/** Số tiền / số nguyên. Nhận số, hoặc chuỗi "2.914.311", "1.234,5", "2.914.311 đ". */
export function parseNumber(v) {
  if (blank(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[đ₫\s]/gi, '');
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Phần trăm -> số thập phân. "3,0%" -> 0.03; 0.03 -> 0.03; 3 -> 0.03. */
export function parsePercent(v) {
  if (blank(v)) return null;
  if (typeof v === 'number') return v > 1 ? v / 100 : v;
  const n = parseNumber(String(v).replace('%', ''));
  return n === null ? null : n / 100;
}

/** Ngày -> 'YYYY-MM-DD' (chuỗi, tránh lệch múi giờ). Nhận 'yyyy-MM-dd', ISO có giờ, hoặc 'dd/mm/yyyy'. */
export function parseDate(v) {
  if (blank(v)) return null;
  const s = String(v).trim();
  let y, m, d;
  let r = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (r) [, y, m, d] = r;
  else if ((r = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [, d, m, y] = r;
  else return null;
  const dt = new Date(Date.UTC(+y, +m - 1, +d));
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +m - 1 || dt.getUTCDate() !== +d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 4 số cuối thẻ: giữ số 0 đầu (Sheet có thể lưu 0001 thành 1). */
export function parseLast4(v) {
  if (blank(v)) return null;
  const s = String(v).trim();
  return /^\d{1,4}$/.test(s) ? s.padStart(4, '0') : s;
}
