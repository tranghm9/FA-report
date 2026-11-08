// Áp dụng giao diện sáng/tối đã chọn ngay khi tải trang để không bị nháy màu. (Tệp riêng để CSP không cần cho phép script nhúng.)
try {
  var t = JSON.parse(localStorage.getItem('sono.theme'));
  if (t === 'light' || t === 'dark') {
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.sonoTheme = '1';
    document.querySelector('meta[name="theme-color"]').content = t === 'dark' ? '#1f1419' : '#fbc9db';
  }
} catch (e) { /* bỏ qua */ }
