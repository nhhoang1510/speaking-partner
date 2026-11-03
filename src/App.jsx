import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useMotionValue, useSpring } from 'framer-motion';
import { Engine, canListen } from './lib/engine.js';
import { checkAI } from './lib/llm.js';
import { SCENES, LEVELS } from './scenes.js';

const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const DEFAULTS = { provider: LOCAL ? 'ollama' : 'cloud', url: 'http://localhost:11434', model: 'llama3.2:3b', level: 'intermediate', speech: LOCAL ? 'device' : 'cloud', voice: '', rate: 1, pause: 1.4, showAi: true, feedback: true };
const spring = { type: 'spring', stiffness: 260, damping: 26 };

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('sp-settings') || '{}') }; } catch (e) { return DEFAULTS; }
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

export default function App() {
  const [st, setSt] = useState(null);
  const [cfg, setCfg] = useState(loadSettings);
  const [ai, setAi] = useState({ state: 'checking' });
  const [booting, setBooting] = useState(true);
  const [panel, setPanel] = useState(false);
  const engine = useRef(null);
  if (!engine.current) engine.current = new Engine(setSt);
  const eng = engine.current;
  const voices = useVoices();

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

  // is the AI reachable, and does it have the model?
  useEffect(() => {
    let live = true;
    setAi({ state: 'checking' });
    const t = setTimeout(() => checkAI(cfg)
      .then(r => live && setAi({ state: r.ok ? 'ok' : 'nomodel', model: r.model, models: r.models }))
      .catch(() => live && setAi({ state: 'down' })), 300);
    return () => { live = false; clearTimeout(t); };
  }, [cfg.provider, cfg.url, cfg.model]);

  // entry sequence: wait for fonts and the AI check, at least a short beat
  useEffect(() => {
    const min = new Promise(r => setTimeout(r, 900));
    Promise.all([min, document.fonts ? document.fonts.ready : null]).then(() => setBooting(false));
  }, []);

  useEffect(() => {
    const onKey = e => {
      if (e.code === 'Escape') setPanel(false);
      if (e.code !== 'Space' || e.repeat || /INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) return;
      e.preventDefault(); eng.mic();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const s = st || eng.s;

  return (
    <MotionConfig reducedMotion="user">
      <Backdrop hue={s.scene ? s.scene.hue : 150} />
      <AnimatePresence>{booting && <Preloader key="pre" />}</AnimatePresence>

      <div className="shell">
        <TopBar s={s} ai={ai} cfg={cfg} onSettings={() => setPanel(true)} onBack={() => eng.leave()} onEnd={() => eng.end()} />
        <AnimatePresence mode="wait">
          {!s.scene
            ? <Home key="home" cfg={cfg} set={set} ready={!booting} onPick={sc => eng.start(sc)} ai={ai} onSettings={() => setPanel(true)} />
            : <Talk key={'talk-' + s.scene.id} s={s} eng={eng} cfg={cfg} />}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {panel && <Settings key="set" cfg={cfg} set={set} voices={voices} ai={ai} onClose={() => setPanel(false)} />}
      </AnimatePresence>
    </MotionConfig>
  );
}

// ---------------------------------------------------------------- atmosphere
function Backdrop({ hue }) {
  return (
    <div className="backdrop" aria-hidden="true" style={{ '--h': hue }}>
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      <div className="grain" />
    </div>
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

function TopBar({ s, ai, cfg, onSettings, onBack, onEnd }) {
  return (
    <header className="topbar">
      <div className="brand">
        <AnimatePresence initial={false} mode="popLayout">
          {s.scene
            ? <motion.button key="back" className="iconbtn" onClick={onBack} aria-label="Quay lại" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z" /></svg>
              </motion.button>
            : <motion.span key="logo" className="logo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>S</motion.span>}
        </AnimatePresence>
        <span className="brand-name">Speaking Partner</span>
      </div>
      <div className="top-right">
        <span className={'pill ' + ai.state} title={ai.state === 'ok' ? `${ai.model || cfg.model} · ${cfg.provider === 'cloud' ? 'cloud' : 'trên máy'}` : ''}>
          <i /><span className="pill-t">{ai.state === 'ok' ? 'AI sẵn sàng' : ai.state === 'checking' ? 'Đang kết nối…' : ai.state === 'nomodel' ? (cfg.provider === 'cloud' ? 'Chưa cấu hình AI' : 'Thiếu model') : 'AI chưa bật'}</span>
        </span>
        {s.scene && <button className="ghost" onClick={onEnd}><span className="wide">Kết thúc &amp; nhận xét</span><span className="narrow">Kết thúc</span></button>}
        <button className="iconbtn" onClick={onSettings} aria-label="Cài đặt">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)" /></svg>
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- home
const HEAD = ['Speak', 'English', 'like', "it's", 'real.'];

function Home({ cfg, set, ready, onPick, ai, onSettings }) {
  return (
    <motion.main className="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>
      <section className="hero">
        <h1 className="display" aria-label={HEAD.join(' ')}>
          {HEAD.map((w, i) => (
            <span className="word-mask" key={i} aria-hidden="true">
              <motion.span className={'word' + (i === 4 ? ' accent' : '')} initial={{ y: '110%' }} animate={ready ? { y: 0 } : {}}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.08 * i }}>{w}</motion.span>
            </span>
          ))}
        </h1>
        <motion.p className="lede" initial={{ opacity: 0, y: 10 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.55, duration: 0.6 }}>
          Chọn một tình huống. AI sẽ nhập vai, mở lời trước và trò chuyện với bạn bằng giọng nói — như ngoài đời thật.
          Bạn chỉ cần nói; câu nào chưa tự nhiên sẽ được gợi ý sửa.
        </motion.p>
        <motion.div className="levels" role="radiogroup" aria-label="Trình độ" initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ delay: 0.7 }}>
          {Object.entries(LEVELS).map(([k, v]) => (
            <button key={k} role="radio" aria-checked={cfg.level === k} className={'seg' + (cfg.level === k ? ' on' : '')} onClick={() => set({ level: k })}>
              {cfg.level === k && <motion.span layoutId="seg" className="seg-bg" transition={spring} />}
              <span className="seg-t">{v.label.replace(/ \(.*\)/, '')}<span className="seg-lv"> {v.label.match(/\((.*)\)/)[1]}</span></span>
            </button>
          ))}
        </motion.div>
        {(ai.state === 'down' || ai.state === 'nomodel') && ready && (
          <motion.button className="notice" onClick={onSettings} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
            {cfg.provider === 'cloud'
              ? (ai.state === 'nomodel' ? 'AI cloud chưa được cấu hình (thiếu GROQ_API_KEY trên Vercel).' : 'Không kết nối được AI cloud.')
              : <>AI chưa chạy trên máy này — chạy <code>./start.sh</code> rồi tải lại trang.</>} Bấm để xem cài đặt.
          </motion.button>
        )}
      </section>

      <section className="grid" aria-label="Tình huống">
        {SCENES.map((sc, i) => (
          <motion.button key={sc.id} className="card" style={{ '--h': sc.hue }} onClick={() => onPick(sc)}
            initial={{ opacity: 0, y: 24 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ ...spring, delay: 0.75 + 0.05 * i }}
            whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
            <span className="card-glow" />
            <span className="avatar">{sc.name.replace('Mr. ', '').replace('Dr. ', '')[0]}</span>
            <span className="card-title">{sc.title}</span>
            <span className="card-vi">{sc.vi}</span>
            <span className="card-who">với {sc.name}</span>
          </motion.button>
        ))}
      </section>
    </motion.main>
  );
}

// ---------------------------------------------------------------- conversation
function Talk({ s, eng, cfg }) {
  const chatRef = useRef(null);
  useEffect(() => { const c = chatRef.current; if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' }); }, [s.msgs.length, s.msgs[s.msgs.length - 1]?.text, s.summary]);
  const sc = s.scene;
  return (
    <motion.main className="talk" style={{ '--h': sc.hue }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div className="persona">
        <span className="avatar big">{sc.name.replace('Mr. ', '').replace('Dr. ', '')[0]}</span>
        <div>
          <div className="persona-name">{sc.name} <span className="chip">{sc.title}</span></div>
          <div className="persona-role">{sc.role}</div>
        </div>
      </div>

      <section className="chat" ref={chatRef} aria-live="polite">
        <AnimatePresence initial={false}>
          {s.msgs.map(m => <Msg key={m.id} m={m} eng={eng} showAi={cfg.showAi} />)}
          {s.summary && <Summary key="sum" sum={s.summary} />}
        </AnimatePresence>
      </section>

      <footer className="dock">
        <div className="status" aria-live="polite">{s.status}</div>
        <MicOrb phase={s.phase} onClick={() => eng.mic()} />
        <TypeBox onSend={t => eng.typed(t)} />
        <div className="hint kbd-only">{canListen ? <>Phím <kbd>Space</kbd> — nói / dừng / ngắt lời AI</> : 'Trình duyệt này không nhận giọng nói — hãy mở bằng Chrome'}</div>
      </footer>
    </motion.main>
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

// ---------------------------------------------------------------- settings drawer
function Settings({ cfg, set, voices, ai, onClose }) {
  return (
    <>
      <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside className="drawer" role="dialog" aria-label="Cài đặt" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 34 }}>
        <div className="drawer-head"><h2>Cài đặt</h2><button className="iconbtn" onClick={onClose} aria-label="Đóng">✕</button></div>

        <h3 className="drawer-sec">Giọng AI</h3>
        <div className="levels full" role="radiogroup" aria-label="Giọng AI">
          {[['cloud', 'Tự nhiên (cloud)'], ['device', 'Giọng của máy']].map(([k, label]) => (
            <button key={k} role="radio" aria-checked={cfg.speech === k} className={'seg' + (cfg.speech === k ? ' on' : '')} onClick={() => set({ speech: k })}>
              {cfg.speech === k && <motion.span layoutId="seg-voice" className="seg-bg" transition={spring} />}
              <span className="seg-t">{label}</span>
            </button>
          ))}
        </div>
        {cfg.speech === 'cloud'
          ? <p className="help">Giọng người thật của Groq, mỗi nhân vật một giọng. Hết lượt miễn phí thì tự chuyển sang giọng của máy.</p>
          : <select id="voice" aria-label="Giọng của máy" value={cfg.voice} onChange={e => set({ voice: e.target.value })}>
              {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
            </select>}

        <label className="lbl" htmlFor="rate">Tốc độ nói <span>{cfg.rate.toFixed(2)}×</span></label>
        <input id="rate" type="range" min="0.7" max="1.2" step="0.05" value={cfg.rate} onChange={e => set({ rate: Number(e.target.value) })} />

        <label className="lbl" htmlFor="pause">Chờ bạn ngừng nói <span>{cfg.pause.toFixed(1)} s</span></label>
        <input id="pause" type="range" min="0.8" max="3" step="0.1" value={cfg.pause} onChange={e => set({ pause: Number(e.target.value) })} />

        <label className="switch"><input type="checkbox" checked={cfg.showAi} onChange={e => set({ showAi: e.target.checked })} /><span />Hiện chữ của AI <small>tắt để luyện nghe</small></label>
        <label className="switch"><input type="checkbox" checked={cfg.feedback} onChange={e => set({ feedback: e.target.checked })} /><span />Sửa câu của tôi</label>

        <h3 className="drawer-sec">Nguồn AI</h3>
        <div className="levels full" role="radiogroup" aria-label="Nguồn AI">
          {[['cloud', 'Cloud (Groq)'], ['ollama', 'Ollama trên máy']].map(([k, label]) => (
            <button key={k} role="radio" aria-checked={cfg.provider === k} className={'seg' + (cfg.provider === k ? ' on' : '')} onClick={() => set({ provider: k })}>
              {cfg.provider === k && <motion.span layoutId="seg-ai" className="seg-bg" transition={spring} />}
              <span className="seg-t">{label}</span>
            </button>
          ))}
        </div>
        {cfg.provider === 'cloud'
          ? <p className="help">
              {ai.state === 'ok' ? `Đã kết nối: ${ai.model}. Dùng được trên điện thoại.` : ai.state === 'nomodel' ? 'Server chưa có GROQ_API_KEY — thêm trong Vercel → Settings → Environment Variables rồi deploy lại.' : 'Chưa kết nối được /api/chat (chỉ có khi chạy trên Vercel).'}
            </p>
          : <>
        <label className="lbl" htmlFor="url">Địa chỉ Ollama</label>
        <input id="url" className="txt" value={cfg.url} onChange={e => set({ url: e.target.value.trim().replace(/\/$/, '') })} />
        <label className="lbl" htmlFor="model">Model</label>
        {ai.models && ai.models.length
          ? <select id="model" value={cfg.model} onChange={e => set({ model: e.target.value })}>
              {[...new Set([cfg.model, ...ai.models])].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          : <input id="model" className="txt" value={cfg.model} onChange={e => set({ model: e.target.value.trim() })} />}
        <p className="help">
          {ai.state === 'ok' ? `Đã kết nối: ${cfg.model}.` : ai.state === 'nomodel' ? `Ollama chạy nhưng chưa có model ${cfg.model}.` : 'Chưa kết nối được Ollama.'}{' '}
          Chạy <code>./start.sh ai</code> trên máy để bật AI. Khi mở trang từ Vercel, Chrome sẽ hỏi quyền truy cập thiết bị trong mạng cục bộ — hãy bấm Cho phép.
        </p>
          </>}
      </motion.aside>
    </>
  );
}
