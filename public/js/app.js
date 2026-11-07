import { fetchRaw, normalize } from './data.js';
import { validate, PEOPLE } from './validate.js';
import { TABS, warningsView, esc } from './views.js';

const cfg = window.APP_CONFIG || { mode: 'fixture' };
const fixtureName = new URLSearchParams(location.search).get('fixture') || 'sample';
const $ = (s) => document.querySelector(s);
const state = { data: null, warnings: [], person: 'Tất cả', tab: 'vay' };

function currentTab() {
  const id = location.hash.slice(1);
  return TABS.find((t) => t.id === id) ? id : 'vay';
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
  $('#view').innerHTML = tab.render(state.data, state.person);
  $('#nav').innerHTML = TABS.map((t) => `<a href="#${t.id}" ${t.id === state.tab ? 'aria-current="page"' : ''}>${esc(t.label)}</a>`).join('');
}

async function load() {
  $('#view').innerHTML = '<p class="empty">Đang tải…</p>';
  try {
    state.data = normalize(await fetchRaw(cfg, fixtureName));
    state.warnings = validate(state.data);
    render();
  } catch (e) {
    $('#warnings').innerHTML = '';
    $('#view').innerHTML = `<div class="err"><p><b>Không tải được dữ liệu.</b></p><p>${esc(e.message)}</p><button type="button" id="retry">Thử lại</button></div>`;
  }
}

document.addEventListener('click', (e) => {
  const p = e.target.closest('[data-person]');
  if (p) { state.person = p.dataset.person; render(); }
  if (e.target.closest('#retry, #refresh')) load();
});
window.addEventListener('hashchange', render);
load();
