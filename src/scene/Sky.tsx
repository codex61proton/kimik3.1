import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bindUniforms } from './bindUniforms'
import { skyFrag, skyVert, starFrag, starVert } from './shaders'

function makeStars(count: number, rMin: number, rMax: number, sizeMin: number, sizeMax: number, seed: number) {
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const pos = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const phase = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1
    const th = rnd() * Math.PI * 2
    const y = u
    const r = rMin + rnd() * (rMax - rMin)
    const q = Math.sqrt(Math.max(0, 1 - y * y))
    pos[i * 3] = Math.cos(th) * q * r
    pos[i * 3 + 1] = y * r
    pos[i * 3 + 2] = Math.sin(th) * q * r
    size[i] = sizeMin + Math.pow(rnd(), 3) * (sizeMax - sizeMin)
    phase[i] = rnd()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
  return g
}

function StarLayer({ count, rMin, rMax, sizeMin, sizeMax, soft, seed, spin }: {
  count: number; rMin: number; rMax: number; sizeMin: number; sizeMax: number; soft: number; seed: number; spin: number
}) {
  const ref = useRef<THREE.Points>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  const geo = useMemo(() => makeStars(count, rMin, rMax, sizeMin, sizeMax, seed), [count, rMin, rMax, sizeMin, sizeMax, seed])
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uPixelRatio: { value: dpr }, uScale: { value: 300 }, uSoft: { value: soft } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  uniforms.uPixelRatio.value = dpr
  useFrame((_, dt) => {
    uniforms.uTime.value += dt
    if (ref.current) ref.current.rotation.y += dt * spin
  })
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <shaderMaterial
        vertexShader={starVert}
        fragmentShader={starFrag}
        ref={bindUniforms(uniforms)}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export function Sky() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame((_, dt) => (uniforms.uTime.value += dt))
  return (
    <>
      <mesh renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[400, 48, 24]} />
        <shaderMaterial vertexShader={skyVert} fragmentShader={skyFrag} ref={bindUniforms(uniforms)} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <StarLayer count={4200} rMin={120} rMax={220} sizeMin={1.4} sizeMax={6} soft={0} seed={7} spin={0.002} />
      {/* large soft bokeh specks floating between camera and stars */}
      <StarLayer count={90} rMin={45} rMax={90} sizeMin={4} sizeMax={9} soft={1} seed={99} spin={-0.006} />
    </>
  )
}
