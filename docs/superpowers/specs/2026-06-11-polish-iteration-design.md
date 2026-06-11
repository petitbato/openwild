# BoTW Clone — Polish Iteration Design (v2)

Date: 2026-06-11. Status: approved by user (character/animation approach + full suggestion list selected; sections presented conversationally, user said "ok implémente").

## Goal

Address user feedback on the shipped v1 demo and add ambience polish:
1. Real glide and climb animations (currently faked with Run@0.15+lean and Walk@speed).
2. Music that actually sounds good (currently random pentatonic triangle notes).
3. A more Link-evoking character model (currently three.js Soldier.glb).
4. Varied trees (currently one cylinder+cone shape, two flat colors, 600 identical instances).
5. User-approved suggestions: visible paraglider, climbable natural cliff, campfire + fireflies at ruins at night, drifting toon clouds + shore foam, day/night ambience crossfade, dust/impact particles, birds, grass/wave sounds.

Constraints: no Nintendo IP (stylized evocation only), CC0 assets only (repo stays redistributable), 60 fps maintained, all-synthesized audio (no audio files), TS strict, existing toon pipeline (MeshToonMaterial + shared gradientMap + BackSide outline shells).

## 1. Character & animations

**Model.** KayKit Character Pack: Adventurers (github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0, CC0 1.0), character **Rogue** (hooded adventurer), glTF + 1024² gradient atlas, rigged with bundled animation clips. Replaces `public/assets/character.glb`.

**Asset prep (one-time tools scripts, committed under `tools/`):**
- `tools/fetch-kaykit.mjs` — shallow-clones the repo to a temp dir, locates the Rogue glTF/GLB + atlas texture, copies into `public/assets/`.
- `tools/inspect-glb.mjs` — parses the GLB JSON chunk (no deps), prints animation clip names + bone names. Output drives `src/player/kaykit.ts`, a hand-written manifest module mapping our needs (idle, walk, run, jumpStart, jumpAir, jumpLand, …) to verbatim clip names, plus bone-name constants for the procedural layer. Clip selection happens at prep time, by a human-readable prioritized match (e.g. `/^Idle$/` before `/Idle/`); the runtime never guesses.
- `tools/recolor-atlas.mjs` — decodes the atlas PNG with `pngjs` (devDependency), replaces the Rogue garment palette entries with BoTW-champion blue + accents (exact source swatches read from the inspect step), writes `public/assets/character-atlas.png`. Deterministic; re-runnable.

**CharacterAvatar v2 (`src/player/CharacterAvatar.ts`, same public interface).** Loads the Rogue GLB, applies recolored atlas, toon-swaps materials, adds outline shells. State mapping:
- grounded: Idle / Walk / Run crossfaded by `player.speed` (same blending policy as v1).
- airborne: `jumpStart` (one-shot, on takeoff) → `jumpAir` loop; on landing, `jumpLand` one-shot (short, non-blocking, skipped if a new jump starts).
- climbing & gliding: base = `jumpAir` loop at low weight; procedural layer on top (below).

**Procedural poses (`src/player/ProceduralPoses.ts`).** Applied after `mixer.update()`, overrides selected bone quaternions, with a per-pose weight that fades in/out over 0.15 s (slerp from animated pose toward target pose by weight):
- **Climb**: torso pitched toward wall, 4-beat limb cycle (L-hand+R-foot reach, then R-hand+L-foot). Cycle phase advances with *climbed distance* (`phase += speed * dt * k`), so the pose freezes when stationary and speeds up on climb-jumps.
- **Glide**: both arms raised gripping handles (shoulder + elbow rotations), legs dangling with subtle sin(t) sway; existing forward-lean code retained.
- Pure phase/weight math lives in exported functions, unit-tested (TDD).

**Paraglider (`src/player/Paraglider.ts`).** Procedural toon prop: curved canopy (lathe/scaled-sphere segment, two-tone), wooden frame bars, two handles; outline shell. Parented to the avatar root at chest height (hands grip via the glide pose). Deploys on glide enter (scale/unfold 0.2 s), folds and hides on exit.

## 2. Audio (all synthesized, `src/audio/`)

**Music v2 (`Music.ts`).** Replaces the random-note ambient in AudioManager.
- Piano-like voice: 3–4 sine partials with independent exponential decays, soft 8 ms attack, slight inharmonicity/detune; velocity scales gain and brightness.
- Reverb: `ConvolverNode` with a generated impulse response (decaying noise burst, ~2.5 s, stereo).
- Composed motifs: hand-written note sequences (note, beat, velocity), 2–4 bars each, BoTW-style sparse. Two sets: **day** (brighter, major, mid register) and **night** (slower, minor-leaning, lower register). A scheduler plays one motif every 20–45 s with silence between, ±30 ms humanization. Scheduler + motif selection take an injected RNG and are unit-tested deterministically.

**Ambience (`Ambience.ts`).** Day: sparse synthesized bird chirps (short sine glissandi, random pan/interval). Night: cricket bed (pulsed ~4.2 kHz tone bursts with tremolo). Crossfade weights derived from `sky.time01` (smoothstep around dawn/dusk). Fulfils the v1 spec's unimplemented "crossfade day/night ambience" line.

**Terrain sounds (in AudioManager).** Grass rustle: filtered-noise loop, gain rises with speed when grounded in the grass altitude band (h 2.5–45). Shore waves: slow-LFO filtered-noise loop, gain by proximity to waterline (player terrain height < ~3). Footsteps: bandpass center varies by surface — sand (h < 2.5) duller, grass band softer/higher.

**Wiring.** `audio.update(dt, state, speed)` gains parameters: `time01`, player terrain height. AudioManager orchestrates Music + Ambience + existing wind/footsteps.

## 3. World

**Trees (`src/world/Props.ts` refactor).** Three archetypes, all low-poly toon + outlines, instanced separately:
- *Feuillu*: trunk + 2–3 overlapping icosphere canopy blobs.
- *Conifère*: trunk + 3 stacked cones.
- *Palmier*: tilted segmented trunk + 5–7 flat frond planes; only on beach band (h 0.5–3).
Distribution by altitude (palms beach, feuillus mid, conifers higher), seeded as before. Per-instance variation: `instanceColor` hue/value jitter (canopy + trunk), scale 0.7–1.4, tilt up to ~4°. Cylinder colliders preserved. Rocks unchanged. Placement/filter logic extracted pure + unit-tested.

**Climbable cliff (`src/world/terrain/heightmap.ts` addition).** A radial cliff band carved into the island in one angular sector: between r₁ and r₂ within the sector, height steps up ~18–22 m over a short horizontal run (slope 60–80°), producing a wall face with a walkable plateau on top. Implemented as a pure `cliffBoost(x, z)` term added to the existing height function (smooth angular/radial falloffs; same seed). TDD on the math (slope in band, continuity at edges). Verify spawn search, tower/ruin placement, and grass/tree filters still behave; tune the sector so it doesn't collide with existing landmarks.

**Night life at ruins (`src/world/Campfire.ts`, `src/fx/Fireflies.ts`).** At ruin site #1: log circle + toon flame (2 crossed cone/plane billboards with onBeforeCompile flicker) + warm PointLight with flicker, intensity faded in at night (sky.time01 window) and zero by day. ~40 fireflies: additive `THREE.Points`, Brownian drift within ~15 m of each ruin, soft pulse, night-only.

**Living sky & sea (`src/world/Clouds.ts`, `src/world/ShoreFoam.ts`).** Clouds: 8–12 clusters of flattened toon blobs at 120–180 m, drifting slowly with wrap-around, lightly tinted by sky palette. Foam: shoreline cells extracted from the heightmap (height crossing ≈ waterline), instanced white quads slightly above water, opacity pulsing with the existing wave time.

**Dust & impact particles (`src/fx/Dust.ts`).** Small instanced-quad pool (~64): burst of 8–12 expanding/fading puffs on landing (airborne→grounded with fall speed > threshold), small kicks every ~0.15 s while sprinting on ground. 0.4 s lifetime, toon-flat color.

**Birds (`src/fx/Birds.ts`).** 2–3 flocks of 5–7 two-triangle silhouettes, vertex-flap (cheap), circling waypoints at 60–100 m; occasional synthesized cry routed via Ambience, day only.

## 4. Non-goals

No combat, no swimming, no new mechanics; climbing/gliding physics untouched (only their presentation). No audio files, no texture downloads beyond the KayKit atlas. No mobile support work.

## 5. Architecture & files

```
tools/fetch-kaykit.mjs, tools/inspect-glb.mjs, tools/recolor-atlas.mjs   (asset prep)
public/assets/character.glb (replaced), character-atlas.png (new)
src/player/kaykit.ts (new manifest)         src/player/CharacterAvatar.ts (rewrite)
src/player/ProceduralPoses.ts (new)         src/player/Paraglider.ts (new)
src/audio/Music.ts (new)  src/audio/Ambience.ts (new)  src/audio/AudioManager.ts (rework)
src/world/Props.ts (refactor)               src/world/terrain/heightmap.ts (cliff term)
src/world/Campfire.ts, Clouds.ts, ShoreFoam.ts (new)
src/fx/Fireflies.ts, Dust.ts, Birds.ts (new)
src/main.ts (wiring)
```

Update order in the fixed loop stays as v1; new systems update after grass, before audio. `__debug` gains the new systems.

## 6. Testing & performance

- Unit tests (vitest): pose phase math, music scheduler/motif selection (injected RNG), tree distribution filters, cliff mask slopes/continuity, dust pool lifecycle.
- Browser verification per workstream (same pipeline as v1): synthesized inputs, screenshots day + night, WebAudio spies for music/ambience, perf sampling in the worst scene (gliding over grass near cliff with clouds + birds in view) — 0 frames > 20 ms target, 60 fps.
- Budgets: clouds + foam + dust + birds + fireflies together < 1 ms frame cost; tree archetypes keep ≤ 3 draw calls per archetype part.
