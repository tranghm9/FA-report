import { NA, TAG, money, dateVN, dayOfMonth, cardAmountKind } from './format.js';
import { PEOPLE, cardMode } from './validate.js';
import { fold } from './parse.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const tag = (kind) => (kind ? `<span class="tag tag-${kind}">${TAG[kind]}</span>` : '');

/** Một dòng "nhãn: giá trị [nhãn xác nhận/ước tính]". Thiếu giá trị -> "Chưa có", không gắn nhãn. */
function field(label, value, kind) {
  const has = value !== null && value !== undefined && value !== '';
  return `<div class="f"><span class="fl">${esc(label)}</span><span class="fv${has ? '' : ' na'}">${has ? esc(value) : NA}${has ? tag(kind) : ''}</span></div>`;
}

export const filterPerson = (list, person) => (person === 'Tất cả' ? list : list.filter((r) => r.chu === person));

function grouped(list, person, renderItem) {
  if (!list.length) return `<p class="empty">Chưa có dữ liệu.</p>`;
  if (person !== 'Tất cả') return list.map(renderItem).join('');
  const names = [...PEOPLE, null];
  return names
    .map((n) => {
      const items = list.filter((r) => (n ? r.chu === n : !PEOPLE.includes(r.chu)));
      if (!items.length) return '';
      return `<section><h2 class="grp">${esc(n ?? 'Chưa rõ chủ')} <small>${items.length}</small></h2>${items.map(renderItem).join('')}</section>`;
    })
    .join('');
}

function loanCard(v) {
  const prog = v.tongSoKy != null && v.kyKeTiep != null ? `${v.kyKeTiep} / ${v.tongSoKy}` : null;
  return `<article class="card">
    <header><b>${esc(v.donVi ?? NA)}</b><span class="id">${esc(v.ma ?? '')}</span></header>
    ${v.moTa ? `<p class="sub">${esc(v.moTa)}</p>` : ''}
    ${field('Số tiền / kỳ', money(v.soTienKy), 'confirmed')}
    ${field('Kỳ kế tiếp (chưa trả)', prog, 'confirmed')}
    ${field('Hạn kỳ kế tiếp', dateVN(v.hanKyKeTiep), 'confirmed')}
    ${field('Còn lại sau kỳ đó', v.conLai != null ? `${v.conLai} kỳ` : null, 'confirmed')}
    ${field('Hạn kỳ cuối', dateVN(v.hanKyCuoi), 'confirmed')}
  </article>`;
}

function cardCard(t) {
  const mode = cardMode(t.cheDo);
  const dao = mode === 'dao';
  return `<article class="card">
    <header><b>${esc(t.ten ?? NA)}${t.soCuoi ? ` <span class="mask">•••• ${esc(t.soCuoi)}</span>` : ''}</b><span class="id">${esc(t.ma ?? '')}</span></header>
    ${field('Chốt sao kê', dayOfMonth(t.ngayChot), 'confirmed')}
    ${field('Hạn thanh toán', dateVN(t.hanThanhToan), 'confirmed')}
    ${field('Dư nợ kỳ (sao kê)', money(t.duNoKy), 'confirmed')}
    ${field('Hạn mức', money(t.hanMuc), 'confirmed')}
    ${field('Hạn mức khả dụng', money(t.khaDung), 'confirmed')}
    ${field('Chế độ kỳ này', t.cheDo, 'confirmed')}
    ${dao ? field('Số nạp', money(t.soNap), 'estimate') + field('Phí đáo (ngân sách)', money(t.phiDao), 'estimate') : ''}
    ${field('Số tiền dự kiến', money(t.duKien), cardAmountKind(mode))}
    ${t.ghiChu ? `<p class="note">${esc(t.ghiChu)}</p>` : ''}
  </article>`;
}

function logCard(n) {
  const paid = fold(n.trangThai) === 'da tra';
  return `<article class="card">
    <header><b>${esc(n.donVi ?? NA)}</b><span class="id">${esc(n.ma ?? '')}</span></header>
    <p class="sub">Ghi ngày ${esc(dateVN(n.ngayGhi) ?? NA)} · <span class="chip${paid ? ' ok' : ''}">${esc(n.trangThai ?? NA)}</span></p>
    ${field('Hạn thực tế', dateVN(n.hanThucTe), 'confirmed')}
    ${field('Dự kiến', money(n.duKien), 'estimate')}
    ${field('Thực tế', money(n.thucTe), 'confirmed')}
    ${n.cheDo ? field('Chế độ thẻ', n.cheDo, 'confirmed') : ''}
    ${field('Phí đáo thực tế', money(n.phiDaoThucTe), 'confirmed')}
    ${n.ghiChu ? `<p class="note">${esc(n.ghiChu)}</p>` : ''}
  </article>`;
}

export const TABS = [
  { id: 'vay', label: 'Khoản vay', render: (d, p) => grouped(filterPerson(d.khoanVay, p), p, loanCard) },
  { id: 'the', label: 'Thẻ', render: (d, p) => grouped(filterPerson(d.the, p), p, cardCard) },
  {
    id: 'nhatky', label: 'Nhật ký',
    render: (d, p) => {
      const list = [...filterPerson(d.nhatKy, p)].sort((a, b) => (b.ngayGhi ?? '').localeCompare(a.ngayGhi ?? ''));
      return list.length ? list.map(logCard).join('') : `<p class="empty">Chưa có dữ liệu.</p>`;
    },
  },
];

export function warningsView(warnings) {
  if (!warnings.length) return '';
  return `<details class="warn" open><summary>⚠ ${warnings.length} điểm dữ liệu chưa khớp — app không tự chọn số nào, cần bạn kiểm tra lại Sheet</summary>
    <ul>${warnings.map((w) => `<li><b>${esc(w.where)}:</b> ${esc(w.msg)}</li>`).join('')}</ul></details>`;
}
