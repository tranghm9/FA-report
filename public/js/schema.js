// Ánh xạ cột Sheet -> tên trường. Khớp theo tiêu đề cột (không phân biệt dấu/hoa thường), nên đổi thứ tự cột vẫn chạy.
// Đây là bản mô tả mã nguồn của CLAUDE.md; sửa một nơi thì sửa cả nơi kia.
import { parseText, parseNumber, parseDate, parseLast4 } from './parse.js';

const T = parseText, N = parseNumber, D = parseDate;

export const SCHEMA = {
  khoanVay: {
    ma: ['Mã', T], chu: ['Chủ', T], donVi: ['Đơn vị', T], moTa: ['Hợp đồng / mô tả', T],
    ngayGiaiNgan: ['Ngày giải ngân', D], tongSoKy: ['Tổng số kỳ', N], soTienKy: ['Số tiền / kỳ (VND)', N],
    ngayHan: ['Ngày hạn hằng tháng', N], hanKy1: ['Hạn kỳ 1', D], kyKeTiep: ['Kỳ kế tiếp (chưa trả)', N],
    hanKyKeTiep: ['Hạn kỳ kế tiếp', D], conLai: ['Còn lại sau kỳ kế tiếp', N], hanKyCuoi: ['Hạn kỳ cuối', D],
    tenNhac: ['Tên nhắc kỳ kế tiếp (gợi ý)', T],
  },
  the: {
    ma: ['Mã', T], chu: ['Chủ', T], ten: ['Thẻ', T], soCuoi: ['4 số cuối', parseLast4], ngayChot: ['Ngày chốt sao kê', N],
    hanMuc: ['Hạn mức được cấp', N], hanThanhToan: ['Hạn thanh toán (kỳ gần nhất)', D], duNoKy: ['Dư nợ kỳ (sao kê gần nhất)', N],
    toiThieu: ['Tối thiểu (không trả)', N], khaDung: ['Hạn mức khả dụng hiện tại', N], cheDo: ['Chế độ kỳ này', T],
    soNap: ['Số nạp để khả dụng đạt mục tiêu', N], phiDao: ['Phí đáo ngân sách', N], duKien: ['Số tiền dự kiến', N], ghiChu: ['Ghi chú', T],
  },
  linhHoat: {
    ma: ['Mã', T], chu: ['Chủ', T], donVi: ['Đơn vị', T], moTa: ['Mô tả', T], hanThanhToan: ['Hạn thanh toán', D],
    soTien: ['Số tiền (VND)', N], ghiChu: ['Ghi chú', T],
  },
  nhatKy: {
    ngayGhi: ['Ngày ghi', D], chu: ['Chủ', T], ma: ['Mã', T], donVi: ['Đơn vị', T], hanThucTe: ['Hạn thực tế', D],
    duKien: ['Dự kiến (VND)', N], thucTe: ['Thực tế (VND)', N], trangThai: ['Trạng thái', T], cheDo: ['Chế độ thẻ', T],
    phiDaoThucTe: ['Phí đáo thực tế', N], duNoKyDao: ['Dư nợ kỳ đáo', N], ghiChu: ['Ghi chú / quyết định', T],
  },
};

// tab trong Sheet -> khóa schema
export const TAB_NAMES = { khoanVay: 'Khoản vay', the: 'Thẻ', linhHoat: 'Linh hoạt', nhatKy: 'Nhật ký' };
export const PARAM_TAB = 'Thông số';
