// The school, in 3D: a corridor with twelve practice rooms, one per scene, each furnished for its situation
// and staffed by that scene's AI character. Every learner online is a little character: they wait in the
// corridor, walk into the room they practise in, and show what they are doing and saying.
// Seen from above at an angle, with the near walls cut low so every room is visible (a doll's house view).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, PerspectiveCamera, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { SCENES } from './scenes.js';
import { stars as starsOf } from './lib/history.js';
import { B, C, S, floorTexture, Furniture, RoomFloor, Window, CorridorDecor, hsl } from './world/props.jsx';
import { Person } from './world/people.jsx';
import { Bake } from './world/bake.jsx';
import { Night, isNight } from './world/time.js';
import { Rain } from './world/rain.jsx';
import { Campus, Shell, blockedOutside, COLS, X0, BX, BZ, CX, LEN, FENCE, GATE } from './world/campus.jsx';

const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const SAID_SHOW_MS = 12000;
const ENTRANCE = new THREE.Vector3(17, 0, 0);
const ROOM_W = 7, ROOM_D = 7.5, HALL = 1.5;          // room size; the corridor runs along x, |z| < HALL
const TALL = 2.4, PART = 0.9, LOW = 0.35;             // far outer walls, partitions, near walls

// rooms: four north of the corridor, four south; `in` is the direction from the room to the corridor
export const ROOMS = Object.fromEntries(SCENES.map((sc, i) => {
  const north = i < COLS, col = i % COLS, x = X0 + ROOM_W / 2 + col * ROOM_W, z = north ? -(HALL + ROOM_D / 2) : HALL + ROOM_D / 2;
  return [sc.id, { scene: sc, i, col, north, pos: new THREE.Vector3(x, 0, z), rot: north ? 0 : Math.PI }];
}));


export function describe(u) {
  const r = u.scene && ROOMS[u.scene];
  if (!r) return 'Đang ở hành lang';
  const sc = r.scene;
  return {
    listening: `Đang nói với ${sc.name}`, thinking: `${sc.name} đang nghĩ`, speaking: `Đang nghe ${sc.name} nói`,
    summary: 'Đang xem nhận xét', idle: `Đang luyện ${sc.title}`,
  }[u.phase] || `Đang luyện ${sc.title}`;
}

// walking freely: where one may stand (the corridor, inside a room, or in a doorway between them)
const ROOM_LIST = Object.values(ROOMS);
export function roomAt(x, z) {
  return ROOM_LIST.find(r => (z < 0) === r.north && Math.abs(x - r.pos.x) < ROOM_W / 2 - 0.35 &&
                             Math.abs(z) > HALL + 0.12 && Math.abs(z) < HALL + ROOM_D - 0.35) || null;
}
function canStand(x, z) {
  // outside: anywhere on the grounds inside the fence (and out through the gate to the street)
  if (x > BX + 0.45 || x < X0 - 0.45 || Math.abs(z) > BZ + 0.45) {
    const inFence = x > FENCE.x0 + 0.4 && z > FENCE.z0 + 0.4 && z < FENCE.z1 - 0.4 && (x < FENCE.x1 - 0.4 || (Math.abs(z) < GATE - 0.3 && x < 47));
    return inFence && !blockedOutside(x, z);
  }
  if (x < BX + 0.45 && x > X0 + 0.4 && Math.abs(z) < HALL - 0.25) return true;   // corridor, and the front door
  if (roomAt(x, z)) return true;
  return Math.abs(z) < HALL + 0.3 && ROOM_LIST.some(r => Math.abs(x - r.pos.x) < 0.7);
}

// first person: show a label only for what is near and on my side of the walls (same room, or both in the corridor)
function seen(viewer, x, z, range = 9) {
  if (!viewer || !viewer.on) return true;
  const a = roomAt(viewer.pos.x, viewer.pos.z), b = roomAt(x, z);
  if ((a && a.scene.id) !== (b && b.scene.id)) return false;
  return Math.hypot(viewer.pos.x - x, viewer.pos.z - z) < range;
}

// where a learner stands: along the corridor when not practising, else in front of their room's character
function spot(u, k) {
  const r = u.scene && ROOMS[u.scene];
  if (!r) return new THREE.Vector3(X0 + 3 + ((k * 3.7) % (LEN - 5)), 0, (k % 2 ? 0.55 : -0.55));
  const local = new THREE.Vector3((k % 3 - 1) * 0.95, 0, 0.9 + Math.floor(k / 3) * 0.9);
  return local.applyAxisAngle(new THREE.Vector3(0, 1, 0), r.rot).add(r.pos);
}

// ---------------------------------------------------------------- characters
const OUTFITS = { doctor: 'coat', interview: 'suit', finance: 'suit', hotel: 'uniform', airport: 'uniform', bank: 'uniform', tax: 'uniform', coffee: 'apron' };
function Npc({ room, busy }) {
  const g = useRef(), act = useRef({});
  useFrame(({ clock }) => {
    act.current.talk = busy === 'speaking';
    if (g.current) g.current.rotation.y = Math.sin(clock.elapsedTime * 0.4 + room.i) * 0.15;
  });
  return (
    <group ref={g} position={[0, 0, -2.3]} userData={{ live: true }}>
      <Person shirt={hsl(room.scene.hue, 45, 55)} seed={room.scene.id + room.scene.name} outfit={OUTFITS[room.scene.id]} act={act} />
    </group>
  );
}

const doorX = x => Math.round((x - X0 - ROOM_W / 2) / ROOM_W) * ROOM_W + X0 + ROOM_W / 2;

function Learner({ u, target, me, now, pilot, viewer }) {
  const g = useRef(), body = useRef(), ring = useRef(), tag = useRef(), act = useRef({});
  const pos = useRef(ENTRANCE.clone());               // newcomers walk in through the front door
  const path = useRef([]);
  const last = useRef(null);
  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    if (pilot && pilot.on) { drive(pilot, pos.current, g.current, clock.elapsedTime, dt); last.current = null; return; }
    // walk via the corridor: out of the old room's door, along the corridor, in through the new door
    // others walking by themselves: straight to where they last reported standing
    const free = u.free && !me;
    const goalPos = free ? new THREE.Vector3(u.x, 0, u.z) : target;
    if (!last.current || !last.current.equals(goalPos)) {
      last.current = goalPos.clone();
      const p = pos.current, pts = [];
      if (!free) {
        if (Math.abs(p.z) > HALL) pts.push(new THREE.Vector3(doorX(p.x), 0, 0));
        if (p.x > 14) pts.push(new THREE.Vector3(13, 0, 0));
        if (Math.abs(goalPos.z) > HALL) pts.push(new THREE.Vector3(doorX(goalPos.x), 0, 0));
      }
      pts.push(goalPos.clone());
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
    if (tag.current) tag.current.style.display = seen(viewer, p.x, p.z) ? '' : 'none';
    act.current.walk = walking; act.current.talk = u.phase === 'listening'; act.current.think = u.phase === 'thinking';
    body.current.position.y = walking ? Math.abs(Math.sin(t * 9)) * 0.03 : 0;
    if (ring.current) { const k = 1 + (Math.sin(t * 6) + 1) * 0.12; ring.current.scale.set(k, k, k); }
  });

  const recent = u.said && now - (u.saidAt || 0) < SAID_SHOW_MS;
  return (
    <group ref={g} visible={!(pilot && pilot.on)}>
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
      <group ref={body}><Person shirt={u.color} seed={u.id} act={act} /></group>
      <Html position={[0, 2.05, 0]} center zIndexRange={[20, 10]}>
        <div ref={tag} className={'w-tag' + (me ? ' me' : '')} style={{ '--c': u.color }}>
          {recent && <div className="w-said">{u.said}</div>}
          {!recent && u.phase === 'thinking' && <div className="w-said dots"><i /><i /><i /></div>}
          <span>{u.name}{me ? ' (bạn)' : ''}</span>
        </div>
      </Html>
    </group>
  );
}

// first person: I move where I look (pilot.yaw); W/S or the stick to walk, A/D to step sideways,
// left/right arrows or the stick pushed sideways to turn; walls stop me, and I slide along them
const step = new THREE.Vector3();
function drive(pilot, p, g, t, dt) {
  const k = pilot.input;
  if (pilot.fresh) {
    // just stepped into my character: stand somewhere legal and look out of the room / down the hall
    pilot.fresh = false;
    if (!canStand(p.x, p.z)) { p.x = Math.max(-12, Math.min(12, p.x)); p.z = 0; }
    const r = roomAt(p.x, p.z);
    pilot.yaw = pilot.wantYaw = r ? (r.pos.z < 0 ? Math.PI : 0) : (p.x > 0 ? Math.PI / 2 : -Math.PI / 2);
    pilot.wantPitch = pilot.pitch;
  }
  // arrows turn; the on-screen stick turns too when pushed sideways: nothing near the middle (so walking straight
  // doesn't drift), then gently, faster only near the edge
  const jx = k.jx || 0, ax = Math.max(0, (Math.abs(jx) - 0.3) / 0.7);
  pilot.wantYaw -= ((k.turn || 0) * 2.2 + Math.sign(jx) * ax * ax * 1.3) * dt;
  const ix = k.kx || 0, iy = (k.ky || 0) + (k.jy || 0);
  const sin = Math.sin(pilot.yaw), cos = Math.cos(pilot.yaw);
  step.set(-sin * iy + cos * ix, 0, -cos * iy - sin * ix);
  const len = Math.min(1, step.length());
  let moving = false;
  if (len > 0.05) {
    step.normalize().multiplyScalar(len * 3.2 * Math.min(dt, 0.05));
    const nx = p.x + step.x, nz = p.z + step.z;
    if (canStand(nx, nz)) { p.x = nx; p.z = nz; moving = true; }
    else if (canStand(nx, p.z)) { p.x = nx; moving = true; }
    else if (canStand(p.x, nz)) { p.z = nz; moving = true; }
  }
  g.position.copy(p); g.rotation.y = pilot.yaw + Math.PI;
  pilot.pos.copy(p); pilot.bob = moving ? Math.sin(t * 9) * 0.035 : 0;
  const r = roomAt(p.x, p.z), id = r ? r.scene.id : null;
  if (id !== pilot.room) { pilot.room = id; pilot.onRoom && pilot.onRoom(id); }
  if (t - (pilot.sent || 0) > 0.7 && (moving || !pilot.sent)) { pilot.sent = t; pilot.onMove && pilot.onMove(p.x, p.z); }
}

// the eyes of my character; drag anywhere on the scene to look around
function FirstPerson({ pilot, night }) {
  const cam = useRef(), lamp = useRef();
  const { gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    let drag = null;
    // dragging sets where to look; the camera eases there every frame, so uneven touch events still turn smoothly
    const down = e => { if (!drag) drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; };
    const move = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const k = e.pointerType === 'mouse' ? 0.006 : Math.min(0.007, 2 / innerWidth);   // a full swipe turns about a third of the way round
      if (pilot.wantYaw == null) { pilot.wantYaw = pilot.yaw; pilot.wantPitch = pilot.pitch; }
      pilot.wantYaw -= (e.clientX - drag.x) * k;
      pilot.wantPitch = Math.max(-0.9, Math.min(0.7, pilot.wantPitch - (e.clientY - drag.y) * k * 0.8));
      drag.x = e.clientX; drag.y = e.clientY;
    };
    const up = e => { if (drag && e.pointerId === drag.id) drag = null; };
    el.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    return () => { el.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
  }, [gl]);
  useFrame((_, dt) => {
    if (!cam.current) return;
    if (pilot.wantYaw != null) {
      const k = 1 - Math.exp(-Math.min(dt, 0.1) * 10);
      pilot.yaw += (pilot.wantYaw - pilot.yaw) * k;
      pilot.pitch += (pilot.wantPitch - pilot.pitch) * k;
    }
    cam.current.position.set(pilot.pos.x, 1.5 + (pilot.bob || 0), pilot.pos.z);
    cam.current.rotation.set(pilot.pitch, pilot.yaw, 0, 'YXZ');
    if (lamp.current) lamp.current.position.set(pilot.pos.x, 2.7, pilot.pos.z);
  });
  // at night a warm light goes along with me, so rooms and the street close by are lit
  return <>
    <PerspectiveCamera ref={cam} makeDefault fov={70} near={0.05} far={450} />
    {night && <pointLight ref={lamp} color="#ffe2b0" intensity={18} distance={14} decay={1.6} />}
  </>;
}

// ---------------------------------------------------------------- the building
// every room has its own paint: a feature colour on the back wall, a lighter one on the others,
// with a dark skirting board and a thin picture rail in the feature colour
const PAINT = {
  friend: ['#f7dfb4', '#e39a4f'], coffee: ['#efd3bd', '#7d4f36'], interview: ['#dde5ee', '#34506f'],
  hotel: ['#f0e4c9', '#7a2e3a'], airport: ['#e2edf2', '#3f8fb4'], doctor: ['#e1f2ea', '#5fae8f'],
  shop: ['#f8dfe6', '#cf5f82'], free: ['#e8e1f5', '#7d68b8'],
  accounting: ['#f6efd2', '#b8952e'], finance: ['#dcefeb', '#1f6f68'], tax: ['#f4e1dc', '#a8432f'], bank: ['#e1e6f4', '#2f3f7a'],
};
const DOOR = 1.8;
function Paint({ room, full }) {
  const [wall, accent] = PAINT[room.scene.id] || ['#efe5d6', '#b9a68b'];
  const { north, i } = room;
  // how high each wall really is from above (walking, all are full height); "left/right" are seen from the corridor
  const westOuter = room.col === 0, eastOuter = room.col === COLS - 1;
  const hBack = full ? 2.8 : north ? TALL : LOW, hFront = full ? 2.8 : north ? LOW : PART;
  const side = outer => (full ? 2.8 : outer === 'w' ? TALL : outer === 'e' ? LOW : PART);
  // local +x is world +x for north rooms, world -x for south ones
  const hL = side(north ? (westOuter ? 'w' : '') : (eastOuter ? 'e' : ''));
  const hR = side(north ? (eastOuter ? 'e' : '') : (westOuter ? 'w' : ''));
  const W = ROOM_W, D = ROOM_D, f = 0.02;
  const back = -D / 2 + 0.125 + f / 2, front = D / 2 - 0.1 - f / 2;
  const sx = W / 2 - (westOuter || eastOuter ? 0.1 : 0.1) - f / 2;
  const panel = (key, x, z, w, h, c, rot = 0) => h > 0.05 && (
    <group key={key} position={[x, 0, z]} rotation-y={rot}>
      <B p={[0, h / 2, 0]} s={[w, h - 0.01, f]} c={c} cast={false} />
      <B p={[0, 0.06, 0.015]} s={[w, 0.12, 0.02]} c="#5b4636" cast={false} />
      {h > 1.4 && <B p={[0, 1.15, 0.012]} s={[w, 0.05, 0.02]} c={c === accent ? '#ffffff' : accent} cast={false} />}
    </group>
  );
  const seg = (W - DOOR) / 2;
  return (
    <group>
      {panel('b', 0, back, W - 0.24, hBack, accent)}
      {panel('l', -sx, 0, D - 0.24, hL, wall, Math.PI / 2)}
      {panel('r', sx, 0, D - 0.24, hR, wall, -Math.PI / 2)}
      {panel('f1', -(DOOR / 2 + seg / 2), front, seg - 0.12, hFront, wall, Math.PI)}
      {panel('f2', DOOR / 2 + seg / 2, front, seg - 0.12, hFront, wall, Math.PI)}
      {/* door frame and a name plate beside the door, on the corridor side */}
      {full && [-1, 1].map(k => <B key={k} p={[k * (DOOR / 2 + 0.04), 1.15, D / 2]} s={[0.1, 2.3, 0.26]} c={accent} />)}
      {full && <B p={[0, 2.35, D / 2]} s={[DOOR + 0.2, 0.12, 0.26]} c={accent} />}
      {full && <group position={[DOOR / 2 + 0.45, 1.55, D / 2 + 0.115]}>
        <B p={[0, 0, 0]} s={[0.42, 0.26, 0.02]} c={accent} cast={false} />
        <B p={[0, 0, 0.012]} s={[0.36, 0.2, 0.01]} c="#fffaf0" cast={false} />
      </group>}
    </group>
  );
}

function Room({ room, count, busy, mine, onPick, viewer, full, star }) {
  const [hover, setHover] = useState(false);
  const label = useRef();
  useFrame(() => {
    if (!label.current) return;
    // walking: the sign of the room I'm in, or of a door I'm close to
    const near = !viewer.on || roomAt(viewer.pos.x, viewer.pos.z) === room ||
      (Math.abs(viewer.pos.z) < 2 && Math.abs(viewer.pos.x - room.pos.x) < 4.5);
    label.current.style.display = near ? '' : 'none';
  });
  const { scene: sc } = room;
  return (
    <group position={room.pos}>
      <RoomFloor id={sc.id} hue={sc.hue} w={ROOM_W - 0.2} d={ROOM_D - 0.2} bright={hover || mine}
        onPointerOver={e => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
        onClick={e => { e.stopPropagation(); onPick(sc); }} />
      {/* windows in the tall outer walls */}
      {room.north && [-1.7, 1.7].map(x => <Window key={x} p={[x, 1.45, -ROOM_D / 2 + 0.18]} w={1.6} />)}
      {room.north && room.col === 0 && <Window p={[-ROOM_W / 2 + 0.18, 1.45, 0]} r={Math.PI / 2} w={2.2} />}
      {!room.north && room.col === 0 && <Window p={[-ROOM_W / 2 + 0.18, 1.45, 0.4]} r={Math.PI / 2} w={2.2} />}
      <group rotation-y={room.rot}>
        <Paint room={room} full={full} />
        <Furniture id={sc.id} hue={sc.hue} north={room.north || full} />
        <Npc room={room} busy={busy} />
      </group>
      <Html position={[0, room.north ? 3.2 : 1.6, room.north ? -3 : -3.4]} center zIndexRange={[8, 0]}>
        <button ref={label} className={'w-room' + (mine ? ' mine' : '') + (hover ? ' hover' : '')} style={{ '--c': hsl(sc.hue, 55, 45) }} onClick={() => onPick(sc)}>
          <span>{sc.title}{star ? <em className="w-star">{'★'.repeat(star)}</em> : null}</span><small>{sc.name}{count ? ` · ${count} người` : ''}</small>
        </button>
      </Html>
    </group>
  );
}

function Walls({ full }) {
  const wall = '#efe5d6', top = '#d9cbb6';
  // walking in first person every wall is full height, like a real building; from above the near ones are cut low
  const W = (x, z, w, d, h0, h = full ? 2.8 : h0) => (
    <group key={`${x}:${z}:${w}:${d}`}>
      <B p={[x, h / 2, z]} s={[w, h, d]} c={wall} />
      <B p={[x, h + 0.02, z]} s={[w + 0.02, 0.04, d + 0.02]} c={top} cast={false} />
    </group>
  );
  const out = [];
  const X1 = BX, Z0 = -(HALL + ROOM_D), Z1 = HALL + ROOM_D, door = 1.8;
  out.push(W(CX, Z0, LEN, 0.25, TALL));                      // far outer walls: tall
  out.push(W(X0, 0, 0.25, Z1 - Z0, TALL));
  out.push(W(CX, Z1, LEN, 0.25, LOW));                       // near outer walls: low
  out.push(W(X1, -(HALL + Z1) / 2 - 0.5, 0.25, Z1 - HALL + 1, LOW));
  out.push(W(X1, (HALL + Z1) / 2 + 0.5, 0.25, Z1 - HALL + 1, LOW));
  for (let i = 1; i < COLS; i++) {                         // partitions between rooms
    const x = X0 + i * ROOM_W;
    out.push(W(x, -(HALL + ROOM_D / 2), 0.2, ROOM_D, PART));
    out.push(W(x, HALL + ROOM_D / 2, 0.2, ROOM_D, PART));
  }
  for (let i = 0; i < COLS; i++) {                         // corridor walls, with a door into every room
    const cx = X0 + ROOM_W / 2 + i * ROOM_W, seg = (ROOM_W - door) / 2;
    for (const side of [-1, 1]) {
      const z = side * HALL, h = side < 0 ? LOW : PART;
      out.push(W(cx - door / 2 - seg / 2, z, seg, 0.2, h));
      out.push(W(cx + door / 2 + seg / 2, z, seg, 0.2, h));
      // corridor side: a sage wainscot with a wooden rail
      const hw = Math.min(full ? 1.05 : h, 1.05), zf = z - side * 0.11;
      for (const x of [cx - door / 2 - seg / 2, cx + door / 2 + seg / 2]) out.push(
        <group key={'wc' + x + ':' + z}>
          <B p={[x, hw / 2, zf]} s={[seg, hw - 0.01, 0.02]} c="#8fb0a2" cast={false} />
          {full && <B p={[x, 1.07, zf - side * 0.01]} s={[seg, 0.06, 0.04]} c="#8a6648" cast={false} />}
          <B p={[x, 0.06, zf - side * 0.015]} s={[seg, 0.12, 0.02]} c="#5b4636" cast={false} />
        </group>);
    }
  }
  return <group>{out}</group>;
}

function Grounds({ walk }) {
  return (
    <group>
      <Campus walk={walk} />
      <mesh rotation-x={-Math.PI / 2} position={[CX, 0, 0]} receiveShadow>
        <planeGeometry args={[LEN, 2 * (HALL + ROOM_D)]} /><meshStandardMaterial color="#f4ede2" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[CX, 0.015, 0]} receiveShadow>
        <planeGeometry args={[LEN, HALL * 2]} /><meshStandardMaterial map={floorTexture('hall', [LEN / 2, 1.5])} roughness={0.35} />
      </mesh>
      <Html position={[BX + 0.4, walk ? 3.45 : 2.6, 0]} center zIndexRange={[8, 0]}>
        <div className="w-sign">Trường THPT Nguyễn Thái Học</div>
      </Html>
      {walk && (
        <Html position={[FENCE.x1, 2.9, 0]} center zIndexRange={[8, 0]}>
          <div className="w-sign">THPT Nguyễn Thái Học</div>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- quality
// steps down when frames come too slowly (weak laptops, phones): first sharpness, then shadows drawn every
// few frames instead of every frame, then no shadows at all; never steps back up, so it doesn't flicker
function Quality() {
  const { gl, scene, setDpr } = useThree();
  const st = useRef({ level: 3, t: 0, n: 0, frame: 0, wait: 2 });
  useFrame((_, dt) => {
    const q = st.current;
    q.frame++;
    if (q.level <= 1 && gl.shadowMap.enabled) gl.shadowMap.needsUpdate = q.frame % 4 === 0;
    q.t += Math.min(dt, 0.5); q.n++;
    if (q.t < 2) return;
    const fps = q.n / q.t; q.t = 0; q.n = 0;
    if (q.wait > 0) { q.wait--; return; }               // let the town bake and settle first
    if (fps > 28 || q.level === 0) return;
    q.level--; q.wait = 1;
    if (q.level === 2) setDpr(Math.min(1, window.devicePixelRatio));
    if (q.level === 1) gl.shadowMap.autoUpdate = false;
    if (q.level === 0) {
      gl.shadowMap.enabled = false;
      scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    }
    if (import.meta.env.DEV) console.log('[quality]', q.level, Math.round(fps) + ' fps');
  });
  return null;
}

// ---------------------------------------------------------------- camera: overview, or close on my room
function Rig({ focus, fit, nonce }) {
  const { camera, controls, size } = useThree();
  const anim = useRef(0);
  const goal = useMemo(() => {
    const r = focus && ROOMS[focus];
    // phones in portrait: fill the width and let the sides run off, rather than a tiny whole school
    const base = (size.width < 600 ? size.width / 30 : Math.min(size.width / 46, size.height / 30)) * fit;
    return r ? { target: r.pos.clone(), zoom: size.height < 500 && size.width > size.height ? size.height / 9 : Math.min(size.width / 13, size.height / 12) }
             : { target: new THREE.Vector3(CX + 4, 0, 0), zoom: base };
  }, [focus, size.width, size.height, fit, nonce]);
  useEffect(() => { anim.current = 1.4; }, [goal]);
  // phones: in a room the conversation covers the lower half, so show the room in the strip above it
  useEffect(() => {
    if (focus && size.width < 600) camera.setViewOffset(size.width, size.height, 0, size.height * 0.27, size.width, size.height);
    else if (focus && size.height < 500 && size.width > size.height) camera.setViewOffset(size.width, size.height, size.width * 0.24, 0, size.width, size.height);
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

const KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], KeyD: [1, 0], ArrowLeft: [0, 0, -1], ArrowRight: [0, 0, 1] };

// walk: I steer my own character (input.jx/jy come from the on-screen stick); onRoom(id|null) when I step
// into or out of a room; onMove(x, z) now and then, so others see where I am
export default function School({ users, meId, stars = {}, sky = 'auto', rain = false, focus, fit = 1, nonce = 0, onPick, walk = false, input, onMove, onRoom }) {
  const [now, setNow] = useState(Date.now());
  const night = isNight(sky, new Date(now));
  const wet = walk && rain;                           // rain only shows while walking
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const pilot = useMemo(() => ({ pos: new THREE.Vector3(), room: undefined, input: {}, yaw: Math.PI / 2, pitch: -0.05 }), []);
  Object.assign(pilot, { on: walk, input: input || pilot.input, onMove, onRoom });
  if (import.meta.env.DEV) window.__pilot = pilot;
  useEffect(() => { pilot.room = undefined; pilot.sent = 0; pilot.fresh = true; pilot.pitch = pilot.wantPitch = -0.05; pilot.wantYaw = null; }, [walk]);

  useEffect(() => {
    if (!walk) return;
    const down = new Set();
    const apply = () => {
      let x = 0, y = 0, turn = 0;
      down.forEach(c => { x += KEYS[c][0]; y += KEYS[c][1]; turn += KEYS[c][2] || 0; });
      pilot.input.kx = Math.max(-1, Math.min(1, x)); pilot.input.ky = Math.max(-1, Math.min(1, y)); pilot.input.turn = turn;
    };
    const kd = e => { if (!KEYS[e.code] || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; e.preventDefault(); down.add(e.code); apply(); };
    const ku = e => { if (!KEYS[e.code]) return; down.delete(e.code); apply(); };
    const blur = () => { down.clear(); apply(); };
    addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur); blur(); };
  }, [walk]);

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
    <Canvas orthographic shadows={!MOBILE} dpr={MOBILE ? (walk ? 1 : [1, 1.5]) : [1, 2]} camera={{ position: [CX + 28, 26, 24], zoom: 30, near: -200, far: 400 }}
      onCreated={st => { if (import.meta.env.DEV) window.__r3f = st; }} onPointerMissed={() => { document.body.style.cursor = ''; }}>
      <Quality />
      <Night.Provider value={night}>
      <color attach="background" args={[night ? (walk ? (wet ? '#0b111b' : '#0e1726') : '#1b2638') : walk ? (wet ? '#9aa6b1' : '#cfe6f5') : '#dfe9d3']} />
      {walk && !night && !wet && <Sky distance={4000} sunPosition={[60, 40, 30]} turbidity={4} rayleigh={1.2} mieCoefficient={0.004} />}
      {walk && night && !wet && <Stars radius={200} depth={50} count={2000} factor={5} fade speed={0.4} />}
      {walk && <fog attach="fog" args={wet ? [night ? '#0d141f' : '#9aa6b1', 25, 110] : [night ? '#131d2e' : '#dbe9f2', 45, 150]} />}
      {wet && <Rain />}
      <hemisphereLight args={night ? ['#9fb3e0', '#202838', walk ? 0.45 : 0.75] : ['#fffaf0', walk ? '#efe6d6' : '#b7c49f', 1]} />
      {walk && <ambientLight intensity={night ? 0.18 : 0.55} color={night ? '#9fb3e0' : '#fff4e6'} />}
      <directionalLight position={[24, 40, 16]} intensity={night ? 0.45 : wet ? 0.7 : 1.5} color={night ? '#a9bcff' : '#ffffff'} castShadow={!MOBILE} shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-45} shadow-camera-right={50} shadow-camera-top={34} shadow-camera-bottom={-34} shadow-camera-far={120} shadow-bias={-0.0005} />
      <Bake key={(walk ? 'walk' : 'view') + (night ? ':night' : '')}>
      <Grounds walk={walk} />
      <Walls full={walk} />
      <Shell full={walk} tall={TALL} low={LOW} />
      {walk && (
        <mesh position={[CX, 2.82, 0]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[LEN, 2 * (HALL + ROOM_D)]} />
          <meshStandardMaterial color="#fbf8f2" side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* ceiling light panels in every room and along the corridor */}
      {walk && [...ROOM_LIST.flatMap(r => [-1.6, 1.6].map(dx => [r.pos.x + dx, r.pos.z])), ...Array.from({ length: COLS * 2 - 1 }, (_, k) => [X0 + 3.5 + k * 3.5, 0])].map(([x, z]) => (
        <mesh key={x + ':' + z} position={[x, 2.8, z]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[1.1, 0.5]} /><meshStandardMaterial color="#fffdf5" emissive="#fff6dc" emissiveIntensity={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <CorridorDecor x0={X0} x1={BX} hall={HALL} />
      {Object.values(ROOMS).map(r => (
        <Room key={r.scene.id} room={r} count={count[r.scene.id]} busy={busy[r.scene.id]}
              mine={mine && mine.scene === r.scene.id} star={starsOf(stars[r.scene.id])} onPick={onPick} viewer={pilot} full={walk} />
      ))}
      </Bake>
      {users.map(u => <Learner key={u.id} u={u} target={targets[u.id]} me={u.id === meId} now={now} pilot={u.id === meId ? pilot : null} viewer={pilot} />)}
      {walk
        ? <FirstPerson pilot={pilot} night={night} />
        : <>
            <OrbitControls makeDefault enableDamping screenSpacePanning={false} minZoom={7} maxZoom={140}
              minPolarAngle={0.5} maxPolarAngle={1.1} target={[CX + 4, 0, 0]} />
            <Rig focus={focus} fit={fit} nonce={nonce} />
          </>}
      </Night.Provider>
    </Canvas>
  );
}
