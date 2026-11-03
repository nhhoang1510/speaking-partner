// Vercel Edge Function: the cloud AI partner (Groq, OpenAI-compatible API), so the app also works on phones.
// The key stays here (env GROQ_API_KEY); the browser only sends the conversation.
//   GET  /api/chat -> { ok, model }                        is the cloud AI configured?
//   POST /api/chat { messages, stream, schema, options } -> NDJSON lines { content } when streaming,
//                                                           else { content }
export const config = { runtime: 'edge' };

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_MESSAGES = 80, MAX_CHARS = 4000, MAX_TOKENS = 600;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  const key = process.env.GROQ_API_KEY;
  if (req.method === 'GET') return json({ ok: !!key, model: MODEL });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!key) return json({ error: 'GROQ_API_KEY is not set on the server' }, 503);

  let body;
  try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const { messages, stream = false, schema, options = {} } = body || {};
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) return json({ error: 'bad messages' }, 400);
  const msgs = messages.map(m => ({
    role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user',
    content: String(m.content || '').slice(0, MAX_CHARS),
  }));
  // JSON mode: Groq needs the word "JSON" and the shape spelled out in the prompt
  if (schema) msgs.push({ role: 'system', content: `Reply with only a JSON object matching this JSON schema, no other text:\n${JSON.stringify(schema)}` });

  const upstream = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, messages: msgs, stream: !!stream && !schema,
      temperature: typeof options.temperature === 'number' ? options.temperature : 0.8,
      max_tokens: Math.min(Number(options.num_predict) || MAX_TOKENS, MAX_TOKENS),
      ...(schema ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!upstream.ok) {
    const detail = (await upstream.text()).slice(0, 300);
    return json({ error: `AI error ${upstream.status}`, detail }, upstream.status === 429 ? 429 : 502);
  }

  if (!stream || schema) {
    const d = await upstream.json();
    return json({ content: (d.choices && d.choices[0] && d.choices[0].message.content) || '' });
  }

  // re-emit the SSE stream as NDJSON lines { content }
  const enc = new TextEncoder(), dec = new TextDecoder();
  const out = new ReadableStream({
    async start(ctrl) {
      const rd = upstream.body.getReader();
      let buf = '';
      try {
        for (;;) {
          const { value, done } = await rd.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const c = JSON.parse(data).choices[0].delta.content;
              if (c) ctrl.enqueue(enc.encode(JSON.stringify({ content: c }) + '\n'));
            } catch (e) { /* keep-alive or partial line */ }
          }
        }
      } catch (e) {
        ctrl.enqueue(enc.encode(JSON.stringify({ error: 'stream interrupted' }) + '\n'));
      }
      ctrl.close();
    },
  });
  return new Response(out, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
}
