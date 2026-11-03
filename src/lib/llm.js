// Two AI back ends with the same calls:
//   'cloud'  -> /api/chat on the same site (Vercel function -> Groq), works on phones
//   'ollama' -> Ollama on this computer (https://github.com/ollama/ollama/blob/main/docs/api.md)

export async function checkAI({ provider, url, model }) {
  if (provider === 'cloud') {
    const r = await fetch('/api/chat');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return { ok: d.ok, model: d.model, models: [] };
  }
  const r = await fetch(`${url}/api/tags`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const models = ((await r.json()).models || []).map(m => m.name);
  return { ok: models.some(m => m === model || m === model + ':latest'), model, models };
}

async function* ndjson(r) {
  const rd = r.body.getReader(), dec = new TextDecoder();
  let line = '';
  for (;;) {
    const { value, done } = await rd.read();
    if (done) return;
    line += dec.decode(value, { stream: true });
    let nl;
    while ((nl = line.indexOf('\n')) >= 0) {
      const j = line.slice(0, nl).trim(); line = line.slice(nl + 1);
      if (j) yield JSON.parse(j);
    }
  }
}

async function failed(r) {
  let msg = 'HTTP ' + r.status;
  try { const d = await r.json(); if (d.error) msg = d.error; } catch (e) { /* not json */ }
  if (r.status === 429) msg = 'AI đang quá tải (hết lượt miễn phí trong phút này), thử lại sau ít giây';
  return new Error(msg);
}

// Streams the reply text piece by piece.
export async function* chatStream({ provider, url, model, messages, options, signal }) {
  const cloud = provider === 'cloud';
  const r = await fetch(cloud ? '/api/chat' : `${url}/api/chat`, {
    method: 'POST', signal,
    headers: cloud ? { 'content-type': 'application/json' } : undefined,
    body: JSON.stringify(cloud ? { messages, stream: true, options } : { model, messages, stream: true, keep_alive: '30m', options }),
  });
  if (!r.ok) throw await failed(r);
  for await (const d of ndjson(r)) {
    if (d.error) throw new Error(d.error);
    const c = cloud ? d.content : d.message && d.message.content;
    if (c) yield c;
  }
}

// One reply constrained to a JSON schema, parsed.
export async function chatJSON({ provider, url, model, messages, schema, options }) {
  const opts = { temperature: 0, num_ctx: 4096, ...options };
  const cloud = provider === 'cloud';
  const r = await fetch(cloud ? '/api/chat' : `${url}/api/chat`, {
    method: 'POST',
    headers: cloud ? { 'content-type': 'application/json' } : undefined,
    body: JSON.stringify(cloud ? { messages, schema, options: opts }
                               : { model, messages, stream: false, format: schema, keep_alive: '30m', options: opts }),
  });
  if (!r.ok) throw await failed(r);
  const d = await r.json();
  return JSON.parse(cloud ? d.content : d.message.content);
}
