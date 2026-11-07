import { NA, TAG, money, dateVN, dayOfMonth, cardAmountKind } from './format.js';
import { PEOPLE, cardMode } from './validate.js';
import { fold } from './parse.js';
import { debtSummary, dueItems, upcoming, overdueUnlogged, daysBetween } from './overview.js';

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

const whenText = (n) => (n === 0 ? 'hôm nay' : n > 0 ? `còn ${n} ngày` : `quá ${-n} ngày`);

function dueRow(i, today, late) {
  const n = daysBetween(today, i.due);
  const amt = money(i.amount);
  return `<div class="due${late ? ' late' : ''}">
    <div><b>${esc(i.name)}</b> <span class="id">${esc(i.ma ?? '')}</span>
      <p class="sub">${esc(dateVN(i.due))} · ${whenText(n)}${i.log ? ` · <span class="chip${fold(i.log.trangThai) === 'da tra' ? ' ok' : ''}">Nhật ký: ${esc(i.log.trangThai ?? 'có ghi')}</span>` : ''}</p></div>
    <div class="amt${amt ? '' : ' na'}">${amt ? `${esc(amt)}${tag(i.amountKind)}` : NA}</div>
  </div>`;
}

function personOverview(d, person, today, due) {
  const s = debtSummary(d, person);
  const mine = due.items.filter((i) => i.chu === person);
  const soon = upcoming(mine, today, 7);
  const late = overdueUnlogged(mine, today);
  const miss = [...s.missing, ...due.missing.filter((m) => m.chu === person).map((m) => m.msg)];
  const hero = s.hasData
    ? `<div class="big">${esc(money(s.total))}</div>
       ${field('Khoản vay còn lại', money(s.loans.total), 'estimate')}
       ${field('Thẻ: dư nợ đến kỳ', money(s.cards.total), 'confirmed')}
       ${field('Đến kỳ (vay + thẻ)', money(s.dueNow), 'confirmed')}
       <p class="note">Chưa gồm phần trả góp thẻ chưa lên sao kê: Sheet không có số này.</p>`
    : `<div class="big na">${NA}</div>`;
  return `<section>
    <h2 class="grp">${esc(person)}</h2>
    <div class="card hero"><div class="lbl"><span>Dư nợ hiện tại</span>${s.hasData ? tag('estimate') : ''}</div>${hero}</div>
    ${miss.length ? `<p class="note">Chưa đủ dữ liệu, chưa tính: ${esc(miss.join('; '))}.</p>` : ''}
    <h3 class="sec">Quá hạn, chưa có ghi nhận <small>${late.length}</small></h3>
    ${late.length ? late.map((i) => dueRow(i, today, true)).join('') : '<p class="none">Không có khoản nào.</p>'}
    <h3 class="sec">Đến hạn trong 7 ngày <small>${soon.length}</small></h3>
    ${soon.length ? soon.map((i) => dueRow(i, today, false)).join('') : '<p class="none">Không có khoản nào.</p>'}
  </section>`;
}

function overview(d, person, ctx) {
  const due = dueItems(d);
  const people = person === 'Tất cả' ? PEOPLE : [person];
  return `<p class="meta">Hôm nay: ${esc(dateVN(ctx.today))}${ctx.demo ? ' (ngày của dữ liệu mẫu)' : ''}</p>` + people.map((p) => personOverview(d, p, ctx.today, due)).join('');
}

export const TABS = [
  { id: 'tongquan', label: 'Tổng quan', render: overview },
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
