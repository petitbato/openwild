import { describe, expect, it } from 'vitest';
import { Physics, RAPIER } from '../src/physics/Physics';
import { generateTerrain } from '../src/world/terrain/heightmap';
import { buildTerrainMesh } from '../src/world/terrain/TerrainMesh';

describe('physics terrain collider smoke test', () => {
  it('ball dropped at (20,120,20) settles on the terrain surface', async () => {
    const physics = await Physics.create();
    const terrain = generateTerrain(1337);
    const mesh = buildTerrainMesh(terrain);
    physics.addStaticMesh(mesh);

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(20, 120, 20),
    );
    physics.world.createCollider(RAPIER.ColliderDesc.ball(1).setRestitution(0.6), body);

    for (let i = 0; i < 60 * 30; i++) physics.step();

    const p = body.translation();
    const ground = terrain.heightAt(p.x, p.z);
    // ball radius 1 — center should rest ~1m above local terrain, allow slope tolerance
    expect(p.y).toBeGreaterThan(ground - 0.5);
    expect(p.y).toBeLessThan(ground + 3);
    // and it should not have rolled off the island into the void
    expect(p.y).toBeGreaterThan(-10);
  }, 30000);

  it('raycast straight down from above hits terrain at heightAt', async () => {
    const physics = await Physics.create();
    const terrain = generateTerrain(1337);
    const mesh = buildTerrainMesh(terrain);
    physics.addStaticMesh(mesh);
    physics.step(); // query pipeline only picks up new colliders on step

    const hit = physics.raycast({ x: 20, y: 200, z: 20 }, { x: 0, y: -1, z: 0 }, 500);
    expect(hit).not.toBeNull();
    expect(hit!.point.y).toBeCloseTo(terrain.heightAt(20, 20), 1);
    expect(hit!.normal.y).toBeGreaterThan(0);
  }, 30000);
});
