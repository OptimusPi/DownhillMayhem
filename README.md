# Downhill Mayhem

Steep-grade soapbox, contraption, and space-jet downhill derby built on `@pinkaphant/kolmo`, React Three Fiber, and Rapier physics.

## Features

- **820 m Procedural Downhill Chute** ([src/courseMath.ts](./src/courseMath.ts)): Continuous Rapier `TrimeshCollider` road deck, curbs, banked post-and-rail barriers, 122 m elevation drop, tabletop jumps, boost strips, and a finish-bowl arena.
- **12 Playable Contraptions + GLB/USD Importer** ([src/rideGarage.ts](./src/rideGarage.ts)):
  - **8 Soapbox & Derby GLBs**: *Clawfoot Tub*, *Cardboard Rocket* (twin boosters & `[G]` flight), *Shopping Trolley*, *Oak Barrel Rig*, *Pedal Firetruck*, *Gravity Wedge*, *Red Flyer Wagon*, and *Milk Crate Rod* — auto-compiled via `loadOrAutoCompileVehicleGlb` with `KOLMO_emitter` plumes.
  - **3 Parametric Kolmogorov Math Cars & Math Trucks**: *Coupe 86*, *Kei Cargo Van*, and *6x6 Jet Rig*.
  - **1 6-DoF Space Fighter**: *Delta Starfighter* compiled via `compileKhrAssetGlb(..., { archetype: "craft" })`.
  - **In-Game GLB Workbench**: `<GlbImportGate>` modal + drag-and-drop `.glb` / `.gltf` / `.usd*` onto the window to spawn custom rides on course.
- **3 Mounted Launchers (`[1]`, `[2]`, `[3]` + `Click` / `[E]`)**:
  1. **Potato Cannon**: Ballistic potato shots that shatter destructible targets into BVH shards and spin out rivals.
  2. **Suika Orb Launcher**: Launches golden-ratio 3D orbs down the slope that collide and merge (`T0` through `T7`) into giant rolling boulders.
  3. **Cans & Bottles Dropper**: Spawns destructible `garys-beans`, `tris-soda`, `goofy-emoji` cans, and fragile glass bottles using Kolmo `<DestructibleTarget>`.

## Development & Deployment

```bash
npm install
npm run dev
npm run lint
npm run build
npx wrangler deploy
```
