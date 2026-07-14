# Đồ án: Event Ticket Booking (CNTT313E1 - Special Topics in Software Engineering)

Đồ án A2 (60% điểm), nhóm 2 người, deadline 01/08/2026.
Hệ thống đặt vé sự kiện gồm 2 service minh hoạ 4 chương Sommerville (trích phần liên quan), xoay quanh một kịch bản trung tâm là race condition ghế cuối.

## Tài liệu nguồn (đọc trước khi làm)

- `PLAN.md` - kế hoạch triển khai, phân công 2 người, lộ trình, ánh xạ rubric.
- `CONTEXT.md` - glossary thuật ngữ (dùng đúng từ vựng này trong code và báo cáo).
- `docs/spec/event-ticket-booking.md` - spec đầy đủ: 19 user story, API contract, schema, testing decisions.
- `docs/adr/` - các quyết định khó đảo ngược, phải tôn trọng khi code.

## Quyết định đã chốt (không tự ý đổi, sửa qua ADR nếu cần)

- 2 service: **Auth Service** + **Booking Service**, giao tiếp REST, monorepo.
- Stack: Node.js + Express + TypeScript.
- DB: Microsoft SQL Server, raw SQL qua package `mssql` (KHÔNG ORM) để dùng `ROWVERSION` (ADR-0001).
- Chống double-booking: optimistic locking qua ROWVERSION → `409 Conflict` + client retry; UNIQUE trên Booking.seat_id làm chốt chặn cuối.
- Auth: JWT verify cục bộ + 1 lời gọi Booking→Auth (`/users/me`) bọc `cockatiel` (timeout/retry/circuit breaker/fallback) (ADR-0002).
- Docker Compose (Auth + Booking + SQL Server); CI/CD GitHub Actions 5 bước; test Jest + Supertest (seam = biên HTTP REST).
- Bảo mật: bcrypt, zod, parameterized query, role user/admin, rate-limit login, helmet.
- Quan sát: pino + metrics endpoint in-memory (không Prometheus/Grafana).
- API versioning: URL path `/api/v1/`; v2 chỉ mô tả trong báo cáo.

## Trạng thái & việc kế tiếp

- Đã xong: tài liệu (spec, plan, glossary, ADR) + **bootstrap tối thiểu**: skeleton services/auth (port 3001) + services/booking (port 3002) với `GET /health`, contracts tại `shared/contracts/` (JWT payload, `/users/me` response), docker-compose (mssql + 2 service), tsconfig.base.json, `.env.example`.
- Đã verify: `npm run build` + `/health` trả 200 cả 2 service, và `docker compose up --build` chạy đủ 3 container (mssql healthy, auth/booking trả 200 qua Docker).
- Việc kế: chia việc song song theo `PLAN.md` mục 7 (A: Auth Service, B: Booking Service).

## Nguyên tắc làm việc

- Ưu tiên đơn giản - chắc chắn - chạy được; scope đã cắt cho khả thi 2.5 tuần, không tự phình thêm.
- Trước khi code phần lớn, tóm tắt kế hoạch ngắn để duyệt rồi mới làm.

---

# Cách đọc tài liệu Software Engineering (Sommerville, 10th Edition)

Dự án có 2 file cùng nội dung:

- `(Global Edition) Ian Sommerville - Software Engineering, 10th Edition-Pearson (2016).md`
- `(Global Edition) Ian Sommerville - Software Engineering, 10th Edition-Pearson (2016).pdf`

## Quy tắc đọc

- Đọc nội dung chính từ file `.md`.
- Khi gặp đoạn đánh dấu `==> picture [...] intentionally omitted <==` kèm khối `----- Start of picture text -----`, đó là text OCR trích thô từ trong hình (nhãn, box), **không phải mô tả ảnh**. Text này bị mất bố cục và mũi tên, nên với sơ đồ luồng/kiến trúc sẽ hiểu sai quan hệ giữa các thành phần.
- Khi cần xem hình (sơ đồ, biểu đồ, ảnh minh họa), mở đúng trang tương ứng trong file `.pdf` để xem trực quan thay vì dựa vào text OCR trong `.md`.
