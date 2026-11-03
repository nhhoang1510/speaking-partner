// Furniture and finishes for the 3D school, built from simple shapes plus small textures painted on a
// canvas at load time (no image files to download). Each room is laid out with the corridor towards +z.
import { useMemo } from 'react';
import * as THREE from 'three';

export const hsl = (h, s, l) => `hsl(${h}, ${s}%, ${l}%)`;  // three.js wants the comma form

// ---------------------------------------------------------------- painted textures
const texCache = new Map();
export function paint(key, w, h, draw, repeat) {
  const k = key + ':' + repeat.join('x');
  if (texCache.has(k)) return texCache.get(k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(k, t);
  return t;
}
export const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export function floorTexture(kind, repeat = [2, 2]) {
  return paint(kind, 256, 256, (g, w, h) => {
    const r = rnd(kind.length * 977 + 13);
    if (kind.startsWith('wood')) {                     // planks with grain and staggered joints
      const base = kind === 'wood-light' ? [214, 186, 148] : [176, 128, 86];
      const rows = 8, ph = h / rows;
      for (let y = 0; y < rows; y++) {
        let x = -r() * 120;
        while (x < w) {
          const len = 90 + r() * 80, d = (r() - 0.5) * 26;
          g.fillStyle = `rgb(${base[0] + d},${base[1] + d},${base[2] + d * 0.8})`;
          g.fillRect(x, y * ph, len, ph);
          g.strokeStyle = 'rgba(60,35,15,.12)';
          for (let i = 0; i < 3; i++) { g.beginPath(); const gy = y * ph + 4 + r() * (ph - 8); g.moveTo(x, gy); g.bezierCurveTo(x + len / 3, gy + 2, x + len / 2, gy - 2, x + len, gy); g.stroke(); }
          g.fillStyle = 'rgba(50,30,10,.35)'; g.fillRect(x + len - 1, y * ph, 1.5, ph);
          x += len;
        }
        g.fillStyle = 'rgba(50,30,10,.3)'; g.fillRect(0, y * ph, w, 1.5);
      }
    } else if (kind === 'hall') {                      // corridor: cream and sage tiles set on the diagonal, with a border
      const n = 4, t = w / n;
      g.fillStyle = '#efe6d4'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const d = (r() - 0.5) * 10, cx = x * t + t / 2, cy = y * t + t / 2;
        g.fillStyle = (x + y) % 2 ? `rgb(${236 + d},${228 + d},${210 + d})` : `rgb(${214 + d},${222 + d},${202 + d})`;
        g.fillRect(x * t, y * t, t, t);
        g.fillStyle = (x + y) % 2 ? '#9cb59a' : '#c98f6a';
        g.beginPath(); g.moveTo(cx, cy - t * 0.16); g.lineTo(cx + t * 0.16, cy); g.lineTo(cx, cy + t * 0.16); g.lineTo(cx - t * 0.16, cy); g.fill();
      }
      g.strokeStyle = 'rgba(110,100,85,.4)'; g.lineWidth = 2;
      for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, h); g.moveTo(0, i * t); g.lineTo(w, i * t); g.stroke(); }
    } else if (kind.startsWith('tile')) {              // tiles with grout
      const n = kind === 'tile-big' ? 4 : 8, s = w / n;
      const base = kind === 'tile-blue' ? [222, 236, 240] : kind === 'tile-check' ? null : [236, 233, 226];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const d = (r() - 0.5) * 8;
        const c = base || ((x + y) % 2 ? [236, 230, 218] : [70, 74, 80]);
        g.fillStyle = `rgb(${c[0] + d},${c[1] + d},${c[2] + d})`; g.fillRect(x * s, y * s, s, s);
      }
      g.strokeStyle = 'rgba(120,115,105,.45)'; g.lineWidth = 2;
      for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
    } else {                                           // carpet: fine speckle in the given colour
      const [, hue] = kind.split(':');
      g.fillStyle = `hsl(${hue}, 25%, 62%)`; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) { g.fillStyle = `hsla(${hue}, 25%, ${45 + r() * 35}%, .35)`; g.fillRect(r() * w, r() * h, 2, 2); }
    }
  }, repeat);
}

// ---------------------------------------------------------------- primitives
export function B({ p, s, c, r = 0, cast = true, e, ei = 0.6, map, rough = 0.8, metal = 0, o }) {
  return (
    <mesh position={p} rotation-y={r} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={e || '#000'} emissiveIntensity={e ? ei : 0} map={map} roughness={rough} metalness={metal}
        transparent={o != null} opacity={o == null ? 1 : o} />
    </mesh>
  );
}
export function C({ p, r: rad, r2, h, c, seg = 20, rough = 0.7, metal = 0, rx = 0, rz = 0, e, o }) {
  return (
    <mesh position={p} rotation={[rx, 0, rz]} castShadow receiveShadow>
      <cylinderGeometry args={[rad, r2 == null ? rad : r2, h, seg]} />
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} emissive={e || '#000'} emissiveIntensity={e ? 0.8 : 0}
        transparent={o != null} opacity={o == null ? 1 : o} />
    </mesh>
  );
}
export function S({ p, r: rad, c, sc, e, rough = 0.7 }) {
  return (
    <mesh position={p} scale={sc} castShadow>
      <sphereGeometry args={[rad, 20, 16]} />
      <meshStandardMaterial color={c} emissive={e || '#000'} emissiveIntensity={e ? 0.9 : 0} roughness={rough} />
    </mesh>
  );
}

// ---------------------------------------------------------------- furniture
export function Plant({ p, s = 1, pot = '#c98b5e' }) {
  return (
    <group position={p} scale={s}>
      <C p={[0, 0.25, 0]} r={0.27} r2={0.2} h={0.5} c={pot} />
      <C p={[0, 0.49, 0]} r={0.25} h={0.03} c="#4a3426" />
      <S p={[0, 0.85, 0]} r={0.36} c="#5f9159" />
      <S p={[0.2, 1.1, 0.08]} r={0.24} c="#74a86c" />
      <S p={[-0.18, 1.05, -0.1]} r={0.22} c="#6a9d63" />
    </group>
  );
}
function Stool({ p, c = '#b5764a' }) {
  return <group position={p}><C p={[0, 0.33, 0]} r={0.05} h={0.66} c="#3d3d3d" metal={0.6} rough={0.3} /><C p={[0, 0.02, 0]} r={0.2} h={0.03} c="#3d3d3d" metal={0.6} /><C p={[0, 0.68, 0]} r={0.22} h={0.07} c={c} /></group>;
}
export function Chair({ p, r = 0, c = '#6b7a8f', wheels }) {
  return (
    <group position={p} rotation-y={r}>
      <B p={[0, 0.46, 0]} s={[0.52, 0.09, 0.52]} c={c} />
      <B p={[0, 0.82, -0.24]} s={[0.52, 0.62, 0.08]} c={c} />
      {wheels
        ? <><C p={[0, 0.24, 0]} r={0.04} h={0.42} c="#333" metal={0.5} /><C p={[0, 0.04, 0]} r={0.26} h={0.04} c="#333" /></>
        : [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].map(([x, z]) => <C key={x + ':' + z} p={[x, 0.21, z]} r={0.025} h={0.42} c="#4a3426" />)}
    </group>
  );
}
export function Sofa({ p, r = 0, c, w = 2 }) {
  return (
    <group position={p} rotation-y={r}>
      <B p={[0, 0.22, 0]} s={[w, 0.3, 0.85]} c={c} />
      <B p={[-w / 4, 0.43, 0.04]} s={[w / 2 - 0.04, 0.14, 0.72]} c={c} rough={0.95} />
      <B p={[w / 4, 0.43, 0.04]} s={[w / 2 - 0.04, 0.14, 0.72]} c={c} rough={0.95} />
      <B p={[0, 0.7, -0.33]} s={[w, 0.55, 0.2]} c={c} />
      <B p={[-w / 2 + 0.08, 0.48, 0]} s={[0.16, 0.36, 0.85]} c={c} />
      <B p={[w / 2 - 0.08, 0.48, 0]} s={[0.16, 0.36, 0.85]} c={c} />
      <B p={[-w / 4, 0.62, -0.18]} s={[0.4, 0.32, 0.12]} c="#f3e9d8" rough={1} />
    </group>
  );
}
export function Shelf({ p, r = 0, w = 1.6 }) {
  const books = ['#c0392b', '#27ae60', '#2980b9', '#f39c12', '#8e44ad', '#d35400', '#16a085', '#7f8c8d'];
  const rr = rnd(Math.round(p[0] * 100 + p[2] * 7) + 99);
  return (
    <group position={p} rotation-y={r}>
      <B p={[0, 0.95, 0]} s={[w, 1.9, 0.08]} c="#8a6443" />
      <B p={[-w / 2, 0.95, 0.18]} s={[0.06, 1.9, 0.4]} c="#a77b52" /><B p={[w / 2, 0.95, 0.18]} s={[0.06, 1.9, 0.4]} c="#a77b52" />
      {[0.05, 0.6, 1.15, 1.7].map(y => <B key={y} p={[0, y, 0.18]} s={[w, 0.05, 0.4]} c="#a77b52" />)}
      {[0.08, 0.63, 1.18].map((y, j) => {
        let x = -w / 2 + 0.08; const out = [];
        while (x < w / 2 - 0.15) {
          const bw = 0.06 + rr() * 0.06, bh = 0.32 + rr() * 0.14;
          out.push(<B key={j + ':' + x} p={[x + bw / 2, y + bh / 2, 0.2]} s={[bw, bh, 0.28]} c={books[Math.floor(rr() * books.length)]} cast={false} />);
          x += bw + 0.01;
        }
        return out;
      })}
    </group>
  );
}
export function Frame({ p, w = 0.8, h = 0.6, c = '#7fa6c9', r = 0 }) {     // a picture on the wall
  return (
    <group position={p} rotation-y={r}>
      <B p={[0, 0, 0]} s={[w, h, 0.04]} c="#5a4232" cast={false} />
      <B p={[0, 0, 0.025]} s={[w - 0.1, h - 0.1, 0.01]} c={c} cast={false} />
      <B p={[-w * 0.15, -h * 0.12, 0.032]} s={[w * 0.35, h * 0.3, 0.005]} c="#f3e2b3" cast={false} />
    </group>
  );
}
export function Window({ p, w = 1.8, h = 1.1, r = 0 }) {
  return (
    <group position={p} rotation-y={r}>
      <B p={[0, 0, 0]} s={[w + 0.12, h + 0.12, 0.1]} c="#f7f4ee" cast={false} />
      <B p={[0, 0, 0.03]} s={[w, h, 0.06]} c="#bfe0f2" e="#bfe0f2" ei={0.35} rough={0.1} cast={false} />
      <B p={[0, 0, 0.07]} s={[0.05, h, 0.02]} c="#f7f4ee" cast={false} /><B p={[0, 0, 0.07]} s={[w, 0.05, 0.02]} c="#f7f4ee" cast={false} />
      <B p={[0, -h / 2 - 0.1, 0.1]} s={[w + 0.25, 0.06, 0.22]} c="#ece6db" cast={false} />
    </group>
  );
}
export function Pendant({ p, c = '#2f2f2f' }) {      // a hanging lamp
  return (
    <group position={p}>
      <C p={[0, 0.5, 0]} r={0.01} h={1} c="#333" />
      <C p={[0, 0, 0]} r={0.08} r2={0.3} h={0.25} c={c} />
      <S p={[0, -0.12, 0]} r={0.09} c="#fff6d6" e="#ffe9a8" />
    </group>
  );
}
function Rug({ p, w, d, c, r = 0 }) {
  return <B p={[p[0], 0.035, p[2]]} s={[w, 0.02, d]} c={c} r={r} cast={false} rough={1} />;
}
function Mug({ p, c = '#fff' }) { return <C p={p} r={0.06} h={0.12} c={c} />; }
function Laptop({ p, r = 0 }) {
  return (
    <group position={p} rotation-y={r}>
      <B p={[0, 0.01, 0]} s={[0.42, 0.02, 0.3]} c="#9aa3ab" metal={0.5} rough={0.3} />
      <group position={[0, 0.02, -0.15]} rotation-x={-0.35}><B p={[0, 0.14, 0]} s={[0.42, 0.28, 0.015]} c="#9aa3ab" metal={0.5} rough={0.3} /><B p={[0, 0.14, 0.01]} s={[0.38, 0.24, 0.005]} c="#1d2b3a" e="#3b6ea5" ei={0.5} /></group>
    </group>
  );
}
function Monitor({ p, r = 0 }) {
  return (
    <group position={p} rotation-y={r}>
      <C p={[0, 0.02, 0]} r={0.12} h={0.03} c="#333" /><B p={[0, 0.15, 0]} s={[0.05, 0.26, 0.05]} c="#333" />
      <B p={[0, 0.38, 0]} s={[0.7, 0.42, 0.04]} c="#222" /><B p={[0, 0.38, 0.022]} s={[0.64, 0.36, 0.005]} c="#1d2b3a" e="#4f86c6" ei={0.5} />
    </group>
  );
}
function Stanchion({ p }) { return <group position={p}><C p={[0, 0.45, 0]} r={0.03} h={0.9} c="#c9c9c9" metal={0.8} rough={0.25} /><C p={[0, 0.02, 0]} r={0.15} h={0.03} c="#888" metal={0.6} /></group>; }
function Rope({ a, b, c = '#b03030' }) {
  const mid = [(a[0] + b[0]) / 2, 0.82, (a[1] + b[1]) / 2], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return <B p={mid} s={[len, 0.04, 0.04]} c={c} r={-Math.atan2(b[1] - a[1], b[0] - a[0])} cast={false} />;
}
function Suitcase({ p, c, r = 0, h = 0.7 }) {
  return (
    <group position={p} rotation-y={r}>
      <B p={[0, h / 2 + 0.05, 0]} s={[0.48, h, 0.28]} c={c} rough={0.5} />
      <B p={[0, h + 0.15, 0]} s={[0.22, 0.04, 0.04]} c="#333" />
      {[-0.16, 0.16].map(x => <C key={x} p={[x, 0.04, 0.1]} r={0.04} h={0.04} c="#222" rz={Math.PI / 2} />)}
    </group>
  );
}
function Clothes({ p, n = 6, seed = 1 }) {          // hangers on a rail
  const r = rnd(seed), cols = ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#6d597a', '#b56576', '#457b9d', '#e9c46a'];
  return (
    <group position={p}>
      {Array.from({ length: n }, (_, i) => {
        const z = -0.8 + (1.6 / (n - 1)) * i, h = 0.7 + r() * 0.35;
        return <B key={i} p={[0, 1.7 - h / 2 - 0.08, z]} s={[0.5, h, 0.08]} c={cols[Math.floor(r() * cols.length)]} rough={0.95} />;
      })}
    </group>
  );
}
function Rack({ p, r = 0, seed }) {
  return (
    <group position={p} rotation-y={r}>
      <C p={[0, 0.9, -1]} r={0.03} h={1.8} c="#a8a8a8" metal={0.7} rough={0.3} /><C p={[0, 0.9, 1]} r={0.03} h={1.8} c="#a8a8a8" metal={0.7} rough={0.3} />
      <C p={[0, 1.78, 0]} r={0.025} h={2.1} c="#a8a8a8" metal={0.7} rough={0.3} rx={Math.PI / 2} />
      <C p={[0, 0.02, -1]} r={0.18} h={0.03} c="#888" /><C p={[0, 0.02, 1]} r={0.18} h={0.03} c="#888" />
      <Clothes p={[0, 0, 0]} seed={seed} />
    </group>
  );
}
function Mannequin({ p, r = 0, c }) {
  return (
    <group position={p} rotation-y={r}>
      <C p={[0, 0.03, 0]} r={0.2} h={0.05} c="#333" /><C p={[0, 0.45, 0]} r={0.03} h={0.85} c="#333" />
      <C p={[0, 1.15, 0]} r={0.2} r2={0.16} h={0.6} c={c} rough={0.95} /><S p={[0, 1.58, 0]} r={0.13} c="#e8ded0" />
    </group>
  );
}
function Counter({ p, w, d = 0.75, h = 1, body, top, r = 0 }) {
  return (
    <group position={p} rotation-y={r}>
      <B p={[0, h / 2, 0]} s={[w, h, d]} c={body} />
      <B p={[0, h + 0.03, 0.02]} s={[w + 0.1, 0.06, d + 0.12]} c={top} rough={0.35} />
      <B p={[0, 0.06, d / 2 - 0.02]} s={[w - 0.04, 0.12, 0.04]} c="#2b2b2b" />
    </group>
  );
}
function Desk({ p, w = 2.2, d = 1, c = '#7c5a43', r = 0 }) {
  return (
    <group position={p} rotation-y={r}>
      <B p={[0, 0.74, 0]} s={[w, 0.06, d]} c={c} rough={0.5} />
      <B p={[-w / 2 + 0.05, 0.36, 0]} s={[0.08, 0.72, d - 0.05]} c={c} /><B p={[w / 2 - 0.05, 0.36, 0]} s={[0.08, 0.72, d - 0.05]} c={c} />
      <B p={[0, 0.45, -d / 2 + 0.06]} s={[w - 0.1, 0.5, 0.04]} c={c} />
    </group>
  );
}

// ---------------------------------------------------------------- floors
const FLOORS = { coffee: 'wood', interview: 'carpet', hotel: 'tile-check', airport: 'tile-big', doctor: 'tile-blue', shop: 'wood-light', friend: 'wood', free: 'carpet',
  accounting: 'carpet', finance: 'wood', tax: 'tile', bank: 'tile-big' };
export function RoomFloor({ id, hue, w, d, bright, ...events }) {
  const kind = FLOORS[id] === 'carpet' ? `carpet:${hue}` : FLOORS[id];
  const map = useMemo(() => floorTexture(kind, kind.startsWith('tile-big') ? [2, 2] : kind.startsWith('tile') ? [2.5, 2.5] : [2, 2]), [kind]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow {...events}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={map} color={bright ? hsl(hue, 70, 92) : '#ffffff'} roughness={kind.startsWith('tile') ? 0.4 : 0.85} />
    </mesh>
  );
}

// ---------------------------------------------------------------- the rooms
export function Furniture({ id, hue, north }) {
  const accent = hsl(hue, 55, 50), soft = hsl(hue, 40, 78), deep = hsl(hue, 45, 35);
  const wall = north ? -3.56 : null;                 // things hung on the back wall (north rooms only: south ones face the camera)
  switch (id) {
    case 'coffee': return (
      <group>
        <Counter p={[0, 0, -1.4]} w={3.6} body="#6e4630" top="#efe6d8" />
        {/* espresso machine, grinder, cups, pastry case */}
        <group position={[-1.1, 1.06, -1.55]}>
          <B p={[0, 0.25, 0]} s={[0.7, 0.5, 0.45]} c="#c8ccd0" metal={0.7} rough={0.25} />
          <B p={[0, 0.52, 0]} s={[0.72, 0.04, 0.47]} c="#888" metal={0.7} />
          {[-0.18, 0.18].map(x => <C key={x} p={[x, 0.1, 0.25]} r={0.04} h={0.12} c="#333" />)}
        </group>
        <group position={[-0.3, 1.06, -1.6]}><C p={[0, 0.22, 0]} r={0.12} h={0.44} c="#333" /><C p={[0, 0.5, 0]} r={0.14} r2={0.06} h={0.18} c="#ddd" o={0.6} /></group>
        <group position={[0.9, 1.06, -1.35]}>
          <B p={[0, 0.2, 0]} s={[1.1, 0.4, 0.55]} c="#d8eef5" o={0.35} rough={0.05} />
          {[-0.35, -0.12, 0.12, 0.35].map((x, i) => <S key={x} p={[x, 0.09, 0]} r={0.08} c={['#d4a15a', '#8a5a3b', '#e8c27a', '#c26a4a'][i]} sc={[1.2, 0.6, 1]} />)}
        </group>
        {[0.25, 0.45].map(x => <Mug key={x} p={[x, 1.12, -1.05]} />)}
        {wall != null && <>
          <B p={[0, 2.15, wall]} s={[2.8, 0.95, 0.05]} c="#2b2925" cast={false} />
          {[-0.9, -0.3, 0.3, 0.9].map((x, i) => <B key={x} p={[x, 2.25 - (i % 2) * 0.25, wall + 0.03]} s={[0.45, 0.04, 0.01]} c="#f3efe6" cast={false} />)}
          <B p={[0, 2.5, wall + 0.03]} s={[1.2, 0.08, 0.01]} c={accent} cast={false} />
        </>}
        {[[-2.2, 1.4], [2.2, 1.4], [0, 2.4]].map(([x, z]) => (
          <group key={x + ':' + z}>
            <C p={[x, 0.72, z]} r={0.45} h={0.04} c="#f5efe6" rough={0.3} /><C p={[x, 0.36, z]} r={0.05} h={0.72} c="#333" metal={0.5} />
            <C p={[x, 0.02, z]} r={0.25} h={0.03} c="#333" /><Mug p={[x + 0.12, 0.8, z]} c={accent} />
            <Stool p={[x - 0.7, 0, z]} /><Stool p={[x + 0.7, 0, z]} />
          </group>
        ))}
        <Pendant p={[-1, 2.7, -1.3]} c={deep} /><Pendant p={[1, 2.7, -1.3]} c={deep} />
        <Plant p={[-3, 0, -3.1]} /><Plant p={[3, 0, 2.9]} s={0.8} />
      </group>);
    case 'interview': return (
      <group>
        <Rug p={[0, 0, -0.6]} w={4.4} d={3.4} c={soft} />
        <Desk p={[0, 0, -1.4]} w={2.6} />
        <Monitor p={[0.6, 0.77, -1.65]} /><Laptop p={[-0.5, 0.77, -1.3]} r={0.2} />
        <Mug p={[-1, 0.83, -1.2]} /><B p={[0.1, 0.79, -1.15]} s={[0.3, 0.02, 0.4]} c="#fff" cast={false} />
        <Chair p={[-0.3, 0, -0.35]} r={Math.PI} c={accent} wheels />
        <Chair p={[0.5, 0, -0.35]} r={Math.PI} c={accent} wheels />
        <Shelf p={[-2.6, 0, -3.45]} /><Shelf p={[2.6, 0, -3.45]} />
        {wall != null && <><Frame p={[0, 2, wall]} w={1.4} h={0.9} c="#9cc3a0" /><Frame p={[-1.2, 2.1, wall]} w={0.5} h={0.6} c="#e9b88a" /></>}
        {/* water cooler */}
        <group position={[3, 0, 1.2]}><B p={[0, 0.5, 0]} s={[0.4, 1, 0.4]} c="#eef1f3" /><C p={[0, 1.22, 0]} r={0.16} h={0.45} c="#a9d6ef" /></group>
        <Plant p={[3, 0, 2.6]} s={1.1} /><Plant p={[-3, 0, 2.6]} s={0.9} />
        <Pendant p={[0, 2.7, -1.2]} c="#ddd" />
      </group>);
    case 'hotel': return (
      <group>
        <Rug p={[0, 0, 1.4]} w={3.2} d={2.2} c={deep} />
        <Counter p={[0, 0, -1.4]} w={3.4} h={1.1} body="#f2ead9" top={accent} />
        <B p={[0, 0.55, -1.0]} s={[3.2, 0.5, 0.02]} c="#c7a35a" cast={false} metal={0.6} rough={0.3} />
        <S p={[1.1, 1.2, -1.25]} r={0.1} c="#d4af37" sc={[1, 0.6, 1]} rough={0.2} />
        <Monitor p={[-0.6, 1.16, -1.6]} r={0.15} />
        {wall != null && <>
          <B p={[0, 2.05, wall]} s={[2.4, 1.1, 0.05]} c="#6b4b30" cast={false} />
          {[-0.8, -0.4, 0, 0.4, 0.8].map(x => [1.85, 2.2].map(y => <S key={x + ':' + y} p={[x, y, wall + 0.05]} r={0.05} c="#d4af37" rough={0.2} />))}
          <B p={[0, 2.75, wall + 0.03]} s={[1.6, 0.18, 0.01]} c="#d4af37" cast={false} />
        </>}
        <Sofa p={[-2.4, 0, 1.6]} r={Math.PI / 2} c={soft} />
        <B p={[-1.5, 0.25, 1.6]} s={[0.6, 0.5, 0.6]} c="#7a5a3a" /><Plant p={[-1.5, 0.5, 1.6]} s={0.45} />
        {/* luggage trolley */}
        <group position={[2.3, 0, 1.6]}>
          <B p={[0, 0.12, 0]} s={[0.9, 0.06, 0.6]} c="#c7a35a" metal={0.7} rough={0.3} />
          {[-0.42, 0.42].map(x => <C key={x} p={[x, 0.9, 0]} r={0.025} h={1.6} c="#c7a35a" metal={0.7} rough={0.3} />)}
          <C p={[0, 1.7, 0]} r={0.03} h={0.88} c="#c7a35a" metal={0.7} rz={Math.PI / 2} />
          <Suitcase p={[-0.12, 0.1, 0]} c="#2d6a8a" /><Suitcase p={[0.22, 0.1, 0.05]} c="#8a2d3a" h={0.5} />
        </group>
        <Plant p={[2.9, 0, -3]} s={1.3} /><Plant p={[-2.9, 0, -3]} s={1.3} />
        <Pendant p={[0, 2.8, 0.6]} c="#d4af37" />
      </group>);
    case 'airport': return (
      <group>
        <Counter p={[-0.4, 0, -1.4]} w={2.6} body="#dfe3e8" top={accent} />
        <B p={[-0.4, 1.4, -1.75]} s={[2.4, 0.35, 0.05]} c={deep} cast={false} />
        <Monitor p={[-0.9, 1.06, -1.6]} />
        {/* bag drop belt and scale */}
        <B p={[1.55, 0.2, -1.35]} s={[1.1, 0.4, 0.8]} c="#5b6168" />
        <B p={[1.55, 0.41, -1.35]} s={[1.05, 0.03, 0.75]} c="#202326" />
        {[1.15, 1.35, 1.55, 1.75, 1.95].map(x => <B key={x} p={[x, 0.43, -1.35]} s={[0.02, 0.01, 0.75]} c="#444" cast={false} />)}
        <Suitcase p={[1.5, 0.43, -1.35]} c="#e07a5f" h={0.55} r={0.2} />
        {wall != null && <>
          <B p={[0, 2.2, wall]} s={[3.4, 1.15, 0.06]} c="#0f141a" cast={false} />
          {[0, 1, 2, 3].map(i => <B key={i} p={[-0.2, 2.55 - i * 0.24, wall + 0.04]} s={[2.8, 0.1, 0.01]} c={i % 2 ? '#f3a712' : '#ffd166'} e={i % 2 ? '#f3a712' : '#ffd166'} ei={0.7} cast={false} />)}
        </>}
        {/* queue with stanchions */}
        {[[-1.6, 0.4], [-0.4, 0.4], [0.8, 0.4], [-1.6, 1.4], [-0.4, 1.4], [0.8, 1.4]].map(([x, z]) => <Stanchion key={x + ':' + z} p={[x, 0, z]} />)}
        <Rope a={[-1.6, 0.4]} b={[-0.4, 0.4]} /><Rope a={[-0.4, 0.4]} b={[0.8, 0.4]} /><Rope a={[-1.6, 1.4]} b={[-0.4, 1.4]} /><Rope a={[-0.4, 1.4]} b={[0.8, 1.4]} />
        {/* a row of seats */}
        <group position={[-2.9, 0, 0.8]} rotation-y={Math.PI / 2}>
          <B p={[0, 0.2, 0]} s={[2.4, 0.04, 0.1]} c="#888" metal={0.5} />
          {[-0.8, 0, 0.8].map(x => <group key={x}><B p={[x, 0.45, 0]} s={[0.6, 0.08, 0.5]} c="#3b6ea5" /><B p={[x, 0.75, -0.22]} s={[0.6, 0.55, 0.06]} c="#3b6ea5" /></group>)}
        </group>
        <Suitcase p={[2.6, 0, 2]} c="#2a9d8f" r={-0.4} /><Suitcase p={[2.1, 0, 2.3]} c="#264653" r={0.3} h={0.5} />
        <Plant p={[3, 0, -3.1]} />
      </group>);
    case 'doctor': return (
      <group>
        <Desk p={[0.6, 0, -1.4]} w={2} c="#e9eef1" />
        <Laptop p={[0.9, 0.77, -1.5]} /><B p={[0.2, 0.79, -1.3]} s={[0.25, 0.02, 0.35]} c="#fff" cast={false} />
        <Chair p={[0.6, 0, -0.35]} r={Math.PI} c={soft} />
        {/* examination bed with a curtain */}
        <group position={[-2.3, 0, -1.4]}>
          <B p={[0, 0.5, 0]} s={[0.9, 0.12, 2]} c="#f7f7f7" /><B p={[0, 0.25, 0]} s={[0.8, 0.45, 1.9]} c="#dfe5e9" />
          <B p={[0, 0.62, -0.75]} s={[0.8, 0.12, 0.4]} c="#a8d5e5" rough={0.9} />
          <B p={[0, 0.57, 0.2]} s={[0.84, 0.01, 1.2]} c="#ffffff" cast={false} rough={1} />
        </group>
        <B p={[-1.6, 1.1, 0.1]} s={[0.04, 2, 1.8]} c="#bfe3ef" o={0.85} />
        <C p={[-1.6, 2.1, 0.1]} r={0.02} h={2} c="#aaa" rx={Math.PI / 2} />
        {/* sink and cabinet */}
        <group position={[2.6, 0, -3.25]}><B p={[0, 0.45, 0]} s={[1, 0.9, 0.55]} c="#f1f4f6" /><B p={[0, 0.92, 0]} s={[1.05, 0.05, 0.6]} c="#d7dde1" /><C p={[0, 0.9, 0.05]} r={0.2} h={0.06} c="#bfc8ce" /></group>
        {wall != null && <>
          <B p={[0, 2.25, wall]} s={[0.22, 0.7, 0.04]} c="#d64545" cast={false} /><B p={[0, 2.25, wall]} s={[0.7, 0.22, 0.04]} c="#d64545" cast={false} />
          <Frame p={[1.4, 2, wall]} w={0.6} h={0.8} c="#cfe8f0" /><Frame p={[-1, 2, wall]} w={0.6} h={0.8} c="#f0dccf" />
        </>}
        {/* scale */}
        <group position={[2.8, 0, 1]}><B p={[0, 0.04, 0]} s={[0.45, 0.06, 0.45]} c="#ddd" /><C p={[0, 0.7, -0.2]} r={0.025} h={1.3} c="#aaa" /><B p={[0, 1.35, -0.18]} s={[0.25, 0.15, 0.05]} c="#eee" /></group>
        <Chair p={[-0.6, 0, 2.2]} c="#8fb9c9" /><Chair p={[0.2, 0, 2.2]} c="#8fb9c9" />
        <Plant p={[2.9, 0, 2.6]} s={0.9} />
        <Pendant p={[0.6, 2.7, -1.3]} c="#e8eef1" />
      </group>);
    case 'shop': return (
      <group>
        <Counter p={[1.5, 0, -1.6]} w={1.7} body="#f5efe6" top={accent} />
        {/* cash register */}
        <group position={[1.9, 1.06, -1.6]}><B p={[0, 0.08, 0]} s={[0.4, 0.16, 0.35]} c="#333" /><B p={[0, 0.25, -0.08]} s={[0.35, 0.22, 0.04]} c="#222" e="#6fcf97" ei={0.4} /></group>
        <B p={[1.1, 1.13, -1.5]} s={[0.35, 0.1, 0.28]} c="#e9c46a" />
        <Rack p={[-2.6, 0, 0.5]} seed={3} /><Rack p={[2.7, 0, 1.2]} seed={7} />
        <Mannequin p={[-1, 0, 2.4]} c="#b56576" r={0.4} /><Mannequin p={[0.4, 0, 2.6]} c="#457b9d" r={-0.3} />
        {/* folded shelves */}
        <group position={[-1, 0, -3.3]}>
          <B p={[0, 0.9, 0]} s={[1.8, 1.8, 0.5]} c="#efe6d6" />
          {[0.35, 0.85, 1.35].map(y => [-0.6, -0.2, 0.2, 0.6].map((x, i) => <B key={x + ':' + y} p={[x, y, 0.1]} s={[0.32, 0.18, 0.35]} c={['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f'][(i + Math.round(y * 2)) % 4]} cast={false} />))}
        </group>
        <B p={[0.8, 1.05, -3.5]} s={[0.8, 1.9, 0.05]} c="#cfe9f3" e="#9fd3e6" ei={0.25} rough={0.05} metal={0.3} />
        {wall != null && <B p={[1.6, 2.45, wall]} s={[1.4, 0.4, 0.04]} c={accent} cast={false} />}
        <Pendant p={[-1, 2.7, 0.6]} c={deep} /><Pendant p={[1, 2.7, 0.6]} c={deep} />
      </group>);
    case 'friend': return (
      <group>
        <Rug p={[0, 0, -0.2]} w={3.8} d={2.8} c={soft} />
        <Sofa p={[0, 0, -1.5]} c="#6d9071" w={2.4} />
        <Sofa p={[-2.1, 0, 0]} r={Math.PI / 2} c="#6d9071" />
        <B p={[0, 0.32, -0.2]} s={[1.4, 0.06, 0.8]} c="#a0704a" rough={0.4} />
        {[[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.1], [0.6, 0.1]].map(([x, z]) => <B key={x + ':' + z} p={[x, 0.15, z]} s={[0.06, 0.3, 0.06]} c="#7a5236" />)}
        <Mug p={[0.3, 0.41, -0.2]} /><Mug p={[-0.2, 0.41, -0.1]} c="#e07a5f" />
        <B p={[-0.4, 0.37, -0.3]} s={[0.35, 0.04, 0.25]} c="#3d405b" cast={false} />
        {/* TV on a low cabinet */}
        <group position={[2.6, 0, 0.2]} rotation-y={-Math.PI / 2}>
          <B p={[0, 0.25, 0]} s={[1.8, 0.5, 0.45]} c="#8a6443" />
          <B p={[0, 1.05, -0.05]} s={[1.6, 0.9, 0.06]} c="#111" /><B p={[0, 1.05, -0.015]} s={[1.5, 0.82, 0.01]} c="#1d2b3a" e="#2f5a87" ei={0.4} />
        </group>
        <C p={[-2.8, 0.8, -2.8]} r={0.04} h={1.6} c="#333" /><C p={[-2.8, 1.65, -2.8]} r={0.12} r2={0.28} h={0.3} c="#f3e2b3" e="#ffe6a8" />
        <Shelf p={[1.4, 0, -3.45]} w={1.4} />
        {wall != null && <><Frame p={[-1, 2, wall]} w={0.9} h={0.7} c="#a3c4bc" /><Frame p={[-0.1, 2.15, wall]} w={0.5} h={0.5} c="#e8b4a0" /></>}
        <Plant p={[2.9, 0, -3]} s={1.2} /><Plant p={[-2.9, 0, 2.6]} />
      </group>);
    case 'accounting': return (                         // an open-plan accounts office
      <group>
        <Desk p={[0, 0, -1.4]} w={2.4} c="#d9d4cb" />
        <Monitor p={[-0.45, 0.77, -1.6]} /><Monitor p={[0.45, 0.77, -1.6]} />
        <B p={[0.9, 0.8, -1.2]} s={[0.18, 0.03, 0.24]} c="#333" /><B p={[0.9, 0.82, -1.22]} s={[0.14, 0.01, 0.06]} c="#9fd39a" e="#9fd39a" ei={0.4} cast={false} />
        {[[-0.7, -1.15], [-0.5, -1.12]].map(([x, z]) => <B key={x} p={[x, 0.79 + (x + 0.7) * 0.2, z]} s={[0.3, 0.02, 0.4]} c="#fff" cast={false} />)}
        <Chair p={[0, 0, -0.4]} r={Math.PI} c={accent} wheels />
        {/* two more desks with monitors, back to back */}
        {[-1, 1].map(k => <group key={k} position={[k * 2.2, 0, 1]} rotation-y={k * Math.PI / 2}>
          <Desk p={[0, 0, 0]} w={1.6} d={0.8} c="#d9d4cb" /><Monitor p={[0, 0.77, -0.15]} />
          <Chair p={[0, 0, 0.75]} r={Math.PI} c={deep} wheels /><Mug p={[0.55, 0.83, 0.1]} c={accent} />
        </group>)}
        {/* filing cabinets and a printer */}
        {[-2.95, -2.45].map(x => <group key={x} position={[x, 0, -3.3]}>
          <B p={[0, 0.65, 0]} s={[0.46, 1.3, 0.55]} c="#8d969e" metal={0.4} rough={0.4} />
          {[0.3, 0.7, 1.1].map(y => <B key={y} p={[0, y, 0.28]} s={[0.2, 0.04, 0.02]} c="#ddd" cast={false} />)}
        </group>)}
        <group position={[2.8, 0, -3.2]}><B p={[0, 0.4, 0]} s={[0.7, 0.8, 0.6]} c="#e6e8ea" /><B p={[0, 0.9, 0]} s={[0.6, 0.2, 0.5]} c="#cfd3d6" /><B p={[0, 0.82, 0.32]} s={[0.4, 0.02, 0.15]} c="#fff" /></group>
        {wall != null && <group position={[0, 1.9, wall]}>
          <B p={[0, 0, 0]} s={[1.6, 1.1, 0.04]} c="#f9f9f9" cast={false} />
          {[0.35, 0.6, 0.2, 0.8, 0.5].map((h, i) => <B key={i} p={[-0.56 + i * 0.28, -0.42 + h / 2, 0.03]} s={[0.16, h, 0.01]} c={i % 2 ? accent : deep} cast={false} />)}
          <B p={[0, 0.45, 0.03]} s={[1, 0.06, 0.01]} c="#333" cast={false} />
        </group>}
        <Plant p={[-3, 0, 2.8]} /><Pendant p={[0, 2.7, -1.2]} c="#eee" />
      </group>);
    case 'finance': return (                            // a financial adviser's office with market screens
      <group>
        <Rug p={[0, 0, -0.4]} w={4} d={3} c={soft} />
        <Desk p={[0, 0, -1.4]} w={2.6} c="#4a3426" />
        <Monitor p={[-0.4, 0.77, -1.65]} r={0.15} /><Monitor p={[0.4, 0.77, -1.65]} r={-0.15} />
        <Laptop p={[0.9, 0.77, -1.2]} r={-0.3} /><Mug p={[-1, 0.83, -1.2]} />
        <Chair p={[-0.4, 0, -0.35]} r={Math.PI} c="#2f2f2f" /><Chair p={[0.4, 0, -0.35]} r={Math.PI} c="#2f2f2f" />
        {wall != null && <group position={[0, 2, wall]}>
          {[-0.58, 0, 0.58].map((x, i) => <group key={x} position={[x, 0, 0]} scale={[0.55, 1, 1]}>
            <B p={[0, 0, 0]} s={[1, 0.62, 0.05]} c="#111" cast={false} />
            {Array.from({ length: 8 }, (_, k) => {
              const y = Math.sin(k * 1.3 + i * 2) * 0.12 + (i === 1 ? k * 0.02 : -k * 0.01);
              return <B key={k} p={[-0.38 + k * 0.11, y, 0.03]} s={[0.07, 0.04 + Math.abs(Math.cos(k + i)) * 0.12, 0.01]} c={(k + i) % 3 ? '#2ecc71' : '#e74c3c'} e={(k + i) % 3 ? '#2ecc71' : '#e74c3c'} ei={0.8} cast={false} />;
            })}
          </group>)}
          <B p={[0, -0.48, 0.03]} s={[1.7, 0.12, 0.01]} c="#0f141a" cast={false} />
          <B p={[0, -0.48, 0.04]} s={[1.55, 0.05, 0.005]} c="#f3a712" e="#f3a712" ei={0.8} cast={false} />
        </group>}
        {/* a small meeting table */}
        <group position={[2.1, 0, 1.6]}>
          <C p={[0, 0.72, 0]} r={0.6} h={0.05} c="#4a3426" rough={0.4} /><C p={[0, 0.36, 0]} r={0.06} h={0.72} c="#333" />
          {[0, 2.1, 4.2].map(a => <Chair key={a} p={[Math.sin(a) * 0.95, 0, Math.cos(a) * 0.95]} r={a + Math.PI} c={accent} />)}
        </group>
        <Shelf p={[-2.6, 0, -3.45]} w={1.4} />
        <group position={[-2.7, 0, 1.8]}><C p={[0, 0.5, 0]} r={0.05} h={1} c="#4a3426" /><S p={[0, 1.2, 0]} r={0.25} c="#3b7dbf" /><S p={[0.08, 1.25, 0.18]} r={0.1} c="#5fae6f" sc={[1, 0.6, 0.4]} /></group>
        <Plant p={[3, 0, -3.1]} s={1.2} /><Pendant p={[0, 2.7, -1.2]} c={deep} />
      </group>);
    case 'tax': return (                                // a tax office: service windows, a ticket screen, forms
      <group>
        <Counter p={[0, 0, -1.4]} w={4.6} h={1.05} body="#e9e4da" top="#b8b2a6" />
        {[-1.55, 0, 1.55].map((x, i) => <group key={x}>
          <B p={[x, 1.55, -1.45]} s={[1.3, 0.9, 0.03]} c="#cfe8f2" o={0.35} rough={0.05} cast={false} />
          <B p={[x, 2.08, -1.45]} s={[1.3, 0.16, 0.06]} c={deep} />
          <B p={[x, 2.08, -1.41]} s={[0.25, 0.1, 0.01]} c="#fff" cast={false} />
          {i !== 1 && <B p={[x, 1.1, -1.25]} s={[0.3, 0.02, 0.4]} c="#fff" cast={false} />}
        </group>)}
        <Monitor p={[-1.55, 1.08, -1.75]} /><Monitor p={[1.55, 1.08, -1.75]} />
        {wall != null && <group position={[0, 2.45, wall]}>
          <B p={[0, 0, 0]} s={[1.6, 0.42, 0.06]} c="#111" cast={false} />
          {[-0.45, -0.15, 0.15, 0.45].map(x => <B key={x} p={[x, 0, 0.04]} s={[0.2, 0.26, 0.01]} c="#ff3b30" e="#ff3b30" ei={1} cast={false} />)}
        </group>}
        {/* ticket machine, forms stand and rows of waiting seats */}
        <group position={[2.8, 0, 1.4]}><B p={[0, 0.65, 0]} s={[0.45, 1.3, 0.35]} c={accent} /><B p={[0, 1.05, 0.18]} s={[0.3, 0.22, 0.01]} c="#1d2b3a" e="#4f86c6" ei={0.5} cast={false} /></group>
        <group position={[-2.9, 0, 1.2]}><B p={[0, 0.6, 0]} s={[0.5, 1.2, 0.3]} c="#a77b52" />{[0.4, 0.75, 1.05].map(y => <B key={y} p={[0, y, 0.16]} s={[0.4, 0.25, 0.02]} c="#fffaf0" cast={false} />)}</group>
        {[0.8, 2].map(z => <group key={z} position={[0, 0, z]}>
          <B p={[0, 0.2, 0]} s={[3, 0.04, 0.1]} c="#888" metal={0.5} />
          {[-1, 0, 1].map(x => <group key={x}><B p={[x, 0.45, 0]} s={[0.6, 0.08, 0.5]} c={soft} /><B p={[x, 0.75, 0.22]} s={[0.6, 0.55, 0.06]} c={soft} /></group>)}
        </group>)}
        <Plant p={[-3, 0, -3.1]} /><Plant p={[3, 0, -3.1]} />
      </group>);
    case 'bank': return (                               // a bank branch: teller counter, ATM, vault
      <group>
        <Counter p={[0, 0, -1.4]} w={3.6} h={1.1} body="#3e4a5a" top="#d9d1c0" />
        {[-0.9, 0.9].map(x => <B key={x} p={[x, 1.6, -1.45]} s={[1.6, 0.9, 0.03]} c="#cfe8f2" o={0.3} rough={0.05} cast={false} />)}
        <Monitor p={[-0.9, 1.13, -1.7]} /><Monitor p={[0.9, 1.13, -1.7]} />
        <B p={[0, 1.16, -1.2]} s={[0.4, 0.02, 0.25]} c="#c9b07a" metal={0.6} rough={0.3} cast={false} />
        {wall != null && <group position={[0, 1.7, wall]}>
          <C p={[0, 0, 0.05]} r={0.85} h={0.12} rx={Math.PI / 2} c="#9aa3ab" metal={0.8} rough={0.25} seg={32} />
          <C p={[0, 0, 0.13]} r={0.25} h={0.06} rx={Math.PI / 2} c="#6b737b" metal={0.8} rough={0.25} />
          {[0, 1, 2, 3, 4, 5].map(k => <B key={k} p={[Math.cos(k) * 0.32, Math.sin(k) * 0.32, 0.14]} s={[0.24, 0.04, 0.04]} r={0} c="#c9b07a" metal={0.7} cast={false} />)}
        </group>}
        <group position={[2.85, 0, 0.3]} rotation-y={-Math.PI / 2}>
          <B p={[0, 0.85, 0]} s={[0.8, 1.7, 0.6]} c="#2d3e50" />
          <B p={[0, 1.25, 0.31]} s={[0.45, 0.32, 0.01]} c="#1d2b3a" e="#4fc3a1" ei={0.6} cast={false} />
          <B p={[0, 0.95, 0.33]} s={[0.4, 0.16, 0.05]} c="#bfc6cc" />
          <B p={[0, 1.6, 0.31]} s={[0.7, 0.14, 0.01]} c={accent} e={accent} ei={0.4} cast={false} />
        </group>
        <Sofa p={[-2.4, 0, 1.4]} r={Math.PI / 2} c={soft} />
        <B p={[-1.5, 0.22, 1.4]} s={[0.5, 0.44, 0.5]} c="#d9d1c0" />
        <Plant p={[3, 0, -3.1]} s={1.2} /><Plant p={[-3, 0, -3.1]} s={1.2} /><Pendant p={[0, 2.7, -1.2]} c="#c9b07a" />
      </group>);
    default: return (                                   // free talk: a relaxed corner
      <group>
        <B p={[0, 1.35, -3.5]} s={[3.2, 1.6, 0.06]} c="#ffffff" rough={0.2} />
        <B p={[0, 0.52, -3.4]} s={[3.2, 0.06, 0.18]} c="#bbb" />
        <B p={[-0.8, 1.6, -3.46]} s={[1.1, 0.05, 0.01]} c={accent} cast={false} /><B p={[0.2, 1.3, -3.46]} s={[1.6, 0.05, 0.01]} c="#3b6ea5" cast={false} />
        <B p={[0.9, 1.75, -3.46]} s={[0.4, 0.3, 0.01]} c="#ffd166" cast={false} /><B p={[-1.2, 1.15, -3.46]} s={[0.35, 0.3, 0.01]} c="#9be3c4" cast={false} />
        <Rug p={[0, 0, 1]} w={4} d={3} c={soft} />
        {[[-1.6, 0.4, '#f3a712'], [1.6, 0.6, '#00a5cf'], [-1.2, 2, '#f15bb5'], [1.4, 2.2, '#29bf12'], [0.1, 2.8, '#9b5de5']].map(([x, z, c]) => (
          <S key={x + ':' + z} p={[x, 0.3, z]} r={0.55} c={c} sc={[1, 0.6, 1]} rough={1} />
        ))}
        <C p={[0, 0.2, 1.3]} r={0.45} h={0.4} c="#c98b5e" /><Mug p={[0.1, 0.46, 1.3]} />
        <Shelf p={[2.6, 0, -3.45]} w={1.2} /><Shelf p={[-2.7, 0, -3.45]} w={1} />
        <Plant p={[-3, 0, 2.8]} s={1.2} /><Plant p={[3, 0, 2.8]} />
        <Pendant p={[0, 2.7, 1]} c={deep} />
      </group>);
  }
}

// ---------------------------------------------------------------- the corridor
export function CorridorDecor({ x0, x1, hall }) {
  const lockers = [];
  for (let x = x0 + 1.2; x < x1 - 1; x += 7) {
    // lockers against the north corridor wall, between the doors
    for (let k = 0; k < 3; k++) lockers.push(
      <group key={x + ':' + k} position={[x + k * 0.5, 0, -hall + 0.25]}>
        <B p={[0, 0.85, 0]} s={[0.46, 1.7, 0.4]} c={['#5b8def', '#4a7bd8', '#6a99f0'][k]} metal={0.4} rough={0.4} />
        <B p={[0.15, 1.1, 0.205]} s={[0.04, 0.12, 0.01]} c="#ddd" cast={false} />
        {[1.5, 1.45, 1.4].map(y => <B key={y} p={[0, y, 0.205]} s={[0.3, 0.015, 0.01]} c="#2d4f9b" cast={false} />)}
      </group>
    );
  }
  return (
    <group>
      {lockers}
      {Array.from({ length: Math.round((x1 - x0) / 7) - 1 }, (_, k) => x0 + 7 + k * 7).map(x => (
        <group key={x} position={[x, 0, hall - 0.35]}>
          <B p={[0, 0.42, 0]} s={[1.6, 0.06, 0.4]} c="#a0704a" />
          {[-0.7, 0.7].map(dx => <B key={dx} p={[dx, 0.2, 0]} s={[0.06, 0.4, 0.36]} c="#555" />)}
        </group>
      ))}
      <group position={[x0 + 12.8, 1.6, -hall + 0.12]}>
        <B p={[0, 0, 0]} s={[1.4, 0.9, 0.04]} c="#b5835a" cast={false} />
        {[[-0.35, 0.15, '#ffd166'], [0.2, 0.2, '#9be3c4'], [-0.15, -0.2, '#f4a6a0'], [0.4, -0.15, '#cfe3ff']].map(([x, y, c]) => <B key={x} p={[x, y, 0.03]} s={[0.36, 0.3, 0.01]} c={c} cast={false} />)}
      </group>
      {Array.from({ length: Math.round((x1 - x0) / 7) }, (_, k) => x0 + 3.5 + k * 7).map(x => <Pendant key={x} p={[x, 2.6, 0]} c="#e9e2d6" />)}
    </group>
  );
}
