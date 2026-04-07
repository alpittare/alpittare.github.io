// Vercel Serverless Function — proxies chat to Anthropic Claude API
// Requires ANTHROPIC_API_KEY environment variable set in Vercel dashboard

// ── In-memory rate limiter (resets per cold start, ~5-15 min on Vercel) ──
// For production, use Vercel KV or Upstash Redis for persistent limits.
const rateLimitMap = new Map(); // IP → { count, resetAt }
const RATE_LIMIT_MAX = 20;       // max requests per window per IP
const RATE_LIMIT_WINDOW = 60000; // 1 minute window
const DAILY_LIMIT_MAX = 100;     // max requests per day per IP
const dailyMap = new Map();      // IP → { count, resetAt }

function getRealIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.socket?.remoteAddress
        || 'unknown';
}

function checkRateLimit(ip) {
    const now = Date.now();

    // Per-minute check
    let entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
        rateLimitMap.set(ip, entry);
    }
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
        return { limited: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000), reason: 'minute' };
    }

    // Per-day check
    let daily = dailyMap.get(ip);
    const dayMs = 86400000;
    if (!daily || now > daily.resetAt) {
        daily = { count: 0, resetAt: now + dayMs };
        dailyMap.set(ip, daily);
    }
    daily.count++;
    if (daily.count > DAILY_LIMIT_MAX) {
        return { limited: true, retryAfter: Math.ceil((daily.resetAt - now) / 1000), reason: 'daily' };
    }

    return { limited: false };
}

// Clean up stale entries every 5 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now > entry.resetAt) rateLimitMap.delete(ip);
    }
    for (const [ip, entry] of dailyMap) {
        if (now > entry.resetAt) dailyMap.delete(ip);
    }
}, 300000);

export default async function handler(req, res) {
    // CORS + method check
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', 'https://exafabs.ai');
        res.setHeader('Access-Control-Allow-Methods', 'POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── Rate limit check ──
    const ip = getRealIP(req);
    const rateCheck = checkRateLimit(ip);
    if (rateCheck.limited) {
        res.setHeader('Retry-After', rateCheck.retryAfter);
        const msg = rateCheck.reason === 'daily'
            ? 'Daily chat limit reached. Please come back tomorrow!'
            : 'Too many messages. Please wait a moment and try again.';
        return res.status(429).json({ error: msg });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const { messages, system } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Messages required' });
        }

        // Validate message content — block excessively long inputs
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.content && lastMsg.content.length > 500) {
            return res.status(400).json({ error: 'Message too long. Please keep it under 500 characters.' });
        }

        // Trim conversation history to last 6 messages to control token usage
        const trimmedMessages = messages.slice(-6);

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 200,
                system: system || 'You are EXA, a helpful AI assistant for EXAFABS.AI website visitors. Keep responses concise and friendly. You help with questions about EXAFABS products, AI games, and technology.',
                messages: trimmedMessages
            })
        });

        if (!response.ok) {
            const errData = await response.text();
            console.error('Anthropic API error:', response.status, errData);
            return res.status(502).json({ error: 'AI service unavailable' });
        }

        const data = await response.json();
        const reply = data.content?.[0]?.text || 'Sorry, I could not generate a response.';

        // Return remaining limits in headers for client-side display
        const minuteEntry = rateLimitMap.get(ip);
        const dailyEntry = dailyMap.get(ip);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - (minuteEntry?.count || 0)));
        res.setHeader('X-RateLimit-Daily-Remaining', Math.max(0, DAILY_LIMIT_MAX - (dailyEntry?.count || 0)));

        return res.status(200).json({ reply });
    } catch (err) {
        console.error('Chat API error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
