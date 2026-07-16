# 9. Kết luận và bài học

## 9.1. Kết luận

Đồ án đã xây dựng một hệ thống đặt vé sự kiện gồm hai service REST, chạy được và kiểm thử được, làm ví dụ hiện thực cho bốn chương của Sommerville.
Sợi chỉ đỏ race condition ghế cuối đã được giải quyết trọn vẹn và chứng minh bằng thực nghiệm: dưới 20 request đồng thời cùng đặt một ghế, hệ thống cho đúng một `201` và 19 `409`, cơ sở dữ liệu ghi nhận đúng một booking, không có double-booking.
Bất biến trung tâm ("một ghế bán cho tối đa một người") được bảo vệ ở hai tầng độc lập là optimistic locking trên `ROWVERSION` và ràng buộc `UNIQUE`, đúng tinh thần defence in depth.
Điểm gọi service-to-service duy nhất được bọc bốn lớp resilience của `cockatiel`, và log vận hành cho thấy cả composition, fallback lẫn circuit breaker đều hoạt động thật, nên sự cố của Auth Service không kéo sập nghiệp vụ đặt vé (graceful degradation).
Lớp bảo mật (JWT, phân quyền, bcrypt, zod, rate-limit, helmet, parameterized query) và đường ống CI/CD năm bước khép kín từ lint tới phát hành có phiên bản đã hoàn thiện các thuộc tính dependability và vận hành mà một hệ phân tán cần.

## 9.2. Bài học

**Về kỹ thuật.**
Bài học lớn nhất là chọn đúng công cụ nhất quán cho đúng loại dữ liệu: dữ liệu quyết định ai sở hữu ghế phải giữ nhất quán mạnh qua optimistic locking trên một cơ sở dữ liệu, còn dữ liệu hiển thị phụ như tên người dùng thì chấp nhận nhất quán lỏng và có thể tạm thiếu.
Việc phân loại đúng đâu là dữ liệu cốt lõi và đâu là dữ liệu phụ chính là quyết định cho phép hệ thống vừa đúng đắn vừa bền bỉ.
Một bài học kèm theo là đôi khi tái sử dụng ít lại tốt hơn: chúng tôi cố ý dùng driver `mssql` thô thay vì ORM, vì một tầng trừu tượng cao hơn sẽ che mất chính `ROWVERSION` là cơ chế lõi của bài toán.

**Về quy trình.**
Cố định trước các interface contract (payload JWT và response `/users/me`) giúp hai người phát triển hai service song song mà không lệch nhau, đúng lợi ích của thiết kế giao diện rõ ràng trong SOA.
Kiểm thử tích hợp trên cơ sở dữ liệu thật, lặp lại tự động trên CI, biến những tuyên bố về tính đúng đắn thành thứ được máy kiểm chứng lại mỗi lần push thay vì niềm tin của người viết.
Quá trình rà soát chéo cũng cho thấy giá trị của việc kiểm chứng khẳng định với code thật: một mối đe doạ leo thang đặc quyền từng được ghi là "đã giảm thiểu" trong bảng STRIDE nhưng thực tế code vẫn còn hở, và chỉ khi đối chiếu trực tiếp mới phát hiện và vá kèm test hồi quy.

