// /api/transcribe — English audio → text using Hugging Face Whisper
export const config = { runtime: 'nodejs', maxDuration: 30 };

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

  const audioBase64 = body?.audioBase64;
  if (!audioBase64) return res.status(400).json({ error: 'audioBase64 required' });

  try {
    const buffer = Buffer.from(audioBase64, 'base64');

    if (buffer.length > 4_000_000) {
      return res.status(413).json({ error: 'audio chunk too large (>4MB). Reduce chunk size.' });
    }

    const headers = { 'Content-Type': 'audio/wav' };
    if (process.env.HF_TOKEN) {
      headers.Authorization = `Bearer ${process.env.HF_TOKEN}`;
    }

    const response = await fetch(
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3-turbo',
      { method: 'POST', headers, body: buffer, signal: AbortSignal.timeout(25000) }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({
        error: `HF ${response.status}: ${text.slice(0, 200)}`,
        hint: 'Add HF_TOKEN env var for higher limits: https://huggingface.co/settings/tokens'
      });
    }

    const data = await response.json();
    return res.status(200).json({ ok: true, text: data?.text || '' });
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
