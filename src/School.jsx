// The school, in 3D: a corridor with eight practice rooms, one per scene, each furnished for its situation
// and staffed by that scene's AI character. Every learner online is a little character: they wait in the
// corridor, walk into the room they practise in, and show what they are doing and saying.
// Seen from above at an angle, with the near walls cut low so every room is visible (a doll's house view).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SCENES } from './scenes.js';

const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const SAID_SHOW_MS = 12000;
const ENTRANCE = new THREE.Vector3(17, 0, 0);
const ROOM_W = 7, ROOM_D = 7.5, HALL = 1.5;          // room size; the corridor runs along x, |z| < HALL
const TALL = 2.4, PART = 0.9, LOW = 0.35;             // far outer walls, partitions, near walls

// rooms: four north of the corridor, four south; `in` is the direction from the room to the corridor
export const ROOMS = Object.fromEntries(SCENES.map((sc, i) => {
  const north = i < 4, x = -10.5 + (i % 4) * ROOM_W, z = north ? -(HALL + ROOM_D / 2) : HALL + ROOM_D / 2;
  return [sc.id, { scene: sc, i, north, pos: new THREE.Vector3(x, 0, z), rot: north ? 0 : Math.PI }];
}));

const hsl = (h, s, l) => `hsl(${h}, ${s}%, ${l}%)`;  // three.js wants the comma form

export function describe(u) {
  const r = u.scene && ROOMS[u.scene];
  if (!r) return 'Đang ở hành lang';
  const sc = r.scene;
  return {
    listening: `Đang nói với ${sc.name}`, thinking: `${sc.name} đang nghĩ`, speaking: `Đang nghe ${sc.name} nói`,
    summary: 'Đang xem nhận xét', idle: `Đang luyện ${sc.title}`,
  }[u.phase] || `Đang luyện ${sc.title}`;
}

// where a learner stands: along the corridor when not practising, else in front of their room's character
function spot(u, k) {
  const r = u.scene && ROOMS[u.scene];
  if (!r) return new THREE.Vector3(-11 + ((k * 3.7) % 23), 0, (k % 2 ? 0.55 : -0.55));
  const local = new THREE.Vector3((k % 3 - 1) * 0.95, 0, 0.9 + Math.floor(k / 3) * 0.9);
  return local.applyAxisAngle(new THREE.Vector3(0, 1, 0), r.rot).add(r.pos);
}

// ---------------------------------------------------------------- building blocks
function B({ p, s, c, r = 0, cast = true, e }) {            // a box: position, size, colour
  return (
    <mesh position={p} rotation-y={r} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={e || '#000'} emissiveIntensity={e ? 0.6 : 0} />
    </mesh>
  );
}
function C({ p, r: rad, h, c, seg = 18 }) {                // a cylinder
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[rad, rad, h, seg]} />
      <meshStandardMaterial color={c} />
    </mesh>
  );
}
function S({ p, r: rad, c, sc }) {                          // a sphere
  return (
    <mesh position={p} scale={sc} castShadow>
      <sphereGeometry args={[rad, 18, 14]} />
      <meshStandardMaterial color={c} />
    </mesh>
  );
}
function Plant({ p, s = 1 }) {
  return (
    <group position={p} scale={s}>
      <C p={[0, 0.25, 0]} r={0.25} h={0.5} c="#c98b5e" />
      <S p={[0, 0.8, 0]} r={0.42} c="#6f9e6a" />
      <S p={[0.18, 1.1, 0.05]} r={0.25} c="#7fb07a" />
    </group>
  );
}
function Stool({ p }) { return <group position={p}><C p={[0, 0.3, 0]} r={0.06} h={0.6} c="#555" /><C p={[0, 0.62, 0]} r={0.24} h={0.08} c="#b5764a" /></group>; }
function Chair({ p, r = 0, c = '#6b7a8f' }) {
  return (
    <group position={p} rotation-y={r}>
      <B p={[0, 0.45, 0]} s={[0.55, 0.1, 0.55]} c={c} />
      <B p={[0, 0.8, -0.25]} s={[0.55, 0.6, 0.08]} c={c} />
      <C p={[0, 0.2, 0]} r={0.05} h={0.4} c="#444" />
    </group>
  );
}
function Sofa({ p, r = 0, c }) {
  return (
    <group position={p} rotation-y={r}>
      <B p={[0, 0.25, 0]} s={[2, 0.45, 0.85]} c={c} />
      <B p={[0, 0.65, -0.33]} s={[2, 0.5, 0.2]} c={c} />
      <B p={[-0.95, 0.45, 0]} s={[0.15, 0.4, 0.85]} c={c} />
      <B p={[0.95, 0.45, 0]} s={[0.15, 0.4, 0.85]} c={c} />
    </group>
  );
}
function Shelf({ p, r = 0 }) {
  const books = ['#e4572e', '#29bf12', '#00a5cf', '#f3a712', '#9b5de5', '#f15bb5'];
  return (
    <group position={p} rotation-y={r}>
      <B p={[0, 0.9, 0]} s={[1.6, 1.8, 0.4]} c="#a77b52" />
      {[0.45, 0.95, 1.45].map((y, j) => books.map((c, i) => (
        <B key={j + '-' + i} p={[-0.6 + i * 0.24, y, 0.08]} s={[0.18, 0.36, 0.28]} c={books[(i + j) % 6]} cast={false} />
      )))}
    </group>
  );
}
function Board({ p, w = 2.4, h = 1, c = '#26323a', e }) {  // a sign or screen hung on the back wall
  return <B p={p} s={[w, h, 0.08]} c={c} e={e} cast={false} />;
}

// ---------------------------------------------------------------- what is in each room (corridor towards +z)
function Furniture({ id, hue }) {
  const accent = hsl(hue, 55, 52), soft = hsl(hue, 45, 80);
  switch (id) {
    case 'coffee': return (
      <group>
        <B p={[0, 0.5, -1.4]} s={[3.4, 1, 0.8]} c="#8a5a3b" />
        <B p={[0, 1.03, -1.4]} s={[3.5, 0.06, 0.9]} c="#e9dccb" />
        <B p={[-1, 1.35, -1.55]} s={[0.6, 0.6, 0.45]} c="#bfc5c9" />
        <C p={[0.6, 1.15, -1.3]} r={0.1} h={0.2} c="#fff" />
        <Board p={[0, 2.2, -3.6]} w={2.8} h={0.9} c="#2d2a26" e={accent} />
        {[[-2.2, 1.6], [2.2, 1.6]].map(([x, z]) => (
          <group key={x}><C p={[x, 0.55, z]} r={0.5} h={0.06} c="#f5efe6" /><C p={[x, 0.27, z]} r={0.06} h={0.55} c="#555" />
            <Stool p={[x - 0.7, 0, z]} /><Stool p={[x + 0.7, 0, z]} /></group>
        ))}
        <Plant p={[-3, 0, -3.1]} />
      </group>);
    case 'interview': return (
      <group>
        <B p={[0, 0.75, -1.3]} s={[2.4, 0.08, 1.1]} c="#7c5a43" />
        <B p={[-1.1, 0.37, -1.3]} s={[0.1, 0.75, 1]} c="#6a4c39" /><B p={[1.1, 0.37, -1.3]} s={[0.1, 0.75, 1]} c="#6a4c39" />
        <B p={[0.5, 0.95, -1.4]} s={[0.6, 0.35, 0.05]} c="#222" e="#3b6ea5" />
        <Chair p={[-0.7, 0, -0.2]} r={Math.PI} c={accent} />
        <Shelf p={[-2.6, 0, -3.4]} /><Shelf p={[2.6, 0, -3.4]} />
        <Board p={[0, 2.1, -3.6]} w={1.6} h={1} c="#f3efe6" />
        <Plant p={[3, 0, 1.5]} />
      </group>);
    case 'hotel': return (
      <group>
        <B p={[0, 0.55, -1.4]} s={[3.2, 1.1, 0.8]} c="#efe6d6" />
        <B p={[0, 1.13, -1.4]} s={[3.3, 0.06, 0.9]} c={accent} />
        <S p={[1, 1.22, -1.3]} r={0.12} c="#d4af37" sc={[1, 0.6, 1]} />
        <Board p={[0, 2.1, -3.6]} w={2.2} h={0.8} c="#7a5a3a" />
        {[-0.7, -0.25, 0.2, 0.65].map(x => <S key={x} p={[x, 2.1, -3.5]} r={0.07} c="#d4af37" />)}
        <Sofa p={[-2.2, 0, 2]} r={Math.PI / 2} c={soft} />
        <Plant p={[2.9, 0, -3]} s={1.2} /><Plant p={[2.9, 0, 2.4]} />
      </group>);
    case 'airport': return (
      <group>
        <B p={[0, 0.5, -1.4]} s={[2.4, 1, 0.8]} c="#d9dde2" />
        <B p={[0, 1.03, -1.4]} s={[2.5, 0.06, 0.9]} c={accent} />
        <B p={[1.9, 0.25, -1.3]} s={[1.3, 0.5, 0.8]} c="#555b62" />
        <B p={[1.9, 0.52, -1.3]} s={[1.2, 0.04, 0.7]} c="#2c2f33" />
        <Board p={[0, 2.2, -3.6]} w={3.2} h={1.1} c="#11161c" e="#f3a712" />
        <B p={[-2.3, 0.4, 1.4]} s={[0.55, 0.8, 0.35]} c="#e4572e" /><B p={[-1.6, 0.35, 1.6]} s={[0.5, 0.7, 0.32]} c="#00a5cf" />
        {[-1.2, -0.4, 0.4, 1.2].map(x => <C key={x} p={[x, 0.45, 3]} r={0.04} h={0.9} c="#999" />)}
      </group>);
    case 'doctor': return (
      <group>
        <B p={[0.4, 0.75, -1.4]} s={[2, 0.08, 1]} c="#e8eef2" />
        <B p={[-0.5, 0.37, -1.4]} s={[0.1, 0.75, 0.9]} c="#cfd8de" /><B p={[1.3, 0.37, -1.4]} s={[0.1, 0.75, 0.9]} c="#cfd8de" />
        <B p={[-2.4, 0.45, -1.2]} s={[1, 0.5, 2.2]} c="#ffffff" />
        <B p={[-2.4, 0.73, -2.1]} s={[0.9, 0.08, 0.4]} c="#9fd3e6" />
        <B p={[2.7, 0.8, -3.2]} s={[0.9, 1.6, 0.6]} c="#f1f4f6" />
        <B p={[0, 2.2, -3.6]} s={[0.25, 0.8, 0.05]} c="#e4572e" cast={false} /><B p={[0, 2.2, -3.6]} s={[0.8, 0.25, 0.05]} c="#e4572e" cast={false} />
        <Chair p={[0.4, 0, -0.3]} r={Math.PI} c={soft} />
        <Plant p={[2.9, 0, 2]} />
      </group>);
    case 'shop': return (
      <group>
        <B p={[1.4, 0.5, -1.6]} s={[1.6, 1, 0.7]} c="#f5efe6" />
        <B p={[1.4, 1.02, -1.6]} s={[1.7, 0.05, 0.8]} c={accent} />
        {[-2.6, 2.6].map(x => (
          <group key={x} position={[x, 0, 0.6]}>
            <C p={[0, 0.9, -1.1]} r={0.04} h={1.8} c="#888" /><C p={[0, 0.9, 1.1]} r={0.04} h={1.8} c="#888" />
            <B p={[0, 1.78, 0]} s={[0.06, 0.06, 2.3]} c="#888" />
            {[-0.8, -0.4, 0, 0.4, 0.8].map((z, i) => <B key={z} p={[0, 1.25, z]} s={[0.5, 0.95, 0.12]} c={['#f15bb5', '#00a5cf', '#f3a712', '#29bf12', '#9b5de5'][i]} />)}
          </group>
        ))}
        <B p={[-1.2, 1.1, -3.5]} s={[0.9, 1.8, 0.06]} c="#cfe9f3" e="#9fd3e6" />
        <Board p={[1.2, 2.2, -3.6]} w={1.8} h={0.6} c={accent} />
      </group>);
    case 'friend': return (
      <group>
        <C p={[0, 0.02, 0.2]} r={2.3} h={0.03} c={soft} seg={40} />
        <Sofa p={[0, 0, -1.5]} c="#7a9e7e" />
        <Sofa p={[-2.1, 0, 0.3]} r={Math.PI / 2} c="#7a9e7e" />
        <B p={[0, 0.3, 0]} s={[1.3, 0.08, 0.8]} c="#b5764a" />
        <C p={[0.3, 0.4, 0]} r={0.08} h={0.14} c="#fff" />
        <C p={[2.6, 0.8, -2.6]} r={0.05} h={1.6} c="#444" /><S p={[2.6, 1.7, -2.6]} r={0.28} c="#ffe6a8" />
        <Shelf p={[-2, 0, -3.4]} />
      </group>);
    default: return (                                   // free talk: a relaxed corner
      <group>
        <Board p={[0, 1.8, -3.6]} w={3} h={1.4} c="#ffffff" />
        <B p={[-0.6, 2, -3.54]} s={[1, 0.06, 0.02]} c={accent} cast={false} /><B p={[0.3, 1.7, -3.54]} s={[1.4, 0.06, 0.02]} c="#3b6ea5" cast={false} />
        {[[-2, 0.6, '#f3a712'], [2, 0.8, '#00a5cf'], [-1.6, 2.2, '#f15bb5'], [1.8, 2.3, '#29bf12']].map(([x, z, c]) => (
          <S key={x} p={[x, 0.32, z]} r={0.55} c={c} sc={[1, 0.6, 1]} />
        ))}
        <Shelf p={[2.6, 0, -3.4]} />
        <Plant p={[-3, 0, -3]} s={1.2} />
      </group>);
  }
}

// ---------------------------------------------------------------- characters
function Character({ color, skin = '#f3d2b3', hair = '#3a2a22' }) {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow><capsuleGeometry args={[0.3, 0.42, 6, 14]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 1.3, 0]} castShadow><sphereGeometry args={[0.38, 24, 18]} /><meshStandardMaterial color={skin} /></mesh>
      <mesh position={[0, 1.44, -0.05]} scale={[1.04, 0.72, 1.04]}>
        <sphereGeometry args={[0.38, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={hair} />
      </mesh>
      <mesh position={[-0.13, 1.33, 0.33]}><sphereGeometry args={[0.05, 10, 8]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[0.13, 1.33, 0.33]}><sphereGeometry args={[0.05, 10, 8]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[-0.22, 1.22, 0.3]}><sphereGeometry args={[0.06, 10, 8]} /><meshStandardMaterial color="#f4a6a0" /></mesh>
      <mesh position={[0.22, 1.22, 0.3]}><sphereGeometry args={[0.06, 10, 8]} /><meshStandardMaterial color="#f4a6a0" /></mesh>
    </group>
  );
}

function Npc({ room, busy }) {
  const g = useRef();
  const hairs = { coffee: '#7a4a2a', interview: '#555', hotel: '#222', airport: '#c8a15a', doctor: '#2b2b2b', shop: '#b5651d', friend: '#4a3426', free: '#8a5a3b' };
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    g.current.position.y = busy === 'speaking' ? Math.abs(Math.sin(t * 7)) * 0.08 : Math.sin(t * 1.4 + room.i) * 0.02;
    g.current.rotation.z = busy === 'speaking' ? Math.sin(t * 5) * 0.06 : 0;
  });
  return (
    <group position={[0, 0, -2.3]}>
      <group ref={g}><Character color={hsl(room.scene.hue, 50, 45)} hair={hairs[room.scene.id]} /></group>
    </group>
  );
}

function Learner({ u, target, me, now }) {
  const g = useRef(), body = useRef(), ring = useRef();
  const pos = useRef(ENTRANCE.clone());               // newcomers walk in through the front door
  const path = useRef([]);
  const last = useRef(null);
  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    // walk via the corridor: out of the old room's door, along the corridor, in through the new door
    if (!last.current || !last.current.equals(target)) {
      last.current = target.clone();
      const p = pos.current, pts = [];
      if (Math.abs(p.z) > HALL) pts.push(new THREE.Vector3(Math.round((p.x + 10.5) / ROOM_W) * ROOM_W - 10.5, 0, 0));
      if (p.x > 14) pts.push(new THREE.Vector3(13, 0, 0));
      if (Math.abs(target.z) > HALL) pts.push(new THREE.Vector3(Math.round((target.x + 10.5) / ROOM_W) * ROOM_W - 10.5, 0, 0));
      pts.push(target.clone());
      path.current = pts;
    }
    const t = clock.elapsedTime, p = pos.current, goal = path.current[0];
    let walking = false;
    if (goal) {
      const d = goal.clone().sub(p), dist = d.length();
      if (dist < 0.06) path.current.shift();
      else {
        walking = true;
        p.add(d.multiplyScalar(Math.min(1, (dt * 3.4) / dist)));
        const want = Math.atan2(goal.x - p.x, goal.z - p.z);
        g.current.rotation.y = want;
      }
    }
    if (!walking) {                                   // face the room's character, or across the corridor
      const r = u.scene && ROOMS[u.scene];
      const look = r ? r.pos.clone().add(new THREE.Vector3(0, 0, r.north ? -2.3 : 2.3)) : new THREE.Vector3(p.x, 0, p.z > 0 ? -3 : 3);
      const want = Math.atan2(look.x - p.x, look.z - p.z);
      let d = want - g.current.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      g.current.rotation.y += d * Math.min(1, dt * 5);
    }
    g.current.position.copy(p);
    body.current.position.y = walking ? Math.abs(Math.sin(t * 11)) * 0.12 : u.phase === 'listening' ? Math.abs(Math.sin(t * 8)) * 0.07 : 0;
    body.current.rotation.z = u.phase === 'thinking' ? Math.sin(t * 2) * 0.08 : 0;
    if (ring.current) { const k = 1 + (Math.sin(t * 6) + 1) * 0.12; ring.current.scale.set(k, k, k); }
  });

  const recent = u.said && now - (u.saidAt || 0) < SAID_SHOW_MS;
  return (
    <group ref={g}>
      {u.phase === 'listening' && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.45, 0.58, 32]} /><meshBasicMaterial color="#29bf12" transparent opacity={0.75} />
        </mesh>
      )}
      {me && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
          <circleGeometry args={[0.6, 32]} /><meshBasicMaterial color={u.color} transparent opacity={0.3} />
        </mesh>
      )}
      <group ref={body}><Character color={u.color} hair={me ? '#3a2a22' : '#4a3426'} /></group>
      <Html position={[0, 2.05, 0]} center zIndexRange={[20, 10]}>
        <div className={'w-tag' + (me ? ' me' : '')} style={{ '--c': u.color }}>
          {recent && <div className="w-said">{u.said}</div>}
          {!recent && u.phase === 'thinking' && <div className="w-said dots"><i /><i /><i /></div>}
          <span>{u.name}{me ? ' (bạn)' : ''}</span>
        </div>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------- the building
function Room({ room, count, busy, mine, onPick }) {
  const [hover, setHover] = useState(false);
  const { scene: sc } = room;
  const floor = hover || mine ? hsl(sc.hue, 50, 82) : hsl(sc.hue, 35, 88);
  return (
    <group position={room.pos}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow
        onPointerOver={e => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
        onClick={e => { e.stopPropagation(); onPick(sc); }}>
        <planeGeometry args={[ROOM_W - 0.2, ROOM_D - 0.2]} />
        <meshStandardMaterial color={floor} />
      </mesh>
      <group rotation-y={room.rot}>
        <Furniture id={sc.id} hue={sc.hue} />
        <Npc room={room} busy={busy} />
      </group>
      <Html position={[0, room.north ? 3.2 : 1.6, room.north ? -3 : -3.4]} center zIndexRange={[8, 0]}>
        <button className={'w-room' + (mine ? ' mine' : '') + (hover ? ' hover' : '')} style={{ '--c': hsl(sc.hue, 55, 45) }} onClick={() => onPick(sc)}>
          {sc.title}<small>{sc.name}{count ? ` · ${count} người` : ''}</small>
        </button>
      </Html>
    </group>
  );
}

function Walls() {
  const wall = '#efe5d6', top = '#d9cbb6';
  const W = (x, z, w, d, h) => (
    <group key={`${x}:${z}:${w}:${d}`}>
      <B p={[x, h / 2, z]} s={[w, h, d]} c={wall} />
      <B p={[x, h + 0.02, z]} s={[w + 0.02, 0.04, d + 0.02]} c={top} cast={false} />
    </group>
  );
  const out = [];
  const X0 = -14, X1 = 14, Z0 = -(HALL + ROOM_D), Z1 = HALL + ROOM_D, door = 1.8;
  out.push(W(0, Z0, 28, 0.25, TALL));                      // far outer walls: tall
  out.push(W(X0, 0, 0.25, Z1 - Z0, TALL));
  out.push(W(0, Z1, 28, 0.25, LOW));                       // near outer walls: low
  out.push(W(X1, -(HALL + Z1) / 2 - 0.5, 0.25, Z1 - HALL + 1, LOW));
  out.push(W(X1, (HALL + Z1) / 2 + 0.5, 0.25, Z1 - HALL + 1, LOW));
  for (let i = 1; i < 4; i++) {                            // partitions between rooms
    const x = X0 + i * ROOM_W;
    out.push(W(x, -(HALL + ROOM_D / 2), 0.2, ROOM_D, PART));
    out.push(W(x, HALL + ROOM_D / 2, 0.2, ROOM_D, PART));
  }
  for (let i = 0; i < 4; i++) {                            // corridor walls, with a door into every room
    const cx = X0 + ROOM_W / 2 + i * ROOM_W, seg = (ROOM_W - door) / 2;
    for (const side of [-1, 1]) {
      const z = side * HALL, h = side < 0 ? LOW : PART;
      out.push(W(cx - door / 2 - seg / 2, z, seg, 0.2, h));
      out.push(W(cx + door / 2 + seg / 2, z, seg, 0.2, h));
    }
  }
  return <group>{out}</group>;
}

function Grounds() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[90, 70]} /><meshStandardMaterial color="#cfe0b8" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 2 * (HALL + ROOM_D)]} /><meshStandardMaterial color="#f4ede2" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0]} receiveShadow>
        <planeGeometry args={[28, HALL * 2]} /><meshStandardMaterial color="#e6d8c3" />
      </mesh>
      {/* the path to the front door */}
      <mesh rotation-x={-Math.PI / 2} position={[19, 0.005, 0]}><planeGeometry args={[10, 2.4]} /><meshStandardMaterial color="#e2d3bd" /></mesh>
      {[[17, -5], [20, 5], [-17, -6], [-17, 6], [6, 13], [-6, 13], [18, -11]].map(([x, z]) => (
        <group key={x + ':' + z} position={[x, 0, z]}>
          <C p={[0, 0.6, 0]} r={0.18} h={1.2} c="#8a5a3b" />
          <S p={[0, 1.7, 0]} r={1} c="#7fa76f" /><S p={[0.4, 2.3, 0.2]} r={0.65} c="#8cb87c" />
        </group>
      ))}
      <Html position={[16.5, 2.6, 0]} center zIndexRange={[8, 0]}>
        <div className="w-sign">Speaking School</div>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------- camera: overview, or close on my room
function Rig({ focus, fit, nonce }) {
  const { camera, controls, size } = useThree();
  const anim = useRef(0);
  const goal = useMemo(() => {
    const r = focus && ROOMS[focus];
    // phones in portrait: fill the width and let the sides run off, rather than a tiny whole school
    const base = (size.width < 600 ? size.width / 24 : Math.min(size.width / 34, size.height / 24)) * fit;
    return r ? { target: r.pos.clone(), zoom: Math.min(size.width / 13, size.height / 12) }
             : { target: new THREE.Vector3(0, 0, 0), zoom: base };
  }, [focus, size.width, size.height, fit, nonce]);
  useEffect(() => { anim.current = 1.4; }, [goal]);
  // phones: in a room the conversation covers the lower half, so show the room in the strip above it
  useEffect(() => {
    if (focus && size.width < 600) camera.setViewOffset(size.width, size.height, 0, size.height * 0.27, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [focus, size.width, size.height]);
  useEffect(() => {
    if (!controls) return;
    const stop = () => { anim.current = 0; };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);
  useFrame((_, dt) => {
    if (!controls || anim.current <= 0) return;
    anim.current -= dt;
    const k = Math.min(1, dt * 4);
    const off = camera.position.clone().sub(controls.target);
    controls.target.lerp(goal.target, k);
    camera.position.copy(controls.target).add(off);
    camera.zoom += (goal.zoom - camera.zoom) * k;
    camera.updateProjectionMatrix();
    controls.update();
  });
  return null;
}

export default function School({ users, meId, focus, fit = 1, nonce = 0, onPick }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // a stable slot per learner inside each place, so nobody jumps around when others come and go
  const targets = useMemo(() => {
    const per = {};
    return Object.fromEntries([...users].sort((a, b) => a.id.localeCompare(b.id)).map(u => {
      const k = u.scene || '_hall'; per[k] = (per[k] || 0) + 1;
      return [u.id, spot(u, per[k] - 1)];
    }));
  }, [users]);
  const count = {}, busy = {};
  users.forEach(u => { if (u.scene) { count[u.scene] = (count[u.scene] || 0) + 1; if (u.phase === 'speaking') busy[u.scene] = 'speaking'; } });
  const mine = users.find(u => u.id === meId);

  return (
    <Canvas orthographic shadows={!MOBILE} dpr={[1, MOBILE ? 1.5 : 2]} camera={{ position: [24, 26, 24], zoom: 30, near: -200, far: 400 }}
      onPointerMissed={() => { document.body.style.cursor = ''; }}>
      <color attach="background" args={['#dfe9d3']} />
      <hemisphereLight args={['#fffaf0', '#b7c49f', 1]} />
      <directionalLight position={[12, 20, 8]} intensity={1.5} castShadow={!MOBILE} shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-bias={-0.0005} />
      <Grounds />
      <Walls />
      {Object.values(ROOMS).map(r => (
        <Room key={r.scene.id} room={r} count={count[r.scene.id]} busy={busy[r.scene.id]}
              mine={mine && mine.scene === r.scene.id} onPick={onPick} />
      ))}
      {users.map(u => <Learner key={u.id} u={u} target={targets[u.id]} me={u.id === meId} now={now} />)}
      <OrbitControls makeDefault enableDamping screenSpacePanning={false} minZoom={12} maxZoom={140}
        minPolarAngle={0.5} maxPolarAngle={1.1} target={[0, 0, 0]} />
      <Rig focus={focus} fit={fit} nonce={nonce} />
    </Canvas>
  );
}
