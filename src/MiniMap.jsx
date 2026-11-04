// A little map of the town while walking: the blocks, the practice buildings in their colours, and me as an
// arrow pointing where I look. Tap a practice building to be taken to its door.
import { useEffect, useRef } from 'react';
import { CELLS, BLK, EDGE_X, EDGE_Z } from './world/city.jsx';
import { SCENES } from './scenes.js';

const SCENE = Object.fromEntries(SCENES.map(s => [s.id, s]));
const GROUND = {
  park: '#9fcf86', pitch: '#7fbf6a', houses: '#e9d9bf', shops: '#f0c9a8', market: '#f2d58c', offices: '#c9d3de', flats: '#d7d0c4',
  tower: '#aebccb', hospital: '#f4f4f4', mall: '#e4c9e8', station: '#e6c39a', school: '#f3e3a3', parking: '#c4c7cb', fuel: '#f2b8a8',
};
const M = 6;    // margin round the outer streets

// track: the walking state from the 3D view ({ pos, yaw }), read every frame; onGo(sceneId) to jump there
export default function MiniMap({ track, onGo }) {
  const me = useRef();
  useEffect(() => {
    let raf;
    const tick = () => {
      const p = track.current;
      if (p && me.current) me.current.setAttribute('transform', `translate(${p.pos.x} ${p.pos.z}) rotate(${(-p.yaw * 180) / Math.PI})`);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [track]);
  const w = 2 * (EDGE_X + M), h = 2 * (EDGE_Z + M), half = BLK / 2;
  return (
    <nav className="minimap glass" aria-label="Bản đồ — bấm vào một phòng để tới đó">
      <svg viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="6" fill="#8d9298" />
        {CELLS.map(L => {
          const sc = SCENE[L.id];
          return sc
            ? <g key={L.id} className="mm-room" onClick={() => onGo(L.id)} role="button" aria-label={`Tới ${sc.title}`}>
                <title>{`${sc.title} — ${sc.vi}`}</title>
                <rect x={L.x - half} y={L.z - half} width={BLK} height={BLK} rx="1.5" fill={`hsl(${sc.hue} 55% 52%)`} />
                <text x={L.x} y={L.z + 3.4} textAnchor="middle">{sc.title[0]}</text>
              </g>
            : <rect key={L.id + L.x + L.z} x={L.x - half} y={L.z - half} width={BLK} height={BLK} rx="1.5" fill={GROUND[L.id] || '#ddd'} />;
        })}
        <g ref={me} className="mm-me">
          <circle r="5.5" />
          <path d="M0 -9 L5 3 L0 0.5 L-5 3 Z" />
        </g>
      </svg>
      <small>Bấm vào ô màu để tới phòng đó</small>
    </nav>
  );
}
