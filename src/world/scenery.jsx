// Small shared pieces of the town and the countryside: ground textures, an instanced-mesh helper, and street
// furniture (trees, cars, lamps, benches) plus the clouds.
import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { B, C, S, paint, rnd } from './props.jsx';
import { Night } from './time.js';

// ---------------------------------------------------------------- textures
export function tex(kind, repeat) {
  return paint(kind, 256, 256, (g, w, h) => {
    const r = rnd(kind.length * 131 + 7);
    if (kind === 'grass') {
      g.fillStyle = '#86b366'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `hsla(${88 + r() * 30}, 45%, ${32 + r() * 30}%, .45)`; g.fillRect(r() * w, r() * h, 1.5, 3); }
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
    }
  }, repeat);
}

// one mesh drawn many times (tree trunks, sleepers, road markings...)
export function Many({ at, geo, c, cast = true, e }) {
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

export function Tree({ x, z, k, pine }) {
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

export function Car({ x, z, c, r = 0 }) {
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

export function Lamp({ x, z }) {
  const night = useContext(Night);
  return (
    <group position={[x, 0, z]}>
      <C p={[0, 1.6, 0]} r={0.05} h={3.2} c="#3a3f45" metal={0.6} seg={8} />
      <C p={[0, 3.25, 0]} r={0.08} r2={0.22} h={0.22} c="#3a3f45" metal={0.6} seg={10} />
      <S p={[0, 3.1, 0]} r={0.13} c="#fff6d6" e="#ffe8b0" />
      {night && <>
        <mesh position={[0, 3.05, 0]}><sphereGeometry args={[0.42, 10, 8]} /><meshBasicMaterial color="#ffd98a" transparent opacity={0.28} depthWrite={false} /></mesh>
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[2.6, 20]} /><meshBasicMaterial color="#ffcf7a" transparent opacity={0.3} depthWrite={false} /></mesh>
      </>}
    </group>
  );
}

export function Bench({ x, z, r = 0 }) {
  return (
    <group position={[x, 0, z]} rotation-y={r}>
      {[0, 0.13, 0.26].map(dz => <B key={dz} p={[0, 0.45, dz - 0.13]} s={[1.6, 0.05, 0.1]} c="#a8744b" />)}
      {[0.75, 0.88].map(y => <B key={y} p={[0, y, -0.22]} s={[1.6, 0.08, 0.04]} c="#a8744b" />)}
      {[-0.7, 0.7].map(dx => <B key={dx} p={[dx, 0.22, 0]} s={[0.06, 0.44, 0.45]} c="#3a3f45" metal={0.5} />)}
    </group>
  );
}

export function Clouds() {
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

