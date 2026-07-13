# JWT verify cục bộ + một lời gọi service-to-service có resilience

Booking Service cần xác thực request và cần một tình huống resilience giữa 2 service để minh hoạ Ch.14.
Chúng tôi chọn phương án **lai**: Booking Service **verify JWT cục bộ** bằng khoá bí mật chung với Auth Service (stateless, không gọi mạng mỗi request); nhưng khi đặt vé thành công, Booking Service **gọi HTTP sang Auth Service lấy hồ sơ user** (tên/email) để đính vào xác nhận booking, và **chính lời gọi đó** được bọc timeout + retry + circuit breaker + fallback (qua `cockatiel`).

## Considered Options

- **Local verification thuần**: gọn, đúng chuẩn microservices, nhưng không còn tình huống resilience service-to-service để demo.
- **Remote introspection mỗi request**: cho tình huống resilience nhưng phản mẫu JWT stateless và chậm.

## Consequences

Giữ được tính stateless đúng chuẩn (verify cục bộ) *và* có một điểm resilience service-to-service thật để demo/kiểm thử.
Fallback: nếu Auth chậm/sập, booking vẫn thành công, chỉ thiếu tên hiển thị - dependability không bị lời gọi phụ trợ kéo sập.
