// Contract: response của GET /api/v1/auth/users/me (Auth sản xuất, Booking tiêu thụ qua cockatiel).
// Nguồn: docs/spec/event-ticket-booking.md (mục Interface contract).
export interface UsersMeResponse {
  displayName: string;
  email: string;
}
