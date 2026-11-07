// Vẽ biểu đồ bằng Chart.js (public/vendor/chart.umd.js). Màu lấy từ biến CSS (--ch-*) nên theo giao diện sáng/tối.
let charts = [];
export const chartsReady = () => typeof window.Chart !== 'undefined';
export function destroyCharts() { charts.forEach((c) => c.destroy()); charts = []; }

const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const nf = new Intl.NumberFormat('vi-VN');
const full = (v) => `${nf.format(Math.round(v))} đ`;
export const compact = (v) => (v >= 1e6 ? `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr` : v >= 1e3 ? `${nf.format(v / 1e3)}k` : String(v));

/** Nền sọc chéo = số ước tính (cùng màu thực thể, khác kết cấu). */
function hatch(color, bg) {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 8, 8);
  x.strokeStyle = color; x.lineWidth = 2; x.beginPath();
  x.moveTo(0, 8); x.lineTo(8, 0); x.moveTo(-2, 2); x.lineTo(2, -2); x.moveTo(6, 10); x.lineTo(10, 6); x.stroke();
  return x.createPattern(c, 'repeat');
}

export function drawBar(canvas, report) {
  const surface = css('--card'), vay = css('--ch-0'), the = css('--ch-4');
  const ms = report.months;
  const ds = (label, key, bg, extra = {}) => ({ label, data: ms.map((m) => m[key]), backgroundColor: bg, borderColor: surface, borderWidth: 2, stack: 's', ...extra });
  charts.push(new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: ms.map((m) => `${Number(m.key.slice(5))}/${m.key.slice(2, 4)}`),
      datasets: [
        ds('Khoản vay · Đã xác nhận', 'vay', vay),
        ds('Thẻ · Đã xác nhận', 'theOk', the),
        ds('Thẻ · Ước tính', 'theEst', hatch(the, surface), { borderColor: the, borderWidth: 1 }),
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { filter: (i) => i.parsed.y > 0, callbacks: { label: (i) => `${i.dataset.label}: ${full(i.parsed.y)}`, footer: (items) => `Tổng: ${full(ms[items[0].dataIndex].total)}` } },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: css('--muted'), maxRotation: 0 } },
        y: { stacked: true, beginAtZero: true, grid: { color: css('--line') }, border: { display: false }, ticks: { color: css('--muted'), callback: compact, maxTicksLimit: 5 } },
      },
    },
  }));
}

export const pieColor = (i, row) => (row.other ? css('--ch-other') : css(`--ch-${i}`));

export function drawPie(canvas, shares) {
  const surface = css('--card');
  charts.push(new window.Chart(canvas, {
    type: 'doughnut',
    data: { labels: shares.rows.map((r) => r.name), datasets: [{ data: shares.rows.map((r) => r.total), backgroundColor: shares.rows.map((r, i) => pieColor(i, r)), borderColor: surface, borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, cutout: '58%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => `${i.label}: ${full(i.parsed)} (${Math.round(shares.rows[i.dataIndex].pct * 100)}%)` } } },
    },
  }));
}
