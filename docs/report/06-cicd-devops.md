# 6. CI/CD và DevOps

Mục này mô tả đường ống tích hợp và phân phối liên tục của hệ thống, cùng cách đóng gói và phát hành.
Nội dung neo vào chương Quản lý cấu hình (Configuration Management, Ch.25) của Sommerville: tích hợp liên tục (continuous integration), dựng hệ thống tự động (system building), quản lý phiên bản (version management) và quản lý phát hành (release management).
Hệ thống là một ví dụ hiện thực nhỏ của các khái niệm này: mỗi lần đẩy code lên đều được máy build, kiểm thử và đóng gói tự động, và mỗi lần vào nhánh chính đều sinh ra một bản phát hành có phiên bản.

## 6.1. Tích hợp liên tục: mỗi thay đổi đều được kiểm chứng tự động

Đường ống được định nghĩa bằng một file duy nhất, `.github/workflows/ci.yml`, chạy trên GitHub Actions.
Nó kích hoạt theo hai sự kiện: mọi lần `push` lên **bất kỳ nhánh nào**, và mọi `pull_request` nhắm vào `main`.
Đây chính là **tích hợp liên tục** (Ch.25): thay đổi của hai người phát triển được máy hợp nhất và kiểm chứng ngay khi đẩy lên, thay vì để dồn lại rồi tích hợp thủ công một lần vào cuối, khi lỗi đã khó truy nguyên.
Với một đồ án hai người làm song song trên hai service, đây là lưới an toàn quan trọng nhất: nếu code của một người làm gãy build hoặc test, pipeline chuyển đỏ ngay trong lần push đó, chỉ ra đúng commit gây lỗi.

## 6.2. Năm bước của đường ống

Pipeline gồm năm bước, xếp theo thứ tự "rẻ trước, đắt sau" để một lỗi rẻ tiền chặn sớm trước khi tốn công cho bước đắt:

| Bước | Lệnh | Vai trò | Fail nhanh vì |
|---|---|---|---|
| 1. Lint | `npm run lint` | kiểm tra tĩnh (ESLint + typescript-eslint) trên `services/` và `shared/` | lỗi văn phong/kiểu rẻ nhất, chặn trước tiên |
| 2. Build | `npm run build` | biên dịch TypeScript của cả hai service | lỗi biên dịch chặn trước khi chạy test |
| 3. Test | `npm test` | Jest + Supertest, chạm SQL Server thật | kiểm chứng hành vi, gồm cả ca tranh chấp |
| 4. Đóng gói | `docker build` x2 | dựng image Docker cho auth và booking | xác nhận hai service đóng gói được thật |
| 5. Phát hành | `action-gh-release` | tạo release có tag khi vào `main` | chỉ chạy sau khi mọi bước trên xanh |

Bốn bước đầu (lint, build, test, đóng gói) nằm trong job `build-test`; bước phát hành nằm ở job `release` riêng, phụ thuộc (`needs`) job đầu và chỉ chạy khi job đầu thành công.
Thứ tự này là một hiện thực của nguyên tắc **dựng hệ thống tự động** (Ch.25): mỗi bước là một cổng chất lượng, và một bản phát hành chỉ ra đời khi đã qua tất cả các cổng.

## 6.3. Kiểm thử với SQL Server thật ngay trên CI

Chiến lược kiểm thử ở mục 7 đòi hỏi một SQL Server thật để hành vi đồng thời của `ROWVERSION` được kiểm chứng đúng.
Yêu cầu đó phải được đáp ứng cả trên máy CI, nơi không có sẵn cơ sở dữ liệu.
Pipeline giải quyết bằng **service container**: GitHub Actions khởi động một container `mcr.microsoft.com/mssql/server:2022-latest` song song với job, kèm **healthcheck** dùng `sqlcmd` để chờ tới khi máy chủ thật sự sẵn sàng nhận truy vấn trước khi bước Test chạy.
Bước Test được cấp các biến môi trường `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` trỏ vào container này, nên bộ test trên CI chạy đúng cùng đường như khi chạy cục bộ.
Nhờ vậy, ca tranh chấp 20 request đồng thời không phải là một bài chạy một lần trên máy lập trình viên, mà được lặp lại tự động mỗi lần push, biến bằng chứng chống double-booking thành một tính chất được canh giữ liên tục.

## 6.4. Đóng gói và tính nhất quán môi trường

Mỗi service được đóng thành một **image Docker độc lập** (`services/auth/Dockerfile`, `services/booking/Dockerfile`), build được kiểm chứng ở bước 4 của pipeline.
Để chạy toàn hệ thống, `docker-compose.yml` dựng ba container: Auth (3001), Booking (3002) và SQL Server, đúng như mô tả triển khai ở mục 2.6.
Điểm giá trị của cách đóng gói này là **tính nhất quán môi trường**: cùng một định nghĩa container được dùng cho phát triển cục bộ, cho bước test trên CI, và cho demo, nên "chạy được trên máy tôi" không còn là một lời biện hộ.
Đây là tinh thần DevOps cốt lõi: thu hẹp khoảng cách giữa môi trường phát triển và môi trường chạy bằng cách mô tả hạ tầng thành mã (infrastructure as code), thay vì dựng tay mỗi nơi một kiểu.

## 6.5. Quản lý phiên bản và phát hành

Bước cuối của pipeline là **quản lý phát hành** (Ch.25), và nó cố ý chỉ chạy trong đúng một điều kiện: `push` vào nhánh `main`.
Khi đó job `release` dùng `softprops/action-gh-release` tạo một GitHub Release với tag `ci-${{ github.run_number }}` và tự sinh release notes từ các commit.
Việc gắn tag theo số lần chạy cho mỗi bản trên `main` một **định danh phiên bản** truy nguyên được: từ một release có thể lần ngược về đúng commit và đúng lần chạy CI đã sinh ra nó.
Chúng tôi giữ cơ chế phát hành ở mức nhẹ có chủ đích, phù hợp phạm vi đồ án: mục tiêu là thể hiện *khái niệm* phát hành tự động có phiên bản, không phải dựng một quy trình phát hành nhiều tầng (staging/production, phê duyệt thủ công) vốn không thêm điểm học thuật nào cho hệ thống này.

## 6.6. Tổng kết

Đường ống CI/CD khép kín vòng đời một thay đổi: từ lúc đẩy code, qua kiểm tra tĩnh, biên dịch, kiểm thử trên cơ sở dữ liệu thật, đóng gói container, tới phát hành có phiên bản, tất cả tự động và không có bước tay nào.
Đối với một đồ án hai người, giá trị lớn nhất của nó không phải là sự hào nhoáng mà là kỷ luật: mọi tuyên bố "hệ thống chạy đúng" trong báo cáo này đều được một máy độc lập kiểm chứng lại mỗi lần push, chứ không chỉ dựa vào lời của người viết.
