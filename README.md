# ZONE//24 — Prediction Terminal

Interactive 3D football "zone market" built with React 19, Three.js, React Three Fiber, custom GLSL shaders and postprocessing (bloom, chromatic aberration, vignette, film grain).

- 24 glass pitch zones with shader glow, hover preview and click-to-lock (raised white slab + volumetric beam + sparkles)
- Holographic voronoi ball with halo, trail, motes and landing shockwaves
- Floating stadium bowl, rim lights, floodlight cones, twinkling starfield
- Live market HUD (odds ticker, matched volume, momentum), `Esc` releases the zone
- Responsive: desktop panels / mobile bottom sheet

```bash
pnpm install
pnpm dev     # http://localhost:3000
pnpm build
```
