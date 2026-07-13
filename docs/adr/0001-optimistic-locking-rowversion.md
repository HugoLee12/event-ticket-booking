# Dùng optimistic locking qua SQL Server ROWVERSION cho tranh chấp ghế

Booking Service phải chống double-booking khi nhiều request đặt cùng 1 Seat gần như đồng thời (race condition ghế cuối).
Chúng tôi chọn **optimistic locking** dựa trên kiểu `ROWVERSION` native của SQL Server (`UPDATE Seat ... WHERE id=? AND row_version=?`, 0 dòng bị ảnh hưởng nghĩa là thua cuộc → trả `409 Conflict`, client retry) thay vì pessimistic locking (row lock, chờ) hoặc queue-based serialization (hàng đợi).

## Considered Options

- **Pessimistic locking** (`SELECT ... FOR UPDATE`/row lock): đơn giản nhưng chặn request và kể chuyện REST/resilience kém hấp dẫn hơn.
- **Queue-based serialization**: an toàn nhất về mặt tranh chấp nhưng cần thêm hạ tầng message broker → rủi ro thời gian trong deadline 2.5 tuần.
- **Version tự quản lý bằng tay** (cột `version Int` tự tăng): khả thi nhưng bỏ phí tính năng có sẵn của SQL Server.

## Consequences

Kịch bản race condition trở thành sợi chỉ đỏ nối Ch.17 (consistency), Ch.18 (REST error semantics 409) và Ch.14 (retry/resilience).
Ràng buộc: phải thao tác DB bằng raw SQL qua package `mssql` (không dùng ORM) để map `ROWVERSION` đúng cách - xem [ADR-0002] về stack.
