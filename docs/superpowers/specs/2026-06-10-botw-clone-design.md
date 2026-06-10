# BoTW-Style Exploration Tech Demo — Design Spec

**Date:** 2026-06-10
**Status:** Approved by user (design review passed)

## Purpose

A browser-based, Zelda: Breath of the Wild-inspired exploration tech demo built with Three.js. Goal: fun and playable as fast as possible — pragmatic code, game feel first. No combat, no objectives; the game *is* traversal: running, climbing anything, and gliding off high places on a stylized island.

## Scope

**In scope**
- Third-person character with run / sprint / jump / climb-any-surface / paraglide
- Stamina system governing sprint, climb, and glide
- Procedural ~1 km² island with beaches, hills, cliffs, one mountain
- Cel-shaded (toon) visual style with outlines
- Day/night cycle (~10 min full cycle)
- Ambient polish: instanced swaying grass, glide wind streaks, sparse ambient audio
- Landmarks: one Sheikah-style climbable tower, two shrine-style ruins
- Keyboard + mouse and gamepad input
- Stamina-wheel HUD, loading screen

**Out of scope**
- Combat, enemies, health
- Swimming (deep water respawns the player on last solid ground)
- Inventory, items, save system
- Mobile/touch support
- World streaming / chunking (single static island)

## Tech Stack

| Concern | Choice |
|---|---|
| Build | Vite |
| Language | TypeScript |
| Rendering | Three.js (vanilla, no React) |
| Physics | `@dimforge/rapier3d-compat` (embedded WASM, no bundler config) |
| Character asset | Free CC0 rigged glb (Quaternius animated character — single rig with idle/walk/run/jump/fall + climb-suitable clips) |
| Audio | WebAudio via Three.js `AudioListener`, a few CC0 files |

## Project Structure

```
botw-clone/
  index.html
  public/assets/        # character glb, audio files
  src/
    main.ts             # boot, loading screen, game loop
    core/               # fixed-timestep loop, input action mapping, time
    world/              # terrain gen, water, props, landmarks, sky
    player/             # state machine, stamina, animation driver
    camera/             # third-person spring-arm camera
    fx/                 # grass instancing, wind streaks
    ui/                 # stamina wheel HUD
    audio/              # ambient/sfx manager
  docs/superpowers/specs/
```

## Architecture

- **Game loop:** fixed-timestep physics at 60 Hz, variable-rate rendering with interpolation.
- **Player state machine:** `Grounded → Airborne → Climbing → Gliding`. Each state owns its movement rules, stamina rules, and animation set. Transitions are explicit (e.g. Airborne + hold-jump → Gliding; Climbing + stamina=0 → Airborne).
- **Input layer:** abstract actions (`move`, `look`, `jump`, `sprint`, `grab`) mapped from keyboard/mouse (pointer lock) and Gamepad API (hot-swap, dead zones). Game code only reads actions, never raw devices.

## World

- **Terrain:** layered simplex noise (fBm) × radial island mask. Visual mesh ~512×512 vertices, vertex-colored by height/slope (sand → grass → rock → snow). Collision: Rapier heightfield collider built from the same heightmap.
- **Water:** animated toon water plane at sea level. Entering deep water triggers a fade and respawn at last grounded position.
- **Props:** GPU-instanced low-poly trees and rocks placed by noise + slope rules; simple primitive colliders (cylinder/sphere) only for trunks/large rocks.
- **Landmarks:** tower (stacked climbable platforms, glide launch at top) and two ruins, assembled from primitives with toon materials and cuboid colliders. Placed at fixed picturesque spots derived from the heightmap (e.g. tower on a mid-island ridge).

## Player Movement

- **Grounded:** Rapier `KinematicCharacterController` on a capsule — slope limits, step offset, snap-to-ground. Walk; sprint drains stamina; jump.
- **Climbing:** triggered by pushing into a steep surface (slope > ~50°). Bypasses the KCC: position follows the wall via raycast surface normals (sticky offset). Stamina drains per second; climb-jump costs a burst; reaching a ledge plays a vault; stamina exhaustion drops the player.
- **Gliding:** hold jump while airborne. Fall speed capped, horizontal steering, continuous stamina drain, FOV widens, wind-streak FX. Release or stamina exhaustion → Airborne.
- **Stamina:** single resource; regenerates when Grounded and not sprinting; exhausted state (wheel flashes red) blocks sprint/climb/glide until ~30% refilled.
- **Animation:** `AnimationMixer` crossfades driven by state machine + speed (idle/walk/run blend, jump, fall, climb loop, glide pose).

## Camera

Third-person orbit camera: pointer-lock mouse or right stick. Spring arm with raycast against terrain/props so it never clips. Slight positional lag for weight; FOV kick when sprinting and gliding.

## Rendering & Atmosphere

- **Toon shading:** `MeshToonMaterial` + 3-step gradient map across the board. Inverted-hull outlines on character and landmarks only (terrain stays clean). Fog color tied to current sky palette.
- **Day/night:** sun and moon directional lights rotate over a ~10-minute cycle. Sky-dome shader lerps dawn/noon/dusk/night palettes; stars fade in at night; light intensity and fog follow.
- **Grass:** instanced blades with vertex-shader wind sway; dense near camera, density falls off with distance; placed only on grass-colored terrain.
- **Audio:** sparse random ambient piano notes (BoTW-style), looping wind during glide, footstep ticks. Crossfade day/night ambience.

## Performance Targets

- 60 fps on a typical desktop GPU.
- Budgets: terrain ≤ ~300k tris, grass via instancing only, props instanced, single shadow-casting light with tuned shadow map.

## Error Handling

- Asset loading: loading screen with progress; a failed asset load shows a readable error overlay instead of a black screen.
- Player escapes (falls through world / out of bounds): watchdog respawns at last grounded position.
- No other defensive layers — it's a local demo.

## Testing & Success Criteria

- `tsc --noEmit` clean; no automated test suite (demo, manual verification).
- Manual playtest checklist:
  1. Spawn on beach, walk/sprint/jump feel responsive (no jitter on slopes).
  2. Climb a cliff and the tower; stamina drains; exhaustion mid-climb drops you.
  3. Glide from the tower across the island; steering and stamina work; landing recovers.
  4. Full day/night cycle plays with sky/light/star transitions.
  5. Gamepad: full play-through of 1–3 with a controller.
  6. 60 fps steady during glide over dense grass.
- **Success:** a friend with no instructions can pick it up and within two minutes is climbing the tower and gliding off, and it feels like BoTW.
