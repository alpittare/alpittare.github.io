// Vercel Serverless Function — proxies chat to Anthropic Claude API
// Requires ANTHROPIC_API_KEY environment variable set in Vercel dashboard

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const { messages, system } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Messages required' });
        }

        // Rate limiting: max 10 messages per conversation to control costs
        const trimmedMessages = messages.slice(-10);

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 300,
                system: system || 'You are a helpful assistant for EXAFABS.AI website visitors.',
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

        return res.status(200).json({ reply });
    } catch (err) {
        console.error('Chat API error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
