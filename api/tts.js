// Vercel Edge Function: natural-sounding voice for the AI partner (Groq text-to-speech, Orpheus).
//   GET  /api/tts                 -> { ok, model }       is cloud speech configured?
//   POST /api/tts { text, voice } -> audio/wav
export const config = { runtime: 'edge' };

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/speech';
const MODEL = process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english';
const VOICES = ['autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy'];
const MAX_CHARS = 200;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  const key = process.env.GROQ_API_KEY;
  if (req.method === 'GET') return json({ ok: !!key, model: MODEL, voices: VOICES });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!key) return json({ error: 'GROQ_API_KEY is not set on the server' }, 503);

  let body;
  try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const text = String((body && body.text) || '').trim().slice(0, MAX_CHARS);
  const voice = VOICES.includes(body && body.voice) ? body.voice : 'hannah';
  if (!text) return json({ error: 'no text' }, 400);

  const upstream = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, voice, input: text, response_format: 'wav' }),
  });
  if (!upstream.ok) {
    const detail = (await upstream.text()).slice(0, 300);
    return json({ error: `TTS error ${upstream.status}`, detail }, upstream.status === 429 ? 429 : 502);
  }
  return new Response(upstream.body, { headers: { 'content-type': 'audio/wav', 'cache-control': 'no-store' } });
}
