# Spec: Event Ticket Booking System (CNTT313E1 A2)

## Problem Statement

Nhóm cần một hệ thống phần mềm nhỏ nhưng "thật" để chứng minh năng lực áp dụng các chủ đề nâng cao trong Software Engineering (Sommerville: Ch.13, 14, 17, 18) cho đồ án cuối kỳ A2.
Từ góc nhìn người dùng cuối, bài toán nghiệp vụ là: nhiều khách hàng cùng muốn đặt vé cho các sự kiện có số ghế giới hạn, và khi hai người cùng nhắm một ghế còn lại cuối cùng, hệ thống phải đảm bảo chỉ một người đặt được - không bao giờ bán một ghế cho hai người.
Đồng thời hệ thống phải bảo vệ tài khoản người dùng (xác thực, phân quyền, chống lộ mật khẩu) và vẫn hoạt động khi một service phụ trợ gặp sự cố.

## Solution

Xây một hệ thống gồm hai service giao tiếp qua REST: **Auth Service** (đăng ký, đăng nhập, phát JWT, quản lý vai trò) và **Booking Service** (danh sách sự kiện, ghế, và đặt vé).
Khi đặt vé, hệ thống dùng **optimistic locking** dựa trên `ROWVERSION` của SQL Server để xử lý tranh chấp ghế: người thắng nhận xác nhận, người thua nhận `409 Conflict` và có thể thử lại.
Booking Service xác thực JWT cục bộ (stateless), và chỉ gọi sang Auth Service một lần để lấy hồ sơ người dùng đính vào xác nhận đặt vé; lời gọi này được bọc timeout/retry/circuit breaker/fallback nên nếu Auth Service chậm hoặc sập, việc đặt vé vẫn thành công (chỉ thiếu tên hiển thị).
Toàn hệ chạy bằng Docker Compose, có CI/CD trên GitHub Actions, có log và số liệu đo lường.

## User Stories

1. Là một khách chưa có tài khoản, tôi muốn đăng ký bằng email và mật khẩu, để có thể đăng nhập và đặt vé.
2. Là một khách đã đăng ký, tôi muốn đăng nhập và nhận một JWT, để dùng token đó gọi các API cần xác thực.
3. Là một khách đã đăng nhập, tôi muốn xem danh sách sự kiện và các ghế còn trống, để chọn ghế muốn đặt.
4. Là một khách đã đăng nhập, tôi muốn đặt một ghế cụ thể của một sự kiện, để giữ chỗ cho mình.
5. Là một khách đặt trúng ghế mà người khác vừa đặt xong, tôi muốn nhận một thông báo lỗi rõ ràng (409 Conflict), để biết ghế đã hết và chọn ghế khác.
6. Là một khách bị 409 do tranh chấp, tôi muốn có thể thử lại thao tác đặt vé một cách an toàn, để không bị đặt trùng hoặc mất tiền oan.
7. Là một khách đặt vé thành công, tôi muốn xác nhận đặt vé hiển thị tên của tôi, để chắc chắn vé thuộc về đúng người.
8. Là một khách đặt vé đúng lúc Auth Service gặp sự cố, tôi muốn việc đặt vé vẫn thành công (dù xác nhận tạm thời thiếu tên), để sự cố của một thành phần phụ không chặn nghiệp vụ chính.
9. Là một người dùng, tôi muốn mật khẩu của mình không bao giờ được lưu ở dạng thô, để dữ liệu của tôi an toàn kể cả khi cơ sở dữ liệu bị lộ.
10. Là một người dùng, tôi muốn các request thiếu token hoặc token sai bị từ chối (401), để không ai mạo danh tôi đặt vé.
11. Là một người dùng, tôi muốn dữ liệu tôi gửi lên bị kiểm tra định dạng (email hợp lệ, seatId hợp lệ) và bị từ chối 400 nếu sai, để hệ thống không xử lý dữ liệu rác hay độc hại.
12. Là một hệ thống, tôi muốn giới hạn số lần thử đăng nhập, để chống dò mật khẩu (brute-force).
13. Là một admin, tôi muốn xem số liệu vận hành (tổng số đặt vé thành công, số lần 409, thời gian hoạt động), để đánh giá hệ thống.
14. Là một khách thường (không phải admin), tôi muốn bị từ chối truy cập endpoint số liệu (403), để phân quyền được thực thi đúng.
15. Là thành viên nhóm, tôi muốn chạy toàn hệ thống bằng một lệnh `docker compose up`, để demo ổn định trên bất kỳ máy nào.
16. Là thành viên nhóm, tôi muốn mỗi lần đẩy code lên GitHub sẽ tự động lint, build, chạy test và build Docker image, để đảm bảo chất lượng và có bằng chứng CI xanh.
17. Là thành viên nhóm, tôi muốn một bộ test chứng minh rằng khi N request cùng đặt một ghế cuối thì đúng một request thành công và phần còn lại nhận 409, để chứng minh optimistic locking hoạt động.
18. Là giám khảo, tôi muốn thấy log có cấu trúc và số liệu đo lường khi demo, để xác nhận hệ thống có khả năng quan sát (observability).
19. Là thành viên nhóm, tôi muốn API được đánh version qua đường dẫn (`/api/v1/`), để thể hiện chiến lược versioning và khả năng tương thích ngược.

## Implementation Decisions

- Kiến trúc gồm hai service độc lập: **Auth Service** và **Booking Service**, giao tiếp qua REST; xem [ADR-0002].
- Ngôn ngữ/nền tảng: Node.js + Express + TypeScript cho cả hai service (monorepo một repo).
- Cơ sở dữ liệu: Microsoft SQL Server, truy cập bằng raw SQL qua package `mssql` (không dùng ORM) để tận dụng `ROWVERSION` native; xem [ADR-0001].
- Chống double-booking hai tầng: optimistic locking trên `Seat.row_version` (`UPDATE ... WHERE id=? AND row_version=?`, 0 dòng bị ảnh hưởng → 409) và ràng buộc UNIQUE trên `Booking.seat_id` làm chốt chặn cuối.
- Xác thực: Auth Service ký JWT bằng secret chung; Booking Service verify cục bộ, không gọi Auth mỗi request.
- Service composition: khi đặt vé, Booking Service gọi `GET /users/me` của Auth Service để lấy hồ sơ, bọc bằng `cockatiel` (timeout + retry + circuit breaker + fallback); nếu lỗi thì fallback vẫn cho đặt vé thành công nhưng thiếu tên.
- Phân quyền: hai vai trò `user` và `admin`; chỉ `admin` truy cập được endpoint số liệu.
- Bảo mật: mật khẩu hash bằng `bcrypt`; validate input bằng `zod`; parameterized query chống SQL injection; `express-rate-limit` cho login; `helmet` cho security headers.
- Quan sát: structured logging bằng `pino`; endpoint số liệu in-memory (đếm booking thành công, số 409, tổng request, uptime) - không dùng Prometheus/Grafana.
- Versioning: URL path `/api/v1/`; một phiên bản `v2` giả định chỉ được mô tả trong báo cáo (không code).
- Đóng gói/vận hành: Docker Compose gồm Auth, Booking và SQL Server.
- CI/CD: GitHub Actions, pipeline 5 bước (lint → build → test → build Docker image → gắn version tag/release nhẹ).

### Hai hợp đồng giao diện (interface contract) giữa hai service

Đây là seam giữa hai người trong nhóm, phải thống nhất trước khi tách việc:

- **JWT payload** (Auth sản xuất, Booking tiêu thụ): tối thiểu `userId`, `role`, `email`.
- **`GET /api/v1/auth/users/me` response** (Auth sản xuất, Booking tiêu thụ qua cockatiel): tối thiểu tên hiển thị và email của người dùng.

### API contract chính (v1)

| Method | Path | Auth | Kết quả chính |
|---|---|---|---|
| POST | /api/v1/auth/register | - | 201 tạo user / 400 input sai / 409 email trùng |
| POST | /api/v1/auth/login | - | 200 + JWT / 401 sai thông tin / 429 quá nhiều lần thử |
| GET | /api/v1/auth/users/me | JWT | 200 hồ sơ / 401 |
| GET | /api/v1/events | JWT | 200 danh sách sự kiện + ghế / 401 |
| POST | /api/v1/bookings | JWT | 201 đặt thành công / 409 tranh chấp / 400 input sai / 401 |
| GET | /api/v1/metrics | JWT admin | 200 số liệu / 401 / 403 nếu không phải admin |

### Schema (phác thảo)

- **User**(id, email UNIQUE, password_hash, role['user'|'admin'], created_at)
- **Event**(id, name, starts_at) - seed sẵn
- **Seat**(id, event_id FK, label, status['free'|'booked'], row_version ROWVERSION)
- **Booking**(id, seat_id FK UNIQUE, user_id FK, created_at)

## Testing Decisions

- Một test tốt chỉ kiểm tra **hành vi quan sát được ở biên HTTP REST** (mã trạng thái, body trả về, trạng thái DB sau thao tác), không kiểm tra chi tiết cài đặt như hàm verify JWT hay câu SQL ROWVERSION cụ thể.
- **Seam duy nhất**: biên HTTP REST của mỗi service, kích qua Supertest. Mọi kịch bản (happy path, path lỗi, race condition, resilience fallback) đều test tại seam này, không tạo seam thấp hơn.
- Công cụ: Jest + Supertest.
- **Test race condition (quan trọng nhất)**: bắn ~20 request `POST /api/v1/bookings` đồng thời vào cùng một ghế cuối; assert đúng một request trả 201, phần còn lại trả 409, và DB chỉ có đúng một Booking cho ghế đó (0 double-booking).
- **Test API paths (làm kỹ)**: happy path đăng ký → đăng nhập → lấy JWT → xem events → đặt vé; và các path lỗi: đặt vé không JWT (401), JWT sai (401), đặt ghế đã có người (409), input sai (400), non-admin gọi /metrics (403).
- **Test resilience fallback (một test)**: dựng Booking Service với Auth Service không sẵn sàng, gửi đặt vé, assert 201 thành công với xác nhận thiếu tên (fallback), chứng minh sự cố Auth không chặn nghiệp vụ chính.
- **Unit test (tối thiểu)**: chỉ cho logic thuần dễ tách (ví dụ validate input), không mở rộng thành bộ test cho từng hàm.
- Prior art: chưa có (dự án greenfield); bộ integration test Supertest này sẽ là mẫu tham chiếu cho các test sau.

## Out of Scope

- SOAP-based services (chỉ làm REST).
- CRUD quản trị sự kiện/ghế (dữ liệu seed sẵn).
- Thanh toán, phát hành vé điện tử, gửi email.
- Prometheus/Grafana và dashboard trực quan.
- Deploy tự động lên cloud (chỉ demo local qua Docker Compose).
- Code thật cho API `v2` (chỉ mô tả trong báo cáo).
- STRIDE threat model đầy đủ trong code (chỉ trình bày dạng bảng trong báo cáo).
- Chaos engineering, disaster recovery quy mô lớn.
- Refresh token, đăng nhập mạng xã hội, quên mật khẩu (chỉ register/login cơ bản).

## Further Notes

- Sợi chỉ đỏ kỹ thuật của đồ án là kịch bản race condition ghế cuối, nối Ch.17 (consistency), Ch.18 (REST 409 semantics) và Ch.14 (retry/resilience); Ch.13 (security) là lớp bảo vệ độc lập.
- Ánh xạ rubric và phân công chi tiết nằm trong `PLAN.md`; glossary trong `CONTEXT.md`; các quyết định khó đảo ngược trong `docs/adr/`.
- Deadline 01/08/2026; scope đã được cắt để khả thi cho nhóm 2 người (các phần tuỳ chọn có thể cắt tiếp: rate-limit, helmet).
