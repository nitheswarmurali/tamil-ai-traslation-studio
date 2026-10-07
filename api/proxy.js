export const config = { runtime: 'nodejs', maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const source = req.query?.url || req.url?.split('url=')[1];
  if (!source) return res.status(400).json({ error: 'url required' });

  try {
    const upstream = await fetch(decodeURIComponent(source), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(25000)
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: `Remote fetch failed: ${upstream.status}` });
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(body);
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
