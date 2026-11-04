// Shanghai beyond the east edge of town: the Huangpu river running north past Suzhou Creek, the riverside walk
// of the Bund on this bank, a cable-stayed bridge carrying the road east, ferries, and across the water
// Pudong's Lujiazui: the Oriental Pearl Tower, Jin Mao, the "bottle opener" and the twisting Shanghai Tower
// among glass towers, with Century Avenue running through. All of it is east or north of the practice
// buildings, so from the overview camera none of it stands in front of them.
import { useContext, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { B, C, S } from './props.jsx';
import { Lamp, Tree } from './scenery.jsx';
import { Block, signTexture } from './blocks.jsx';
import { Bake } from './bake.jsx';
import { Night } from './time.js';

// where everything goes, from the town's size
export function layout(edgeX, edgeZ, far) {
  const rx = edgeX + 24, rw = 26;
  return {
    rx, rw, west: rx - rw / 2, east: rx + rw / 2, north: -edgeZ - 24, bund: -edgeZ - 5.5, far,
    pearl: [rx + 28, -45], jinmao: [rx + 51, -35], swfc: [rx + 71, -48], tower: [rx + 64, -18],
    // other glass towers in Pudong: [x, z, height]
    towers: [[rx + 26, 20, 45], [rx + 26, 42, 30], [rx + 96, 18, 55], [rx + 112, 18, 40], [rx + 96, 40, 35], [rx + 112, 42, 50],
             [rx + 101, -30, 60], [rx + 116, -55, 45], [rx + 98, -58, 38], [rx + 114, -20, 30], [rx + 28, -78, 28], [rx + 56, -78, 40]],
  };
}

// walking: the river (except on the bridge) and the towers' feet
export function blockedShanghai(x, z, edgeX, edgeZ, far, road) {
  const L = layout(edgeX, edgeZ, far);
  if (x > L.west + 0.6 && x < L.east - 0.6 && Math.abs(z) > road / 2 + 0.6) return true;
  if (x < L.east) return false;
  const near = ([a, b], r) => Math.abs(x - a) < r && Math.abs(z - b) < r;
  return near(L.pearl, 4) || near(L.jinmao, 5.5) || near(L.swfc, 7) || near(L.tower, 8.5) || L.towers.some(([a, b]) => near([a, b], 4.8))
    || fillOf(L, road).out.some(([a, b]) => near([a, b], 5));
}

function Cable({ a, b }) {
  // a thin rod from point a to point b
  const { pos, quat, len } = useMemo(() => {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A);
    return { pos: A.clone().add(Bv).multiplyScalar(0.5), len: d.length(),
             quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()) };
  }, [a, b]);
  return <mesh position={pos} quaternion={quat}><cylinderGeometry args={[0.06, 0.06, len, 4]} /><meshStandardMaterial color="#e8e8e8" /></mesh>;
}

// the cable-stayed bridge taking the east road over the river: a deck, two H-shaped towers, fans of cables
function Bridge({ L, road }) {
  const cables = useMemo(() => {
    const out = [];
    [L.rx - 7, L.rx + 7].forEach(tx => [-1, 1].forEach(side => [3, 5.5, 8, 10.5, 13].forEach(d => [-1, 1].forEach(zs => {
      out.push([[tx, 21 - d * 0.35, zs * 4.4], [tx + side * d, 0.4, zs * 4.4]]);
    }))));
    return out;
  }, [L.rx]);
  return (
    <group>
      <B p={[L.rx, -0.2, 0]} s={[L.rw + 6, 0.64, road + 2]} c="#b7b2a8" />
      <B p={[L.rx, 0.125, 0]} s={[L.rw + 6, 0.02, road]} c="#5d6166" cast={false} />
      {[-1, 1].map(k => <B key={k} p={[L.rx, 0.55, k * (road / 2 + 0.6)]} s={[L.rw + 6, 0.7, 0.2]} c="#dcd8cf" />)}
      {[L.rx - 7, L.rx + 7].map(x => <group key={x} position={[x, 0, 0]}>
        {[-1, 1].map(k => <B key={k} p={[0, 10.5, k * 4.8]} s={[0.9, 22, 0.9]} c="#e9e6df" />)}
        <B p={[0, 21.6, 0]} s={[0.9, 1, 10.5]} c="#e9e6df" />
        <B p={[0, 13, 0]} s={[0.7, 0.7, 10.5]} c="#e9e6df" />
      </group>)}
      {cables.map(([a, b], i) => <Cable key={i} a={a} b={b} />)}
      <mesh position={[L.west - 1, 3.4, road / 2 + 1.4]}>
        <planeGeometry args={[4.6, 0.8]} /><meshStandardMaterial map={signTexture('浦东 PUDONG →', '#1f6e43')} />
      </mesh>
    </group>
  );
}

// ferries crossing the river and a barge going up it
function Boats({ L }) {
  const refs = useRef([]);
  const boats = useMemo(() => [
    { kind: 'ferry', z: -40, speed: 0.25, off: 0 }, { kind: 'ferry', z: 55, speed: 0.2, off: 0.5 },
    { kind: 'barge', speed: 3, off: 0 }, { kind: 'barge', speed: 2.4, off: 0.45 },
    { kind: 'cruise', speed: 2, off: 0.2 }, { kind: 'cruise', speed: 1.7, off: 0.7 },
  ], []);
  const night = useContext(Night);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    boats.forEach((b, i) => {
      const g = refs.current[i]; if (!g) return;
      if (b.kind === 'ferry') {
        const u = (Math.sin(t * b.speed + b.off * 6) + 1) / 2;
        g.position.set(L.west + 4 + u * (L.rw - 8), 0, b.z); g.rotation.y = Math.PI / 2;
      } else {
        const len = L.far - L.north, s = ((t * b.speed / len + b.off) % 1) * len;
        g.position.set(L.rx + (i % 2 ? 6 : -6) * (b.kind === 'cruise' ? 0.4 : 1), 0, i % 2 ? L.north + 6 + s : L.far - s); g.rotation.y = i % 2 ? 0 : Math.PI;
      }
    });
  });
  return boats.map((b, i) => (
    <group key={i} ref={el => { refs.current[i] = el; }} userData={{ live: true }}><Bake>
      {b.kind === 'cruise' ? <>
        <B p={[0, 0.45, 0]} s={[4, 0.9, 13]} c="#f4f1ea" />
        <B p={[0, 1.4, 0]} s={[3.4, 1.2, 10]} c="#ffffff" />
        <B p={[0, 1.45, 0]} s={[3.44, 0.5, 9.4]} c={night ? '#ffd98a' : '#2c3e50'} {...(night ? { e: '#ffc46b', ei: 1 } : {})} cast={false} />
        <B p={[0, 2.35, 0]} s={[3, 0.8, 7]} c="#ffffff" />
        <B p={[0, 2.4, 0]} s={[3.04, 0.35, 6.4]} c={night ? '#9fe0ff' : '#2c3e50'} {...(night ? { e: '#6fd0ff', ei: 1 } : {})} cast={false} />
        <B p={[0, 2.9, -1]} s={[1.6, 0.3, 2]} c="#c0392b" />
      </> : b.kind === 'ferry' ? <>
        <B p={[0, 0.35, 0]} s={[3.2, 0.7, 9]} c="#f4f4f0" />
        <B p={[0, 0.72, 0]} s={[3.3, 0.06, 9.1]} c="#2a6f97" cast={false} />
        <B p={[0, 1.4, 0]} s={[2.6, 1.3, 6]} c="#ffffff" />
        <B p={[0, 1.5, 0]} s={[2.62, 0.5, 5.6]} c="#34495e" cast={false} />
        <B p={[0, 2.15, 0]} s={[2.8, 0.15, 6.4]} c="#2a6f97" />
      </> : <>
        <B p={[0, 0.4, 0]} s={[3.4, 0.8, 14]} c="#5b3a29" />
        {[-4, 0, 4].map(z => <B key={z} p={[0, 1.05, z]} s={[2.8, 0.5, 3.4]} c={['#c0392b', '#2e86de', '#e67e22'][(z + 4) / 4]} />)}
        <B p={[0, 1.4, -6]} s={[2.4, 1.4, 1.6]} c="#ecf0f1" />
      </>}
    </Bake></group>
  ));
}

// ---------------------------------------------------------------- moving things
// a train that runs back and forth along x on a viaduct: from x0 to x1 at height y, at z
function Shuttle({ x0, x1, y, z, speed, cars, nose, body, stripe }) {
  const g = useRef(), len = x1 - x0;
  useFrame(({ clock }) => {
    if (!g.current) return;
    const u = (clock.elapsedTime * speed / len) % 2, k = u < 1 ? u : 2 - u;   // there and back
    g.current.position.x = x0 + 6 + k * (len - 12 - cars * 6);
  });
  return (
    <group ref={g} position={[x0, y, z]} userData={{ live: true }}><Bake>
      {Array.from({ length: cars }, (_, i) => <group key={i} position={[i * 6.2, 0, 0]}>
        <B p={[0, 1.2, 0]} s={[6, 2.2, 2.6]} c={body} metal={0.3} rough={0.3} />
        <B p={[0, 1.55, 0]} s={[5.4, 0.6, 2.64]} c="#253040" rough={0.15} />
        <B p={[0, 0.55, 0]} s={[6, 0.25, 2.62]} c={stripe} />
      </group>)}
      {nose && [-1, 1].map(k => <mesh key={k} position={[k < 0 ? -3.6 : (cars - 1) * 6.2 + 3.6, 1.2, 0]} rotation-z={k * Math.PI / 2} castShadow>
        <coneGeometry args={[1.25, 1.6, 12]} /><meshStandardMaterial color={body} metalness={0.3} roughness={0.3} />
      </mesh>)}
    </Bake></group>
  );
}
// a viaduct along x: a deck on round pillars
function Viaduct({ x0, x1, y, z, w = 4 }) {
  const n = Math.floor((x1 - x0) / 18);
  return (
    <group>
      <B p={[(x0 + x1) / 2, y - 0.35, z]} s={[x1 - x0, 0.7, w]} c="#d9d6cf" />
      <B p={[(x0 + x1) / 2, y + 0.02, z]} s={[x1 - x0, 0.06, w - 1.2]} c="#8d9298" cast={false} />
      {Array.from({ length: n + 1 }, (_, i) => <C key={i} p={[x0 + 4 + i * (x1 - x0 - 8) / n, (y - 0.7) / 2, z]} r={0.55} h={y - 0.7} c="#cfccc4" seg={10} />)}
    </group>
  );
}
// a plane crossing the sky now and then, on its way to the airport
function Plane() {
  const g = useRef();
  useFrame(({ clock }) => {
    if (!g.current) return;
    const u = (clock.elapsedTime / 70) % 1;
    g.current.position.set(-320 + u * 640, 70 + u * -25, -140 + u * 120); g.current.visible = u < 0.98;
  });
  return (
    <group ref={g} rotation-y={Math.PI / 2 - 0.18} userData={{ live: true }}><Bake>
      <C p={[0, 0, 0]} r={1.3} h={16} rx={Math.PI / 2} c="#f4f6f8" seg={12} />
      <B p={[0, -0.2, 0.5]} s={[22, 0.3, 3]} c="#e4e8ec" />
      <B p={[0, 0.2, -7]} s={[7, 0.25, 1.8]} c="#e4e8ec" />
      <B p={[0, 2.2, -7]} s={[0.3, 4, 2]} c="#c0392b" />
      <S p={[0, 0, 8]} r={1.3} c="#f4f6f8" />
    </Bake></group>
  );
}

// ---------------------------------------------------------------- Lujiazui's landmarks
function Pearl({ x, z }) {
  const night = useContext(Night), pink = night ? '#ff5fa2' : '#d9568f';
  const glow = night ? { e: '#ff2f8e' } : {};
  return (
    <group position={[x, 0, z]}>
      <C p={[0, 0.6, 0]} r={6} h={1.2} c="#c9c2b4" seg={24} />
      {[0, 1, 2].map(k => {
        const a = k * 2.094;
        return <group key={k}>
          <C p={[Math.cos(a) * 2.4, 36, Math.sin(a) * 2.4]} r={0.75} h={72} c="#d8d4cc" seg={10} />
          <mesh position={[Math.cos(a) * 4.5, 8, Math.sin(a) * 4.5]} rotation={[Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]} castShadow>
            <cylinderGeometry args={[0.55, 0.7, 17, 8]} /><meshStandardMaterial color="#d8d4cc" />
          </mesh>
        </group>;
      })}
      <S p={[0, 24, 0]} r={7.5} c={pink} {...glow} />
      {[33, 38, 43, 48].map((y, i) => <S key={y} p={[Math.cos(i * 1.7) * 2.4, y, Math.sin(i * 1.7) * 2.4]} r={1.5} c={pink} {...glow} />)}
      <S p={[0, 58, 0]} r={5} c={pink} {...glow} />
      <C p={[0, 66, 0]} r={1.6} h={12} c="#d8d4cc" seg={10} />
      <S p={[0, 73, 0]} r={2} c={pink} {...glow} />
      <C p={[0, 82, 0]} r={0.35} r2={0.7} h={16} c="#e8e4dc" seg={8} />
    </group>
  );
}
function ShanghaiTower({ x, z }) {
  const night = useContext(Night);
  // stacked slabs, each a little smaller and turned a little further, so the tower twists as it rises
  const slabs = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ y: i * 3 + 1.5, r: 9 - i * 0.11, a: i * 0.06 })), []);
  return (
    <group position={[x, 0, z]}>
      {slabs.map((s, i) => (
        <mesh key={i} position={[0, s.y, 0]} rotation-y={s.a} castShadow>
          <cylinderGeometry args={[s.r * 0.99, s.r, 3.02, 3]} />
          <meshStandardMaterial color={i % 2 ? '#8fb1c6' : '#9cbccf'} roughness={0.25} metalness={0.4} emissive={night ? '#4a7fa8' : '#000000'} emissiveIntensity={night ? 0.25 : 0} />
        </mesh>
      ))}
      <mesh position={[0, 122, 0]} rotation-y={2.4}><cylinderGeometry args={[4.4, 4.6, 4, 3, 1, true]} /><meshStandardMaterial color="#b9cfdc" side={THREE.DoubleSide} /></mesh>
    </group>
  );
}
function Swfc({ x, z }) {
  // the "bottle opener": a tall tapering slab with a trapezoid opening at the top
  return (
    <group position={[x, 0, z]} rotation-y={Math.PI / 4}>
      {[0, 1, 2, 3].map(k => <B key={k} p={[0, 11 + k * 20, 0]} s={[11 - k * 1.2, 22, 9 - k * 0.8]} c="#a3bed2" metal={0.4} rough={0.25} />)}
      {[-1, 1].map(k => <B key={k} p={[k * 2.9, 95, 0]} s={[1.9, 14, 5]} c="#a3bed2" metal={0.4} rough={0.25} />)}
      <B p={[0, 102.8, 0]} s={[7.7, 1.6, 5]} c="#a3bed2" metal={0.4} rough={0.25} />
    </group>
  );
}
function JinMao({ x, z }) {
  // a pagoda in glass and steel: stepped tiers with ledges, then a spire
  const tiers = [[9, 30], [8.2, 14], [7.4, 10], [6.6, 8], [5.6, 6], [4.6, 5], [3.6, 4], [2.6, 3]];
  let y = 0;
  return (
    <group position={[x, 0, z]}>
      {tiers.map(([w, h], i) => {
        const at = y; y += h;
        return <group key={i}>
          <B p={[0, at + h / 2, 0]} s={[w, h, w]} c={i % 2 ? '#8b98a3' : '#9fadb7'} metal={0.4} rough={0.3} />
          <B p={[0, at + h, 0]} s={[w + 0.6, 0.35, w + 0.6]} c="#c9d0d6" />
        </group>;
      })}
      <C p={[0, y + 7, 0]} r={0.2} r2={0.9} h={14} c="#c9d0d6" seg={8} />
    </group>
  );
}

// Lujiazui's round footbridge over the crossing of Century Avenue, on slim legs
function RingBridge({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 6, 0]} rotation-x={Math.PI / 2} castShadow><torusGeometry args={[9, 1.1, 6, 40]} /><meshStandardMaterial color="#e9eef2" /></mesh>
      <mesh position={[0, 6.6, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[9, 0.25, 4, 40]} /><meshStandardMaterial color="#9fd3ef" /></mesh>
      {Array.from({ length: 8 }, (_, k) => <C key={k} p={[Math.cos(k * 0.785 + 0.39) * 9, 3, Math.sin(k * 0.785 + 0.39) * 9]} r={0.35} h={6} c="#cfd6dc" seg={8} />)}
    </group>
  );
}

// the rest of Pudong: mid-rise blocks on a grid, wherever nothing bigger stands, with trees between
// (worked out once per town size: walking asks for it every step)
const filled = {};
export function fillOf(L, road) {
  const k = L.rx + ':' + L.far + ':' + road;
  return filled[k] || (filled[k] = fill(L, road));
}
function fill(L, road) {
  const out = [], trees = [], taken = [L.pearl, L.jinmao, L.swfc, L.tower].map(([x, z]) => [x, z, 14]).concat(L.towers.map(([x, z]) => [x, z, 9]));
  for (let x = L.east + 10; x < L.far - 30; x += 15) for (let z = -76; z < 58; z += 15) {
    const roadNear = [L.rx + 41, L.rx + 86].some(a => Math.abs(x - a) < road / 2 + 5) || Math.abs(z) < road / 2 + 5 || Math.abs(z + 65) < road / 2 + 5;
    const park = Math.hypot(x - (L.rx + 58), z - 30) < 19, ring = Math.hypot(x - (L.rx + 41), z) < 14;
    if (roadNear || park || ring || taken.some(([a, b, r]) => Math.abs(x - a) < r && Math.abs(z - b) < r)) { if (!roadNear && !park) trees.push([x, z]); continue; }
    const h = 10 + ((x * 7 + z * 13) % 17 + 17) % 17;
    out.push([x, z, h, (Math.abs(x * 3 + z) | 0) % 4]);
  }
  return { out, trees };
}

// ---------------------------------------------------------------- everything together
export function Shanghai({ edgeX, edgeZ, far, road }) {
  const L = useMemo(() => layout(edgeX, edgeZ, far), [edgeX, edgeZ, far]);
  const len = far - L.bund;                                   // the Bund's walk, from the creek southwards
  const more = fillOf(L, road);
  const bundLamps = useMemo(() => Array.from({ length: Math.floor((edgeZ * 2 + 40) / 12) }, (_, i) => -edgeZ - 10 + i * 12).filter(z => Math.abs(z) > road / 2 + 2 && z > -edgeZ - 4), [edgeZ, road]);
  return (
    <group>
      {/* the river with stone embankments */}
      <B p={[L.rx, 0.035, 0]} s={[L.rw, 0.02, 2 * far]} c="#4d8fb3" rough={0.15} metal={0.2} cast={false} />
      {[L.west - 0.8, L.east + 0.8].map(x => <B key={x} p={[x, 0.3, 0]} s={[1.6, 0.6, 2 * far]} c="#b3ab9c" />)}
      {/* the Bund's riverside walk: paving, a railing along the water, lamps and trees */}
      <B p={[(edgeX + road / 2 + L.west - 1.6) / 2, 0.04, (L.bund + far) / 2]} s={[L.west - 1.6 - edgeX - road / 2, 0.04, len]} c="#d9d0bf" cast={false} />
      <B p={[L.west - 1.4, 1.0, (L.bund + far) / 2]} s={[0.12, 0.9, len]} c="#5b5f63" metal={0.5} />
      {bundLamps.map(z => <group key={z}><Lamp x={L.west - 3} z={z} />{Math.abs(z) % 24 < 12 && <Tree x={edgeX + road / 2 + 1.5} z={z + 6} k={0.7} />}</group>)}
      <mesh position={[edgeX + road / 2 + 1.2, 2.2, 12]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[3.6, 0.7]} /><meshStandardMaterial map={signTexture('外滩 · THE BUND', '#7a1f1f', '#ffe08a')} />
      </mesh>
      <Bridge L={L} road={road} />
      {/* the maglev out east */}
      <Viaduct x0={L.east + 4} x1={far - 10} y={6} z={-65} w={3.6} />
      <Shuttle x0={L.east + 4} x1={far - 10} y={6} z={-65} speed={28} cars={3} nose body="#f7f7f7" stripe="#1f6fb2" />
      <Plane />
      <Boats L={L} />
      {/* Pudong: a paved riverside, avenues north to south, a round park, and the towers */}
      <B p={[L.east + 3.5, 0.04, (L.north + 10 + 60) / 2]} s={[6, 0.04, 60 - L.north - 10]} c="#d9d0bf" cast={false} />
      {[L.rx + 41, L.rx + 86].map(x => <B key={x} p={[x, 0.035, -10]} s={[road, 0.01, 140]} c="#5d6166" cast={false} />)}
      <B p={[(L.east + far) / 2, 0.035, 0]} s={[far - L.east, 0.01, road + 3]} c="#5d6166" cast={false} />
      <B p={[(L.east + far) / 2, 0.042, 0]} s={[far - L.east, 0.01, 0.6]} c="#7fb562" cast={false} />
      <B p={[(L.east + far) / 2, 0.035, -65]} s={[far - L.east, 0.01, road]} c="#5d6166" cast={false} />
      <B p={[(L.east + far - 20) / 2, 0.02, -8]} s={[far - 20 - L.east, 0.02, 146]} c="#d4d0c8" cast={false} />
      <C p={[L.rx + 58, 0.06, 30]} r={14} h={0.06} c="#7fb562" seg={40} />
      <RingBridge x={L.rx + 41} z={0} />
      {more.out.map(([x, z, h, k], i) => (
        <Block key={'m' + i} p={[x, 0, z]} s={[9, h, 9]} wall={['#d7d0c4', '#c9d3de', '#e8dcc6', '#b8c4cf'][k]} glass={['#6aa0c8', '#86b6d6', '#5c8f9e', '#7fb2d6'][k]} strip={k % 2 === 1} />
      ))}
      {more.trees.map(([x, z]) => <Tree key={'t' + x + ':' + z} x={x} z={z} k={0.9} />)}
      {Array.from({ length: 9 }, (_, i) => L.north + 20 + i * 20).map(z => <Tree key={'r' + z} x={L.east + 3.5} z={z} k={0.75} />)}
      <C p={[L.rx + 58, 0.1, 30]} r={4} h={0.04} c="#5fb3d6" seg={24} rough={0.1} />
      <Pearl x={L.pearl[0]} z={L.pearl[1]} />
      <JinMao x={L.jinmao[0]} z={L.jinmao[1]} />
      <Swfc x={L.swfc[0]} z={L.swfc[1]} />
      <ShanghaiTower x={L.tower[0]} z={L.tower[1]} />
      {L.towers.map(([x, z, h], i) => (
        <Block key={i} p={[x, 0, z]} s={[i % 3 ? 8 : 9, h, i % 2 ? 8 : 9]} wall={['#3d4f63', '#56708a', '#8fa8bf', '#2f3e4e'][i % 4]} glass={['#4f7ea8', '#6aa0c8', '#5c8f9e'][i % 3]} strip={i % 2 === 0} />
      ))}
    </group>
  );
}
