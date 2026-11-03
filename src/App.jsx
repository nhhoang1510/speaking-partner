import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useMotionValue, useSpring } from 'framer-motion';
import { Engine, canListen } from './lib/engine.js';
import { checkAI } from './lib/llm.js';
import { SCENES, LEVELS } from './scenes.js';
import { Room, COLORS, loadMe, saveMe } from './lib/room.js';
import { loadHistory, saveSession, deleteSession, snapshot, memoryFor } from './lib/history.js';
import { Listener, voiceFor } from './lib/listen.js';

// the whole app is the 3D school; panels float around it
const School = lazy(() => import('./School.jsx'));

const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
// the AI is chosen by where the page runs, not by the user: the deployed site uses the cloud,
// a local dev server uses Ollama on this computer
const AI = LOCAL ? { provider: 'ollama', url: 'http://localhost:11434', model: 'llama3.2:3b' } : { provider: 'cloud' };
const DEFAULTS = { level: 'intermediate', voice: '', rate: 1, pause: 1.4, showAi: true, feedback: true };
const spring = { type: 'spring', stiffness: 260, damping: 26 };
const SCENE = Object.fromEntries(SCENES.map(s => [s.id, s]));
const STATUS = {
  listening: sc => `Đang nói với ${sc.name}`, thinking: sc => `${sc.name} đang nghĩ`, speaking: sc => `Đang nghe ${sc.name} nói`,
  summary: () => 'Đang xem nhận xét', idle: sc => `Đang luyện ${sc.title}`,
};
const describe = u => { const sc = u.scene && SCENE[u.scene]; return sc ? (STATUS[u.phase] || STATUS.idle)(sc) : 'Đang ở hành lang'; };
const hhmm = t => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('sp-settings') || '{}'), ...AI }; } catch (e) { return { ...DEFAULTS, ...AI }; }
}

function useVoices() {
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    const load = () => setVoices(speechSynthesis.getVoices().filter(v => v.lang.startsWith('en')));
    load(); speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);
  return voices;
}


// what happened in the school, worked out by comparing two looks at who is online
function events(prev, users, meId) {
  const out = [], now = Date.now(), seen = new Set();
  const who = u => (u.id === meId ? 'Bạn' : u.name);
  for (const u of users) {
    seen.add(u.id);
    const p = prev.get(u.id);
    if (!p) { out.push({ t: now, c: u.color, text: `${who(u)} vào trường` }); if (!u.scene) continue; }
    if (!p || p.scene !== u.scene) {
      if (u.scene) out.push({ t: now, c: u.color, text: `${who(u)} vào phòng ${SCENE[u.scene] ? SCENE[u.scene].title : ''}` });
      else if (p) out.push({ t: now, c: u.color, text: `${who(u)} ra hành lang` });
    }
    // a finished sentence: the learner stopped talking and the AI started thinking
    if (p && p.phase === 'listening' && u.phase !== 'listening' && u.said) out.push({ t: now, c: u.color, text: `${who(u)}: “${u.said}”`, said: true });
  }
  for (const [id, p] of prev) if (!seen.has(id)) out.push({ t: now, c: p.color, text: `${who(p)} rời trường` });
  return out;
}

export default function App() {
  const [st, setSt] = useState(null);
  const [cfg, setCfg] = useState(loadSettings);
  const [ai, setAi] = useState({ state: 'checking' });
  const [booting, setBooting] = useState(true);
  const [panel, setPanel] = useState(false);
  const [sheet, setSheet] = useState(null);           // phones: which panel is pulled up
  const [view, setView] = useState({ fit: 1, n: 0 });  // camera: zoom of the overview, and a nudge to fly back to it
  const engine = useRef(null);
  if (!engine.current) engine.current = new Engine(setSt);
  const eng = engine.current;
  const voices = useVoices();
  const roomRef = useRef(null);
  if (!roomRef.current) roomRef.current = new Room();
  const room = roomRef.current;
  const [me, setMe] = useState(loadMe);
  const [online, setOnline] = useState({ ok: null, users: [] });
  const [feed, setFeed] = useState([]);
  const prevUsers = useRef(null);
  const [right, setRight] = useState('feed');         // right panel when not in a conversation: 'feed' | 'history' | a past session
  const [history, setHistory] = useState(loadHistory);
  const [walk, setWalk] = useState(false);             // "hoá thân": I walk my own character around
  const [walkRoom, setWalkRoom] = useState(null);      // the room I'm standing in while walking
  const stick = useRef({});                            // the on-screen joystick, read by the 3D scene
  const pos = useRef({ x: 0, z: 0 });
  const listenerRef = useRef(null);
  if (!listenerRef.current) listenerRef.current = new Listener();
  const listener = listenerRef.current;
  const [listening, setListening] = useState(() => new Set());   // classmates I chose to listen to
  const listenRef = useRef(listening); listenRef.current = listening;
  const hereRef = useRef(null);                        // the room I'm standing in without talking: hear everyone there

  const set = patch => setCfg(c => ({ ...c, ...patch }));
  useEffect(() => {
    eng.settings = cfg;
    try { localStorage.setItem('sp-settings', JSON.stringify(cfg)); } catch (e) { /* private mode */ }
  }, [cfg]);

  useEffect(() => {
    if (!voices.length || voices.some(v => v.name === cfg.voice)) return;
    // the better-sounding voices first: neural/enhanced ones, then Google's, then any US voice
    const v = voices.find(x => /Natural|Neural|Premium|Enhanced|Siri/i.test(x.name) && x.lang.startsWith('en-US'))
           || voices.find(x => /Google US English/.test(x.name)) || voices.find(x => x.lang === 'en-US') || voices[0];
    set({ voice: v.name });
  }, [voices]);

  // is the AI reachable?
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => checkAI(cfg)
      .then(r => live && setAi({ state: r.ok ? 'ok' : 'nomodel' }))
      .catch(() => live && setAi({ state: 'down' })), 300);
    return () => { live = false; clearTimeout(t); };
  }, [cfg.provider, cfg.url, cfg.model]);

  useEffect(() => {
    const min = new Promise(r => setTimeout(r, 900));
    Promise.all([min, document.fonts ? document.fonts.ready : null]).then(() => setBooting(false));
  }, []);

  useEffect(() => {
    const onKey = e => {
      if (e.code === 'Escape') { setPanel(false); setSheet(null); }
      if (e.code !== 'Space' || e.repeat || /INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) return;
      e.preventDefault(); eng.mic();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const s = st || eng.s;

  // the school: check in who I am and what I'm doing; follow who else is here
  useEffect(() => { if (me) room.setMe(me); }, [me]);
  useEffect(() => room.subscribe((users, ok) => {
    if (prevUsers.current) {
      const ev = events(prevUsers.current, users, me && me.id);
      if (ev.length) setFeed(f => [...ev.reverse(), ...f].slice(0, 40));
      // listening in: read out new lines from the classmates I follow, or from everyone in the room I'm standing in
      for (const u of users) {
        const p = prevUsers.current.get(u.id);
        if (!p || (me && u.id === me.id)) continue;
        if (!listenRef.current.has(u.id) && !(hereRef.current && u.scene === hereRef.current)) continue;
        if (p.phase === 'listening' && u.phase !== 'listening' && u.said) listener.say(u.said, voiceFor(u.id));
        if (u.ai && u.aiAt && u.aiAt !== p.aiAt) listener.say(u.ai, (SCENE[u.scene] && SCENE[u.scene].voice) || 'hannah');
      }
    }
    prevUsers.current = new Map(users.map(u => [u.id, u]));
    setOnline({ ok, users });
  }, true), [me && me.id]);
  const saidRef = useRef({ text: '', at: 0 }), aiRef = useRef({ text: '', at: 0 });
  const status = useMemo(() => {
    const mine = [...s.msgs].reverse().find(m => m.who === 'me');
    const text = mine ? mine.text.replace(/^…$/, '') : '';
    if (text !== saidRef.current.text) saidRef.current = { text, at: Date.now() };
    const reply = [...s.msgs].reverse().find(m => m.who === 'ai' && m.done);
    const aiText = reply ? reply.text : '';
    if (aiText !== aiRef.current.text) aiRef.current = { text: aiText, at: aiText ? Date.now() : 0 };
    return { scene: s.scene ? s.scene.id : walk ? walkRoom : null, phase: s.summary ? 'summary' : s.phase,
             said: s.scene ? saidRef.current.text : '', saidAt: saidRef.current.at,
             ai: s.scene ? aiRef.current.text : '', aiAt: aiRef.current.at, turns: eng.turns.length,
             free: walk, x: pos.current.x, z: pos.current.z };
  }, [s, walk, walkRoom]);
  const statusRef = useRef(status); statusRef.current = status;
  useEffect(() => room.update(status), [status]);
  useEffect(() => { hereRef.current = walk && !s.scene ? walkRoom : null; }, [walk, walkRoom, s.scene]);
  useEffect(() => listener.mute(s.phase === 'listening'), [s.phase]);

  // keep every session in the history as it goes, so nothing is lost if the page closes
  const session = useRef(null);
  const finished = s.msgs.filter(m => m.who === 'me' ? !m.interim : m.done).length;
  useEffect(() => {
    if (!s.scene) { session.current = null; return; }
    if (!session.current || session.current.scene !== s.scene.id || finished < session.current.n)
      session.current = { id: Date.now().toString(36), scene: s.scene.id, start: Date.now(), n: 0 };
    session.current.n = finished;
    if (!s.msgs.some(m => m.who === 'me' && !m.interim)) return;      // nothing said yet: not worth keeping
    setHistory(saveSession(snapshot(session.current.id, s, cfg.level, session.current.start)));
  }, [s.scene, finished, s.summary && s.summary.loading]);

  // everyone in the school, with my own figure following my state right away
  const meLocal = me || { id: 'me-local', name: 'Bạn', color: '#5b8def' };
  const users = useMemo(() => [
    ...online.users.filter(u => u.id !== meLocal.id),
    { ...meLocal, ...status, ts: Date.now() },
  ], [online.users, meLocal.id, meLocal.name, meLocal.color, status]);

  const start = sc => { listener.stop(); eng.start(sc, memoryFor(sc.id, history)); };
  const pick = sc => { setSheet(null); setWalk(false); if (!s.scene || s.scene.id !== sc.id) start(sc); };
  const leave = () => { eng.leave(); setView(v => ({ ...v, n: v.n + 1 })); };
  const toggleWalk = () => { listener.unlock(); setWalk(w => !w); setWalkRoom(null); setSheet(null); };
  const toggleListen = id => {
    listener.unlock();
    setListening(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  // walking: stepping out of the room ends the conversation there
  const onRoom = id => { setWalkRoom(id); if (eng.s.scene && eng.s.scene.id !== id) eng.leave(); };
  const onMove = (x, z) => { pos.current = { x, z }; room.update({ ...statusRef.current, x, z }); };
  const hue = s.scene ? s.scene.hue : 150;

  return (
    <MotionConfig reducedMotion="user">
      <div className="world" aria-label="Sơ đồ trường học">
        <Suspense fallback={null}>
          <School users={users} meId={meLocal.id} focus={s.scene ? s.scene.id : null} fit={view.fit} nonce={view.n} onPick={pick}
            walk={walk} input={stick.current} onMove={onMove} onRoom={onRoom} />
        </Suspense>
      </div>
      <AnimatePresence>{booting && <Preloader key="pre" />}</AnimatePresence>

      <div className={'hud' + (s.scene ? ' in-room' : '') + (walk ? ' walking' : '')} data-sheet={sheet || ''} style={{ '--h': hue }}>
        <TopBar s={s} cfg={cfg} set={set} n={users.length} onSettings={() => setPanel(true)} onLeave={leave} onEnd={() => eng.end()} />

        <aside className="panel left" aria-label="Phòng học và mọi người">
          <Rooms users={users} current={s.scene} onPick={pick} />
          <People users={users} meId={meLocal.id} ok={online.ok} listening={listening} onListen={toggleListen} />
        </aside>

        <aside className="panel right" aria-label={s.scene ? 'Hội thoại' : 'Hoạt động'}>
          {s.scene ? <Talk s={s} eng={eng} cfg={cfg} />
            : right === 'feed' ? <Feed feed={feed} ai={ai} tabs={<RightTabs right={right} setRight={setRight} />} />
            : right === 'history' ? <History history={history} tabs={<RightTabs right={right} setRight={setRight} />} onOpen={setRight}
                onDelete={id => setHistory(deleteSession(id))} />
            : <Session x={right} onBack={() => setRight('history')} onAgain={() => pick(SCENE[right.scene])} />}
        </aside>

        <div className="bottom">
          {walk && <Stick input={stick.current} />}
          {walk && <div className="look-tip touch-only">Kéo nút tròn lên/xuống để đi, sang trái/phải để quay · hoặc vuốt màn hình để nhìn quanh</div>}
          {s.scene
            ? <Dock s={s} eng={eng} />
            : walk
              ? <WalkBar here={walkRoom && SCENE[walkRoom]} onTalk={() => start(SCENE[walkRoom])} onExit={toggleWalk} />
              : <ViewBar view={view} setView={setView} sheet={sheet} setSheet={k => { setSheet(k); if (k === 'feed' || k === 'history') setRight(k); }} onWalk={toggleWalk} />}
        </div>
      </div>

      <AnimatePresence>
        {panel && <Settings key="set" cfg={cfg} set={set} onClose={() => setPanel(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {!booting && online.ok && !me && <Join key="join" onJoin={(n, c) => setMe(saveMe(n, c))} />}
      </AnimatePresence>
    </MotionConfig>
  );
}

function Preloader() {
  return (
    <motion.div className="pre" exit={{ opacity: 0 }} transition={{ duration: 0.5, delay: 0.35 }}>
      <motion.div className="pre-half top" exit={{ y: '-100%' }} transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }} />
      <motion.div className="pre-half bottom" exit={{ y: '100%' }} transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }} />
      <motion.div className="pre-mark" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.08 }} transition={{ duration: 0.4 }}>
        <span className="pre-dot" /><span className="pre-dot" /><span className="pre-dot" />
      </motion.div>
    </motion.div>
  );
}


// ---------------------------------------------------------------- panels
function TopBar({ s, cfg, set, n, onSettings, onLeave, onEnd }) {
  return (
    <header className="topbar glass">
      <div className="brand">
        <span className="logo">S</span>
        <span className="brand-name">THPT Nguyễn Thái Học</span>
        <span className="online"><i />{n}<span className="wide"> online</span></span>
      </div>
      {s.scene
        ? <div className="top-actions">
            <button className="ghost" onClick={onLeave}>← <span className="wide">Rời phòng</span></button>
            <button className="ghost strong" onClick={onEnd}><span className="wide">Kết thúc &amp; nhận xét</span><span className="narrow">Kết thúc</span></button>
          </div>
        : <div className="levels" role="radiogroup" aria-label="Trình độ">
            {Object.entries(LEVELS).map(([k, v]) => (
              <button key={k} role="radio" aria-checked={cfg.level === k} className={'seg' + (cfg.level === k ? ' on' : '')} onClick={() => set({ level: k })}>
                {cfg.level === k && <motion.span layoutId="seg" className="seg-bg" transition={spring} />}
                <span className="seg-t">{v.label.replace(/ \(.*\)/, '')}</span>
              </button>
            ))}
          </div>}
      <button className="iconbtn" onClick={onSettings} aria-label="Cài đặt">
        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)" /></svg>
      </button>
    </header>
  );
}

function Rooms({ users, current, onPick }) {
  const count = {};
  users.forEach(u => { if (u.scene) count[u.scene] = (count[u.scene] || 0) + 1; });
  return (
    <section className="glass sec rooms">
      <h2>Phòng học</h2>
      <ul>
        {SCENES.map(sc => (
          <li key={sc.id}>
            <button className={current && current.id === sc.id ? 'on' : ''} style={{ '--h': sc.hue }} onClick={() => onPick(sc)}>
              <span className="avatar">{sc.name.replace('Mr. ', '').replace('Dr. ', '')[0]}</span>
              <span className="r-t"><b>{sc.title}</b><small>{sc.vi}</small></span>
              {count[sc.id] ? <span className="r-n">{count[sc.id]}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function People({ users, meId, ok, listening, onListen }) {
  return (
    <section className="glass sec people">
      <h2>Trong trường <span>{users.length}</span></h2>
      {ok === false && <p className="muted small">Chưa kết nối được lớp học — chỉ thấy mình bạn.</p>}
      <ul>
        {users.map(u => (
          <li key={u.id}>
            <i className={'dot ' + u.phase} style={{ background: u.color }} />
            <div>
              <b>{u.id === meId ? `${u.name} (bạn)` : u.name}</b>
              <span>{describe(u)}</span>
              {u.said && Date.now() - (u.saidAt || 0) < 60000 && <q>{u.said}</q>}
            </div>
            {u.id !== meId && (
              <button className={'ear' + (listening.has(u.id) ? ' on' : '')} onClick={() => onListen(u.id)}
                aria-pressed={listening.has(u.id)} title={listening.has(u.id) ? 'Đang nghe — bấm để thôi' : 'Nghe người này nói'}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 3a7 7 0 0 0-7 7v6a3 3 0 0 0 3 3h1v-7H7v-2a5 5 0 0 1 10 0v2h-2v7h1a3 3 0 0 0 3-3v-6a7 7 0 0 0-7-7z" /></svg>
                <span>{listening.has(u.id) ? 'Đang nghe' : 'Nghe'}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RightTabs({ right, setRight }) {
  return (
    <div className="tabs" role="tablist">
      {[['feed', 'Hoạt động'], ['history', 'Lịch sử']].map(([k, label]) => (
        <button key={k} role="tab" aria-selected={right === k} className={right === k ? 'on' : ''} onClick={() => setRight(k)}>{label}</button>
      ))}
    </div>
  );
}

function Feed({ feed, ai, tabs }) {
  return (
    <section className="glass sec feed">
      {tabs}
      {(ai.state === 'down' || ai.state === 'nomodel') && (
        <p className="notice">{LOCAL ? <>AI chưa chạy trên máy này — chạy <code>./start.sh</code> rồi tải lại trang.</> : 'Chưa kết nối được tới AI. Kiểm tra mạng rồi tải lại trang.'}</p>
      )}
      <div className="intro">
        <b>Chọn một phòng để bắt đầu.</b> Nhân vật của bạn sẽ đi vào phòng, AI trong phòng nhập vai và mở lời trước.
        Bạn chỉ cần nói; câu nào chưa tự nhiên sẽ được gợi ý sửa.
      </div>
      <ul>
        <AnimatePresence initial={false}>
          {feed.map((e, i) => (
            <motion.li key={e.t + ':' + e.text} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className={e.said ? 'said' : ''}>
              <i style={{ background: e.c }} /><span>{e.text}</span><time>{hhmm(e.t)}</time>
            </motion.li>
          ))}
        </AnimatePresence>
        {!feed.length && <li className="muted small">Chưa có hoạt động nào.</li>}
      </ul>
    </section>
  );
}

function History({ history, tabs, onOpen, onDelete }) {
  return (
    <section className="glass sec history">
      {tabs}
      <p className="muted small">Các buổi luyện được lưu trên máy này. Nhân vật trong phòng sẽ nhớ lần trước bạn nói gì.</p>
      <ul>
        {history.map(x => {
          const sc = SCENE[x.scene], said = x.msgs.filter(m => m.who === 'me').length, fixes = x.msgs.filter(m => m.fix).length;
          return (
            <li key={x.id}>
              <button className="h-item" style={{ '--h': sc ? sc.hue : 150 }} onClick={() => onOpen(x)}>
                <span className="avatar">{sc ? sc.name.replace('Mr. ', '').replace('Dr. ', '')[0] : '?'}</span>
                <span className="r-t"><b>{sc ? sc.title : x.scene}</b>
                  <small>{new Date(x.start).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {said} câu{fixes ? ` · ${fixes} sửa` : ''}</small></span>
              </button>
              <button className="h-del" onClick={() => onDelete(x.id)} aria-label="Xoá buổi này" title="Xoá buổi này">✕</button>
            </li>
          );
        })}
        {!history.length && <li className="muted small">Chưa có buổi luyện nào. Vào một phòng và nói vài câu nhé.</li>}
      </ul>
    </section>
  );
}

function Session({ x, onBack, onAgain }) {
  const sc = SCENE[x.scene] || { title: x.scene, name: 'AI', hue: 150 };
  return (
    <section className="glass sec talk session" style={{ '--h': sc.hue }}>
      <div className="persona">
        <button className="iconbtn" onClick={onBack} aria-label="Quay lại lịch sử">←</button>
        <div>
          <div className="persona-name">{sc.title}</div>
          <div className="persona-role">{new Date(x.start).toLocaleString('vi-VN')} · với {sc.name}</div>
        </div>
      </div>
      <div className="chat">
        {x.msgs.map((m, i) => (
          <div key={i} className={'msg ' + m.who}>
            <div className="bubble">{m.text}</div>
            {m.fix && <div className="fix"><span className="fix-l">Nói tự nhiên hơn</span><div className="fix-b">{m.fix.better}</div>{m.fix.note && <div className="fix-n">{m.fix.note}</div>}</div>}
          </div>
        ))}
        {x.summary && (
          <div className="summary">
            {x.summary.tips.length > 0 && <><h4>Lời khuyên</h4><ul>{x.summary.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
            {x.summary.phrases.length > 0 && <><h4>Cụm từ nên dùng</h4><ul>{x.summary.phrases.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
          </div>
        )}
      </div>
      <button className="primary again" onClick={onAgain}>Luyện lại phòng này</button>
    </section>
  );
}

function WalkBar({ here, onTalk, onExit }) {
  return (
    <div className="viewbar walkbar glass">
      {here
        ? <button className="talk-btn" style={{ '--h': here.hue }} onClick={onTalk}>Nói chuyện với {here.name}</button>
        : <span className="hint-walk"><span className="kbd-only"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> để đi, kéo chuột để nhìn · </span>đi vào một phòng để học</span>}
      <button onClick={onExit}>Thoát hoá thân</button>
    </div>
  );
}

// on-screen joystick for touch screens
function Stick({ input }) {
  const [k, setK] = useState({ x: 0, y: 0 });
  const R = 46;
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect();
    let x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(x, y); if (d > R) { x *= R / d; y *= R / d; }
    input.jx = x / R; input.jy = -y / R; setK({ x, y });
  };
  const end = () => { input.jx = 0; input.jy = 0; setK({ x: 0, y: 0 }); };
  useEffect(() => end, []);
  return (
    <div className="stick" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={e => { if (e.buttons || e.pointerType === 'touch') move(e); }} onPointerUp={end} onPointerCancel={end}
      role="application" aria-label="Cần điều khiển: kéo để đi">
      <em>Kéo để đi / quay</em>
      <span style={{ transform: `translate(${k.x}px, ${k.y}px)` }} />
    </div>
  );
}

function ViewBar({ view, setView, sheet, setSheet, onWalk }) {
  const zoom = k => setView(v => ({ fit: Math.min(2.5, Math.max(0.6, v.fit * k)), n: v.n + 1 }));
  const tab = k => setSheet(sheet === k ? null : k);
  return (
    <div className="viewbar glass">
      <button onClick={() => setView({ fit: 1, n: view.n + 1 })}>Toàn cảnh</button>
      <button onClick={() => zoom(1 / 1.25)} aria-label="Thu nhỏ">−</button>
      <button onClick={() => zoom(1.25)} aria-label="Phóng to">+</button>
      <span className="sep" />
      <button className={'mob' + (sheet === 'rooms' ? ' on' : '')} onClick={() => tab('rooms')}>Phòng</button>
      <button className={'mob' + (sheet === 'feed' ? ' on' : '')} onClick={() => tab('feed')}>Hoạt động</button>
      <button className={'mob' + (sheet === 'history' ? ' on' : '')} onClick={() => tab('history')}>Lịch sử</button>
      <button className="walk-btn" onClick={onWalk}>Hoá thân</button>
      <span className="hint-pick">hoặc bấm vào một phòng để vào học</span>
    </div>
  );
}

// ---------------------------------------------------------------- conversation
function Talk({ s, eng, cfg }) {
  const chatRef = useRef(null);
  useEffect(() => { const c = chatRef.current; if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' }); }, [s.msgs.length, s.msgs[s.msgs.length - 1]?.text, s.summary]);
  const sc = s.scene;
  return (
    <section className="glass sec talk" style={{ '--h': sc.hue }}>
      <div className="persona">
        <span className="avatar big">{sc.name.replace('Mr. ', '').replace('Dr. ', '')[0]}</span>
        <div>
          <div className="persona-name">{sc.name} <span className="chip">{sc.title}</span></div>
          <div className="persona-role">{sc.role}</div>
        </div>
      </div>
      <div className="chat" ref={chatRef} aria-live="polite">
        <AnimatePresence initial={false}>
          {s.msgs.map(m => <Msg key={m.id} m={m} eng={eng} showAi={cfg.showAi} />)}
          {s.summary && <Summary key="sum" sum={s.summary} />}
        </AnimatePresence>
      </div>
    </section>
  );
}

function Dock({ s, eng }) {
  return (
    <footer className="dock glass">
      <div className="status" aria-live="polite">{s.status}</div>
      <MicOrb phase={s.phase} onClick={() => eng.mic()} />
      <TypeBox onSend={t => eng.typed(t)} />
      <div className="hint kbd-only">{canListen ? <>Phím <kbd>Space</kbd> — nói / dừng / ngắt lời AI</> : 'Trình duyệt này không nhận giọng nói — hãy mở bằng Chrome'}</div>
    </footer>
  );
}

function MicOrb({ phase, onClick }) {
  // magnetic pull toward a fine pointer
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18 }), sy = useSpring(y, { stiffness: 220, damping: 18 });
  const fine = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const move = e => {
    if (!fine) return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.25); y.set((e.clientY - (r.top + r.height / 2)) * 0.25);
  };
  const label = phase === 'listening' ? 'Đang nghe' : phase === 'speaking' ? 'AI đang nói — bấm để ngắt lời' : phase === 'thinking' ? 'AI đang nghĩ' : 'Bấm để nói';
  return (
    <div className="orb-zone" onPointerMove={move} onPointerLeave={() => { x.set(0); y.set(0); }}>
      <motion.button className={'orb ' + phase} style={{ x: sx, y: sy }} onClick={onClick} aria-label={label} title={label} whileTap={{ scale: 0.94 }}>
        <span className="ring r1" /><span className="ring r2" />
        {phase === 'thinking'
          ? <span className="dots"><i /><i /><i /></span>
          : phase === 'speaking'
            ? <span className="bars"><i /><i /><i /><i /></span>
            : <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" /></svg>}
      </motion.button>
    </div>
  );
}

function Msg({ m, eng, showAi }) {
  const [reveal, setReveal] = useState(false);
  const hidden = m.who === 'ai' && !showAi && !reveal;
  return (
    <motion.div layout="position" className={`msg ${m.who}${m.interim ? ' interim' : ''}`}
      initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={spring}>
      {m.error ? <div className="bubble err">{m.error}</div>
        : <div className={'bubble' + (hidden ? ' hidden' : '')} onClick={() => setReveal(true)} title={hidden ? 'Bấm để hiện chữ' : undefined}>{m.text || <span className="typing"><i /><i /><i /></span>}</div>}
      {m.who === 'ai' && m.done && (
        <div className="tools">
          <button onClick={() => eng.replay(m.text)}>Nghe lại</button>
          <button onClick={() => eng.replay(m.text, 0.75)}>Nghe chậm</button>
          <button onClick={() => eng.suggest(m)}>Gợi ý trả lời</button>
        </div>
      )}
      <AnimatePresence>
        {m.suggest && (
          <motion.div className="suggest" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
            {m.suggest.loading ? 'Đang gợi ý…' : m.suggest.error ? 'Không lấy được gợi ý.' : m.suggest.replies.map((r, i) => <div key={i}>“{r}”</div>)}
          </motion.div>
        )}
        {m.fix && (m.fix.ok
          ? <motion.div key="ok" className="fix ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>✓ Tự nhiên</motion.div>
          : <motion.div key="fix" className="fix" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
              <span className="fix-l">Nói tự nhiên hơn</span>
              <div className="fix-b">{m.fix.better}</div>
              {m.fix.note && <div className="fix-n">{m.fix.note}</div>}
            </motion.div>)}
      </AnimatePresence>
    </motion.div>
  );
}

function Summary({ sum }) {
  return (
    <motion.div className="summary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
      <h3>Tổng kết buổi luyện</h3>
      <div className="stats">
        <div><b>{sum.turns}</b><span>lượt nói</span></div>
        <div><b>{sum.words}</b><span>từ</span></div>
        <div><b>{sum.turns ? (sum.words / sum.turns).toFixed(1) : 0}</b><span>từ / lượt</span></div>
      </div>
      {sum.fixes.length > 0 && <>
        <h4>Các câu nên nói lại</h4>
        <ul className="fixes">{sum.fixes.map((f, i) => <li key={i}><s>{f.said}</s><b>{f.better}</b>{f.note && <span>{f.note}</span>}</li>)}</ul>
      </>}
      {sum.turns > 0 && !sum.fixes.length && <p>Không có câu nào cần sửa. Tốt lắm!</p>}
      {sum.loading && <p className="muted">Đang nhận xét…</p>}
      {sum.tips && <><h4>Lời khuyên</h4><ul>{sum.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
      {sum.phrases && <><h4>Cụm từ nên dùng</h4><ul>{sum.phrases.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
    </motion.div>
  );
}

function TypeBox({ onSend }) {
  const [t, setT] = useState('');
  return (
    <form className="type" onSubmit={e => { e.preventDefault(); onSend(t); setT(''); }}>
      <input value={t} onChange={e => setT(e.target.value)} placeholder="Hoặc gõ câu trả lời…" autoComplete="off" aria-label="Gõ câu trả lời" />
    </form>
  );
}


// ---------------------------------------------------------------- joining the classroom
function Join({ onJoin }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]);
  const go = e => { e.preventDefault(); if (name.trim()) onJoin(name, color); };
  return (
    <>
      <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.form className="join" onSubmit={go} initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16 }} transition={spring}>
        <h2>Vào lớp học</h2>
        <p>Mọi người trong lớp sẽ thấy tên và nhân vật của bạn.</p>
        <input className="txt" autoFocus maxLength={24} placeholder="Tên của bạn" value={name} onChange={e => setName(e.target.value)} />
        <div className="swatches" role="radiogroup" aria-label="Màu nhân vật">
          {COLORS.map(c => (
            <button type="button" key={c} role="radio" aria-checked={c === color} aria-label={c} className={c === color ? 'on' : ''}
              style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        <button className="primary" disabled={!name.trim()}>Vào lớp</button>
      </motion.form>
    </>
  );
}


// ---------------------------------------------------------------- settings drawer
function Settings({ cfg, set, onClose }) {
  return (
    <>
      <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside className="drawer" role="dialog" aria-label="Cài đặt" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 34 }}>
        <div className="drawer-head"><h2>Cài đặt</h2><button className="iconbtn" onClick={onClose} aria-label="Đóng">✕</button></div>

        <label className="lbl" htmlFor="rate">Tốc độ nói <span>{cfg.rate.toFixed(2)}×</span></label>
        <input id="rate" type="range" min="0.7" max="1.2" step="0.05" value={cfg.rate} onChange={e => set({ rate: Number(e.target.value) })} />

        <label className="lbl" htmlFor="pause">Chờ bạn ngừng nói <span>{cfg.pause.toFixed(1)} s</span></label>
        <input id="pause" type="range" min="0.8" max="3" step="0.1" value={cfg.pause} onChange={e => set({ pause: Number(e.target.value) })} />

        <label className="switch"><input type="checkbox" checked={cfg.showAi} onChange={e => set({ showAi: e.target.checked })} /><span />Hiện chữ của AI <small>tắt để luyện nghe</small></label>
        <label className="switch"><input type="checkbox" checked={cfg.feedback} onChange={e => set({ feedback: e.target.checked })} /><span />Sửa câu của tôi</label>

      </motion.aside>
    </>
  );
}

