# 1. Giới thiệu và bối cảnh

## 1.1. Bài toán

Báo cáo này trình bày thiết kế và hiện thực một hệ thống đặt vé sự kiện (Event Ticket Booking) như một ví dụ chạy được cho các chương của Sommerville, với bốn chương trọng tâm: Security Engineering (Chương 13), Resilience Engineering (Chương 14), Distributed Software Engineering (Chương 17) và Service-Oriented Software Engineering (Chương 18).
Ngoài bốn chương trọng tâm, báo cáo còn neo thêm các chương về tái sử dụng và đánh đổi (Chương 15, Chương 16) ở mục 5 và CI/CD (Chương 25) ở mục 6.
Đặt vé là một miền nghiệp vụ quen thuộc nhưng chứa đúng một bài toán khó điển hình: khi một sự kiện gần hết chỗ, nhiều khách có thể cùng nhắm vào một ghế cuối tại cùng một thời điểm.
Nếu hệ thống xử lý sai, cùng một ghế bị bán cho hai người, gây thiệt hại tài chính, mất niềm tin và có thể phát sinh trách nhiệm pháp lý.

Chúng tôi chọn kịch bản **race condition ghế cuối** làm sợi chỉ đỏ xuyên suốt báo cáo, vì nó nối được cả bốn chương vào một điểm cụ thể: nó vừa là vấn đề nhất quán dữ liệu trong hệ phân tán (Chương 17), vừa là ngữ nghĩa lỗi của REST khi trả `409 Conflict` (Chương 18), vừa là tình huống cho client thử lại và cho hệ thống chịu lỗi (Chương 14); còn xác thực và phân quyền (Chương 13) là lớp bảo vệ độc lập bao quanh toàn bộ luồng.
Cách chọn một kịch bản trung tâm thay vì minh hoạ rời rạc từng chương giúp báo cáo có một mạch lập luận liền, và giúp mọi quyết định kỹ thuật đều quy chiếu về một yêu cầu bất biến duy nhất: **một ghế chỉ được bán cho tối đa một người, trong mọi tình huống đồng thời**.

## 1.2. Vì sao chọn kiến trúc phân tán hướng dịch vụ thay vì monolith

Hệ thống được tách thành **hai service**: Auth Service (đăng ký, đăng nhập, phát JWT, quản lý vai trò) và Booking Service (sự kiện, ghế, đặt vé), giao tiếp với nhau qua REST.
Với một hệ thống quy mô đồ án, một khối monolith duy nhất sẽ viết nhanh hơn và ít phần chuyển động hơn; chúng tôi ý thức rõ điều đó và không cho rằng phân tán luôn là lựa chọn đúng.
Việc tách hai service ở đây là một quyết định có chủ đích, dựa trên hai lý do.

Thứ nhất, về mặt kỹ thuật, xác thực và đặt vé là hai mối quan tâm tách bạch (bounded context): chúng có vòng đời, hồ sơ bảo mật và lý do thay đổi riêng, nên tách chúng là biểu hiện của **separation of concerns** ở cấp kiến trúc (Chương 18).
Sự tách này tạo ra đúng một điểm gọi service-to-service (Booking hỏi Auth về hồ sơ người dùng), và chính điểm đó cho phép chúng tôi hiện thực và chứng minh các cơ chế chịu lỗi thật của Chương 14, thứ mà một monolith gọi hàm nội bộ sẽ không có để trình bày.
Thứ hai, về mặt sư phạm, đề bài yêu cầu minh hoạ các chương phân tán và hướng dịch vụ, nên một ranh giới dịch vụ thật là điều kiện cần để các khái niệm như stateless, service composition, API versioning và consistency trở nên cụ thể chứ không chỉ là lý thuyết.

Nói cách khác, hai service là **số lượng tối thiểu** đủ để tạo ra một biên phân tán thật đáng để lập luận, chứ không phải một nỗ lực chạy theo kiến trúc microservices.
Phạm vi được cắt gọn quanh đúng nguyên tắc này: đủ phân tán để các chương trở nên sống động, nhưng không phình ra thành nhiều service chỉ để cho có.

## 1.3. Phạm vi và cấu trúc báo cáo

Hệ thống dùng Node.js, Express và TypeScript, lưu trữ trên Microsoft SQL Server truy cập bằng raw SQL qua package `mssql`, đóng gói bằng Docker Compose và kiểm thử tự động qua GitHub Actions.
Phần còn lại của báo cáo được tổ chức như sau:

- Mục 2 trình bày **kiến trúc** hệ thống dưới lăng kính Chương 17 và Chương 18.
- Mục 3 đi sâu vào **xử lý đồng thời và resilience** quanh kịch bản ghế cuối (Chương 14, Chương 17), phần trọng tâm kỹ thuật.
- Mục 4 trình bày **bảo mật** theo Chương 13, kèm bảng mô hình hoá mối đe doạ STRIDE.
- Mục 5 phân tích **tái sử dụng và các quyết định đánh đổi** (Chương 15, Chương 16).
- Mục 6 mô tả **CI/CD và DevOps** (Chương 25).
- Mục 7 tổng hợp **kiểm thử và kết quả đo lường** thực nghiệm.
- Mục 8 bàn về **đạo đức nghề nghiệp**, và mục 9 rút ra **kết luận và bài học**.

Một nguyên tắc trình bày xuyên suốt: hệ thống được coi là *ví dụ hiện thực* cho các khái niệm của Sommerville, mỗi khái niệm được neo tường minh theo tên và số chương, và mọi số liệu đưa ra đều là số đo thật bắt từ hệ thống đang chạy chứ không phải minh hoạ.
