# Sổ nợ Trang & Dũng

App xem báo cáo nợ trên điện thoại, đọc từ Google Sheet (chỉ đọc, không sửa Sheet). Chi tiết dữ liệu và quy tắc: `CLAUDE.md`.

## Chạy thử (dữ liệu mẫu)
```bash
npm run dev     # mở http://localhost:8080
npm test        # chạy kiểm thử
```

## Bước 1. Tạo địa chỉ đọc dữ liệu từ Google Sheet (làm một lần)
1. Mở Google Sheet → **Tiện ích mở rộng** → **Apps Script**.
2. Xóa code mẫu, dán toàn bộ nội dung `apps-script/Code.gs`, bấm biểu tượng đĩa mềm để lưu.
3. Bấm ⚙ **Cài đặt dự án** → kéo xuống **Thuộc tính tập lệnh** → **Thêm** → Tên `APP_KEY`, Giá trị là một chuỗi bí mật dài bạn tự đặt (**ít nhất 12 ký tự**, nên khoảng 20, gồm chữ và số; ngắn hơn thì app từ chối) → **Lưu**.
4. **Triển khai** → **Tùy chọn triển khai mới** → loại **Ứng dụng web** → Thực thi với tư cách **Tôi**, Ai có quyền truy cập **Bất kỳ ai** → **Triển khai** → cấp quyền (nếu hiện "chưa xác minh": Nâng cao → Tiếp tục). Sao chép **URL ứng dụng web**.
Sau này sửa `Code.gs` thì phải **Quản lý bản triển khai → Sửa → Phiên bản mới**.

## Bước 2. Đưa app lên mạng bằng GitHub Pages
1. Có tài khoản GitHub (github.com). Tạo repo mới tên `FA-report`, chọn **Public** (GitHub Pages miễn phí cần repo công khai), **không** tick thêm README hay .gitignore.
2. Nhờ Claude đẩy mã lên repo đó (cần cho phiên làm việc quyền ghi vào repo).
3. Trong repo: **Settings** → **Pages** → mục **Source** chọn **GitHub Actions**. Đợi 1–2 phút ở tab **Actions** đến khi có dấu tích xanh.
4. App chạy ở `https://tranghm9.github.io/FA-report/`.

Bản đưa lên mạng **không chứa** địa chỉ hay khóa Google Sheet, nên ai mở link cũng chỉ thấy dữ liệu mẫu. Phương án thay thế: Netlify (`netlify.toml` đã có sẵn).

## Bước 3. Nối dữ liệu thật trên điện thoại (mỗi thiết bị một lần)
1. Mở link app → bấm ⚙ ở góc trên bên phải.
2. Dán **địa chỉ ứng dụng web** (Bước 1) và **khóa** (`APP_KEY`) → **Lưu và tải lại**.
3. Cài lên màn hình chính: Android (Chrome) menu ⋮ → "Cài đặt ứng dụng"; iPhone (Safari) nút Chia sẻ → "Thêm vào Màn hình chính".

Địa chỉ và khóa chỉ nằm trên điện thoại của bạn. Khi mất mạng, app mở bản dữ liệu đã lưu lần trước và nói rõ đó là bản cũ.

## Dành cho người phát triển
- `.env` (xem `.env.example`) chỉ dùng khi chạy thử trên máy: `DATA_MODE=live`, `DATA_URL`, `DATA_KEY`. Không commit `.env`.
- `npm run build` tạo `dist/` (kèm service worker). Thử bản build: `node scripts/serve.mjs --dist` rồi mở `/?sw=1`.

## Bảo mật: các lớp bảo vệ và giới hạn
| Lớp | Bảo vệ khỏi | Ghi chú |
|---|---|---|
| Bản đăng lên mạng không chứa địa chỉ/khóa | Người lạ mở link app | Họ chỉ thấy dữ liệu mẫu |
| Khóa truy cập (`APP_KEY` ≥ 12 ký tự) + chậm 1,5 giây mỗi lần đoán sai | Người đoán khóa | Không chia sẻ địa chỉ và khóa; nghi lộ thì đổi `APP_KEY` rồi triển khai lại |
| **Khóa bằng mã PIN** (⚙ → Bảo mật, 6–12 chữ số) | Người cầm điện thoại đang mở khóa màn hình | Mã hóa địa chỉ, khóa và dữ liệu lưu trên máy; tự khóa khi rời app hơn 1 phút; sai 3 lần thì phải chờ |
| Chặn mã lạ (Content-Security-Policy) | Mã độc chèn vào trang gửi dữ liệu ra ngoài | Chỉ cho phép nối tới Google Apps Script |
| App chỉ đọc | Sửa/xóa nhầm Sheet | Script không có chức năng ghi |

**Giới hạn cần biết:** PIN không khôi phục được; quên thì phải xóa dữ liệu trên máy và nhập lại địa chỉ + khóa. PIN không chống được kẻ tấn công chuyên nghiệp có bản sao bộ nhớ trình duyệt của bạn, hãy giữ điện thoại có khóa màn hình. Ai biết cả địa chỉ lẫn khóa vẫn đọc được Sheet qua script, nên giữ kín hai thứ này.
Sau khi cập nhật `Code.gs`: **Triển khai → Quản lý bản triển khai → Sửa → Phiên bản mới**.
