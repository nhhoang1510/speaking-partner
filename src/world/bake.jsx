// Phones choke on draw calls, and the school is made of thousands of small boxes. Bake merges every static
// mesh inside it into one mesh per look (colour, texture, shine...), once after mounting, and hides the
// originals. Anything that moves or reacts must be left out: put it under a group with userData.live,
// give it an event handler, or make it an instanced mesh. Remount (change `key`) to bake again.
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function lookKey(m, cast) {
  return [m.type, m.color && m.color.getHexString(), m.emissive && m.emissive.getHexString(), m.emissiveIntensity, m.roughness,
          m.metalness, m.opacity, m.transparent, m.map ? m.map.uuid : '', m.side, m.depthWrite, cast].join('|');
}

export function Bake({ children }) {
  const g = useRef();
  useLayoutEffect(() => {
    const root = g.current;
    root.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map();
    const walk = (o, live) => {
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
        return geo.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
      });
      let merged = null;
      try { merged = mergeGeometries(geos); } catch (e) { merged = null; }
      geos.forEach(x => x.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = cast; mesh.receiveShadow = true;
      root.add(mesh); made.push(mesh);
      list.forEach(o => { o.visible = false; });
    }
    return () => made.forEach(x => { root.remove(x); x.geometry.dispose(); });
  }, []);
  return <group ref={g}>{children}</group>;
}
