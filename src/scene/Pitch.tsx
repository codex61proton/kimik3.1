import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { bindUniforms } from './bindUniforms'
import { PITCH_L, PITCH_W, ZONES, type ZoneDef } from '../data/zones'
import { useStore } from '../store'
import { ringFrag, uvVert, volumeFrag, volumeVert, zoneFrag, zoneVert } from './shaders'

const SLAB_H = 0.05
const LINE_Y = SLAB_H + 0.006
const lineColor = new THREE.Color(1.5, 1.6, 1.7)

function Beam({ zone, active }: { zone: ZoneDef; active: boolean }) {
  const u = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0.85, 0.82, 1.0).multiplyScalar(1.3) },
      uOpacity: { value: 0 },
      uTop: { value: 0 },
      uBands: { value: 1 },
      uBody: { value: 0.45 },
    }),
    [],
  )
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    u.uTime.value += dt
    u.uOpacity.value = THREE.MathUtils.damp(u.uOpacity.value, active ? 1 : 0, 6, dt)
    if (ref.current) {
      ref.current.visible = u.uOpacity.value > 0.01
      const s = 0.6 + 0.4 * u.uOpacity.value
      ref.current.scale.set(1, s, 1)
      ref.current.position.y = (4.2 * s) / 2 + 0.2
    }
  })
  const r = Math.min(zone.w, zone.l) * 0.28
  return (
    <mesh ref={ref} position={[zone.x, 2.3, zone.z]} visible={false}>
      <cylinderGeometry args={[r, r, 4.2, 48, 1, true]} />
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
  )
}

function Burst({ zone, pulse }: { zone: ZoneDef; pulse: number }) {
  const u = useMemo(
    () => ({ uColor: { value: new THREE.Color(0.6, 1.6, 1.5) }, uOpacity: { value: 0 }, uWidth: { value: 0.06 } }),
    [],
  )
  const t = useRef(1)
  const ref = useRef<THREE.Mesh>(null)
  useEffect(() => {
    if (pulse > 0) t.current = 0
  }, [pulse])
  useFrame((_, dt) => {
    t.current = Math.min(1, t.current + dt / 1.1)
    const e = 1 - Math.pow(1 - t.current, 3)
    u.uOpacity.value = (1 - t.current) * 1.4
    ref.current?.scale.setScalar(0.4 + e * 3.2)
  })
  return (
    <mesh ref={ref} position={[zone.x, LINE_Y + 0.25, zone.z]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial vertexShader={uvVert} fragmentShader={ringFrag} ref={bindUniforms(u)} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

function Zone({ zone }: { zone: ZoneDef }) {
  const hovered = useStore((s) => s.hovered === zone.id)
  const locked = useStore((s) => s.locked === zone.id)
  const pulse = useStore((s) => (s.locked === zone.id ? s.placePulse : 0))
  const odds = useStore((s) => s.markets[zone.id].odds)
  const setHovered = useStore((s) => s.setHovered)
  const toggleLock = useStore((s) => s.toggleLock)
  const group = useRef<THREE.Group>(null)

  const u = useMemo(
    () => ({
      uColor: { value: new THREE.Color(zone.color) },
      uSize: { value: new THREE.Vector2(zone.w, zone.l) },
      uHover: { value: 0 },
      uLock: { value: 0 },
      uFlash: { value: 0 },
      uTime: { value: 0 },
    }),
    [zone],
  )
  const lastPulse = useRef(pulse)

  useFrame((_, dt) => {
    u.uTime.value += dt
    u.uHover.value = THREE.MathUtils.damp(u.uHover.value, hovered && !locked ? 1 : 0, 10, dt)
    u.uLock.value = THREE.MathUtils.damp(u.uLock.value, locked ? 1 : 0, 7, dt)
    if (pulse !== lastPulse.current) {
      lastPulse.current = pulse
      if (pulse > 0) u.uFlash.value = 1
    }
    u.uFlash.value = THREE.MathUtils.damp(u.uFlash.value, 0, 3, dt)
    if (group.current) {
      const target = locked ? 0.04 : hovered ? 0.05 : 0
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, target, 8, dt)
      group.current.scale.y = 1 + u.uLock.value * 3.6
    }
  })

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(zone.id)
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    setHovered(null)
    document.body.style.cursor = ''
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 8) return // was an orbit drag
    toggleLock(zone.id)
  }

  return (
    <group position={[zone.x, 0, zone.z]}>
      <group ref={group}>
        <mesh position-y={SLAB_H / 2} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
          <boxGeometry args={[zone.w, SLAB_H, zone.l]} />
          <shaderMaterial vertexShader={zoneVert} fragmentShader={zoneFrag} ref={bindUniforms(u)} transparent />
        </mesh>
      </group>
      {(hovered || locked) && (
        <Html position={[0, locked ? 0.55 : 0.3, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`zone-chip ${locked ? 'is-locked' : ''}`}>
            <span>{zone.code}</span>
            <b>{odds.toFixed(2)}</b>
          </div>
        </Html>
      )}
      {locked && (
        <Sparkles count={46} scale={[zone.w, 1.4, zone.l]} position-y={0.8} size={2.6} speed={0.5} opacity={0.9} color="#dff6ff" noise={0.6} />
      )}
      <group position={[-zone.x, 0, -zone.z]}>
        <Beam zone={zone} active={locked} />
        <Burst zone={zone} pulse={pulse} />
      </group>
    </group>
  )
}

/* ---------------- pitch markings ---------------- */

function Line({ x, z, w, l }: { x: number; z: number; w: number; l: number }) {
  return (
    <mesh position={[x, LINE_Y, z]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[w, l]} />
      <meshBasicMaterial color={lineColor} toneMapped={false} transparent opacity={0.9} />
    </mesh>
  )
}

function Arc({ x, z, r, start = 0, len = Math.PI * 2, t = 0.022 }: { x: number; z: number; r: number; start?: number; len?: number; t?: number }) {
  return (
    <mesh position={[x, LINE_Y, z]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[r - t / 2, r + t / 2, 96, 1, start, len]} />
      <meshBasicMaterial color={lineColor} toneMapped={false} transparent opacity={0.9} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Goal({ side }: { side: 1 | -1 }) {
  const w = 0.732
  const h = 0.244
  const d = 0.22
  const z = side * (PITCH_L / 2 + d / 2)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.9, 2), toneMapped: false }), [])
  const net = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#cfe8ff', wireframe: true, transparent: true, opacity: 0.25 }),
    [],
  )
  const p = 0.018
  return (
    <group position={[0, LINE_Y, z]}>
      <mesh material={mat} position={[-w / 2, h / 2, -side * d / 2]}>
        <boxGeometry args={[p, h, p]} />
      </mesh>
      <mesh material={mat} position={[w / 2, h / 2, -side * d / 2]}>
        <boxGeometry args={[p, h, p]} />
      </mesh>
      <mesh material={mat} position={[0, h, -side * d / 2]}>
        <boxGeometry args={[w + p, p, p]} />
      </mesh>
      <mesh material={net} position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d, 10, 4, 3]} />
      </mesh>
    </group>
  )
}

function Markings() {
  const t = 0.022
  const hw = PITCH_W / 2
  const hl = PITCH_L / 2
  const boxW = 4.03
  const boxL = 1.65
  const gW = 1.83
  const gL = 0.55
  const ends = [-1, 1] as const
  return (
    <group>
      {/* touchlines & goal lines */}
      <Line x={-hw} z={0} w={t} l={PITCH_L} />
      <Line x={hw} z={0} w={t} l={PITCH_L} />
      <Line x={0} z={-hl} w={PITCH_W + t} l={t} />
      <Line x={0} z={hl} w={PITCH_W + t} l={t} />
      <Line x={0} z={0} w={PITCH_W} l={t} />
      <Arc x={0} z={0} r={0.915} />
      <Arc x={0} z={0} r={0.03} t={0.06} />
      {ends.map((s) => (
        <group key={s}>
          <Line x={-boxW / 2} z={s * (hl - boxL / 2)} w={t} l={boxL} />
          <Line x={boxW / 2} z={s * (hl - boxL / 2)} w={t} l={boxL} />
          <Line x={0} z={s * (hl - boxL)} w={boxW + t} l={t} />
          <Line x={-gW / 2} z={s * (hl - gL / 2)} w={t} l={gL} />
          <Line x={gW / 2} z={s * (hl - gL / 2)} w={t} l={gL} />
          <Line x={0} z={s * (hl - gL)} w={gW + t} l={t} />
          <Arc x={0} z={s * (hl - 1.1)} r={0.03} t={0.05} />
          <Arc
            x={0}
            z={s * (hl - 1.1)}
            r={0.915}
            start={s > 0 ? Math.PI * 0.5 - 0.93 : Math.PI * 1.5 - 0.93}
            len={1.86}
          />
          <Goal side={s} />
        </group>
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Arc
            key={`${sx}${sz}`}
            x={sx * hw}
            z={sz * hl}
            r={0.1}
            start={sx > 0 ? (sz > 0 ? Math.PI : Math.PI / 2) : sz > 0 ? Math.PI * 1.5 : 0}
            len={Math.PI / 2}
          />
        )),
      )}
    </group>
  )
}

function WarmGlow() {
  const ref = useRef<THREE.Mesh>(null)
  const u = useMemo(() => ({ uColor: { value: new THREE.Color(2.2, 1.5, 0.6) }, uOpacity: { value: 0.6 } }), [])
  useFrame(({ clock, camera }) => {
    u.uOpacity.value = 0.45 + 0.12 * Math.sin(clock.elapsedTime * 1.3)
    ref.current?.quaternion.copy(camera.quaternion)
  })
  return (
    <mesh ref={ref} position={[0.2, 0.9, -PITCH_L / 2 + 1.2]} scale={[2.6, 2.6, 1]}>
      <planeGeometry />
      <shaderMaterial
        vertexShader={uvVert}
        fragmentShader={/* glsl */ `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
          void main(){ vec2 p=vUv-.5; float d=length(p)*2.; float core=pow(max(1.-d,0.),3.);
          float streak=exp(-abs(p.x)*40.)*pow(max(1.-abs(p.y)*2.,0.),2.)*0.6;
          gl_FragColor=vec4(uColor,(core+streak)*uOpacity); }`}
        ref={bindUniforms(u)}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export function Pitch() {
  return (
    <group>
      {/* dark turf seen through the gaps between zones */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.003}>
        <planeGeometry args={[PITCH_W + 0.25, PITCH_L + 0.25]} />
        <meshBasicMaterial color="#05261b" />
      </mesh>
      {ZONES.map((z) => (
        <Zone key={z.id} zone={z} />
      ))}
      <Markings />
      <WarmGlow />
    </group>
  )
}
