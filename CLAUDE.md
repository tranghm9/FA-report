# Sổ nợ Trang & Dũng — PWA theo dõi nợ (chỉ đọc)

File này là **nguồn chuẩn** cho các phiên sau. Sửa schema/công thức thì sửa ở đây + `public/js/schema.js` + `public/js/validate.js`.
Nguồn dữ liệu duy nhất: Google Sheet "Sổ nợ Trang & Dũng" (mã Sheet cố ý KHÔNG ghi trong repo vì repo công khai; hỏi người dùng khi cần). App **chỉ đọc**, không ghi ngược Sheet.

## Kiến trúc
- Không backend, không database, **không npm dependency** (HTML + JS module thuần; Chart.js thêm ở M3). Test: `npm test` (node:test). Chạy thử: `npm run dev` (http://localhost:8080). Build: `npm run build` -> `dist/`.
- Dữ liệu: Google Apps Script (`apps-script/Code.gs`, `doGet`, kiểm khóa `APP_KEY`) trả JSON thô theo tab. URL + khóa đặt trong `.env` (`DATA_URL`, `DATA_KEY`, `DATA_MODE=live|fixture`), `.env` đã nằm trong `.gitignore`. `scripts/config.mjs` sinh `config.js` (`window.APP_CONFIG`). Khóa nằm trong trang đã deploy nên chỉ là bảo vệ nhẹ: không chia sẻ link app công khai.
- Dev/test dùng `fixtures/sample.json` (ẩn danh, sạch) và `fixtures/sample-conflict.json` (cố ý có 4 mâu thuẫn; mở bằng `/?fixture=sample-conflict`). **Không hard-code số thật; không dán dữ liệu thật vào chat/repo.**
- Định dạng JSON: `{ ok, generatedAt, tabs: { "<Tên tab>": { headers: [...], rows: [[...]] } } }`; ngày dạng `yyyy-MM-dd`, ô trống `""`. `normalize()` cũng đọc được chuỗi kiểu Việt ("2.914.311", "3,0%", "09/11/2026"). Cột khớp theo **tiêu đề** (không phân biệt dấu/hoa thường) nên đổi thứ tự cột vẫn chạy. Dữ liệu thiếu -> `null` -> hiện "Chưa có" (không bao giờ hiện 0).
- Mã nguồn: `parse.js` (chuyển kiểu), `schema.js` (cột), `data.js` (tải + chuẩn hóa), `validate.js` (mâu thuẫn + công thức đáo), `format.js`, `views.js`, `app.js`.

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
- M2–M5: xem đề bài ban đầu (Tổng quan; Báo cáo tháng; Lịch sử + xuất CSV/ảnh; hoàn thiện PWA + deploy).
- Câu hỏi nghiệp vụ còn mở: xem phần cuối tin nhắn M1 (định nghĩa "dư nợ hiện tại" ở M2).
