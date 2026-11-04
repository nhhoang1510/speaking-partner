// What can stand on a town block (other than the practice buildings): every kind is one entry in KINDS, with
// how to draw it and where it is solid (for walking). To grow the town, add a kind here and put its name in the
// city map (LAYOUT in city.jsx). Each block gets a seed from its place, so repeated kinds (houses, shops,
// flats...) all look a little different. Blocks are drawn around their centre; the usable lot is |x|, |z| < LOT,
// with the street side at +z.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { B, C, S, paint, rnd } from './props.jsx';
import { Tree, Car, Bench } from './scenery.jsx';

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
// one storey-high bay of a facade: wall colour around a window (repeat it over a wall)
function windows(wall, glass, repeat, strip) {
  return paint('win:' + wall + glass + strip, 64, 64, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 10, 0, 54); grd.addColorStop(0, glass); grd.addColorStop(1, '#e8f4fb');
    g.fillStyle = grd;
    if (strip) g.fillRect(0, 12, w, 40); else g.fillRect(12, 12, 40, 40);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(strip ? 0 : 12, 12, strip ? w : 40, 3);
  }, repeat);
}
export function stripes(a, b) {
  return paint('stripe:' + a + b, 64, 8, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 8, 0, 8, h); } }, [6, 1]);
}
// a box with windows on its four sides and a plain roof
export function Block({ p, s, wall, glass = '#7fb2d6', strip, roof = '#9aa0a6' }) {
  const [w, h, d] = s;
  const side = useMemo(() => windows(wall, glass, [Math.max(1, Math.round(w / 1.8)), Math.max(1, Math.round(h / 1.6))], strip), [wall, glass, w, h, strip]);
  const end = useMemo(() => windows(wall, glass, [Math.max(1, Math.round(d / 1.8)), Math.max(1, Math.round(h / 1.6))], strip), [wall, glass, d, h, strip]);
  return (
    <group position={p}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        {[end, end, null, null, side, side].map((m, i) => m
          ? <meshStandardMaterial key={i} attach={`material-${i}`} map={m} roughness={0.6} />
          : <meshStandardMaterial key={i} attach={`material-${i}`} color={roof} roughness={0.9} />)}
      </mesh>
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

// ---------------------------------------------------------------- the kinds
function Tower({ seed }) {
  const r = rnd(seed), h = 18 + Math.round(r() * 14), wall = pick(r, ['#8fa8bf', '#3d4f63', '#6f8397', '#9fb4a8', '#7b8fa8']);
  const glass = pick(r, ['#4f7ea8', '#6aa0c8', '#5c8f9e']), twin = r() < 0.5;
  return twin
    ? <><Block p={[-1, 0, 0]} s={[7, h, 7]} wall={wall} glass={glass} strip /><Block p={[3.2, 0, 1]} s={[4, h * 0.45, 6]} wall="#56708a" glass="#7fb2d6" /></>
    : <><Block p={[0, 0, 0]} s={[9, h, 8]} wall={wall} glass={glass} strip /><B p={[0, h + 0.8, 0]} s={[4, 1.2, 3]} c="#d7dadd" /></>;
}

function Flats({ seed }) {
  const r = rnd(seed), c = pick(r, ['#e6c3a5', '#b9d3c4', '#d8c7e4', '#f0d9a8', '#c9d6e8', '#e8b9a8']), floors = 3 + Math.floor(r() * 3);
  const h = floors * 3 + 2, balconies = [];
  for (let y = 3; y < h; y += 3) for (let a = -3; a <= 3; a += 2) balconies.push([a, y - 1.3]);
  return (
    <>
      <Block p={[0, 0, -0.5]} s={[9.5, h, 7.5]} wall={c} />
      {balconies.map(([a, y]) => <group key={a + ':' + y}><B p={[a, y, 3.65]} s={[1.5, 0.1, 0.9]} c="#f4f1ea" /><B p={[a, y + 0.45, 4.07]} s={[1.5, 0.8, 0.05]} c="#ffffff" o={0.7} /></group>)}
    </>
  );
}

function Offices({ seed }) {
  const r = rnd(seed), a = pick(r, ['#c7cdd3', '#a9b8c6', '#d9cfc1', '#b5c4b1']), b = pick(r, ['#7d8a96', '#8c7b6b', '#5f7d8c']);
  return (
    <>
      <Block p={[-2.2, 0, -0.8]} s={[5, 10 + Math.round(r() * 6), 7.5]} wall={a} glass="#6aa0c8" strip />
      <Block p={[2.6, 0, 0.4]} s={[4.2, 6 + Math.round(r() * 4), 6]} wall={b} glass="#9cc7e2" />
    </>
  );
}

const SHOPS = [['BAKERY', '#d9883b'], ['PHARMACY', '#2f9e6e'], ['BOOKS', '#6b4b9a'], ['FLOWERS', '#d6457e'], ['MINIMART', '#2e86de'],
  ['PHỞ 24', '#c0392b'], ['BARBER', '#34495e'], ['PIZZA', '#e67e22'], ['TOYS', '#f1c40f'], ['PHONES', '#16a085'], ['TEA HOUSE', '#7d4f36'], ['GYM', '#2c3e50']];
function Shops({ seed }) {
  const r = rnd(seed);
  return [-3.2, 0, 3.2].map((x, i) => {
    const [name, c] = SHOPS[(seed * 7 + i * 5) % SHOPS.length], h = 3.6 + Math.round(r() * 2) * 1.6, wall = pick(r, ['#efe5d6', '#f4d9c6', '#d9e4ec', '#e9e1f5', '#f6efd2']);
    return (
      <group key={x} position={[x, 0, -0.6]}>
        <B p={[0, h / 2, 0]} s={[3.1, h, 6.6]} c={wall} />
        <B p={[0, h + 0.15, 0]} s={[3.2, 0.3, 6.7]} c="#9aa0a6" />
        {h > 4 && <B p={[0, 4.6, 3.31]} s={[2.2, 0.9, 0.04]} c="#bfe0f2" e="#bfe0f2" ei={0.3} cast={false} />}
        <B p={[0, 1.2, 3.31]} s={[2.4, 1.9, 0.04]} c="#bfe3f5" o={0.5} cast={false} />
        <Sign text={name} bg={c} p={[0, 2.55, 3.36]} w={2.8} h={0.5} />
        <mesh position={[0, 2.1, 3.85]} rotation-x={0.35}><boxGeometry args={[2.9, 0.04, 1.1]} /><meshStandardMaterial map={stripes(c, '#ffffff')} /></mesh>
      </group>
    );
  });
}

const HOUSE_WALLS = ['#f4e3c3', '#e8d0c0', '#dce8e0', '#f2f0e6', '#e6dcef', '#f6d8b8'], ROOFS = ['#b04a3a', '#5d6d7e', '#8c5a3c', '#3f6f5a', '#a0522d'];
function Houses({ seed }) {
  const r = rnd(seed);
  return (
    <>
      <Ground c="#86b366" />
      {[[-2.45, -2.3], [2.45, -2.3], [-2.45, 2.3], [2.45, 2.3]].map(([x, z], i) => {
        const w = pick(r, HOUSE_WALLS), roof = pick(r, ROOFS), h = 2.6 + (r() < 0.4 ? 2.4 : 0);
        return (
          <group key={i} position={[x, 0, z]}>
            <B p={[0, h / 2, -0.3]} s={[3.6, h, 3.2]} c={w} />
            <mesh position={[0, h + 0.75, -0.3]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[2.75, 1.5, 4]} /><meshStandardMaterial color={roof} roughness={0.8} /></mesh>
            <B p={[0.9, 0.9, 1.31]} s={[0.8, 1.8, 0.04]} c="#6e4630" />
            <B p={[-0.8, 1.5, 1.31]} s={[0.9, 0.8, 0.04]} c="#bfe0f2" e="#bfe0f2" ei={0.3} />
            {h > 3 && <B p={[0, 3.9, 1.31]} s={[1.6, 0.8, 0.04]} c="#bfe0f2" e="#bfe0f2" ei={0.3} />}
            <B p={[0, 0.3, 2.05]} s={[3.8, 0.6, 0.15]} c="#4f8a45" />
          </group>
        );
      })}
      {r() < 0.6 && <Car x={0} z={0.3} c={pick(r, ['#c0392b', '#2e86de', '#f5f6fa', '#10ac84'])} r={Math.PI / 2} />}
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
      <group position={[pond ? -2.8 : 3.2, 0, 1.6]}>
        <B p={[0, 1.1, 0]} s={[1.6, 0.08, 0.08]} c="#e84a5f" />
        {[-0.8, 0.8].map(k => <B key={k} p={[k, 0.55, 0]} s={[0.08, 1.1, 0.08]} c="#e84a5f" />)}
        <B p={[0, 0.4, 0]} s={[0.4, 0.04, 0.2]} c="#ffd166" />
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
      <Sign text="CHỢ PHIÊN · MARKET" bg="#c0392b" p={[0, 2.6, LOT - 0.2]} w={4} h={0.6} />
      {[-2, 2].map(x => <C key={x} p={[x, 1.4, LOT - 0.2]} r={0.06} h={2.8} c="#555" />)}
    </>
  );
}

function Hospital() {
  return (
    <>
      <Block p={[0, 0, -1]} s={[10, 12, 7]} wall="#f4f6f8" glass="#86b6d6" />
      <B p={[0, 1.4, 3.3]} s={[4, 2.8, 2.2]} c="#e8eef2" />
      <Sign text="CITY HOSPITAL" bg="#ffffff" fg="#c0392b" p={[0, 3.4, 4.42]} w={4} h={0.6} />
      <group position={[3.2, 9.5, 2.56]}><B p={[0, 0, 0]} s={[1.6, 0.5, 0.1]} c="#d64545" e="#d64545" ei={0.4} /><B p={[0, 0, 0]} s={[0.5, 1.6, 0.1]} c="#d64545" e="#d64545" ei={0.4} /></group>
      <group position={[-3.4, 0, 3.6]} rotation-y={Math.PI / 2}><Car x={0} z={0} c="#f4f6f8" /><B p={[0, 1.45, -0.15]} s={[0.6, 0.12, 0.3]} c="#d64545" e="#d64545" ei={0.6} /></group>
    </>
  );
}

function Mall() {
  return (
    <>
      <Block p={[0, 0, -0.8]} s={[9.8, 7, 8]} wall="#e9e4dc" glass="#6aa0c8" strip />
      <B p={[0, 1.4, 3.5]} s={[5, 2.8, 0.6]} c="#bfe3f5" o={0.55} />
      <Sign text="CITY MALL" bg="#8e44ad" p={[0, 5.6, 3.25]} w={5} h={1} />
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
      <Sign text="CENTRAL STATION · GA TRUNG TÂM" bg="#1f3a5f" p={[0, 3.9, 3.02]} w={6} h={0.6} />
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
      <Sign text="FUEL · 24/7" bg="#d64545" p={[0, 3.6, 3.26]} w={6.8} h={0.38} />
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
  houses: { draw: Houses, solid: [[-2.45, -2.6, 3.6, 3.2], [2.45, -2.6, 3.6, 3.2], [-2.45, 2, 3.6, 3.2], [2.45, 2, 3.6, 3.2]] },
  park: { draw: Park, solid: [[0, 0, 3.8, 3.8]] },
  pitch: { draw: Pitch, solid: [] },
  market: { draw: Market, solid: [] },
  hospital: { draw: Hospital, solid: [[0, -1, 10, 7], [0, 3.3, 4, 2.2]] },
  mall: { draw: Mall, solid: [[0, -0.8, 9.8, 8]] },
  station: { draw: Station, solid: [[0, 0, 9.8, 6]] },
  school: { draw: School, solid: [[0, -1, 10.5, 6.5], [0, 2.6, 3, 1.2]] },
  parking: { draw: Parking, solid: CARS5 },
  fuel: { draw: Fuel, solid: [[0, -3.5, 5, 2.6]] },
};
