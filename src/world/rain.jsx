// Rain while walking: thin streaks falling in a box that follows the camera, so it is always raining
// around me without drawing rain over the whole town.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rnd } from './props.jsx';

const N = 1400, R = 28, TOP = 22, FALL = 26;

export function Rain() {
  const ref = useRef();
  const drops = useMemo(() => {
    const r = rnd(77);
    return Array.from({ length: N }, () => [(r() - 0.5) * 2 * R, r() * TOP, (r() - 0.5) * 2 * R, 0.8 + r() * 0.4]);
  }, []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useLayoutEffect(() => { ref.current.frustumCulled = false; }, []);
  useFrame(({ camera }, dt) => {
    const cx = camera.position.x, cz = camera.position.z, d = Math.min(dt, 0.1) * FALL;
    drops.forEach((p, i) => {
      p[1] -= d * p[3];
      if (p[1] < 0) p[1] += TOP;
      // keep each drop in the box around me, wrapping it to the other side when I walk away from it
      const x = cx + ((((p[0] - cx) % (2 * R)) + 3 * R) % (2 * R)) - R, z = cz + ((((p[2] - cz) % (2 * R)) + 3 * R) % (2 * R)) - R;
      p[0] = x; p[2] = z;
      ref.current.setMatrixAt(i, m.makeTranslation(x, p[1], z));
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, N]}>
      <boxGeometry args={[0.025, 0.55, 0.025]} />
      <meshBasicMaterial color="#b9c9d8" transparent opacity={0.55} depthWrite={false} />
    </instancedMesh>
  );
}
