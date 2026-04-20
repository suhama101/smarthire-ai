const WINDOW_MS = 30 * 1000;
const MAX_REQUESTS = 8;
const REQUEST_STORE = globalThis.__smarthireRateLimitStore || new Map();

if (!globalThis.__smarthireRateLimitStore) {
  globalThis.__smarthireRateLimitStore = REQUEST_STORE;
}

function getRequesterKey(request) {
  return (
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'anonymous'
  ).split(',')[0].trim();
}

export function checkRateLimit(request, routeKey, maxRequests = MAX_REQUESTS, windowMs = WINDOW_MS) {
  const key = `${routeKey}:${getRequesterKey(request)}`;
  const now = Date.now();
  const existing = REQUEST_STORE.get(key) || { count: 0, expiresAt: now + windowMs };

  if (existing.expiresAt <= now) {
    REQUEST_STORE.set(key, { count: 1, expiresAt: now + windowMs });
    return { limited: false };
  }

  if (existing.count >= maxRequests) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
    };
  }

  REQUEST_STORE.set(key, { count: existing.count + 1, expiresAt: existing.expiresAt });
  return { limited: false };
}
