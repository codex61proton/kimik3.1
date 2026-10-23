// Order-independent, NaN-safe smoothstep (GLSL leaves edge0>=edge1 undefined).
const SS = /* glsl */ `
float ssr(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
`

export const NOISE = /* glsl */ `
float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),u.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),u.x), u.y);
}
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
`

/* ---------------- pitch zone (box with glowing top face) ---------------- */
export const zoneVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vViewN;
varying vec3 vViewDir;
void main(){
  vUv = uv;
  vN = normal;
  vec4 wp = modelMatrix * vec4(position,1.);
  vWorld = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vViewN = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`

export const zoneFrag = /* glsl */ `
${SS}
uniform vec3 uColor;
uniform vec2 uSize;
uniform float uHover;
uniform float uLock;
uniform float uFlash;
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vViewN;
varying vec3 vViewDir;
${NOISE}
void main(){
  float act = max(uHover, uLock);
  if (vN.y < 0.5) {
    // slab sides: frosted glass that turns into a light wall when locked
    float h = vUv.y;
    vec3 c = mix(uColor*0.5, vec3(0.95,0.98,1.0)*1.8, 0.25 + 0.75*uLock);
    c += vec3(1.0) * ssr(0.7,1.0,h) * (0.4 + uLock);
    gl_FragColor = vec4(c, 0.45 + 0.5*act);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    return;
  }
  vec2 p = vUv * uSize;
  float d = min(min(p.x, uSize.x - p.x), min(p.y, uSize.y - p.y));

  float border = ssr(0.034, 0.012, d);
  float innerLine = ssr(0.012, 0.0, abs(d - 0.075)) * 0.18;
  float glow = exp(-d * 8.0);

  float grain = fbm(vWorld.xz * 5.0);
  float fine = vnoise(vWorld.xz * 140.0);
  float mow = 0.5 + 0.5 * sin(vWorld.z * 5.2);
  // brighter center, darker rim like the frosted tiles in the reference
  float center = ssr(0.0, 0.55, d / max(uSize.x, uSize.y) * 2.0);

  vec3 base = uColor * (0.5 + 0.36*grain) * (0.9 + 0.1*mow) * (0.8 + 0.35*center);
  base += fine * 0.025;

  // slow diagonal light sweep across the whole pitch
  float sweepPos = fract((vWorld.x * 0.6 + vWorld.z) * 0.07 - uTime * 0.06);
  float sweep = ssr(0.06, 0.0, abs(sweepPos - 0.5)) * 0.22;

  // view-dependent sheen for a glossy, glassy surface
  float fres = pow(1.0 - clamp(dot(vViewN, vViewDir), 0.0, 1.0), 3.0);

  vec3 col = base + vec3(0.5,0.75,0.9) * sweep + vec3(0.35,0.55,0.75) * fres * 0.5;
  col = mix(col, col * 1.55 + vec3(0.06,0.1,0.12), uHover);

  vec3 lockCol = vec3(0.9,0.93,1.0) * (1.5 + 0.35*grain);
  float shimmer = 0.5 + 0.5*sin(uTime*3.0 + vWorld.x*4.0 + vWorld.z*3.0);
  lockCol += vec3(0.1,0.12,0.15) * shimmer;
  col = mix(col, lockCol, uLock);

  // sparkle grain while selected
  float sp = step(0.988, hash21(floor(vWorld.xz * 90.0) + floor(uTime * 14.0)));
  col += vec3(1.2) * sp * uLock;

  vec3 edgeCol = vec3(0.92,0.97,1.0) * (1.5 + uHover*1.4 + uLock*2.2 + uFlash*3.0);
  col = mix(col, edgeCol, border);
  col += vec3(0.7,0.88,1.0) * glow * (0.28 + 0.55*uHover + 0.8*uLock + uFlash);
  col += vec3(1.0) * innerLine * (1.0 + act);
  col += vec3(0.8,0.95,1.0) * uFlash * 0.6;

  float alpha = mix(0.8, 0.96, act);
  alpha = max(alpha, border);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/* ---------------- volumetric light (beam column / stadium spot cone) ---------------- */
export const volumeVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vViewN;
varying vec3 vViewDir;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position,1.);
  vViewN = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`

export const volumeFrag = /* glsl */ `
${SS}
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uTop; // 1 = brightest at the top of the geometry (cone apex)
uniform float uBands;
uniform float uBody;
varying vec2 vUv;
varying vec3 vViewN;
varying vec3 vViewDir;
${NOISE}
void main(){
  float facing = clamp(abs(dot(vViewN, vViewDir)), 0.0, 1.0);
  float body = pow(facing, 1.4);          // thick through the middle
  float rim = pow(1.0 - facing, 3.0);     // crisp silhouette
  float y = mix(vUv.y, 1.0 - vUv.y, uTop);
  float fade = pow(clamp(1.0 - y, 0.0, 1.0), 1.7);
  float dust = 0.75 + 0.25 * fbm(vec2(vUv.x * 9.0, vUv.y * 4.0 - uTime * 0.25));
  float bands = 1.0 - uBands * (0.5 + 0.5 * sin(vUv.y * 38.0 - uTime * 3.0)) * 0.35;
  float a = (uBody * body + 0.3 * rim) * fade * dust * bands * uOpacity;
  gl_FragColor = vec4(uColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/* ---------------- stars & bokeh ---------------- */
export const starVert = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uPixelRatio;
uniform float uScale;
varying float vTw;
varying float vPhase;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.);
  gl_Position = projectionMatrix * mv;
  vTw = 0.45 + 0.55 * (0.5 + 0.5*sin(uTime * (0.4 + aPhase * 1.9) + aPhase * 40.0));
  vPhase = aPhase;
  gl_PointSize = aSize * uPixelRatio * (uScale / -mv.z);
}
`

export const starFrag = /* glsl */ `
${SS}
uniform float uSoft;
varying float vTw;
varying float vPhase;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float core = pow(1.0 - d, mix(3.0, 1.2, uSoft));
  float ring = uSoft * ssr(0.6, 0.85, d) * ssr(1.0, 0.85, d) * 0.12;
  vec3 tint = mix(vec3(0.75,0.85,1.0), vec3(0.6,1.0,0.95), step(0.8, vPhase));
  float a = (core + ring) * vTw * mix(1.0, 0.22, uSoft);
  gl_FragColor = vec4(tint * 1.6, a);
}
`

/* ---------------- sky dome ---------------- */
export const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.);
  gl_Position = p.xyww;
}
`

export const skyFrag = /* glsl */ `
${SS}
uniform float uTime;
varying vec3 vDir;
${NOISE}
void main(){
  float y = vDir.y;
  vec3 deep = vec3(0.006,0.014,0.035);
  vec3 mid = vec3(0.01,0.032,0.075);
  vec3 col = mix(mid, deep, ssr(0.0, 0.7, abs(y)));
  vec2 q = vec2(atan(vDir.z, vDir.x + 1e-5) * 1.6, y * 3.0);
  float neb = fbm(q * 1.4 + vec2(uTime*0.004, 0.0));
  col += vec3(0.02,0.06,0.12) * ssr(0.45, 0.85, neb) * 0.8;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

/* ---------------- grass apron inside the bowl ---------------- */
export const grassVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position,1.);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const grassFrag = /* glsl */ `
${SS}
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorld;
${NOISE}
void main(){
  float r = length(vUv - 0.5) * 2.0;
  float stripes = step(0.5, fract(vWorld.z * 0.55));
  float n = fbm(vWorld.xz * 2.2);
  vec3 g1 = vec3(0.012,0.1,0.07);
  vec3 g2 = vec3(0.018,0.14,0.095);
  vec3 col = mix(g1, g2, stripes) * (0.75 + 0.5 * n);
  // cool reflection of the blue rim near the edge
  col = mix(col, vec3(0.03,0.12,0.25), ssr(0.8, 1.0, r) * 0.6);
  col *= 0.9 + 0.1 * sin(uTime * 0.5);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/* ---------------- glowing rim wall ---------------- */
export const rimFrag = /* glsl */ `
${SS}
uniform float uTime;
varying vec2 vUv;
varying vec3 vViewN;
varying vec3 vViewDir;
void main(){
  float panel = ssr(0.0, 0.04, fract(vUv.x * 96.0)) * ssr(1.0, 0.96, fract(vUv.x * 96.0));
  vec3 low = vec3(0.01,0.05,0.16);
  vec3 high = vec3(0.06,0.25,0.7);
  vec3 col = mix(low, high, vUv.y) * (0.75 + 0.25 * panel);
  col += vec3(0.4,0.7,1.0) * ssr(0.88, 1.0, vUv.y) * 1.2;
  float fres = pow(clamp(1.0 - abs(dot(vViewN, vViewDir)), 0.0, 1.0), 2.0);
  col += vec3(0.2,0.5,1.0) * fres * 0.6;
  float scan = ssr(0.02, 0.0, abs(fract(vUv.x * 2.0 - uTime * 0.05) - 0.5)) * 0.8;
  col += vec3(0.4,0.8,1.0) * scan;
  gl_FragColor = vec4(col, 0.82);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/* ---------------- floating base (dish side) ---------------- */
export const baseFrag = /* glsl */ `
${SS}
varying vec2 vUv;
varying vec3 vViewN;
varying vec3 vViewDir;
void main(){
  vec3 top = vec3(0.04,0.3,0.28);
  vec3 bottom = vec3(0.01,0.04,0.07);
  vec3 col = mix(bottom, top, pow(clamp(vUv.y, 0.0, 1.0), 1.5));
  float fres = pow(clamp(1.0 - abs(dot(vViewN, vViewDir)), 0.0, 1.0), 2.5);
  col += vec3(0.1,0.5,0.55) * fres * 0.5;
  col += vec3(0.3,0.9,0.85) * ssr(0.93, 1.0, vUv.y) * 0.7;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/* ---------------- stadium tiers ---------------- */
export const tierFrag = /* glsl */ `
${SS}
uniform float uTime;
uniform float uDashes;
varying vec2 vUv;
varying vec3 vViewN;
varying vec3 vViewDir;
${NOISE}
void main(){
  vec3 col = mix(vec3(0.004,0.009,0.02), vec3(0.012,0.028,0.055), vUv.y);
  // seat rows
  col += vec3(0.01,0.025,0.05) * step(0.5, fract(vUv.y * 14.0)) * 0.5;
  // crowd flicker (phone lights / flashes)
  vec2 cell = floor(vec2(vUv.x * 3200.0, vUv.y * 70.0));
  float f = step(0.996, hash21(cell + floor(uTime * 2.0)));
  col += vec3(0.5,0.6,0.75) * f * 0.35 * ssr(0.1, 0.4, vUv.y) * ssr(0.9, 0.7, vUv.y);
  // dashed light strip along the top edge
  float dash = step(0.45, fract(vUv.x * uDashes));
  float strip = ssr(0.9, 0.94, vUv.y) * ssr(1.0, 0.97, vUv.y);
  col += vec3(0.75,0.88,1.0) * dash * strip * 2.4;
  float fres = pow(clamp(1.0 - abs(dot(vViewN, vViewDir)), 0.0, 1.0), 2.0);
  col += vec3(0.02,0.05,0.1) * fres;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/* ---------------- ball ---------------- */
export const ballVert = /* glsl */ `
varying vec3 vLocal;
varying vec3 vViewN;
varying vec3 vViewDir;
void main(){
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position,1.);
  vViewN = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`

export const ballFrag = /* glsl */ `
${SS}
uniform float uTime;
uniform float uEnergy;
varying vec3 vLocal;
varying vec3 vViewN;
varying vec3 vViewDir;
vec3 hash33(vec3 p){
  p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6)));
  return fract(sin(p)*43758.5453);
}
// returns F2 - F1 so cell borders form a glowing polygon net
float voronoiEdge(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
    vec3 g = vec3(float(x),float(y),float(z));
    vec3 o = hash33(i+g);
    o = 0.5 + 0.45*sin(uTime*0.6 + 6.2831*o);
    float d = length(g + o - f);
    if(d < f1){ f2 = f1; f1 = d; } else if(d < f2){ f2 = d; }
  }
  return f2 - f1;
}
void main(){
  vec3 n = normalize(vLocal);
  float e = voronoiEdge(n * 3.4);
  float net = ssr(0.12, 0.0, e);
  float facing = clamp(dot(vViewN, vViewDir), 0.0, 1.0);
  float fres = pow(1.0 - facing, 2.2);
  vec3 cyan = vec3(0.35, 1.0, 0.95);
  vec3 col = vec3(0.02,0.12,0.16) + cyan * net * (1.4 + uEnergy) + cyan * fres * 2.2;
  col += vec3(0.9,1.0,1.0) * pow(net, 3.0) * 1.2;
  float a = clamp(0.25 + net * 0.75 + fres, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export const haloFrag = /* glsl */ `
${SS}
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(1.0 - d, 0.0), 2.4) * uOpacity;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
`

export const ringFrag = /* glsl */ `
${SS}
uniform vec3 uColor;
uniform float uOpacity;
uniform float uWidth;
varying vec2 vUv;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float ring = ssr(uWidth, 0.0, abs(d - 0.85)) ;
  float inner = ssr(0.85, 0.0, d) * 0.12;
  gl_FragColor = vec4(uColor, (ring + inner) * uOpacity);
  #include <colorspace_fragment>
}
`

export const uvVert = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
}
`
