# Sổ nợ Trang & Dũng — PWA theo dõi nợ (chỉ đọc)

File này là **nguồn chuẩn** cho các phiên sau. Sửa schema/công thức thì sửa ở đây + `public/js/schema.js` + `public/js/validate.js`.
Nguồn dữ liệu duy nhất: Google Sheet "Sổ nợ Trang & Dũng" (mã Sheet cố ý KHÔNG ghi trong repo vì repo công khai; hỏi người dùng khi cần). App **chỉ đọc**, không ghi ngược Sheet.

## Kiến trúc
- Không backend, không database, **không npm dependency** (HTML + JS module thuần; Chart.js thêm ở M3). Test: `npm test` (node:test). Chạy thử: `npm run dev` (http://localhost:8080). Build: `npm run build` -> `dist/`.
- Dữ liệu: Google Apps Script (`apps-script/Code.gs`, `doGet`, kiểm khóa `APP_KEY`) trả JSON thô theo tab. URL + khóa đặt trong `.env` (`DATA_URL`, `DATA_KEY`, `DATA_MODE=live|fixture`), `.env` đã nằm trong `.gitignore`. `scripts/config.mjs` sinh `config.js` (`window.APP_CONFIG`). Khóa nằm trong trang đã deploy nên chỉ là bảo vệ nhẹ: không chia sẻ link app công khai.
- Dev/test dùng `fixtures/sample.json` (ẩn danh, sạch) và `fixtures/sample-conflict.json` (cố ý có 4 mâu thuẫn; mở bằng `/?fixture=sample-conflict`). **Không hard-code số thật; không dán dữ liệu thật vào chat/repo.**
- Định dạng JSON: `{ ok, generatedAt, tabs: { "<Tên tab>": { headers: [...], rows: [[...]] } } }`; ngày dạng `yyyy-MM-dd`, ô trống `""`. `normalize()` cũng đọc được chuỗi kiểu Việt ("2.914.311", "3,0%", "09/11/2026"). Cột khớp theo **tiêu đề** (không phân biệt dấu/hoa thường) nên đổi thứ tự cột vẫn chạy. Dữ liệu thiếu -> `null` -> hiện "Chưa có" (không bao giờ hiện 0).
- Mã nguồn: `parse.js` (chuyển kiểu), `schema.js` (cột), `data.js` (tải + chuẩn hóa), `validate.js` (mâu thuẫn + công thức đáo), `format.js`, `overview.js` (M2), `report.js` + `charts.js` (M3), `history.js` + `export.js` (M4), `views.js`, `app.js`.

## Các tab (tiêu đề cột đúng như trong Sheet)
**Thông số** (3 cột: Thông số | Giá trị | Ghi chú; đọc theo nhãn dòng): "Phí đáo thẻ dùng làm ngân sách (%)" = 3%; "Hạn mức khả dụng mục tiêu để đáo thẻ (VND)" = 200.000; "Nhắc trước hạn (ngày)" = 3. Các dòng khác (giờ nhắc, id danh sách nhắc, tên đơn vị chuẩn, quy ước kỳ, quy tắc dư nợ) là ghi chú vận hành, app không dùng.
Đơn vị chuẩn: Thẻ VPB, Thẻ VIB, Thẻ UOB, Thẻ Home, Thẻ SCB, SPL, SEV, Momo VTS, Mcredit Momo, Momo Vay Nhanh, ZLP, Vay Home.

**Khoản vay** (mỗi hợp đồng một dòng): Mã (Vxx) · Chủ · Đơn vị · Hợp đồng / mô tả · Ngày giải ngân · Tổng số kỳ · Số tiền / kỳ (VND) · Ngày hạn hằng tháng · Hạn kỳ 1 · Kỳ kế tiếp (chưa trả) · Hạn kỳ kế tiếp* · Còn lại sau kỳ kế tiếp* · Hạn kỳ cuối* · Tên nhắc kỳ kế tiếp (gợi ý)*. (*= công thức trong Sheet; dùng giá trị đã tính.) Kỳ 1 = tháng liền sau ngày giải ngân. Trả xong một kỳ thì người dùng tăng "Kỳ kế tiếp" thêm 1.

**Thẻ** (mỗi thẻ/ví một dòng; gồm thẻ ngân hàng, SPL, Momo VTS): Mã (Txx) · Chủ · Thẻ · 4 số cuối (giữ số 0 đầu, chỉ lưu 4 số) · Ngày chốt sao kê (ngày trong tháng) · Hạn mức được cấp · Hạn thanh toán (kỳ gần nhất) · Dư nợ kỳ (sao kê gần nhất) · Tối thiểu (không trả) · Hạn mức khả dụng hiện tại (**có thể trống** -> "Chưa có") · Chế độ kỳ này (`Toàn bộ` | `Đáo`) · Số nạp để khả dụng đạt mục tiêu* · Phí đáo ngân sách* · Số tiền dự kiến* · Ghi chú.
SPL và Momo VTS: luôn trả toàn bộ, không có số tối thiểu (để trống).

**Linh hoạt**: Mã · Chủ · Đơn vị · Mô tả · Hạn thanh toán · Số tiền (VND) · Ghi chú. Hiện trống; dành cho khoản không theo thẻ/hợp đồng.

**Nhật ký** (mỗi quyết định/khoản trả một dòng): Ngày ghi · Chủ · Mã · Đơn vị · Hạn thực tế · Dự kiến (VND) · Thực tế (VND) · Trạng thái (vd `Đã trả`) · Chế độ thẻ · Phí đáo thực tế · Dư nợ kỳ đáo · Ghi chú / quyết định.

## Công thức (Sheet tính sẵn; app chỉ dùng để đối chiếu)
- Chế độ **Toàn bộ**: Số tiền dự kiến = Dư nợ kỳ.
- Chế độ **Đáo** (không bao giờ trả tối thiểu): Số nạp A = max(0, hạn mức khả dụng mục tiêu − hạn mức khả dụng hiện tại); Phí = 3% × (Dư nợ kỳ − A); Số tiền dự kiến = A + Phí. Phí thật khoảng 1,75–2%; 3% là dự phòng -> **Ước tính**.
- `validate.js` cho phép lệch ≤ 1.000đ khi đối chiếu (chưa rõ cách làm tròn của Sheet).
- Khoản vay: Còn lại sau kỳ kế tiếp = Tổng số kỳ − Kỳ kế tiếp.
- **Dư nợ**: Sheet chỉ có "dư nợ kỳ" (dư nợ đến kỳ) của từng thẻ; *tổng dư nợ* có thể lớn hơn vì còn trả góp chưa đến kỳ (Sheet không có số này). Số cần trả và phí đáo dùng dư nợ đến kỳ.

## Quy tắc hiển thị (bắt buộc)
1. Mỗi số kèm nhãn **Đã xác nhận** (Sheet/Nhật ký: số khoản vay, sao kê, thực tế đã ghi; số dự kiến của thẻ chế độ Toàn bộ) hoặc **Ước tính** (dự báo, phí 3%, số nạp/phí/dự kiến của thẻ Đáo, cột "Dự kiến" trong Nhật ký).
2. Dữ liệu mâu thuẫn -> hiện cảnh báo (`warningsView`), không tự chọn số. Đã có kiểm tra: còn-lại-sai, dự kiến lệch công thức, dư nợ > hạn mức, tối thiểu > dư nợ, mã trùng, chủ lạ, "Đã trả" thiếu số thực tế, thiếu tab/cột, ô lỗi công thức.
3. Thiếu -> "Chưa có", không hiện 0.
4. Tách riêng Trang và Dũng (bộ lọc Tất cả/Trang/Dũng; mục "Tất cả" nhóm theo người).

## Tiến độ
- M1 (xong): khung app, dữ liệu mẫu, 3 màn hình bảng (Khoản vay, Thẻ, Nhật ký), cảnh báo mâu thuẫn, test.
- M2 (xong): màn Tổng quan (`overview.js`, tab mặc định): dư nợ hiện tại, quá hạn chưa có ghi nhận, đến hạn trong 7 ngày; tách Trang/Dũng. Giao diện đổi sang hồng pastel (token màu ở đầu `styles.css`; xanh mint = Đã xác nhận, vàng = Ước tính, đỏ = cảnh báo/quá hạn).
- M3 (xong): tab Báo cáo (`report.js`, `charts.js`): cột chồng 7 tháng, tròn theo đơn vị (Tháng này / 7 tháng), chi tiết từng tháng, theo bộ lọc người.
- M4 (xong): trong tab Báo cáo có nút chuyển "Dự kiến 7 tháng" / "Lịch sử dư nợ" (biểu đồ đường); nút Tải CSV và Lưu ảnh cho từng màn.
- M5 (xong): PWA (manifest, service worker, icon), màn Cài đặt (nhập địa chỉ + khóa trên máy), xem bản đã lưu khi mất mạng, workflow GitHub Pages + `netlify.toml`, hướng dẫn trong README.

## Quy tắc nghiệp vụ đã chốt (M2)
- **Dư nợ hiện tại** (người dùng chọn "cách 1") = Khoản vay còn lại + Thẻ dư nợ kỳ. Nhãn **Ước tính**, kèm số **Đến kỳ** (Đã xác nhận).
  - Khoản vay còn lại = (Tổng số kỳ − Kỳ kế tiếp + 1) × Số tiền/kỳ, cộng mọi hợp đồng (ước tính vì giả định không đổi lịch, không phí).
  - Thẻ = Σ Dư nợ kỳ (sao kê). Không gồm trả góp thẻ chưa lên sao kê (Sheet không có) — luôn ghi chú điều này.
  - Đến kỳ = số tiền kỳ tới của khoản vay còn nợ + Σ dư nợ kỳ của thẻ.
  - Dòng thiếu dữ liệu bị loại khỏi tổng và liệt kê "Chưa đủ dữ liệu"; người không có dòng nào -> "Chưa có".
- **Đến hạn trong 7 ngày**: hạn từ hôm nay đến hôm nay+7 (tính cả hai đầu). Hạn = Hạn kỳ kế tiếp (vay), Hạn thanh toán (thẻ), Hạn thanh toán (Linh hoạt). Số tiền: vay = Số tiền/kỳ (Đã xác nhận); thẻ = Số tiền dự kiến (Toàn bộ: Đã xác nhận, Đáo: Ước tính).
- **Quá hạn chưa có ghi nhận**: hạn < hôm nay và Nhật ký không có dòng nào cùng **Mã** và **Hạn thực tế = hạn đó** (mọi trạng thái đều tính là đã có ghi nhận). Giả định: người dùng ghi đúng ngày hạn vào "Hạn thực tế"; nếu hạn thực tế lệch với hạn trong Sheet thì khoản sẽ bị báo quá hạn (chủ ý: báo thừa còn hơn bỏ sót).
- "Hôm nay": dữ liệu thật dùng ngày của thiết bị; dữ liệu mẫu dùng ngày của `generatedAt` để kết quả cố định.

## Quy tắc nghiệp vụ đã chốt (M3 - Báo cáo tháng)
- Cửa sổ: tháng hiện tại + 6 tháng tới (7 cột). Lọc Tất cả/Trang/Dũng dùng chung với các màn khác; ở "Tất cả" mỗi tháng ghi thêm số của từng người.
- **Khoản vay** (và tab Linh hoạt, tính chung vào "Khoản vay"): mỗi kỳ chưa trả (từ Kỳ kế tiếp đến Tổng số kỳ) rơi vào tháng của Hạn kỳ kế tiếp + i tháng. Nhãn **Đã xác nhận** (lịch hợp đồng). Kỳ rơi vào trước tháng này = quá hạn, không vẽ, chỉ ghi chú riêng.
- **Thẻ** (người dùng chọn "cách 2"): tháng của "Hạn thanh toán" = Số tiền dự kiến (Toàn bộ: **Đã xác nhận**; Đáo: **Ước tính**). Các tháng sau chưa có sao kê -> lấy bằng số kỳ hiện tại, **Ước tính**. Hạn thanh toán đã cũ (trước tháng này) -> mọi tháng là ước tính + ghi chú cần cập nhật. Hạn rơi vào tháng sau -> tháng này của thẻ đó "chưa có số" + ghi chú (không điền 0).
- Chưa gồm khoản vay mới và sao kê thẻ chưa phát sinh (luôn ghi chú).
- Biểu đồ cột: màu = thực thể (Khoản vay = hồng đậm, Thẻ = tím), kết cấu sọc chéo = ước tính. Biểu đồ tròn: tối đa 6 đơn vị + "Khác". Màu biểu đồ là token `--ch-*` trong `styles.css` (đã chạy `validate_palette.js` cho cả sáng/tối; nếu đổi màu phải chạy lại).
- Mọi biểu đồ đều có bản chữ tương đương (chú giải kèm số + danh sách "Chi tiết từng tháng").

## Quy tắc nghiệp vụ đã chốt (M4 - Lịch sử dư nợ + xuất)
- Mốc: cuối mỗi tháng từ tháng có ghi chép sớm nhất của cả sổ (chung cho mọi người để biểu đồ thẳng hàng) đến tháng này; mốc cuối = hôm nay. Tối đa 12 tháng gần nhất.
- **Khoản vay còn lại tại mốc t** (**Ước tính**, dựng ngược, người dùng chọn "cách 1") = dư nợ khoản vay hiện tại (công thức M2) + mọi khoản "Đã trả" có Ngày ghi > t (dùng cột Thực tế). Trước Ngày giải ngân thì khoản đó chưa tính. Cảnh báo nếu một hợp đồng có ít dòng "Đã trả" hơn số kỳ đã qua (Kỳ kế tiếp − 1): dư nợ các mốc trước sẽ thấp hơn thực tế.
- **Thẻ KHÔNG dựng ngược** (đã chỉnh so với cách 1 gốc): thẻ phát sinh chi tiêu mới mỗi kỳ nên cộng ngược khoản trả sẽ phóng đại dư nợ. Thay vào đó dùng "dư nợ kỳ" thật trong Nhật ký (**Đã xác nhận**): chế độ Toàn bộ = Thực tế; Đáo = Dư nợ kỳ đáo; giữ giá trị gần nhất đến lần ghi sau; mốc hôm nay dùng Dư nợ kỳ trong Sheet. Mốc nào có thẻ chưa có số -> thẻ và tổng ở mốc đó là "Chưa có" (không phải 0). Người không có thẻ nào: tổng = khoản vay.
- Tổng = Khoản vay còn lại + Thẻ; nhãn "Gồm ước tính". Mốc hôm nay khớp tổng dư nợ ở màn Tổng quan.
- Chỉ trạng thái "Đã trả" được cộng ngược; trạng thái khác (vd Hoãn) bỏ qua.
- **CSV**: dấu `;`, UTF-8 có BOM, CRLF (mở đúng trên Excel/Sheet tiếng Việt). Có cột nhãn cho mọi số. Số 0/thiếu là ô trống. Chọn "Tất cả" thì xuất thêm khối Trang và Dũng riêng. Hai loại: dự kiến 7 tháng, lịch sử dư nợ.
- **Ảnh PNG**: tiêu đề + biểu đồ + chú giải có nhãn + ghi chú; theo giao diện sáng/tối đang dùng. Lưu bằng hộp chia sẻ của điện thoại (Web Share) nếu có, không thì tải xuống. Trong trang xem thử trên claude.ai, tải xuống bị chặn (chỉ chạy được khi mở app thật).
- Dữ liệu mẫu có lịch sử Th8–Th10/2026; tháng 8 cố ý thiếu dư nợ thẻ để thử hiển thị "Chưa có".

## Quy tắc đã chốt (M5 - PWA + triển khai)
- **Cấu hình nguồn dữ liệu**: ưu tiên (1) cấu hình nhập trong app, lưu `localStorage` (`sono.cfg`); (2) `.env` lúc dev/build (`window.APP_CONFIG`); (3) dữ liệu mẫu. Bản triển khai KHÔNG chứa địa chỉ/khóa (workflow không dùng secrets): trang công khai chỉ hiện dữ liệu mẫu cho tới khi người dùng nhập địa chỉ + khóa trên thiết bị. Lý do: trên GitHub Pages mọi thứ trong trang đều công khai, nhúng khóa vào build thì ai mở `config.js` cũng đọc được Sheet. `.env` vẫn dùng cho chạy thử trên máy.
- **Ngoại tuyến**: service worker (`public/sw.js`, build.mjs gắn danh sách tệp + mã phiên bản) lưu khung app, không lưu dữ liệu Google. Dữ liệu thật lần tải gần nhất lưu riêng trong `localStorage` (`sono.last`); khi lỗi mạng app mở bản đó kèm biểu ngữ "Đang xem bản đã lưu lúc …" (không bao giờ im lặng dùng số cũ). Màn Cài đặt có nút xóa. SW chỉ đăng ký khi không phải localhost (hoặc `?sw=1`).
- **iPhone/Safari**: phải thêm bằng Safari; có `apple-touch-icon`, meta apple-mobile-web-app-*, ô nhập cỡ chữ 16px (tránh tự phóng to), vùng an toàn `env(safe-area-inset-*)`.
- **Triển khai**: `.github/workflows/pages.yml` (test -> build -> Pages) chạy khi đẩy lên `main`; cần bật Settings > Pages > Source = GitHub Actions. Repo phải Public để Pages miễn phí; trước khi đẩy lên repo công khai cần gỡ mã Sheet và thông tin riêng khỏi `CLAUDE.md` nếu người dùng muốn.
- Chưa kiểm tra trên thiết bị thật: Chrome Android và Safari iPhone mới chỉ chạy giả lập (Chromium Pixel 7 / iPhone 14); workflow GitHub Actions chưa chạy thật.

## Giao diện sáng/tối (do người dùng chọn)
- Cài đặt > Giao diện: Theo điện thoại | Sáng | Tối, lưu `localStorage` (`sono.theme`). Sáng/Tối gắn `data-theme` lên `<html>` (đè prefers-color-scheme); "Theo điện thoại" gỡ thuộc tính do app gắn. Script nhỏ trong `<head>` áp dụng ngay khi tải để không nháy màu; `theme-color` đổi theo. Đổi giao diện phải render lại để biểu đồ đọc lại biến màu `--ch-*`.
