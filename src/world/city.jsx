// The school as a little low-poly city: a grid of streets with lane markings, zebra crossings, traffic lights
// and cars driving round the blocks. Every practice scene has its own building on its own block (a café, a
// bank, a hotel, a clinic...), with a glass shop front and an open top so the overview can look inside; the
// other blocks hold office towers, flats, the school itself, a park, a car park and a petrol station.
// Every building's door faces +z (towards the overview camera). Blocks are BLK square, P apart; streets run
// between them.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { B, C, S, paint, rnd } from './props.jsx';
import { Many, Tree, Car, Lamp, Bench, Clouds, tex } from './campus.jsx';

export const P = 20, BLK = 13, ROAD = P - BLK, NC = 5, NR = 4;
export const colX = c => (c - (NC - 1) / 2) * P, rowZ = r => (r - (NR - 1) / 2) * P;
export const EDGE_X = (NC / 2) * P, EDGE_Z = (NR / 2) * P;      // centre lines of the outer streets
const ROADS_X = Array.from({ length: NC + 1 }, (_, k) => (k - NC / 2) * P), ROADS_Z = Array.from({ length: NR + 1 }, (_, k) => (k - NR / 2) * P);
// walking lines: the middle of the pavement all round every block
const SIDE = BLK / 2 - 0.8;
export const WALK_Z = ROADS_Z.slice(0, -1).flatMap((_, r) => [rowZ(r) - SIDE, rowZ(r) + SIDE]);
export const WALK_X = ROADS_X.slice(0, -1).flatMap((_, c) => [colX(c) - SIDE, colX(c) + SIDE]);

// what stands on each block, back row first; scene ids are the practice buildings
const LAYOUT = [
  ['tower', 'flats', 'school', 'tower2', 'flats2'],
  ['interview', 'accounting', 'finance', 'tax', 'bank'],
  ['hotel', 'airport', 'park', 'doctor', 'shop'],
  ['friend', 'coffee', 'parking', 'free', 'fuel'],
];
export const LOTS = Object.fromEntries(LAYOUT.flatMap((row, r) => row.map((id, c) => [id, { x: colX(c), z: rowZ(r), r, c }])));

// the look of each practice building: facade, sign, floors above the shop, an awning
const LOOK = {
  interview: { c: '#5d7fa6', sign: 'NEXUS TECH · Careers', up: 9, glass: true },
  accounting: { c: '#c9a43c', sign: 'GOLDEN LEDGER Accounting', up: 4 },
  finance: { c: '#2c7a73', sign: 'HARBOR INVESTMENTS', up: 7, glass: true },
  tax: { c: '#b85a45', sign: 'CITY TAX OFFICE', up: 3.5, columns: true },
  bank: { c: '#2f3f7a', sign: 'MAPLE BANK', up: 5, columns: true },
  hotel: { c: '#7a2e3a', sign: 'GRAND LOTUS HOTEL', up: 12 },
  airport: { c: '#3f8fb4', sign: 'CITY AIR TERMINAL', up: 1.6, glass: true, plane: true },
  doctor: { c: '#e4efe9', sign: 'SUNRISE CLINIC', fg: '#c0392b', up: 3, cross: true },
  shop: { c: '#cf5f82', sign: 'URBAN STYLE', up: 3, awning: ['#cf5f82', '#ffffff'] },
  friend: { c: '#e39a4f', sign: 'HELLO CLUB · Meetup', up: 0, awning: ['#2f9e6e', '#ffffff'] },
  coffee: { c: '#7d4f36', sign: 'BEAN & BREW Coffee', up: 3, awning: ['#2f6b4f', '#f3e9d8'] },
  free: { c: '#7d68b8', sign: 'OPEN TALK Lounge', up: 0, garden: true },
};

export const roofOf = id => H + ((LOOK[id] && LOOK[id].up) || 0);   // the top of a practice building

// ---------------------------------------------------------------- textures
function signTexture(text, bg, fg = '#ffffff') {
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
function stripes(a, b) {
  return paint('stripe:' + a + b, 64, 8, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 8, 0, 8, h); } }, [6, 1]);
}

// a box with windows on its four sides and a plain roof
function Block({ p, s, wall, glass = '#7fb2d6', strip, roof = '#9aa0a6' }) {
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

// ---------------------------------------------------------------- the practice buildings
export const IN_W = 7, IN_D = 7.5, H = 3.0, T = 0.25;          // inside size, storey height, wall thickness
const DOOR = 1.8;
const glassMat = <meshStandardMaterial color="#bfe3f5" transparent opacity={0.22} roughness={0.05} metalness={0.2} depthWrite={false} />;

// the building around a room, in the room's frame (inside spans |x| < IN_W/2, |z| < IN_D/2, door at +z)
export function Storefront({ id, wall, accent, full }) {
  const L = LOOK[id] || { c: '#999', sign: id, up: 0 };
  const ox = IN_W / 2 + T / 2, oz = IN_D / 2 + T / 2, X = IN_W + 2 * T;
  const sign = useMemo(() => signTexture(L.sign, L.c === '#e4efe9' ? '#ffffff' : L.c, L.fg), [L.sign, L.c, L.fg]);
  const seg = (IN_W - DOOR) / 2;
  const pane = (key, p, s) => <mesh key={key} position={p}><boxGeometry args={s} />{glassMat}</mesh>;
  return (
    <group>
      {/* back and left walls solid; right wall and shop front glass, so the overview sees in */}
      <B p={[0, H / 2, -oz]} s={[X, H, T]} c={L.c} />
      <B p={[-ox, H / 2, 0]} s={[T, H, IN_D]} c={L.c} />
      <B p={[ox, 0.3, 0]} s={[T, 0.6, IN_D]} c={L.c} />
      <B p={[ox, H - 0.2, 0]} s={[T, 0.4, IN_D]} c={L.c} />
      {[-IN_D / 2 + 0.05, 0, IN_D / 2 - 0.05].map(z => <B key={z} p={[ox, H / 2, z]} s={[T + 0.02, H, 0.12]} c="#3a3f45" metal={0.5} />)}
      {pane('r', [ox, 1.6, 0], [0.04, 2, IN_D])}
      {[-1, 1].map(k => (
        <group key={k}>
          <B p={[k * (DOOR / 2 + seg / 2), 0.25, oz]} s={[seg, 0.5, T]} c={L.c} />
          {pane('f' + k, [k * (DOOR / 2 + seg / 2), 1.45, oz], [seg, 1.9, 0.04])}
          <B p={[k * (DOOR / 2 + 0.05), 1.2, oz]} s={[0.1, 2.4, T + 0.04]} c="#3a3f45" metal={0.5} />
          <B p={[k * (IN_W / 2 + T / 2), H / 2, oz]} s={[T + 0.02, H, T + 0.04]} c="#3a3f45" metal={0.5} />
        </group>
      ))}
      {/* fascia with the name, above the shop front */}
      <B p={[0, H - 0.2, oz]} s={[X, 0.4 + 0.4, T + 0.06]} c={L.c} />
      <mesh position={[0, H - 0.2, oz + T / 2 + 0.035]}><planeGeometry args={[X - 0.3, 0.72]} /><meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.25} /></mesh>
      {/* inside: the room's own paint on the solid walls */}
      <B p={[0, H / 2 - 0.05, -IN_D / 2 + 0.01]} s={[IN_W, H - 0.1, 0.02]} c={accent} cast={false} />
      <B p={[-IN_W / 2 + 0.01, H / 2 - 0.05, 0]} s={[0.02, H - 0.1, IN_D]} c={wall} cast={false} />
      <B p={[0, 0.06, -IN_D / 2 + 0.03]} s={[IN_W, 0.12, 0.02]} c="#5b4636" cast={false} />
      <B p={[-IN_W / 2 + 0.03, 0.06, 0]} s={[0.02, 0.12, IN_D]} c="#5b4636" cast={false} />
      {L.awning && <mesh position={[0, H - 0.75, oz + 0.6]} rotation-x={0.35}>
        <boxGeometry args={[X - 0.4, 0.05, 1.3]} /><meshStandardMaterial map={stripes(...L.awning)} />
      </mesh>}
      {L.columns && [-1, 1].map(k => <C key={k} p={[k * (DOOR / 2 + 0.45), H / 2, oz + 0.45]} r={0.17} h={H} c="#efe8dc" seg={14} />)}
      {L.columns && <B p={[0, H + 0.1, oz + 0.35]} s={[DOOR + 1.6, 0.2, 0.9]} c="#efe8dc" />}
      {L.cross && <group position={[0, H + 1.6, -0.68]}>
        <B p={[0, 0, 0]} s={[0.9, 0.3, 0.12]} c="#d64545" e="#d64545" ei={0.4} /><B p={[0, 0, 0]} s={[0.3, 0.9, 0.12]} c="#d64545" e="#d64545" ei={0.4} />
      </group>}
      {/* the floors above: standing over the back of the shop (in walking view the shop gets its roof too) */}
      {L.up > 0 && <Block p={[0, H, -oz + 1.5]} s={[X, L.up, 3.25]} wall={L.c === '#e4efe9' ? '#f4f6f5' : L.c} glass={L.glass ? '#5f8fb8' : '#7fb2d6'} strip={L.glass} />}
      {full && <>
        <B p={[0, H + 0.1, 0]} s={[X, 0.2, IN_D + 2 * T]} c="#9aa0a6" />
        <B p={[0, H - 0.01, 0]} s={[IN_W, 0.02, IN_D]} c="#fbf8f2" cast={false} />
        {[-1.7, 1.7].map(x => <B key={x} p={[x, H - 0.03, 0]} s={[1.2, 0.02, 0.5]} c="#fffdf5" e="#fff6dc" ei={1} cast={false} />)}
      </>}
      {L.plane && <Plane p={[0.6, H + L.up + 1, -2.4]} />}
      {L.garden && full && [-2.5, 0, 2.5].map(x => <S key={x} p={[x, H + 0.5, -2]} r={0.6} c="#6f9f55" />)}
    </group>
  );
}

function Plane({ p }) {                                     // a little airliner on the terminal's roof
  return (
    <group position={p} rotation-y={-0.5} scale={0.55}>
      <C p={[0, 0, 0]} r={0.55} h={7} rx={Math.PI / 2} c="#f4f6f8" seg={14} />
      <S p={[0, 0, 3.5]} r={0.55} c="#f4f6f8" sc={[1, 1, 1.4]} />
      <mesh position={[0, 0, -3.9]} rotation-x={-Math.PI / 2}><coneGeometry args={[0.55, 1.4, 14]} /><meshStandardMaterial color="#f4f6f8" /></mesh>
      <B p={[0, -0.1, 0.2]} s={[8, 0.12, 1.4]} c="#3f8fb4" />
      <B p={[0, 0.9, -3.8]} s={[0.12, 1.6, 1]} c="#3f8fb4" />
      <B p={[0, 0.05, -3.9]} s={[3, 0.1, 0.8]} c="#3f8fb4" />
      {[-1.8, 1.8].map(x => <C key={x} p={[x, -0.45, 0.4]} r={0.25} h={1} rx={Math.PI / 2} c="#9aa0a6" />)}
      <B p={[0, 0.25, 3.7]} s={[0.7, 0.2, 0.2]} c="#253040" />
    </group>
  );
}

// ---------------------------------------------------------------- the other blocks
function School({ x, z }) {
  const sign = useMemo(() => signTexture('TRƯỜNG THPT NGUYỄN THÁI HỌC', '#1f5e46'), []);
  return (
    <group position={[x, 0, z]}>
      <Block p={[0, 0, -1]} s={[10.5, 9.6, 6.5]} wall="#f1e3c6" glass="#86b6d6" roof="#b04a3a" />
      <B p={[0, 1.6, 2.6]} s={[3, 3.2, 1.2]} c="#e7d3ad" />
      <mesh position={[0, 3.6, 3.22]}><planeGeometry args={[7, 0.9]} /><meshStandardMaterial map={sign} /></mesh>
      <B p={[0, 3.6, 3.15]} s={[7.2, 1.0, 0.1]} c="#1f5e46" />
      <C p={[3.8, 4, 4.3]} r={0.06} h={8} c="#ccc" metal={0.6} seg={8} />
      <B p={[4.35, 7.4, 4.3]} s={[1.1, 0.7, 0.03]} c="#da251d" />
      <S p={[4.35, 7.4, 4.33]} r={0.12} c="#ffde00" sc={[1, 1, 0.2]} />
    </group>
  );
}

function Park({ x, z }) {
  const jet = useRef();
  useFrame(({ clock }) => { if (jet.current) jet.current.scale.y = 1 + Math.sin(clock.elapsedTime * 4) * 0.08; });
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.02, 0]} s={[BLK - 3.2, 0.04, BLK - 3.2]} c="#7fb562" cast={false} />
      <B p={[0, 0.045, 0]} s={[BLK - 3.2, 0.01, 1.6]} c="#e3d9c6" cast={false} />
      <B p={[0, 0.045, 0]} s={[1.6, 0.01, BLK - 3.2]} c="#e3d9c6" cast={false} />
      <C p={[0, 0.25, 0]} r={1.8} h={0.5} c="#cfc8bc" seg={32} />
      <C p={[0, 0.46, 0]} r={1.65} h={0.06} c="#5fb3d6" seg={32} rough={0.1} />
      <C p={[0, 0.8, 0]} r={0.16} h={0.8} c="#cfc8bc" seg={12} />
      <mesh ref={jet} position={[0, 1.5, 0]} userData={{ live: true }}><coneGeometry args={[0.5, 0.9, 16, 1, true]} /><meshStandardMaterial color="#9fdcf5" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      {[[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]].map(([a, b], i) => <Tree key={i} x={a} z={b} k={0.85} pine={i === 1} />)}
      <Bench x={-2.6} z={0.95} r={Math.PI} /><Bench x={2.6} z={-0.95} />
      {/* a little playground */}
      <group position={[3.2, 0, 1.6]}>
        <B p={[0, 1.1, 0]} s={[1.6, 0.08, 0.08]} c="#e84a5f" />
        {[-0.8, 0.8].map(k => <B key={k} p={[k, 0.55, 0]} s={[0.08, 1.1, 0.08]} c="#e84a5f" />)}
        <B p={[0, 0.4, 0]} s={[0.4, 0.04, 0.2]} c="#ffd166" />
      </group>
    </group>
  );
}

function Parking({ x, z }) {
  const cars = [[-2.6, -2.2, '#c0392b'], [0, -2.2, '#2e86de'], [2.6, -2.2, '#f5f6fa'], [-2.6, 2.6, '#10ac84'], [2.6, 2.6, '#f6b93b']];
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.02, 0]} s={[BLK - 3.2, 0.04, BLK - 3.2]} c="#55595e" cast={false} />
      {[-3.9, -1.3, 1.3, 3.9].flatMap(a => [-2.2, 2.6].map(b => <B key={a + ':' + b} p={[a, 0.045, b]} s={[0.1, 0.01, 4]} c="#f2f2f2" cast={false} />))}
      {cars.map(([a, b, c]) => <Car key={a + ':' + b} x={a} z={b} c={c} r={b < 0 ? 0 : Math.PI} />)}
      <B p={[0, 2.5, -4.6]} s={[2.4, 0.9, 0.1]} c="#2e86de" /><B p={[0, 2.5, -4.54]} s={[0.5, 0.6, 0.02]} c="#ffffff" />
      <C p={[0, 1.2, -4.65]} r={0.06} h={2.4} c="#666" />
    </group>
  );
}

function Fuel({ x, z }) {
  const sign = useMemo(() => signTexture('FUEL · 24/7', '#d64545'), []);
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.02, 0]} s={[BLK - 3.2, 0.04, BLK - 3.2]} c="#cfd3d6" cast={false} />
      <B p={[0, 3.6, 1]} s={[7, 0.4, 4.5]} c="#f4f4f4" />
      <mesh position={[0, 3.6, 3.26]}><planeGeometry args={[6.8, 0.38]} /><meshStandardMaterial map={sign} /></mesh>
      {[[-3, -1], [3, -1], [-3, 3], [3, 3]].map(([a, b]) => <B key={a + ':' + b} p={[a, 1.7, b]} s={[0.25, 3.4, 0.25]} c="#d64545" />)}
      {[-1.5, 1.5].map(a => <group key={a} position={[a, 0, 1]}><B p={[0, 0.7, 0]} s={[0.6, 1.4, 0.4]} c="#e8e8e8" /><B p={[0, 1.1, 0.21]} s={[0.4, 0.3, 0.02]} c="#253040" /></group>)}
      <Block p={[0, 0, -3.5]} s={[5, 3, 2.6]} wall="#d64545" glass="#bfe3f5" />
    </group>
  );
}

function Filler({ id, x, z }) {
  if (id === 'tower') return <group position={[x, 0, z]}><Block p={[0, 0, 0]} s={[9, 22, 8]} wall="#8fa8bf" glass="#4f7ea8" strip /><B p={[0, 22.8, 0]} s={[4, 1.2, 3]} c="#d7dadd" /></group>;
  if (id === 'tower2') return <group position={[x, 0, z]}><Block p={[-1, 0, 0]} s={[7, 28, 7]} wall="#3d4f63" glass="#6aa0c8" strip /><Block p={[3.2, 0, 1]} s={[4, 12, 6]} wall="#56708a" glass="#7fb2d6" /></group>;
  if (id === 'flats' || id === 'flats2') {
    const c = id === 'flats' ? '#e6c3a5' : '#b9d3c4';
    const balconies = [];
    for (let y = 3; y < 14; y += 3) for (let a = -3; a <= 3; a += 2) balconies.push([a, y - 1.3, 3.65]);
    return (
      <group position={[x, 0, z]}>
        <Block p={[0, 0, -0.5]} s={[9.5, 14, 7.5]} wall={c} />
        {balconies.map(([a, y, b]) => <group key={a + ':' + y}><B p={[a, y, b]} s={[1.5, 0.1, 0.9]} c="#f4f1ea" /><B p={[a, y + 0.45, b + 0.42]} s={[1.5, 0.8, 0.05]} c="#ffffff" o={0.7} /></group>)}
      </group>
    );
  }
  if (id === 'school') return <School x={x} z={z} />;
  if (id === 'park') return <Park x={x} z={z} />;
  if (id === 'parking') return <Parking x={x} z={z} />;
  if (id === 'fuel') return <Fuel x={x} z={z} />;
  return null;
}
// solid footprints of the other blocks, for walking (relative to the block centre)
const SOLID = {
  tower: [[0, 0, 9, 8]], tower2: [[-1, 0, 7, 7], [3.2, 1, 4, 6]], flats: [[0, -0.5, 9.5, 7.5]], flats2: [[0, -0.5, 9.5, 7.5]],
  school: [[0, -1, 10.5, 6.5], [0, 2.6, 3, 1.2]], fuel: [[0, -3.5, 5, 2.6]],
  parking: [[-2.6, -2.2, 1.9, 4.2], [0, -2.2, 1.9, 4.2], [2.6, -2.2, 1.9, 4.2], [-2.6, 2.6, 1.9, 4.2], [2.6, 2.6, 1.9, 4.2]],
  park: [[0, 0, 3.8, 3.8]],
};

// walking: true where something solid stands (other buildings, parked cars, the practice buildings' walls)
export function blockedCity(x, z) {
  for (const [id, L] of Object.entries(LOTS)) {
    const dx = x - L.x, dz = z - L.z;
    if (Math.abs(dx) > BLK / 2 || Math.abs(dz) > BLK / 2) continue;
    if (LOOK[id]) {
      const ox = IN_W / 2 + T + 0.15, oz = IN_D / 2 + T + 0.15;
      if (Math.abs(dx) > ox || Math.abs(dz) > oz) return false;                   // outside the building
      if (Math.abs(dx) < IN_W / 2 - 0.15 && Math.abs(dz) < IN_D / 2 - 0.15) return false;   // inside the room
      return !(dz > 0 && Math.abs(dx) < DOOR / 2 - 0.15);                           // the doorway
    }
    return (SOLID[id] || []).some(([a, b, w, d]) => Math.abs(dx - a) < w / 2 + 0.2 && Math.abs(dz - b) < d / 2 + 0.2);
  }
  return PARKED.some(([a, b, r]) => Math.abs(x - a) < (r ? 2.3 : 1.15) && Math.abs(z - b) < (r ? 1.15 : 2.3));
}

// ---------------------------------------------------------------- streets
// cars parked along the kerbs: [x, z, along x?]
const PARKED = (() => {
  const r = rnd(31), out = [], cols = ['#c0392b', '#2e86de', '#f5f6fa', '#222f3e', '#10ac84', '#f6b93b', '#8e44ad', '#e67e22'];
  ROADS_Z.forEach(z => ROADS_X.slice(0, -1).forEach(x0 => { if (r() < 0.45) out.push([x0 + P / 2 + (r() - 0.5) * 6, z + (r() < 0.5 ? -1 : 1) * 2.6, 1, cols[Math.floor(r() * 8)]]); }));
  ROADS_X.forEach(x => ROADS_Z.slice(0, -1).forEach(z0 => { if (r() < 0.35) out.push([x + (r() < 0.5 ? -1 : 1) * 2.6, z0 + P / 2 + (r() - 0.5) * 6, 0, cols[Math.floor(r() * 8)]]); }));
  return out;
})();

function Streets({ walk }) {
  const W = 2 * EDGE_X + ROAD, D = 2 * EDGE_Z + ROAD;
  const asphalt = useMemo(() => tex('asphalt', [W / 8, D / 8]), []);
  const pave = useMemo(() => tex('paving', [BLK / 2, BLK / 2]), []);
  const marks = useMemo(() => {
    const dash = [], zebra = [], kerb = [];
    const inX = x => ROADS_X.some(rx => Math.abs(x - rx) < ROAD / 2 + 2.2), inZ = z => ROADS_Z.some(rz => Math.abs(z - rz) < ROAD / 2 + 2.2);
    ROADS_Z.forEach(z => { for (let x = -EDGE_X; x <= EDGE_X; x += 2.5) if (!inX(x)) dash.push([x, 0.02, z, 1, 0]); });
    ROADS_X.forEach(x => { for (let z = -EDGE_Z; z <= EDGE_Z; z += 2.5) if (!inZ(z)) dash.push([x, 0.02, z, 1, Math.PI / 2]); });
    // zebra crossings on every side of every crossroads
    ROADS_X.forEach(x => ROADS_Z.forEach(z => {
      for (let k = -2; k <= 2; k++) {
        const o = k * 1.1;
        for (const k2 of [-1, 1]) {
          const zz = z + k2 * (ROAD / 2 + 1.2), xx = x + k2 * (ROAD / 2 + 1.2);
          if (Math.abs(zz) < EDGE_Z) zebra.push([x + o, 0.02, zz, 1, 0]);                 // across the street running north-south
          if (Math.abs(xx) < EDGE_X) zebra.push([xx, 0.02, z + o, 1, Math.PI / 2]);       // across the one running east-west
        }
      }
    }));
    return { dash, zebra };
  }, []);
  const trees = useMemo(() => {
    const out = [];
    LAYOUT.forEach((row, r) => row.forEach((id, c) => {
      const x = colX(c), z = rowZ(r);
      const kerb = BLK / 2 - 0.4;                                                    // along the kerb, clear of the walkers
      [-4.2, 4.2].forEach(dx => out.push({ x: x + dx, z: z + kerb }));
      if (r === 0 || id === 'park') return;
      [-1, 1].forEach(k => out.push({ x: x + k * kerb, z: z - 3 }));
    }));
    return out.map((t, i) => ({ ...t, k: 0.62, pine: i % 4 === 3 }));
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[W, D]} /><meshStandardMaterial map={asphalt} roughness={0.95} />
      </mesh>
      <Many geo={<boxGeometry args={[1.3, 0.01, 0.14]} />} c="#f2e6a0" cast={false} at={marks.dash} />
      <Many geo={<boxGeometry args={[0.55, 0.01, 1.9]} />} c="#f4f4f4" cast={false} at={marks.zebra} />
      {/* blocks: a paved pavement all round with a kerb */}
      {LAYOUT.flatMap((row, r) => row.map((id, c) => (
        <group key={id} position={[colX(c), 0, rowZ(r)]}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 0]} receiveShadow>
            <planeGeometry args={[BLK, BLK]} /><meshStandardMaterial map={pave} roughness={0.85} />
          </mesh>
          {[[0, BLK / 2, BLK + 0.2, 0.2], [0, -BLK / 2, BLK + 0.2, 0.2], [BLK / 2, 0, 0.2, BLK], [-BLK / 2, 0, 0.2, BLK]].map(([a, b, w, d]) => (
            <B key={a + ':' + b} p={[a, 0.07, b]} s={[w, 0.14, d]} c="#c9c4ba" cast={false} />
          ))}
        </group>
      )))}
      {trees.map((t, i) => <Tree key={i} {...t} />)}
      {/* street lamps on the corners, and traffic lights at the crossroads */}
      {LAYOUT.flatMap((row, r) => row.map((_, c) => <Lamp key={r + ':' + c} x={colX(c) + BLK / 2 - 0.4} z={rowZ(r) + BLK / 2 - 0.4} />))}
      {ROADS_X.slice(1, -1).flatMap(x => ROADS_Z.slice(1, -1).map(z => <TrafficLight key={x + ':' + z} x={x - ROAD / 2 - 0.4} z={z + ROAD / 2 + 0.4} />))}
      {PARKED.map(([x, z, along, c], i) => <Car key={i} x={x} z={z} c={c} r={along ? Math.PI / 2 : 0} />)}
      <Traffic />
      {walk && <Clouds />}
    </group>
  );
}

function TrafficLight({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <C p={[0, 1.6, 0]} r={0.06} h={3.2} c="#3a3f45" metal={0.5} seg={8} />
      <B p={[0, 3.3, 0]} s={[0.3, 0.85, 0.25]} c="#2b2f33" />
      {[['#e74c3c', 3.58], ['#f1c40f', 3.3], ['#2ecc71', 3.02]].map(([c, y]) => <S key={y} p={[0, y, 0.13]} r={0.09} c={c} e={c} />)}
    </group>
  );
}

// cars driving round the blocks, on the right-hand side of the road
const LOOPS = [
  [[-EDGE_X, -EDGE_Z], [EDGE_X, -EDGE_Z], [EDGE_X, EDGE_Z], [-EDGE_X, EDGE_Z]],
  [[ROADS_X[1], ROADS_Z[1]], [ROADS_X[1], ROADS_Z[3]], [ROADS_X[4], ROADS_Z[3]], [ROADS_X[4], ROADS_Z[1]]],
  [[ROADS_X[2], ROADS_Z[0]], [ROADS_X[3], ROADS_Z[0]], [ROADS_X[3], ROADS_Z[4]], [ROADS_X[2], ROADS_Z[4]]],
  [[ROADS_X[0], ROADS_Z[2]], [ROADS_X[5], ROADS_Z[2]], [ROADS_X[5], ROADS_Z[3]], [ROADS_X[0], ROADS_Z[3]]],
];
const MOVERS = [[0, 0, '#e74c3c'], [0, 0.5, '#f1c40f'], [1, 0.1, '#2e86de'], [1, 0.6, '#ffffff'], [2, 0.3, '#16a085'], [3, 0.2, '#e67e22'], [3, 0.7, '#8e44ad']];
function Traffic() {
  const refs = useRef([]);
  const loops = useMemo(() => LOOPS.map(pts => {
    const segs = pts.map((a, i) => { const b = pts[(i + 1) % pts.length]; return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) }; });
    return { segs, len: segs.reduce((s, x) => s + x.len, 0) };
  }), []);
  useFrame(({ clock }) => {
    MOVERS.forEach(([li, off], i) => {
      const g = refs.current[i]; if (!g) return;
      const L = loops[li]; let s = ((clock.elapsedTime * 6 / L.len + off) % 1) * L.len;
      const seg = L.segs.find(x => (s -= x.len) < 0) || L.segs[0];
      const k = 1 + s / seg.len, dx = (seg.b[0] - seg.a[0]) / seg.len, dz = (seg.b[1] - seg.a[1]) / seg.len;
      g.position.set(seg.a[0] + (seg.b[0] - seg.a[0]) * k - dz * 0.9, 0, seg.a[1] + (seg.b[1] - seg.a[1]) * k + dx * 0.9);
      g.rotation.y = Math.atan2(dx, dz);
    });
  });
  return MOVERS.map(([, , c], i) => (
    <group key={i} ref={el => { refs.current[i] = el; }} userData={{ live: true }}><Car x={0} z={0} c={c} /></group>
  ));
}

// ---------------------------------------------------------------- the whole town
export function City({ walk }) {
  const grass = useMemo(() => tex('grass', [60, 60]), []);
  // far-off buildings all round, so the town doesn't end at the last street
  const skyline = useMemo(() => {
    const r = rnd(5), out = [];
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2, d = 78 + r() * 24;
      const front = Math.cos(a) * 0.6 + Math.sin(a) * 0.8 > -0.1;                      // between the overview camera and the town
      out.push({ front, x: Math.cos(a) * d * 1.15, z: Math.sin(a) * d * 0.95, w: 6 + r() * 8, h: 6 + r() * 26, d: 6 + r() * 8, c: ['#b8c4cf', '#c9bfb2', '#a9b8a8', '#d0c7d6'][i % 4] });
    }
    return out;
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow><planeGeometry args={[400, 400]} /><meshStandardMaterial map={grass} /></mesh>
      {[[-170, -90, 50], [-120, 120, 40], [60, -170, 55], [150, 110, 45], [-200, 30, 60]].map(([x, z, r]) => (
        <mesh key={x} position={[x, -r * 0.6, z]} scale={[1, 0.6, 1]}><sphereGeometry args={[r, 24, 12]} /><meshStandardMaterial color="#8fb27a" /></mesh>
      ))}
      {skyline.filter(b => walk || !b.front).map((b, i) => <B key={i} p={[b.x, b.h / 2, b.z]} s={[b.w, b.h, b.d]} c={b.c} />)}
      <Streets walk={walk} />
      {Object.entries(LOTS).filter(([id]) => !LOOK[id]).map(([id, L]) => <Filler key={id} id={id} x={L.x} z={L.z} />)}
    </group>
  );
}
