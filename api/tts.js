// /api/tts — Tamil text → MP3 via Microsoft Edge TTS
export const config = { runtime: 'nodejs', maxDuration: 30 };

import { EdgeTTS } from 'edge-tts-universal';

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
  const voice = body?.voice || process.env.TTS_VOICE || 'ta-IN-PallaviNeural';

  if (!text) return res.status(400).json({ error: 'text required' });

  try {
    const tts = new EdgeTTS({ voice, rate: '+0%', pitch: '+0Hz' });
    const audioStream = await tts.synthesize(text);

    const chunks = [];
    for await (const chunk of audioStream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
