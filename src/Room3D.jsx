// The shared classroom in 3D: every learner online is a little character. On the home screen they hang
// out on the rug in the middle; once they start a scene they walk to that scene's corner, where the
// AI character stands, and their state (talking, listening, thinking) and what they just said show up live.
// Loaded on demand (React.lazy) so the main app stays light.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SCENES } from './scenes.js';

const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const DOOR = new THREE.Vector3(0, 0, 8.5);
const SAID_SHOW_MS = 12000;

// scene corners: two rows of four facing the rug in the middle
const STATIONS = Object.fromEntries(SCENES.map((sc, i) => {
  const row = i < 4 ? -1 : 1, col = i % 4;
  return [sc.id, { scene: sc, pos: new THREE.Vector3(-7.5 + col * 5, 0, row * 5), face: row < 0 ? 0 : Math.PI }];
}));

// where a learner stands: around the rug when not practising, else in front of their scene's table
function spot(u, i) {
  const st = u.scene && STATIONS[u.scene];
  if (!st) {
    const a = i * 2.4 + 0.6, r = 1.6 + (i % 3) * 0.55;
    return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  const toward = st.face === 0 ? 1 : -1;               // toward the middle of the room
  return st.pos.clone().add(new THREE.Vector3((i % 3 - 1) * 0.9, 0, toward * (1.5 + Math.floor(i / 3) * 0.8)));
}

export function describe(u) {
  const sc = u.scene && STATIONS[u.scene] && STATIONS[u.scene].scene;
  if (!sc) return 'Đang ở sảnh';
  return {
    listening: `Đang nói với ${sc.name}`, thinking: `${sc.name} đang nghĩ`, speaking: `Đang nghe ${sc.name} nói`,
    summary: 'Đang xem nhận xét', idle: `Đang luyện ${sc.title}`,
  }[u.phase] || `Đang luyện ${sc.title}`;
}

// ---------------------------------------------------------------- pieces of furniture
function Floor() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[24, 18]} />
        <meshStandardMaterial color="#efe6d8" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
        <circleGeometry args={[3.2, 48]} />
        <meshStandardMaterial color="#cfe3d4" />
      </mesh>
      {/* back wall and side walls, low so the camera sees over them */}
      <mesh position={[0, 1, -9]}><boxGeometry args={[24, 2, 0.3]} /><meshStandardMaterial color="#e7dccb" /></mesh>
      <mesh position={[-12, 1, 0]}><boxGeometry args={[0.3, 2, 18]} /><meshStandardMaterial color="#e2d6c3" /></mesh>
      <mesh position={[12, 1, 0]}><boxGeometry args={[0.3, 2, 18]} /><meshStandardMaterial color="#e2d6c3" /></mesh>
      {/* the door everyone comes in through */}
      <mesh position={[0, 0.02, 8.6]} rotation-x={-Math.PI / 2}><planeGeometry args={[2.2, 0.8]} /><meshStandardMaterial color="#b9895c" /></mesh>
      {/* plants in the corners */}
      {[[-11, -8], [11, -8], [-11, 8], [11, 8]].map(([x, z]) => (
        <group key={x + ':' + z} position={[x, 0, z]}>
          <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.35, 0.28, 0.6, 16]} /><meshStandardMaterial color="#c98b5e" /></mesh>
          <mesh position={[0, 1, 0]} castShadow><sphereGeometry args={[0.6, 16, 12]} /><meshStandardMaterial color="#6f9e6a" /></mesh>
        </group>
      ))}
    </group>
  );
}

function Station({ st, busy }) {
  const color = `hsl(${st.scene.hue}, 55%, 55%)`;      // three.js wants the comma form
  const npc = useRef();
  useFrame(({ clock }) => {
    if (!npc.current) return;
    const t = clock.elapsedTime;
    npc.current.position.y = busy === 'speaking' ? Math.abs(Math.sin(t * 7)) * 0.08 : Math.sin(t * 1.5) * 0.02;
    npc.current.rotation.z = busy === 'speaking' ? Math.sin(t * 5) * 0.06 : 0;
  });
  return (
    <group position={st.pos} rotation-y={st.face}>
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[2.1, 40]} />
        <meshStandardMaterial color={color} transparent opacity={0.18} />
      </mesh>
      {/* counter */}
      <mesh position={[0, 0.45, 0.3]} castShadow><boxGeometry args={[2.2, 0.9, 0.7]} /><meshStandardMaterial color="#f7f1e8" /></mesh>
      <mesh position={[0, 0.92, 0.3]}><boxGeometry args={[2.3, 0.06, 0.8]} /><meshStandardMaterial color={color} /></mesh>
      {/* the AI character behind it */}
      <group ref={npc} position={[0, 0, -0.5]}>
        <Character color={color} />
      </group>
      <Html position={[0, 2.35, -0.5]} center distanceFactor={14} zIndexRange={[10, 0]}>
        <div className="r3-station" style={{ '--c': color }}>{st.scene.title}<small>{st.scene.name}</small></div>
      </Html>
    </group>
  );
}

function Character({ color, skin = '#f3d2b3' }) {
  return (
    <group>
      <mesh position={[0, 0.62, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.5, 6, 14]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.38, 0]} castShadow>
        <sphereGeometry args={[0.36, 24, 18]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      <mesh position={[-0.12, 1.42, 0.31]}><sphereGeometry args={[0.045, 10, 8]} /><meshStandardMaterial color="#2b2b2b" /></mesh>
      <mesh position={[0.12, 1.42, 0.31]}><sphereGeometry args={[0.045, 10, 8]} /><meshStandardMaterial color="#2b2b2b" /></mesh>
      {/* hair cap in the body colour so every learner is easy to tell apart */}
      <mesh position={[0, 1.52, -0.04]} scale={[1, 0.7, 1]}>
        <sphereGeometry args={[0.37, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- learners
function Learner({ u, target, me, now }) {
  const g = useRef(), body = useRef(), ring = useRef();
  const pos = useRef(DOOR.clone());                   // new arrivals walk in through the door
  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    const t = clock.elapsedTime, p = pos.current;
    const d = target.clone().sub(p), dist = d.length();
    const walking = dist > 0.05;
    if (walking) {
      p.add(d.multiplyScalar(Math.min(1, (dt * 3.2) / Math.max(dist, 0.001))));
      g.current.rotation.y = Math.atan2(target.x - p.x, target.z - p.z);
    } else {
      // face the scene's character, or the middle of the rug
      const st = u.scene && STATIONS[u.scene];
      const look = st ? st.pos : new THREE.Vector3(0, 0, 0);
      const want = Math.atan2(look.x - p.x, look.z - p.z);
      g.current.rotation.y += (want - g.current.rotation.y) * Math.min(1, dt * 4);
    }
    g.current.position.copy(p);
    const talking = u.phase === 'listening';
    body.current.position.y = walking ? Math.abs(Math.sin(t * 10)) * 0.12 : talking ? Math.abs(Math.sin(t * 8)) * 0.07 : 0;
    body.current.rotation.z = u.phase === 'thinking' ? Math.sin(t * 2) * 0.08 : 0;
    if (ring.current) { const k = 1 + (Math.sin(t * 6) + 1) * 0.12; ring.current.scale.set(k, k, k); }
  });

  const recent = u.said && now - (u.saidAt || 0) < SAID_SHOW_MS;
  return (
    <group ref={g}>
      {u.phase === 'listening' && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.45, 0.58, 32]} />
          <meshBasicMaterial color="#29bf12" transparent opacity={0.7} />
        </mesh>
      )}
      <group ref={body}><Character color={u.color} /></group>
      <Html position={[0, 2.05, 0]} center distanceFactor={12} zIndexRange={[20, 10]}>
        <div className={'r3-tag' + (me ? ' me' : '')} style={{ '--c': u.color }}>
          {recent && <div className="r3-said">{u.said}</div>}
          {!recent && u.phase === 'thinking' && <div className="r3-said dots"><i /><i /><i /></div>}
          <span>{u.name}{me ? ' (bạn)' : ''}</span>
        </div>
      </Html>
    </group>
  );
}

function Scene({ users, meId }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // a stable slot per learner inside each place, so nobody jumps around when others come and go
  const targets = useMemo(() => {
    const byPlace = {};
    return Object.fromEntries([...users].sort((a, b) => a.id.localeCompare(b.id)).map(u => {
      const k = u.scene || '_lobby'; byPlace[k] = (byPlace[k] || 0) + 1;
      return [u.id, spot(u, byPlace[k] - 1)];
    }));
  }, [users]);
  const busy = {};
  users.forEach(u => { if (u.scene && u.phase === 'speaking') busy[u.scene] = 'speaking'; });

  return (
    <>
      <color attach="background" args={['#f6efe4']} />
      <hemisphereLight args={['#fffaf0', '#c9b79c', 0.9]} />
      <directionalLight position={[6, 12, 6]} intensity={1.4} castShadow={!MOBILE} shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-13} shadow-camera-right={13} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <Floor />
      {Object.values(STATIONS).map(st => <Station key={st.scene.id} st={st} busy={busy[st.scene.id]} />)}
      {users.map(u => <Learner key={u.id} u={u} target={targets[u.id]} me={u.id === meId} now={now} />)}
      <ContactShadows position={[0, 0.015, 0]} scale={26} blur={2.4} opacity={0.35} far={4} frames={MOBILE ? 1 : Infinity} />
      <OrbitControls makeDefault enableDamping target={[0, 0, 0.5]} minDistance={8} maxDistance={30}
        minPolarAngle={0.35} maxPolarAngle={1.2} enablePan={false} />
    </>
  );
}

export default function Room3D({ room, me, onClose }) {
  const [users, setUsers] = useState(room.users);
  const [ok, setOk] = useState(room.ok);
  const [list, setList] = useState(!MOBILE);
  useEffect(() => room.subscribe((u, k) => { setUsers(u); setOk(k); }, true), [room]);

  // my own figure follows my state right away, without waiting for the next poll
  const all = useMemo(() => {
    if (!me) return users;
    const mine = { ...me, ...room.status, ts: Date.now() };
    return [...users.filter(u => u.id !== me.id), mine];
  }, [users, me, room.status]);

  return (
    <div className="r3" role="dialog" aria-label="Lớp học">
      <Canvas shadows={!MOBILE} dpr={[1, MOBILE ? 1.5 : 2]} camera={{ position: [0, 13, 15], fov: 42 }}>
        <Scene users={all} meId={me && me.id} />
      </Canvas>

      <div className="r3-bar">
        <div className="r3-title">
          <strong>Lớp học</strong>
          <span>{ok === false ? 'Chưa kết nối được lớp học' : `${all.length} người đang online`}</span>
        </div>
        <button className="ghost" onClick={() => setList(v => !v)}>{list ? 'Ẩn danh sách' : 'Danh sách'}</button>
        <button className="iconbtn" onClick={onClose} aria-label="Đóng lớp học">✕</button>
      </div>

      {list && (
        <ul className="r3-list">
          {all.map(u => (
            <li key={u.id}>
              <i style={{ background: u.color }} />
              <div>
                <b>{u.name}{me && u.id === me.id ? ' (bạn)' : ''}</b>
                <span>{describe(u)}</span>
                {u.said && Date.now() - (u.saidAt || 0) < 60000 && <q>{u.said}</q>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
