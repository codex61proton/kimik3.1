import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Trail } from '@react-three/drei'
import * as THREE from 'three'
import { bindUniforms } from './bindUniforms'
import { PITCH_L, PITCH_W, ZONES } from '../data/zones'
import { useStore } from '../store'
import { ballFrag, ballVert, haloFrag, ringFrag, uvVert } from './shaders'

const R = 0.2
const CYAN = new THREE.Color(0.45, 1.6, 1.5)

function randomTarget(prev: THREE.Vector3) {
  const locked = useStore.getState().locked
  if (locked !== null && Math.random() < 0.45) {
    const z = ZONES[locked - 1]
    return new THREE.Vector3(z.x + (Math.random() - 0.5) * 0.4, 0, z.z + (Math.random() - 0.5) * 0.4)
  }
  // prefer passes of medium length that stay on the pitch
  for (let i = 0; i < 12; i++) {
    const v = new THREE.Vector3((Math.random() - 0.5) * (PITCH_W - 1), 0, (Math.random() - 0.5) * (PITCH_L - 1.2))
    const d = v.distanceTo(prev)
    if (d > 1.6 && d < 5.5) return v
  }
  return new THREE.Vector3(0, 0, 0)
}

function Shockwaves({ api }: { api: React.MutableRefObject<((p: THREE.Vector3) => void) | null> }) {
  const n = 4
  const items = useMemo(
    () =>
      Array.from({ length: n }, () => ({
        t: 1,
        u: { uColor: { value: CYAN.clone() }, uOpacity: { value: 0 }, uWidth: { value: 0.09 } },
      })),
    [],
  )
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const idx = useRef(0)
  api.current = (p) => {
    const i = idx.current++ % n
    items[i].t = 0
    meshes.current[i]?.position.set(p.x, 0.08, p.z)
  }
  useFrame((_, dt) => {
    items.forEach((it, i) => {
      it.t = Math.min(1, it.t + dt / 0.9)
      const e = 1 - Math.pow(1 - it.t, 3)
      it.u.uOpacity.value = (1 - it.t) * 1.6
      meshes.current[i]?.scale.setScalar(0.3 + e * 1.5)
    })
  })
  return (
    <>
      {items.map((it, i) => (
        <mesh key={i} ref={(m) => void (meshes.current[i] = m)} rotation-x={-Math.PI / 2}>
          <planeGeometry />
          <shaderMaterial vertexShader={uvVert} fragmentShader={ringFrag} ref={bindUniforms(it.u)} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </>
  )
}

function Motes() {
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const n = 70
    const p = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(R * (1.25 + Math.random() * 1.2))
      p.set([v.x, v.y, v.z], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [])
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * 0.9
    ref.current.rotation.x += dt * 0.35
  })
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.035} color={CYAN} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}

export function Ball() {
  const group = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const halo = useRef<THREE.Mesh>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const shock = useRef<((p: THREE.Vector3) => void) | null>(null)

  const flight = useRef({
    from: new THREE.Vector3(1.2, 0, -3.2),
    to: new THREE.Vector3(-0.8, 0, -1),
    t: 0,
    dur: 1.6,
    h: 1,
  })
  const ballU = useMemo(() => ({ uTime: { value: 0 }, uEnergy: { value: 0 } }), [])
  const haloU = useMemo(() => ({ uColor: { value: CYAN.clone() }, uOpacity: { value: 0.9 } }), [])
  const shadowU = useMemo(() => ({ uColor: { value: new THREE.Color(0.3, 1.1, 1.1) }, uOpacity: { value: 0.6 } }), [])
  const tmp = useMemo(() => ({ axis: new THREE.Vector3(), dir: new THREE.Vector3(), q: new THREE.Quaternion() }), [])

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const f = flight.current
    f.t += dt / f.dur
    if (f.t >= 1) {
      shock.current?.(f.to)
      ballU.uEnergy.value = 1.5
      const next = randomTarget(f.to)
      f.from.copy(f.to)
      f.to.copy(next)
      const d = f.from.distanceTo(f.to)
      f.dur = 0.9 + d * 0.22
      f.h = 0.35 + d * 0.22
      f.t = 0
    }
    const e = f.t
    const ease = e * e * (3 - 2 * e) * 0.35 + e * 0.65
    const g = group.current
    if (!g) return
    g.position.lerpVectors(f.from, f.to, ease)
    const arc = 4 * e * (1 - e)
    g.position.y = R + 0.06 + f.h * arc

    // roll around the axis perpendicular to travel
    tmp.dir.subVectors(f.to, f.from).setY(0)
    if (tmp.dir.lengthSq() > 1e-6) {
      tmp.axis.set(tmp.dir.z, 0, -tmp.dir.x).normalize()
      tmp.q.setFromAxisAngle(tmp.axis, dt * 7)
      spin.current?.quaternion.premultiply(tmp.q)
    }

    ballU.uTime.value += dt
    ballU.uEnergy.value = THREE.MathUtils.damp(ballU.uEnergy.value, 0, 3, dt)
    haloU.uOpacity.value = 0.75 + ballU.uEnergy.value * 0.3
    halo.current?.quaternion.copy(camera.quaternion)

    if (shadow.current) {
      shadow.current.position.set(g.position.x, 0.075, g.position.z)
      const s = 1.1 - arc * 0.45
      shadow.current.scale.setScalar(s * 0.9)
      shadowU.uOpacity.value = 0.65 - arc * 0.4
    }
  })

  return (
    <>
      <Trail width={1.4} length={5} color={new THREE.Color(0.3, 1.3, 1.25)} attenuation={(t) => t * t * t} decay={1.5}>
        <group ref={group}>
          <group ref={spin}>
            <mesh>
              <sphereGeometry args={[R, 64, 48]} />
              <shaderMaterial vertexShader={ballVert} fragmentShader={ballFrag} ref={bindUniforms(ballU)} transparent depthWrite={false} />
            </mesh>
            <mesh>
              <icosahedronGeometry args={[R * 1.03, 1]} />
              <meshBasicMaterial color={new THREE.Color(0.6, 1.6, 1.6)} wireframe transparent opacity={0.25} toneMapped={false} />
            </mesh>
          </group>
          <mesh>
            <sphereGeometry args={[R * 0.55, 24, 16]} />
            <meshBasicMaterial color={new THREE.Color(1.4, 2.4, 2.4)} toneMapped={false} transparent opacity={0.35} />
          </mesh>
          <mesh ref={halo} scale={R * 5.5}>
            <planeGeometry />
            <shaderMaterial vertexShader={uvVert} fragmentShader={haloFrag} ref={bindUniforms(haloU)} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <Motes />
        </group>
      </Trail>
      <mesh ref={shadow} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial vertexShader={uvVert} fragmentShader={haloFrag} ref={bindUniforms(shadowU)} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <Shockwaves api={shock} />
    </>
  )
}
