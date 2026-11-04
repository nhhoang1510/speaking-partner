// A little map while walking: the town's blocks, the practice buildings in their colours, the river and
// Pudong with its landmarks, and me as an arrow pointing where I look, with the name of where I am. Tap a
// practice building, or a landmark, to be taken there.
import { useEffect, useRef } from 'react';
import { CELLS, BLK, P, EDGE_X, EDGE_Z, FAR } from './world/city.jsx';
import { layout } from './world/shanghai.jsx';
import { SCENES } from './scenes.js';

const SCENE = Object.fromEntries(SCENES.map(s => [s.id, s]));
const GROUND = {
  park: '#9fcf86', pitch: '#7fbf6a', houses: '#e9d9bf', shops: '#f0c9a8', market: '#f2d58c', offices: '#c9d3de', flats: '#d7d0c4',
  tower: '#aebccb', hospital: '#f4f4f4', mall: '#e4c9e8', station: '#e6c39a', school: '#f3e3a3', parking: '#c4c7cb', fuel: '#f2b8a8',
  lake: '#8fc7d9', garden: '#b9dd8f', playground: '#f3b38a', courts: '#8fb0d6', plaza: '#e8dcc4', metro: '#e98a8a',
  bund: '#e6d6a8', nanjing: '#f29b8a', yuyuan: '#c9a77a', shikumen: '#b9b2a6',
};
const NAMES = {
  houses: 'Khu nhà dân', shops: 'Dãy cửa hàng', offices: 'Khu văn phòng', flats: 'Chung cư', tower: 'Cao ốc', park: 'Công viên',
  pitch: 'Sân bóng đá', market: 'Chợ phiên', hospital: 'Bệnh viện', mall: 'Trung tâm thương mại', station: 'Ga trung tâm',
  school: 'Trường THPT Nguyễn Thái Học', parking: 'Bãi đỗ xe', fuel: 'Cây xăng', lake: 'Công viên hồ', garden: 'Vườn hoa',
  playground: 'Sân chơi trẻ em', courts: 'Sân bóng rổ', plaza: 'Quảng trường', metro: 'Ga tàu điện ngầm', bund: 'Bến Thượng Hải',
  nanjing: 'Phố đi bộ Nam Kinh', yuyuan: 'Dự Viên', shikumen: 'Ngõ Thạch Khố Môn',
};
const L = layout(EDGE_X, EDGE_Z, FAR);
// landmarks to jump to (standing on Pudong's roads, clear of its buildings): where to stand and which way to look (yaw 0 = north, -π/2 = east)
const SPOTS = [
  { name: 'Bến Thượng Hải', x: L.west - 4, z: -8, yaw: -Math.PI / 2, at: [L.west - 4, -8] },
  { name: 'Tháp Minh Châu', x: L.rx + 41, z: -28, yaw: 0.7, at: L.pearl },
  { name: 'Thượng Hải Tower', x: L.rx + 46, z: 0, yaw: -0.75, at: L.tower },
  { name: 'Cầu Phố Đông', x: L.west - 4, z: 16, yaw: -0.85, at: [L.rx, 0] },
];
const M = 6, X0 = -EDGE_X - M, X1 = L.east + 72, Z0 = -EDGE_Z - M, Z1 = EDGE_Z + M;

// the name of the place at (x, z)
function whereIs(x, z) {
  if (x > L.east) return 'Phố Đông (Lujiazui)';
  if (x > L.west) return Math.abs(z) < 5 ? 'Cầu Phố Đông' : 'Sông Hoàng Phố';
  if (x > EDGE_X + 3.5) return 'Bến Thượng Hải';
  if (Math.abs(x) > EDGE_X + 3.5 || Math.abs(z) > EDGE_Z + 3.5) return 'Ngoại ô';
  const cell = CELLS.find(c => Math.abs(x - c.x) < P / 2 && Math.abs(z - c.z) < P / 2);
  if (!cell) return 'Trên phố';
  const near = Math.abs(x - cell.x) < BLK / 2 && Math.abs(z - cell.z) < BLK / 2;
  const name = SCENE[cell.id] ? SCENE[cell.id].title : NAMES[cell.id] || 'Trên phố';
  return near ? name : `Phố gần ${name}`;
}

// track: the walking state from the 3D view ({ pos, yaw }), read every frame; onGo(sceneId | {x, z, yaw})
export default function MiniMap({ track, onGo }) {
  const me = useRef(), here = useRef();
  useEffect(() => {
    let raf, last = 0;
    const tick = t => {
      const p = track.current;
      if (p && me.current) {
        me.current.setAttribute('transform', `translate(${Math.min(X1, p.pos.x)} ${p.pos.z}) rotate(${(-p.yaw * 180) / Math.PI})`);
        if (here.current && t - last > 300) { last = t; here.current.textContent = whereIs(p.pos.x, p.pos.z); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [track]);
  const half = BLK / 2;
  return (
    <nav className="minimap glass" aria-label="Bản đồ — bấm vào một phòng hoặc địa danh để tới đó">
      <div className="mm-here">Bạn đang ở: <b ref={here}>…</b></div>
      <svg viewBox={`${X0} ${Z0} ${X1 - X0} ${Z1 - Z0}`}>
        <rect x={X0} y={Z0} width={X1 - X0} height={Z1 - Z0} rx="6" fill="#8d9298" />
        <rect x={EDGE_X + 3.5} y={Z0} width={L.west - EDGE_X - 3.5} height={Z1 - Z0} fill="#ddd2bc" />
        <rect x={L.west} y={Z0} width={L.rw} height={Z1 - Z0} fill="#5aa0c8" />
        <rect x={L.east} y={Z0} width={X1 - L.east} height={Z1 - Z0} fill="#c9c6bf" />
        <rect x={L.west - 1} y={-4.5} width={L.rw + 2} height={9} fill="#7b8086" />
        {CELLS.map(c => {
          const sc = SCENE[c.id];
          return sc
            ? <g key={c.id} className="mm-room" onClick={() => onGo(c.id)} role="button" aria-label={`Tới ${sc.title}`}>
                <title>{`${sc.title} — ${sc.vi}`}</title>
                <rect x={c.x - half} y={c.z - half} width={BLK} height={BLK} rx="1.5" fill={`hsl(${sc.hue} 55% 52%)`} />
                <text x={c.x} y={c.z + 3.4} textAnchor="middle">{sc.title[0]}</text>
              </g>
            : <rect key={c.r + ':' + c.c} x={c.x - half} y={c.z - half} width={BLK} height={BLK} rx="1.5" fill={GROUND[c.id] || '#ddd'}><title>{NAMES[c.id]}</title></rect>;
        })}
        {[[L.pearl, '#e0569a', 6], [L.tower, '#6f9cbc', 7], [L.jinmao, '#8b98a3', 5], [L.swfc, '#a3bed2', 6]].map(([[x, z], c, r]) => <circle key={x + ':' + z} cx={x} cy={z} r={r} fill={c} />)}
        {SPOTS.map(s => (
          <g key={s.name} className="mm-spot" onClick={() => onGo({ x: s.x, z: s.z, yaw: s.yaw })} role="button" aria-label={`Tới ${s.name}`}>
            <title>{s.name}</title>
            <circle cx={s.at[0]} cy={s.at[1]} r="4.5" />
          </g>
        ))}
        <g ref={me} className="mm-me">
          <circle r="5.5" />
          <path d="M0 -9 L5 3 L0 0.5 L-5 3 Z" />
        </g>
      </svg>
      <div className="mm-go">
        {SPOTS.map(s => <button key={s.name} onClick={() => onGo({ x: s.x, z: s.z, yaw: s.yaw })}>{s.name}</button>)}
      </div>
    </nav>
  );
}
