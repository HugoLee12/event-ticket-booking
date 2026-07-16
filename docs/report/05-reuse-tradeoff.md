# 5. Tái sử dụng và các quyết định đánh đổi

Mục này trình bày những thành phần phần mềm mà hệ thống tái sử dụng thay vì tự viết, và hai quyết định đánh đổi lớn được ghi lại trong ADR.
Nội dung neo vào chương Software Reuse (Chương 15) và Component-Based Software Engineering (Chương 16) của Sommerville.
Luận điểm chính: hầu như mọi cơ chế hạ tầng của hệ thống đều là code tái sử dụng đã được kiểm chứng, còn phần code chúng tôi tự viết được dồn vào đúng chỗ tạo ra giá trị riêng của bài toán, là logic chống double-booking và luồng composition.

## 5.1. Cảnh quan tái sử dụng của hệ thống

Sommerville (Chương 15) phân tái sử dụng theo nhiều mức, từ tái dùng cả framework, tới tái dùng thành phần/thư viện, tới tái dùng hạ tầng.
Hệ thống này tái sử dụng ở cả ba mức:

| Thành phần | Mức tái sử dụng | Vai trò | Nếu tự viết sẽ phải |
|---|---|---|---|
| Express | Framework | định tuyến HTTP, middleware | tự viết vòng lặp HTTP, parse request, quản lý middleware |
| `mssql` | Thư viện (driver) | kết nối và truy vấn SQL Server bằng raw SQL | tự cài giao thức TDS của SQL Server |
| `cockatiel` | Thành phần (Chương 16) | timeout + retry + circuit breaker + fallback | tự cài máy trạng thái circuit breaker, dễ sai |
| `zod` | Thư viện | kiểm duyệt và ép kiểu dữ liệu đầu vào | tự viết validation thủ công cho từng trường |
| `bcrypt` | Thư viện | băm mật khẩu có salt | tự cài thuật toán băm mật khẩu, rủi ro bảo mật cao |
| `helmet` | Thành phần | đặt các HTTP header bảo mật | tự nghiên cứu và đặt từng header một |
| `pino` | Thư viện | structured logging JSON | tự viết logger có cấu trúc, quản lý cấp độ log |
| Jest + Supertest | Framework kiểm thử | chạy test và bắn request HTTP | tự viết test runner và HTTP client cho test |

Mỗi dòng trong bảng là một mẩu công việc *không* phải làm, và quan trọng hơn, *không* phải bảo trì và sửa lỗi.

## 5.2. Vì sao tái sử dụng: lợi ích và cái giá

Lợi ích của tái sử dụng mà Sommerville nêu (Chương 15) thể hiện rõ trong đồ án: phát triển nhanh hơn (accelerated development), độ tin cậy cao hơn nhờ dùng code đã được nhiều người kiểm nghiệm (increased dependability), và tận dụng chuyên môn của người khác (use of specialists).
Hai ví dụ đắt giá nhất là `bcrypt` và `cockatiel`.
Với `bcrypt`, nguyên tắc bảo mật là *không bao giờ tự cài thuật toán mật mã*: một hàm băm tự viết gần như chắc chắn sẽ có lỗ hổng mà một thư viện được kiểm toán rộng rãi không có, nên tái sử dụng ở đây trực tiếp làm tăng độ tin cậy.
Với `cockatiel`, circuit breaker là một máy trạng thái (đóng/mở/nửa-mở) với nhiều ca biên tinh vi; tự cài sẽ tốn thời gian và dễ sai đúng vào lúc cần nó nhất, nên tái dùng một thành phần đã kiểm chứng là lựa chọn vừa nhanh vừa an toàn.

Nhưng tái sử dụng cũng có cái giá mà Sommerville cảnh báo: lệ thuộc phiên bản và mất một phần quyền kiểm soát.
Đồ án gặp đúng cái giá đó và phải quản lý nó một cách tường minh: `cockatiel` phải ghim ở `^3` vì bản `v4` chỉ còn ESM nên Jest (chạy CommonJS) không nạp được; `typescript` phải ghim ở `^5` vì `ts-jest` chưa hỗ trợ `v7`.
Đây là minh hoạ sống cho một điểm của Chương 15: các thành phần tái sử dụng ràng buộc phiên bản lẫn nhau, và việc chọn dùng chúng đi kèm trách nhiệm quản lý những ràng buộc đó, chứ không phải bữa trưa miễn phí.

Một quyết định tái sử dụng ngược chiều cũng đáng nói: chúng tôi **cố ý không dùng ORM** (một mức tái sử dụng cao hơn) mà chỉ dùng driver `mssql` thô.
Lý do là ORM sẽ trừu tượng hoá mất quyền truy cập trực tiếp vào `ROWVERSION` của SQL Server, chính là cơ chế lõi để chống double-booking (mục 3).
Đây là ví dụ cho thấy tái sử dụng nhiều hơn không phải lúc nào cũng tốt hơn: khi một tính năng nền tảng là cốt lõi của bài toán, việc trừu tượng nó đi sẽ lấy mất thứ ta cần nhất, nên ở đây tái dùng ít hơn lại là lựa chọn đúng (ADR-0001).

## 5.3. Đánh đổi 1: kiểm soát đồng thời (ADR-0001)

Quyết định chống double-booking là chọn giữa ba hướng: optimistic concurrency control, pessimistic locking, và queue-based serialization.
Cơ chế của lựa chọn optimistic đã phân tích kỹ ở mục 3; ở đây tóm tắt dưới góc nhìn đánh đổi:

| Hướng | Ưu | Nhược | Lý do loại/chọn |
|---|---|---|---|
| Optimistic (ROWVERSION) | stateless, không khoá dài, kể được câu chuyện REST 409 + retry | phải xử lý xung đột lúc ghi | **chọn**: hợp giả định tranh chấp thấp, dùng tính năng có sẵn của SQL Server |
| Pessimistic (row lock) | đơn giản về khái niệm | chặn request, giữ khoá lâu, khó nhân bản | loại: nghịch với stateless, kể chuyện resilience kém |
| Queue-based | an toàn nhất về tranh chấp | cần thêm message broker | loại: rủi ro thời gian trong deadline 2.5 tuần |

Điểm cốt lõi của đánh đổi: optimistic được chọn vì nó khớp với giả định nghiệp vụ (xác suất hai người nhắm đúng một ghế là thấp so với tổng lưu lượng), giữ được tính stateless, và biến chính kịch bản tranh chấp thành sợi chỉ đỏ nối Chương 17, Chương 18 và Chương 14.

## 5.4. Đánh đổi 2: chiến lược xác thực (ADR-0002)

Quyết định thứ hai là cách Booking Service xác thực và lấy hồ sơ người dùng, chọn giữa ba phương án:

| Phương án | Ưu | Nhược |
|---|---|---|
| Verify JWT cục bộ thuần | gọn, đúng chuẩn microservices stateless | không có điểm resilience service-to-service để minh hoạ Chương 14 |
| Introspection từ xa mỗi request | có tình huống resilience | phản mẫu JWT stateless, chậm, phụ thuộc Auth cho mọi request |
| **Lai (chọn)** | stateless đúng chuẩn *và* có một điểm resilience thật | thêm một lời gọi mạng phụ, phải bọc chống lỗi |

Chúng tôi chọn phương án **lai**: verify JWT cục bộ bằng secret chung cho mọi request (giữ stateless, đường then chốt không phụ thuộc Auth), nhưng khi đặt vé thành công thì gọi một lần sang Auth lấy hồ sơ để ghép vào xác nhận, và **chỉ lời gọi đó** được bọc `cockatiel`.
Đánh đổi này đạt hai mục tiêu tưởng như xung khắc: giữ tính stateless đúng chuẩn của xác thực phân tán (Chương 17), đồng thời tạo ra đúng một điểm hỏng có kiểm soát để hiện thực và chứng minh các cơ chế resilience của Chương 14 (mục 3).
Cái giá phải trả (một lời gọi mạng phụ có thể hỏng) chính là thứ được biến thành giá trị, vì nó cho phép trình diễn graceful degradation thật thay vì chỉ nói về nó trên giấy.

## 5.5. Tổng kết

Nguyên tắc tái sử dụng của đồ án có thể tóm trong một câu: tái dùng tối đa những gì đã có và đã được kiểm chứng, để dành công sức tự viết cho đúng phần lõi tạo ra giá trị riêng của bài toán.
Hạ tầng (web, DB driver, resilience, validation, mật mã, header bảo mật, logging, testing) đều là thành phần tái sử dụng; phần tự viết được dồn vào logic chống double-booking và luồng composition, là nơi không có thư viện nào làm thay được.
Hai quyết định đánh đổi trong ADR cho thấy tái sử dụng không phải là chọn mặc định thứ cao cấp nhất, mà là cân nhắc có ý thức giữa tốc độ, quyền kiểm soát, độ tin cậy và câu chuyện kiến trúc mà hệ thống cần kể.
