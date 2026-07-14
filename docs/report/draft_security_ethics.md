# ĐỀ CƯƠNG BÁO CÁO GIAI ĐOẠN 4 - PHẦN A (AUTH SERVICE & BẢO MẬT)

Tài liệu này chứa bản nháp thô chi tiết cho phần báo cáo của thành viên A (Auth Service & Bảo mật).
Các nội dung này được thiết kế để copy trực tiếp sang file báo cáo Word (.docx) của nhóm.
Mỗi câu hoặc gạch đầu dòng được viết trên một dòng riêng biệt để tránh xung đột khi git merge.

---

## 4. Bảo mật (Security Engineering - Sommerville Ch.13)

### 4.1. Tổng quan thiết kế bảo mật hệ thống
* Thiết kế bảo mật của hệ thống Event Ticket Booking được xây dựng dựa trên các nguyên lý cốt lõi trong Chương 13 sách Software Engineering của Ian Sommerville.
* Hệ thống tập trung giải quyết ba thuộc tính an toàn thông tin cơ bản: tính xác thực (Authentication), tính phân quyền (Authorization) và tính toàn vẹn dữ liệu (Integrity).
* Kiến trúc hệ thống áp dụng nguyên lý tách biệt trách nhiệm (Separation of Concerns) để thu hẹp bề mặt tấn công.
* Auth Service đóng vai trò là một dịch vụ độc lập chuyên trách cho các tác vụ định danh nhạy cảm.
* Booking Service hoàn toàn không xử lý thông tin xác thực gốc mà chỉ tiếp nhận kết quả xác thực dưới dạng token JWT stateless.
* Việc cô lập này giúp bảo vệ cơ sở dữ liệu chứa thông tin tài khoản người dùng khỏi các truy vấn nghiệp vụ thông thường.
* Lớp phòng thủ chiều sâu (Defense in Depth) được triển khai qua nhiều tầng bảo vệ từ kiểm duyệt dữ liệu đầu vào cho tới hạn chế brute-force ở tầng mạng.

### 4.2. Các cơ chế bảo mật đã triển khai trong code
* **Cơ chế băm mật khẩu một chiều (Password Hashing):**
* Hệ thống sử dụng thuật toán bcrypt với 10 vòng muối (salt rounds) để băm mật khẩu của người dùng.
* Mật khẩu thô gửi lên từ API đăng ký được băm ngay lập tức trước khi lưu trữ vào cơ sở dữ liệu SQL Server.
* Việc này đảm bảo kể cả khi cơ sở dữ liệu bị lộ, kẻ tấn công cũng không thể khôi phục lại mật khẩu gốc của người dùng.
* **Xác thực dựa trên Token không trạng thái (Stateless JWT Authentication):**
* Sau khi xác thực tài khoản thành công, Auth Service phát hành JSON Web Token (JWT) cho client.
* Payload của JWT chứa các thông tin định danh tối thiểu bao gồm: `userId`, `role` và `email`.
* Token được ký bằng khóa bí mật chung mạnh (JWT_SECRET) và được cấu hình thời gian hết hạn là 24 giờ (1d).
* Thời hạn này giúp giới hạn khung thời gian tấn công nếu token vô tình bị rò rỉ hoặc chiếm đoạt.
* **Xác thực cục bộ tại Booking Service (Local Verification):**
* Nhằm tối ưu hiệu năng và giảm phụ thuộc mạng, Booking Service sử dụng cơ chế verify JWT cục bộ bằng khóa bí mật dùng chung.
* Booking Service không cần thực hiện lời gọi mạng sang Auth Service cho mỗi request thông thường.
* Giải pháp lai này giúp tăng tốc độ phản hồi của API đặt vé và giảm thiểu rủi ro nghẽn cổ chai cho Auth Service.
* **Phân quyền dựa trên vai trò (Role-based Authorization):**
* Hệ thống hỗ trợ hai vai trò người dùng là `user` thường và `admin`.
* Vai trò của người dùng được mã hóa trực tiếp bên trong payload của JWT.
* Các middleware trong code sẽ phân tích token và chặn truy cập từ xa đối với các endpoint nhạy cảm.
* Ví dụ, chỉ những tài khoản có vai trò `admin` mới được quyền truy cập API thống kê `/api/v1/metrics`.
* **Kiểm duyệt dữ liệu nghiêm ngặt (Input Validation):**
* Thư viện `zod` được tích hợp tại biên API của cả hai service để định nghĩa các schema dữ liệu chặt chẽ.
* Mọi request đi vào hệ thống đều phải đi qua middleware validation để kiểm tra kiểu dữ liệu, định dạng và độ dài.
* Cơ chế này giúp loại bỏ hoàn toàn các dữ liệu rác, giảm thiểu nguy cơ tràn bộ đệm (Buffer Overflow) hoặc chèn mã độc.
* **Cơ chế chống dò quét mật khẩu (Rate Limiting):**
* Middleware `express-rate-limit` được cấu hình riêng cho endpoint đăng nhập `/api/v1/auth/login`.
* Hệ thống giới hạn tối đa 10 lần thử đăng nhập từ cùng một địa chỉ IP trong vòng 15 phút.
* Cơ chế này ngăn chặn hiệu quả các cuộc tấn công dò quét mật khẩu tự động (Brute-force Attacks).
* **Cấu hình Header an toàn (Security Hardening):**
* Middleware `helmet` được tích hợp để tự động bổ sung các HTTP headers bảo mật tiêu chuẩn.
* Các header này bảo vệ người dùng cuối khỏi các lỗ hổng XSS (Cross-Site Scripting), Clickjacking và MIME sniffing.
* **Ngăn chặn chèn truy vấn SQL (SQL Injection Prevention):**
* Toàn bộ các truy vấn đến cơ sở dữ liệu SQL Server đều sử dụng Parameterized Queries thông qua thư viện `mssql`.
* Các tham số đầu vào được định nghĩa kiểu dữ liệu rõ ràng (như `sql.NVarChar`, `sql.Int`) trước khi gửi tới DB engine.
* Việc này loại bỏ hoàn toàn khả năng kẻ tấn công chèn mã SQL độc hại thông qua kỹ thuật cộng chuỗi thô.

### 4.3. Bảng mô hình hóa mối đe dọa STRIDE

| Nhóm nguy cơ (STRIDE) | Mối đe dọa cụ thể (Threat Description) | Thành phần bị ảnh hưởng (Target) | Cơ chế giảm thiểu đã code (Mitigation) |
| :--- | :--- | :--- | :--- |
| **S**poofing (Giả mạo) | Kẻ tấn công giả mạo làm người dùng hợp lệ để đặt vé trái phép. | Endpoint POST `/api/v1/bookings` | Sử dụng JWT với thuật toán ký số HS256 và khóa bí mật mạnh để xác thực ở middleware. |
| **S**poofing (Giả mạo) | Kẻ tấn công sử dụng công cụ tự động để brute-force tài khoản. | Endpoint POST `/api/v1/auth/login` | Tích hợp `express-rate-limit` giới hạn tối đa 10 lần thử login sai từ một IP trong 15 phút. |
| **T**ampering (Can thiệp) | Thay đổi tham số truyền lên (như cố ý đổi role thành admin khi đăng ký). | Request Payload đăng ký / đặt vé | Định nghĩa cấu trúc đầu vào qua `zod` schema, tự động loại bỏ trường lạ ngoài khai báo. |
| **T**ampering (Can thiệp) | Chèn câu lệnh SQL phá hoại hoặc đánh cắp dữ liệu database. | SQL Server Database | Sử dụng Parameterized Queries của thư viện `mssql`, không ghép chuỗi SQL thô trong code. |
| **R**epudiation (Chối bỏ) | Người dùng đặt vé thành công nhưng chối bỏ giao dịch để đòi hoàn tiền. | Trạng thái đặt vé (Booking record) | Ghi log có cấu trúc qua `pino` lưu chi tiết `userId`, `seatId`, `timestamp` để đối soát. |
| **I**nformation Disclosure | Kẻ tấn công chiếm được file DB và đọc trộm mật khẩu người dùng. | Bảng `dbo.[User]` trong Database | Mã hóa một chiều mật khẩu bằng thuật toán `bcrypt` với 10 vòng muối trước khi lưu. |
| **I**nformation Disclosure | Token JWT bị bắt trộm trên đường truyền không được bảo vệ. | Toàn bộ đường truyền mạng | Khuyến nghị cấu hình HTTPS ở production; thiết lập thời gian hết hạn JWT ngắn (24 giờ). |
| **D**enial of Service | Hacker gửi hàng loạt request login liên tục làm cạn kiệt tài nguyên. | CPU/RAM của Auth Service | `express-rate-limit` chặn IP spam request vượt ngưỡng quy định trước khi xử lý nghiệp vụ. |
| **D**enial of Service | Tranh chấp đặt vé gây ra khóa chết (deadlock) hoặc nghẽn DB. | Database, Booking Service | Sử dụng optimistic locking qua `ROWVERSION` của SQL Server giúp giải phóng kết nối cực nhanh. |
| **E**levation of Privilege | Người dùng thường cố tình gọi API thống kê metrics của Admin. | Endpoint GET `/api/v1/metrics` | Middleware requireAdmin xác thực vai trò `admin` được trích xuất từ JWT payload. |

---

## 8. Đạo đức nghề nghiệp (Ethical Aspects - CLO8)

### 8.1. Trách nhiệm Bảo vệ Quyền riêng tư của người dùng (User Data Privacy)
* Quyền riêng tư là một trong những giá trị đạo đức cốt lõi được quy định trong Bộ quy tắc đạo đức ACM (ACM Code of Ethics - Mục 1.6: Respect Privacy).
* Đội ngũ phát triển hệ thống Event Ticket Booking đã hiện thực hóa cam kết này thông qua nguyên tắc tối thiểu hóa dữ liệu (Data Minimization).
* Hệ thống chỉ yêu cầu cung cấp email và tên hiển thị tự chọn để phục vụ mục đích định danh và in thông tin lên vé.
* Chúng tôi hoàn toàn không thu thập các thông tin cá nhân nhạy cảm khác như số điện thoại, địa chỉ nhà hay thông tin thẻ thanh toán khi chưa thực sự cần thiết.
* Bên cạnh đó, triết lý bảo mật thiết kế sẵn (Privacy by Design) được áp dụng nhất quán trong suốt vòng đời phát triển dự án.
* Mật khẩu của người dùng được mã hóa một chiều ngay từ thời điểm đăng ký tài khoản.
* Chúng tôi cam kết tuyệt đối không ghi nhận mật khẩu thô của người dùng vào bất kỳ tệp log vận hành nào của hệ thống (như pino log).
* Thời hạn tồn tại của token JWT được khống chế ở mức 24 giờ để cân bằng giữa sự tiện lợi của người dùng và rủi ro rò rỉ dữ liệu.
* Điều này tuân thủ nghiêm ngặt nghĩa vụ bảo mật thông tin và tôn trọng sự tự quyết của người dùng theo tinh thần của quy tắc đạo đức nghề nghiệp.

### 8.2. Trách nhiệm kỹ thuật đối với tranh chấp đặt vé (Double-booking Liability)
* Mục 1.2 của Bộ quy tắc đạo đức ACM quy định rõ ràng nghĩa vụ "Tránh gây hại" (Avoid Harm), đặc biệt là các thiệt hại về kinh tế và niềm tin của người dùng đối với sản phẩm phần mềm.
* Trong nghiệp vụ đặt vé sự kiện, lỗi double-booking (bán cùng một ghế cho hai người khác nhau) là một sự cố nghiêm trọng gây tổn hại trực tiếp đến khách hàng và uy tín của ban tổ chức.
* Để giải quyết triệt để rủi ro này, chúng tôi đã triển khai giải pháp kỹ thuật công bằng và minh bạch: optimistic locking sử dụng kiểu dữ liệu `ROWVERSION` của SQL Server.
* Khi xảy ra tranh chấp ghế cuối, hệ thống đảm bảo xử lý theo nguyên tắc "đến trước phục vụ trước" (First-Come, First-Served) một cách tự động và khách quan.
* Người gửi yêu cầu đến trước sẽ đặt vé thành công và ghi nhận giao dịch vào cơ sở dữ liệu.
* Người đến sau sẽ ngay lập tức nhận được phản hồi lỗi `409 Conflict` rõ ràng cùng mã lỗi tương ứng để họ chủ động chọn ghế khác.
* Sự minh bạch này ngăn chặn hoàn toàn việc thu tiền trùng lặp cho một chiếc ghế duy nhất, loại bỏ nguy cơ tranh chấp pháp lý cho doanh nghiệp.
* Đồng thời, tinh thần đạo đức thiết kế kiên cường (Resilience) được thể hiện qua cấu hình của thư viện `cockatiel` (Mục 1.4 ACM: Be Fair and Take Action Not to Discriminate).
* Khi Auth Service gặp sự cố gián đoạn kết nối, Booking Service sẽ kích hoạt cơ chế fallback để tiếp tục cho phép khách hàng đặt vé thành công với tên hiển thị mặc định.
* Chúng tôi tin rằng sự cố của một thành phần phụ trợ không được phép kéo sập toàn bộ dịch vụ cốt lõi và làm gián đoạn trải nghiệm của người dùng.
* Cuối cùng, hệ thống duy trì cơ chế ghi nhận log kiểm toán (audit logs) đầy đủ và có cấu trúc thông qua `pino`.
* Mọi hành động đặt vé thành công hay thất bại do tranh chấp đều được ghi nhận kèm mã định danh và mốc thời gian chính xác.
* Nhật ký vận hành này chính là bằng chứng kỹ thuật trung thực để đối soát và giải quyết các khiếu nại của khách hàng một cách công bằng nhất nếu có tranh chấp xảy ra.
