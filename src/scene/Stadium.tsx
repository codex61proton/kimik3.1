import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { bindUniforms } from './bindUniforms'
import { baseFrag, grassFrag, grassVert, rimFrag, tierFrag, volumeFrag, volumeVert } from './shaders'

export const BOWL_A = 5.05 // half-width (x)
export const BOWL_B = 7.65 // half-length (z)

function useTime() {
  const u = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame((_, dt) => (u.uTime.value += dt))
  return u
}

function FloatingBase() {
  return (
    <group>
      <mesh position={[0, -0.36, 0]} scale={[BOWL_A + 0.22, 1, BOWL_B + 0.22]}>
        <cylinderGeometry args={[1, 0.9, 0.7, 160, 1, false]} />
        <shaderMaterial vertexShader={volumeVert} fragmentShader={baseFrag} />
      </mesh>
      {/* soft cyan underglow */}
      <mesh position={[0, -0.75, 0]} rotation-x={-Math.PI / 2} scale={[BOWL_A * 2.6, BOWL_B * 2.6, 1]}>
        <planeGeometry />
        <shaderMaterial
          vertexShader={/* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`}
          fragmentShader={/* glsl */ `varying vec2 vUv; void main(){ float d=length(vUv-.5)*2.; gl_FragColor=vec4(vec3(0.1,0.45,0.6), pow(max(1.-d,0.),2.)*0.35); }`}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

function Grass() {
  const u = useTime()
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} scale={[BOWL_A, BOWL_B, 1]}>
      <circleGeometry args={[1, 160]} />
      <shaderMaterial vertexShader={grassVert} fragmentShader={grassFrag} ref={bindUniforms(u)} />
    </mesh>
  )
}

function RimWall() {
  const u = useTime()
  const posts = useRef<THREE.InstancedMesh>(null)
  const count = 56
  const matrices = useMemo(() => {
    const out: THREE.Matrix4[] = []
    const o = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2
      o.position.set(Math.cos(t) * (BOWL_A + 0.05), 0.5, Math.sin(t) * (BOWL_B + 0.05))
      o.lookAt(0, 0.5, 0)
      o.updateMatrix()
      out.push(o.matrix.clone())
    }
    return out
  }, [])
  const postMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.4, 3.0), toneMapped: false }), [])
  useFrame(({ clock }) => {
    // gentle breathing of the rim lights
    const k = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 2.2)
    postMat.color.setRGB(1.6 * k, 2.4 * k, 3.0 * k)
  })
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[BOWL_A, 1, BOWL_B]}>
        <cylinderGeometry args={[1, 1, 0.44, 192, 1, true]} />
        <shaderMaterial vertexShader={volumeVert} fragmentShader={rimFrag} ref={bindUniforms(u)} transparent side={THREE.DoubleSide} />
      </mesh>
      {/* bright lip on top of the wall */}
      <mesh position={[0, 0.445, 0]} rotation-x={-Math.PI / 2} scale={[BOWL_A, BOWL_B, 1]}>
        <ringGeometry args={[0.992, 1.012, 192]} />
        <meshBasicMaterial color={new THREE.Color(0.9, 1.5, 2.4)} toneMapped={false} />
      </mesh>
      <instancedMesh
        ref={(m) => {
          if (!m) return
          posts.current = m
          matrices.forEach((mx, i) => m.setMatrixAt(i, mx))
          m.instanceMatrix.needsUpdate = true
        }}
        args={[undefined, postMat, count]}
      >
        <boxGeometry args={[0.16, 0.17, 0.05]} />
      </instancedMesh>
    </group>
  )
}

function Tier({ profile, scaleZ, dashes, y = 0 }: { profile: [number, number][]; scaleZ: number; dashes: number; y?: number }) {
  const u = useMemo(() => ({ uTime: { value: 0 }, uDashes: { value: dashes } }), [dashes])
  useFrame((_, dt) => (u.uTime.value += dt))
  const geo = useMemo(() => new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), 220), [profile])
  return (
    <mesh geometry={geo} position-y={y} scale={[1, 1, scaleZ]}>
      <shaderMaterial vertexShader={volumeVert} fragmentShader={tierFrag} ref={bindUniforms(u)} side={THREE.DoubleSide} />
    </mesh>
  )
}

const UPPER: [number, number][] = [
  [15.5, 3.2],
  [18.5, 5.6],
  [21.5, 8.2],
  [21.8, 8.6],
]

function Spot({ from, to, color = '#bcd6ff', width = 1.6, opacity = 0.55 }: {
  from: [number, number, number]; to: [number, number, number]; color?: string; width?: number; opacity?: number
}) {
  const u = useMemo(
    () => ({
      uTime: { value: Math.random() * 10 },
      uColor: { value: new THREE.Color(color).multiplyScalar(1.4) },
      uOpacity: { value: opacity },
      uTop: { value: 1 },
      uBands: { value: 0 },
      uBody: { value: 0.16 },
    }),
    [color, opacity],
  )
  const ref = useRef<THREE.Group>(null)
  const { len, quat, mid } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const dir = b.clone().sub(a)
    const len = dir.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize())
    return { len, quat, mid: a.clone().lerp(b, 0.5) }
  }, [from, to])
  useFrame((_, dt) => {
    u.uTime.value += dt
    u.uOpacity.value = opacity * (0.85 + 0.15 * Math.sin(u.uTime.value * 0.7))
  })
  return (
    <group ref={ref} position={mid} quaternion={quat}>
      <mesh>
        <cylinderGeometry args={[0.08, width, len, 48, 1, true]} />
        <shaderMaterial
          vertexShader={volumeVert}
          fragmentShader={volumeFrag}
          ref={bindUniforms(u)}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

function Floodlights() {
  const spots = useMemo(() => {
    const out: { from: [number, number, number]; to: [number, number, number] }[] = []
    const n = 8
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2 + 0.3
      const from: [number, number, number] = [Math.cos(t) * 20.5, 8.6, Math.sin(t) * 26]
      const to: [number, number, number] = [Math.cos(t + 0.5) * 4, -0.5, Math.sin(t + 0.5) * 6]
      out.push({ from, to })
    }
    return out
  }, [])
  return (
    <>
      {spots.map((s, i) => (
        <Spot key={i} from={s.from} to={s.to} width={2.4} opacity={0.2} />
      ))}
    </>
  )
}

export function Stadium() {
  return (
    <group>
      <FloatingBase />
      <Grass />
      <RimWall />
      <Tier profile={UPPER} scaleZ={1.25} dashes={110} />
      <Floodlights />
    </group>
  )
}
