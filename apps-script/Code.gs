/**
 * Endpoint CHỈ ĐỌC cho app "Sổ nợ Trang & Dũng".
 * Dán vào Apps Script gắn với Google Sheet (Tiện ích mở rộng > Apps Script).
 * Khóa bí mật đặt ở Thuộc tính tập lệnh: APP_KEY (không ghi trong code).
 * Trả về nguyên giá trị đã tính của từng tab; ngày đổi sang yyyy-MM-dd.
 */
var TABS = ['Thông số', 'Khoản vay', 'Linh hoạt', 'Thẻ', 'Nhật ký'];

function doGet(e) {
  var key = PropertiesService.getScriptProperties().getProperty('APP_KEY');
  if (!key || !e || !e.parameter || e.parameter.key !== key) {
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
