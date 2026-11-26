# Downhill Mayhem

**Grown-Up Little Rascals Soapbox Derby '99** — built on `@pinkaphant/kolmo` (published on npm), React Three Fiber, and Rapier physics.

The crew from the cul-de-sac hit their 40s, kept zero health insurance, and decided to run the 820 m **Dead Man's HOA Hill** again — this time with potato cannons, golden-ratio Suika orb avalanches, destructible lemonade stands, math-generated PaperShell cars, and an illegal delta space fighter jet.

## Features

- **820 m Procedural Downhill Mountain Course** ([src/courseMath.ts](./src/courseMath.ts)): Continuous Rapier `TrimeshCollider` road deck & banked guardrails dropping 118 m through S-curves, two kicker ramps, 6 nitro strips, and a finish-bowl bowling pit.
- **12 Playable Contraptions + Drag-and-Drop GLB/USD Importer** ([src/rideGarage.ts](./src/rideGarage.ts)):
  - **8 Derby GLBs**: *Porcelain Panic* (Bathtub), *Cardboard Apollo* (Rocket Box with twin boosters & `[G]` flight), *Costco Express* (Shopping Trolley), *Valhalla Keg*, *HOA Fire Marshal*, *The Blur 2.0*, *Midlife Radio Flyer*, and *Milk Crate Hot Rod* — auto-compiled at runtime via `loadOrAutoCompileVehicleGlb` with `KOLMO_emitter` boost plumes.
  - **3 Kolmo Math PaperShell Vehicles**: *Spanky's Paid-Off Coupe* (`coupe_86`), *Dad-Bod Kei Van* (`kei_van`), and *6x6 HOA Nightmare* (6WD + twin jet boosters).
  - **1 Fighter Space Jet**: *Darla's Fighter Space Jet* compiled via `compileKhrAssetGlb(..., { archetype: "craft" })`.
  - **In-Game GLB Workbench**: Built-in `<GlbImportGate>` modal + drag-and-drop `.glb` / `.gltf` / `.usd*` onto the window to race anything down the hill.
- **3 Rooftop Launchers (`[1]`, `[2]`, `[3]` + `Click` / `[E]`)**:
  1. **Spud Cannon**: Fires physical potatoes + raycasts BVH shatter hits on destructible targets and spins out rivals.
  2. **Suika Avalanche Launcher**: Fires golden-ratio 3D orbs down the hill that collide and merge (`T00 Cherry Marble` through `T07 HOA Doom Melon`), smashing cans, stands, and rivals.
  3. **Junk Dropper**: Drops destructible `GARY'S BEANS` cans, `TRIS' SODA` cans, `goofy-emoji` cans, and fragile glass bottles using Kolmo `<DestructibleTarget>`.
- **4 AI Rivals & Comedy Hazards** ([src/RivalRacers.tsx](./src/RivalRacers.tsx), [src/CourseWorld.tsx](./src/CourseWorld.tsx)): Fire hydrant geysers, banana crate spills, popping manholes, rogue shopping carts, destructible lemonade stands & roadwork barricades, and live HOA fine tracking.

## Local Development

```bash
npm install
npm run dev
```

## Build & Deploy to Cloudflare Workers

```bash
npm run lint
npm run build
npx wrangler deploy
```
