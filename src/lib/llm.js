// Ollama chat API (https://github.com/ollama/ollama/blob/main/docs/api.md), called straight from the browser.

export async function listModels(url) {
  const r = await fetch(`${url}/api/tags`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return ((await r.json()).models || []).map(m => m.name);
}

// Streams the reply text piece by piece.
export async function* chatStream({ url, model, messages, options, signal }) {
  const r = await fetch(`${url}/api/chat`, {
    method: 'POST', signal,
    body: JSON.stringify({ model, messages, stream: true, keep_alive: '30m', options }),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const rd = r.body.getReader(), dec = new TextDecoder();
  let line = '';
  for (;;) {
    const { value, done } = await rd.read();
    if (done) return;
    line += dec.decode(value, { stream: true });
    let nl;
    while ((nl = line.indexOf('\n')) >= 0) {
      const j = line.slice(0, nl).trim(); line = line.slice(nl + 1);
      if (!j) continue;
      const d = JSON.parse(j);
      if (d.error) throw new Error(d.error);
      if (d.message && d.message.content) yield d.message.content;
    }
  }
}

// One reply constrained to a JSON schema, parsed.
export async function chatJSON({ url, model, messages, schema, options }) {
  const r = await fetch(`${url}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({ model, messages, stream: false, format: schema, keep_alive: '30m',
                           options: { temperature: 0, num_ctx: 4096, ...options } }),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return JSON.parse((await r.json()).message.content);
}
