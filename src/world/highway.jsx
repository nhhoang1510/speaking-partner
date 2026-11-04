// The elevated ring road: a viaduct on pillars just outside the north and west edges of town, running out
// into the countryside, with barriers, lamps, gantry signs and traffic both ways. Behind the town as seen
// from the overview camera, so it never hides a practice building.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { B } from './props.jsx';
import { Many, Car, Lamp } from './scenery.jsx';
import { Bake } from './bake.jsx';
import { signTexture } from './blocks.jsx';

const UP = 7, W = 8.4, OFF = 5.4, PILLAR = 0.6;     // deck height and width; how far outside the edge street

export const highwayLines = (edgeX, edgeZ) => ({ zN: -edgeZ - OFF, xW: -edgeX - OFF });

// pillars along both lines (x or z every 20 m), for drawing and for walking into
export function highwayPillars(edgeX, edgeZ, far) {
  const { zN, xW } = highwayLines(edgeX, edgeZ), out = [];
  for (let x = -Math.floor(far / 20) * 20; x <= far; x += 20) if (Math.abs(x - xW) > 6) out.push([x, zN, 'n']);
  for (let z = Math.ceil((zN - 4) / 20) * 20 + 10; z <= far; z += 20) out.push([xW, z, 'w']);
  return out;
}
let cache = null;
export function blockedHighway(x, z, edgeX, edgeZ, far) {
  if (!cache || cache.key !== edgeX + ':' + edgeZ + ':' + far) cache = { key: edgeX + ':' + edgeZ + ':' + far, list: highwayPillars(edgeX, edgeZ, far) };
  return cache.list.some(([a, b]) => Math.abs(x - a) < PILLAR + 0.2 && Math.abs(z - b) < PILLAR + 0.2);
}

function Gantry({ x, z, along, text }) {
  const map = useMemo(() => signTexture(text, '#1f6e43'), [text]);
  return (
    <group position={[x, UP + 0.45, z]} rotation-y={along === 'n' ? 0 : Math.PI / 2}>
      {[-W / 2 + 0.2, W / 2 - 0.2].map(k => <B key={k} p={[0, 2.1, k]} s={[0.18, 4.2, 0.18]} c="#8a9299" metal={0.5} />)}
      <B p={[0, 4.1, 0]} s={[0.25, 0.25, W - 0.2]} c="#8a9299" metal={0.5} />
      {[1, -1].map(s => <mesh key={s} position={[s * 0.14, 3.4, 0]} rotation-y={s * Math.PI / 2}><planeGeometry args={[5.6, 1.1]} /><meshStandardMaterial map={map} emissive="#ffffff" emissiveMap={map} emissiveIntensity={0.15} /></mesh>)}
    </group>
  );
}

// cars going both ways on both lines
function Traffic({ zN, xW, far }) {
  const refs = useRef([]);
  const cars = useMemo(() => {
    const cols = ['#e74c3c', '#f1c40f', '#2e86de', '#ffffff', '#16a085', '#e67e22', '#2c3e50', '#bdc3c7'];
    return Array.from({ length: 16 }, (_, i) => ({ line: i < 10 ? 'n' : 'w', lane: [-2.6, -1, 1, 2.6][i % 4], off: (i * 0.37) % 1, speed: 13 + (i % 3) * 3, c: cols[i % cols.length] }));
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    cars.forEach((k, i) => {
      const g = refs.current[i]; if (!g) return;
      const dir = k.lane > 0 ? 1 : -1;
      if (k.line === 'n') {
        const L = 2 * far, s = ((t * k.speed / L + k.off) % 1) * L;
        g.position.set(dir > 0 ? -far + s : far - s, UP + 0.35, zN + k.lane); g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        const L = far - zN, s = ((t * k.speed / L + k.off) % 1) * L;
        g.position.set(xW - k.lane, UP + 0.35, dir > 0 ? zN + s : far - s); g.rotation.y = dir > 0 ? 0 : Math.PI;
      }
    });
  });
  return cars.map((k, i) => <group key={i} ref={el => { refs.current[i] = el; }} userData={{ live: true }}><Bake><Car x={0} z={0} c={k.c} /></Bake></group>);
}

export function Highway({ edgeX, edgeZ, far }) {
  const { zN, xW } = highwayLines(edgeX, edgeZ);
  const pillars = useMemo(() => highwayPillars(edgeX, edgeZ, far), [edgeX, edgeZ, far]);
  const lenN = 2 * far, lenW = far - zN;
  const dashes = useMemo(() => {
    const out = [];
    for (let x = -far; x < far; x += 6) [-1.8, 1.8].forEach(d => out.push([x, UP + 0.36, zN + d, 1, 0]));
    for (let z = zN + 6; z < far; z += 6) [-1.8, 1.8].forEach(d => out.push([xW + d, UP + 0.36, z, 1, Math.PI / 2]));
    return out;
  }, [zN, xW, far]);
  const lamps = useMemo(() => {
    const out = [];
    for (let x = -far + 20; x < far; x += 40) out.push([x, zN - W / 2 + 0.3]);
    for (let z = zN + 30; z < far; z += 40) out.push([xW - W / 2 + 0.3, z]);
    return out;
  }, [zN, xW, far]);
  return (
    <group>
      {/* the decks, their edge beams and barriers, and the joint where the two lines meet */}
      <B p={[0, UP, zN]} s={[lenN, 0.7, W]} c="#b9b6ae" />
      <B p={[0, UP + 0.36, zN]} s={[lenN, 0.02, W - 0.8]} c="#4f5459" cast={false} />
      <B p={[xW, UP, (zN + far) / 2]} s={[W, 0.7, lenW]} c="#b9b6ae" />
      <B p={[xW, UP + 0.36, (zN + far) / 2 + W / 2]} s={[W - 0.8, 0.02, lenW - W]} c="#4f5459" cast={false} />
      {[-1, 1].map(k => <B key={'n' + k} p={[0, UP + 0.7, zN + k * (W / 2 - 0.15)]} s={[lenN, 0.7, 0.3]} c="#e4e1da" />)}
      <B p={[xW - (W / 2 - 0.15), UP + 0.7, (zN + far) / 2]} s={[0.3, 0.7, lenW]} c="#e4e1da" />
      <B p={[xW + (W / 2 - 0.15), UP + 0.7, (zN + W / 2 + far) / 2]} s={[0.3, 0.7, far - zN - W / 2]} c="#e4e1da" />
      <B p={[0, UP + 0.37, zN]} s={[lenN, 0.02, 0.15]} c="#f2c84b" cast={false} />
      <B p={[xW, UP + 0.37, (zN + W / 2 + far) / 2]} s={[0.15, 0.02, far - zN - W / 2]} c="#f2c84b" cast={false} />
      <Many geo={<boxGeometry args={[2.4, 0.02, 0.14]} />} c="#ffffff" cast={false} at={dashes} />
      {/* T-shaped pillars */}
      {pillars.map(([x, z, line]) => (
        <group key={line + x + ':' + z} position={[x, 0, z]} rotation-y={line === 'n' ? 0 : Math.PI / 2}>
          <B p={[0, (UP - 0.35) / 2, 0]} s={[1.2, UP - 0.35, 1.2]} c="#c9c5bc" />
          <B p={[0, UP - 0.7, 0]} s={[1.6, 0.7, W - 0.6]} c="#c9c5bc" />
        </group>
      ))}
      {lamps.map(([x, z]) => <group key={x + ':' + z} position={[0, UP + 0.35, 0]}><Lamp x={x} z={z} /></group>)}
      <Gantry x={edgeX * 0.4} z={zN} along="n" text="CAO TỐC VÀNH ĐAI 3 · RING ROAD" />
      <Gantry x={-edgeX * 0.6} z={zN} along="n" text="SÂN BAY · AIRPORT 18 km" />
      <Gantry x={xW} z={edgeZ * 0.3} along="w" text="CAO TỐC BẮC – NAM · EXPRESSWAY" />
      <Traffic zN={zN} xW={xW} far={far} />
    </group>
  );
}
