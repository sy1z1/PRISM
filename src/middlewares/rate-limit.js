const WINDOW_MS = 15 * 60 * 1000;
const EMAIL_MAX_FAILURES = 5;
const IP_MAX_FAILURES = 20;

const buckets = new Map();

const getBucket = (key, now) => {
  const existing = buckets.get(key);
  if (existing && existing.resetAt > now) return existing;
  const bucket = { count: 0, resetAt: now + WINDOW_MS };
  buckets.set(key, bucket);
  return bucket;
};

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, WINDOW_MS);
cleanup.unref();

const isFailure = (status) => status === 401 || status === 403;

// Counts only failed logins (401/403); a successful login clears the counters.
export const loginRateLimit = () => (req, res, next) => {
  const now = Date.now();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  const keys = [`ip:${ip}`, `id:${ip}|${email}`];

  for (const key of keys) {
    const bucket = getBucket(key, now);
    const max = key.startsWith('ip:') ? IP_MAX_FAILURES : EMAIL_MAX_FAILURES;
    if (bucket.count >= max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    }
  }

  res.on('finish', () => {
    if (isFailure(res.statusCode)) {
      for (const key of keys) {
        const bucket = buckets.get(key);
        if (bucket) bucket.count += 1;
      }
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      for (const key of keys) buckets.delete(key);
    }
  });

  next();
};

// Exposed for tests.
export const resetLoginRateLimit = () => buckets.clear();
