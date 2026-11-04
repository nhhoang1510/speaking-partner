// The inside of the school as one open hall: no walls between the practice areas. Each area is a rounded
// island of its own floor with a coloured rim, half wrapped at the back by a low curved screen of slats, and
// they all open onto a winding promenade that runs from the front door to the far end. Round columns with
// planter benches and potted trees stand between the areas.
import { useMemo } from 'react';
import * as THREE from 'three';
import { B, C, S, Plant, Pendant, floorTexture } from './props.jsx';
import { Many, COLS, X0, BX } from './campus.jsx';

export const ZA = 3.4, ZB = 3.65, ZR = 1.5, ZC = 5.1;    // area half width / half depth / corner radius; its centre is at |z| = ZC
const OPEN = -1.2;                                         // the screen wraps the back, up to this local z
export const pathZ = x => 0.4 * Math.sin((x - X0) * Math.PI / 7);   // the promenade's centre line
const PATH_W = 1.15;
export const COLUMNS = Array.from({ length: COLS - 1 }, (_, k) => X0 + 7 * (k + 1)).flatMap(x => [[x, -1.95], [x, 1.95]]);
const POTS = Array.from({ length: COLS - 1 }, (_, k) => X0 + 7 * (k + 1)).flatMap(x => [[x, -8.3], [x, 8.3]]);

// signed distance to an area's rounded outline (local coordinates; negative inside)
function outline(x, z, a = ZA, b = ZB, r = ZR) {
  const qx = Math.abs(x) - a + r, qz = Math.abs(z) - b + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

// walking: columns, potted trees and the screens are solid; areas: [{pos, rot}]
export function blockedInside(x, z, areas) {
  if (COLUMNS.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 0.8)) return true;
  if (POTS.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 0.45)) return true;
  return areas.some(r => {
    const dx = x - r.pos.x, dz = z - r.pos.z, c = Math.cos(r.rot), s = Math.sin(r.rot);
    const lx = c * dx - s * dz, lz = s * dx + c * dz;
    return lz < OPEN + 0.2 && Math.abs(outline(lx, lz)) < 0.22;
  });
}

function roundRect(a, b, r) {
  const s = new THREE.Shape();
  s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.absarc(a - r, -b + r, r, -Math.PI / 2, 0);
  s.lineTo(a, b - r); s.absarc(a - r, b - r, r, 0, Math.PI / 2);
  s.lineTo(-a + r, b); s.absarc(-a + r, b - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-a, -b + r); s.absarc(-a + r, -b + r, r, Math.PI, Math.PI * 1.5);
  return s;
}
// an area's floor, as a rounded shape with its texture stretched over it once (like a plane of the same size)
export function islandGeometry(inset = 0.12) {
  const a = ZA - inset, b = ZB - inset, g = new THREE.ShapeGeometry(roundRect(a, b, ZR - inset), 10);
  const uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + a) / (2 * a), (p.getY(i) + b) / (2 * b));
  return g;
}

// points along the back half of the outline, every `step`
function screenPoints(step) {
  const a = ZA, b = ZB, r = ZR, pts = [];
  const line = (x0, z0, x1, z1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step)); for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]); };
  const arc = (cx, cz, t0, t1) => { const n = Math.max(1, Math.round(r * Math.abs(t1 - t0) / step)); for (let i = 0; i < n; i++) { const t = t0 + (t1 - t0) * i / n; pts.push([cx + r * Math.cos(t), cz + r * Math.sin(t)]); } };
  line(-a, OPEN, -a, -b + r); arc(-a + r, -b + r, Math.PI, Math.PI * 1.5);
  line(-a + r, -b, a - r, -b); arc(a - r, -b + r, Math.PI * 1.5, Math.PI * 2);
  line(a, -b + r, a, OPEN); pts.push([a, OPEN]);
  return pts;
}
const SLATS = screenPoints(0.2);
const RAIL = new THREE.CatmullRomCurve3(screenPoints(0.5).map(([x, z]) => new THREE.Vector3(x, 0, z)));

// the dressing of one area, in its own (rotated) frame: rim, slatted screen with rails, a ring of light above
export function Area({ accent, wall, h, full }) {
  const rim = useMemo(() => {
    const s = roundRect(ZA, ZB, ZR); s.holes.push(roundRect(ZA - 0.14, ZB - 0.14, ZR - 0.14));
    return new THREE.ShapeGeometry(s, 10);
  }, []);
  const rail = useMemo(() => new THREE.TubeGeometry(RAIL, 64, 0.035, 6, false), []);
  const slats = useMemo(() => SLATS.map(([x, z]) => [x, h / 2, z]), [h]);
  return (
    <group>
      <mesh geometry={rim} rotation-x={-Math.PI / 2} position={[0, 0.022, 0]} receiveShadow>
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
      <Many geo={<cylinderGeometry args={[0.032, 0.032, h, 6]} />} c={accent} at={slats} />
      {[0.12, h].map(y => (
        <mesh key={y} geometry={rail} position={[0, y, 0]} castShadow><meshStandardMaterial color="#8a6648" roughness={0.6} /></mesh>
      ))}
      {/* a low bookcase-bench along the back, in the area's light colour */}
      <B p={[0, 0.22, -ZB + 0.38]} s={[2.6, 0.44, 0.42]} c={wall} />
      <B p={[0, 0.45, -ZB + 0.38]} s={[2.66, 0.04, 0.46]} c="#a0704a" />
      {full && <>
        <mesh position={[0, 2.62, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[1.5, 0.05, 8, 48]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
        </mesh>
        {[0, 1, 2].map(k => <C key={k} p={[Math.cos(k * 2.1) * 1.5, 2.71, Math.sin(k * 2.1) * 1.5]} r={0.008} h={0.18} c="#666" />)}
      </>}
    </group>
  );
}

// a band of width 2*hw following the promenade (from x0 to x1), lying on the floor
function bandGeometry(x0, x1, off, hw) {
  const top = [], bot = [];
  for (let x = x0; x <= x1 + 1e-6; x += 0.5) { const z = pathZ(x) + off; top.push([x, -(z - hw)]); bot.push([x, -(z + hw)]); }
  const s = new THREE.Shape();
  s.moveTo(...top[0]); top.slice(1).forEach(p => s.lineTo(...p));
  bot.reverse().forEach(p => s.lineTo(...p));
  return new THREE.ShapeGeometry(s);
}

export function Promenade({ full }) {
  const x0 = X0 + 0.15, x1 = BX + 0.2;
  const geo = useMemo(() => ({
    path: bandGeometry(x0, x1, 0, PATH_W), edgeA: bandGeometry(x0, x1, -PATH_W, 0.05), edgeB: bandGeometry(x0, x1, PATH_W, 0.05),
  }), []);
  const map = useMemo(() => floorTexture('hall', [0.5, 0.5]), []);
  const flat = (g, y, mat, key) => <mesh key={key} geometry={g} rotation-x={-Math.PI / 2} position={[0, y, 0]} receiveShadow>{mat}</mesh>;
  return (
    <group>
      {flat(geo.path, 0.015, <meshStandardMaterial map={map} roughness={0.35} />)}
      {flat(geo.edgeA, 0.018, <meshStandardMaterial color="#c9a66b" metalness={0.4} roughness={0.35} />, 'a')}
      {flat(geo.edgeB, 0.018, <meshStandardMaterial color="#c9a66b" metalness={0.4} roughness={0.35} />, 'b')}
      {/* columns rising out of round planter benches; from above the near ones are cut low */}
      {COLUMNS.map(([x, z]) => {
        const h = full ? 2.8 : z < 0 ? 2.4 : 0.9;
        return (
          <group key={x + ':' + z} position={[x, 0, z]}>
            <C p={[0, h / 2, 0]} r={0.2} h={h} c="#f3eee6" seg={18} />
            <C p={[0, 0.22, 0]} r={0.72} h={0.44} c="#d9cdb9" seg={28} />
            <C p={[0, 0.46, 0]} r={0.76} h={0.05} c="#a0704a" seg={28} />
            <C p={[0, 0.5, 0]} r={0.45} h={0.06} c="#4a3426" seg={20} />
            {[0, 1, 2, 3, 4].map(k => <S key={k} p={[Math.cos(k * 1.26) * 0.3, 0.68, Math.sin(k * 1.26) * 0.3]} r={0.2} c={k % 2 ? '#6a9d63' : '#5f9159'} />)}
          </group>
        );
      })}
      {POTS.map(([x, z]) => <Plant key={x + ':' + z} p={[x, 0, z]} s={1.25} pot="#d9cdb9" />)}
      {full && Array.from({ length: 11 }, (_, k) => X0 + 2 + k * 3.8).map(x => <Pendant key={x} p={[x, 2.6, pathZ(x)]} c="#e9e2d6" />)}
      {/* a skylight over the promenade */}
      {full && <B p={[(X0 + BX) / 2, 2.79, 0]} s={[BX - X0 - 3, 0.02, 1.4]} c="#f2fbff" e="#e6f6ff" ei={1} cast={false} />}
    </group>
  );
}
