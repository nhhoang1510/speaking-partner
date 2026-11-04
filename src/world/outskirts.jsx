// Everything beyond the town's last street: country roads leading out (where new districts can be joined on
// later), a railway with a train along the north edge, a river with a bridge, fields, woods, wind turbines on
// the hills, and a far-off skyline. Sizes come from the town grid, so this follows the town when it grows.
import { useContext, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { B, C, rnd } from './props.jsx';
import { Many, Clouds, tex } from './scenery.jsx';
import { Bake } from './bake.jsx';
import { Night } from './time.js';

const FAR = 260;                                            // how far the countryside reaches from the centre

function Train({ z }) {
  const g = useRef();
  useFrame(({ clock }) => { if (g.current) g.current.position.x = ((clock.elapsedTime * 12) % (2 * FAR)) - FAR; });
  const cars = ['#c0392b', '#ecf0f1', '#ecf0f1', '#ecf0f1', '#ecf0f1'];
  return (
    <group ref={g} position={[0, 0, z]} userData={{ live: true }}><Bake>
      {cars.map((c, i) => (
        <group key={i} position={[-i * 6.4, 0, 0]}>
          <B p={[0, 1.65, 0]} s={[6, 2.4, 2.6]} c={c} metal={0.3} rough={0.4} />
          <B p={[0, 2.1, 0]} s={[5.4, 0.7, 2.64]} c="#253040" rough={0.2} />
          <B p={[0, 0.95, 0]} s={[6, 0.25, 2.62]} c="#c0392b" />
          <B p={[0, 3, 0]} s={[5.8, 0.2, 2.4]} c="#bdc3c7" />
        </group>
      ))}
      <B p={[3.3, 1.5, 0]} s={[0.8, 2, 2.4]} c="#c0392b" />
    </Bake></group>
  );
}

export function Outskirts({ edgeX, edgeZ, roadsX, roadsZ, road, walk, east = Infinity }) {
  const night = useContext(Night);
  const grass = useMemo(() => tex('grass', [90, 90]), []);
  const railZ = -edgeZ - 9, riverZ = -edgeZ - 24, outX = roadsX[Math.floor(roadsX.length / 2)], outZ = roadsZ[Math.floor(roadsZ.length / 2)];
  const stuff = useMemo(() => {
    const r = rnd(77), trunks = [], crowns = [], pines = [], sleepers = [], fields = [], blades = [];
    // east of `east` is the river and Pudong (shanghai.jsx): no woods or fields there
    const clear = (x, z) => (Math.abs(x) < edgeX + 9 && Math.abs(z) < edgeZ + 9) || (x > east && z > -edgeZ - 14 && z < edgeZ + 70);
    const onRoad = (x, z) => Math.abs(x - outX) < road || Math.abs(z - outZ) < road || Math.abs(z - railZ) < 4 || Math.abs(z - riverZ) < 10;
    // woods and single trees all round
    for (let i = 0; i < 520; i++) {
      const x = (r() - 0.5) * 2 * FAR, z = (r() - 0.5) * 2 * FAR, k = 0.8 + r() * 0.7;
      if (clear(x, z) || onRoad(x, z) || Math.hypot(x, z) > FAR) continue;
      trunks.push([x, 0.9 * k, z, k]);
      if (r() < 0.35) pines.push([x, 2.4 * k, z, k]); else crowns.push([x, 2.5 * k, z, 1.25 * k]);
    }
    // railway sleepers
    for (let x = -FAR; x <= FAR; x += 1.2) sleepers.push([x, 0.06, railZ]);
    // fields in patchwork to the south, east and west
    const crops = ['#c9b458', '#9cbf5a', '#7fae4e', '#d8c27a', '#a8c66c', '#b7a04a'];
    for (let i = 0; i < 40; i++) {
      const x = (r() - 0.5) * 2 * (FAR - 40), z = edgeZ + 16 + r() * (FAR - edgeZ - 50), w = 14 + r() * 22, d = 10 + r() * 16;
      const side = i % 3, [fx, fz] = side === 0 ? [x, z] : side === 1 ? [edgeX + 16 + Math.abs(x) % (FAR - edgeX - 40), (r() - 0.5) * 2 * edgeZ] : [-(edgeX + 16 + Math.abs(x) % (FAR - edgeX - 40)), (r() - 0.5) * 2 * edgeZ];
      if (onRoad(fx, fz) || clear(fx, fz)) continue;
      fields.push({ x: fx, z: fz, w, d, c: crops[i % crops.length] });
    }
    for (let k = 0; k < 3; k++) blades.push({ x: -edgeX - 60 - k * 26, z: 40 + k * 30, p: k });
    return { trunks, crowns, pines, sleepers, fields, blades };
  }, [edgeX, edgeZ]);
  // a far-off skyline all round; while looking from above, none between the camera and the town
  const skyline = useMemo(() => {
    const r = rnd(5), out = [];
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, d = FAR - 20 + r() * 30;
      const front = Math.cos(a) * 0.6 + Math.sin(a) * 0.8 > -0.1;
      out.push({ front, x: Math.cos(a) * d, z: Math.sin(a) * d, w: 8 + r() * 12, h: 10 + r() * 40, d: 8 + r() * 12, c: ['#b8c4cf', '#c9bfb2', '#a9b8a8', '#d0c7d6'][i % 4] });
    }
    return out;
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow><planeGeometry args={[2 * FAR + 200, 2 * FAR + 200]} /><meshStandardMaterial map={grass} /></mesh>
      {[[-FAR - 40, -120, 70], [-FAR + 40, FAR, 60], [60, -FAR - 30, 80], [FAR, 140, 70], [FAR + 20, -60, 55], [-FAR - 30, 60, 80]].map(([x, z, r]) => (
        <mesh key={x + ':' + z} position={[x, -r * 0.55, z]} scale={[1, 0.6, 1]}><sphereGeometry args={[r, 24, 12]} /><meshStandardMaterial color="#8fb27a" /></mesh>
      ))}
      {stuff.fields.map((f, i) => <B key={i} p={[f.x, 0.01, f.z]} s={[f.w, 0.02, f.d]} c={f.c} cast={false} />)}
      {/* country roads out of town, south and east, and north over the railway and the river */}
      <B p={[outX, 0.004, (edgeZ + FAR) / 2]} s={[road, 0.01, FAR - edgeZ]} c="#5d6166" cast={false} />
      <B p={[outX, 0.004, -(edgeZ + FAR) / 2]} s={[road, 0.01, FAR - edgeZ]} c="#5d6166" cast={false} />
      <mesh rotation-x={-Math.PI / 2} position={[(edgeX + FAR) / 2, 0.004, outZ]}><planeGeometry args={[FAR - edgeX, road]} /><meshStandardMaterial color="#5d6166" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-(edgeX + FAR) / 2, 0.004, outZ]}><planeGeometry args={[FAR - edgeX, road]} /><meshStandardMaterial color="#5d6166" /></mesh>
      {[-1, 1].map(k => <B key={k} p={[outX, 0.012, k * (edgeZ + FAR) / 2]} s={[0.15, 0.01, FAR - edgeZ]} c="#f2e6a0" cast={false} />)}
      {[-1, 1].map(k => <B key={'x' + k} p={[k * (edgeX + FAR) / 2, 0.012, outZ]} s={[FAR - edgeX, 0.01, 0.15]} c="#f2e6a0" cast={false} />)}
      {/* the railway: ballast, sleepers, two rails, a level crossing, and a train going by */}
      <B p={[0, 0.03, railZ]} s={[2 * FAR, 0.06, 3.4]} c="#8a8178" cast={false} />
      <Many geo={<boxGeometry args={[0.25, 0.1, 2.6]} />} c="#5a4232" cast={false} at={stuff.sleepers} />
      {[-0.72, 0.72].map(dz => <B key={dz} p={[0, 0.16, railZ + dz]} s={[2 * FAR, 0.1, 0.1]} c="#9aa0a6" metal={0.8} rough={0.3} cast={false} />)}
      {[-1, 1].map(k => <group key={k} position={[outX + k * (road / 2 + 0.6), 0, railZ + k * 2.6]}>
        <C p={[0, 1.2, 0]} r={0.06} h={2.4} c="#3a3f45" />
        <B p={[0, 2.2, 0]} s={[1.4, 0.25, 0.08]} c="#ffffff" /><B p={[0, 2.2, 0.01]} s={[0.4, 0.26, 0.08]} c="#c0392b" />
      </group>)}
      <Train z={railZ} />
      {/* the river, its sandy banks and a bridge */}
      <B p={[0, 0.02, riverZ]} s={[2 * FAR + 200, 0.02, 20]} c="#d8c9a3" cast={false} />
      <B p={[0, 0.035, riverZ]} s={[2 * FAR + 200, 0.02, 14]} c="#4f9fc9" rough={0.15} metal={0.2} cast={false} />
      <group position={[outX, 0, riverZ]}>
        <B p={[0, 0.9, 0]} s={[road + 1, 0.4, 22]} c="#a9a49b" />
        <B p={[0, 1.12, 0]} s={[road, 0.05, 22]} c="#5d6166" cast={false} />
        {[-1, 1].map(k => <B key={k} p={[k * (road / 2 + 0.35), 1.6, 0]} s={[0.2, 0.9, 22]} c="#c9c4ba" />)}
        {[-5, 0, 5].map(z => <B key={z} p={[0, 0.4, z]} s={[road - 1, 0.8, 1]} c="#8e8a82" />)}
      </group>
      {/* woods */}
      <Many geo={<cylinderGeometry args={[0.16, 0.22, 1.8, 7]} />} c="#7a5236" at={stuff.trunks} />
      <Many geo={<sphereGeometry args={[1, 10, 8]} />} c="#6f9f55" at={stuff.crowns} />
      <Many geo={<coneGeometry args={[1.3, 3, 8]} />} c="#3f7a4f" at={stuff.pines} />
      {stuff.blades.map(b => <Turbine key={b.x} {...b} />)}
      {skyline.filter(b => walk || !b.front).map((b, i) => <B key={i} p={[b.x, b.h / 2, b.z]} s={[b.w, b.h, b.d]} c={b.c} />)}
      {walk && !night && <Clouds />}
    </group>
  );
}

function Turbine({ x, z, p }) {
  const rotor = useRef();
  useFrame(({ clock }) => { if (rotor.current) rotor.current.rotation.z = clock.elapsedTime * 1.2 + p; });
  return (
    <group position={[x, 0, z]} rotation-y={-0.6}>
      <C p={[0, 9, 0]} r={0.35} r2={0.6} h={18} c="#f4f6f8" seg={12} />
      <B p={[0, 18.2, 0.3]} s={[0.9, 0.9, 2]} c="#f4f6f8" />
      <group ref={rotor} position={[0, 18.2, 1.4]} userData={{ live: true }}>
        {[0, 1, 2].map(k => <group key={k} rotation-z={k * 2.094}><B p={[0, 3.6, 0]} s={[0.45, 7, 0.08]} c="#ffffff" /></group>)}
        <C p={[0, 0, 0]} r={0.35} h={0.6} rx={Math.PI / 2} c="#dfe4e8" />
      </group>
    </group>
  );
}
