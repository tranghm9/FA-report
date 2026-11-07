export const NA = 'Chưa có';
const nf = new Intl.NumberFormat('vi-VN');

export const money = (v) => (v == null ? null : `${nf.format(v)} đ`);
export const dateVN = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null);
export const dayOfMonth = (n) => (n == null ? null : `ngày ${n}`);

export const TAG = { confirmed: 'Đã xác nhận', estimate: 'Ước tính', mixed: 'Gồm ước tính' };

/** Nhãn cho "Số tiền dự kiến" của thẻ: Toàn bộ = dư nợ từ sao kê (đã xác nhận); Đáo = có phí 3% ngân sách (ước tính). */
export function cardAmountKind(mode) {
  return mode === 'toan_bo' ? 'confirmed' : 'estimate';
}
