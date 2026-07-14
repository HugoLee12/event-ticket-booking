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
- Phân công đã chốt: **B (Booking Service) - Hugo**, **A (Auth Service) - đồng đội**; cả hai đều dùng AI hỗ trợ.
- **GĐ1-B đã xong và verify qua Docker**: booking có db.ts (pool `mssql`), init.ts (bootstrap schema idempotent: DB `tickets`, bảng Event/Seat (`row_version ROWVERSION`)/Booking (`seat_id UNIQUE`) + seed 2 event x 10 ghế), auth.ts (verify JWT cục bộ theo contract `JwtPayload`), `GET /api/v1/events`, app.ts/index.ts tách riêng, 3 test Jest + Supertest pass với SQL Server thật (`npm test` trong services/booking, cần mssql compose đang chạy; env đọc từ `.env` root qua `--env-file-if-exists`).
- **Quy ước schema cho cả 2 người**: mỗi service tự tạo bảng của mình trong cùng DB `tickets` theo kiểu idempotent lúc khởi động (`IF OBJECT_ID(...) IS NULL CREATE TABLE ...`) - xem mẫu `services/booking/src/init.ts`; A áp dụng pattern này cho bảng `User`. Booking.user_id cố ý KHÔNG có FK sang `User` (tránh phụ thuộc thứ tự boot giữa 2 service).
- **Toolchain**: npm workspaces - `package.json` + `package-lock.json` duy nhất ở root, `npm install` chạy ở root, lệnh cho từng service dùng `-w services/<tên>` (vd `npm test -w services/booking`); TypeScript pin `^5` (KHÔNG lên v7 - ts-jest chưa hỗ trợ); cockatiel pin `^3` (v4 ESM-only, Jest CJS không load được); test dùng Jest + ts-jest + Supertest, cấu hình xem services/booking/package.json.
- **Lưu ý cho A**: chuyển workspaces đã xoá `services/*/package-lock.json` và sửa cả 2 Dockerfile; nhánh `auth-service` khi rebase nếu conflict lockfile thì cứ xoá lockfile con, thêm dependency mới bằng `npm install <pkg> -w services/auth` từ root. GĐ3 vừa thêm ESLint (`eslint`, `typescript-eslint`) làm devDependency ở root package.json + `eslint.config.js` mới - rebase nhánh `auth-service` sẽ nhận thêm 2 gói này; `npm run lint` ở root lint cả `services/` lẫn `shared/`, auth hiện đang sạch.
- **GĐ2-B đã xong và verify qua Docker**: `POST /api/v1/bookings` với optimistic locking ROWVERSION trong transaction (thua UPDATE → 409, UNIQUE `Booking.seat_id` lỗi 2627/2601 → 409 chốt chặn cuối, ghế không tồn tại → 404, zod sai → 400), gọi Auth `/users/me` bọc cockatiel (timeout 1.5s + retry 2 + circuit breaker + fallback `user: null` theo ADR-0002), pino logger + `GET /api/v1/metrics` in-memory chỉ admin (403 nếu không phải); 10 test Jest + Supertest pass với Auth tắt (chính là kịch bản fallback); smoke qua Docker: 201/409/403/200 + tắt auth container vẫn đặt vé 201.
- **GĐ3-B đã xong (phần chung: test race + CI)**: `services/booking/src/race.test.ts` bắn 20 request đồng thời vào 1 ghế (event/seat riêng cho test, dọn ở afterAll) → đúng 1×201, 19×409, DB COUNT=1 (0 double-booking) - bằng chứng thực nghiệm ROWVERSION; rà lại path lỗi API, bổ sung test thiếu "POST /bookings token sai -> 401"; `.github/workflows/ci.yml` 5 bước (lint → build → test với mssql service container → build 2 Docker image → tag/release nhẹ qua `softprops/action-gh-release` khi push main), bước test dùng `npm test` root (`--workspaces --if-present` nên tự bỏ qua auth vì chưa có script test); 12 test Jest + Supertest pass local (`npm test -w services/booking`, cần `docker compose up mssql`).
- **GĐ1-A đã xong và verify qua Docker**: Đã hoàn thành bộ khung Auth Service gồm bảng `User` (idempotent), API `register` (mã hóa mật khẩu bcrypt), `login` (phát hành JWT token), `/users/me` (middleware requireAuth). Đã có 7 test case kiểm thử tích hợp tự động qua Supertest cho Auth Service pass hoàn toàn với SQL Server.
- **GĐ2-A đã xong và verify qua Docker**: Đã hoàn tất các tính năng bảo mật nâng cao và phân quyền cho Auth Service bao gồm: tích hợp `helmet`, cấu hình `express-rate-limit` chống brute-force cho login, kiểm duyệt đầu vào bằng `zod`, hỗ trợ phân quyền vai trò `admin`/`user` trong DB và đóng gói vai trò vào JWT.
- **GĐ3 tích hợp 2 service đã xong và verify qua Docker (B làm phần "làm chung")**: đã merge `feat/auth` vào `main` (fast-forward, đã review: build sạch, 7 test auth pass, contract JWT + `/users/me` khớp Booking); thêm happy path E2E liên service `services/booking/src/happy-path.test.ts` (khởi động Auth server thật ở port 3999, trỏ `AUTH_BASE_URL` vào đó, drive đăng ký → đăng nhập → lấy JWT → GET /events → POST /bookings, assert `user` trong xác nhận đặt vé KHÁC null = bằng chứng Booking gọi Auth thật, không fallback); toàn bộ 13 test booking pass (`npm test -w services/booking`, cần `docker compose up mssql`); smoke end-to-end qua Docker thật (auth :3001 + booking :3002 rebuild): register 201 → login JWT → events → book 201 kèm `{displayName,email}` thật. Lint + build cả 2 service sạch.
CI GitHub Actions đã xanh trên `main` sau khi push (đạt mốc verify GĐ3) - GĐ1-3 coi như đóng hoàn toàn.
- **GĐ4-B (báo cáo) đã xong 5 mục**: viết trong `docs/report/` mục 2 Kiến trúc (Ch.17/18, kèm sơ đồ kiến trúc + sequence composition), mục 3 Concurrency & Resilience (Ch.14/17, kèm sơ đồ race), mục 5 Reuse & trade-off (Ch.15/16), mục 6 CI/CD (Ch.25), mục 7 Kiểm thử & đo lường (Ch.14 observability); tất cả nhúng số harvest thật (race 1×201/19×409/COUNT=1, 13 test 4.919s, `/metrics` JSON, pino log 3 trạng thái). B nhận thêm mục 1 Giới thiệu + mục 9 Kết luận (PLAN mục 7 vốn bỏ trống 2 mục này, B xung phong làm).
- Việc kế GĐ4: A còn mục 4 Bảo mật (Ch.13) + bảng STRIDE + mục 8 Đạo đức. B còn mục 1 Giới thiệu + mục 9 Kết luận. Chung: ghép báo cáo tuần cuối + slide + demo end-to-end. A nhớ `git pull --rebase` để lấy code auth đã merge + E2E test.

## Quy ước làm việc chung repo (2 người + AI)

- Mỗi người làm trong thư mục service của mình (`services/auth` = A, `services/booking` = B); muốn sửa file chung (`shared/contracts/`, `docker-compose.yml`, `tsconfig.base.json`, `.env.example`, `package.json`/`package-lock.json` root, spec/PLAN) thì báo người kia trước.
- Luôn `git pull --rebase` trước khi push.
- Trong CLAUDE.md mục "Trạng thái & việc kế", mỗi người chỉ sửa dòng nói về phần của mình.
- `docs/adr/`: mỗi ADR một file đánh số tăng dần; thêm ADR mới thì nhắn người kia để lấy số kế tiếp.
- `docs/report/` (GĐ4): tách mỗi mục báo cáo một file riêng theo phân công trong PLAN.md mục 7, tuần cuối mới ghép.
- File Markdown dài: viết mỗi câu trọn vẹn trên một dòng riêng (git merge theo dòng nên 2 người sửa 2 câu khác nhau sẽ không conflict).
- `.gitignore` đang chặn `*.pdf` toàn cục; cuối kỳ nếu cần commit PDF báo cáo thì đổi rule thành 2 tên file cụ thể (sách + đề bài).

## Nguyên tắc làm việc

- Ưu tiên đơn giản - chắc chắn - chạy được; scope đã cắt cho khả thi 2.5 tuần, không tự phình thêm.
- Trước khi code phần lớn, tóm tắt kế hoạch ngắn để duyệt rồi mới làm.

---

# Cách đọc tài liệu Software Engineering (Sommerville, 10th Edition)

Dự án có 2 file cùng nội dung:

- `(Global Edition) Ian Sommerville - Software Engineering, 10th Edition-Pearson (2016).md`
- `(Global Edition) Ian Sommerville - Software Engineering, 10th Edition-Pearson (2016).pdf`

## Quy tắc đọc

- File `.pdf` KHÔNG được commit (đã ignore để repo nhẹ khi clone); mỗi máy tự chép 2 file PDF (sách + đề bài) vào root repo nếu cần xem hình.
- Đọc nội dung chính từ file `.md`.
- Khi gặp đoạn đánh dấu `==> picture [...] intentionally omitted <==` kèm khối `----- Start of picture text -----`, đó là text OCR trích thô từ trong hình (nhãn, box), **không phải mô tả ảnh**. Text này bị mất bố cục và mũi tên, nên với sơ đồ luồng/kiến trúc sẽ hiểu sai quan hệ giữa các thành phần.
- Khi cần xem hình (sơ đồ, biểu đồ, ảnh minh họa), mở đúng trang tương ứng trong file `.pdf` để xem trực quan thay vì dựa vào text OCR trong `.md`.
