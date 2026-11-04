// The inside of the school as one wide open hall: no walls between the practice areas. Each area is a rounded
// island of its own floor with a coloured rim, half wrapped at the back by a low curved screen of slats. The
// areas are scattered loosely in three staggered bands, each turned its own way, with room to breathe between
// them; two winding walks run the length of the hall from the front door, joined by three cross walks, and
// columns with planter benches and potted trees stand in the gaps.
import { useMemo } from 'react';
import * as THREE from 'three';
import { B, C, S, Plant, Pendant, floorTexture } from './props.jsx';
import { Many, X0, BX } from './campus.jsx';

export const ZA = 3.4, ZB = 3.65, ZR = 1.5;              // area half width / half depth / corner radius
const OPEN = -1.2;                                         // the screen wraps the back, up to this local z
// where each area stands and which way it faces (rot 0: open side towards +z); in the order of the scenes
export const PLACES = [
  [7, -10.6, 0.12], [-3.5, -10.6, -0.1], [-14, -10.4, 0.18], [-24.5, -10.8, -0.12],
  [8, 10.6, 3.0], [-2.5, 10.55, 3.25], [-13.5, 10.4, 3.05], [-25, 10.7, 3.3],
  [2, 0.3, 3.4], [-8.5, -0.2, -0.25], [-19.5, 0.3, 3.0], [-28.8, -0.2, 0.1],
];
// the two long walks (side -1 north, +1 south), meeting at the front door; and the cross walks between them
const WALK_W = 1.1;
export function walkZ(side, x) {
  const t = Math.max(0, Math.min(1, (x - 4) / (BX - 4))), e = t * t * (3 - 2 * t);
  return side * (5.3 + 0.3 * Math.sin(x * 0.45 + side)) * (1 - e);
}
export const CROSS = [-3.25, -14, -24.15];
const gaps = (xs, z) => xs.map(x => [x, z]);
export const COLUMNS = [...gaps([1.75, -8.75, -19.25], -8.3), ...gaps([2.75, -8, -19.25], 8.3)];
const POTS = [...gaps([1.75, -8.75, -19.25, -30.5, 12.3], -12.6), ...gaps([2.75, -8, -19.25, -30.5, 12.3], 12.6)];

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

// a band of width 2*hw following one long walk (from x0 to x1), lying on the floor
function bandGeometry(side, x0, x1, off, hw) {
  const top = [], bot = [];
  for (let x = x0; x <= x1 + 1e-6; x += 0.5) { const z = walkZ(side, x) + off; top.push([x, -(z - hw)]); bot.push([x, -(z + hw)]); }
  const s = new THREE.Shape();
  s.moveTo(...top[0]); top.slice(1).forEach(p => s.lineTo(...p));
  bot.reverse().forEach(p => s.lineTo(...p));
  return new THREE.ShapeGeometry(s);
}

export function Promenade({ full }) {
  const x0 = X0 + 0.8, x1 = BX + 0.2;
  const geo = useMemo(() => [-1, 1].map(side => ({
    walk: bandGeometry(side, x0, x1, 0, WALK_W), a: bandGeometry(side, x0, x1, -WALK_W, 0.05), b: bandGeometry(side, x0, x1, WALK_W, 0.05),
  })), []);
  const map = useMemo(() => floorTexture('hall', [0.5, 0.5]), []);
  const crossMap = useMemo(() => floorTexture('hall', [1, 4.5]), []);
  const brass = <meshStandardMaterial color="#c9a66b" metalness={0.4} roughness={0.35} />;
  const flat = (g, y, mat, key) => <mesh key={key} geometry={g} rotation-x={-Math.PI / 2} position={[0, y, 0]} receiveShadow>{mat}</mesh>;
  return (
    <group>
      {geo.map((g, i) => <group key={i}>
        {flat(g.walk, 0.015, <meshStandardMaterial map={map} roughness={0.35} />)}
        {flat(g.a, 0.018, brass, 'a')}{flat(g.b, 0.018, brass, 'b')}
      </group>)}
      {CROSS.map(x => {
        const z0 = walkZ(-1, x), z1 = walkZ(1, x);
        return (
          <mesh key={x} rotation-x={-Math.PI / 2} position={[x, 0.014, (z0 + z1) / 2]} receiveShadow>
            <planeGeometry args={[2, z1 - z0]} /><meshStandardMaterial map={crossMap} roughness={0.35} />
          </mesh>
        );
      })}
      {/* a brass compass rose in the floor of the entrance */}
      <C p={[9.6, 0.012, 0]} r={1.7} h={0.01} c="#c9a66b" seg={40} metal={0.4} rough={0.35} />
      <C p={[9.6, 0.017, 0]} r={1.55} h={0.01} c="#f1e9da" seg={40} />
      {[0, 1, 2, 3].map(k => <B key={k} p={[9.6, 0.02, 0]} r={k * Math.PI / 4} s={[2.6, 0.01, 0.12]} c={k % 2 ? '#8a6648' : '#c9a66b'} cast={false} />)}
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
      {full && [-1, 1].flatMap(side => Array.from({ length: 11 }, (_, k) => X0 + 3 + k * 4.2).map(x => <Pendant key={side + ':' + x} p={[x, 2.6, walkZ(side, x)]} c="#e9e2d6" />))}
      {/* skylights over the long walks */}
      {full && [-1, 1].map(side => <B key={side} p={[(X0 + BX) / 2 - 2, 2.79, side * 5.3]} s={[BX - X0 - 10, 0.02, 1.4]} c="#f2fbff" e="#e6f6ff" ei={1} cast={false} />)}
    </group>
  );
}
