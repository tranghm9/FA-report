import { fetchRaw, normalize } from './data.js';
import { validate, PEOPLE } from './validate.js';
import { todayLocal } from './overview.js';
import { drawBar, drawPie, drawLine, destroyCharts, chartsReady } from './charts.js';
import { buildHistory } from './history.js';
import { toCsv, forecastRows, historyRows, saveBlob, composeImage } from './export.js';
import { buildReport, unitShares, monthLong, kindOf } from './report.js';
import { dateVN, money, TAG } from './format.js';
import { TABS, warningsView, esc } from './views.js';

const cfg = window.APP_CONFIG || { mode: 'fixture' };
const fixtureName = new URLSearchParams(location.search).get('fixture') || 'sample';
const $ = (s) => document.querySelector(s);
const state = { data: null, warnings: [], person: 'Tất cả', tab: 'tongquan', today: null, pieScope: 'month', reportView: 'forecast' };

function currentTab() {
  const id = location.hash.slice(1);
  return TABS.find((t) => t.id === id) ? id : 'tongquan';
}

const CHART_MSG = '<p class="none">Không tải được thư viện biểu đồ. Xem số liệu ở các thẻ bên dưới.</p>';

function drawCharts() {
  destroyCharts();
  if (state.tab !== 'baocao') return;
  const ids = state.reportView === 'history' ? ['linewrap'] : ['barwrap', 'piewrap'];
  if (!chartsReady()) { for (const id of ids) { const w = document.getElementById(id); if (w) w.innerHTML = CHART_MSG; } return; }
  if (state.reportView === 'history') {
    const h = buildHistory(state.data, state.person, state.today);
    if (h.points.length) drawLine(document.getElementById('line'), h);
    return;
  }
  const r = buildReport(state.data, state.person, state.today);
  drawBar(document.getElementById('bar'), r);
  drawPie(document.getElementById('pie'), unitShares(r, state.pieScope));
}

const say = (t) => { const m = document.getElementById('exportMsg'); if (m) m.textContent = t; };
const RESULT = { shared: 'Đã mở hộp chia sẻ. Chọn nơi lưu tệp.', downloaded: 'Đã tải xuống. Xem trong mục Tải xuống của thiết bị.', cancelled: 'Đã hủy.' };

async function doExport(kind) {
  const hist = state.reportView === 'history';
  const who = state.person === 'Tất cả' ? 'tat-ca' : state.person === 'Dũng' ? 'dung' : 'trang';
  const base = `${hist ? 'lich-su-du-no' : 'bao-cao-du-kien'}-${who}-${state.today}`;
  try {
    if (kind === 'csv') {
      const rows = hist ? historyRows(state.data, state.person, state.today) : forecastRows(state.data, state.person, state.today);
      say(RESULT[await saveBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `${base}.csv`)]);
      return;
    }
    if (!chartsReady()) { say('Chưa có thư viện biểu đồ nên chưa tạo được ảnh. Hãy dùng CSV.'); return; }
    const sub = `Người: ${state.person} · Xuất ngày ${dateVN(state.today)}${cfg.mode === 'fixture' ? ' · DỮ LIỆU MẪU' : ''}`;
    const footer = 'Đã xác nhận = từ Sheet/Nhật ký. Ước tính = số dự báo hoặc dựng lại, chưa chắc chắn.';
    let img;
    if (hist) {
      const h = buildHistory(state.data, state.person, state.today);
      if (!h.points.length) { say('Chưa có dữ liệu để xuất ảnh.'); return; }
      img = await composeImage({
        title: 'Sổ nợ Trang & Dũng · Lịch sử dư nợ', subtitle: sub, footer, notes: h.warnings,
        sections: [{ heading: 'Dư nợ qua các tháng', canvas: document.getElementById('line'), legend: [
          { cssVar: '--text', text: `Tổng · ${TAG.mixed}` },
          ...(h.hasLoans ? [{ cssVar: '--ch-0', text: `Khoản vay còn lại · ${TAG.estimate} (nét đứt)` }] : []),
          ...(h.hasCards ? [{ cssVar: '--ch-4', text: `Thẻ: dư nợ kỳ · ${TAG.confirmed}` }] : []),
        ] }],
      });
    } else {
      const r = buildReport(state.data, state.person, state.today);
      const sh = unitShares(r, state.pieScope);
      img = await composeImage({
        title: 'Sổ nợ Trang & Dũng · Dự kiến phải trả', subtitle: `${sub} · ${monthLong(r.keys[0])} đến ${monthLong(r.keys[r.keys.length - 1])}`, footer,
        notes: [...r.missing.map((x) => `Chưa tính: ${x}`), ...r.notes],
        sections: [
          { heading: 'Dự kiến phải trả mỗi tháng', canvas: document.getElementById('bar'), legend: [
            { cssVar: '--ch-0', text: `Khoản vay · ${TAG.confirmed}` }, { cssVar: '--ch-4', text: `Thẻ · ${TAG.confirmed}` },
            { cssVar: '--ch-4', text: `Thẻ · ${TAG.estimate} (phần sọc chéo)`, striped: true }] },
          { heading: `Cơ cấu theo đơn vị (${state.pieScope === 'month' ? 'tháng này' : `${r.months.length} tháng`})`, canvas: document.getElementById('pie'),
            legend: sh.rows.map((x, i) => ({ cssVar: x.other ? '--ch-other' : `--ch-${i}`, text: `${x.name}: ${money(x.total)} · ${Math.round(x.pct * 100)}%${x.kind ? ` · ${TAG[x.kind]}` : ''}` })) },
        ],
      });
    }
    say(RESULT[await saveBlob(img, `${base}.png`)]);
  } catch (err) {
    say('Không tạo được tệp. Thử lại hoặc dùng CSV.');
    console.error(err);
  }
}

function render() {
  if (!state.data) return;
  state.tab = currentTab();
  const tab = TABS.find((t) => t.id === state.tab);
  const when = state.data.generatedAt ? new Date(state.data.generatedAt).toLocaleString('vi-VN') : 'Chưa có';
  $('#meta').innerHTML = `${cfg.mode === 'fixture' ? '<span class="chip demo">Dữ liệu mẫu</span> ' : ''}Cập nhật: ${esc(when)}`;
  $('#people').innerHTML = ['Tất cả', ...PEOPLE]
    .map((p) => `<button type="button" data-person="${esc(p)}" aria-pressed="${p === state.person}">${esc(p)}</button>`).join('');
  $('#warnings').innerHTML = warningsView(state.warnings);
  $('#view').innerHTML = tab.render(state.data, state.person, { today: state.today, demo: cfg.mode === 'fixture', pieScope: state.pieScope, reportView: state.reportView });
  drawCharts();
  $('#nav').innerHTML = TABS.map((t) => `<a href="#${t.id}" ${t.id === state.tab ? 'aria-current="page"' : ''}>${esc(t.label)}</a>`).join('');
}

async function load() {
  $('#view').innerHTML = '<p class="empty">Đang tải…</p>';
  try {
    state.data = normalize(await fetchRaw(cfg, fixtureName));
    state.warnings = validate(state.data);
    // Dữ liệu mẫu dùng ngày của chính nó để kết quả luôn giống nhau; dữ liệu thật dùng ngày hôm nay.
    state.today = cfg.mode === 'fixture' && state.data.generatedAt ? state.data.generatedAt.slice(0, 10) : todayLocal();
    render();
  } catch (e) {
    $('#warnings').innerHTML = '';
    $('#view').innerHTML = `<div class="err"><p><b>Không tải được dữ liệu.</b></p><p>${esc(e.message)}</p><button type="button" id="retry">Thử lại</button></div>`;
  }
}

document.addEventListener('click', (e) => {
  const p = e.target.closest('[data-person]');
  if (p) { state.person = p.dataset.person; render(); }
  const pie = e.target.closest('[data-pie]');
  if (pie) { state.pieScope = pie.dataset.pie; render(); }
  const rv = e.target.closest('[data-rv]');
  if (rv) { state.reportView = rv.dataset.rv; render(); }
  const ex = e.target.closest('[data-export]');
  if (ex) doExport(ex.dataset.export);
  if (e.target.closest('#retry, #refresh')) load();
});
window.addEventListener('hashchange', render);
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', render);
load();
