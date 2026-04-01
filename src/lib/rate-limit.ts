import { NextRequest, NextResponse } from 'next/server';

interface RateLimitStore {
  [key: string]: { count: number; resetAt: number };
}

// In-memory rate limiter (works without Upstash for POC, replace with Upstash in prod)
const store: RateLimitStore = {};

// Clean expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetAt < now) {
      delete store[key];
    }
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export function rateLimit(config: RateLimitConfig) {
  return async function check(request: NextRequest): Promise<NextResponse | null> {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'anonymous';

    const key = `${ip}:${request.nextUrl.pathname}`;
    const now = Date.now();

    if (!store[key] || store[key].resetAt < now) {
      store[key] = { count: 1, resetAt: now + config.windowMs };
      return null; // Allow
    }

    store[key].count++;

    if (store[key].count > config.maxRequests) {
      const retryAfter = Math.ceil((store[key].resetAt - now) / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(config.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(store[key].resetAt),
          },
        }
      );
    }

    return null; // Allow
  };
}

// Pre-configured rate limiters
export const chatRateLimit = rateLimit({ maxRequests: 20, windowMs: 60_000 }); // 20/min
export const widgetRateLimit = rateLimit({ maxRequests: 30, windowMs: 60_000 }); // 30/min
export const uploadRateLimit = rateLimit({ maxRequests: 10, windowMs: 60_000 }); // 10/min
export const webhookRateLimit = rateLimit({ maxRequests: 100, windowMs: 60_000 }); // 100/min
export const apiRateLimit = rateLimit({ maxRequests: 60, windowMs: 60_000 }); // 60/min
