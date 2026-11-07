// Xuất báo cáo: CSV (hàm thuần, có test) và ảnh PNG (vẽ lên canvas), lưu bằng hộp chia sẻ của điện thoại hoặc tải xuống.
import { buildReport, kindOf, monthLabel } from './report.js';
import { buildHistory } from './history.js';
import { TAG } from './format.js';

const label = (k) => (k ? TAG[k] : '');
const num = (v) => (v ? Math.round(v) : ''); // 0 hoặc thiếu -> ô trống (không ghi số 0 giả)

/** CSV cho Excel/Google Sheet tiếng Việt: dấu ';', UTF-8 có BOM, xuống dòng CRLF. */
export function toCsv(rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${rows.map((r) => r.map(esc).join(';')).join('\r\n')}\r\n`;
}

const people = (p) => (p === 'Tất cả' ? ['Trang', 'Dũng', 'Tất cả'] : [p]);

export function forecastRows(d, person, today) {
  const rows = [['Người', 'Tháng', 'Khoản vay (VND)', 'Nhãn khoản vay', 'Thẻ (VND)', 'Nhãn thẻ', 'Tổng (VND)', 'Nhãn tổng']];
  for (const p of people(person)) {
    for (const m of buildReport(d, p, today).months) {
      rows.push([p, m.key, num(m.vay), m.vay ? TAG.confirmed : '', num(m.theOk + m.theEst), label(kindOf(m.theOk, m.theEst)),
        num(m.total), label(kindOf(m.vay + m.theOk, m.theEst))]);
    }
  }
  return rows;
}

export function historyRows(d, person, today) {
  const rows = [['Người', 'Mốc (ngày)', 'Khoản vay còn lại (VND)', 'Nhãn khoản vay', 'Thẻ: dư nợ kỳ (VND)', 'Nhãn thẻ', 'Tổng (VND)', 'Nhãn tổng']];
  for (const p of people(person)) {
    for (const pt of buildHistory(d, p, today).points) {
      rows.push([p, pt.date, pt.vay == null ? '' : Math.round(pt.vay), pt.vay == null ? '' : TAG.estimate,
        pt.the == null ? '' : Math.round(pt.the), pt.the == null ? '' : TAG.confirmed,
        pt.total == null ? '' : Math.round(pt.total), pt.total == null ? '' : label(kindOf(pt.the ?? 0, pt.vay ?? 0))]);
    }
  }
  return rows;
}

/** Lưu tệp: dùng hộp chia sẻ nếu thiết bị hỗ trợ (điện thoại), không thì tải xuống. */
export async function saveBlob(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

/**
 * Ghép ảnh báo cáo: tiêu đề + các biểu đồ + chú giải (kèm nhãn Đã xác nhận/Ước tính) + ghi chú.
 * sections: [{ heading, canvas, legend: [{ cssVar, text, striped }] }]
 */
export async function composeImage({ title, subtitle, sections, notes = [], footer }) {
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const bg = css('--card'), fg = css('--text'), muted = css('--muted'), line = css('--line');
  const S = 2, W = 720, M = 24;
  const font = (px, w = 400) => `${w} ${px * S}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const tall = document.createElement('canvas');
  tall.width = W * S; tall.height = 6000 * S;
  const c = tall.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, tall.width, tall.height);
  let y = M;
  const wrap = (text, px, w, maxW) => {
    c.font = font(px, w);
    const out = []; let cur = '';
    for (const word of String(text).split(' ')) {
      const t = cur ? `${cur} ${word}` : word;
      if (c.measureText(t).width > maxW * S && cur) { out.push(cur); cur = word; } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  };
  const para = (text, px, color, w = 400, gap = 4) => {
    c.fillStyle = color;
    for (const ln of wrap(text, px, w, W - 2 * M)) { c.font = font(px, w); c.textBaseline = 'top'; c.fillText(ln, M * S, y * S); y += px * 1.4; }
    y += gap;
  };
  para(title, 22, fg, 700, 2);
  para(subtitle, 13, muted, 400, 10);
  for (const s of sections) {
    para(s.heading, 16, fg, 700, 6);
    const w = W - 2 * M, h = w * (s.canvas.height / s.canvas.width);
    c.drawImage(s.canvas, M * S, y * S, w * S, h * S);
    y += h + 8;
    for (const it of s.legend) {
      c.fillStyle = css(it.cssVar); c.fillRect(M * S, (y + 3) * S, 12 * S, 12 * S);
      if (it.striped) { c.strokeStyle = bg; c.lineWidth = 2 * S; for (let i = -12; i < 12; i += 5) { c.beginPath(); c.moveTo((M + i) * S, (y + 15) * S); c.lineTo((M + i + 12) * S, (y + 3) * S); c.stroke(); } c.fillStyle = bg; c.fillRect((M - 14) * S, (y + 3) * S, 14 * S, 12 * S); c.fillRect((M + 12) * S, (y + 3) * S, 14 * S, 12 * S); }
      c.fillStyle = fg; c.font = font(13); c.textBaseline = 'top';
      const lines = wrap(it.text, 13, 400, W - 2 * M - 22);
      lines.forEach((ln, i) => c.fillText(ln, (M + 20) * S, (y + 1 + i * 18) * S));
      y += Math.max(18, lines.length * 18) + 2;
    }
    y += 10;
  }
  if (notes.length) { para('Lưu ý', 14, fg, 700, 2); notes.forEach((n) => para(`• ${n}`, 12, muted, 400, 2)); y += 6; }
  c.fillStyle = line; c.fillRect(M * S, y * S, (W - 2 * M) * S, S); y += 8;
  para(footer, 11, muted, 400, 0);
  y += M;
  const out = document.createElement('canvas');
  out.width = W * S; out.height = Math.ceil(y * S);
  out.getContext('2d').drawImage(tall, 0, 0, out.width, out.height, 0, 0, out.width, out.height);
  return new Promise((res) => out.toBlob(res, 'image/png'));
}

export { monthLabel };
