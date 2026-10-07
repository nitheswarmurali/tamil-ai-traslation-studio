// /api/translate — English → Tamil via MyMemory (no API key needed)
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const text = (body?.text || '').trim();
  const from = body?.from || 'en-US';
  const to = body?.to || 'ta-IN';

  if (!text) return res.status(400).json({ error: 'text required' });

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const translated = data?.responseData?.translatedText || '';

    if (/MYMEMORY WARNING/i.test(translated)) {
      return res.status(200).json({ ok: true, translated: '', warning: 'rate-limited' });
    }

    return res.status(200).json({ ok: true, translated });
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
