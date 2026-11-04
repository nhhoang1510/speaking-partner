// What can stand on a town block (other than the practice buildings): every kind is one entry in KINDS, with
// how to draw it and where it is solid (for walking). To grow the town, add a kind here and put its name in the
// city map (LAYOUT in city.jsx). Each block gets a seed from its place, so repeated kinds (houses, shops,
// flats...) all look a little different. Blocks are drawn around their centre; the usable lot is |x|, |z| < LOT,
// with the street side at +z.
import { useContext, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { B, C, S, paint, rnd } from './props.jsx';
import { Many, Tree, Car, Bench } from './scenery.jsx';
import { Night } from './time.js';

export const LOT = 4.9;

// ---------------------------------------------------------------- painted textures and the basic box
export function signTexture(text, bg, fg = '#ffffff') {
  return paint('sign:' + text + bg + fg, 512, 80, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, w, 6); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h - 6, w, 6);
    let size = 52; g.font = `800 ${size}px system-ui, sans-serif`;
    while (g.measureText(text).width > w - 40 && size > 16) { size -= 2; g.font = `800 ${size}px system-ui, sans-serif`; }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  }, [1, 1]);
}
export function stripes(a, b) {
  return paint('stripe:' + a + b, 64, 8, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 8, 0, 8, h); } }, [6, 1]);
}
// a building with windows on its four sides and a plain roof, made only of plain boxes so the whole town's
// buildings bake into a handful of meshes: a glass core, a wall band at every floor, and (unless the
// windows run in strips) pilasters between the windows; at night some windows are lit
export function Block({ p, s, wall, glass = '#7fb2d6', strip, roof = '#9aa0a6' }) {
  const [w, h, d] = s;
  const night = useContext(Night);
  const floors = Math.max(1, Math.round(h / 1.6)), fh = h / floors;
  const nw = Math.max(1, Math.round(w / 1.8)), nd = Math.max(1, Math.round(d / 1.8));
  const lit = useMemo(() => {
    if (!night) return [];
    const r = rnd(Math.round(w * 13 + h * 7 + d * 3 + Math.abs(p[0]) * 5 + Math.abs(p[2]) * 3) + 1), out = [];
    for (let f = 0; f < floors; f++) for (let face = 0; face < 4; face++) if (r() < 0.45) out.push([f, face]);
    return out;
  }, [night, w, h, d, floors]);
  const band = strip ? 0.7 : 0.45;
  return (
    <group position={p}>
      <B p={[0, h / 2, 0]} s={[w - 0.12, h, d - 0.12]} c={glass} rough={0.2} metal={0.3} />
      {Array.from({ length: floors + 1 }, (_, f) => <B key={'f' + f} p={[0, Math.max(band / 2, f * fh), 0]} s={[w, band, d]} c={wall} />)}
      {!strip && Array.from({ length: nw + 1 }, (_, i) => <B key={'x' + i} p={[-w / 2 + 0.2 + i * (w - 0.4) / nw, h / 2, 0]} s={[0.4, h, d]} c={wall} />)}
      {!strip && Array.from({ length: nd + 1 }, (_, i) => <B key={'z' + i} p={[0, h / 2, -d / 2 + 0.2 + i * (d - 0.4) / nd]} s={[w, h, 0.4]} c={wall} />)}
      {lit.map(([f, face]) => {
        const y = f * fh + fh / 2 + band / 4, hh = fh - band - 0.05, along = face < 2;
        const pos = along ? [0, y, (face ? -1 : 1) * (d / 2 - 0.04)] : [(face === 2 ? 1 : -1) * (w / 2 - 0.04), y, 0];
        return <B key={f + ':' + face} p={pos} s={along ? [w - 0.5, hh, 0.04] : [0.04, hh, d - 0.5]} c="#ffe2a8" e="#ffcf7a" ei={0.9} cast={false} />;
      })}
      <B p={[0, h + 0.2, 0]} s={[w + 0.2, 0.4, d + 0.2]} c={wall} />
      <B p={[0, h + 0.05, 0]} s={[w - 0.3, 0.12, d - 0.3]} c={roof} cast={false} />
    </group>
  );
}
const Ground = ({ c }) => <B p={[0, 0.07, 0]} s={[2 * LOT, 0.02, 2 * LOT]} c={c} cast={false} />;
const Sign = ({ text, bg, fg, p, w = 3, h = 0.5 }) => {
  const map = useMemo(() => signTexture(text, bg, fg), [text, bg, fg]);
  return <mesh position={p}><planeGeometry args={[w, h]} /><meshStandardMaterial map={map} emissive="#ffffff" emissiveMap={map} emissiveIntensity={0.2} /></mesh>;
};
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

// ---------------------------------------------------------------- parks, squares and the metro
function Flowers({ beds, seed }) {
  // round flowers in three colours over the given beds [x, z, w, d]
  const out = useMemo(() => {
    const r = rnd(seed + 3), cols = [[], [], []];
    beds.forEach(([x, z, w, d]) => { for (let i = 0; i < w * d * 2.2; i++) cols[i % 3].push([x + (r() - 0.5) * w, 0.22, z + (r() - 0.5) * d, 0.8 + r() * 0.5]); });
    return cols;
  }, [seed]);
  return ['#e84a5f', '#ffd166', '#f6f0ff'].map((c, i) => <Many key={c} geo={<sphereGeometry args={[0.12, 6, 5]} />} c={c} cast={false} at={out[i]} />);
}

// a lake with a red arched bridge out to a little pavilion on an island, a path round it and willows
function Lake({ seed }) {
  const r = rnd(seed), bridge = Array.from({ length: 9 }, (_, i) => { const t = i / 8 - 0.5; return [t * 3.2, 0.35 + (0.25 - t * t) * 1.6]; });
  return (
    <>
      <Ground c="#86b867" />
      <mesh position={[0, 0.075, -0.4]} scale={[1, 1, 0.8]} receiveShadow><cylinderGeometry args={[4.4, 4.4, 0.02, 36]} /><meshStandardMaterial color="#d9cdb4" /></mesh>
      <mesh position={[0, 0.085, -0.4]} scale={[1, 1, 0.8]}><cylinderGeometry args={[3.7, 3.7, 0.02, 36]} /><meshStandardMaterial color="#4f9fc9" roughness={0.12} metalness={0.2} /></mesh>
      <C p={[1.2, 0.15, -1.2]} r={0.9} h={0.2} c="#7fb562" seg={16} />
      <group position={[1.2, 0.25, -1.2]}>
        {[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([a, b]) => <B key={a + ':' + b} p={[a, 0.55, b]} s={[0.1, 1.1, 0.1]} c="#a33b2a" />)}
        <mesh position={[0, 1.3, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.85, 0.5, 4]} /><meshStandardMaterial color="#6b3a2a" /></mesh>
        <mesh position={[0, 1.65, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.5, 0.4, 4]} /><meshStandardMaterial color="#6b3a2a" /></mesh>
      </group>
      <group position={[-0.8, 0, 0.4]} rotation-y={-0.75}>
        {bridge.map(([x, y], i) => <B key={i} p={[x, y, 0]} s={[0.42, 0.08, 0.9]} c="#c0392b" />)}
        {[-0.45, 0.45].map(z => bridge.map(([x, y], i) => i % 2 ? null : <B key={z + ':' + i} p={[x, y + 0.3, z]} s={[0.06, 0.5, 0.06]} c="#c0392b" />))}
      </group>
      {[[-4.1, -4.1], [4.1, -4.1], [-4.1, 3.6], [4.2, 3.6]].map(([x, z], i) => <Tree key={i} x={x} z={z} k={0.8 + r() * 0.2} pine={i === 1} />)}
      <Bench x={-2.8} z={3.7} r={Math.PI} /><Bench x={2.8} z={3.7} r={Math.PI} />
      <Sign text="HỒ CÔNG VIÊN · LAKE PARK" bg="#2f7a54" p={[0, 0.9, LOT - 0.15]} w={2.6} h={0.4} />
      <C p={[0, 0.35, LOT - 0.15]} r={0.04} h={0.7} c="#555" />
    </>
  );
}

// a flower garden: hedges round the edge, beds of flowers and a gazebo in the middle
function Garden({ seed }) {
  const beds = [[-2.6, -2.6, 2.8, 2.8], [2.6, -2.6, 2.8, 2.8], [-2.6, 2.4, 2.8, 2.4], [2.6, 2.4, 2.8, 2.4]];
  return (
    <>
      <Ground c="#8cc06e" />
      <B p={[0, 0.085, 0]} s={[2 * LOT, 0.01, 1.2]} c="#e8dcc4" cast={false} />
      <B p={[0, 0.085, 0]} s={[1.2, 0.01, 2 * LOT]} c="#e8dcc4" cast={false} />
      {beds.map(([x, z, w, d]) => <B key={x + ':' + z} p={[x, 0.11, z]} s={[w, 0.08, d]} c="#6b4a35" cast={false} />)}
      <Flowers beds={beds} seed={seed} />
      {[[0, -LOT + 0.25, 2 * LOT, 0.5], [-LOT + 0.25, 0, 0.5, 2 * LOT], [LOT - 0.25, 0, 0.5, 2 * LOT]].map(([x, z, w, d]) => (
        <B key={x + ':' + z} p={[x, 0.4, z]} s={[w, 0.7, d]} c="#4f8a43" />
      ))}
      <group>
        <C p={[0, 0.12, 0]} r={1.3} h={0.16} c="#f1ebe0" seg={6} />
        {Array.from({ length: 6 }, (_, k) => <C key={k} p={[Math.cos(k * 1.047) * 1.1, 1.1, Math.sin(k * 1.047) * 1.1]} r={0.06} h={1.9} c="#ffffff" seg={8} />)}
        <mesh position={[0, 2.35, 0]} castShadow><coneGeometry args={[1.6, 0.9, 6]} /><meshStandardMaterial color="#3f7a6a" /></mesh>
      </group>
      <Bench x={-1.9} z={0} r={Math.PI / 2} /><Bench x={1.9} z={0} r={-Math.PI / 2} />
    </>
  );
}

// a playground: soft ground, a slide, swings, a seesaw, a sandpit and a roundabout
function Playground({ seed }) {
  const r = rnd(seed);
  return (
    <>
      <Ground c="#8cc06e" />
      <B p={[0, 0.09, -0.6]} s={[8.6, 0.02, 7]} c="#e98c5a" cast={false} />
      <group position={[-2.4, 0, -2.4]}>
        <B p={[0, 1.2, 0]} s={[1.1, 0.1, 1.1]} c="#2a9d8f" />
        {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([a, b]) => <C key={a + ':' + b} p={[a, 0.9, b]} r={0.05} h={1.8} c="#264653" seg={8} />)}
        <mesh position={[0, 1.95, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.95, 0.6, 4]} /><meshStandardMaterial color="#e9c46a" /></mesh>
        <B p={[1.35, 0.65, 0]} r={0} s={[1.9, 0.06, 0.6]} c="#e84a5f" />
        {[-0.6, -0.2].map(z => <B key={z} p={[-0.8, 0.6, z]} s={[0.05, 1.2, 0.05]} c="#264653" />)}
      </group>
      <group position={[2.2, 0, -2.4]}>
        <B p={[0, 1.9, 0]} s={[3, 0.1, 0.1]} c="#264653" />
        {[-1.45, 1.45].flatMap(x => [-0.5, 0.5].map(z => <B key={x + ':' + z} p={[x, 0.95, z * 0.6]} s={[0.08, 1.9, 0.08]} c="#264653" />))}
        {[-0.6, 0.6].map(x => <group key={x}>
          {[-0.18, 0.18].map(z => <B key={z} p={[x, 1.3, z]} s={[0.02, 1.2, 0.02]} c="#999" cast={false} />)}
          <B p={[x, 0.68, 0]} s={[0.5, 0.06, 0.4]} c={x < 0 ? '#e76f51' : '#457b9d'} />
        </group>)}
      </group>
      <group position={[-2.4, 0, 1.4]}>
        <B p={[0, 0.3, 0]} s={[0.15, 0.5, 0.15]} c="#264653" />
        <B p={[0, 0.58, 0]} r={0} s={[2.6, 0.08, 0.3]} c="#f4a261" />
      </group>
      <B p={[2.2, 0.12, 1.4]} s={[2.4, 0.12, 2.2]} c="#e9d8a6" />
      <B p={[2.2, 0.16, 1.4]} s={[2.2, 0.06, 2]} c="#f2e3b6" cast={false} />
      <C p={[0, 0.25, 0.2]} r={0.9} h={0.12} c="#e9c46a" seg={16} />
      <C p={[0, 0.6, 0.2]} r={0.05} h={0.6} c="#264653" seg={8} />
      <Tree x={-4.1} z={4} k={0.8} /><Tree x={4.1} z={4} k={0.75 + r() * 0.1} /><Bench x={0} z={3.9} r={Math.PI} />
    </>
  );
}

// courts: a basketball court with hoops, and a badminton court beside it, fenced
function Courts() {
  return (
    <>
      <Ground c="#6f9a5c" />
      <B p={[0, 0.09, -1.4]} s={[9.2, 0.02, 5.6]} c="#3d6fa8" cast={false} />
      <B p={[0, 0.1, -1.4]} s={[7.6, 0.01, 4.4]} c="#d9824b" cast={false} />
      <B p={[0, 0.105, -1.4]} s={[0.06, 0.01, 4.4]} c="#ffffff" cast={false} />
      <C p={[0, 0.105, -1.4]} r={0.7} h={0.005} c="#ffffff" seg={20} />
      {[-1, 1].map(k => <group key={k} position={[k * 4.1, 0, -1.4]} rotation-y={k > 0 ? -Math.PI / 2 : Math.PI / 2}>
        <C p={[0, 1.4, -0.3]} r={0.07} h={2.8} c="#444" seg={8} />
        <B p={[0, 2.8, 0]} s={[1.2, 0.8, 0.06]} c="#ffffff" />
        <mesh position={[0, 2.55, 0.3]} rotation-x={Math.PI / 2}><torusGeometry args={[0.22, 0.025, 6, 16]} /><meshStandardMaterial color="#e05a2a" /></mesh>
      </group>)}
      <B p={[0, 0.09, 3.1]} s={[6, 0.02, 2.6]} c="#2f8a5a" cast={false} />
      <B p={[0, 0.55, 3.1]} s={[0.04, 0.9, 2.6]} c="#eeeeee" cast={false} />
      {[[0, -4.3, 9.4, 0.05], [-4.7, -1.4, 0.05, 5.8], [4.7, -1.4, 0.05, 5.8]].map(([x, z, w, d]) => <B key={x + ':' + z} p={[x, 1, z]} s={[w, 2, d]} c="#7a8a92" o={0.35} cast={false} />)}
    </>
  );
}

// a square: paving, a statue on a tall plinth, two flagpoles, fountains in long pools and benches
function Plaza() {
  return (
    <>
      <Ground c="#e5dccb" />
      <C p={[0, 0.3, -0.5]} r={1.4} h={0.5} c="#bdb3a3" seg={8} />
      <B p={[0, 1.4, -0.5]} s={[1.1, 1.8, 1.1]} c="#9a9183" />
      <group position={[0, 2.3, -0.5]}>
        <C p={[0, 0.75, 0]} r={0.28} r2={0.36} h={1.5} c="#6f7b72" seg={10} metal={0.5} rough={0.4} />
        <S p={[0, 1.75, 0]} r={0.26} c="#6f7b72" />
        <B p={[0.35, 1.35, 0.1]} r={0.4} s={[0.16, 0.9, 0.16]} c="#6f7b72" />
      </group>
      {[-3, 3].map(x => <group key={x}>
        <B p={[x, 0.15, -0.5]} s={[1.6, 0.3, 6]} c="#cfc6b5" />
        <B p={[x, 0.31, -0.5]} s={[1.3, 0.02, 5.7]} c="#5fb3d6" rough={0.1} cast={false} />
        {[-2, 0, 2].map(z => <mesh key={z} position={[x, 0.7, -0.5 + z]}><coneGeometry args={[0.18, 0.8, 8, 1, true]} /><meshStandardMaterial color="#bfe8fa" transparent opacity={0.5} depthWrite={false} /></mesh>)}
      </group>)}
      {[-1.6, 1.6].map(x => <group key={x}>
        <C p={[x, 2.5, -4.2]} r={0.05} h={5} c="#d9d9d9" seg={8} metal={0.6} />
        <Sign text="★" bg="#da251d" fg="#ffde00" p={[x + 0.6, 4.5, -4.2]} w={1.2} h={0.8} />
      </group>)}
      <Bench x={-1.6} z={3.6} r={Math.PI} /><Bench x={1.6} z={3.6} r={Math.PI} />
      <Sign text="QUẢNG TRƯỜNG" bg="#7a2e3a" p={[0, 1.2, 0.07]} w={1.05} h={0.3} />
    </>
  );
}

// a metro station: the ticket hall's glass pavilion, two stair entrances down under glass canopies, and a
// tall M sign
function Metro() {
  const steps = useMemo(() => stripes('#3a3f45', '#5b636b'), []);
  const mark = useMemo(() => paint('metro-m', 128, 128, (g, w, h) => {
    g.fillStyle = '#d62828'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = '900 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('M', w / 2, h / 2 + 6);
  }, [1, 1]), []);
  return (
    <>
      <Ground c="#d8d2c6" />
      <Block p={[0, 0, -2.6]} s={[7, 3.2, 3.6]} wall="#2f3a46" glass="#9fd3ef" strip roof="#c9ced3" />
      <Sign text="METRO · GA TÀU ĐIỆN NGẦM" bg="#d62828" p={[0, 2.7, -0.78]} w={4.6} h={0.55} />
      {[-2.6, 2.6].map(x => <group key={x} position={[x, 0, 1.8]}>
        <mesh position={[0, 0.082, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.6, 2.6]} /><meshStandardMaterial map={steps} color="#ffffff" /></mesh>
        {[-0.85, 0.85].map(k => <B key={k} p={[k, 0.5, 0]} s={[0.08, 1, 2.6]} c="#9aa3ab" metal={0.5} />)}
        {[[-0.9, -1.3], [0.9, -1.3], [-0.9, 1.3], [0.9, 1.3]].map(([a, b]) => <B key={a + ':' + b} p={[a, 1.25, b]} s={[0.08, 2.5, 0.08]} c="#3a3f45" />)}
        <B p={[0, 2.55, 0]} s={[2, 0.08, 2.9]} c="#bfe3f5" o={0.55} rough={0.1} />
      </group>)}
      <group position={[0, 0, 3.6]}>
        <C p={[0, 1.6, 0]} r={0.09} h={3.2} c="#3a3f45" seg={8} />
        <C p={[0, 3.5, 0]} r={0.55} h={0.12} rx={Math.PI / 2} c="#d62828" seg={20} />
        {[1, -1].map(k => <mesh key={k} position={[0, 3.5, k * 0.07]} rotation-y={k < 0 ? Math.PI : 0}><circleGeometry args={[0.5, 24]} /><meshStandardMaterial map={mark} emissive="#ffffff" emissiveMap={mark} emissiveIntensity={0.2} /></mesh>)}
      </group>
      {[-4, 4].map(x => <Tree key={x} x={x} z={-4.1} k={0.7} />)}
      {[-0.6, 0, 0.6].map(x => <B key={x} p={[x, 0.35, 0.6]} s={[0.05, 0.6, 0.6]} c="#888" metal={0.5} />)}
    </>
  );
}

// ---------------------------------------------------------------- Shanghai
// a sign written top to bottom (Chinese shop signs hang that way), and a red lantern
function vSign(text, bg, fg = '#ffffff') {
  return paint('v:' + text + bg + fg, 64, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10);
    const ch = [...text], step = (h - 20) / ch.length;
    g.fillStyle = fg; g.font = `800 ${Math.min(44, step * 0.85)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    ch.forEach((c, i) => g.fillText(c, w / 2, 10 + step * (i + 0.5)));
  }, [1, 1]);
}
export function Neon({ text, bg, p, h = 2.6, r = 0 }) {
  const night = useContext(Night), map = useMemo(() => vSign(text, bg), [text, bg]);
  return (
    <mesh position={p} rotation-y={r}>
      <planeGeometry args={[h / 4, h]} />
      <meshStandardMaterial map={map} emissive="#ffffff" emissiveMap={map} emissiveIntensity={night ? 1.1 : 0.35} side={THREE.DoubleSide} />
    </mesh>
  );
}
export const Lantern = ({ p }) => (
  <group position={p}>
    <S p={[0, 0, 0]} r={0.22} c="#d62828" e="#ff3b2f" sc={[1, 0.8, 1]} />
    <B p={[0, 0.2, 0]} s={[0.16, 0.06, 0.16]} c="#e9b949" cast={false} />
    <B p={[0, -0.24, 0]} s={[0.05, 0.14, 0.05]} c="#e9b949" cast={false} />
  </group>
);
// a hipped Chinese roof: a low pyramid with the four corners flicked up
export function ChineseRoof({ p, w, c = '#3c4a4f', h = 0.9 }) {
  return (
    <group position={p}>
      <mesh rotation-y={Math.PI / 4} castShadow><coneGeometry args={[w * 0.75, h, 4]} /><meshStandardMaterial color={c} /></mesh>
      {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => (
        <mesh key={a + ':' + b} position={[a * w * 0.5, -h * 0.3, b * w * 0.5]} rotation={[b * 0.5, 0, -a * 0.5]} castShadow>
          <boxGeometry args={[0.14, 0.5, 0.14]} /><meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

// the Bund: grand stone buildings from the 1920s facing the river (east): columns, a cornice, rows of
// windows, and on top a clock tower, a green pyramid roof or a dome
function Bund({ seed }) {
  const r = rnd(seed), v = seed % 4, h = 9 + Math.round(r() * 4);
  const stone = pick(r, ['#d9cdb2', '#cfc3a6', '#c9c1ae', '#ddd3bf']);
  const glow = useContext(Night) ? { e: '#ffb347', ei: 0.35 } : {};      // floodlit gold at night
  return (
    <group rotation-y={Math.PI / 2}>
      <Ground c="#d6cfbf" />
      <B p={[0, h / 2, -0.6]} s={[9.4, h, 7.4]} c={stone} {...glow} />
      <B p={[0, 0.6, -0.6]} s={[9.6, 1.2, 7.6]} c="#b9ae96" />
      <B p={[0, h + 0.2, -0.6]} s={[9.9, 0.4, 7.9]} c="#efe7d6" />
      {Array.from({ length: 4 }, (_, f) => Array.from({ length: 7 }, (_, k) => (
        <B key={f + ':' + k} p={[-3.9 + k * 1.3, 2.2 + f * ((h - 3) / 4), 3.12]} s={[0.6, 1.1, 0.06]} c="#3b4650" cast={false} />
      )))}
      {[-3.6, -2.2, -0.8, 0.8, 2.2, 3.6].map(x => <C key={x} p={[x, 2.4, 3.6]} r={0.22} h={2.4} c="#efe7d6" seg={10} />)}
      <B p={[0, 3.7, 3.6]} s={[8.2, 0.3, 0.7]} c="#efe7d6" />
      {v === 0 && <group position={[0, h, 0.6]}>
        <B p={[0, 3.5, 0]} s={[3, 7, 3]} c={stone} {...glow} />
        {[1, -1].map(k => <C key={k} p={[0, 5.2, k * 1.52]} r={0.9} h={0.06} rx={Math.PI / 2} c="#f6f2e6" />)}
        <mesh position={[0, 7.8, 0]} castShadow><cylinderGeometry args={[1.2, 1.5, 1.6, 8]} /><meshStandardMaterial color="#efe7d6" /></mesh>
      </group>}
      {v === 1 && <group position={[0, h, 0]}>
        <B p={[0, 2, 0]} s={[3.4, 4, 3.4]} c={stone} {...glow} />
        <mesh position={[0, 5.4, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[2.6, 2.8, 4]} /><meshStandardMaterial color="#3f8a6a" /></mesh>
      </group>}
      {v === 2 && <group position={[0, h + 0.4, 0]}>
        <C p={[0, 0.8, 0]} r={2.4} h={1.6} c={stone} seg={16} />
        <mesh position={[0, 1.6, 0]} castShadow><sphereGeometry args={[2.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#7a8f86" /></mesh>
      </group>}
      {v === 3 && <><C p={[0, h + 2.5, 0]} r={0.05} h={4} c="#ddd" /><B p={[0.5, h + 4, 0]} s={[1, 0.6, 0.03]} c="#d62828" cast={false} /></>}
    </group>
  );
}

// Nanjing Road: a pedestrian shopping street, narrow shops hung with vertical neon signs and lanterns,
// and an arch over the way in
const NEONS = [['南京路', '#d62828'], ['百货公司', '#1f6fb2'], ['老字号', '#2a9d5c'], ['茶楼', '#8e44ad'], ['珠宝', '#d4a017'], ['饭店', '#e05a2a'], ['电影院', '#c2185b'], ['书店', '#00838f']];
function Nanjing({ seed }) {
  const r = rnd(seed), off = seed % NEONS.length;
  return (
    <>
      <Ground c="#d8c7ab" />
      {[-3.6, -1.2, 1.2, 3.6].map((x, i) => {
        const h = 6 + Math.round(r() * 5), wall = pick(r, ['#e8dcc6', '#d9c3a5', '#c9b8a0', '#e6d2c0', '#bfc7cc']);
        const [text, bg] = NEONS[(off + i) % NEONS.length];
        return (
          <group key={x} position={[x, 0, -2]}>
            <B p={[0, h / 2, 0]} s={[2.3, h, 5]} c={wall} />
            <B p={[0, 1.2, 2.52]} s={[2, 2.2, 0.05]} c="#bfe3f5" o={0.6} cast={false} />
            {Array.from({ length: Math.floor((h - 3) / 1.5) }, (_, f) => <B key={f} p={[0, 3.4 + f * 1.5, 2.52]} s={[1.6, 0.8, 0.05]} c="#3b4650" cast={false} />)}
            <Neon text={text} bg={bg} p={[0.9, Math.min(h - 1.5, 4.6), 2.95]} r={Math.PI / 2} />
          </group>
        );
      })}
      {[-3.6, -1.2, 1.2, 3.6].map(x => <Lantern key={x} p={[x, 2.9, 2.2]} />)}
      <B p={[0, 3.15, 2.2]} s={[9.6, 0.03, 0.03]} c="#333" cast={false} />
      <group position={[0, 0, 4.4]}>
        {[-2.6, 2.6].map(x => <B key={x} p={[x, 1.8, 0]} s={[0.3, 3.6, 0.3]} c="#7a1f1f" />)}
        <Sign text="南京路步行街 · NANJING RD" bg="#a11d1d" fg="#ffe08a" p={[0, 3.6, 0]} w={5.6} h={0.7} />
      </group>
    </>
  );
}

// Yu Garden: a classical garden, a pond crossed by a zigzag bridge to a two-storey teahouse with flicked-up
// eaves, white walls capped with grey tiles, and red lanterns
function Yuyuan() {
  const zig = [[-3.8, 2.8], [-2.4, 1.6], [-1.2, 2.6], [0, 1.4], [0.6, 0.3]];
  return (
    <>
      <Ground c="#cfc4a8" />
      <mesh position={[0, 0.09, 0.6]} scale={[1, 1, 0.75]}><cylinderGeometry args={[3.9, 3.9, 0.02, 32]} /><meshStandardMaterial color="#4f8f8a" roughness={0.15} /></mesh>
      {zig.slice(1).map(([x, z], i) => {
        const [px, pz] = zig[i], len = Math.hypot(x - px, z - pz);
        return <B key={i} p={[(x + px) / 2, 0.35, (z + pz) / 2]} r={Math.atan2(x - px, z - pz)} s={[0.7, 0.12, len + 0.3]} c="#c9b28a" />;
      })}
      <group position={[1.2, 0, -0.6]}>
        <B p={[0, 0.25, 0]} s={[2.8, 0.5, 2.8]} c="#b8ac90" />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => <B key={a + ':' + b} p={[a * 1.1, 1.3, b * 1.1]} s={[0.16, 1.6, 0.16]} c="#a32020" />)}
        <B p={[0, 1.5, 0]} s={[1.9, 1.2, 1.9]} c="#f1ead8" />
        <ChineseRoof p={[0, 2.5, 0]} w={2.9} />
        <B p={[0, 3.2, 0]} s={[1.5, 0.9, 1.5]} c="#f1ead8" />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => <B key={'u' + a + b} p={[a * 0.8, 3.2, b * 0.8]} s={[0.12, 0.9, 0.12]} c="#a32020" />)}
        <ChineseRoof p={[0, 4.0, 0]} w={2.1} />
        <S p={[0, 4.55, 0]} r={0.16} c="#d4a017" />
        {[[-1.4, 1.4], [1.4, 1.4]].map(([a, b]) => <Lantern key={a} p={[a, 2.0, b]} />)}
      </group>
      {[[0, -LOT + 0.2, 2 * LOT, 0.3], [-LOT + 0.2, -1.5, 0.3, 6.6], [LOT - 0.2, -1.5, 0.3, 6.6]].map(([x, z, w, d]) => (
        <group key={x + ':' + z}>
          <B p={[x, 1.1, z]} s={[w, 2.2, d]} c="#f4f0e6" />
          <B p={[x, 2.3, z]} s={[w + 0.2, 0.2, d + 0.2]} c="#4b555a" />
        </group>
      ))}
      <Tree x={-3.6} z={-3.4} k={0.8} pine /><Tree x={3.8} z={3.4} k={0.7} />
      <group position={[-3.2, 0, 4.3]}>
        {[-0.9, 0.9].map(x => <B key={x} p={[x, 1.2, 0]} s={[0.2, 2.4, 0.2]} c="#a32020" />)}
        <Sign text="豫园 · YU GARDEN" bg="#2b2b2b" fg="#ffd166" p={[0, 2.3, 0]} w={2.4} h={0.45} />
        <ChineseRoof p={[0, 2.75, 0]} w={2.2} h={0.5} />
      </group>
    </>
  );
}

// shikumen: two rows of grey-brick lane houses facing a narrow lane, with stone door frames and black doors
function Shikumen({ seed }) {
  const r = rnd(seed), brick = pick(r, ['#8f8a82', '#9a8f84', '#857f78']);
  return (
    <>
      <Ground c="#a8a297" />
      {[-1, 1].map(row => (
        <group key={row} position={[0, 0, row * 2.7]} rotation-y={row > 0 ? Math.PI : 0}>
          {[-3.6, -1.2, 1.2, 3.6].map(x => (
            <group key={x} position={[x, 0, 0]}>
              <B p={[0, 2, 0]} s={[2.3, 4, 3.4]} c={brick} />
              <B p={[0, 2.05, 1.71]} s={[2.3, 0.08, 0.02]} c="#d6cbb5" cast={false} />
              <B p={[0, 0.95, 1.72]} s={[1.0, 1.9, 0.06]} c="#d6cbb5" cast={false} />
              <B p={[0, 2.0, 1.73]} s={[1.2, 0.3, 0.08]} c="#d6cbb5" cast={false} />
              <B p={[0, 0.85, 1.76]} s={[0.7, 1.6, 0.04]} c="#1d1d1d" cast={false} />
              <B p={[0, 3.0, 1.72]} s={[0.8, 0.8, 0.04]} c="#4a3426" cast={false} />
              {[-1, 1].map(k => (
                <mesh key={k} position={[0, 4.35, k * 0.85]} rotation-x={-k * 0.45} castShadow>
                  <boxGeometry args={[2.4, 0.12, 1.95]} /><meshStandardMaterial color="#4b5257" />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
      <group position={[-LOT + 0.2, 0, 0]} rotation-y={Math.PI / 2}>
        {[-0.8, 0.8].map(x => <B key={x} p={[x, 1.4, 0]} s={[0.3, 2.8, 0.3]} c="#d6cbb5" />)}
        <Sign text="石库门 · LANE" bg="#3b3b3b" fg="#f2e6c9" p={[0, 2.6, 0.17]} w={1.9} h={0.4} />
      </group>
    </>
  );
}

// ---------------------------------------------------------------- the kinds
// Shanghai's towers wear hats: a stepped spire, a pagoda roof, or a "flying saucer" restaurant on top
function Crown({ h, v, wall }) {
  const night = useContext(Night), glow = night ? { e: '#9fd3ff', ei: 0.6 } : {};
  if (v === 0) return (
    <group position={[0, h + 0.4, 0]}>
      <B p={[0, 0.8, 0]} s={[6, 1.6, 5]} c={wall} /><B p={[0, 2.2, 0]} s={[3.6, 1.2, 3]} c={wall} />
      <mesh position={[0, 4.8, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[1.2, 4, 4]} /><meshStandardMaterial color="#d7dadd" metalness={0.5} roughness={0.3} /></mesh>
    </group>
  );
  if (v === 1) return (
    <group position={[0, h + 0.4, 0]}>
      <B p={[0, 0.9, 0]} s={[5, 1.8, 4.4]} c={wall} />
      <ChineseRoof p={[0, 2.4, 0]} w={5.6} h={1.6} c="#2f4f4f" />
      <C p={[0, 4.2, 0]} r={0.08} h={2.2} c="#d4a017" /><S p={[0, 5.3, 0]} r={0.25} c="#d4a017" />
    </group>
  );
  return (
    <group position={[0, h + 0.4, 0]}>
      <C p={[0, 1.5, 0]} r={0.9} h={3} c={wall} seg={12} />
      <mesh position={[0, 3.4, 0]} castShadow><cylinderGeometry args={[3.2, 2.2, 1.1, 20]} /><meshStandardMaterial color="#cfd6dc" metalness={0.4} roughness={0.3} /></mesh>
      <C p={[0, 3.4, 0]} r={3.22} h={0.35} c="#4f7ea8" seg={20} {...glow} />
      <C p={[0, 4.6, 0]} r={0.06} h={1.6} c="#ccc" />
    </group>
  );
}
const TOWER_SIGNS = [['东方集团', '#c0392b'], ['华申大厦', '#1f6fb2'], ['申江实业', '#2a9d5c'], ['浦江置业', '#8e44ad'], ['金桥中心', '#d4a017']];
function Tower({ seed }) {
  const r = rnd(seed), h = 18 + Math.round(r() * 14), wall = pick(r, ['#8fa8bf', '#3d4f63', '#6f8397', '#9fb4a8', '#7b8fa8']);
  const glass = pick(r, ['#4f7ea8', '#6aa0c8', '#5c8f9e']), twin = r() < 0.5, [name, bg] = TOWER_SIGNS[seed % TOWER_SIGNS.length];
  return twin
    ? <>
        <Block p={[-1, 0, 0]} s={[7, h, 7]} wall={wall} glass={glass} strip />
        <group position={[-1, 0, 0]}><Crown h={h} v={seed % 3} wall={wall} /></group>
        <Block p={[3.2, 0, 1]} s={[4, h * 0.45, 6]} wall="#56708a" glass="#7fb2d6" />
        <Neon text={name} bg={bg} p={[2.4, h * 0.45 - 2, 4.05]} h={3.2} />
      </>
    : <>
        <Block p={[0, 0, 0]} s={[9, h, 8]} wall={wall} glass={glass} strip />
        <Crown h={h} v={seed % 3} wall={wall} />
        <Neon text={name} bg={bg} p={[3.6, h - 3, 4.06]} h={3.6} />
      </>;
}

// Shanghai's older flats: tiled walls, an air conditioner by many windows, washing hung out on poles, and
// the pitched roof the city added on top of the flat ones
const WASH = ['#e76f51', '#f4f1ea', '#2a9d8f', '#e9c46a', '#457b9d', '#b56576'];
function Flats({ seed }) {
  const r = rnd(seed), c = pick(r, ['#ece7dc', '#e3d6c2', '#d9dfe3', '#efe2cf', '#d8cfc4', '#e6d3c3']), floors = 5 + Math.floor(r() * 3);
  const fh = 2.4, h = floors * fh + 1, roof = pick(r, ['#b5523b', '#3e6e9a', '#4b5257', '#8c5a3c']);
  const ac = [], wash = [];
  for (let f = 1; f < floors; f++) for (let a = -3.6; a <= 3.7; a += 2.4) {
    if (r() < 0.55) ac.push([a + 0.6, f * fh + 0.25]);
    if (r() < 0.35) wash.push([a - 0.2, f * fh + 1.5, pick(r, WASH), pick(r, WASH)]);
  }
  return (
    <>
      <Block p={[0, 0, -0.5]} s={[9.5, h, 7.5]} wall={c} glass="#7d9fb5" />
      {ac.map(([a, y]) => <B key={a + ':' + y} p={[a, y, 3.45]} s={[0.75, 0.45, 0.4]} c="#f2f2ee" />)}
      {wash.map(([a, y, c1, c2]) => (
        <group key={a + ':' + y} position={[a, y, 3.7]}>
          <B p={[0, 0, 0]} s={[1.7, 0.04, 0.04]} c="#8a8f94" cast={false} />
          <B p={[-0.4, -0.3, 0]} s={[0.45, 0.55, 0.03]} c={c1} cast={false} />
          <B p={[0.3, -0.25, 0]} s={[0.5, 0.45, 0.03]} c={c2} cast={false} />
        </group>
      ))}
      {[-1, 1].map(k => (
        <mesh key={k} position={[0, h + 1.15, -0.5 + k * 1.9]} rotation-x={k * 0.42} castShadow>
          <boxGeometry args={[9.9, 0.16, 4.15]} /><meshStandardMaterial color={roof} />
        </mesh>
      ))}
    </>
  );
}

const OFFICE_SIGNS = ['申华大厦 · SHENHUA', '外滩中心 · BUND CENTRE', '江南贸易 · JIANGNAN TRADE', '海通大楼 · HAITONG BLDG', '新世纪 · NEW CENTURY'];
function Offices({ seed }) {
  const r = rnd(seed), a = pick(r, ['#c7cdd3', '#a9b8c6', '#d9cfc1', '#b5c4b1']), b = pick(r, ['#7d8a96', '#8c7b6b', '#5f7d8c']);
  const h = 10 + Math.round(r() * 6);
  return (
    <>
      <Block p={[-2.2, 0, -0.8]} s={[5, h, 7.5]} wall={a} glass="#6aa0c8" strip />
      <Block p={[2.6, 0, 0.4]} s={[4.2, 6 + Math.round(r() * 4), 6]} wall={b} glass="#9cc7e2" />
      <Sign text={OFFICE_SIGNS[seed % OFFICE_SIGNS.length]} bg="#a11d1d" fg="#ffe08a" p={[-2.2, h + 1.1, 1.5]} w={4.6} h={0.75} />
      {[-4, -0.4].map(x => <B key={x} p={[x, h + 0.6, 1.45]} s={[0.1, 1, 0.1]} c="#555" />)}
    </>
  );
}

const SHOPS = [['生煎 · SHENGJIAN', '#c0392b', '生煎包'], ['药房 · PHARMACY', '#2f9e6e', '药房'], ['书店 · BOOKS', '#6b4b9a', '书店'], ['花店 · FLOWERS', '#d6457e', '鲜花'],
  ['便利店 · 24H', '#2e86de', '便利店'], ['小笼包 · DUMPLINGS', '#b03a2e', '小笼包'], ['理发 · BARBER', '#34495e', '理发'], ['面馆 · NOODLES', '#e67e22', '面馆'],
  ['奶茶 · MILK TEA', '#d4a017', '奶茶'], ['手机 · PHONES', '#16a085', '手机'], ['茶叶 · TEA', '#7d4f36', '茶叶'], ['包子 · BAOZI', '#8e44ad', '包子铺']];
function Shops({ seed }) {
  const r = rnd(seed);
  return [-3.2, 0, 3.2].map((x, i) => {
    const [name, c, v] = SHOPS[(seed * 7 + i * 5) % SHOPS.length], h = 3.6 + Math.round(r() * 2) * 1.6, wall = pick(r, ['#efe5d6', '#f4d9c6', '#d9e4ec', '#e9e1f5', '#f6efd2']);
    return (
      <group key={x} position={[x, 0, -0.6]}>
        <B p={[0, h / 2, 0]} s={[3.1, h, 6.6]} c={wall} />
        <B p={[0, h + 0.15, 0]} s={[3.2, 0.3, 6.7]} c="#9aa0a6" />
        {h > 4 && <B p={[0, 4.6, 3.31]} s={[2.2, 0.9, 0.04]} c="#bfe0f2" e="#bfe0f2" ei={0.3} cast={false} />}
        <B p={[0, 1.2, 3.31]} s={[2.4, 1.9, 0.04]} c="#bfe3f5" o={0.5} cast={false} />
        <Sign text={name} bg={c} p={[0, 2.55, 3.36]} w={2.8} h={0.5} />
        <mesh position={[0, 2.1, 3.85]} rotation-x={0.35}><boxGeometry args={[2.9, 0.04, 1.1]} /><meshStandardMaterial map={stripes(c, '#ffffff')} /></mesh>
        {i !== 1 && <Lantern p={[i ? 1.1 : -1.1, 2.95, 3.6]} />}
        {h > 4 && <Neon text={v} bg={c} p={[i ? 1.35 : -1.35, h - 1.4, 3.75]} h={2} r={Math.PI / 2} />}
      </group>
    );
  });
}

// old villas (the former French Concession's "lao yang fang"): red brick or cream walls, steep grey roofs,
// white window frames, a garden behind a low wall with a gate
const HOUSE_WALLS = ['#b5574a', '#e9dcc3', '#c98f6a', '#a84e3e', '#efe3cc', '#d9b48f'], ROOFS = ['#4b5257', '#5a4a42', '#7a3b2e', '#3f4a50'];
function Houses({ seed }) {
  const r = rnd(seed);
  return (
    <>
      <Ground c="#86b366" />
      {[[-2.45, -2.3], [2.45, -2.3], [-2.45, 2.3], [2.45, 2.3]].map(([x, z], i) => {
        const w = pick(r, HOUSE_WALLS), roof = pick(r, ROOFS), h = 2.8 + (r() < 0.6 ? 2.2 : 0);
        return (
          <group key={i} position={[x, 0, z]}>
            <B p={[0, h / 2, -0.3]} s={[3.6, h, 3.2]} c={w} />
            <mesh position={[0, h + 0.95, -0.3]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[2.75, 1.9, 4]} /><meshStandardMaterial color={roof} roughness={0.8} /></mesh>
            <B p={[0.9, 0.9, 1.31]} s={[0.8, 1.8, 0.04]} c="#3b2a20" />
            <B p={[-0.8, 1.5, 1.31]} s={[1.0, 0.9, 0.03]} c="#f4f1ea" /><B p={[-0.8, 1.5, 1.33]} s={[0.8, 0.7, 0.03]} c="#3d4f5c" e="#bfe0f2" ei={0.15} />
            {h > 3 && <><B p={[0, 3.9, 1.31]} s={[1.8, 1.0, 0.03]} c="#f4f1ea" /><B p={[0, 3.9, 1.33]} s={[1.6, 0.8, 0.03]} c="#3d4f5c" e="#bfe0f2" ei={0.15} /></>}
            {h > 3 && <B p={[0, 3.3, 1.55]} s={[2, 0.1, 0.5]} c="#f4f1ea" />}
          </group>
        );
      })}
      {[-1, 1].map(k => <B key={k} p={[k * 2.95, 0.6, LOT - 0.15]} s={[3.9, 1.2, 0.3]} c="#d9cdb5" />)}
      {[-1, 1].map(k => <group key={'g' + k}><B p={[k * 1.0, 0.8, LOT - 0.15]} s={[0.4, 1.6, 0.4]} c="#cfc3a6" /><S p={[k * 1.0, 1.75, LOT - 0.15]} r={0.16} c="#fff6d6" e="#ffe8b0" /></group>)}
      <Tree x={-3.9} z={0} k={0.6} plane /><Tree x={3.9} z={0} k={0.6} plane />
      {r() < 0.6 && <Car x={0} z={0.3} c={pick(r, ['#2c3e50', '#f5f6fa', '#7a2e3a', '#1e5a4a'])} r={Math.PI / 2} />}
    </>
  );
}

function Park({ seed }) {
  const jet = useRef(), r = rnd(seed);
  useFrame(({ clock }) => { if (jet.current) jet.current.scale.y = 1 + Math.sin(clock.elapsedTime * 4) * 0.08; });
  const pond = r() < 0.5;
  return (
    <>
      <Ground c="#7fb562" />
      <B p={[0, 0.085, 0]} s={[2 * LOT, 0.01, 1.6]} c="#e3d9c6" cast={false} />
      <B p={[0, 0.085, 0]} s={[1.6, 0.01, 2 * LOT]} c="#e3d9c6" cast={false} />
      {pond
        ? <><C p={[2.6, 0.09, -2.6]} r={1.6} h={0.02} c="#5fb3d6" seg={28} rough={0.1} /><Tree x={-3.2} z={-3.2} k={0.9} /><Tree x={-3.4} z={3.3} k={0.8} pine /><Tree x={3.3} z={3.3} k={0.85} /></>
        : <>
            <C p={[0, 0.25, 0]} r={1.8} h={0.5} c="#cfc8bc" seg={32} />
            <C p={[0, 0.46, 0]} r={1.65} h={0.06} c="#5fb3d6" seg={32} rough={0.1} />
            <C p={[0, 0.8, 0]} r={0.16} h={0.8} c="#cfc8bc" seg={12} />
            <mesh ref={jet} position={[0, 1.5, 0]} userData={{ live: true }}><coneGeometry args={[0.5, 0.9, 16, 1, true]} /><meshStandardMaterial color="#9fdcf5" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} /></mesh>
            {[[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]].map(([a, b], i) => <Tree key={i} x={a} z={b} k={0.85} pine={i === 1} />)}
          </>}
      <Bench x={-2.6} z={0.95} r={Math.PI} /><Bench x={2.6} z={-0.95} />
      <group position={[pond ? -2.8 : 3.2, 0, 1.8]}>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => <B key={a + ':' + b} p={[a * 0.6, 0.8, b * 0.6]} s={[0.12, 1.6, 0.12]} c="#a32020" />)}
        <B p={[0, 0.08, 0]} s={[1.6, 0.16, 1.6]} c="#cfc8bc" />
        <ChineseRoof p={[0, 1.95, 0]} w={1.7} h={0.6} />
        <Lantern p={[0, 1.4, 0]} />
      </group>
    </>
  );
}

function Pitch() {
  const line = (x, z, w, d) => <B key={x + ':' + z + ':' + w} p={[x, 0.09, z]} s={[w, 0.01, d]} c="#f4f1ea" cast={false} />;
  return (
    <>
      <Ground c="#6fa653" />
      {[-3, -1, 1, 3].map(x => <B key={x} p={[x, 0.08, 0]} s={[1, 0.01, 2 * LOT - 0.6]} c="#7db55f" cast={false} />)}
      {line(0, -LOT + 0.4, 2 * LOT - 0.8, 0.08)}{line(0, LOT - 0.4, 2 * LOT - 0.8, 0.08)}{line(-LOT + 0.4, 0, 0.08, 2 * LOT - 0.8)}{line(LOT - 0.4, 0, 0.08, 2 * LOT - 0.8)}{line(0, 0, 2 * LOT - 0.8, 0.08)}
      {[-1, 1].map(k => <group key={k} position={[0, 0, k * (LOT - 0.4)]}>
        {[-1, 1].map(s => <B key={s} p={[s * 1.2, 0.5, 0]} s={[0.08, 1, 0.08]} c="#ffffff" />)}
        <B p={[0, 1, 0]} s={[2.48, 0.08, 0.08]} c="#ffffff" />
      </group>)}
      <S p={[0.6, 0.2, 0.8]} r={0.18} c="#ffffff" />
    </>
  );
}

function Market({ seed }) {
  const r = rnd(seed);
  return (
    <>
      <Ground c="#d8cbb4" />
      {[-3, 0, 3].flatMap(x => [-2.6, 1].map(z => {
        const c = pick(r, ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#e67e22', '#9b59b6']);
        return (
          <group key={x + ':' + z} position={[x, 0, z]}>
            <B p={[0, 0.45, 0]} s={[2, 0.9, 1]} c="#a0704a" />
            {[0, 1, 2, 3].map(k => <S key={k} p={[-0.7 + k * 0.46, 0.98, 0]} r={0.16} c={pick(r, ['#e74c3c', '#f39c12', '#27ae60', '#f1c40f', '#8e44ad'])} />)}
            <C p={[0, 1.2, 0]} r={0.04} h={2.4} c="#555" />
            <mesh position={[0, 2.5, 0]} castShadow><coneGeometry args={[1.5, 0.6, 8]} /><meshStandardMaterial color={c} /></mesh>
          </group>
        );
      }))}
      <Sign text="菜市场 · CHỢ PHIÊN" bg="#c0392b" p={[0, 2.6, LOT - 0.2]} w={4} h={0.6} />
      {[-2, 2].map(x => <C key={x} p={[x, 1.4, LOT - 0.2]} r={0.06} h={2.8} c="#555" />)}
      {[-3, 0, 3].map(x => <Lantern key={x} p={[x, 3.1, -0.8]} />)}
    </>
  );
}

function Hospital() {
  return (
    <>
      <Block p={[0, 0, -1]} s={[10, 12, 7]} wall="#f4f6f8" glass="#86b6d6" />
      <B p={[0, 1.4, 3.3]} s={[4, 2.8, 2.2]} c="#e8eef2" />
      <Sign text="瑞安医院 · HOSPITAL" bg="#ffffff" fg="#c0392b" p={[0, 3.4, 4.42]} w={4} h={0.6} />
      <group position={[3.2, 9.5, 2.56]}><B p={[0, 0, 0]} s={[1.6, 0.5, 0.1]} c="#d64545" e="#d64545" ei={0.4} /><B p={[0, 0, 0]} s={[0.5, 1.6, 0.1]} c="#d64545" e="#d64545" ei={0.4} /></group>
      <group position={[-3.4, 0, 3.6]} rotation-y={Math.PI / 2}><Car x={0} z={0} c="#f4f6f8" /><B p={[0, 1.45, -0.15]} s={[0.6, 0.12, 0.3]} c="#d64545" e="#d64545" ei={0.6} /></group>
    </>
  );
}

// a shopping centre: a wide glass podium with a tower behind, a glass atrium over the entrance, banners and
// a little forecourt with planters
function Mall() {
  return (
    <>
      <Ground c="#d9d2c4" />
      <Block p={[0, 0, -2.6]} s={[6.4, 15, 4.2]} wall="#3d4f63" glass="#6aa0c8" strip />
      <Block p={[0, 0, -0.6]} s={[9.8, 6.4, 7.4]} wall="#ece6dc" glass="#7fb2d6" strip />
      <B p={[0, 3.3, 3.25]} s={[4.6, 6.4, 0.8]} c="#bfe3f5" o={0.5} rough={0.1} />
      <mesh position={[0, 6.5, 3]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[2.3, 2.3, 1.4, 20, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#9fd3ef" transparent opacity={0.55} roughness={0.1} side={THREE.DoubleSide} />
      </mesh>
      <B p={[0, 2.6, 4.05]} s={[5.4, 0.15, 1.4]} c="#f4f1ea" />
      {[-4.2, 4.2].map(x => <B key={x} p={[x, 4.2, 3.12]} s={[0.9, 3.4, 0.05]} c={x < 0 ? '#e84a5f' : '#2a9d8f'} cast={false} />)}
      <Sign text="天空广场 · SKY MALL" bg="#8e44ad" p={[0, 5.2, 3.68]} w={4.4} h={0.7} />
      <Sign text="天空广场" bg="#e84a5f" p={[0, 14, -0.47]} w={4.6} h={1.2} />
      <Neon text="购物中心" bg="#d62828" p={[-4.6, 4, 3.4]} h={3} r={Math.PI / 2} />
      {[-3.4, 3.4].map(x => <group key={x} position={[x, 0, 4.1]}>
        <B p={[0, 0.3, 0]} s={[1.4, 0.6, 0.8]} c="#cfc8bc" /><Tree x={0} z={0} k={0.55} />
      </group>)}
    </>
  );
}
function Station() {
  return (
    <>
      <Block p={[0, 0, 0]} s={[9.8, 5, 6]} wall="#d9c3a5" glass="#86b6d6" roof="#7a3b2e" />
      <B p={[0, 4.5, 0]} s={[2, 9, 2]} c="#c7ad8b" />
      <C p={[0, 7.2, 1.02]} r={0.6} h={0.06} rx={Math.PI / 2} c="#ffffff" />
      <B p={[0, 7.35, 1.07]} s={[0.05, 0.4, 0.02]} c="#222" cast={false} /><B p={[0.12, 7.2, 1.07]} s={[0.3, 0.05, 0.02]} c="#222" cast={false} />
      <mesh position={[0, 9.7, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[1.6, 1.6, 4]} /><meshStandardMaterial color="#7a3b2e" /></mesh>
      <Sign text="上海站 · SHANGHAI STATION" bg="#1f3a5f" p={[0, 3.9, 3.02]} w={6} h={0.6} />
    </>
  );
}

function School() {
  const sign = useMemo(() => signTexture('TRƯỜNG THPT NGUYỄN THÁI HỌC', '#1f5e46'), []);
  return (
    <>
      <Block p={[0, 0, -1]} s={[10.5, 9.6, 6.5]} wall="#f1e3c6" glass="#86b6d6" roof="#b04a3a" />
      <B p={[0, 1.6, 2.6]} s={[3, 3.2, 1.2]} c="#e7d3ad" />
      <mesh position={[0, 3.6, 3.22]}><planeGeometry args={[7, 0.9]} /><meshStandardMaterial map={sign} /></mesh>
      <B p={[0, 3.6, 3.15]} s={[7.2, 1.0, 0.1]} c="#1f5e46" />
      <C p={[3.8, 4, 4.3]} r={0.06} h={8} c="#ccc" metal={0.6} seg={8} />
      <B p={[4.35, 7.4, 4.3]} s={[1.1, 0.7, 0.03]} c="#da251d" />
      <S p={[4.35, 7.4, 4.33]} r={0.12} c="#ffde00" sc={[1, 1, 0.2]} />
    </>
  );
}

function Parking() {
  const cars = [[-2.6, -2.2, '#c0392b'], [0, -2.2, '#2e86de'], [2.6, -2.2, '#f5f6fa'], [-2.6, 2.6, '#10ac84'], [2.6, 2.6, '#f6b93b']];
  return (
    <>
      <Ground c="#55595e" />
      {[-3.9, -1.3, 1.3, 3.9].flatMap(a => [-2.2, 2.6].map(b => <B key={a + ':' + b} p={[a, 0.085, b]} s={[0.1, 0.01, 4]} c="#f2f2f2" cast={false} />))}
      {cars.map(([a, b, c]) => <Car key={a + ':' + b} x={a} z={b} c={c} r={b < 0 ? 0 : Math.PI} />)}
      <B p={[0, 2.5, -4.6]} s={[2.4, 0.9, 0.1]} c="#2e86de" /><B p={[0, 2.5, -4.54]} s={[0.5, 0.6, 0.02]} c="#ffffff" />
      <C p={[0, 1.2, -4.65]} r={0.06} h={2.4} c="#666" />
    </>
  );
}

function Fuel() {
  return (
    <>
      <Ground c="#cfd3d6" />
      <B p={[0, 3.6, 1]} s={[7, 0.4, 4.5]} c="#f4f4f4" />
      <Sign text="加油站 · FUEL 24/7" bg="#d64545" p={[0, 3.6, 3.26]} w={6.8} h={0.38} />
      {[[-3, -1], [3, -1], [-3, 3], [3, 3]].map(([a, b]) => <B key={a + ':' + b} p={[a, 1.7, b]} s={[0.25, 3.4, 0.25]} c="#d64545" />)}
      {[-1.5, 1.5].map(a => <group key={a} position={[a, 0, 1]}><B p={[0, 0.7, 0]} s={[0.6, 1.4, 0.4]} c="#e8e8e8" /><B p={[0, 1.1, 0.21]} s={[0.4, 0.3, 0.02]} c="#253040" /></group>)}
      <Block p={[0, 0, -3.5]} s={[5, 3, 2.6]} wall="#d64545" glass="#bfe3f5" />
    </>
  );
}

// draw: the block's contents; solid: [x, z, w, d] boxes nobody can walk through (relative to the centre)
const CARS5 = [[-2.6, -2.2], [0, -2.2], [2.6, -2.2], [-2.6, 2.6], [2.6, 2.6]].map(([a, b]) => [a, b, 1.9, 4.2]);
export const KINDS = {
  tower: { draw: Tower, solid: [[0, 0, 9, 8], [3.2, 1, 4, 6]] },
  flats: { draw: Flats, solid: [[0, -0.5, 9.5, 7.5]] },
  offices: { draw: Offices, solid: [[-2.2, -0.8, 5, 7.5], [2.6, 0.4, 4.2, 6]] },
  shops: { draw: Shops, solid: [[0, -0.6, 9.5, 6.6]] },
  houses: { draw: Houses, solid: [[-2.45, -2.6, 3.6, 3.2], [2.45, -2.6, 3.6, 3.2], [-2.45, 2, 3.6, 3.2], [2.45, 2, 3.6, 3.2], [-2.95, LOT - 0.15, 3.9, 0.3], [2.95, LOT - 0.15, 3.9, 0.3]] },
  park: { draw: Park, solid: [[0, 0, 3.8, 3.8]] },
  pitch: { draw: Pitch, solid: [] },
  market: { draw: Market, solid: [] },
  hospital: { draw: Hospital, solid: [[0, -1, 10, 7], [0, 3.3, 4, 2.2]] },
  mall: { draw: Mall, solid: [[0, -0.6, 9.8, 7.4], [0, 3.25, 4.6, 0.8]] },
  lake: { draw: Lake, solid: [[0, -0.4, 7, 5.6]] },
  garden: { draw: Garden, solid: [[-2.6, -2.6, 2.8, 2.8], [2.6, -2.6, 2.8, 2.8], [-2.6, 2.4, 2.8, 2.4], [2.6, 2.4, 2.8, 2.4], [0, 0, 2.6, 2.6]] },
  playground: { draw: Playground, solid: [[-2.4, -2.4, 1.4, 1.4], [2.2, -2.4, 3.2, 0.8]] },
  courts: { draw: Courts, solid: [] },
  plaza: { draw: Plaza, solid: [[0, -0.5, 2.8, 2.8], [-3, -0.5, 1.6, 6], [3, -0.5, 1.6, 6]] },
  bund: { draw: Bund, solid: [[-0.6, 0, 7.6, 9.6]] },
  nanjing: { draw: Nanjing, solid: [[0, -2, 9.6, 5]] },
  yuyuan: { draw: Yuyuan, solid: [[1.2, -0.6, 2.8, 2.8], [0, -LOT + 0.2, 2 * LOT, 0.4], [-LOT + 0.2, -1.5, 0.4, 6.6], [LOT - 0.2, -1.5, 0.4, 6.6]] },
  shikumen: { draw: Shikumen, solid: [[0, -2.7, 9.6, 3.4], [0, 2.7, 9.6, 3.4]] },
  metro: { draw: Metro, solid: [[0, -2.6, 7, 3.6], [-2.6, 1.8, 1.8, 2.8], [2.6, 1.8, 1.8, 2.8]] },
  station: { draw: Station, solid: [[0, 0, 9.8, 6]] },
  school: { draw: School, solid: [[0, -1, 10.5, 6.5], [0, 2.6, 3, 1.2]] },
  parking: { draw: Parking, solid: CARS5 },
  fuel: { draw: Fuel, solid: [[0, -3.5, 5, 2.6]] },
};
