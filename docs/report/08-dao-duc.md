# 8. Đạo đức nghề nghiệp (Ethical Aspects - CLO8)

## 8.1. Trách nhiệm Bảo vệ Quyền riêng tư của người dùng (User Data Privacy)

Quyền riêng tư là một trong những giá trị đạo đức cốt lõi được quy định trong Bộ quy tắc đạo đức ACM (ACM Code of Ethics - Mục 1.6: Respect Privacy).
Đội ngũ phát triển hệ thống Event Ticket Booking đã hiện thực hóa cam kết này thông qua nguyên tắc tối thiểu hóa dữ liệu (Data Minimization).
Hệ thống chỉ yêu cầu cung cấp email và tên hiển thị tự chọn để phục vụ mục đích định danh và in thông tin lên vé.
Chúng tôi hoàn toàn không thu thập các thông tin cá nhân nhạy cảm khác như số điện thoại, địa chỉ nhà hay thông tin thẻ thanh toán khi chưa thực sự cần thiết.
Bên cạnh đó, triết lý bảo mật thiết kế sẵn (Privacy by Design) được áp dụng nhất quán trong suốt vòng đời phát triển dự án.
Mật khẩu của người dùng được mã hóa một chiều ngay từ thời điểm đăng ký tài khoản.
Chúng tôi cam kết tuyệt đối không ghi nhận mật khẩu thô của người dùng vào bất kỳ tệp log vận hành nào của hệ thống (như pino log).
Thời hạn tồn tại của token JWT được khống chế ở mức 24 giờ để cân bằng giữa sự tiện lợi của người dùng và rủi ro rò rỉ dữ liệu.
Điều này tuân thủ nghiêm ngặt nghĩa vụ bảo mật thông tin và tôn trọng sự tự quyết của người dùng theo tinh thần của quy tắc đạo đức nghề nghiệp.

## 8.2. Trách nhiệm kỹ thuật đối với tranh chấp đặt vé (Double-booking Liability)

Mục 1.2 của Bộ quy tắc đạo đức ACM quy định rõ ràng nghĩa vụ "Tránh gây hại" (Avoid Harm), đặc biệt là các thiệt hại về kinh tế và niềm tin của người dùng đối với sản phẩm phần mềm.
Trong nghiệp vụ đặt vé sự kiện, lỗi double-booking (bán cùng một ghế cho hai người khác nhau) là một sự cố nghiêm trọng gây tổn hại trực tiếp đến khách hàng và uy tín của ban tổ chức.
Để giải quyết triệt để rủi ro này, chúng tôi đã triển khai giải pháp kỹ thuật công bằng và minh bạch: optimistic locking sử dụng kiểu dữ liệu `ROWVERSION` của SQL Server.
Khi xảy ra tranh chấp ghế cuối, hệ thống đảm bảo xử lý theo nguyên tắc "đến trước phục vụ trước" (First-Come, First-Served) một cách tự động và khách quan.
Người gửi yêu cầu đến trước sẽ đặt vé thành công và ghi nhận giao dịch vào cơ sở dữ liệu.
Người đến sau sẽ ngay lập tức nhận được phản hồi lỗi `409 Conflict` rõ ràng cùng mã lỗi tương ứng để họ chủ động chọn ghế khác.
Sự minh bạch này ngăn chặn hoàn toàn việc thu tiền trùng lặp cho một chiếc ghế duy nhất, loại bỏ nguy cơ tranh chấp pháp lý cho doanh nghiệp.
Đồng thời, tinh thần đạo đức thiết kế kiên cường (Resilience) được thể hiện qua cấu hình của thư viện `cockatiel` (Mục 1.4 ACM: Be Fair and Take Action Not to Discriminate).
Khi Auth Service gặp sự cố gián đoạn kết nối, Booking Service sẽ kích hoạt cơ chế fallback để tiếp tục cho phép khách hàng đặt vé thành công.
Xác nhận đặt vé khi đó trả `user: null` thay vì hồ sơ người dùng, tức tạm thiếu tên hiển thị nhưng giao dịch giữ chỗ vẫn được ghi nhận đầy đủ (nhất quán với mô tả ở mục 2 và mục 3).
Chúng tôi tin rằng sự cố của một thành phần phụ trợ không được phép kéo sập toàn bộ dịch vụ cốt lõi và làm gián đoạn trải nghiệm của người dùng.
Cuối cùng, hệ thống duy trì cơ chế ghi nhận log kiểm toán (audit logs) đầy đủ và có cấu trúc thông qua `pino`.
Mọi hành động đặt vé thành công hay thất bại do tranh chấp đều được ghi nhận kèm mã định danh và mốc thời gian chính xác.
Nhật ký vận hành này chính là bằng chứng kỹ thuật trung thực để đối soát và giải quyết các khiếu nại của khách hàng một cách công bằng nhất nếu có tranh chấp xảy ra.

## 8.3. Trách nhiệm nghề nghiệp khi dùng AI hỗ trợ phát triển (AI-assisted Development)

Một thực tế cụ thể của chính đồ án này là cả hai thành viên đều sử dụng công cụ AI để hỗ trợ viết code, và chúng tôi cho rằng chính điều đó đặt ra một câu hỏi đạo đức nghề nghiệp cần được nói thẳng.
Mục 2.2 của Bộ quy tắc đạo đức ACM (ACM Code of Ethics) yêu cầu người kỹ sư "chỉ nhận và thực hiện công việc trong phạm vi năng lực của mình" và phải chịu trách nhiệm về chất lượng sản phẩm mình bàn giao.
Nguyên tắc này không hề được nới lỏng khi một phần code do AI sinh ra: công cụ chỉ là phương tiện, còn trách nhiệm cuối cùng về tính đúng đắn, an toàn và hệ quả của phần mềm vẫn hoàn toàn thuộc về người phát triển ký tên vào commit.
Chúng tôi ý thức rằng code do AI tạo ra có thể trông hợp lý nhưng vẫn chứa lỗi tinh vi, sai giả định về nghiệp vụ, hoặc lỗ hổng bảo mật, nên tuyệt đối không được tin tưởng một cách mù quáng.

Vì vậy, quy trình làm việc của nhóm coi mọi đề xuất từ AI là một bản nháp cần được kiểm chứng, chứ không phải một đáp án để chép thẳng.
Mỗi thành viên phải thật sự hiểu đoạn code trước khi đưa vào nhánh chung, đủ để giải thích được vì sao nó đúng và bảo trì nó về sau khi không còn công cụ hỗ trợ.
Bộ integration test chạy trên SQL Server thật (mục 7) đóng vai trò tấm lưới an toàn khách quan: nó kiểm chứng hành vi thực tế của code bất kể code đó do người hay AI viết ra, đặc biệt ở bất biến chống double-booking nơi một lỗi nhỏ sẽ gây thiệt hại thật.
Một minh chứng cụ thể cho tinh thần này là trong quá trình rà chéo, nhóm đã tự phát hiện và vá một lỗ hổng leo thang đặc quyền (API đăng ký từng nhận trường `role` từ client, cho phép tự phong `admin`) - cho thấy việc con người rà soát lại và không phó thác hoàn toàn cho công cụ là điều kiện bắt buộc.

Chúng tôi cũng chủ trương minh bạch về việc sử dụng AI thay vì che giấu, coi đó là một phần của tính trung thực học thuật và nghề nghiệp (ACM Mục 1.3: Be Honest and Trustworthy).
Nói ngắn gọn, AI giúp nhóm đi nhanh hơn, nhưng nó không san sẻ trách nhiệm: người kỹ sư vẫn là người duy nhất đứng ra bảo đảm cho sản phẩm cuối cùng.
