# Rate Limiting Upgrade Guide

## Current Approach: In-Memory Map

The current `/api/chat.js` implementation uses in-memory Maps for rate limiting:
- `rateLimitMap` — tracks per-minute rate limits (20 requests/min per IP)
- `dailyMap` — tracks per-day rate limits (100 requests/day per IP)

**Critical Limitation**: These maps are reset on every Vercel cold start (~5-15 minutes of inactivity), allowing attackers to bypass rate limits by triggering new cold starts.

```javascript
const rateLimitMap = new Map(); // IP → { count, resetAt }
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const DAILY_LIMIT_MAX = 100;
const dailyMap = new Map();
```

## Recommended Upgrade: Vercel KV or Upstash Redis

For production deployment, use **Upstash Redis** (Vercel KV is Upstash-backed). Redis provides persistent, distributed rate limiting that survives cold starts.

### Why Redis?
- **Persistent state**: Rate limit counters survive function cold starts
- **Atomic operations**: Built-in atomic increment prevents race conditions
- **TTL support**: Automatic key expiration without manual cleanup
- **Free tier**: Upstash offers 10K commands/day free (sufficient for 100-200 daily active users)
- **Low latency**: Single-digit millisecond responses from Vercel regions

### Cost Analysis (Upstash)
- **Free tier**: 10,000 commands/day, 256 MB storage, 1 concurrent connection
- **Estimated usage**: 3 commands/request (check + increment + set expiry) × 200 requests/day = 600 commands/day
- **Verdict**: Free tier covers typical traffic with room to spare

## Implementation Steps

### Step 1: Set Up Upstash Redis

1. Create a free account at https://console.upstash.com
2. Create a new Redis database (select Vercel region for minimal latency)
3. Copy the connection string: `redis://:password@host:port`
4. Add to Vercel environment variables:
   ```
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
   ```

### Step 2: Update chat.js

Replace the in-memory Maps with Redis-backed rate limiting:

```javascript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function checkRateLimitRedis(ip) {
  const now = Date.now();
  const minuteKey = `ratelimit:minute:${ip}`;
  const dailyKey = `ratelimit:daily:${ip}`;

  // Per-minute check (60 second window)
  const minuteCount = await redis.incr(minuteKey);
  if (minuteCount === 1) {
    // First request in window, set expiry
    await redis.expire(minuteKey, 60);
  }
  if (minuteCount > RATE_LIMIT_MAX) {
    const ttl = await redis.ttl(minuteKey);
    return {
      limited: true,
      retryAfter: Math.max(1, ttl),
      reason: 'minute'
    };
  }

  // Per-day check (86400 second window)
  const dailyCount = await redis.incr(dailyKey);
  if (dailyCount === 1) {
    await redis.expire(dailyKey, 86400);
  }
  if (dailyCount > DAILY_LIMIT_MAX) {
    const ttl = await redis.ttl(dailyKey);
    return {
      limited: true,
      retryAfter: Math.max(1, ttl),
      reason: 'daily'
    };
  }

  return { limited: false };
}

// In handler, replace:
// const rateCheck = checkRateLimit(ip);
// With:
// const rateCheck = await checkRateLimitRedis(ip);
```

### Step 3: Update Dependencies

```bash
npm install @upstash/redis
```

### Step 4: Verify Deployment

After deploying to Vercel:
1. Monitor rate limit headers in browser DevTools
2. Test cold start behavior: wait 15+ minutes and resubmit form
3. Verify rate limit is still enforced across restarts

## Backwards Compatibility

If Redis becomes temporarily unavailable:
1. Add fallback to in-memory Maps (graceful degradation)
2. Log Redis errors for monitoring
3. Return 503 Service Unavailable rather than allowing unlimited requests

```javascript
async function checkRateLimit(ip) {
  try {
    return await checkRateLimitRedis(ip);
  } catch (err) {
    console.error('Redis unavailable, using fallback:', err);
    return checkRateLimitFallback(ip);
  }
}
```

## Monitoring

Add these metrics to your observability stack:
- Rate limit violations per IP
- Redis command latency
- Daily active IPs
- Incident: Redis connection failures

## Timeline

- **Immediate**: Deploy in-memory fallback for resilience
- **Week 1**: Integrate Upstash Redis in staging
- **Week 2**: A/B test Redis vs in-memory on 10% traffic
- **Week 3**: Full production rollout if metrics are positive
- **Month 1**: Monitor and refine TTL windows based on traffic patterns

## Related Files

- **Current implementation**: `/api/chat.js` (lines 10-78)
- **Rate limit constants**: Lines 13-16 (RATE_LIMIT_MAX, DAILY_LIMIT_MAX)
- **IP extraction**: Lines 18-23 (getRealIP function)
