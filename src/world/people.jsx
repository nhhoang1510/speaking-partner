// People for the school: a whole body with jointed arms and legs that walks, gestures while talking and
// puts a hand to the chin while thinking. Looks (skin, hair, trousers) come from a seed, so the same learner
// always looks the same; room staff wear the outfit of their job.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const SKINS = ['#f3d2b3', '#e8b98f', '#d7a274', '#b07850', '#8d5a3b', '#f6dcc4'];
const HAIRS = ['#2b1d14', '#4a3426', '#7a4a2a', '#c8a15a', '#1c1c1c', '#9b4a2c', '#6b6b6b'];
const PANTS = ['#2f3e5c', '#3b3b3b', '#5a4a3a', '#24476b', '#6b6f73', '#4b5b3c'];
const SHOES = ['#2a2a2a', '#5a3b28', '#f2f2f2', '#3a3a4a'];

function hash(s) { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
export function looks(seed) {
  const h = hash(seed);
  return { skin: SKINS[h % 6], hair: HAIRS[(h >> 3) % 7], pants: PANTS[(h >> 6) % 6], shoes: SHOES[(h >> 9) % 4], style: (h >> 12) % 4 };
}

const M = ({ c, rough = 0.75 }) => <meshStandardMaterial color={c} roughness={rough} />;
const Cap = ({ p = [0, 0, 0], r, l, c, s }) => (
  <mesh position={p} scale={s} castShadow><capsuleGeometry args={[r, l, 4, 10]} /><M c={c} /></mesh>
);
const Ball = ({ p, r, c, s }) => <mesh position={p} scale={s} castShadow><sphereGeometry args={[r, 16, 12]} /><M c={c} /></mesh>;
const Box = ({ p, s, c }) => <mesh position={p} castShadow><boxGeometry args={s} /><M c={c} /></mesh>;

// act: a ref the owner updates every frame with { walk, talk, think }
export function Person({ shirt, seed = 'x', outfit, hair: hairOver, act }) {
  const L = looks(seed), hair = hairOver || L.hair;
  const hipL = useRef(), hipR = useRef(), kneeL = useRef(), kneeR = useRef();
  const shL = useRef(), shR = useRef(), elL = useRef(), elR = useRef(), chest = useRef(), head = useRef();
  const w = useRef(0), talkW = useRef(0), thinkW = useRef(0);
  useFrame(({ clock }, dt) => {
    const a = (act && act.current) || {}, t = clock.elapsedTime + (hash(seed) % 100) / 10;
    const k = Math.min(1, dt * 6);
    w.current += ((a.walk ? 1 : 0) - w.current) * k;
    talkW.current += ((a.talk ? 1 : 0) - talkW.current) * k;
    thinkW.current += ((a.think ? 1 : 0) - thinkW.current) * k;
    const s = Math.sin(t * 9), W = w.current;
    if (!hipL.current) return;
    hipL.current.rotation.x = -s * 0.55 * W; hipR.current.rotation.x = s * 0.55 * W;
    kneeL.current.rotation.x = Math.max(0, s) * 0.9 * W; kneeR.current.rotation.x = Math.max(0, -s) * 0.9 * W;
    // arms: swing when walking; the right hand gestures when talking, goes to the chin when thinking
    const talk = talkW.current, think = thinkW.current;
    shL.current.rotation.x = s * 0.45 * W; shL.current.rotation.z = 0.08;
    elL.current.rotation.x = -0.15 - 0.2 * W;
    const gest = Math.sin(t * 3.2) * 0.25;
    shR.current.rotation.x = -s * 0.45 * W * (1 - talk - think) + talk * (-0.75 + gest) + think * -1.15;
    shR.current.rotation.z = -0.08 - talk * 0.15 + think * 0.35;
    elR.current.rotation.x = -0.15 - 0.2 * W + talk * (-0.8 + gest * 0.6) + think * -2.0;
    chest.current.scale.set(1, 1 + Math.sin(t * 1.6) * 0.012, 1);
    head.current.rotation.x = think * 0.12 + talk * Math.sin(t * 2.4) * 0.06;
    head.current.rotation.y = talk * Math.sin(t * 1.3) * 0.12;
  });

  const skin = L.skin, coat = outfit === 'coat', apron = outfit === 'apron', suit = outfit === 'suit', uniform = outfit === 'uniform';
  const pants = suit ? '#2b2f3a' : uniform ? '#2a3550' : L.pants;
  const leg = (side, hip, knee) => (
    <group ref={hip} position={[side * 0.1, 0.9, 0]}>
      <Cap p={[0, -0.22, 0]} r={0.075} l={0.3} c={pants} />
      <group ref={knee} position={[0, -0.44, 0]}>
        <Cap p={[0, -0.2, 0]} r={0.062} l={0.3} c={pants} />
        <Box p={[0, -0.42, 0.05]} s={[0.12, 0.08, 0.26]} c={L.shoes} />
      </group>
    </group>
  );
  const sleeve = coat ? '#f4f6f8' : suit ? '#2b2f3a' : shirt;
  const arm = (side, sh, el) => (
    <group ref={sh} position={[side * 0.24, 1.4, 0]}>
      <Cap p={[0, -0.15, 0]} r={0.06} l={0.2} c={sleeve} />
      <group ref={el} position={[0, -0.3, 0]}>
        <Cap p={[0, -0.12, 0]} r={0.05} l={0.17} c={uniform || suit || coat ? sleeve : skin} />
        <Ball p={[0, -0.27, 0.01]} r={0.055} c={skin} s={[0.9, 1.1, 0.7]} />
      </group>
    </group>
  );
  return (
    <group>
      {leg(-1, hipL, kneeL)}{leg(1, hipR, kneeR)}
      <group ref={chest}>
        {/* hips, torso and the job's outfit */}
        <Cap p={[0, 0.95, 0]} r={0.15} l={0.06} c={pants} s={[1.1, 1, 0.8]} />
        <Cap p={[0, 1.2, 0]} r={0.17} l={0.26} c={suit ? '#2b2f3a' : shirt} s={[1.15, 1, 0.75]} />
        {suit && <><Box p={[0, 1.3, 0.125]} s={[0.1, 0.22, 0.02]} c="#f4f4f4" /><Box p={[0, 1.27, 0.137]} s={[0.04, 0.2, 0.01]} c={shirt} /></>}
        {coat && <>
          <Cap p={[0, 1.08, 0]} r={0.2} l={0.42} c="#f4f6f8" s={[1.05, 1, 0.78]} />
          <Box p={[0, 1.3, 0.15]} s={[0.08, 0.2, 0.01]} c={shirt} />
          <mesh position={[0.1, 1.38, 0.14]} rotation-x={0.4}><torusGeometry args={[0.06, 0.008, 6, 14]} /><M c="#555" /></mesh>
        </>}
        {apron && <Box p={[0, 1.02, 0.135]} s={[0.3, 0.5, 0.02]} c="#3d2b22" />}
        {uniform && <Box p={[0.07, 1.33, 0.13]} s={[0.07, 0.04, 0.01]} c="#e5c46b" />}
        {arm(-1, shL, elL)}{arm(1, shR, elR)}
        <Cap p={[0, 1.5, 0]} r={0.05} l={0.06} c={skin} />
        <group ref={head} position={[0, 1.66, 0]}>
          <Ball p={[0, 0, 0]} r={0.13} c={skin} s={[0.92, 1.08, 1]} />
          <Ball p={[0, -0.01, 0.12]} r={0.022} c={skin} />
          {[-0.045, 0.045].map(x => <Ball key={x} p={[x, 0.025, 0.112]} r={0.017} c="#222" />)}
          {[-0.125, 0.125].map(x => <Ball key={'e' + x} p={[x, 0, 0]} r={0.03} c={skin} />)}
          <mesh position={[0, -0.06, 0.112]} rotation-x={-0.2}><boxGeometry args={[0.05, 0.01, 0.01]} /><M c="#a0524a" /></mesh>
          {/* hair: short, side part, long, or a bun */}
          <mesh position={[0, 0.03, -0.01]} scale={[0.97, 0.95, 1.02]}>
            <sphereGeometry args={[0.135, 18, 12, 0, Math.PI * 2, 0, Math.PI / 1.9]} /><M c={hair} rough={0.9} />
          </mesh>
          {L.style === 1 && <Ball p={[0.05, 0.11, 0.05]} r={0.07} c={hair} s={[1.4, 0.5, 1]} />}
          {L.style === 2 && <Cap p={[0, -0.08, -0.07]} r={0.11} l={0.12} c={hair} s={[1.05, 1, 0.6]} />}
          {L.style === 3 && <Ball p={[0, 0.1, -0.12]} r={0.06} c={hair} />}
        </group>
      </group>
    </group>
  );
}
