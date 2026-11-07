# Sổ nợ Trang & Dũng

App xem báo cáo nợ trên điện thoại, đọc từ Google Sheet (chỉ đọc). Chi tiết dữ liệu: `CLAUDE.md`.

## Chạy thử (dữ liệu mẫu)
```bash
npm run dev     # mở http://localhost:8080
npm test        # chạy kiểm thử
```
Xem thử cảnh báo mâu thuẫn: `http://localhost:8080/?fixture=sample-conflict`.

## Nối với Google Sheet thật (làm khi đã duyệt M1)
1. Mở Google Sheet → **Tiện ích mở rộng** → **Apps Script**.
2. Xóa code mẫu, dán toàn bộ nội dung `apps-script/Code.gs`, bấm biểu tượng đĩa mềm để lưu.
3. Bấm ⚙ **Cài đặt dự án** → kéo xuống **Thuộc tính tập lệnh** → **Thêm** → Tên `APP_KEY`, Giá trị là một chuỗi bí mật dài bạn tự đặt (khoảng 20 ký tự) → **Lưu**.
4. **Triển khai** → **Tùy chọn triển khai mới** → loại **Ứng dụng web** → Thực thi với tư cách **Tôi**, Ai có quyền truy cập **Bất kỳ ai** → **Triển khai** → cấp quyền (nếu hiện "chưa xác minh": Nâng cao → Tiếp tục). Sao chép **URL ứng dụng web**.
5. Sao chép `.env.example` thành `.env`, điền `DATA_URL` (URL vừa chép), `DATA_KEY` (đúng chuỗi `APP_KEY`), `DATA_MODE=live`.
Sau này sửa `Code.gs` thì phải **Quản lý bản triển khai → Sửa → Phiên bản mới**.
