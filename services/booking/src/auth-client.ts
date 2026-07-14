import {
  circuitBreaker,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  timeout,
  TimeoutStrategy,
  wrap,
} from 'cockatiel';
import { UsersMeResponse } from '../../../shared/contracts/users-me-response';
import { logger } from './logger';

// Lời gọi phụ trợ Booking→Auth duy nhất (ADR-0002): lấy hồ sơ user đính vào xác nhận booking.
// Bọc timeout + retry + circuit breaker; mọi thất bại đều fallback về null (xác nhận thiếu tên),
// không bao giờ chặn nghiệp vụ đặt vé.
const policy = wrap(
  retry(handleAll, { maxAttempts: 2, backoff: new ExponentialBackoff() }),
  circuitBreaker(handleAll, { halfOpenAfter: 10_000, breaker: new ConsecutiveBreaker(5) }),
  timeout(1500, TimeoutStrategy.Aggressive),
);

export async function fetchUserProfile(bearerToken: string): Promise<UsersMeResponse | null> {
  const baseUrl = process.env.AUTH_BASE_URL || 'http://localhost:3001';
  try {
    return await policy.execute(async ({ signal }) => {
      const res = await fetch(`${baseUrl}/api/v1/auth/users/me`, {
        headers: { authorization: bearerToken },
        signal,
      });
      if (!res.ok) {
        throw new Error(`Auth /users/me trả ${res.status}`);
      }
      return (await res.json()) as UsersMeResponse;
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'fallback: không lấy được hồ sơ user từ Auth');
    return null;
  }
}
