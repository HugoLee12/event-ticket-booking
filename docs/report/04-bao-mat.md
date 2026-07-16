# 4. Bảo mật (Security Engineering - Sommerville Ch.13)

## 4.1. Tổng quan thiết kế bảo mật hệ thống

Thiết kế bảo mật của hệ thống Event Ticket Booking được xây dựng dựa trên các nguyên lý cốt lõi trong Chương 13 sách Software Engineering của Ian Sommerville.
Hệ thống tập trung giải quyết ba thuộc tính an toàn thông tin cơ bản: tính xác thực (Authentication), tính phân quyền (Authorization) và tính toàn vẹn dữ liệu (Integrity).
Kiến trúc hệ thống áp dụng nguyên lý tách biệt trách nhiệm (Separation of Concerns) để thu hẹp bề mặt tấn công.
Auth Service đóng vai trò là một dịch vụ độc lập chuyên trách cho các tác vụ định danh nhạy cảm.
Booking Service hoàn toàn không xử lý thông tin xác thực gốc mà chỉ tiếp nhận kết quả xác thực dưới dạng token JWT stateless.
Việc cô lập này giúp bảo vệ cơ sở dữ liệu chứa thông tin tài khoản người dùng khỏi các truy vấn nghiệp vụ thông thường.
Lớp phòng thủ chiều sâu (Defense in Depth) được triển khai qua nhiều tầng bảo vệ từ kiểm duyệt dữ liệu đầu vào cho tới hạn chế brute-force ở tầng mạng.

## 4.2. Các cơ chế bảo mật đã triển khai trong code

**Cơ chế băm mật khẩu một chiều (Password Hashing).**
Hệ thống sử dụng thuật toán bcrypt với cost factor 10 để băm mật khẩu của người dùng.
Mật khẩu thô gửi lên từ API đăng ký được băm ngay lập tức trước khi lưu trữ vào cơ sở dữ liệu SQL Server.
Việc này đảm bảo kể cả khi cơ sở dữ liệu bị lộ, kẻ tấn công cũng không thể khôi phục lại mật khẩu gốc của người dùng.

**Xác thực dựa trên Token không trạng thái (Stateless JWT Authentication).**
Sau khi xác thực tài khoản thành công, Auth Service phát hành JSON Web Token (JWT) cho client.
Payload của JWT chứa các thông tin định danh tối thiểu bao gồm: `userId`, `role` và `email`.
Token được ký bằng khóa bí mật chung mạnh (JWT_SECRET) và được cấu hình thời gian hết hạn là 24 giờ (1d).
Thời hạn này giúp giới hạn khung thời gian tấn công nếu token vô tình bị rò rỉ hoặc chiếm đoạt.

**Xác thực cục bộ tại Booking Service (Local Verification).**
Nhằm tối ưu hiệu năng và giảm phụ thuộc mạng, Booking Service sử dụng cơ chế verify JWT cục bộ bằng khóa bí mật dùng chung.
Booking Service không cần thực hiện lời gọi mạng sang Auth Service cho mỗi request thông thường.
Giải pháp lai này giúp tăng tốc độ phản hồi của API đặt vé và giảm thiểu rủi ro nghẽn cổ chai cho Auth Service.

**Phân quyền dựa trên vai trò (Role-based Authorization).**
Hệ thống hỗ trợ hai vai trò người dùng là `user` thường và `admin`.
Vai trò của người dùng được mã hóa trực tiếp bên trong payload của JWT.
Middleware `requireAuth` phân tích token và gắn payload đã xác thực vào request, còn việc chặn theo vai trò được kiểm tra trực tiếp trong handler của endpoint nhạy cảm.
Ví dụ, handler của API thống kê `/api/v1/metrics` (trong `metrics.ts`) kiểm tra trực tiếp `role === 'admin'` từ JWT payload và trả `403` nếu không phải admin.

**Kiểm duyệt dữ liệu nghiêm ngặt (Input Validation).**
Thư viện `zod` được tích hợp tại biên API của cả hai service để định nghĩa các schema dữ liệu chặt chẽ.
Mọi request đi vào hệ thống đều được kiểm tra kiểu dữ liệu, định dạng và độ dài theo schema trước khi xử lý nghiệp vụ.
Cơ chế này loại bỏ dữ liệu rác và các payload dị dạng trước khi chúng chạm tới tầng nghiệp vụ hoặc tầng truy cập dữ liệu.

**Cơ chế chống dò quét mật khẩu (Rate Limiting).**
Middleware `express-rate-limit` được cấu hình riêng cho endpoint đăng nhập `/api/v1/auth/login`.
Hệ thống giới hạn tối đa 10 lần đăng nhập thất bại từ cùng một địa chỉ IP trong vòng 15 phút.
Các lần đăng nhập thành công không bị tính vào giới hạn (cấu hình `skipSuccessfulRequests`), nên người dùng hợp lệ không bị khoá oan.
Cơ chế này ngăn chặn hiệu quả các cuộc tấn công dò quét mật khẩu tự động (Brute-force Attacks).

**Cấu hình Header an toàn (Security Hardening).**
Middleware `helmet` được tích hợp ở cả hai service để tự động bổ sung các HTTP headers bảo mật tiêu chuẩn.
Các header này bảo vệ người dùng cuối khỏi các lỗ hổng XSS (Cross-Site Scripting), Clickjacking và MIME sniffing.

**Ngăn chặn chèn truy vấn SQL (SQL Injection Prevention).**
Toàn bộ các truy vấn đến cơ sở dữ liệu SQL Server đều sử dụng Parameterized Queries thông qua thư viện `mssql`.
Các tham số đầu vào được định nghĩa kiểu dữ liệu rõ ràng (như `sql.NVarChar`, `sql.Int`) trước khi gửi tới DB engine.
Việc này loại bỏ hoàn toàn khả năng kẻ tấn công chèn mã SQL độc hại thông qua kỹ thuật cộng chuỗi thô.

## 4.3. Bảng mô hình hóa mối đe dọa STRIDE

| Nhóm nguy cơ (STRIDE) | Mối đe dọa cụ thể (Threat Description) | Thành phần bị ảnh hưởng (Target) | Cơ chế giảm thiểu đã code (Mitigation) |
| :--- | :--- | :--- | :--- |
| **S**poofing (Giả mạo) | Kẻ tấn công giả mạo làm người dùng hợp lệ để đặt vé trái phép. | Endpoint POST `/api/v1/bookings` | Sử dụng JWT với thuật toán ký số HS256 và khóa bí mật mạnh để xác thực ở middleware. |
| **S**poofing (Giả mạo) | Kẻ tấn công sử dụng công cụ tự động để brute-force tài khoản. | Endpoint POST `/api/v1/auth/login` | Tích hợp `express-rate-limit` giới hạn tối đa 10 lần thử login sai từ một IP trong 15 phút. |
| **T**ampering (Can thiệp) | Thay đổi tham số truyền lên (như cố ý đổi role thành admin khi đăng ký). | Request Payload đăng ký / đặt vé | Định nghĩa cấu trúc đầu vào qua `zod` schema, tự động loại bỏ trường lạ ngoài khai báo. |
| **T**ampering (Can thiệp) | Chèn câu lệnh SQL phá hoại hoặc đánh cắp dữ liệu database. | SQL Server Database | Sử dụng Parameterized Queries của thư viện `mssql`, không ghép chuỗi SQL thô trong code. |
| **R**epudiation (Chối bỏ) | Người dùng đặt vé thành công nhưng chối bỏ giao dịch để đòi hoàn tiền. | Trạng thái đặt vé (Booking record) | Ghi log có cấu trúc qua `pino` lưu chi tiết `userId`, `seatId`, `timestamp` để đối soát. |
| **I**nformation Disclosure | Kẻ tấn công chiếm được file DB và đọc trộm mật khẩu người dùng. | Bảng `dbo.[User]` trong Database | Mã hóa một chiều mật khẩu bằng thuật toán `bcrypt` với cost factor 10 trước khi lưu. |
| **I**nformation Disclosure | Token JWT bị bắt trộm trên đường truyền không được bảo vệ. | Toàn bộ đường truyền mạng | Khuyến nghị cấu hình HTTPS ở production; thiết lập thời gian hết hạn JWT ngắn (24 giờ). |
| **D**enial of Service | Hacker gửi hàng loạt request login liên tục làm cạn kiệt tài nguyên. | CPU/RAM của Auth Service | `express-rate-limit` chặn IP spam request vượt ngưỡng quy định trước khi xử lý nghiệp vụ. |
| **D**enial of Service | Tranh chấp đặt vé gây ra khóa chết (deadlock) hoặc nghẽn DB. | Database, Booking Service | Sử dụng optimistic locking qua `ROWVERSION` của SQL Server giúp giải phóng kết nối cực nhanh. |
| **E**levation of Privilege | Người dùng thường cố tình gọi API thống kê metrics của Admin. | Endpoint GET `/api/v1/metrics` | Sau `requireAuth`, handler `/metrics` (trong `metrics.ts`) kiểm tra trực tiếp `role === 'admin'` từ JWT payload, trả `403` nếu không phải admin. |

## 4.4. Bằng chứng thực nghiệm

Nhất quán với nguyên tắc "mọi số liệu đưa ra đều là số đo thật" đã nêu ở mục 1, phần này trình bày output thật bắt trực tiếp từ hệ thống đang chạy để minh chứng ba cơ chế bảo mật trọng yếu hoạt động đúng, chứ không dừng ở mô tả lý thuyết.

**Phân quyền: người dùng thường bị chặn khỏi endpoint của admin.**
Khi một client mang JWT có `role: 'user'` gọi `GET /api/v1/metrics`, handler kiểm tra vai trò inline và trả về:

```
HTTP/1.1 403 Forbidden
{"error":"Chỉ admin được xem metrics"}
```

Đây chính là ca test `/metrics role user -> 403` trong bộ 13 test của Booking (mục 7.2), khẳng định dòng E - Elevation of Privilege trong bảng STRIDE ở trên được chặn thật trong code chứ không chỉ trên giấy.

**Chống brute-force: rate limit chặn IP dò quét mật khẩu.**
Sau 10 lần đăng nhập sai liên tiếp từ cùng một địa chỉ IP trong cửa sổ 15 phút, `express-rate-limit` chặn request thứ 11 ngay tại tầng middleware, trước khi kịp chạm tới truy vấn cơ sở dữ liệu:

```
HTTP/1.1 429 Too Many Requests
{"error":"Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 15 phút"}
```

Nhờ cấu hình `skipSuccessfulRequests: true`, chỉ các lần đăng nhập sai mới bị tính vào ngưỡng, nên người dùng hợp lệ nhập đúng mật khẩu không bao giờ bị khoá oan.

**Một token JWT thật đã được giải mã.**
Token do Auth Service phát hành sau khi đăng nhập thành công, khi giải mã (decode) sẽ tách ra phần header và phần payload như sau:

```json
header:  {"alg":"HS256","typ":"JWT"}
payload: {"userId":7,"role":"user","email":"linh@example.com","iat":1784171131,"exp":1784257531}
```

Payload chỉ chứa ba trường định danh tối thiểu (`userId`, `role`, `email`), tuyệt đối không mang mật khẩu hay dữ liệu nhạy cảm nào theo đúng nguyên tắc tối thiểu hóa dữ liệu.
Header cố định `alg: HS256`: cả Auth Service (khi ký) lẫn Booking Service (khi verify) đều pin cứng thuật toán này qua tùy chọn `algorithms: ['HS256']`, nhờ đó loại bỏ lỗ hổng `alg: none` kinh điển - nơi kẻ tấn công hạ cấp thuật toán ký để qua mặt bước kiểm tra chữ ký.
Hai mốc thời gian cho hiệu `exp - iat = 86400` giây (đúng 24 giờ), xác nhận thời hạn token khớp với cấu hình `expiresIn: '1d'` và giới hạn được khung thời gian tấn công nếu token chẳng may bị rò rỉ.

## 4.5. Nhìn lại: phạm vi bảo mật và các đánh đổi có ý thức

Thiết kế bảo mật của đồ án tập trung nguồn lực vào những mối đe dọa sát với bối cảnh vận hành và kịch bản trung tâm, thay vì trải mỏng để phủ mọi biện pháp có thể có.
Vì vậy, một số lớp bảo vệ đã được cố ý đặt ngoài phạm vi (Out of Scope trong spec), và chúng tôi ghi nhận rõ ở đây như những đánh đổi có ý thức chứ không phải lỗ hổng bị bỏ sót.

Thứ nhất, hệ thống chưa bật HTTPS ở môi trường phát triển: các service giao tiếp qua HTTP thuần trong mạng nội bộ Docker Compose, nên token JWT trên đường truyền chưa được mã hóa kênh.
Ở production, đây là điều bắt buộc phải bổ sung (như dòng Information Disclosure trong bảng STRIDE đã khuyến nghị), và cũng là lý do token được đặt thời hạn ngắn để giảm thiểu hậu quả nếu bị bắt trộm.
Thứ hai, hệ thống chưa có cơ chế chống CSRF: với thiết kế API stateless dùng token trong header `Authorization` (không dùng cookie phiên), bề mặt tấn công CSRF gần như không tồn tại trong phạm vi hiện tại, nhưng nếu sau này thêm đăng nhập qua cookie thì phải bổ sung ngay.
Thứ ba, hệ thống chỉ có register/login cơ bản, chưa có refresh token, quên mật khẩu hay đăng nhập mạng xã hội: token 24 giờ hết hạn thì người dùng đăng nhập lại, chấp nhận được cho một đồ án minh họa nhưng sẽ gây khó chịu ở sản phẩm thật.
Cuối cùng, mô hình STRIDE được trình bày dạng bảng phân tích trong báo cáo chứ không hiện thực hóa thành một threat model đầy đủ trong code.

Cách phân bổ này phản ánh đúng tinh thần của Chương 13: bảo mật là một chuỗi đánh đổi giữa chi phí, rủi ro và giá trị tài sản cần bảo vệ, và một hệ thống trưởng thành là hệ thống biết rõ ranh giới phòng thủ của mình đang nằm ở đâu.
