# Kanban Pro

Ứng dụng Kanban hiện đại, thuần HTML/CSS/JS — mở `index.html` là chạy, không cần build.

## Tính năng
- Nhiều bảng (tạo/đổi tên/xoá), tự nhớ bảng đang mở
- Kéo thả thẻ & sắp xếp cột; thu gọn cột, màu cột, giới hạn WIP, sắp xếp theo hạn/ưu tiên
- Thẻ: mô tả markdown-lite, ưu tiên, hạn chót (quá hạn/hôm nay), nhãn màu, người phụ trách, checklist + tiến độ, nhân bản, lưu trữ/khôi phục
- Thêm nhanh thẻ (Enter liên tục), chuyển cột ngay trong hộp thoại (dùng được trên di động)
- Undo/Redo (100 bước) + toast hoàn tác
- Tìm kiếm, lọc theo ưu tiên và nhãn
- Bảng lệnh `Ctrl+K`, phím tắt (`n`, `/`, `?`)
- Thống kê: tổng thẻ, % hoàn thành, quá hạn, biểu đồ theo cột
- Xuất/nhập JSON, đồng bộ giữa các tab, sáng/tối, màu chủ đạo tuỳ chỉnh
- Dữ liệu lưu localStorage (tự nâng cấp từ bản cũ, dữ liệu nhập vào được làm sạch chống XSS)

## Cấu trúc
| File | Vai trò |
|---|---|
| `index.html`, `styles.css` | Giao diện |
| `logic.js` | Logic thuần (di chuyển thẻ/cột, lọc, thống kê, undo, làm sạch dữ liệu) — không đụng DOM nên test được bằng Node |
| `app.js` | Nối logic với giao diện (render, sự kiện) |

## Phát triển & kiểm thử
```bash
npm install
npx playwright install chromium   # lần đầu
npm start          # chạy thử tại http://localhost:4173
npm run lint       # ESLint
npm run test:unit  # unit test (node:test)
npm run test:e2e   # E2E + accessibility (Playwright, desktop + mobile)
npm test           # tất cả
```
- **Unit** (`tests/unit`): logic thuần, gồm cả dữ liệu độc hại/hỏng.
- **E2E** (`tests/e2e`): thao tác thật trên trình duyệt — thẻ, kéo thả, tính năng, bảo mật XSS, WCAG AA (axe-core, sáng & tối).
- **CI** (`.github/workflows/ci.yml`): chạy tất cả trên mỗi push/PR.
- **Deploy** (`.github/workflows/pages.yml`): sau khi merge vào `main`, tự chạy lint + unit rồi đưa lên GitHub Pages
  (cần bật một lần: *Settings → Pages → Source: GitHub Actions*).
