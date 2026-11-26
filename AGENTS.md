# Downhill Mayhem — Agent & Contributor Guide

- **Pinned Stack**: Resolve `@pinkaphant/kolmo` (`^0.4.5`) and `@khr3/*` from npm with `"@pinkaphant/ecctrl": "2.0.4-beta.4"`, `"@dimforge/rapier3d-compat": "0.19.2"`, and `"three": "0.184.0"` pinned in `dependencies` and `overrides`, bundled via `@pinkaphant/kolmo/vite`.
- **Vehicles & Physics**: Drive the 12 contraptions, parametric Kolmogorov math cars & math trucks (`Coupe 86`, `Kei Cargo Van`, `6x6 Jet Rig`), and `Delta Starfighter` through `<Vehicle>` / `<KhrVehicle>` on `@pinkaphant/ecctrl@2.0.4-beta.4` over the continuous `TrimeshCollider` downhill chute.
- **UX & Hygiene**: Use `100dvh`, `viewport-fit=cover`, `env(safe-area-inset-*)`, `canvas { touch-action: none; }`, `0.08` virtual stick deadzone, `>= 44x44 px` touch buttons, `requestAnimationFrame` DOM-ref HUD updates, and `<= 250`-line modules. Verify with `npm run lint && npm run build`.
