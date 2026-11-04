// Everything outside the classrooms: the building's brick shell, windows, roof and front entrance, and the
// school grounds around it (plaza with a fountain and flags, a car park, a basketball court, a football
// pitch, a garden with a gazebo, trees, lamps, a fence, the street and the town beyond).
// The building occupies X0 < x < BX, |z| < BZ (six rooms a side); the front door is at x = BX, |z| < 1.5.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { B, C, S, Window, paint, rnd } from './props.jsx';

export const COLS = 6, X0 = -28, BX = 14, BZ = 9, FENCE = { x0: -58, x1: 33.6, z0: -30, z1: 30 }, GATE = 2.6;
export const CX = (X0 + BX) / 2, LEN = BX - X0;
export const ROOM_XS = Array.from({ length: COLS }, (_, k) => X0 + 3.5 + k * 7);

// ---------------------------------------------------------------- textures
function tex(kind, repeat) {
  return paint(kind, 256, 256, (g, w, h) => {
    const r = rnd(kind.length * 131 + 7);
    if (kind === 'grass') {
      g.fillStyle = '#86b366'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `hsla(${88 + r() * 30}, 45%, ${32 + r() * 30}%, .45)`; g.fillRect(r() * w, r() * h, 1.5, 3); }
    } else if (kind === 'brick') {
      g.fillStyle = '#d9d2c5'; g.fillRect(0, 0, w, h);
      const bh = h / 16, bw = w / 4;
      for (let y = 0; y < 16; y++) for (let x = -1; x < 5; x++) {
        const d = (r() - 0.5) * 30;
        g.fillStyle = `rgb(${172 + d},${88 + d * 0.6},${66 + d * 0.5})`;
        g.fillRect(x * bw + (y % 2) * bw / 2 + 1.5, y * bh + 1.5, bw - 3, bh - 3);
      }
    } else if (kind === 'asphalt') {
      g.fillStyle = '#5d6166'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '30,30,30' : '150,150,150'},.25)`; g.fillRect(r() * w, r() * h, 2, 2); }
    } else if (kind === 'paving') {
      g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, w, h);
      const n = 8, s = w / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const d = (r() - 0.5) * 22;
        g.fillStyle = `rgb(${222 + d},${212 + d},${196 + d})`; g.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
      }
    } else if (kind === 'pitch') {                    // mown stripes
      for (let y = 0; y < 8; y++) { g.fillStyle = y % 2 ? '#6fa653' : '#7db55f'; g.fillRect(0, y * h / 8, w, h / 8); }
    }
  }, repeat);
}

// one mesh drawn many times (fence posts, flowers, tree trunks...)
function Many({ at, geo, c, cast = true, e }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    at.forEach(([x, y, z, k = 1, ry = 0], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry); s.set(k, k, k);
      ref.current.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q, s));
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [at]);
  return (
    <instancedMesh ref={ref} args={[null, null, at.length]} castShadow={cast} receiveShadow>
      {geo}
      <meshStandardMaterial color={c} emissive={e || '#000'} emissiveIntensity={e ? 1 : 0} />
    </instancedMesh>
  );
}

const Flat = ({ x, z, w, d, y = 0.01, c = '#fff', map, r = 0 }) => (
  <mesh rotation={[-Math.PI / 2, 0, r]} position={[x, y, z]} receiveShadow>
    <planeGeometry args={[w, d]} /><meshStandardMaterial color={c} map={map} />
  </mesh>
);

// ---------------------------------------------------------------- the building's outside
export function Shell({ full, tall, low }) {
  const brick = useMemo(() => tex('brick', [6, 1]), []);
  const brickS = useMemo(() => tex('brick', [3, 1]), []);
  const hN = full ? 2.8 : tall, hS = full ? 2.8 : low, hW = full ? 2.8 : tall, hE = full ? 2.8 : low;
  const skin = (key, x, z, w, d, h, map) => (
    <group key={key}>
      <B p={[x, h / 2, z]} s={[w, h, d]} c="#fff" map={map} />
      <B p={[x, 0.18, z]} s={[w + (d < w ? 0.04 : 0.12), 0.36, d < w ? d + 0.12 : d + 0.04]} c="#7b7670" />
      {full && <B p={[x, h - 0.08, z]} s={[w + (d < w ? 0.1 : 0.16), 0.16, d < w ? d + 0.16 : d + 0.1]} c="#efe8dc" />}
    </group>
  );
  const o = 0.16;                                    // skin sits just outside the walls
  const eSeg = (BZ - 1.5) + 0.1;
  return (
    <group>
      {skin('n', CX, -BZ - o, LEN + 0.4, 0.08, hN, brick)}
      {skin('s', CX, BZ + o, LEN + 0.4, 0.08, hS, brick)}
      {skin('w', X0 - o, 0, 0.08, 2 * BZ + 0.4, hW, brick)}
      {skin('e1', BX + o, -(1.5 + BZ) / 2 - 0.05, 0.08, eSeg + 0.2, hE, brickS)}
      {skin('e2', BX + o, (1.5 + BZ) / 2 + 0.05, 0.08, eSeg + 0.2, hE, brickS)}
      {/* windows seen from outside, matching the ones inside */}
      {(hN > 2 ? ROOM_XS : []).flatMap(x => [x - 1.7, x + 1.7]).map(x => <Window key={'wn' + x} p={[x, 1.45, -BZ - o - 0.09]} r={Math.PI} w={1.6} />)}
      {full && ROOM_XS.flatMap(x => [x - 1.7, x + 1.7]).map(x => <Window key={'ws' + x} p={[x, 1.45, BZ + o + 0.09]} w={1.6} />)}
      {full && ROOM_XS.flatMap(x => [x - 1.7, x + 1.7]).map(x => <Window key={'wsi' + x} p={[x, 1.45, BZ - 0.18]} r={Math.PI} w={1.6} />)}
      {hW > 2 && [-5.25, 5.65].map(z => <Window key={'ww' + z} p={[X0 - o - 0.09, 1.45, z]} r={-Math.PI / 2} w={2.2} />)}
      {full && [-5.5, 5.5].map(z => <Window key={'we' + z} p={[BX + o + 0.09, 1.45, z]} r={Math.PI / 2} w={2.6} />)}
      <Entrance full={full} />
      {full && <Roof />}
      {/* shrubs along the walls */}
      <Many geo={<sphereGeometry args={[0.45, 10, 8]} />} c="#5c8f4e"
        at={useMemo(() => [
          ...ROOM_XS.flatMap(x => [x - 3.2, x, x + 3.2]).map(x => [x, 0.3, -BZ - 0.75, 1]),
          ...ROOM_XS.flatMap(x => [x - 3.2, x, x + 3.2]).map(x => [x, 0.3, BZ + 0.75, 1]),
          ...[-7, -2.5, 2.5, 7].map(z => [X0 - 0.75, 0.3, z, 0.9]),
          ...[-7.5, -4, 4, 7.5].map(z => [BX + 0.75, 0.3, z, 0.9]),
        ], [])} />
    </group>
  );
}

function Entrance({ full }) {
  const h = full ? 2.6 : 0.6;
  return (
    <group position={[BX, 0, 0]}>
      {/* door frame and glass doors slid open */}
      {[-1.55, 1.55].map(z => <B key={z} p={[0.2, h / 2, z]} s={[0.2, h, 0.16]} c="#4b5560" metal={0.5} rough={0.35} />)}
      {full && <B p={[0.2, 2.65, 0]} s={[0.2, 0.2, 3.3]} c="#4b5560" metal={0.5} rough={0.35} />}
      {full && [-2.05, 2.05].map(z => <B key={z} p={[0.3, 1.25, z]} s={[0.05, 2.5, 1]} c="#a9d3ea" o={0.45} rough={0.05} cast={false} />)}
      {/* steps and canopy on its two pillars */}
      {[0, 1, 2].map(k => <B key={k} p={[0.9 + k * 0.45, 0.05 - k * 0.03, 0]} s={[0.5, 0.1, 4.2 - k * 0.2]} c="#d8d2c8" />)}
      <B p={[0.75, 0.012, 0]} s={[1.1, 0.02, 1.8]} c="#7a3d31" cast={false} />
      {full && <>
        <B p={[1.6, 2.95, 0]} s={[3.4, 0.18, 5]} c="#f1ece3" />
        <B p={[3.25, 2.95, 0]} s={[0.12, 0.3, 5]} c="#c25b3c" />
        {[-2.2, 2.2].map(z => <C key={z} p={[3, 1.43, z]} r={0.14} h={2.86} c="#f1ece3" />)}
        {[-2.2, 2.2].map(z => <Many key={'l' + z} geo={<sphereGeometry args={[0.12, 10, 8]} />} c="#fff6d6" e="#ffe2a0" at={[[1.6, 2.8, z * 0.6]]} />)}
      </>}
    </group>
  );
}

function Roof() {
  const w = LEN + 0.6, d = 2 * BZ + 0.6;
  return (
    <group position={[CX, 2.88, 0]}>
      <B p={[0, 0.08, 0]} s={[w, 0.16, d]} c="#9aa0a6" />
      {[[0, -d / 2, w, 0.2], [0, d / 2, w, 0.2], [-w / 2, 0, 0.2, d], [w / 2, 0, 0.2, d]].map(([x, z, a, b]) => (
        <B key={x + ':' + z} p={[x, 0.4, z]} s={[a, 0.5, b]} c="#efe8dc" />
      ))}
      {/* air conditioners, a water tank and solar panels */}
      {[-16, -9, -2].map(x => <group key={x} position={[x, 0.16, -5]}>
        <B p={[0, 0.35, 0]} s={[1.2, 0.7, 0.9]} c="#d7dadd" metal={0.3} />
        <C p={[0, 0.71, 0]} r={0.3} h={0.04} c="#555" />
      </group>)}
      <C p={[14, 0.9, -5]} r={0.7} h={1.5} c="#e9edf0" metal={0.4} />
      {[-14, -10, -6, -2, 2, 6, 10, 14].map(x => [2.5, 5].map(z => (
        <mesh key={x + ':' + z} position={[x, 0.55, z]} rotation-x={-0.5} castShadow>
          <boxGeometry args={[3.4, 0.06, 2]} /><meshStandardMaterial color="#26375a" metalness={0.6} roughness={0.25} />
        </mesh>
      )))}
    </group>
  );
}

// ---------------------------------------------------------------- the grounds
const TREES = (() => {
  const r = rnd(4242), out = [];
  // along the fence
  for (let x = FENCE.x0 + 3; x < FENCE.x1 - 2; x += 6.5) { out.push([x, FENCE.z0 + 2.2]); if (x < 14 || x > 34) out.push([x, FENCE.z1 - 2.2]); }
  for (let z = FENCE.z0 + 8; z < FENCE.z1 - 6; z += 7) out.push([FENCE.x0 + 2.2, z]);
  // scattered on the lawns
  [[-25, -18], [-22, 17], [-30, 22], [8, -17], [12, -22], [-16, 13], [-1, 24], [6, 14], [-33, -20], [-34, 12], [-52, -20], [-52, 18],
   [17, -10], [27, -11], [17, 10.5], [27, -22], [-18, -24]].forEach(p => out.push(p));
  return out.map(([x, z], i) => ({ x, z, k: 0.85 + r() * 0.5, pine: i % 3 === 1 }));
})();
const CARS = [[20, 14, '#c0392b'], [23, 14, '#2e86de'], [29, 14, '#f5f6fa'], [20, 24, '#222f3e'], [26, 24, '#10ac84'], [29, 24, '#f6b93b']];
const FOUNTAIN = { x: 22, z: 0, r: 1.9 };

// solid things outside, for walking: true when (x, z) is taken
export function blockedOutside(x, z) {
  if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < FOUNTAIN.r + 0.3) return true;
  if (TREES.some(t => Math.hypot(x - t.x, z - t.z) < 0.45)) return true;
  if (CARS.some(([cx, cz]) => Math.abs(x - cx) < 1.15 && Math.abs(z - cz) < 2.3)) return true;
  if ([17.5, 18.5, 19.5].some(fx => Math.hypot(x - fx, z + 5.5) < 0.3)) return true;
  if (Math.abs(x - BX - 3) < 0.35 && Math.abs(Math.abs(z) - 2.2) < 0.35) return true;   // canopy pillars
  return false;
}

function Tree({ x, z, k, pine }) {
  return (
    <group position={[x, 0, z]} scale={k}>
      <C p={[0, 0.9, 0]} r={0.16} r2={0.22} h={1.8} c="#7a5236" seg={8} />
      {pine ? <>
        <mesh position={[0, 2.4, 0]} castShadow><coneGeometry args={[1.3, 2.2, 9]} /><meshStandardMaterial color="#3f7a4f" /></mesh>
        <mesh position={[0, 3.6, 0]} castShadow><coneGeometry args={[0.95, 1.8, 9]} /><meshStandardMaterial color="#4a8a5a" /></mesh>
      </> : <>
        <S p={[0, 2.5, 0]} r={1.25} c="#6f9f55" /><S p={[0.6, 3.1, 0.3]} r={0.85} c="#7fb062" />
        <S p={[-0.55, 2.9, -0.35]} r={0.8} c="#66954e" />
      </>}
    </group>
  );
}

function Car({ x, z, c, r = 0 }) {
  return (
    <group position={[x, 0, z]} rotation-y={r}>
      <B p={[0, 0.55, 0]} s={[1.75, 0.6, 4.1]} c={c} metal={0.5} rough={0.3} />
      <B p={[0, 1.08, -0.15]} s={[1.55, 0.5, 2.1]} c="#253040" metal={0.3} rough={0.15} />
      <B p={[0, 1.35, -0.15]} s={[1.5, 0.05, 1.9]} c={c} metal={0.5} rough={0.3} />
      {[-1.3, 1.3].flatMap(dz => [-0.85, 0.85].map(dx => <C key={dx + ':' + dz} p={[dx, 0.33, dz]} r={0.33} h={0.24} rz={Math.PI / 2} c="#1e1e1e" seg={14} />))}
      {[-0.6, 0.6].map(dx => <B key={dx} p={[dx, 0.62, 2.06]} s={[0.35, 0.14, 0.02]} c="#fff8d8" e="#fff3c0" ei={0.4} cast={false} />)}
      {[-0.6, 0.6].map(dx => <B key={'t' + dx} p={[dx, 0.66, -2.06]} s={[0.35, 0.12, 0.02]} c="#c0392b" e="#c0392b" ei={0.3} cast={false} />)}
    </group>
  );
}

function Lamp({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <C p={[0, 1.6, 0]} r={0.05} h={3.2} c="#3a3f45" metal={0.6} seg={8} />
      <C p={[0, 3.25, 0]} r={0.08} r2={0.22} h={0.22} c="#3a3f45" metal={0.6} seg={10} />
      <S p={[0, 3.1, 0]} r={0.13} c="#fff6d6" e="#ffe8b0" />
    </group>
  );
}

function Bench({ x, z, r = 0 }) {
  return (
    <group position={[x, 0, z]} rotation-y={r}>
      {[0, 0.13, 0.26].map(dz => <B key={dz} p={[0, 0.45, dz - 0.13]} s={[1.6, 0.05, 0.1]} c="#a8744b" />)}
      {[0.75, 0.88].map(y => <B key={y} p={[0, y, -0.22]} s={[1.6, 0.08, 0.04]} c="#a8744b" />)}
      {[-0.7, 0.7].map(dx => <B key={dx} p={[dx, 0.22, 0]} s={[0.06, 0.44, 0.45]} c="#3a3f45" metal={0.5} />)}
    </group>
  );
}

function Flag({ x, z, c1, c2, h = 6, phase = 0 }) {
  const geo = useMemo(() => new THREE.PlaneGeometry(1.5, 1, 12, 4), []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);
  const ref = useRef();
  useFrame(({ clock }) => {
    const a = geo.attributes.position.array, t = clock.elapsedTime * 3 + phase;
    for (let i = 0; i < a.length; i += 3) { const u = base[i] + 0.75; a[i + 2] = Math.sin(u * 3 - t) * 0.12 * u; }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
  });
  const map = useMemo(() => paint('flag' + c1 + c2, 64, 32, (g, w, hh) => {
    g.fillStyle = c1; g.fillRect(0, 0, w, hh); g.fillStyle = c2; g.fillRect(0, hh / 3, w, hh / 3);
  }, [1, 1]), [c1, c2]);
  return (
    <group position={[x, 0, z]} userData={{ live: true }}>
      <C p={[0, h / 2, 0]} r={0.05} h={h} c="#d8dde2" metal={0.7} rough={0.3} seg={8} />
      <S p={[0, h + 0.05, 0]} r={0.08} c="#e5c46b" />
      <mesh ref={ref} geometry={geo} position={[0.78, h - 0.6, 0]} castShadow>
        <meshStandardMaterial map={map} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Fountain() {
  const jet = useRef();
  useFrame(({ clock }) => { if (jet.current) jet.current.scale.y = 1 + Math.sin(clock.elapsedTime * 4) * 0.08; });
  return (
    <group position={[FOUNTAIN.x, 0, FOUNTAIN.z]}>
      <C p={[0, 0.25, 0]} r={FOUNTAIN.r} h={0.5} c="#cfc8bc" seg={32} />
      <C p={[0, 0.46, 0]} r={FOUNTAIN.r - 0.15} h={0.06} c="#5fb3d6" seg={32} rough={0.1} />
      <C p={[0, 0.8, 0]} r={0.18} h={0.8} c="#cfc8bc" seg={12} />
      <C p={[0, 1.2, 0]} r={0.75} r2={0.3} h={0.15} c="#cfc8bc" seg={24} />
      <mesh ref={jet} position={[0, 1.65, 0]} userData={{ live: true }}><coneGeometry args={[0.55, 0.9, 16, 1, true]} /><meshStandardMaterial color="#9fdcf5" emissive="#bfe9fb" emissiveIntensity={0.25} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <C p={[0, 1.85, 0]} r={0.05} h={0.9} c="#e8f7fd" o={0.7} seg={8} />
    </group>
  );
}

function Court() {           // basketball, north of the building
  const L = (x, z, w, d) => <Flat key={x + ':' + z + ':' + w} x={x} z={z} w={w} d={d} y={0.025} c="#f4f1ea" />;
  return (
    <group position={[-4, 0, -20.5]}>
      <Flat x={0} z={0} w={17} d={10} y={0.015} c="#3f6f9e" />
      <Flat x={0} z={0} w={15} d={8} y={0.02} c="#c76a3e" />
      {L(0, -4, 15, 0.08)}{L(0, 4, 15, 0.08)}{L(-7.5, 0, 0.08, 8)}{L(7.5, 0, 0.08, 8)}{L(0, 0, 0.08, 8)}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.026, 0]}><ringGeometry args={[1.1, 1.18, 40]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
      {[-1, 1].map(s => <group key={s}>
        <mesh rotation-x={-Math.PI / 2} position={[s * 7.5, 0.026, 0]}><ringGeometry args={[4.6, 4.68, 40, 1, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
        <C p={[s * 8.3, 1.6, 0]} r={0.08} h={3.2} c="#3a3f45" metal={0.5} />
        <B p={[s * 7.95, 3.1, 0]} s={[0.06, 1.05, 1.8]} c="#ffffff" />
        <B p={[s * 7.9, 2.95, 0]} s={[0.02, 0.45, 0.6]} c="#c0392b" cast={false} />
        <mesh position={[s * 7.65, 2.8, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.23, 0.02, 6, 20]} /><meshStandardMaterial color="#e67e22" /></mesh>
      </group>)}
    </group>
  );
}

function Pitch() {           // football, west of the building
  const map = useMemo(() => tex('pitch', [1, 1]), []);
  const W = 15, D = 24, line = (x, z, w, d) => <Flat key={x + ':' + z + ':' + w} x={x} z={z} w={w} d={d} y={0.02} c="#f4f1ea" />;
  return (
    <group position={[-44, 0, 0]}>
      <Flat x={0} z={0} w={W + 2} d={D + 2} y={0.012} map={map} />
      {line(0, -D / 2, W, 0.1)}{line(0, D / 2, W, 0.1)}{line(-W / 2, 0, 0.1, D)}{line(W / 2, 0, 0.1, D)}{line(0, 0, W, 0.1)}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.021, 0]}><ringGeometry args={[2, 2.1, 40]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
      {[-1, 1].map(s => <group key={s} position={[0, 0, s * D / 2]}>
        {line(0, -s * 2, 7, 0.1)}{line(-3.5, -s, 0.1, 2)}{line(3.5, -s, 0.1, 2)}
        {[-1.6, 1.6].map(x => <C key={x} p={[x, 0.6, 0]} r={0.05} h={1.2} c="#fff" seg={8} />)}
        <C p={[0, 1.2, 0]} r={0.05} h={3.2} rz={Math.PI / 2} c="#fff" seg={8} />
        <B p={[0, 0.6, s * 0.6]} s={[3.2, 1.2, 0.02]} c="#eeeeee" o={0.35} cast={false} />
      </group>)}
    </group>
  );
}

function Garden() {          // south lawn: paths, flower beds, a gazebo and benches
  const pave = useMemo(() => tex('paving', [8, 1]), []);
  const flowers = useMemo(() => {
    const r = rnd(77), out = { a: [], b: [], c: [] };
    [[-20, 16], [-12, 23], [4, 17], [-4, 13.5]].forEach(([x, z]) => {
      for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 1.3; out['abc'[i % 3]].push([x + Math.cos(a) * d, 0.2, z + Math.sin(a) * d * 0.7, 0.8 + r() * 0.5]); }
    });
    return out;
  }, []);
  return (
    <group>
      <Flat x={-11} z={19} w={30} d={1.6} y={0.012} map={pave} />
      <Flat x={-8} z={14} w={1.6} d={10} y={0.013} map={pave} />
      {[[-20, 16], [-12, 23], [4, 17], [-4, 13.5]].map(([x, z]) => (
        <group key={x + ':' + z} position={[x, 0, z]} scale={[1, 1, 0.7]}>
          <C p={[0, 0.1, 0]} r={1.6} h={0.2} c="#8a6a4e" seg={24} />
        </group>
      ))}
      <Many geo={<sphereGeometry args={[0.13, 6, 5]} />} c="#e84a5f" cast={false} at={flowers.a} />
      <Many geo={<sphereGeometry args={[0.13, 6, 5]} />} c="#ffd166" cast={false} at={flowers.b} />
      <Many geo={<sphereGeometry args={[0.13, 6, 5]} />} c="#b388eb" cast={false} at={flowers.c} />
      <group position={[-8, 0, 23]}>
        <C p={[0, 0.1, 0]} r={2.4} h={0.2} c="#d8d2c8" seg={6} />
        {[0, 1, 2, 3, 4, 5].map(k => <C key={k} p={[Math.cos(k * Math.PI / 3) * 2.1, 1.3, Math.sin(k * Math.PI / 3) * 2.1]} r={0.08} h={2.4} c="#f4efe6" seg={8} />)}
        <mesh position={[0, 3.05, 0]} castShadow><coneGeometry args={[2.9, 1.3, 6]} /><meshStandardMaterial color="#8c3b2e" /></mesh>
        <C p={[0, 0.45, 0]} r={0.6} h={0.06} c="#a8744b" />
        <C p={[0, 0.22, 0]} r={0.08} h={0.44} c="#3a3f45" />
      </group>
      <Bench x={-15} z={18} /><Bench x={-1} z={18} /><Bench x={-24} z={20.2} r={Math.PI} />
    </group>
  );
}

function Parking() {
  const asphalt = useMemo(() => tex('asphalt', [4, 4]), []);
  return (
    <group>
      <Flat x={25} z={19} w={14} d={14} y={0.012} map={asphalt} />
      <Flat x={30} z={19} w={7.5} d={4} y={0.013} map={asphalt} />
      {[18.5, 21.5, 24.5, 27.5, 30.5].map(x => [14, 24].map(z => <Flat key={x + ':' + z} x={x} z={z} w={0.1} d={4.4} y={0.02} c="#f2f2f2" />))}
      {CARS.map(([x, z, c], i) => <Car key={i} x={x + 1.5} z={z} c={c} r={z < 19 ? 0 : Math.PI} />)}
    </group>
  );
}

function Street() {
  const asphalt = useMemo(() => tex('asphalt', [2, 30]), []);
  const pave = useMemo(() => tex('paving', [1, 40]), []);
  return (
    <group>
      <Flat x={40} z={0} w={8} d={160} y={0.01} map={asphalt} />
      {Array.from({ length: 27 }, (_, i) => <Flat key={i} x={40} z={-78 + i * 6} w={0.15} d={2.5} y={0.02} c="#f2e6a0" />)}
      <Flat x={35} z={0} w={2} d={160} y={0.05} map={pave} /><Flat x={45} z={0} w={2} d={160} y={0.05} map={pave} />
      {[-12, 6].map(z => [0, 1, 2, 3, 4, 5].map(k => <Flat key={z + ':' + k} x={40} z={z + k * 0.7} w={6} d={0.35} y={0.021} c="#f5f5f5" />))}
      <Car x={38} z={-34} c="#e1b12c" /><Car x={42} z={22} c="#487eb0" r={Math.PI} />
      {/* bus stop */}
      <group position={[35.6, 0, -8]}>
        <B p={[0, 2.3, 0]} s={[0.9, 0.08, 3]} c="#3a3f45" />
        <B p={[-0.4, 1.15, 0]} s={[0.04, 2.3, 3]} c="#a9d3ea" o={0.4} cast={false} />
        <B p={[0, 0.45, 0]} s={[0.4, 0.06, 2.4]} c="#a8744b" />
        <C p={[0.35, 1.3, 1.6]} r={0.04} h={2.6} c="#3a3f45" /><B p={[0.35, 2.5, 1.6]} s={[0.05, 0.4, 0.4]} c="#2e86de" />
      </group>
      {/* the town across the street */}
      {[[-60, 9, 14, '#d9c8b4'], [-44, 7, 9, '#c7d3dc'], [-28, 10, 18, '#e4d2c0'], [-12, 9, 11, '#cfc2d6'], [5, 8, 7, '#d6dcc7'],
        [20, 11, 15, '#e0cdb8'], [36, 8, 10, '#c9d6de'], [52, 10, 20, '#d9c8b4'], [68, 9, 12, '#d3cbbf']].map(([z, w, h, c]) => (
        <group key={z} position={[52 + w / 2, 0, z]}>
          <B p={[0, h / 2, 0]} s={[w, h, 13]} c={c} />
          {Array.from({ length: Math.floor(h / 3) }, (_, f) => [-4.5, -1.5, 1.5, 4.5].map(dz =>
            <B key={f + ':' + dz} p={[-w / 2 - 0.02, 2 + f * 3, dz]} s={[0.04, 1.3, 1.6]} c="#7fa3bf" cast={false} rough={0.2} />))}
          <B p={[-w / 2 - 0.4, 3.2, 0]} s={[0.8, 0.1, 12]} c="#b04a3a" cast={false} />
        </group>
      ))}
    </group>
  );
}

function Fence() {
  const posts = useMemo(() => {
    const out = [], { x0, x1, z0, z1 } = FENCE;
    for (let x = x0; x <= x1; x += 2.5) { out.push([x, 0.75, z0]); out.push([x, 0.75, z1]); }
    for (let z = z0 + 2.5; z < z1; z += 2.5) { out.push([x0, 0.75, z]); if (Math.abs(z) > GATE + 0.5 && (z < 11 || z > 27)) out.push([x1, 0.75, z]); }
    return out;
  }, []);
  const { x0, x1, z0, z1 } = FENCE, L = x1 - x0, D = z1 - z0;
  const rail = (key, x, z, w, d) => [0.4, 1.3].map(y => <B key={key + y} p={[x, y, z]} s={[w, 0.06, d]} c="#2f3a35" metal={0.5} cast={false} />);
  return (
    <group>
      <Many geo={<boxGeometry args={[0.1, 1.5, 0.1]} />} c="#2f3a35" at={posts} />
      {rail('n', (x0 + x1) / 2, z0, L, 0.05)}{rail('s', (x0 + x1) / 2, z1, L, 0.05)}{rail('w', x0, 0, 0.05, D)}
      {rail('e1', x1, (z0 - GATE) / 2, 0.05, -GATE - z0)}
      {rail('e2', x1, (GATE + 11) / 2, 0.05, 11 - GATE)}{rail('e3', x1, (27 + z1) / 2, 0.05, z1 - 27)}
      {[-GATE - 0.2, GATE + 0.2].map(z => <B key={z} p={[x1, 1.1, z]} s={[0.5, 2.2, 0.5]} c="#b8735a" />)}
      <B p={[x1, 2.35, 0]} s={[0.3, 0.3, 2 * GATE + 0.9]} c="#2f3a35" metal={0.5} />
    </group>
  );
}

function Clouds() {
  const puffs = useMemo(() => {
    const r = rnd(9), out = [];
    for (let c = 0; c < 12; c++) {
      const x = (r() - 0.5) * 200, z = (r() - 0.5) * 200, y = 32 + r() * 12;
      for (let k = 0; k < 5; k++) out.push([x + (r() - 0.5) * 9, y + r() * 2, z + (r() - 0.5) * 5, 2.5 + r() * 2]);
    }
    return out;
  }, []);
  return <Many geo={<sphereGeometry args={[1, 10, 8]} />} c="#ffffff" cast={false} at={puffs} e="#ffffff" />;
}

export function Campus({ walk }) {
  const grass = useMemo(() => tex('grass', [60, 60]), []);
  const pave = useMemo(() => tex('paving', [6, 6]), []);
  const pave2 = useMemo(() => tex('paving', [8, 1]), []);
  const lamps = [[16, -7], [16, 7], [26, -7], [26, 7], [33, -3.5], [33, 3.5], [-17, -14], [-17, 14], [5, 11.5], [-12, 11.5], [-4, -13.5]];
  return (
    <group>
      <Flat x={0} z={0} w={260} d={260} y={-0.02} map={grass} />
      {/* hills on the horizon */}
      {[[-110, -60, 40], [-90, 70, 30], [0, -120, 45], [10, 115, 35], [-150, 0, 50]].map(([x, z, r]) => (
        <mesh key={x} position={[x, -r * 0.6, z]} scale={[1, 0.6, 1]}><sphereGeometry args={[r, 24, 12]} /><meshStandardMaterial color="#8fb27a" /></mesh>
      ))}
      {/* plaza in front of the door and the path out to the street */}
      <Flat x={20.5} z={0} w={13} d={15} y={0.01} map={pave} />
      <Flat x={30.5} z={0} w={7} d={3.2} y={0.011} map={pave2} />
      <Flat x={X0 - 1.5} z={0} w={3} d={2.5} y={0.011} map={pave2} />
      <Flat x={-4} z={-11.5} w={1.6} d={4} y={0.011} map={pave2} r={0} />
      <Fountain />
      <Flag x={17.5} z={-5.5} c1="#2e86de" c2="#ffffff" phase={0} />
      <Flag x={18.5} z={-5.5} c1="#c0392b" c2="#f5d76e" h={6.5} phase={1} />
      <Flag x={19.5} z={-5.5} c1="#10ac84" c2="#ffffff" phase={2} />
      <group position={[18.5, 0, 5.8]}>{[-0.9, -0.3, 0.3, 0.9].map(x => (
        <mesh key={x} position={[x, 0.45, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[0.38, 0.03, 6, 16, Math.PI]} /><meshStandardMaterial color="#9aa0a6" metalness={0.6} /></mesh>
      ))}</group>
      <Bench x={22} z={-6.3} /><Bench x={22} z={6.3} r={Math.PI} /><Bench x={25.5} z={-3} r={-Math.PI / 2} />
      {lamps.map(([x, z]) => <Lamp key={x + ':' + z} x={x} z={z} />)}
      {TREES.map((t, i) => <Tree key={i} {...t} />)}
      <Court /><Pitch /><Garden /><Parking /><Street /><Fence />
      {walk && <Clouds />}
    </group>
  );
}
