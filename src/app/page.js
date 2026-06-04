import Link from 'next/link';

const FEATURES = [
  {
    href: '/vocabulary',
    icon: '📚',
    title: 'Dictionary',
    desc: 'Look up any word and get the meaning, pronunciation, and real example sentences.',
    color: 'rgba(99,102,241,0.15)',
    border: 'rgba(99,102,241,0.25)',
  },
  {
    href: '/quiz',
    icon: '🧠',
    title: 'Vocabulary Quiz',
    desc: 'Test yourself with quick multiple-choice questions. Great for remembering new words.',
    color: 'rgba(139,92,246,0.15)',
    border: 'rgba(139,92,246,0.25)',
  },
  {
    href: '/speaking',
    icon: '🎙️',
    title: 'Speaking Practice',
    desc: 'Say a sentence out loud and see how close you got. Good for building confidence.',
    color: 'rgba(236,72,153,0.12)',
    border: 'rgba(236,72,153,0.22)',
  },
  {
    href: '/listening',
    icon: '🎧',
    title: 'Listening',
    desc: "Listen to a sentence and type what you hear. You can slow it down if it's too fast.",
    color: 'rgba(6,182,212,0.12)',
    border: 'rgba(6,182,212,0.22)',
  },
  {
    href: '/translate',
    icon: '✍️',
    title: 'Translation Practice',
    desc: 'Take a Vietnamese sentence, translate it to English, and get honest feedback on your mistakes.',
    color: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
  },
];

export default function Home() {
  return (
    <div>
      {/* ── HERO ── */}
      <section className="hero fade-up">
        <div className="hero-badge">
          <span className="chip">✦ Built for Vietnamese learners</span>
        </div>
        <h1 className="hero-title">
          Get better at English,<br />
          one step at a <span className="gradient-text">time</span>
        </h1>
        <p className="hero-sub">
          Practice reading, listening, speaking, and writing — 
          whatever you want to work on today.
        </p>
        <div className="hero-actions">
          <Link href="/vocabulary" className="btn btn-primary">Start now →</Link>
          <Link href="/quiz" className="btn btn-ghost">Try a quiz</Link>
        </div>
      </section>

      {/* ── STATS ── */}
      <div className="stats-row fade-up d2">
        {[['5','things to practice'],['Free','no sign-up needed'],['Works','on any device']].map(([num, label]) => (
          <div key={label} className="stat-item">
            <div className="stat-num">{num}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* ── FEATURE CARDS ── */}
      <div className="features">
        {FEATURES.map(({ href, icon, title, desc, color, border }, i) => (
          <Link href={href} key={href} className={`feat-card fade-up d${i + 2}`}>
            <div className="feat-icon-wrap" style={{ background: color, borderColor: border }}>
              {icon}
            </div>
            <div className="feat-title">{title}</div>
            <p className="feat-desc">{desc}</p>
            <div className="feat-arrow">Explore <span>→</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
