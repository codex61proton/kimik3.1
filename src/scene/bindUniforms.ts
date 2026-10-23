import type * as THREE from 'three'

// R3F copies each entry of a `uniforms` prop, which detaches it from the object we
// mutate in useFrame. Assigning by ref keeps one shared uniforms object.
export const bindUniforms =
  (u: Record<string, THREE.IUniform>) =>
  (m: THREE.ShaderMaterial | null) => {
    if (m && m.uniforms !== u) m.uniforms = u
  }
