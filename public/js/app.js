import { fetchRaw, normalize } from './data.js';
import { validate, PEOPLE } from './validate.js';
import { todayLocal } from './overview.js';
import { drawBar, drawPie, drawLine, destroyCharts, chartsReady } from './charts.js';
import { buildHistory } from './history.js';
import { toCsv, forecastRows, historyRows, saveBlob, composeImage } from './export.js';
import { buildReport, unitShares, monthLong, kindOf } from './report.js';
import { dateVN, money, TAG } from './format.js';
import { TABS, warningsView, esc } from './views.js';

import { readTheme, writeTheme, applyTheme, resolveConfig, checkDataUrl } from './settings.js';
import { createSecure, PIN_RE } from './secure.js';

const secure = createSecure();
const AUTO_LOCK_MS = 60000; // rời app quá 1 phút thì tự khóa
let cfg = resolveConfig(window.APP_CONFIG, secure.getCfg());
let theme = readTheme();
const prefersDark = () => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
const setTheme = (mode) => applyTheme(mode, { root: document.documentElement, meta: document.querySelector('meta[name="theme-color"]'), prefersDark: prefersDark() });
setTheme(theme);
const fixtureName = new URLSearchParams(location.search).get('fixture') || 'sample';
const $ = (s) => document.querySelector(s);
const state = { data: null, warnings: [], person: 'Tất cả', tab: 'tongquan', today: null, pieScope: 'month', reportView: 'forecast', loadError: null, offlineSince: null };

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

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN') : null);

function render() {
  state.tab = currentTab();
  const settings = state.tab === 'caidat';
  if (!state.data && !settings) return;
  const tab = TABS.find((t) => t.id === state.tab);
  const when = fmtTime(state.data?.generatedAt) ?? 'Chưa có';
  $('#meta').innerHTML = `${cfg.mode === 'fixture' ? '<span class="chip demo">Dữ liệu mẫu</span> ' : ''}Cập nhật: ${esc(when)}`;
  $('#people').hidden = settings;
  $('#people').innerHTML = ['Tất cả', ...PEOPLE]
    .map((p) => `<button type="button" data-person="${esc(p)}" aria-pressed="${p === state.person}">${esc(p)}</button>`).join('');
  const offline = state.offlineSince && !settings
    ? `<div class="offline">${esc(state.loadError)} Đang xem bản đã lưu lúc ${esc(fmtTime(state.offlineSince))}.</div>` : '';
  $('#warnings').innerHTML = settings ? '' : offline + warningsView(state.warnings);
  $('#view').innerHTML = tab.render(state.data, state.person, {
    cfg, theme, loadError: state.loadError, lastSaved: fmtTime(secure.getLast()?.savedAt), secEnabled: secure.enabled, today: state.today, demo: cfg.mode === 'fixture', pieScope: state.pieScope, reportView: state.reportView });
  drawCharts();
  $('#nav').innerHTML = TABS.filter((t) => !t.hidden).map((t) => `<a href="#${t.id}" ${t.id === state.tab ? 'aria-current="page"' : ''}>${esc(t.label)}</a>`).join('');
}

async function load() {
  if (currentTab() !== 'caidat') $('#view').innerHTML = '<p class="empty">Đang tải…</p>';
  state.loadError = null; state.offlineSince = null;
  try {
    const raw = await fetchRaw(cfg, fixtureName);
    state.data = normalize(raw);
    if (cfg.mode === 'live') await secure.setLast(raw);
  } catch (e) {
    state.loadError = e.message;
    const last = cfg.mode === 'live' ? secure.getLast() : null;
    try {
      if (!last) throw e;
      state.data = normalize(last.raw);
      state.offlineSince = last.savedAt; // mất mạng/lỗi: xem tạm bản đã lưu, nói rõ cho người dùng
    } catch {
      state.data = null;
      if (currentTab() === 'caidat') { render(); return; }
      $('#warnings').innerHTML = '';
      $('#view').innerHTML = `<div class="err"><p><b>Không tải được dữ liệu.</b></p><p>${esc(e.message)}</p><button type="button" id="retry">Thử lại</button> <a class="lnk" href="#caidat">Mở Cài đặt</a></div>`;
      return;
    }
  }
  state.warnings = validate(state.data);
  // Dữ liệu mẫu dùng ngày của chính nó để kết quả luôn giống nhau; dữ liệu thật dùng ngày hôm nay.
  state.today = cfg.mode === 'fixture' && state.data.generatedAt ? state.data.generatedAt.slice(0, 10) : todayLocal();
  render();
}

async function saveSettings() {
  const url = document.getElementById('cfgUrl').value.trim();
  const typed = document.getElementById('cfgKey').value.trim();
  const msg = document.getElementById('cfgMsg');
  const err = checkDataUrl(url);
  if (err) { msg.textContent = err; return; }
  const key = typed || secure.getCfg()?.dataKey || '';
  if (!key) { msg.textContent = 'Hãy nhập khóa truy cập.'; return; }
  if (key.length < 12) { msg.textContent = 'Khóa quá ngắn. Hãy đặt APP_KEY dài ít nhất 12 ký tự trong Apps Script rồi nhập lại ở đây.'; return; }
  if (!(await secure.setCfg({ dataUrl: url, dataKey: key }))) { msg.textContent = 'Không lưu được trên thiết bị này (có thể đang bật chế độ riêng tư).'; return; }
  cfg = resolveConfig(window.APP_CONFIG, secure.getCfg());
  location.hash = 'tongquan';
  load();
}

// ---------- khóa ứng dụng ----------
const lockEl = () => document.getElementById('lock');
let fails = 0, lockedUntil = 0, wipeArmed = false;

function showLock() {
  state.data = null; state.warnings = []; state.offlineSince = null;
  destroyCharts();
  cfg = resolveConfig(window.APP_CONFIG, null); // không giữ địa chỉ/khóa trong bộ nhớ khi đang khóa
  for (const id of ['#view', '#warnings', '#nav', '#meta', '#people']) $(id).innerHTML = '';
  document.body.classList.add('is-locked');
  lockEl().hidden = false;
  document.getElementById('pin').value = '';
  document.getElementById('pinMsg').textContent = '';
  wipeArmed = false; document.getElementById('pinForgot').textContent = 'Quên mã PIN';
  document.getElementById('pin').focus();
}
function lockApp() { secure.lock(); showLock(); }

async function tryUnlock() {
  const msg = document.getElementById('pinMsg');
  const wait = Math.ceil((lockedUntil - Date.now()) / 1000);
  if (wait > 0) { msg.textContent = `Thử lại sau ${wait} giây.`; return; }
  const pin = document.getElementById('pin').value;
  if (!PIN_RE.test(pin)) { msg.textContent = 'Mã PIN gồm 6 đến 12 chữ số.'; return; }
  if (await secure.unlock(pin)) {
    fails = 0; lockedUntil = 0;
    lockEl().hidden = true; document.body.classList.remove('is-locked');
    cfg = resolveConfig(window.APP_CONFIG, secure.getCfg());
    load();
    return;
  }
  fails++;
  document.getElementById('pin').value = '';
  if (fails >= 3) { const sec = Math.min(300, 5 * 2 ** (fails - 3)); lockedUntil = Date.now() + sec * 1000; msg.textContent = `Sai mã PIN. Chờ ${sec} giây rồi thử lại.`; }
  else msg.textContent = 'Sai mã PIN.';
}

function forgotPin() {
  const b = document.getElementById('pinForgot');
  if (!wipeArmed) { wipeArmed = true; b.textContent = 'Bấm lần nữa để XÓA mọi dữ liệu và địa chỉ đã lưu trên máy này'; return; }
  secure.wipe();
  cfg = resolveConfig(window.APP_CONFIG, null);
  lockEl().hidden = true; document.body.classList.remove('is-locked');
  location.hash = 'caidat';
  load();
}

async function enableLock() {
  const a = document.getElementById('secPin').value, b = document.getElementById('secPin2').value, msg = document.getElementById('secMsg');
  if (!PIN_RE.test(a)) { msg.textContent = 'Mã PIN gồm 6 đến 12 chữ số.'; return; }
  if (a !== b) { msg.textContent = 'Hai lần nhập mã PIN chưa giống nhau.'; return; }
  msg.textContent = 'Đang bật khóa…';
  try { await secure.enable(a); } catch (e) { msg.textContent = e.message; return; }
  render();
  document.getElementById('secMsg').textContent = 'Đã bật khóa. App sẽ tự khóa khi bạn rời đi hơn 1 phút.';
}

async function disableLock() {
  const msg = document.getElementById('secMsg');
  msg.textContent = 'Đang kiểm tra…';
  if (await secure.disable(document.getElementById('secPinCur').value)) { render(); document.getElementById('secMsg').textContent = 'Đã tắt khóa.'; }
  else msg.textContent = 'Sai mã PIN.';
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (secure.enabled && !secure.locked && hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS) lockApp();
});

document.addEventListener('click', async (e) => {
  const p = e.target.closest('[data-person]');
  if (p) { state.person = p.dataset.person; render(); }
  const pie = e.target.closest('[data-pie]');
  if (pie) { state.pieScope = pie.dataset.pie; render(); }
  const rv = e.target.closest('[data-rv]');
  if (rv) { state.reportView = rv.dataset.rv; render(); }
  const ex = e.target.closest('[data-export]');
  if (ex) doExport(ex.dataset.export);
  if (e.target.closest('#retry, #refresh')) load();
  const th = e.target.closest('[data-theme-set]');
  if (th) { theme = th.dataset.themeSet; writeTheme(theme); setTheme(theme); render(); } // render lại để biểu đồ lấy màu mới
  if (e.target.closest('#cfgSave')) saveSettings();
  if (e.target.closest('#pinOk')) tryUnlock();
  if (e.target.closest('#pinForgot')) forgotPin();
  if (e.target.closest('#secOn')) enableLock();
  if (e.target.closest('#secOff')) disableLock();
  if (e.target.closest('#secNow')) lockApp();
  if (e.target.closest('#cfgClear')) { await secure.clearCfg(); cfg = resolveConfig(window.APP_CONFIG, null); location.hash = 'tongquan'; load(); }
  if (e.target.closest('#cacheClear')) { await secure.clearLast(); render(); const m = document.getElementById('cacheMsg'); if (m) m.textContent = 'Đã xóa.'; }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'pin') tryUnlock(); });
window.addEventListener('hashchange', render);
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { setTheme(theme); render(); });
if (secure.locked) showLock(); else load();

if ('serviceWorker' in navigator && (location.hostname !== 'localhost' || location.search.includes('sw=1'))) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
