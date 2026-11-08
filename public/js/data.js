// Tải dữ liệu thô (Apps Script hoặc fixture) và chuẩn hóa thành đối tượng dùng trong app.
import { SCHEMA, TAB_NAMES, PARAM_TAB } from './schema.js';
import { fold, parseNumber, parsePercent } from './parse.js';

const ERR_CELL = /^#(REF!|N\/A|ERROR!|VALUE!|DIV\/0!|NAME\?|NUM!)/;
const isBlank = (c) => c === null || c === undefined || String(c).trim() === '';

function toRecords(tab, schema, tabName, cellErrors) {
  const hs = (tab.headers || []).map(fold);
  const idx = {};
  const missingColumns = [];
  for (const [field, [header]] of Object.entries(schema)) {
    idx[field] = hs.indexOf(fold(header));
    if (idx[field] < 0) missingColumns.push(header);
  }
  const records = [];
  (tab.rows || []).forEach((r, i) => {
    r.forEach((c, j) => { if (typeof c === 'string' && ERR_CELL.test(c.trim())) cellErrors.push({ tab: tabName, row: i + 2, col: tab.headers?.[j] ?? `cột ${j + 1}` }); });
    if (r.every(isBlank)) return;
    const o = {};
    for (const [field, [, parse]] of Object.entries(schema)) o[field] = idx[field] >= 0 ? parse(r[idx[field]]) : null;
    records.push(o);
  });
  return { records, missingColumns };
}

function readParams(tab) {
  const p = { phiDao: null, hanMucMucTieu: null, nhacTruocNgay: null };
  for (const r of tab?.rows || []) {
    const k = fold(r[0]);
    if (k.startsWith('phi dao the dung lam ngan sach')) p.phiDao = parsePercent(r[1]);
    else if (k.startsWith('han muc kha dung muc tieu')) p.hanMucMucTieu = parseNumber(r[1]);
    else if (k.startsWith('nhac truoc han')) p.nhacTruocNgay = parseNumber(r[1]);
  }
  return p;
}

/** raw = { generatedAt, tabs: { 'Tên tab': { headers: [...], rows: [[...]] } } } */
export function normalize(raw) {
  if (!raw || typeof raw !== 'object' || !raw.tabs) throw new Error('Dữ liệu không đúng định dạng');
  const out = { generatedAt: raw.generatedAt || null, params: readParams(raw.tabs[PARAM_TAB]), missingTabs: [], missingColumns: [], cellErrors: [] };
  if (!raw.tabs[PARAM_TAB]) out.missingTabs.push(PARAM_TAB);
  for (const [key, tabName] of Object.entries(TAB_NAMES)) {
    const tab = raw.tabs[tabName];
    if (!tab) { out.missingTabs.push(tabName); out[key] = []; continue; }
    const { records, missingColumns } = toRecords(tab, SCHEMA[key], tabName, out.cellErrors);
    out[key] = records;
    missingColumns.forEach((c) => out.missingColumns.push({ tab: tabName, column: c }));
  }
  return out;
}

/** Lấy dữ liệu thô theo cấu hình (window.APP_CONFIG). */
export async function fetchRaw(cfg, fixtureName = 'sample') {
  let url;
  if (cfg.mode === 'live') {
    url = cfg.dataUrl + (cfg.dataUrl.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(cfg.dataKey || '');
  } else {
    url = `fixtures/${encodeURIComponent(fixtureName)}.json`;
  }
  let res;
  try { res = await fetch(url, { cache: 'no-store' }); } catch { throw new Error('Không kết nối được. Kiểm tra mạng rồi thử lại.'); }
  if (!res.ok) throw new Error(`Máy chủ trả lỗi ${res.status}.`);
  let json;
  try { json = await res.json(); } catch { throw new Error('Dữ liệu trả về không đọc được (không phải JSON).'); }
  if (json.ok === false) throw new Error(json.error === 'unauthorized' ? 'Sai khóa truy cập (không khớp APP_KEY trong Apps Script).' : json.error === 'weak-key' ? 'APP_KEY trong Apps Script quá ngắn (cần ít nhất 12 ký tự). Hãy đặt lại rồi triển khai phiên bản mới.' : `Lỗi từ Google Sheet: ${json.error}`);
  return json;
}
