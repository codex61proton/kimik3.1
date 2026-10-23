import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { CameraControls, AdaptiveDpr } from '@react-three/drei'
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { ZONES } from '../data/zones'
import { useStore } from '../store'
import { Sky } from './Sky'
import { Stadium } from './Stadium'
import { Pitch } from './Pitch'
import { Ball } from './Ball'

function homeView(aspect: number) {
  // portrait screens need the camera further back to fit the bowl
  const k = aspect < 0.8 ? 2.05 : aspect < 1.2 ? 1.45 : 1
  return {
    pos: new THREE.Vector3(5.6 * k, 7.4 * k, 8.6 * k),
    target: new THREE.Vector3(-0.7, 0, -1.4),
  }
}

function Rig() {
  const ref = useRef<CameraControls>(null)
  const size = useThree((s) => s.size)
  const locked = useStore((s) => s.locked)
  const intro = useRef(false)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const { pos, target } = homeView(size.width / size.height)
    if (!intro.current) {
      intro.current = true
      c.setLookAt(0, 26, 34, 0, 0, 0, false)
      c.smoothTime = 1.4
      c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true).then(() => {
        c.smoothTime = 0.45
      })
    }
  }, [size.width, size.height])

  useEffect(() => {
    const c = ref.current
    if (!c || !intro.current) return
    if (locked === null) {
      c.moveTo(-0.7, 0, -1.4, true)
    } else {
      const z = ZONES[locked - 1]
      c.moveTo(z.x * 0.55, 0, z.z * 0.55, true)
    }
  }, [locked])

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={2.5}
      maxDistance={40}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.08}
      draggingSmoothTime={0.12}
      dollySpeed={0.6}
      truckSpeed={1}
    />
  )
}

function Effects({ mobile }: { mobile: boolean }) {
  return (
    <EffectComposer multisampling={mobile ? 0 : 4}>
      <Bloom mipmapBlur luminanceThreshold={0.75} luminanceSmoothing={0.25} intensity={mobile ? 0.9 : 1.15} radius={0.72} />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.0007, 0.0005)}
        radialModulation
        modulationOffset={0.35}
      />
      <Vignette eskil={false} offset={0.25} darkness={0.75} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.12} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

export function Experience() {
  const mobile = typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760)
  return (
    <Canvas
      className="scene"
      dpr={mobile ? [1, 1.6] : [1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 42, near: 0.1, far: 900, position: [0, 26, 34] }}
      onCreated={(state) => {
        state.gl.setClearColor('#030814')
        if (import.meta.env.DEV) (window as unknown as { __r3f: unknown }).__r3f = state
      }}
    >
      <Suspense fallback={null}>
        <Sky />
        <Stadium />
        <Pitch />
        <Ball />
        <Rig />
        <Effects mobile={mobile} />
      </Suspense>
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  )
}
