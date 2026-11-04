// Phones choke on draw calls, and the school is made of thousands of small boxes. Bake merges every static
// mesh inside it into one mesh per look (texture, shine, glow...), once after mounting, and hides the
// originals; plain colours go into the vertices, so boxes of every colour share one mesh. Anything that moves or reacts must be left out: put it under a group with userData.live,
// give it an event handler, or make it an instanced mesh. Remount (change `key`) to bake again.
// A moving part can have a Bake of its own inside it (a car, a forearm): mark the moving group with
// userData.joint and the Bakes around it leave it alone.
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const white = new THREE.Color('#ffffff');

const q = v => (v == null ? '' : Math.round(v * 10) / 10);
function lookKey(m, cast) {
  return [m.type, m.emissive && m.emissive.getHexString(), q(m.emissiveIntensity), q(m.roughness), q(m.metalness),
          m.opacity, m.transparent, m.map ? m.map.uuid : '', m.emissiveMap ? m.emissiveMap.uuid : '', m.side, m.depthWrite, cast].join('|');
}

export function Bake({ children }) {
  const g = useRef();
  useLayoutEffect(() => {
    const root = g.current;
    root.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map();
    const walk = (o, live) => {
      if (o !== root && (o.userData.joint || o.userData.baked)) return;
      live = live || !!o.userData.live || (o.__r3f && o.__r3f.eventCount > 0);
      if (o.isMesh && !o.isInstancedMesh && !live && !Array.isArray(o.material) && o.visible && o.geometry.index) {
        const k = lookKey(o.material, o.castShadow);
        if (!buckets.has(k)) buckets.set(k, { mat: o.material, cast: o.castShadow, list: [] });
        buckets.get(k).list.push(o);
      }
      o.children.forEach(c => walk(c, live));
    };
    walk(root, false);
    const made = [], m = new THREE.Matrix4();
    for (const { mat, cast, list } of buckets.values()) {
      if (list.length < 2) continue;
      const geos = list.map(o => {
        const geo = o.geometry.clone();
        for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
        const c = o.material.color || white, n = geo.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return geo.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
      });
      let merged = null;
      try { merged = mergeGeometries(geos); } catch (e) { merged = null; }
      geos.forEach(x => x.dispose());
      if (!merged) continue;
      const look = mat.clone();
      if (look.color) look.color.set('#ffffff');
      look.vertexColors = true;
      const mesh = new THREE.Mesh(merged, look);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.userData.baked = true;
      root.add(mesh); made.push(mesh);
      list.forEach(o => { o.visible = false; });
    }
    return () => made.forEach(x => { root.remove(x); x.geometry.dispose(); x.material.dispose(); });
  }, []);
  return <group ref={g}>{children}</group>;
}
