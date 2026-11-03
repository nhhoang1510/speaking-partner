import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// dev only: an in-memory /api/room (the real one runs on Vercel), with a few demo classmates
// so the 3D classroom has someone in it
function devRoom() {
  const users = new Map();
  const bots = [
    { id: 'demo-bot-lan', name: 'Lan', color: '#f15bb5', scene: 'coffee', lines: ["Can I get an iced latte, please?", 'Medium, with oat milk.'] },
    { id: 'demo-bot-minh', name: 'Minh', color: '#00a5cf', scene: 'interview', lines: ['I have three years of experience in sales.', 'I enjoy working in a team.'] },
    { id: 'demo-bot-hoa', name: 'Hoa', color: '#f3a712', scene: null, lines: [] },
  ];
  const phases = ['listening', 'thinking', 'speaking', 'idle'];
  return {
    name: 'dev-room',
    configureServer(server) {
      server.middlewares.use('/api/room', (req, res) => {
        const now = Date.now();
        if (req.method === 'GET') {
          const tick = Math.floor(now / 4000);
          const demo = bots.map((b, i) => {
            const phase = b.scene ? phases[(tick + i) % 4] : 'idle';
            const line = b.lines.length ? b.lines[Math.floor(tick / 4) % b.lines.length] : '';
            return { id: b.id, name: b.name, color: b.color, scene: b.scene, phase, said: line,
                     saidAt: phase === 'listening' ? now : now - 20000, turns: tick % 9, ts: now };
          });
          const live = [...users.values()].filter(u => now - u.ts < 50000);
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: true, now, users: [...demo, ...live] }));
          return;
        }
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
          try {
            const b = JSON.parse(body);
            if (b.leave) users.delete(b.id); else users.set(b.id, { ...b, ts: Date.now() });
          } catch (e) { /* ignore */ }
          res.setHeader('content-type', 'application/json');
          res.end('{"ok":true}');
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devRoom()],
  server: { port: 8765, host: '127.0.0.1' },
});
