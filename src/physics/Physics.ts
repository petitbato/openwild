import RAPIER from '@dimforge/rapier3d-compat';
import type * as THREE from 'three';

export { RAPIER };

export class Physics {
  private constructor(public world: RAPIER.World) {}

  static async create(): Promise<Physics> {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 60;
    return new Physics(world);
  }

  step(): void { this.world.step(); }

  /** Static trimesh collider from any Three mesh geometry (terrain, landmarks). */
  addStaticMesh(mesh: THREE.Mesh): RAPIER.Collider {
    const geo = mesh.geometry.index ? mesh.geometry : mesh.geometry.toNonIndexed();
    mesh.updateWorldMatrix(true, false);
    const src = geo.attributes.position.array as Float32Array;
    const vertices = new Float32Array(src.length);
    const v = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < src.length; i += 3) {
      // bake world transform so collider matches the rendered mesh
      const e = mesh.matrixWorld.elements;
      v.x = src[i]; v.y = src[i + 1]; v.z = src[i + 2];
      vertices[i] = e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12];
      vertices[i + 1] = e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13];
      vertices[i + 2] = e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14];
    }
    let indices: Uint32Array;
    if (geo.index) {
      indices = new Uint32Array(geo.index.array);
    } else {
      indices = new Uint32Array(src.length / 3);
      for (let i = 0; i < indices.length; i++) indices[i] = i;
    }
    return this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES),
    );
  }

  /** Raycast helper. Returns hit point + normal or null. */
  raycast(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    maxToi: number,
    excludeCollider?: RAPIER.Collider,
  ): { point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number }; toi: number } | null {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, maxToi, true, undefined, undefined, excludeCollider);
    if (!hit) return null;
    const p = ray.pointAt(hit.timeOfImpact);
    return { point: { x: p.x, y: p.y, z: p.z }, normal: hit.normal, toi: hit.timeOfImpact };
  }
}
