# Tài liệu bàn giao: tích hợp tính năng của "Sổ nợ Trang & Dũng" vào ứng dụng khác

Dành cho cuộc hội thoại/dự án khác cần **dùng lại logic và tính năng** của app này, trong khi giao diện đã có thiết kế riêng.
Repo nguồn: https://github.com/tranghm9/FA-report (Public, nhánh `main`). Nguồn chuẩn về dữ liệu và quy tắc: `CLAUDE.md` trong repo đó.

> Không gửi kèm dữ liệu thật, địa chỉ Apps Script, khóa `APP_KEY`, mã PIN hoặc mã Google Sheet. Repo nguồn cố ý không chứa các thứ này. Thử bằng `fixtures/sample.json` (ẩn danh).

## 1. App làm gì

PWA chạy trên điện thoại, **chỉ đọc**, theo dõi nợ của hai người (Trang, Dũng) từ một Google Sheet 4 tab (Khoản vay, Thẻ, Linh hoạt, Nhật ký + tab Thông số). Không backend, không database: Google Apps Script trả JSON, trình duyệt tự tính toán.
Màn hình: Tổng quan (dư nợ, quá hạn, đến hạn 7 ngày) · Báo cáo (dự kiến 7 tháng: cột + tròn; lịch sử dư nợ: đường; xuất CSV/ảnh) · Khoản vay · Thẻ · Nhật ký · Cài đặt (giao diện sáng/tối, khóa PIN, nguồn dữ liệu).
Công nghệ: HTML + JavaScript ES module thuần, **không phụ thuộc npm** (trừ Chart.js 4.4.1 đặt sẵn ở `public/vendor/`). Test: `npm test` (node:test, 54 test).

## 2. Cách tách lớp: cái gì dùng lại được ngay

Lớp **logic** (hàm thuần, không đụng DOM, chạy được trong Node) tách khỏi lớp **giao diện**. Khi tích hợp, nên lấy lớp logic và viết lại lớp giao diện theo thiết kế mới.

| Tệp (`public/js/`) | Vai trò | Phụ thuộc | Dùng lại |
|---|---|---|---|
| `parse.js` | Chuyển giá trị thô (số, chuỗi kiểu VN "2.914.311", "3,0%", "dd/mm/yyyy") sang chuẩn; thiếu thì `null` (không phải 0) | không | Nguyên xi |
| `schema.js` | Ánh xạ tiêu đề cột Sheet → tên trường | parse | Nguyên xi |
| `data.js` | `normalize(raw)`; `fetchRaw(cfg)` (gọi Apps Script, có map lỗi) | schema, parse | Nguyên xi (`fetchRaw` dùng `fetch`) |
| `validate.js` | Phát hiện dữ liệu mâu thuẫn, công thức đáo thẻ | parse | Nguyên xi |
| `format.js` | `NA`, `money`, `dateVN`, `TAG` (nhãn), `cardAmountKind` | không | Nguyên xi hoặc thay định dạng |
| `overview.js` | Dư nợ hiện tại, khoản đến hạn, quá hạn chưa ghi nhận | validate, format | Nguyên xi |
| `report.js` | Dự kiến phải trả 7 tháng, cơ cấu theo đơn vị | validate | Nguyên xi |
| `history.js` | Lịch sử dư nợ dựng từ Nhật ký | parse, validate, report | Nguyên xi |
| `export.js` | CSV (hàm thuần) + ảnh PNG/lưu tệp (cần DOM/canvas) | report, history, format | CSV nguyên xi; phần ảnh viết lại theo giao diện |
| `secure.js` | Khóa PIN: mã hóa AES-GCM + PBKDF2 (WebCrypto), truyền `storage` vào được | settings | Nguyên xi nếu cần khóa |
| `settings.js` | Cấu hình nguồn dữ liệu trên máy, giao diện sáng/tối (`storage`/`root` truyền vào) | không | Nguyên xi hoặc bỏ phần theme |
| `views.js`, `charts.js`, `app.js`, `styles.css` | Giao diện, vẽ biểu đồ, nối trạng thái | các lớp trên | **Viết lại** theo thiết kế mới (chỉ tham khảo) |

Đồ thị phụ thuộc (không vòng): `parse → schema → data`; `parse → validate → {overview, report → history} → export`; `settings → secure`.

## 3. Hợp đồng dữ liệu

**Apps Script** (`apps-script/Code.gs`, chỉ đọc): `GET <URL>/exec?key=<APP_KEY>` trả
`{ ok: true, generatedAt: ISO, tabs: { "<Tên tab>": { headers: [...], rows: [[...]] } } }`. Ngày là `yyyy-MM-dd`, ô trống là `""`. Lỗi: `{ ok:false, error:'unauthorized' | 'weak-key' }`. `APP_KEY` phải ≥ 12 ký tự (lưu ở Script Properties); sai khóa thì chờ 1,5 giây.
Tên tab: `Thông số`, `Khoản vay`, `Linh hoạt`, `Thẻ`, `Nhật ký`. Cột khớp theo **tiêu đề** (bỏ dấu, không phân biệt hoa thường) nên đổi thứ tự cột vẫn chạy.

**Sau `normalize(raw)`** trả `{ generatedAt, params, khoanVay[], the[], linhHoat[], nhatKy[], missingTabs[], missingColumns[], cellErrors[] }`. Ngày là chuỗi `'YYYY-MM-DD'`, tiền là số (VND), thiếu là `null`.

- `params`: `{ phiDao (0.03), hanMucMucTieu (200000), nhacTruocNgay (3) }`
- `khoanVay[]`: `ma, chu, donVi, moTa, ngayGiaiNgan, tongSoKy, soTienKy, ngayHan, hanKy1, kyKeTiep, hanKyKeTiep, conLai, hanKyCuoi, tenNhac`
- `the[]`: `ma, chu, ten, soCuoi, ngayChot, hanMuc, hanThanhToan, duNoKy, toiThieu, khaDung, cheDo ('Toàn bộ'|'Đáo'), soNap, phiDao, duKien, ghiChu`
- `linhHoat[]`: `ma, chu, donVi, moTa, hanThanhToan, soTien, ghiChu`
- `nhatKy[]`: `ngayGhi, chu, ma, donVi, hanThucTe, duKien, thucTe, trangThai, cheDo, phiDaoThucTe, duNoKyDao, ghiChu`
- `chu` là `'Trang'` hoặc `'Dũng'` (`PEOPLE` trong `validate.js`). Hàm nhận tham số người: `'Tất cả' | 'Trang' | 'Dũng'`.

## 4. Các tính năng và hàm để gọi

Mọi hàm nhận `d` (kết quả `normalize`) và `today` dạng `'YYYY-MM-DD'` (truyền vào để test được; app thật dùng `todayLocal()`).

| Tính năng | Hàm | Trả về |
|---|---|---|
| Đọc và chuẩn hóa | `fetchRaw(cfg)` → `normalize(raw)` | `d` |
| Cảnh báo mâu thuẫn | `validate(d)` | `[{ where, msg }]` (rỗng = sạch) |
| Dư nợ hiện tại | `debtSummary(d, person)` | `{ hasData, loans:{total,count}, cards:{total,count}, total, dueNow, missing[] }` |
| Khoản đến hạn | `dueItems(d)` → `upcoming(items, today, 7)` | `[{ type, ma, chu, name, due, amount, amountKind, log }]` |
| Quá hạn chưa ghi nhận | `overdueUnlogged(items, today)` | cùng dạng trên |
| Báo cáo 7 tháng | `buildReport(d, person, today, 7)` | `{ months[{key, vay, theOk, theEst, total, byUnit, byPerson}], totals, missing[], notes[], earlier }` |
| Cơ cấu theo đơn vị | `unitShares(report, 'month'\|'all', 6)` | `{ rows[{name, ok, est, total, pct, kind, other?}], total }` |
| Lịch sử dư nợ | `buildHistory(d, person, today, 12)` | `{ points[{key, date, vay, the, total}], hasLoans, hasCards, warnings[], enough }` |
| Xuất CSV | `forecastRows(...)` / `historyRows(...)` → `toCsv(rows)` | chuỗi CSV (`;`, BOM, CRLF) |
| Khóa PIN | `createSecure(storage)` | `enable/unlock/lock/disable/wipe`, `getCfg/setCfg/getLast/setLast` |
| Nhãn | `TAG`, `kindOf(ok, est)`, `cardAmountKind(mode)` | `'confirmed' \| 'estimate' \| 'mixed' \| null` |

## 5. Quy tắc nghiệp vụ BẮT BUỘC giữ nguyên

1. **Mỗi con số có nhãn** "Đã xác nhận" (từ Sheet/Nhật ký) hoặc "Ước tính" (dự báo, dựng lại, phí 3%), hoặc "Gồm ước tính" khi tổng trộn cả hai. Không trình bày số ước tính như số chắc chắn. Nhãn cũng có trong CSV và ảnh xuất.
2. **Thiếu dữ liệu → "Chưa có"**, không hiện 0. Dòng thiếu dữ liệu bị loại khỏi tổng và được liệt kê. Trong CSV, ô 0/thiếu để trống.
3. **Dữ liệu mâu thuẫn → hiện cảnh báo**, không tự chọn một số.
4. **Tách riêng Trang và Dũng**; "Tất cả" chỉ là gộp để xem.
5. **Công thức thẻ**: chế độ Toàn bộ: số tiền dự kiến = dư nợ kỳ (Đã xác nhận). Chế độ Đáo (không bao giờ trả tối thiểu): số nạp A = max(0, hạn mức khả dụng mục tiêu − khả dụng hiện tại); phí = 3% × (dư nợ kỳ − A); dự kiến = A + phí (Ước tính, vì phí thật khoảng 1,75–2%). Sheet đã tính sẵn: ưu tiên dùng giá trị trong Sheet, `validate` chỉ đối chiếu (cho lệch ≤ 1.000đ).
6. **Dư nợ hiện tại** = khoản vay còn lại [(tổng kỳ − kỳ kế tiếp + 1) × tiền/kỳ, **Ước tính**] + thẻ [tổng dư nợ kỳ, **Đã xác nhận**]. Không gồm trả góp thẻ chưa lên sao kê (Sheet không có), luôn ghi chú điều này.
7. **Báo cáo tháng**: khoản vay theo lịch hợp đồng (Đã xác nhận). Thẻ: tháng của hạn thanh toán = số dự kiến; các tháng sau lấy như kỳ hiện tại (**Ước tính**). Thẻ có hạn thanh toán đã cũ → mọi tháng là ước tính + ghi chú. Chưa gồm khoản vay mới.
8. **Lịch sử dư nợ**: khoản vay dựng ngược từ Nhật ký (Ước tính); **thẻ KHÔNG dựng ngược** (thẻ phát sinh chi tiêu mới mỗi kỳ nên cộng ngược sẽ phóng đại), mà dùng "dư nợ kỳ" thật ghi trong Nhật ký (Đã xác nhận). Mốc thiếu số thẻ → "Chưa có" và đường đứt.
9. **Quá hạn chưa ghi nhận**: hạn < hôm nay và Nhật ký không có dòng nào cùng Mã và Hạn thực tế = hạn đó (báo thừa còn hơn bỏ sót).
10. Không hard-code số thật; dùng fixtures.

## 6. Thiết kế (chỉ để tham khảo vai trò, không bắt buộc dùng màu hồng)

Giao diện đã chốt: mobile-first (kiểm tra 375px), hồng pastel, có sáng/tối, chữ hệ thống, thẻ bo góc. **Khi tích hợp vào dự án có thiết kế riêng, hãy ánh xạ theo VAI TRÒ**, giữ ngữ nghĩa:

- `confirmed` (Đã xác nhận): xanh mint (`--ok-bg #d9f3e6` / `--ok #1b6847`) · `estimate` / `mixed` (Ước tính, Gồm ước tính): vàng đào (`--est-bg #ffe8c9` / `--est #86500a`) · cảnh báo/quá hạn: đỏ (`--warn-bg #fde4e1` / `--warn #a3201a`), **cố ý khác hẳn màu thương hiệu** để không nhầm.
- Nền/thẻ/chữ sáng: `--bg #fff5f8`, `--card #fff`, `--text #3b2230`, `--muted #86616f`, `--line #f6d8e3`, nhấn `--brand #b83a6b`, mục đang chọn `--pick #fbc9db` chữ `#6d1b3f`. Tối: `#1f1419 / #2a1b23 / #fbe9f0 / #cfa7b8 / #46303b`, nhấn `#f4a3c0`.
- **Màu biểu đồ** (`--ch-0..5`, `--ch-other`): sáng `#b83a6b #4f7fc4 #bd8210 #1f9b78 #6f3f8f #e8715d` + `#8f8590`; tối `#d9608d #5d8fd8 #b88519 #3fa588 #9068c4 #d46a55` + `#a3979f`. Đã kiểm tra khả năng phân biệt màu (CVD) và độ tương phản bằng `validate_palette.js`; nếu đổi màu phải kiểm tra lại. Quy ước: **màu = thực thể** (Khoản vay = `--ch-0`, Thẻ = `--ch-4`), **sọc chéo = ước tính**, nét đứt = ước tính (đường).
- Thành phần: dòng "nhãn — giá trị + chip nhãn", thẻ (card), thẻ nổi bật (số dư nợ), dòng đến hạn (đỏ khi quá hạn), nút chọn dạng segmented, chú giải kèm số và chip nhãn, biểu ngữ cảnh báo, biểu ngữ "Đang xem bản đã lưu lúc …", màn khóa PIN. Mọi biểu đồ có bản chữ tương đương (chú giải kèm số + danh sách chi tiết).
- Người dùng chọn giao diện sáng/tối trong Cài đặt (đè lên chế độ điện thoại): `data-theme` trên `<html>`; đổi giao diện phải vẽ lại biểu đồ vì màu đọc từ biến CSS lúc vẽ.

## 7. Bảo mật và cấu hình (nếu mang theo)

- Bản đăng lên mạng **không chứa** địa chỉ/khóa; người dùng nhập trong Cài đặt, lưu `localStorage` (khóa `sono.cfg`, bản sao dữ liệu `sono.last`). Thứ tự ưu tiên: cấu hình trên máy > `.env` lúc dev > dữ liệu mẫu.
- Khóa PIN (tùy chọn): 6–12 chữ số, AES-GCM 256 + PBKDF2 200.000 vòng, tự khóa khi rời app > 60 giây, sai 3 lần phải chờ, quên PIN thì xóa sạch. **Mọi truy cập cấu hình/bản sao dữ liệu phải đi qua `createSecure`**, không gọi trực tiếp `settings.js`.
- CSP (thẻ meta): script chỉ `'self'` (không script nhúng), kết nối chỉ tới `script.google.com` và `script.googleusercontent.com`. Dự án mới phải chỉnh CSP nếu có nguồn khác. `referrer: no-referrer`.
- Ngoại tuyến: service worker chỉ lưu khung app, không lưu dữ liệu Google; khi mất mạng mở bản dữ liệu đã lưu và **luôn nói rõ** đó là bản cũ.

## 8. Cách tích hợp đề xuất

1. Chọn tính năng cần lấy (bảng mục 4). Sao chép các tệp logic tương ứng (mục 2) cùng `tests/` và `fixtures/` liên quan vào repo mới, ví dụ `src/lib/no/`. Giữ nguyên nội dung, vì có test bảo vệ.
2. Viết lớp giao diện theo thiết kế mới: gọi hàm ở mục 4, hiển thị theo quy tắc mục 5 (nhãn, "Chưa có", cảnh báo). Ánh xạ màu theo vai trò (mục 6).
3. Nối dữ liệu: dùng `fetchRaw` + `normalize` với địa chỉ/khóa do **người dùng nhập**, không đưa vào mã nguồn.
4. Chạy bộ test đã sao chép và đối chiếu **số chuẩn** ở mục 9. Sai số nào thì lỗi nằm ở chỗ đó.
5. Nếu thêm quy tắc/cột mới, cập nhật tài liệu dữ liệu tương đương `CLAUDE.md` của repo mới.

Cạm bẫy thường gặp: (a) ngày là **chuỗi** ISO, đừng đổi sang `Date` (lệch múi giờ); (b) `null` khác 0; (c) hàm tính toán cần `today` truyền vào; (d) tab "Linh hoạt" được tính chung vào "Khoản vay" trong báo cáo tháng; (e) `4 số cuối` thẻ phải giữ số 0 đầu (chuỗi); (f) CSV dùng `;` và BOM cho Excel/Sheet tiếng Việt.

## 9. Số chuẩn để kiểm tra (dữ liệu `fixtures/sample.json`, `today = 2026-11-07`)

- `validate(sample)` → `[]`; `validate(sample-conflict)` → 4 cảnh báo.
- `debtSummary`: **Trang** vay còn lại 2.200.000 · thẻ 8.600.000 · tổng **10.800.000** · đến kỳ 9.450.000. **Dũng** tổng **12.110.000** · đến kỳ 10.470.000.
- Đến hạn 7 ngày (Tất cả), thứ tự: T01, T04, V01, T03. Quá hạn chưa ghi nhận: V02.
- `buildReport('Tất cả')` tháng 11/2026: vay 2.070.000 · thẻ đã xác nhận 4.850.000 · thẻ ước tính 467.600 · tổng **7.387.600**. Tháng 12: vay 2.070.000, thẻ ước tính 5.317.600. Từ tháng 2/2027: vay 0, thẻ ước tính 5.317.600. Tổng cả kỳ **42.283.200**.
- `unitShares('month')`: 7 dòng (6 đơn vị + "Khác"), dòng đầu "Thẻ VPB" 3.000.000.
- `buildHistory('Tất cả')`: mốc 2026-08, 09, 10, 11. Khoản vay: 6.000.000 / 7.130.000 / 5.060.000 / 5.060.000. Thẻ: `null` / 15.420.000 / 16.540.000 / 17.850.000. Tổng: `null` / 22.550.000 / 21.600.000 / **22.910.000** (mốc cuối khớp tổng dư nợ ở Tổng quan).
- `forecastRows('Trang')` dòng 2026-11: `['Trang','2026-11',850000,'Đã xác nhận',3827600,'Gồm ước tính',4677600,'Gồm ước tính']`.

## 10. Lệnh hữu ích

```bash
git clone https://github.com/tranghm9/FA-report   # lấy mã nguồn
npm test                                           # 54 test, không cần cài gói nào
npm run dev                                        # chạy thử với dữ liệu mẫu (http://localhost:8080)
```
