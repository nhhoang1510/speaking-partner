// Vercel Edge Function: the shared classroom — who is online and what each learner is doing.
// Stored in Upstash Redis (Vercel Marketplace, free plan) through its REST API: one hash "room",
// one field per learner, dropped when the learner has not checked in for a while.
//   GET  /api/room                                   -> { ok, users: [...] }
//   POST /api/room { id, name, color, scene, phase, said, turns } -> { ok }   check in / update
//   POST /api/room { id, leave: true }                                        -> { ok }   left the page
export const config = { runtime: 'edge' };

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'room';
const STALE_MS = 50000, MAX_USERS = 60;
const PHASES = ['idle', 'listening', 'thinking', 'speaking', 'summary'];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function redis(...cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).map(x => x.result);
}

const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

export default async function handler(req) {
  if (!URL_ || !TOKEN) return json({ ok: false, error: 'room storage is not connected' }, 503);
  try {
    if (req.method === 'GET') {
      const [flat] = await redis(['HGETALL', KEY]);
      const now = Date.now(), users = [], stale = [];
      for (let i = 0; flat && i < flat.length; i += 2) {
        try { const u = JSON.parse(flat[i + 1]); (now - u.ts < STALE_MS ? users : stale).push(u); } catch (e) { stale.push({ id: flat[i] }); }
      }
      if (stale.length) await redis(['HDEL', KEY, ...stale.map(u => u.id)]);
      return json({ ok: true, now, users });
    }
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    let b;
    try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    const id = str(b && b.id, 40);
    if (!/^[a-z0-9-]{8,40}$/.test(id)) return json({ error: 'bad id' }, 400);
    if (b.leave) { await redis(['HDEL', KEY, id]); return json({ ok: true }); }

    const [len, exists] = await redis(['HLEN', KEY], ['HEXISTS', KEY, id]);
    if (!exists && len >= MAX_USERS) return json({ error: 'room is full' }, 429);
    const u = {
      id, ts: Date.now(),
      name: str(b.name, 24) || 'Khách',
      color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#5b8def',
      scene: str(b.scene, 20) || null,
      phase: PHASES.includes(b.phase) ? b.phase : 'idle',
      said: str(b.said, 200),
      saidAt: Number(b.saidAt) || 0,
      turns: Math.max(0, Math.min(999, Number(b.turns) || 0)),
    };
    await redis(['HSET', KEY, id, JSON.stringify(u)], ['EXPIRE', KEY, 3600]);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'room storage error' }, 502);
  }
}
