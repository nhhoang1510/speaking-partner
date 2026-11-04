// The school, in 3D: one open hall with a practice area per scene along a winding promenade, each furnished
// for its situation and staffed by that scene's AI character. Every learner online is a little character: they
// wait on the promenade, walk into the area they practise in, and show what they are doing and saying.
// Seen from above at an angle, with the near outer walls cut low so every area is visible.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, PerspectiveCamera, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { SCENES } from './scenes.js';
import { B, Furniture, RoomFloor, Window, hsl } from './world/props.jsx';
import { Person } from './world/people.jsx';
import { Bake } from './world/bake.jsx';
import { Campus, Shell, blockedOutside, ROOM_XS, X0, BX, BZ, CX, LEN, FENCE, GATE } from './world/campus.jsx';
import { Area, Promenade, blockedInside, islandGeometry, walkZ, CROSS, PLACES, ZA, ZB } from './world/open.jsx';

const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const SAID_SHOW_MS = 12000;
const ENTRANCE = new THREE.Vector3(17, 0, 0);
const TALL = 2.4, LOW = 0.35;                         // far outer walls, near walls

// areas, scattered over the hall, each turned to open onto a walk (local +z points out of the open side);
// `north` ones have their back to the far side, away from the overview camera
export const ROOMS = Object.fromEntries(SCENES.map((sc, i) => {
  const [x, z, rot] = PLACES[i];
  return [sc.id, { scene: sc, i, north: Math.cos(rot) > 0, pos: new THREE.Vector3(x, 0, z), rot }];
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

// walking freely: anywhere in the hall except through columns, trees and screens; an area counts as entered
// once I'm on its floor
const ROOM_LIST = Object.values(ROOMS);
export function roomAt(x, z) {
  return ROOM_LIST.find(r => {
    const dx = x - r.pos.x, dz = z - r.pos.z, c = Math.cos(r.rot), s = Math.sin(r.rot);
    return Math.abs(c * dx - s * dz) < ZA - 0.3 && Math.abs(s * dx + c * dz) < ZB - 0.3;
  }) || null;
}
function canStand(x, z) {
  // outside: anywhere on the grounds inside the fence (and out through the gate to the street)
  if (x > BX + 0.45 || x < X0 - 0.45 || Math.abs(z) > BZ + 0.45) {
    const inFence = x > FENCE.x0 + 0.4 && z > FENCE.z0 + 0.4 && z < FENCE.z1 - 0.4 && (x < FENCE.x1 - 0.4 || (Math.abs(z) < GATE - 0.3 && x < 47));
    return inFence && !blockedOutside(x, z);
  }
  const hall = x > X0 + 0.4 && x < BX - 0.35 && Math.abs(z) < BZ - 0.4, door = x < BX + 0.45 && x > BX - 1 && Math.abs(z) < 1.25;
  return (hall || door) && !blockedInside(x, z, ROOM_LIST);
}

// first person: show a label only for who is near (the hall is open, so near is enough)
function seen(viewer, x, z, range = 9) {
  if (!viewer || !viewer.on) return true;
  return Math.hypot(viewer.pos.x - x, viewer.pos.z - z) < range;
}

// where a learner stands: along a walk when not practising, else in front of their area's character
function spot(u, k) {
  const r = u.scene && ROOMS[u.scene];
  if (!r) { const x = X0 + 3 + ((k * 3.7) % (LEN - 8)), side = k % 2 ? 1 : -1; return new THREE.Vector3(x, 0, walkZ(side, x) + (k % 4 < 2 ? 0.4 : -0.4)); }
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

const local = (r, x, z) => new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), r.rot).add(r.pos);
const mouth = r => local(r, 0, ZB + 0.4);              // just outside an area's open side
const onWalk = (side, x) => new THREE.Vector3(x, 0, walkZ(side, x));

// the way from p to goal: out of the old area, along its walk, over a cross walk (or round by the front door)
// if the new area opens onto the other walk, along that one, and in
function route(p, goal) {
  const from = roomAt(p.x, p.z), to = roomAt(goal.x, goal.z), pts = [];
  if (from && from === to) return [goal.clone()];
  let a = from ? mouth(from) : p.clone();
  if (from) pts.push(a);
  if (p.x > BX - 1) { a = new THREE.Vector3(BX - 1, 0, 0); pts.push(a); }
  const b = to ? mouth(to) : goal, sa = a.z < 0 ? -1 : 1, sb = b.z < 0 ? -1 : 1;
  pts.push(onWalk(sa, a.x));
  if (sa !== sb) {
    const cx = [...CROSS, 12].reduce((m, x) => Math.abs(a.x - x) + Math.abs(x - b.x) < Math.abs(a.x - m) + Math.abs(m - b.x) ? x : m);
    pts.push(onWalk(sa, cx), onWalk(sb, cx));
  }
  pts.push(onWalk(sb, b.x));
  if (to) pts.push(mouth(to));
  pts.push(goal.clone());
  return pts;
}

function Learner({ u, target, me, now, pilot, viewer }) {
  const g = useRef(), body = useRef(), ring = useRef(), tag = useRef(), act = useRef({});
  const pos = useRef(ENTRANCE.clone());               // newcomers walk in through the front door
  const path = useRef([]);
  const last = useRef(null);
  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    if (pilot && pilot.on) { drive(pilot, pos.current, g.current, clock.elapsedTime, dt); last.current = null; return; }
    // walk along the walks (see route); others walking by themselves: straight to where they last reported standing
    const free = u.free && !me;
    const goalPos = free ? new THREE.Vector3(u.x, 0, u.z) : target;
    if (!last.current || !last.current.equals(goalPos)) {
      last.current = goalPos.clone();
      path.current = free ? [goalPos.clone()] : route(pos.current, goalPos);
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
      const look = r ? local(r, 0, -2.3) : new THREE.Vector3(p.x, 0, p.z > 0 ? -3 : 3);
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
    // just stepped into my character: stand somewhere legal and look out of the area / down the hall
    pilot.fresh = false;
    if (!canStand(p.x, p.z)) { p.x = Math.max(-12, Math.min(12, p.x)); p.z = walkZ(-1, p.x); }
    const r = roomAt(p.x, p.z);
    pilot.yaw = pilot.wantYaw = r ? r.rot + Math.PI : (p.x > 0 ? Math.PI / 2 : -Math.PI / 2);
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
function FirstPerson({ pilot }) {
  const cam = useRef();
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
  });
  return <PerspectiveCamera ref={cam} makeDefault fov={70} near={0.05} far={200} />;
}

// ---------------------------------------------------------------- the building
// every area has its own colours: a feature colour for its rim and screen, a lighter one for its bench
const PAINT = {
  friend: ['#f7dfb4', '#e39a4f'], coffee: ['#efd3bd', '#7d4f36'], interview: ['#dde5ee', '#34506f'],
  hotel: ['#f0e4c9', '#7a2e3a'], airport: ['#e2edf2', '#3f8fb4'], doctor: ['#e1f2ea', '#5fae8f'],
  shop: ['#f8dfe6', '#cf5f82'], free: ['#e8e1f5', '#7d68b8'],
  accounting: ['#f6efd2', '#b8952e'], finance: ['#dcefeb', '#1f6f68'], tax: ['#f4e1dc', '#a8432f'], bank: ['#e1e6f4', '#2f3f7a'],
};

function Room({ room, count, busy, mine, onPick, viewer, full, island }) {
  const [hover, setHover] = useState(false);
  const label = useRef();
  useFrame(() => {
    if (!label.current) return;
    // walking: the sign of the area I'm in or close to
    const near = !viewer.on || Math.hypot(viewer.pos.x - room.pos.x, viewer.pos.z - room.pos.z) < 6.5;
    label.current.style.display = near ? '' : 'none';
  });
  const { scene: sc } = room;
  const [wall, accent] = PAINT[sc.id] || ['#efe5d6', '#b9a68b'];
  return (
    <group position={room.pos}>
      <group rotation-y={room.rot}>
        <RoomFloor id={sc.id} hue={sc.hue} geometry={island} bright={hover || mine}
          onPointerOver={e => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
          onClick={e => { e.stopPropagation(); onPick(sc); }} />
        <Area accent={accent} wall={wall} h={full ? 1.7 : room.north ? 1.1 : 0.7} full={full} />
        <Furniture id={sc.id} hue={sc.hue} north={false} />
        <Npc room={room} busy={busy} />
      </group>
      <Html position={[-Math.sin(room.rot) * 3, room.north ? 3.2 : 2, -Math.cos(room.rot) * 3]} center zIndexRange={[8, 0]}>
        <button ref={label} className={'w-room' + (mine ? ' mine' : '') + (hover ? ' hover' : '')} style={{ '--c': hsl(sc.hue, 55, 45) }} onClick={() => onPick(sc)}>
          {sc.title}<small>{sc.name}{count ? ` · ${count} người` : ''}</small>
        </button>
      </Html>
    </group>
  );
}

// the outer walls, plastered inside, with the windows; the far ones tall, the near ones cut low from above
function Walls({ full }) {
  const wall = '#efe5d6', top = '#d9cbb6', Z = BZ;
  const W = (key, x, z, w, d, h0, h = full ? 2.8 : h0) => (
    <group key={key}>
      <B p={[x, h / 2, z]} s={[w, h, d]} c={wall} />
      <B p={[x, h + 0.02, z]} s={[w + 0.02, 0.04, d + 0.02]} c={top} cast={false} />
    </group>
  );
  const seg = Z - 1.5;
  return (
    <group>
      {W('n', CX, -Z, LEN, 0.25, TALL)}
      {W('w', X0, 0, 0.25, 2 * Z, TALL)}
      {W('s', CX, Z, LEN, 0.25, LOW)}
      {W('e1', BX, -(1.5 + seg / 2), 0.25, seg, LOW)}
      {W('e2', BX, 1.5 + seg / 2, 0.25, seg, LOW)}
      {ROOM_XS.flatMap(x => [-1.7, 1.7].map(dx => <Window key={'n' + x + dx} p={[x + dx, 1.45, -Z + 0.18]} w={1.6} />))}
      {[-8.5, 8.5].map(z => <Window key={'w' + z} p={[X0 + 0.18, 1.45, z]} r={Math.PI / 2} w={2.2} />)}
    </group>
  );
}

function Grounds({ walk }) {
  return (
    <group>
      <Campus walk={walk} />
      <mesh rotation-x={-Math.PI / 2} position={[CX, 0, 0]} receiveShadow>
        <planeGeometry args={[LEN, 2 * BZ]} /><meshStandardMaterial color="#efe7da" roughness={0.6} />
      </mesh>
      <Promenade full={walk} />
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

// ---------------------------------------------------------------- camera: overview, or close on my room
function Rig({ focus, fit, nonce }) {
  const { camera, controls, size } = useThree();
  const anim = useRef(0);
  const goal = useMemo(() => {
    const r = focus && ROOMS[focus];
    // phones in portrait: fill the width and let the sides run off, rather than a tiny whole school
    const base = (size.width < 600 ? size.width / 34 : Math.min(size.width / 52, size.height / 40)) * fit;
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
export default function School({ users, meId, focus, fit = 1, nonce = 0, onPick, walk = false, input, onMove, onRoom }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const pilot = useMemo(() => ({ pos: new THREE.Vector3(), room: undefined, input: {}, yaw: Math.PI / 2, pitch: -0.05 }), []);
  Object.assign(pilot, { on: walk, input: input || pilot.input, onMove, onRoom });
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
  const island = useMemo(() => islandGeometry(), []);

  return (
    <Canvas orthographic shadows={!MOBILE} dpr={MOBILE ? (walk ? 1 : [1, 1.5]) : [1, 2]} camera={{ position: [CX + 28, 26, 24], zoom: 30, near: -200, far: 400 }}
      onCreated={st => { if (import.meta.env.DEV) window.__r3f = st; }} onPointerMissed={() => { document.body.style.cursor = ''; }}>
      <color attach="background" args={[walk ? '#cfe6f5' : '#dfe9d3']} />
      {walk && <Sky distance={4000} sunPosition={[60, 40, 30]} turbidity={4} rayleigh={1.2} mieCoefficient={0.004} />}
      {walk && <fog attach="fog" args={['#dbe9f2', 45, 150]} />}
      <hemisphereLight args={['#fffaf0', walk ? '#efe6d6' : '#b7c49f', 1]} />
      {walk && <ambientLight intensity={0.55} color="#fff4e6" />}
      <directionalLight position={[24, 40, 16]} intensity={1.5} castShadow={!MOBILE} shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-45} shadow-camera-right={50} shadow-camera-top={34} shadow-camera-bottom={-34} shadow-camera-far={120} shadow-bias={-0.0005} />
      <Bake key={walk ? 'walk' : 'view'}>
      <Grounds walk={walk} />
      <Walls full={walk} />
      <Shell full={walk} tall={TALL} low={LOW} />
      {walk && (
        <mesh position={[CX, 2.82, 0]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[LEN, 2 * BZ]} />
          <meshStandardMaterial color="#fbf8f2" side={THREE.DoubleSide} />
        </mesh>
      )}
      {Object.values(ROOMS).map(r => (
        <Room key={r.scene.id} room={r} count={count[r.scene.id]} busy={busy[r.scene.id]} island={island}
              mine={mine && mine.scene === r.scene.id} onPick={onPick} viewer={pilot} full={walk} />
      ))}
      </Bake>
      {users.map(u => <Learner key={u.id} u={u} target={targets[u.id]} me={u.id === meId} now={now} pilot={u.id === meId ? pilot : null} viewer={pilot} />)}
      {walk
        ? <FirstPerson pilot={pilot} />
        : <>
            <OrbitControls makeDefault enableDamping screenSpacePanning={false} minZoom={7} maxZoom={140}
              minPolarAngle={0.5} maxPolarAngle={1.1} target={[CX + 4, 0, 0]} />
            <Rig focus={focus} fit={fit} nonce={nonce} />
          </>}
    </Canvas>
  );
}
