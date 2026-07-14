// Contract: Auth Service ký JWT với payload này; Booking Service verify cục bộ bằng shared secret.
// Nguồn: docs/spec/event-ticket-booking.md (mục Interface contract). Sửa file này = sửa contract, phải báo cả 2 người.
export interface JwtPayload {
  userId: number;
  role: 'user' | 'admin';
  email: string;
}
