# 7. Kiểm thử và Kết quả đo lường

Mục này trình bày chiến lược kiểm thử của Booking Service và số liệu vận hành đo được từ hệ thống đang chạy.
Phần đo lường neo vào khả năng quan sát (observability) như một điều kiện của tính bền vững (dependability, Ch.14): một hệ thống chỉ đáng tin khi vận hành của nó đo được và ghi lại được.
Toàn bộ con số trong mục là số đo thật, bắt trực tiếp từ Booking Service chạy qua Docker trên SQL Server thật và bộ test tự động, không phải số minh hoạ.

## 7.1. Chiến lược kiểm thử: seam ở biên HTTP REST

Điểm mấu chốt của chiến lược là chọn **seam** (điểm cắt để quan sát và điều khiển hệ thống trong test) đúng chỗ.
Chúng tôi chọn seam là **biên HTTP REST**: mỗi test bắn một request thật qua `supertest` vào ứng dụng Express và kiểm tra mã trạng thái cùng body trả về, đúng như một client thật nhìn thấy.
Đây là kiểm thử tích hợp chứ không phải unit test cô lập: mỗi ca đi xuyên qua router, middleware xác thực, tầng nghiệp vụ và tầng truy cập dữ liệu, rồi chạm tới một **SQL Server thật** trong Docker.

Việc dùng cơ sở dữ liệu thật thay vì giả lập (mock) là một lựa chọn có chủ đích, không phải sự tiện tay.
Bất biến trung tâm của hệ thống (một ghế bán cho tối đa một người) phụ thuộc vào hành vi đồng thời thật của `ROWVERSION` và ràng buộc `UNIQUE` trong SQL Server.
Một cơ sở dữ liệu giả lập sẽ không tái tạo được đúng ngữ nghĩa của "0 dòng bị ảnh hưởng khi phiên bản đã đổi" hay lỗi vi phạm khoá duy nhất, nên test chạy trên nó sẽ xanh một cách vô nghĩa.
Nói cách khác, thứ cần kiểm thử nhất lại chính là thứ mà mock sẽ che mất, nên seam phải nằm bên ngoài cơ sở dữ liệu thật.

Bù lại, test cần một môi trường có SQL Server: cục bộ chạy `docker compose up mssql` rồi `npm test -w services/booking`, trên CI thì SQL Server là một service container (xem mục 6).
Đây là một đánh đổi được chấp nhận: chạy chậm hơn và nặng hạ tầng hơn unit test, để đổi lấy niềm tin rằng hành vi đồng thời được kiểm chứng thật.

## 7.2. Phân loại và kết quả bộ test

Bộ test của Booking Service gồm **13 ca**, chia theo mối quan tâm mà mỗi ca canh giữ:

| Nhóm | Số ca | Ca tiêu biểu |
|---|---|---|
| Xác thực và đọc sự kiện | 3 | thiếu token -> 401, token sai -> 401, token hợp lệ -> 200 kèm danh sách ghế |
| Các đường của đặt vé | 8 | thiếu/sai token -> 401, body sai -> 400, ghế không tồn tại -> 404, đặt thành công -> 201, ghế đã có người -> 409, `/metrics` role user -> 403, role admin -> 200 |
| Tranh chấp đồng thời | 1 | 20 request đồng thời cùng một ghế -> đúng 1x201, 19x409, DB COUNT=1 (phân tích ở mục 3) |
| Composition liên service (E2E) | 1 | đăng ký -> đăng nhập -> lấy JWT -> đọc sự kiện -> đặt vé, với Booking gọi Auth thật |

Bộ test phủ đủ ba tầng ý nghĩa của hệ thống: các **đường lỗi** của REST (401/400/404/409/403) khẳng định hợp đồng mã trạng thái ở mục 2 được giữ đúng; ca **tranh chấp** khẳng định bất biến chống double-booking ở mục 3; ca **E2E composition** khẳng định luồng liên service ở mục 2.4 chạy thật từ đầu tới cuối.
Riêng ca E2E khởi động một Auth Service thật ở cổng 3999 và trỏ `AUTH_BASE_URL` vào đó, rồi assert rằng `user` trong xác nhận đặt vé **khác `null`**: đây là bằng chứng Booking gọi Auth thật và composition thành công, chứ không phải luôn rơi vào nhánh fallback.

Kết quả đo thật:

- **13/13 test pass**, thời gian chạy **4.919 giây** (`npm test -w services/booking --runInBand`) trên SQL Server thật trong Docker.
- Chạy tuần tự (`--runInBand`) là cố ý: các test chia sẻ một cơ sở dữ liệu nên chạy song song sẽ giẫm chân nhau; mỗi test tự dọn dữ liệu của mình (tạo event/seat riêng, xoá ở `afterAll`) để không rò rỉ trạng thái sang ca khác.

## 7.3. Đo lường vận hành: metrics endpoint

Ngoài test, hệ thống mang sẵn một kênh đo lường lúc chạy, đúng tinh thần observability của Ch.14.
`GET /api/v1/metrics` trả về các bộ đếm vận hành, và chỉ **admin** mới được xem (role `user` nhận `403`, đúng phân quyền ở mục Bảo mật).
Số đo thật bắt được (admin, `200`):

```json
{"totalRequests":12,"bookingsSuccess":2,"conflicts409":1,"uptimeSeconds":4314}
```

Bốn con số này cho biết đúng những gì cần theo dõi nhất của một service đặt vé: tổng lưu lượng, số vé đặt thành công, số lần tranh chấp bị chặn, và thời gian sống của tiến trình.
Chúng tôi cố ý dùng bộ đếm in-memory thay vì Prometheus/Grafana: trong phạm vi đồ án, mục tiêu là *chứng minh khái niệm* observability đo được, không phải dựng một ngăn xếp giám sát đầy đủ (đây là một cắt giảm phạm vi có ý thức).
Kênh quan sát thứ hai là structured log bằng `pino`, đã phân tích ở mục 3.6 như bằng chứng vận hành cho ba trạng thái của lời gọi liên service.

## 7.4. Nhìn lại: kiểm thử phủ đúng chỗ rủi ro

Chiến lược kiểm thử của đồ án không nhắm phủ mọi dòng code, mà nhắm phủ đúng những chỗ hỏng sẽ tốn kém nhất.
Rủi ro lớn nhất là double-booking, nên nó được canh bằng một ca tranh chấp thật trên cơ sở dữ liệu thật.
Rủi ro kế là hợp đồng REST lệch giữa hai người phát triển, nên các mã trạng thái được cố định bằng các ca đường lỗi.
Rủi ro cuối là luồng liên service không thật sự ghép được, nên có một ca E2E đi xuyên cả hai service.
Đây là cách phân bổ công sức kiểm thử theo rủi ro (risk-based).
