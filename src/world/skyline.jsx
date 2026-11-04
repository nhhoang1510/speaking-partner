// The rest of Shanghai round the part we walk in: towers on every side as far as the haze, Suzhou Creek along
// the north edge flowing into the Huangpu under the steel Garden Bridge, and Broadway Mansions on the far
// bank. The far towers are one instanced mesh (a painted facade, lit windows at night), so they cost two
// draw calls however many there are.
import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { B, paint, rnd } from './props.jsx';
import { Block } from './blocks.jsx';
import { Clouds, tex } from './scenery.jsx';
import { Night } from './time.js';

// a facade of windows: by day blue-grey glass, at night (the emissive map) some of them lit
function facade(lit) {
  return paint(lit ? 'skyline-lit' : 'skyline', 64, 128, (g, w, h) => {
    const r = rnd(lit ? 5 : 4);
    g.fillStyle = lit ? '#000000' : '#dfe2e6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 6; x++) {
      if (lit) { if (r() < 0.38) { g.fillStyle = r() < 0.5 ? '#ffd38a' : '#fff1c9'; g.fillRect(3 + x * 10, 3 + y * 8, 7, 5); } }
      else { g.fillStyle = r() < 0.15 ? '#9fb3c4' : '#6f8799'; g.fillRect(3 + x * 10, 3 + y * 8, 7, 5); }
    }
  }, [1, 1]);
}

const TINTS = ['#ffffff', '#e8e2d6', '#d6dee6', '#cfd8d2', '#efe0d0', '#c9ced6'];
function Towers({ spots }) {
  const ref = useRef(), night = useContext(Night);
  const [map, glow] = useMemo(() => [facade(false), facade(true)], []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), c = new THREE.Color();
    spots.forEach(([x, z, w, h, d, k], i) => {
      ref.current.setMatrixAt(i, m.makeScale(w, h, d).setPosition(x, h / 2, z));
      ref.current.setColorAt(i, c.set(TINTS[Math.floor(k * TINTS.length)]));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={ref} args={[null, null, spots.length]} receiveShadow>
      <boxGeometry />
      <meshStandardMaterial map={map} emissive="#ffffff" emissiveMap={glow} emissiveIntensity={night ? 1 : 0} roughness={0.6} />
    </instancedMesh>
  );
}

// the Garden Bridge: two steel bowstring trusses carrying the Bund's road over the creek
function GardenBridge({ x, z }) {
  const span = 14, n = 8, steel = '#5f6f68', base = 0.9;
  const pts = Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [(t - 0.5) * span, base + Math.sin(t * Math.PI) * 2.6]; });
  const bar = (key, [z0, y0], [z1, y1], s = 0.26) => (
    <mesh key={key} position={[0, (y0 + y1) / 2, (z0 + z1) / 2]} rotation-x={-Math.atan2(y1 - y0, z1 - z0)} castShadow>
      <boxGeometry args={[s, s, Math.hypot(z1 - z0, y1 - y0) + 0.05]} /><meshStandardMaterial color={steel} />
    </mesh>
  );
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.55, 0]} s={[7.4, 0.3, span + 1]} c="#8d9298" />
      {[-3.5, 3.5].map(sx => (
        <group key={sx} position={[sx, 0, 0]}>
          {bar('low', [-span / 2, base], [span / 2, base], 0.3)}
          {pts.slice(1).map((q, i) => bar('top' + i, pts[i], q, 0.3))}
          {pts.slice(1, -1).map(([zz, y], i) => <B key={'v' + i} p={[0, (y + base) / 2, zz]} s={[0.16, y - base, 0.16]} c={steel} />)}
          {pts.slice(1).map(([zz, y], i) => bar('d' + i, [pts[i][0], base], [zz, y], 0.14))}
        </group>
      ))}
      {pts.slice(2, -2).map(([zz, y]) => <B key={zz} p={[0, y, zz]} s={[7, 0.14, 0.14]} c={steel} />)}
    </group>
  );
}

// Broadway Mansions: an Art Deco block of brown brick stepping back as it rises
function Broadway({ x, z }) {
  const brick = '#8a5a44';
  return (
    <group position={[x, 0, z]}>
      <Block p={[0, 0, 0]} s={[16, 12, 10]} wall={brick} glass="#4d5d6b" />
      <Block p={[0, 12.4, 0]} s={[11, 7, 8]} wall={brick} glass="#4d5d6b" />
      <Block p={[0, 19.8, 0]} s={[6, 5, 6]} wall={brick} glass="#4d5d6b" />
      <B p={[0, 25.9, 0]} s={[3, 1.6, 3]} c={brick} />
    </group>
  );
}

// edgeX/edgeZ: the town's outer streets; far: how far it all reaches; west/east: the Huangpu's banks;
// creek: the middle of Suzhou Creek
export function creekOf(edgeZ) { return -edgeZ - 10; }
export function Skyline({ edgeX, edgeZ, far, west, east, walk }) {
  const night = useContext(Night);
  const ground = useMemo(() => tex('asphalt', [80, 80]), []);
  const creek = creekOf(edgeZ), mansion = [edgeX - 10, creek - 20];
  const spots = useMemo(() => {
    const r = rnd(2024), out = [];
    const core = (x, z) => x > -edgeX - 13 && x < far - 22 && z > -edgeZ - 17 && z < edgeZ + 13;
    for (let x = -far; x <= far; x += 13) for (let z = -far; z <= far; z += 13) {
      const px = x + (r() - 0.5) * 4, pz = z + (r() - 0.5) * 4, w = 6 + r() * 5, d = 6 + r() * 5;
      // the overview looks from the south-east: the city on that side stays low so it hides nothing
      const low = pz > edgeZ, h = low ? 4 + r() * 7 : 8 + r() * 26 + (r() < 0.12 ? 30 + r() * 40 : 0), k = r();
      if (core(px, pz) || (px > west - 9 && px < east + 9) || (px < west && Math.abs(pz - creek) < 11)) continue;
      if (Math.hypot(px - mansion[0], pz - mansion[1]) < 17 || Math.hypot(px, pz) > far + 10) continue;
      out.push([px, pz, w, h, d, k]);
    }
    return out;
  }, [edgeX, edgeZ, far, west, east]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[2 * far + 200, 2 * far + 200]} /><meshStandardMaterial map={ground} />
      </mesh>
      <Towers spots={spots} />
      {/* Suzhou Creek, between stone banks, into the Huangpu */}
      <B p={[(west - far) / 2, 0.03, creek]} s={[far + west, 0.02, 9]} c="#5b8f95" rough={0.15} metal={0.2} cast={false} />
      {[-1, 1].map(k => <B key={k} p={[(west - far) / 2, 0.3, creek + k * 4.9]} s={[far + west, 0.6, 0.8]} c="#b3ab9c" />)}
      <GardenBridge x={edgeX} z={creek} />
      <Broadway x={mansion[0]} z={mansion[1]} />
      {walk && !night && <Clouds />}
    </group>
  );
}
