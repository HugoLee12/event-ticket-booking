# Kế hoạch triển khai đồ án - Event Ticket Booking

Đồ án A2 môn CNTT313E1 (Special Topics in Software Engineering).
Nhóm 2 người, deadline 01/08/2026.
Chủ đề: hệ thống đặt vé sự kiện minh hoạ 4 chương Sommerville (trích phần liên quan), xoay quanh một kịch bản kỹ thuật trung tâm là race condition ghế cuối.

## 1. Các chương và phạm vi trích dùng

| Chương | Vai trò | Phần dùng | Phần bỏ |
|---|---|---|---|
| Ch.18 Service-Oriented SE | Chương chính | REST design, versioning, service composition | SOAP |
| Ch.17 Distributed SE | Bổ trợ kiến trúc | Client-server, consistency | Cloud/replication sâu |
| Ch.13 Security Engineering | Dependability #1 | AuthN/authZ, input validation | STRIDE đầy đủ, security cả vòng đời |
| Ch.14 Resilience Engineering | Dependability #2 | Xử lý lỗi/tranh chấp đồng thời, circuit breaker | Chaos engineering, DR quy mô lớn |

Sợi chỉ đỏ: **race condition ghế cuối** vừa là consistency (Ch.17), vừa là REST error semantics 409 (Ch.18), vừa là retry/resilience (Ch.14); AuthN/authZ (Ch.13) là lớp bảo vệ độc lập.

## 2. Quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Domain | 2 service: Auth Service + Booking Service (đặt vé sự kiện) |
| Ngôn ngữ/framework | Node.js + Express + TypeScript |
| Database | Microsoft SQL Server (chạy trong container lúc demo) |
| Truy cập DB | Raw SQL qua package `mssql`, **không ORM** (để dùng ROWVERSION native) |
| Xử lý tranh chấp | Optimistic locking qua `ROWVERSION` → `409 Conflict` + client retry (ADR-0001) |
| Xác thực | JWT verify cục bộ + 1 lời gọi Booking→Auth có resilience (ADR-0002) |
| Resilience lib | `cockatiel` (timeout + retry + circuit breaker + fallback) |
| Đóng gói/chạy | Docker Compose (Auth + Booking + SQL Server) |
| CI/CD | GitHub Actions, pipeline 5 bước |
| Test | Jest + Supertest; tầng race condition + tầng API làm kỹ |
| Log/monitor | `pino` (structured log) + metrics endpoint in-memory; không Grafana |
| Bảo mật | bcrypt, zod, parameterized query, role user/admin, rate-limit login, helmet, bảng STRIDE |
| API versioning | URL path `/api/v1/`; v2 chỉ mô tả trong báo cáo |

## 3. Kiến trúc (mức khái niệm)

```
Client (Postman/curl/browser)
        |
        |  HTTP REST /api/v1/*  (+ JWT ở header Authorization)
        v
+-------------------+       Booking->Auth: GET /users/me (lấy profile)
|  Booking Service  | ----> bọc cockatiel (timeout/retry/breaker/fallback)
|  (events, seats,  |            |
|   bookings)       |            v
|  optimistic lock  |     +----------------+
+---------+---------+     |  Auth Service  |
          |               | (register/login|
          | mssql         |  JWT, roles)   |
          v               +-------+--------+
   +--------------+               | mssql
   | SQL Server   | <-------------+
   | (Docker)     |
   +--------------+
```

- JWT ký bằng secret chung; Booking verify cục bộ (không gọi Auth mỗi request).
- Lời gọi service-to-service duy nhất (Booking→Auth lấy profile) là điểm resilience demo được.

## 4. Cấu trúc repo (monorepo)

```
/
├── docker-compose.yml
├── .github/workflows/ci.yml
├── services/
│   ├── auth/          (Express+TS, register/login/JWT/roles, bcrypt, rate-limit)
│   └── booking/       (Express+TS, events/seats/bookings, ROWVERSION, cockatiel, metrics)
├── tests/             (integration: race condition + API paths)
├── docs/
│   ├── adr/           (0001, 0002)
│   └── report/        (báo cáo 12-15 trang, slide)
└── CONTEXT.md
```
Ghi chú lười: monorepo 1 repo cho gọn CI + demo; tách 2 repo chỉ tốn công đồng bộ, không thêm điểm.

## 5. Mô hình dữ liệu (phác thảo)

- **User**(id, email unique, password_hash, role['user'|'admin'], created_at)
- **Event**(id, name, starts_at) - seed sẵn, không CRUD admin
- **Seat**(id, event_id FK, label, status['free'|'booked'], row_version ROWVERSION)
- **Booking**(id, seat_id FK unique, user_id FK, created_at)

Ràng buộc chống double-booking ở 2 tầng: optimistic lock trên `Seat.row_version` + UNIQUE trên `Booking.seat_id` (chốt chặn cuối).

## 6. API chính (v1)

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | /api/v1/auth/register | - | Đăng ký (bcrypt hash) |
| POST | /api/v1/auth/login | - | Login → JWT (rate-limited) |
| GET | /api/v1/auth/users/me | JWT | Profile (service composition target) |
| GET | /api/v1/events | JWT | Danh sách sự kiện + ghế |
| POST | /api/v1/bookings | JWT | Đặt 1 ghế; 201 thành công / 409 conflict / 400 invalid / 401 |
| GET | /api/v1/metrics | JWT admin | Số liệu đếm (booking, conflict, uptime) |

## 7. Phân công (chia theo service)

**Người A - Auth Service + bảo mật xuyên suốt**
- Auth Service: register/login, bcrypt, JWT (ký/verify shared secret), role user/admin.
- rate-limit login, helmet, zod validation cho auth.
- Endpoint `/users/me` (đích của service composition).
- Báo cáo: mục Bảo mật (Ch.13) + bảng STRIDE + mục Đạo đức.

**Người B - Booking Service + resilience/đo lường**
- Booking Service: events/seats seed, đặt vé, **optimistic locking ROWVERSION** → 409.
- Lời gọi Booking→Auth bọc `cockatiel` (timeout/retry/breaker/fallback).
- `pino` logging + metrics endpoint in-memory.
- Báo cáo: mục Kiến trúc (Ch.17/18) + mục Concurrency & Resilience (Ch.14/17).

**Làm chung (tuần cuối)**
- Docker Compose, GitHub Actions CI (5 bước).
- Integration test race condition (đụng cả 2 service).
- Mục Reuse & trade-off, CI/CD, Kết quả đo lường trong báo cáo.
- Slide + luyện thuyết trình + demo.

## 8. Lộ trình theo giai đoạn (~2.5 tuần đến 01/08)

**GĐ1 - Khung sườn (song song, mỗi người service của mình)**
- A: skeleton Auth Service, DB schema User, register/login/JWT chạy được, test tầng API auth.
- B: skeleton Booking Service, DB schema Event/Seat/Booking + seed, GET events chạy được.
- Chung: dựng `docker-compose.yml` với SQL Server sớm để cả 2 dev trên cùng DB.
- Mốc verify: `docker compose up` chạy 2 service + SQL Server; register→login→lấy JWT OK.

**GĐ2 - Tính năng ruột**
- B: POST /bookings với optimistic locking ROWVERSION, trả 409 đúng; pino log + metrics.
- B: lời gọi Booking→Auth /users/me bọc cockatiel + fallback.
- A: role user/admin, authZ cho /metrics, rate-limit, helmet, zod hoàn thiện.
- Mốc verify: đặt vé thành công gắn tên user; tắt Auth Service → booking vẫn 201 (fallback).

**GĐ3 - Kiểm thử + CI/CD (làm chung)**
- Integration test race condition: bắn ~20 request đồng thời 1 ghế cuối → assert đúng 1 thành công, còn lại 409, DB đúng 1 booking, 0 double-booking.
- Integration test tầng API các path lỗi (401/400/409).
- GitHub Actions: lint → build → test → docker build → tag/release nhẹ. Đạt tick xanh.
- Mốc verify: CI xanh trên GitHub; test race condition pass ổn định.

**GĐ4 - Báo cáo + thuyết trình**
- Viết báo cáo 12-15 trang theo outline mục 9 (mỗi người mục của mình, ghép + rà chung).
- Vẽ sơ đồ kiến trúc + sequence diagram luồng đặt vé (service composition).
- Slide + kịch bản demo (đặt vé happy path → race condition → fallback khi tắt Auth → show metrics/log/CI).
- Mốc verify: demo thử end-to-end trọn vẹn ít nhất 1 lần trước ngày nộp.

## 9. Outline báo cáo (12-15 trang)

1. Giới thiệu & bối cảnh (~1 tr) - vì sao phân tán/SOA thay vì monolith.
2. Kiến trúc hệ thống (~2-3 tr) - Ch.17+18: sơ đồ, client-server, REST, versioning, sequence diagram composition.
3. Xử lý đồng thời & Resilience (~2-3 tr) - Ch.14+17: race condition, optimistic lock/ROWVERSION, circuit breaker. **Viết kỹ nhất.**
4. Bảo mật (~2 tr) - Ch.13: authN/authZ, input validation, bảng STRIDE, hardening.
5. Reuse & Trade-off (~1-2 tr) - framework/component đã dùng + các quyết định đánh đổi (ADR-0001, 0002).
6. CI/CD & DevOps (~1-2 tr) - pipeline 5 bước, Docker Compose, version/release.
7. Kiểm thử & Kết quả đo lường (~1-2 tr) - test race condition + số liệu, log/metrics.
8. Đạo đức nghề nghiệp (~0.5-1 tr) - CLO8: security/privacy, trách nhiệm khi double-booking.
9. Kết luận & bài học (~0.5 tr).

## 10. Ánh xạ rubric (đảm bảo phủ điểm)

| Tiêu chí rubric | Tỷ trọng | Đáp ứng bởi |
|---|---|---|
| Kiến trúc (Distributed/SOA/CBSE + dependability) | 25% | 2 service REST + optimistic lock + resilience + security |
| Hiện thực & CI/CD | 25% | Code chạy + Jest test + GitHub Actions + Docker + version tag |
| Reuse & trade-off | 20% | Express/cockatiel/zod/mssql + phân tích ADR-0001/0002 |
| Báo cáo & trình bày (+ đạo đức) | 20% | Báo cáo 9 mục + slide + mục đạo đức |
| Demo & đo lường | 10% | Demo Docker + số liệu metrics/log + kết quả test race condition |

## 11. Rủi ro & giảm thiểu

- **SQL Server container nặng**: máy 16GB đủ; cấp tối thiểu 2GB cho container, khởi động sớm ở GĐ1.
- **Test race condition flaky**: chạy nhiều vòng, đảm bảo UNIQUE constraint làm chốt chặn cuối cạnh optimistic lock.
- **Deadline gấp**: v2 chỉ mô tả (không code); Grafana bỏ; nếu kẹt, rate-limit/helmet là phần cắt được đầu tiên (đã đánh dấu tuỳ chọn).
