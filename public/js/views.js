import { NA, TAG, money, dateVN, dayOfMonth, cardAmountKind } from './format.js';
import { PEOPLE, cardMode } from './validate.js';
import { fold } from './parse.js';
import { buildReport, unitShares, kindOf, monthLong } from './report.js';
import { buildHistory } from './history.js';
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

const nfm = new Intl.NumberFormat('vi-VN');

function forecastView(d, person, ctx) {
  const r = buildReport(d, person, ctx.today);
  const scope = ctx.pieScope;
  const sh = unitShares(r, scope);
  const t = r.totals;
  const unit = (m) => (person === 'Tất cả' ? Object.entries(m.byPerson).map(([k, v]) => `${esc(k)} ${esc(money(v))}`).join(' · ') : '');
  const swatch = (c, extra = '') => `<i class="sw" style="background:${c};${extra}"></i>`;
  const barLegend = `<ul class="legend">
    <li>${swatch('var(--ch-0)')}Khoản vay ${tag('confirmed')}</li>
    <li>${swatch('var(--ch-4)')}Thẻ ${tag('confirmed')}</li>
    <li>${swatch('var(--ch-4)', 'background-image:repeating-linear-gradient(135deg,transparent 0 3px,var(--card) 3px 5px)')}Thẻ ${tag('estimate')}</li></ul>`;
  const pieLegend = sh.rows.length
    ? `<ul class="legend rows">${sh.rows.map((x, i) => `<li>${swatch(`var(--ch-${x.other ? 'other' : i})`)}<span class="nm">${esc(x.name)}</span><span class="am">${esc(money(x.total))} · ${Math.round(x.pct * 100)}%${tag(x.kind)}</span></li>`).join('')}</ul>`
    : '<p class="none">Chưa có khoản nào.</p>';
  const months = r.months.map((m) => `<article class="card">
      <header><b>${esc(monthLong(m.key))}</b></header>
      ${field('Khoản vay', m.vay ? money(m.vay) : null, 'confirmed')}
      ${field('Thẻ', m.theOk + m.theEst ? money(m.theOk + m.theEst) : null, kindOf(m.theOk, m.theEst))}
      ${field('Tổng dự kiến', m.total ? money(m.total) : null, kindOf(m.vay + m.theOk, m.theEst))}
      ${unit(m) ? `<p class="note">${unit(m)}</p>` : ''}
    </article>`).join('');
  const issues = [...r.missing.map((x) => `Chưa tính: ${x}`), ...r.notes];
  return `<p class="meta">${esc(person === 'Tất cả' ? 'Cả Trang và Dũng' : person)} · từ ${esc(monthLong(r.keys[0]))} đến ${esc(monthLong(r.keys[r.keys.length - 1]))}</p>
    <div class="card"><h2 class="ct">Dự kiến phải trả mỗi tháng</h2>
      <p class="sub">Cả kỳ: ${esc(money(t.all))} · Thẻ các tháng sau lấy như kỳ hiện tại (chưa có sao kê) nên là số ước tính.</p>
      <div class="cwrap" id="barwrap"><canvas id="bar" role="img" aria-label="Biểu đồ cột: số tiền dự kiến phải trả mỗi tháng, chi tiết ở các thẻ bên dưới"></canvas></div>
      ${barLegend}
    </div>
    <div class="card"><div class="row"><h2 class="ct">Cơ cấu theo đơn vị</h2>
      <div class="seg mini" role="group" aria-label="Phạm vi cơ cấu"><button type="button" data-pie="month" aria-pressed="${scope === 'month'}">Tháng này</button><button type="button" data-pie="all" aria-pressed="${scope === 'all'}">${r.months.length} tháng</button></div></div>
      <div class="cwrap pie" id="piewrap"><canvas id="pie" role="img" aria-label="Biểu đồ tròn: cơ cấu theo đơn vị, chi tiết ở danh sách bên dưới"></canvas></div>
      ${pieLegend}
    </div>
    ${issues.length ? `<div class="warn"><b>Lưu ý:</b><ul>${issues.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${r.earlier.count ? `<p class="note">Còn ${r.earlier.count} kỳ quá hạn từ trước tháng này (${esc(money(r.earlier.amount))}), chưa tính vào biểu đồ.</p>` : ''}
    <h2 class="grp">Chi tiết từng tháng</h2>${months}
    <p class="note">Chưa gồm khoản vay mới và sao kê thẻ chưa phát sinh.</p>`;
}

function historyView(d, person, ctx) {
  const h = buildHistory(d, person, ctx.today);
  if (!h.points.length) return `<div class="card"><h2 class="ct">Lịch sử dư nợ</h2><p class="none">Chưa có: Nhật ký chưa ghi khoản trả nào của ${esc(person === 'Tất cả' ? 'Trang và Dũng' : person)}.</p></div>`;
  const swatch = (c, extra = '') => `<i class="sw" style="background:${c};${extra}"></i>`;
  const legend = `<ul class="legend">
    <li>${swatch('var(--text)')}Tổng ${tag('mixed')}</li>
    ${h.hasLoans ? `<li>${swatch('var(--ch-0)', 'background-image:repeating-linear-gradient(90deg,transparent 0 4px,var(--card) 4px 6px)')}Khoản vay còn lại ${tag('estimate')}</li>` : ''}
    ${h.hasCards ? `<li>${swatch('var(--ch-4)')}Thẻ: dư nợ kỳ ${tag('confirmed')}</li>` : ''}</ul>`;
  const rows = [...h.points].reverse().map((p) => `<article class="card">
      <header><b>${esc(monthLong(p.key))}</b><span class="id">mốc ${esc(dateVN(p.date))}</span></header>
      ${field('Khoản vay còn lại', money(p.vay), 'estimate')}
      ${field('Thẻ: dư nợ kỳ', money(p.the), 'confirmed')}
      ${field('Tổng', money(p.total), p.total != null ? kindOf(p.the ?? 0, p.vay ?? 0) : null)}
    </article>`).join('');
  return `<div class="card"><h2 class="ct">Dư nợ qua các tháng</h2>
      <p class="sub">Khoản vay dựng ngược từ Nhật ký nên là số ước tính. Thẻ dùng dư nợ kỳ đã ghi trong Nhật ký. Mốc "Nay" là hôm nay.</p>
      ${h.enough ? '' : '<p class="note">Chưa đủ mốc có số đầy đủ để nối thành đường (cần ít nhất 2).</p>'}
      <div class="cwrap" id="linewrap"><canvas id="line" role="img" aria-label="Biểu đồ đường: dư nợ qua các tháng, chi tiết ở các thẻ bên dưới"></canvas></div>
      ${legend}</div>
    ${h.warnings.length ? `<div class="warn"><b>Lưu ý:</b><ul>${h.warnings.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <h2 class="grp">Chi tiết từng mốc</h2>${rows}`;
}

function reportScreen(d, person, ctx) {
  const v = ctx.reportView;
  return `<div class="seg rv" role="group" aria-label="Loại báo cáo">
      <button type="button" data-rv="forecast" aria-pressed="${v === 'forecast'}">Dự kiến 7 tháng</button>
      <button type="button" data-rv="history" aria-pressed="${v === 'history'}">Lịch sử dư nợ</button></div>
    <div class="exp"><button type="button" data-export="csv">Tải CSV</button><button type="button" data-export="png">Lưu ảnh</button></div>
    <p id="exportMsg" class="note" role="status"></p>
    ${v === 'history' ? historyView(d, person, ctx) : forecastView(d, person, ctx)}`;
}

function settingsView(ctx) {
  const c = ctx.cfg;
  const where = { demo: 'Dữ liệu mẫu (chưa nối Google Sheet)', device: 'Google Sheet thật (cấu hình lưu trên máy này)', env: 'Google Sheet thật (cấu hình lúc chạy thử)' }[c.source];
  const th = ctx.theme;
  const themeBtn = (v, t) => `<button type="button" data-theme-set="${v}" aria-pressed="${th === v}">${t}</button>`;
  return `<div class="card"><h2 class="ct">Giao diện</h2>
      <p class="sub">Chọn sáng hoặc tối cho app, không phụ thuộc chế độ của điện thoại.</p>
      <div class="seg" role="group" aria-label="Giao diện">${themeBtn('system', 'Theo điện thoại')}${themeBtn('light', 'Sáng')}${themeBtn('dark', 'Tối')}</div>
    </div>
    <div class="card"><h2 class="ct">Nguồn dữ liệu</h2>
      <p class="sub">Đang dùng: <b>${esc(where)}</b></p>
      ${ctx.loadError ? `<p class="note err-note">Lần tải gần nhất lỗi: ${esc(ctx.loadError)}</p>` : ''}
      <div class="fld"><label for="cfgUrl">Địa chỉ ứng dụng web (Apps Script)</label>
        <input id="cfgUrl" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(c.source === 'device' ? c.dataUrl : '')}"></div>
      <div class="fld"><label for="cfgKey">Khóa truy cập</label>
        <input id="cfgKey" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${c.source === 'device' ? 'Đã lưu. Để trống nếu không đổi' : 'Chuỗi bí mật (APP_KEY)'}"></div>
      <div class="exp"><button type="button" id="cfgSave">Lưu và tải lại</button><button type="button" id="cfgClear">Dùng dữ liệu mẫu</button></div>
      <p id="cfgMsg" class="note" role="status"></p>
      <p class="note">Địa chỉ và khóa chỉ được lưu trên thiết bị này, không nằm trong trang web. Mỗi thiết bị nhập một lần.</p>
    </div>
    <div class="card"><h2 class="ct">Cài lên màn hình chính</h2>
      <p class="sub"><b>Android (Chrome):</b> bấm menu ⋮ rồi chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".</p>
      <p class="sub"><b>iPhone (Safari):</b> bấm nút Chia sẻ rồi chọn "Thêm vào Màn hình chính". Phải dùng Safari, không dùng Chrome.</p>
    </div>
    <div class="card"><h2 class="ct">Dữ liệu lưu trên máy</h2>
      <p class="sub">${ctx.lastSaved ? `Bản sao lần tải gần nhất lúc ${esc(ctx.lastSaved)}, dùng để xem khi mất mạng.` : 'Chưa có bản sao nào.'}</p>
      <div class="exp"><button type="button" id="cacheClear">Xóa dữ liệu đã lưu</button></div>
      <p id="cacheMsg" class="note" role="status"></p>
    </div>`;
}

export const TABS = [
  { id: 'tongquan', label: 'Tổng quan', render: overview },
  { id: 'caidat', label: 'Cài đặt', hidden: true, render: (d, p, ctx) => settingsView(ctx) },
  { id: 'baocao', label: 'Báo cáo', render: reportScreen },
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
