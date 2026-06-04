'use client';

import { useState } from 'react';

/* ── Direction toggle ── */
const MODES = [
  { key: 'en-vn', label: 'EN → VN', desc: 'Search English words' },
  { key: 'vn-en', label: 'VN → EN', desc: 'Tìm từ tiếng Việt' },
];

/* ── CEFR level badge ── */
const CEFR_COLORS = {
  A1: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)', text: '#6ee7b7' },
  A2: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)', text: '#6ee7b7' },
  B1: { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.35)', text: '#a5b4fc' },
  B2: { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.35)', text: '#a5b4fc' },
  C1: { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.35)', text: '#c4b5fd' },
  C2: { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.35)', text: '#c4b5fd' },
};
function CefrBadge({ level }) {
  const c = CEFR_COLORS[level] || CEFR_COLORS.B1;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em',
      padding: '0.28rem 0.75rem', borderRadius: '99px',
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {level}
    </span>
  );
}

/* ── English → Vietnamese (Gemini) ── */
async function fetchEnglish(word) {
  const res = await fetch('/api/vocab-en', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word: word.trim() }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/* ── Vietnamese → English (Gemini) ── */
async function fetchVietnamese(word) {
  const res = await fetch('/api/vocab-vn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word: word.trim() }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export default function VocabularyPage() {
  const [mode, setMode]       = useState('en-vn');
  const [query, setQuery]     = useState('');
  const [wordData, setWordData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const currentMode = MODES.find(m => m.key === mode);

  const switchMode = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setQuery('');
    setWordData(null);
    setError('');
  };

  const searchWord = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(''); setWordData(null);
    try {
      const data = mode === 'en-vn'
        ? await fetchEnglish(query)
        : await fetchVietnamese(query);
      setWordData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const searchSynonym = async (word) => {
    setQuery(word);
    setLoading(true); setError(''); setWordData(null);
    try {
      const data = mode === 'en-vn'
        ? await fetchEnglish(word)
        : await fetchVietnamese(word);
      setWordData(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAudioUrl = () => {
    if (mode !== 'en-vn' || !wordData?.phonetics) return null;
    return wordData.phonetics.find(p => p.audio)?.audio || null;
  };
  const playAudio = (url) => url && new Audio(url).play();
  const audioUrl = getAudioUrl();

  return (
    <div>
      <div className="page-header fade-up">
        <h1 className="page-title">
          Vocabulary <span className="gradient-text">Explorer</span>
        </h1>
        <p className="page-sub">
          {currentMode.desc} — definitions, phonetics, and examples.
        </p>
      </div>

      {/* ── Direction Toggle ── */}
      <div className="vocab-mode-toggle fade-up d1">
        {MODES.map(m => (
          <button
            key={m.key}
            className={`vocab-mode-btn ${mode === m.key ? 'active' : ''}`}
            onClick={() => switchMode(m.key)}
            id={`vocab-mode-${m.key}`}
          >
              <span className="vocab-mode-label">{m.label}</span>
          </button>
        ))}
        <div
          className="vocab-mode-slider"
          style={{ transform: mode === 'en-vn' ? 'translateX(0)' : 'translateX(100%)' }}
        />
      </div>

      {/* ── Search ── */}
      <form onSubmit={searchWord} className="search-wrap fade-up d2">
        <input
          id="vocab-search"
          type="text"
          className="search-input"
          placeholder={
            mode === 'en-vn'
              ? 'Try: ephemeral, resilient, paradigm…'
              : 'Thử: phát triển, kiên nhẫn, bình tĩnh…'
          }
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={loading} id="vocab-search-btn">
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {loading && <div className="spinner" />}
      {error && <div className="alert alert-error fade-up">{error}</div>}

      {/* ── EN → VN result ── */}
      {wordData && mode === 'en-vn' && (
        <div className="word-result fade-up">
          <div className="word-top">
            <div>
              <div className="word-name">{wordData.word}</div>
              {wordData.phonetic && <div className="word-phonetic">{wordData.phonetic}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {wordData.cefr && <CefrBadge level={wordData.cefr} />}
              {audioUrl && (
                <button className="play-btn" onClick={() => playAudio(audioUrl)} title="Listen">
                  🔊
                </button>
              )}
            </div>
          </div>

          {wordData.meanings?.map((m, i) => (
            <div key={i} className="meaning-block">
              <div className="pos-tag">{m.partOfSpeech}</div>
              <ul className="def-list">
                {m.definitions?.slice(0, 4).map((d, j) => (
                  <li key={j} className="def-item">
                    {/* Vietnamese meaning — prominent */}
                    {d.vietnamese && (
                      <div className="def-vn-main">{d.vietnamese}</div>
                    )}
                    {/* English definition — secondary */}
                    <div className="def-en-sub">{d.english || d.definition}</div>
                    {/* Bilingual examples */}
                    {(d.example_en || d.example) && (
                      <div className="vn-example-block" style={{ marginTop: '0.5rem' }}>
                        <span className="def-example en-ex">"{d.example_en || d.example}"</span>
                        {d.example_vn && (
                          <span className="def-example vn-ex">"{d.example_vn}"</span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {m.synonyms?.length > 0 && (
                <div className="synonym-row">
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginRight: '0.35rem' }}>Synonyms:</span>
                  {m.synonyms.slice(0, 6).map(s => (
                    <button key={s} className="synonym-chip" onClick={() => searchSynonym(s)} title={`Look up "${s}"`}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── VN → EN result ── */}
      {wordData && mode === 'vn-en' && (
        <div className="word-result fade-up">
          <div className="word-top">
            <div>
              <div className="word-name vn-word">{wordData.word}</div>
              {wordData.pronunciation && (
                <div className="word-phonetic">{wordData.pronunciation}</div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {wordData.cefr && <CefrBadge level={wordData.cefr} />}
              <div className="vn-badge">Vietnamese</div>
            </div>
          </div>

          {wordData.meanings?.map((m, i) => (
            <div key={i} className="meaning-block">
              <div className="pos-tag">{m.partOfSpeech}</div>
              <ul className="def-list">
                {m.definitions?.map((d, j) => (
                  <li key={j} className="def-item">
                    <span className="vn-en-meaning">{d.english}</span>
                    {d.example_vn && (
                      <div className="vn-example-block">
                        <span className="def-example vn-ex">"{d.example_vn}"</span>
                        <span className="def-example en-ex">"{d.example_en}"</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {m.synonyms_vn?.length > 0 && (
                <div className="synonym-row">
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginRight: '0.35rem' }}>Từ đồng nghĩa:</span>
                  {m.synonyms_vn.map(s => (
                    <button key={s} className="synonym-chip" onClick={() => searchSynonym(s)} title={`Tra từ "${s}"`}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {wordData.notes && (
            <div className="vn-notes">
              <span className="vn-notes-icon">💡</span> {wordData.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
