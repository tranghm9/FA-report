/**
 * Endpoint CHỈ ĐỌC cho app "Sổ nợ Trang & Dũng".
 * Dán vào Apps Script gắn với Google Sheet (Tiện ích mở rộng > Apps Script).
 * Khóa bí mật đặt ở Thuộc tính tập lệnh: APP_KEY (không ghi trong code).
 * Trả về nguyên giá trị đã tính của từng tab; ngày đổi sang yyyy-MM-dd.
 */
var TABS = ['Thông số', 'Khoản vay', 'Linh hoạt', 'Thẻ', 'Nhật ký'];

function doGet(e) {
  var key = PropertiesService.getScriptProperties().getProperty('APP_KEY');
  if (!key) return out_({ ok: false, error: 'unauthorized' });
  if (key.length < 12) return out_({ ok: false, error: 'weak-key' }); // khóa ngắn dễ bị đoán
  var given = e && e.parameter && e.parameter.key ? String(e.parameter.key) : '';
  if (!same_(given, key)) {
    Utilities.sleep(1500); // mỗi lần đoán sai mất 1,5 giây: làm khó việc đoán hàng loạt
    return out_({ ok: false, error: 'unauthorized' });
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();
  var tabs = {};
  TABS.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    var v = sh.getDataRange().getValues().map(function (r) {
      return r.map(function (c) {
        return c instanceof Date ? Utilities.formatDate(c, tz, 'yyyy-MM-dd') : c;
      });
    });
    tabs[name] = { headers: v[0] || [], rows: v.slice(1) };
  });
  return out_({ ok: true, generatedAt: new Date().toISOString(), tabs: tabs });
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// So sánh hai chuỗi không để lộ chỗ khác nhau đầu tiên qua thời gian phản hồi.
function same_(a, b) {
  var r = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}
