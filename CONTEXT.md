# Event Ticket Booking (Project CNTT313E1)

Đồ án môn Special Topics in Software Engineering: hệ thống đặt vé sự kiện gồm 2 service, minh hoạ SOA/REST (Ch.18), Distributed SE (Ch.17), Security Engineering (Ch.13), Resilience Engineering (Ch.14).

## Language

**Auth Service**:
Service quản lý đăng ký/đăng nhập người dùng, phát hành JWT dùng để xác thực các request tới Booking Service.
_Avoid_: User Service, Identity Service

**Booking Service**:
Service quản lý danh sách sự kiện (seed sẵn, không có CRUD admin) và xử lý đặt vé/ghế.
_Avoid_: Catalog Service, Ticket Service

**Event**:
Một sự kiện có thể đặt vé (ví dụ 1 suất chiếu/buổi diễn), có danh sách Seat cố định.

**Seat**:
Một chỗ ngồi thuộc về đúng 1 Event, có trạng thái trống/đã đặt và một `version` dùng cho optimistic locking.

**Booking**:
Bản ghi xác nhận một Seat đã được đặt bởi một người dùng đã xác thực (qua Auth Service).

**Race condition (ghế cuối)**:
Tình huống hai request đặt cùng 1 Seat gần như đồng thời; nếu không kiểm soát, cả hai có thể "thành công", dẫn đến 1 ghế bị bán cho 2 người. Đây là kịch bản trung tâm nối các chương Ch.17/18/14 lại với nhau.

**Optimistic locking**:
Chiến lược xử lý race condition: không khoá Seat trước, mà kiểm tra giá trị `ROWVERSION` (kiểu native của SQL Server, tự tăng mỗi lần UPDATE) khi ghi: `UPDATE Seat ... WHERE id=? AND row_version=?`. Nếu 0 dòng bị ảnh hưởng nghĩa là thua cuộc, API trả `409 Conflict`, client chịu trách nhiệm retry.
_Avoid_: Pessimistic locking, row lock, queue-based serialization (các phương án đã cân nhắc nhưng không chọn); "version tự quản lý bằng tay" (đã bỏ, dùng ROWVERSION native thay thế)
