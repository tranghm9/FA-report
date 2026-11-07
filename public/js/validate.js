// Kiểm tra mâu thuẫn dữ liệu. KHÔNG tự sửa/chọn số: chỉ trả danh sách cảnh báo để hiện cho người dùng.
import { fold } from './parse.js';

export const PEOPLE = ['Trang', 'Dũng'];
export const TOLERANCE_VND = 1000; // chưa rõ Sheet làm tròn thế nào nên cho phép lệch nhẹ khi đối chiếu công thức

/** 'toan_bo' | 'dao' | null (không nhận ra) */
export function cardMode(cheDo) {
  const f = fold(cheDo);
  if (f === 'toan bo') return 'toan_bo';
  if (f === 'dao') return 'dao';
  return null;
}

/** Công thức đáo (xem CLAUDE.md). Trả null nếu thiếu dữ kiện. */
export function expectedDao(card, params) {
  if (card.duNoKy == null || card.khaDung == null || params.hanMucMucTieu == null || params.phiDao == null) return null;
  const soNap = Math.max(0, params.hanMucMucTieu - card.khaDung);
  const phi = params.phiDao * (card.duNoKy - soNap);
  return { soNap, phi, tong: soNap + phi };
}

const money = (n) => new Intl.NumberFormat('vi-VN').format(n);

export function validate(d) {
  const w = [];
  const add = (where, msg) => w.push({ where, msg });

  d.missingTabs.forEach((t) => add(t, `Không thấy tab "${t}" trong dữ liệu.`));
  d.missingColumns.forEach((c) => add(c.tab, `Không thấy cột "${c.column}".`));
  d.cellErrors.forEach((c) => add(c.tab, `Ô lỗi công thức ở dòng ${c.row}, cột "${c.col}".`));

  // Mã trùng
  const seen = new Map();
  for (const [tab, list] of [['Khoản vay', d.khoanVay], ['Thẻ', d.the]]) {
    for (const r of list) {
      if (!r.ma) continue;
      if (seen.has(r.ma)) add(tab, `Mã ${r.ma} xuất hiện hai lần (${seen.get(r.ma)} và ${tab}).`);
      else seen.set(r.ma, tab);
    }
  }

  // Chủ lạ
  for (const [tab, list] of [['Khoản vay', d.khoanVay], ['Thẻ', d.the], ['Nhật ký', d.nhatKy]]) {
    for (const r of list) if (r.chu && !PEOPLE.includes(r.chu)) add(tab, `${r.ma ?? '(không mã)'}: chủ "${r.chu}" không phải Trang hoặc Dũng.`);
  }

  // Khoản vay: còn lại = tổng kỳ - kỳ kế tiếp
  for (const v of d.khoanVay) {
    if (v.tongSoKy != null && v.kyKeTiep != null && v.conLai != null && v.kyKeTiep <= v.tongSoKy && v.conLai !== v.tongSoKy - v.kyKeTiep) {
      add('Khoản vay', `${v.ma}: "Còn lại sau kỳ kế tiếp" = ${v.conLai} nhưng tổng ${v.tongSoKy} kỳ, kỳ kế tiếp là ${v.kyKeTiep} (sẽ còn ${v.tongSoKy - v.kyKeTiep}).`);
    }
  }

  // Thẻ
  for (const t of d.the) {
    if (t.duNoKy != null && t.hanMuc != null && t.duNoKy > t.hanMuc) add('Thẻ', `${t.ma}: dư nợ kỳ ${money(t.duNoKy)} lớn hơn hạn mức ${money(t.hanMuc)}.`);
    if (t.duNoKy != null && t.toiThieu != null && t.toiThieu > t.duNoKy) add('Thẻ', `${t.ma}: số tối thiểu lớn hơn dư nợ kỳ.`);
    const mode = cardMode(t.cheDo);
    if (t.cheDo && !mode) { add('Thẻ', `${t.ma}: chế độ "${t.cheDo}" không phải "Toàn bộ" hoặc "Đáo".`); continue; }
    if (mode === 'toan_bo' && t.duKien != null && t.duNoKy != null && t.duKien !== t.duNoKy) {
      add('Thẻ', `${t.ma}: chế độ Toàn bộ nhưng số dự kiến ${money(t.duKien)} khác dư nợ kỳ ${money(t.duNoKy)}.`);
    }
    if (mode === 'dao') {
      const e = expectedDao(t, d.params);
      if (e && t.duKien != null && Math.abs(t.duKien - e.tong) > TOLERANCE_VND) {
        add('Thẻ', `${t.ma}: số dự kiến ${money(t.duKien)} lệch công thức đáo (tính ra ≈ ${money(Math.round(e.tong))}).`);
      }
    }
  }

  // Nhật ký
  for (const n of d.nhatKy) {
    if (fold(n.trangThai) === 'da tra' && n.thucTe == null) add('Nhật ký', `${n.ma ?? '(không mã)'} ngày ${n.ngayGhi ?? '?'}: ghi "Đã trả" nhưng thiếu số thực tế.`);
  }
  return w;
}
