'use client';

import { useState, useRef, useEffect } from 'react';

/* ── Sample Vietnamese passages for practice ── */
const PASSAGES = [
  {
    id: 1,
    level: 'Beginner',
    levelColor: '#10b981',
    topic: 'Daily Life',
    vietnamese: 'Hôm nay tôi đi học muộn vì tôi ngủ quá giờ và không nghe thấy tiếng chuông báo thức.',
  },
  {
    id: 2,
    level: 'Beginner',
    levelColor: '#10b981',
    topic: 'Weather',
    vietnamese: 'Thời tiết hôm nay rất đẹp. Bầu trời trong xanh và có gió nhẹ, rất thích hợp để đi dạo ngoài trời.',
  },
  {
    id: 3,
    level: 'Intermediate',
    levelColor: '#f59e0b',
    topic: 'Technology',
    vietnamese: 'Công nghệ trí tuệ nhân tạo đang thay đổi cách con người làm việc và học tập, mang lại nhiều cơ hội nhưng cũng tạo ra không ít thách thức.',
  },
  {
    id: 4,
    level: 'Intermediate',
    levelColor: '#f59e0b',
    topic: 'Environment',
    vietnamese: 'Biến đổi khí hậu là một trong những vấn đề nghiêm trọng nhất mà nhân loại đang phải đối mặt. Chúng ta cần hành động ngay bây giờ để bảo vệ hành tinh cho các thế hệ tương lai.',
  },
  {
    id: 5,
    level: 'Advanced',
    levelColor: '#ef4444',
    topic: 'Economy',
    vietnamese: 'Toàn cầu hóa kinh tế đã tạo ra sự phụ thuộc lẫn nhau giữa các quốc gia, đồng thời làm nảy sinh nhiều vấn đề phức tạp liên quan đến bất bình đẳng thu nhập và mất việc làm do tự động hóa.',
  },
];

const SCORE_CONFIG = [
  { key: 'grammar',     label: 'Grammar',     color: '#6366f1', glow: 'rgba(99,102,241,0.4)'  },
  { key: 'vocabulary',  label: 'Vocabulary',  color: '#8b5cf6', glow: 'rgba(139,92,246,0.4)'  },
  { key: 'accuracy',    label: 'Accuracy',    color: '#ec4899', glow: 'rgba(236,72,153,0.4)'  },
  { key: 'naturalness', label: 'Naturalness', color: '#06b6d4', glow: 'rgba(6,182,212,0.4)'   },
];

const ERROR_TYPE_COLORS = {
  Grammar:    { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: '#fca5a5' },
  Vocabulary: { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  text: '#fde68a' },
  Accuracy:   { bg: 'rgba(236,72,153,0.1)',  border: 'rgba(236,72,153,0.3)',  text: '#f9a8d4' },
  Naturalness:{ bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.3)',  text: '#c4b5fd' },
  default:    { bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.3)',  text: '#a5b4fc' },
};

function getScoreMeta(score) {
  if (score >= 90) return { emoji: '🏆', label: 'Excellent!',  color: '#10b981' };
  if (score >= 75) return { emoji: '🎯', label: 'Great',       color: '#6366f1' };
  if (score >= 60) return { emoji: '📈', label: 'Good',        color: '#f59e0b' };
  if (score >= 40) return { emoji: '💪', label: 'Keep Going!', color: '#f97316' };
  return                   { emoji: '🌱', label: 'Beginner',   color: '#ef4444' };
}

function ScoreRing({ score, label, color, glow, delay = 0 }) {
  const [animated, setAnimated] = useState(0);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  useEffect(() => {
    setAnimated(0);
    const timer = setTimeout(() => {
      let start = null;
      const step = (ts) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / 900, 1);
        setAnimated(Math.round(progress * score));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(timer);
  }, [score, delay]);

  return (
    <div className="score-ring-wrap">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <circle
          cx="44" cy="44" r={radius} fill="none"
          stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 44 44)"
          style={{ filter: `drop-shadow(0 0 6px ${glow})`, transition: 'stroke-dashoffset 0.05s linear' }}
        />
        <text x="44" y="40" textAnchor="middle" fill={color} fontSize="16" fontWeight="700" fontFamily="Space Grotesk, sans-serif">
          {animated}
        </text>
        <text x="44" y="54" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">/100</text>
      </svg>
      <div className="score-ring-label">{label}</div>
    </div>
  );
}

const SESSION_KEY = 'lumina_translate_state';

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function TranslatePage() {
  const saved = typeof window !== 'undefined' ? loadSession() : null;

  const [mode, setMode]               = useState(saved?.mode ?? 'select');
  const [passage, setPassage]         = useState(saved?.passage ?? null);
  const [useCustom, setUseCustom]     = useState(saved?.useCustom ?? false);
  const [customVN, setCustomVN]       = useState(saved?.customVN ?? '');
  const [userTranslation, setUserTr]  = useState(saved?.userTranslation ?? '');
  const [result, setResult]           = useState(saved?.result ?? null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [copied, setCopied]           = useState(false);
  const inputRef                      = useRef(null);

  // Persist state to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        mode, passage, useCustom, customVN, userTranslation, result,
      }));
    } catch { /* storage quota exceeded – ignore */ }
  }, [mode, passage, useCustom, customVN, userTranslation, result]);

  const vietnameseText = useCustom ? customVN : passage?.vietnamese;

  const startPractice = (p) => {
    setPassage(p);
    setUseCustom(false);
    setCustomVN('');
    setUserTr('');
    setResult(null);
    setError('');
    setMode('practice');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const startCustom = () => {
    setPassage(null);
    setUseCustom(true);
    setUserTr('');
    setResult(null);
    setError('');
    setMode('practice');
  };

  const handleSubmit = async () => {
    if (!vietnameseText?.trim() || !userTranslation.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vietnamese: vietnameseText, userTranslation }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setMode('result');
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMode('select');
    setResult(null);
    setUserTr('');
    setError('');
  };

  const tryAgain = () => {
    setResult(null);
    setUserTr('');
    setError('');
    setMode('practice');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const overall = result?.scores
    ? Math.round(Object.values(result.scores).reduce((a, b) => a + b, 0) / Object.keys(result.scores).length)
    : null;
  const badge = overall != null ? getScoreMeta(overall) : null;

  return (
    <div className="translate-wrap">

      {/* ── Header ── */}
      <div className="page-header fade-up" style={{ textAlign: 'center' }}>
        <h1 className="page-title">
          Translation <span className="gradient-text">Practice</span>
        </h1>
        <p className="page-sub">
          Read the Vietnamese passage → write your English translation → get AI feedback &amp; score.
        </p>
      </div>

      {/* ══════════════════ STEP 1: SELECT PASSAGE ══════════════════ */}
      {mode === 'select' && (
        <div className="fade-up d1">
          <div className="tp-step-label">① Choose a passage to translate</div>

          <div className="tp-passages-grid">
            {PASSAGES.map((p) => (
              <button key={p.id} className="tp-passage-card" onClick={() => startPractice(p)}>
                <div className="tp-passage-card-top">
                  <span className="tp-level-badge" style={{ color: p.levelColor, borderColor: p.levelColor, background: `${p.levelColor}18` }}>
                    {p.level}
                  </span>
                  <span className="tp-topic-chip">{p.topic}</span>
                </div>
                <p className="tp-passage-preview">{p.vietnamese}</p>
                <div className="tp-card-cta">Start translating →</div>
              </button>
            ))}

            {/* Custom input card */}
            <button className="tp-passage-card tp-custom-card" onClick={startCustom}>
              <div className="tp-custom-icon">✏️</div>
              <div className="tp-custom-title">Custom Passage</div>
              <p className="tp-custom-desc">Paste your own Vietnamese text and practice translating it.</p>
              <div className="tp-card-cta">Use my own text →</div>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════ STEP 2: PRACTICE ══════════════════ */}
      {mode === 'practice' && (
        <div className="fade-up">
          <button className="tp-back-btn" onClick={reset}>← Back to passages</button>

          {/* Custom VN input */}
          {useCustom && (
            <div className="card tp-section-card">
              <div className="tp-section-label">
                <span className="tp-step-num">1</span> Paste your Vietnamese text
              </div>
              <textarea
                className="vn-textarea"
                placeholder="Dán đoạn văn tiếng Việt của bạn vào đây…"
                value={customVN}
                onChange={e => setCustomVN(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Vietnamese source */}
          {!useCustom && passage && (
            <div className="card tp-source-card">
              <div className="tp-section-label">
                <span className="tp-step-num">1</span> Vietnamese passage to translate
                <span className="tp-level-badge" style={{ color: passage.levelColor, borderColor: passage.levelColor, background: `${passage.levelColor}18`, marginLeft: '0.6rem' }}>
                  {passage.level}
                </span>
                <span className="tp-topic-chip" style={{ marginLeft: '0.4rem' }}>{passage.topic}</span>
              </div>
              <p className="tp-source-text">{passage.vietnamese}</p>
            </div>
          )}

          {/* User translation input */}
          <div className="card tp-section-card" style={{ marginTop: '1.25rem' }}>
            <div className="tp-section-label">
              <span className="tp-step-num">{useCustom ? '2' : '2'}</span> Write your English translation
            </div>
            <textarea
              ref={inputRef}
              id="user-translation"
              className="vn-textarea"
              style={{ minHeight: '120px' }}
              placeholder="Type your English translation here… (try your best!)"
              value={userTranslation}
              onChange={e => setUserTr(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
            />
            <div className="translate-actions" style={{ marginTop: '1rem' }}>
              <span className="char-count">{userTranslation.length} chars · Ctrl+Enter to submit</span>
              <button
                id="submit-translation-btn"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading || !userTranslation.trim() || (useCustom && !customVN.trim())}
                style={{ minWidth: '160px' }}
              >
                {loading
                  ? <><span className="btn-spinner" />Reviewing…</>
                  : '✅ Submit for Review'}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error fade-up" style={{ marginTop: '1.25rem' }}>
              ⚠️ {error}
            </div>
          )}

          {loading && (
            <div className="translate-loading fade-up">
              <div className="loading-orb" />
              <p>AI is reviewing your translation…</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ STEP 3: RESULT ══════════════════ */}
      {mode === 'result' && result && (
        <div className="fade-up results-wrap">

          {/* Source + user translation recap */}
          <div className="card result-card">
            <div className="result-section-title">📋 Your Submission</div>
            <div className="tp-submission-grid">
              <div>
                <div className="tp-sub-label">🇻🇳 Original Vietnamese</div>
                <p className="tp-sub-text vn">{vietnameseText}</p>
              </div>
              <div>
                <div className="tp-sub-label">✏️ Your Translation</div>
                <p className="tp-sub-text">{userTranslation}</p>
              </div>
            </div>
          </div>

          {/* Overall badge */}
          {badge && (
            <div className="overall-badge" style={{ borderColor: badge.color }}>
              <span className="overall-emoji">{badge.emoji}</span>
              <div>
                <div className="overall-label" style={{ color: badge.color }}>Overall Score — {badge.label}</div>
                <div className="overall-score" style={{ color: badge.color }}>
                  {overall}<span style={{ fontSize: '1rem', opacity: 0.6 }}>/100</span>
                </div>
              </div>
              {result.summary && (
                <p className="tp-summary-text">{result.summary}</p>
              )}
            </div>
          )}

          {/* Score rings */}
          <div className="card result-card">
            <div className="result-section-title">📊 Score Breakdown</div>
            <div className="scores-grid">
              {SCORE_CONFIG.map(({ key, label, color, glow }, i) => (
                <ScoreRing key={key} score={result.scores?.[key] ?? 0} label={label} color={color} glow={glow} delay={i * 120} />
              ))}
            </div>
          </div>

          {/* Reference translation */}
          <div className="card result-card">
            <div className="result-section-title">🌐 Reference Translation</div>
            <div className="translation-block official">
              <p className="translation-text">{result.referenceTranslation}</p>
              <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(result.referenceTranslation); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          </div>

          {/* Your corrected version */}
          <div className="card result-card">
            <div className="result-section-title">✅ Your Corrected Translation</div>
            <div className="translation-block" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }}>
              <p className="translation-text">{result.corrected}</p>
            </div>
          </div>

          {/* Errors */}
          {result.errors?.length > 0 && (
            <div className="card result-card">
              <div className="result-section-title">
                🔴 Errors Found
                <span className="error-count">{result.errors.length} issue{result.errors.length > 1 ? 's' : ''}</span>
              </div>
              <div className="errors-list">
                {result.errors.map((err, i) => {
                  const colors = ERROR_TYPE_COLORS[err.type] || ERROR_TYPE_COLORS.default;
                  return (
                    <div key={i} className="error-item" style={{ background: colors.bg, borderColor: colors.border }}>
                      <div className="error-type-badge" style={{ color: colors.text, borderColor: colors.border }}>
                        {err.type}
                      </div>
                      <div className="error-comparison">
                        <span className="error-original">"{err.original}"</span>
                        <span className="error-arrow">→</span>
                        <span className="error-fix">"{err.correction}"</span>
                      </div>
                      <p className="error-explanation">{err.explanation}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tips */}
          {result.tips?.length > 0 && (
            <div className="card result-card">
              <div className="result-section-title">💡 Tips for Improvement</div>
              <ul className="tips-list">
                {result.tips.map((tip, i) => (
                  <li key={i} className="tip-item">
                    <span className="tip-num">{i + 1}</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={tryAgain}>↩ Try Again</button>
            <button className="btn btn-primary" onClick={reset}>📚 New Passage</button>
          </div>
        </div>
      )}
    </div>
  );
}
