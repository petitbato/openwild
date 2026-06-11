# OpenWild

An open-world exploration tech demo in the spirit of *Breath of the Wild*, running entirely in the browser. Procedural island, free climbing, paragliding, day/night cycle — no game engine, just Three.js and a physics library.

## Features

- **Procedural island** — heightmap terrain with beaches, plains, forests and a climbable cliff sector, generated from a single seed
- **Movement** — run, sprint, jump, free-climb any steep surface, and paraglide with a deployable glider, all governed by a stamina wheel
- **Day/night cycle** — animated sky, stars, drifting toon clouds, and a world that reacts: birds circle by day, fireflies and a campfire light the ruins at night
- **Living world** — three tree archetypes with per-instance variation, swaying grass, shore foam, water, landing/sprint dust, wind streaks while gliding
- **Fully synthesized audio** — composed piano motifs (different sets for day and night), crickets, waves, wind, footsteps and bird cries, all generated with the Web Audio API. The repo contains zero audio files.
- **Character** — KayKit Rogue avatar (CC0) with real animation clips plus procedural climbing and gliding poses

## Controls

| Action | Keyboard / Mouse | Gamepad |
|---|---|---|
| Move | `W` `A` `S` `D` | Left stick |
| Look | Mouse (click the canvas to lock the pointer) | Right stick |
| Jump | `Space` | A / Cross |
| Glide | `Space` again while airborne | A again while airborne |
| Sprint | `Shift` | B / L3 |
| Climb | Walk into a steep wall | Walk into a steep wall |
| Fast-forward time | Hold `T` | — |

Falling into deep water or off the world respawns you at your last grounded position.

## Getting started

```bash
npm install
npm run dev        # dev server at http://localhost:5173
```

Other scripts:

```bash
npm test           # vitest unit tests
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build
```

## Tech stack

- [Three.js](https://threejs.org/) — rendering (toon-shaded, instanced meshes for props/grass/foam/dust)
- [Rapier](https://rapier.rs/) (`@dimforge/rapier3d-compat`) — physics, character controller, terrain trimesh
- [Vite](https://vitejs.dev/) + TypeScript (strict) + [Vitest](https://vitest.dev/)
- Web Audio API — every sound and the music are synthesized at runtime

## Credits & license

- Code: [MIT](LICENSE)
- Character model: based on the Rogue from [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) by Kay Lousberg — **CC0**, recolored for this project (`tools/` contains the fetch/recolor pipeline)
- Everything else (terrain, props, sky, audio) is procedural

This is a fan-made technical exercise. It is not affiliated with, endorsed by, or connected to Nintendo, and contains no Nintendo assets.
