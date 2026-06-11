/**
 * Manifest for the KayKit Rogue asset. Filled by hand from
 * `node tools/inspect-glb.mjs` output — clip/bone names are VERBATIM.
 * If the asset changes, re-run the inspector and update here.
 */
export const MODEL_URL = '/assets/character.glb'; // KayKit Rogue_Hooded.glb (self-contained GLB)
export const ATLAS_URL = '/assets/character-atlas.png';

/** Our animation needs -> verbatim KayKit clip names. */
export const CLIPS = {
  idle: 'Idle',
  walk: 'Walking_A',
  run: 'Running_A',
  jumpStart: 'Jump_Start',
  jumpAir: 'Jump_Idle',
  jumpLand: 'Jump_Land',
} as const;

/** Bones used by the procedural pose layer -> verbatim bone names. */
export const BONES = {
  spine: 'spine',
  head: 'head',
  armL: 'upperarm.l',   // upper arm left
  armR: 'upperarm.r',
  forearmL: 'lowerarm.l',
  forearmR: 'lowerarm.r',
  legL: 'upperleg.l',   // upper leg / thigh left
  legR: 'upperleg.r',
} as const;
