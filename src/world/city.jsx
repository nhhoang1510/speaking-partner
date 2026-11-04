// The school as a little low-poly town: a grid of streets with lane markings, zebra crossings, traffic lights
// and cars driving round the blocks. Every practice scene has its own building on its own block (a café, a
// bank, a hotel, a clinic...), with a glass shop front and an open top so the overview can look inside. The
// blocks around them hold the school itself, offices, flats, shops, houses, parks, a market, a hospital, a
// station... (see blocks.jsx), and beyond the last street lies the countryside (outskirts.jsx).
//
// To grow the town: edit LAYOUT below (keep tall kinds behind or left of the practice buildings, so they don't
// hide them from the overview camera, which looks from the south-east). Each cell is a scene id (a practice building: add its look to LOOK) or
// the name of a block kind from KINDS in blocks.jsx. Add rows or columns freely: streets, pavements, walking
// routes, traffic and the countryside all follow the grid. Every building's door faces +z (towards the
// overview camera). Blocks are BLK square, P apart; streets run between them.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { B, C, S, rnd } from './props.jsx';
import { Many, Tree, Car, Lamp, tex } from './campus.jsx';
import { KINDS, Block, signTexture, stripes } from './blocks.jsx';
import { Outskirts } from './outskirts.jsx';

const LAYOUT = [
  ['houses', 'houses', 'pitch', 'offices', 'station', 'offices', 'shops', 'houses', 'houses'],
  ['houses', 'park', 'flats', 'tower', 'mall', 'tower', 'flats', 'hospital', 'houses'],
  ['shops', 'flats', 'tower', 'flats', 'school', 'tower', 'flats', 'offices', 'shops'],
  ['houses', 'offices', 'interview', 'accounting', 'finance', 'tax', 'bank', 'market', 'houses'],
  ['houses', 'shops', 'hotel', 'airport', 'park', 'doctor', 'shop', 'houses', 'houses'],
  ['houses', 'flats', 'friend', 'coffee', 'parking', 'free', 'fuel', 'shops', 'houses'],
  ['houses', 'park', 'shops', 'market', 'pitch', 'shops', 'houses', 'park', 'houses'],
  ['houses', 'houses', 'houses', 'houses', 'shops', 'houses', 'houses', 'houses', 'houses'],
];

export const P = 20, BLK = 13, ROAD = P - BLK, NC = LAYOUT[0].length, NR = LAYOUT.length;
export const colX = c => (c - (NC - 1) / 2) * P, rowZ = r => (r - (NR - 1) / 2) * P;
export const EDGE_X = (NC / 2) * P, EDGE_Z = (NR / 2) * P;      // centre lines of the outer streets
const ROADS_X = Array.from({ length: NC + 1 }, (_, k) => (k - NC / 2) * P), ROADS_Z = Array.from({ length: NR + 1 }, (_, k) => (k - NR / 2) * P);
// walking lines: the middle of the pavement all round every block
const SIDE = BLK / 2 - 0.8;
export const WALK_Z = ROADS_Z.slice(0, -1).flatMap((_, r) => [rowZ(r) - SIDE, rowZ(r) + SIDE]);
export const WALK_X = ROADS_X.slice(0, -1).flatMap((_, c) => [colX(c) - SIDE, colX(c) + SIDE]);

// every block: what stands on it, where, and a seed so repeated kinds differ
const CELLS = LAYOUT.flatMap((row, r) => row.map((id, c) => ({ id, x: colX(c), z: rowZ(r), r, c, seed: r * 31 + c * 7 + 1 })));
export const LOTS = Object.fromEntries(CELLS.map(L => [L.id, L]));      // by id (practice buildings are unique)
const cellAt = (x, z) => {
  const c = Math.round(x / P + (NC - 1) / 2), r = Math.round(z / P + (NR - 1) / 2);
  return c >= 0 && c < NC && r >= 0 && r < NR ? CELLS[r * NC + c] : null;
};

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

// walking: true where something solid stands (other buildings, parked cars, the practice buildings' walls)
export function blockedCity(x, z) {
  const L = cellAt(x, z), dx = L && x - L.x, dz = L && z - L.z;
  if (L && Math.abs(dx) < BLK / 2 && Math.abs(dz) < BLK / 2) {
    if (LOOK[L.id]) {
      const ox = IN_W / 2 + T + 0.15, oz = IN_D / 2 + T + 0.15;
      if (Math.abs(dx) > ox || Math.abs(dz) > oz) return false;                   // outside the building
      if (Math.abs(dx) < IN_W / 2 - 0.15 && Math.abs(dz) < IN_D / 2 - 0.15) return false;   // inside the room
      return !(dz > 0 && Math.abs(dx) < DOOR / 2 - 0.15);                           // the doorway
    }
    return ((KINDS[L.id] && KINDS[L.id].solid) || []).some(([a, b, w, d]) => Math.abs(dx - a) < w / 2 + 0.2 && Math.abs(dz - b) < d / 2 + 0.2);
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

function Streets() {
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
    CELLS.forEach(({ id, x, z }) => {
      const kerb = BLK / 2 - 0.4;                                                    // along the kerb, clear of the walkers
      [-4.2, 4.2].forEach(dx => out.push({ x: x + dx, z: z + kerb }));
      if (['park', 'pitch', 'houses', 'market', 'tower', 'flats'].includes(id)) return;
      [-1, 1].forEach(k => out.push({ x: x + k * kerb, z: z - 3 }));
    });
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
      {CELLS.map(({ r, c }) => (
        <group key={r + ':' + c} position={[colX(c), 0, rowZ(r)]}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 0]} receiveShadow>
            <planeGeometry args={[BLK, BLK]} /><meshStandardMaterial map={pave} roughness={0.85} />
          </mesh>
          {[[0, BLK / 2, BLK + 0.2, 0.2], [0, -BLK / 2, BLK + 0.2, 0.2], [BLK / 2, 0, 0.2, BLK], [-BLK / 2, 0, 0.2, BLK]].map(([a, b, w, d]) => (
            <B key={a + ':' + b} p={[a, 0.07, b]} s={[w, 0.14, d]} c="#c9c4ba" cast={false} />
          ))}
        </group>
      ))}
      {trees.map((t, i) => <Tree key={i} {...t} />)}
      {/* street lamps on the corners, and traffic lights at the crossroads */}
      {CELLS.map(({ r, c }) => <Lamp key={r + ':' + c} x={colX(c) + BLK / 2 - 0.4} z={rowZ(r) + BLK / 2 - 0.4} />)}
      {ROADS_X.slice(1, -1).flatMap(x => ROADS_Z.slice(1, -1).map(z => <TrafficLight key={x + ':' + z} x={x - ROAD / 2 - 0.4} z={z + ROAD / 2 + 0.4} />))}
      {PARKED.map(([x, z, along, c], i) => <Car key={i} x={x} z={z} c={c} r={along ? Math.PI / 2 : 0} />)}
      <Traffic />
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
// (rings round the middle of town, and two runs across it; direction alternates)
const LOOPS = [
  ...Array.from({ length: Math.floor(Math.min(NC, NR) / 2) }, (_, k) => {
    const x0 = ROADS_X[k], x1 = ROADS_X[NC - k], z0 = ROADS_Z[k], z1 = ROADS_Z[NR - k];
    const ring = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    return k % 2 ? ring.reverse() : ring;
  }),
  [[ROADS_X[0], ROADS_Z[Math.floor(NR / 2)]], [ROADS_X[NC], ROADS_Z[Math.floor(NR / 2)]], [ROADS_X[NC], ROADS_Z[Math.floor(NR / 2) + 1]], [ROADS_X[0], ROADS_Z[Math.floor(NR / 2) + 1]]],
  [[ROADS_X[Math.floor(NC / 2)], ROADS_Z[0]], [ROADS_X[Math.floor(NC / 2)], ROADS_Z[NR]], [ROADS_X[Math.floor(NC / 2) + 1], ROADS_Z[NR]], [ROADS_X[Math.floor(NC / 2) + 1], ROADS_Z[0]]],
];
const PAINTS = ['#e74c3c', '#f1c40f', '#2e86de', '#ffffff', '#16a085', '#e67e22', '#8e44ad', '#2c3e50'];
const MOVERS = LOOPS.flatMap((_, li) => [0, 0.34, 0.67].map((off, k) => [li, off + li * 0.11, PAINTS[(li * 3 + k) % PAINTS.length]]));
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
  return (
    <group>
      <Outskirts edgeX={EDGE_X} edgeZ={EDGE_Z} roadsX={ROADS_X} roadsZ={ROADS_Z} road={ROAD} walk={walk} />
      <Streets />
      {CELLS.filter(L => !LOOK[L.id] && KINDS[L.id]).map(L => {
        const Kind = KINDS[L.id].draw;
        return <group key={L.r + ':' + L.c} position={[L.x, 0, L.z]}><Kind seed={L.seed} /></group>;
      })}
    </group>
  );
}
