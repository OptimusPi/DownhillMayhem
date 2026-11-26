import React, { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, TrimeshCollider } from "@react-three/rapier";
import {
  DestructibleTarget,
  applyRetroMaterial,
  applySceneRetroMaterials,
  type DestructibleTargetHandle,
  type DestructibleTargetSpec,
} from "@pinkaphant/kolmo";
import type { EcctrlVehicleHandle } from "@pinkaphant/ecctrl/vehicle";
import {
  BOOST_PADS,
  COURSE_LENGTH_M,
  HAZARDS,
  SMASH_ZONES,
  buildCourseGeometry,
  sampleCourse,
} from "./courseMath";
import { derbyAudio } from "./derbyAudio";
import { derbyLive, useDerbyStore } from "./derbyStore";
import { SuikaAvalanche, useSuikaAvalancheStore } from "./SuikaAvalanche";

function StaticGlbLandmark({
  url,
  position,
  rotationY,
  scale = 1,
}: {
  readonly url: string;
  readonly position: [number, number, number];
  readonly rotationY: number;
  readonly scale?: number;
}): React.JSX.Element {
  const gltf = useGLTF(url);
  const cloned = useMemo(() => {
    const c = gltf.scene.clone(true);
    applySceneRetroMaterials(c);
    return c;
  }, [gltf.scene]);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
      <primitive object={cloned} />
    </group>
  );
}

function BoostPadStrip({
  s,
  lateral,
}: {
  readonly s: number;
  readonly lateral: number;
}): React.JSX.Element {
  const sample = useMemo(() => sampleCourse(s), [s]);
  const pos: [number, number, number] = [
    sample.position[0] + sample.right[0] * lateral,
    sample.position[1] + 0.08,
    sample.position[2] + sample.right[2] * lateral,
  ];
  return (
    <group position={pos} rotation={[sample.pitch, sample.yaw, 0]}>
      <mesh>
        <boxGeometry args={[3.4, 0.08, 6.2]} />
        <meshBasicMaterial color="#06b6d4" />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[2.2, 0.04, 4.6]} />
        <meshBasicMaterial color="#fde047" />
      </mesh>
    </group>
  );
}

function PineTreeProp({
  position,
  scale,
}: {
  readonly position: [number, number, number];
  readonly scale: number;
}): React.JSX.Element {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.35, 0.55, 3, 6]} />
        <meshStandardMaterial color="#5c3a21" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 4.2, 0]}>
        <coneGeometry args={[2.2, 4.2, 6]} />
        <meshStandardMaterial color="#1b4332" flatShading roughness={0.85} />
      </mesh>
      <mesh position={[0, 6.2, 0]}>
        <coneGeometry args={[1.6, 3.4, 6]} />
        <meshStandardMaterial color="#2d6a4f" flatShading roughness={0.85} />
      </mesh>
    </group>
  );
}

export interface CourseWorldProps {
  readonly targetHandlesRef: React.RefObject<Map<string, DestructibleTargetHandle>>;
  readonly vehicleRef: React.RefObject<EcctrlVehicleHandle | null>;
}

const HAZARD_GLB: Record<string, string> = {
  hydrant: "/assets/obs_fire_hydrant_geyser.glb",
  banana: "/assets/obs_banana_crate_spill.glb",
  manhole: "/assets/obs_manhole_pop_hazard.glb",
  cart: "/assets/obs_shopping_cart_rogue.glb",
};

const SMASH_GLB: Record<string, string> = {
  lemonade: "/assets/obs_lemonade_stand_destructible.glb",
  sawhorse: "/assets/obs_roadwork_sawhorse_barricade.glb",
};

const SMASH_FINES: Record<string, { fine: number; label: string }> = {
  lemonade: { fine: 650, label: "Timmy's Organic Lemonade Stand" },
  sawhorse: { fine: 320, label: "City Roadwork Barricade" },
  beans: { fine: 120, label: "Gary's Beans Stack" },
  soda: { fine: 140, label: "Tris' Soda 6-Pack" },
  emoji: { fine: 150, label: "Sus Canister" },
  bottle: { fine: 95, label: "Artisanal Glass Bottle" },
};

export function CourseWorld({ targetHandlesRef, vehicleRef }: CourseWorldProps): React.JSX.Element {
  const course = useMemo(() => buildCourseGeometry(), []);
  const dynamicJunk = useDerbyStore((s) => s.dynamicJunk);
  const runNonce = useDerbyStore((s) => s.runNonce);
  const hazardCooldownRef = useRef(new Map<string, number>());
  const boostCooldownRef = useRef(new Map<string, number>());

  const roadMat = useMemo(
    () =>
      applyRetroMaterial(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.05 }),
        { flatShading: true },
      ),
    [],
  );
  const wallMat = useMemo(
    () =>
      applyRetroMaterial(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.08 }),
        { flatShading: true },
      ),
    [],
  );
  const terrainMat = useMemo(
    () =>
      applyRetroMaterial(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.02 }),
        { flatShading: true },
      ),
    [],
  );

  useEffect(() => {
    return () => {
      course.roadGeometry.dispose();
      course.wallGeometry.dispose();
      course.terrainGeometry.dispose();
      roadMat.dispose();
      wallMat.dispose();
      terrainMat.dispose();
    };
  }, [course, roadMat, wallMat, terrainMat]);

  // Reset cooldowns on new run
  useEffect(() => {
    hazardCooldownRef.current.clear();
    boostCooldownRef.current.clear();
  }, [runNonce]);

  const registerTarget = useCallback(
    (id: string, handle: DestructibleTargetHandle | null) => {
      if (handle) targetHandlesRef.current.set(id, handle);
      else targetHandlesRef.current.delete(id);
    },
    [targetHandlesRef],
  );

  // Course static + dynamic smash targets
  const courseTargets = useMemo<DestructibleTargetSpec[]>(() => {
    const list: DestructibleTargetSpec[] = [];
    for (const z of SMASH_ZONES) {
      const sample = sampleCourse(z.s);
      const wx = sample.position[0] + sample.right[0] * z.lateral;
      const wy = sample.position[1];
      const wz = sample.position[2] + sample.right[2] * z.lateral;

      if (z.kind === "lemonade" || z.kind === "sawhorse") {
        list.push({
          id: `${z.id}-r${runNonce}`,
          kind: "imported-glb",
          labelId: "target",
          customAlbedoUrl: null,
          canLodMode: "auto",
          position: [wx, wy + 0.55, wz],
          hp: 30,
          maxHp: 30,
          fragile: true,
          shatterPieceCount: 8,
          importedUrl: SMASH_GLB[z.kind]!,
        });
      } else {
        // Stack 3 cans or bottles in a pyramid!
        const labelId =
          z.kind === "beans"
            ? "garys-beans"
            : z.kind === "soda"
              ? "tris-soda"
              : z.kind === "emoji"
                ? "goofy-emoji"
                : "target";
        const kind = z.kind === "bottle" ? "glass-bottle" : "tin-can";
        const offsets: readonly [number, number, number][] = [
          [-0.22, 0.25, 0],
          [0.22, 0.25, 0],
          [0, 0.65, 0],
        ];
        offsets.forEach(([ox, oy, oz], idx) => {
          list.push({
            id: `${z.id}-${idx}-r${runNonce}`,
            kind,
            labelId,
            customAlbedoUrl: null,
            canLodMode: "12-gon",
            position: [wx + ox, wy + oy, wz + oz],
            hp: 15,
            maxHp: 15,
            fragile: true,
            shatterPieceCount: 6,
          });
        });
      }
    }
    return list;
  }, [runNonce]);

  const hazardWorldItems = useMemo(
    () =>
      HAZARDS.map((h) => {
        const s = sampleCourse(h.s);
        return {
          ...h,
          pos: [
            s.position[0] + s.right[0] * h.lateral,
            s.position[1] + 0.05,
            s.position[2] + s.right[2] * h.lateral,
          ] as [number, number, number],
          yaw: s.yaw,
        };
      }),
    [],
  );

  const treeProps = useMemo(() => {
    const out: { pos: [number, number, number]; scale: number }[] = [];
    for (let s = 20; s < COURSE_LENGTH_M + 40; s += 26) {
      const sample = sampleCourse(s);
      for (const side of [-1, 1] as const) {
        const lat = side * (13.5 + ((s * 7 + (side > 0 ? 5 : 11)) % 14));
        out.push({
          pos: [
            sample.position[0] + sample.right[0] * lat,
            sample.position[1] + 0.8,
            sample.position[2] + sample.right[2] * lat,
          ],
          scale: 0.9 + ((s * 13) % 7) * 0.12,
        });
      }
    }
    return out;
  }, []);

  const startSample = useMemo(() => sampleCourse(1.5), []);
  const finishSample = useMemo(() => sampleCourse(COURSE_LENGTH_M), []);
  const podiumSample = useMemo(() => sampleCourse(COURSE_LENGTH_M + 26), []);

  // Proximity check for Boost Pads, Hazards, Vehicle Ram-to-Shatter & Suika Boulder Ram-to-Shatter
  useFrame(() => {
    const veh = vehicleRef.current;
    const body = veh?.body;
    const now = performance.now();
    const px = derbyLive.playerPos[0];
    const py = derbyLive.playerPos[1];
    const pz = derbyLive.playerPos[2];

    if (body && useDerbyStore.getState().phase === "racing") {
      const mass = Math.max(100, body.mass());
      // 1. Boost pads
      for (const bp of BOOST_PADS) {
        const last = boostCooldownRef.current.get(bp.id) ?? 0;
        if (now - last < 1600) continue;
        const s = sampleCourse(bp.s);
        const bx = s.position[0] + s.right[0] * bp.lateral;
        const by = s.position[1];
        const bz = s.position[2] + s.right[2] * bp.lateral;
        const dSq = (px - bx) ** 2 + (py - by) ** 2 + (pz - bz) ** 2;
        if (dSq < 10.5) {
          boostCooldownRef.current.set(bp.id, now);
          body.applyImpulse(
            { x: s.tangent[0] * mass * 11, y: mass * 1.4, z: s.tangent[2] * mass * 11 },
            true,
          );
          derbyLive.boostCharge = Math.min(100, derbyLive.boostCharge + 35);
          derbyAudio.playBoostPad();
          useDerbyStore.getState().pushCommentary("TURBO STRIP", "DOWNHILL NITRO PAD! HANG ON TO YOUR DENTURES!", "#22d3ee");
        }
      }

      // 2. Comedy hazards
      for (const hz of hazardWorldItems) {
        const last = hazardCooldownRef.current.get(hz.id) ?? 0;
        if (now - last < 2500) continue;
        const dSq = (px - hz.pos[0]) ** 2 + (py - hz.pos[1]) ** 2 + (pz - hz.pos[2]) ** 2;
        if (dSq < 4.8) {
          hazardCooldownRef.current.set(hz.id, now);
          if (hz.kind === "hydrant" || hz.kind === "manhole") {
            body.applyImpulse({ x: 0, y: mass * 12.5, z: derbyLive.playerForward[2] * mass * 3 }, true);
            body.applyTorqueImpulse({ x: mass * 2.2, y: 0, z: (Math.random() - 0.5) * mass * 2.5 }, true);
            derbyAudio.playHydrantWhoosh();
            useDerbyStore.getState().addFine(450);
            useDerbyStore.getState().pushCommentary(
              "PUBLIC WORKS",
              hz.kind === "hydrant"
                ? "FIRE HYDRANT GEYSER! +$450 Municipal Water Fine!"
                : "SEWER MANHOLE POP! Free chiropractic adjustment (+$350)!",
              "#38bdf8",
            );
          } else if (hz.kind === "banana") {
            body.applyTorqueImpulse({ x: 0, y: mass * 9.5 * (Math.random() > 0.5 ? 1 : -1), z: 0 }, true);
            derbyAudio.playBananaSlip();
            useDerbyStore.getState().pushCommentary(
              "CARTOON PHYSICS",
              "BANANA CRATE SPILL! Spanky's knees are filing for workers' comp!",
              "#facc15",
            );
          } else {
            body.applyImpulse({ x: (Math.random() - 0.5) * mass * 6, y: mass * 4.5, z: 0 }, true);
            derbyAudio.playShatter("metal");
            useDerbyStore.getState().addFine(250);
            useDerbyStore.getState().pushCommentary(
              "PARKING LOT",
              "ROGUE SHOPPING CART COLLISION! +$250 Grocery Liability!",
              "#fb923c",
            );
          }
        }
      }
    }

    // 3. Vehicle + Suika Boulder Ram-to-Shatter on DestructibleTargets!
    const handles = targetHandlesRef.current;
    if (handles.size > 0) {
      const suikaBodies = useSuikaAvalancheStore.getState().bodies;
      const carSpeed = Math.hypot(derbyLive.playerVel[0], derbyLive.playerVel[1], derbyLive.playerVel[2]);
      handles.forEach((handle, id) => {
        const snap = handle.getSnapshot();
        if (!snap.alive) return;
        const tx = snap.position[0];
        const ty = snap.position[1];
        const tz = snap.position[2];

        // Player car smash check
        if (carSpeed > 3.5) {
          const hitRadiusSq = snap.kind === "imported-glb" ? 7.8 : 4.2;
          const dSq = (px - tx) ** 2 + (py - ty) ** 2 + (pz - tz) ** 2;
          if (dSq <= hitRadiusSq) {
            handle.applyHit({
              targetId: id,
              point: [tx, ty, tz],
              normal: [0, 1, 0],
              impulse: [derbyLive.playerVel[0] * 1.4, 5.5, derbyLive.playerVel[2] * 1.4],
              distance: 0.5,
            });
            return;
          }
        }

        // Suika orb smash check
        for (const [, orbRb] of suikaBodies) {
          try {
            const op = orbRb.translation();
            const dSq = (op.x - tx) ** 2 + (op.y - ty) ** 2 + (op.z - tz) ** 2;
            if (dSq <= 6.2) {
              const ov = orbRb.linvel();
              handle.applyHit({
                targetId: id,
                point: [tx, ty, tz],
                normal: [0, 1, 0],
                impulse: [ov.x * 1.5, 6, ov.z * 1.5],
                distance: 0.5,
              });
              break;
            }
          } catch {
            // body despawned mid-step
          }
        }
      });
    }
  });

  const handleShatter = useCallback((targetId: string) => {
    const key = targetId.includes("lem")
      ? "lemonade"
      : targetId.includes("saw")
        ? "sawhorse"
        : targetId.includes("bean")
          ? "beans"
          : targetId.includes("soda")
            ? "soda"
            : targetId.includes("emoji")
              ? "emoji"
              : "bottle";
    const meta = SMASH_FINES[key] ?? SMASH_FINES.beans!;
    derbyAudio.playShatter(key === "bottle" ? "glass" : key === "lemonade" || key === "sawhorse" ? "wood" : "metal");
    useDerbyStore.getState().recordShatter(meta.fine, meta.label);
  }, []);

  return (
    <group name="DownhillCourseWorld">
      {/* Continuous Downhill Road Trimesh */}
      <RigidBody type="fixed" colliders={false} friction={0.95} restitution={0.04}>
        <TrimeshCollider args={[course.roadVertices, course.roadIndices]} />
        <mesh geometry={course.roadGeometry} material={roadMat} receiveShadow />
      </RigidBody>

      {/* Banked Guardrail Chute Trimesh */}
      <RigidBody type="fixed" colliders={false} friction={0.2} restitution={0.55}>
        <TrimeshCollider args={[course.wallVertices, course.wallIndices]} />
        <mesh geometry={course.wallGeometry} material={wallMat} receiveShadow />
      </RigidBody>

      {/* Catch-all Safety Floor below mountain */}
      <RigidBody type="fixed" colliders={false} position={[0, -18, 450]}>
        <CuboidCollider args={[300, 1, 600]} />
      </RigidBody>

      {/* Scenic Hillside Skirt */}
      <mesh geometry={course.terrainGeometry} material={terrainMat} receiveShadow />

      {/* Pines along the HOA Canyon */}
      {treeProps.map((t, idx) => (
        <PineTreeProp key={idx} position={t.pos} scale={t.scale} />
      ))}

      {/* Start Ramp, Finish Arch, Winners Podium */}
      <StaticGlbLandmark
        url="/assets/derby_start_ramp_3x6.glb"
        position={[startSample.position[0], startSample.position[1] + 0.05, startSample.position[2]]}
        rotationY={startSample.yaw}
        scale={1.8}
      />
      <StaticGlbLandmark
        url="/assets/derby_finish_arch_6x6.glb"
        position={[finishSample.position[0], finishSample.position[1], finishSample.position[2]]}
        rotationY={finishSample.yaw}
        scale={2.4}
      />
      <StaticGlbLandmark
        url="/assets/derby_winners_podium_3x3.glb"
        position={[podiumSample.position[0], podiumSample.position[1] + 0.2, podiumSample.position[2]]}
        rotationY={podiumSample.yaw + Math.PI}
        scale={2.0}
      />

      {/* Boost Strips */}
      {BOOST_PADS.map((bp) => (
        <BoostPadStrip key={bp.id} s={bp.s} lateral={bp.lateral} />
      ))}

      {/* Interactive Hazards */}
      {hazardWorldItems.map((hz) => (
        <group key={hz.id}>
          <StaticGlbLandmark url={HAZARD_GLB[hz.kind]!} position={hz.pos} rotationY={hz.yaw} scale={1.35} />
          {hz.kind === "hydrant" && (
            <mesh position={[hz.pos[0], hz.pos[1] + 3.2, hz.pos[2]]}>
              <cylinderGeometry args={[0.25, 0.55, 6.4, 8]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.42} />
            </mesh>
          )}
        </group>
      ))}

      {/* Course Destructible Lemonade Stands, Sawhorses, Beans/Soda Cans & Bottles */}
      {courseTargets.map((spec) => (
        <DestructibleTarget
          key={spec.id}
          spec={spec}
          registerTarget={registerTarget}
          onShatter={handleShatter}
        />
      ))}

      {/* Player-Dropped Junk Cans & Bottles */}
      {dynamicJunk.map((spec) => (
        <DestructibleTarget
          key={spec.id}
          spec={spec}
          registerTarget={registerTarget}
          onShatter={handleShatter}
        />
      ))}

      {/* Rolling Golden-Ratio Suika Orbs */}
      <SuikaAvalanche />
    </group>
  );
}
