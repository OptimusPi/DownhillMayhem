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
  TRACK_HALF_WIDTH,
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

function StartGateArch(): React.JSX.Element {
  const s = useMemo(() => sampleCourse(15), []);
  const span = TRACK_HALF_WIDTH * 2 + 1.2;
  return (
    <group position={s.position} rotation={[0, s.yaw, 0]}>
      <mesh position={[-span * 0.5, 3.2, 0]} castShadow>
        <boxGeometry args={[0.45, 6.4, 0.45]} />
        <meshStandardMaterial color="#334155" flatShading roughness={0.6} />
      </mesh>
      <mesh position={[span * 0.5, 3.2, 0]} castShadow>
        <boxGeometry args={[0.45, 6.4, 0.45]} />
        <meshStandardMaterial color="#334155" flatShading roughness={0.6} />
      </mesh>
      <mesh position={[0, 6.1, 0]} castShadow>
        <boxGeometry args={[span + 0.6, 0.9, 0.5]} />
        <meshStandardMaterial color="#f59e0b" flatShading roughness={0.5} />
      </mesh>
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

const SMASH_POINTS: Record<string, { pts: number; label: string }> = {
  lemonade: { pts: 400, label: "Lemonade Stand" },
  sawhorse: { pts: 250, label: "Barricade" },
  beans: { pts: 100, label: "Gary's Beans" },
  soda: { pts: 120, label: "Tris' Soda" },
  emoji: { pts: 120, label: "Tin Can" },
  bottle: { pts: 90, label: "Glass Bottle" },
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
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.88,
          metalness: 0.05,
          side: THREE.DoubleSide,
        }),
        { flatShading: true },
      ),
    [],
  );
  const wallMat = useMemo(
    () =>
      applyRetroMaterial(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.82,
          metalness: 0.08,
          side: THREE.DoubleSide,
        }),
        { flatShading: true },
      ),
    [],
  );
  const terrainMat = useMemo(
    () =>
      applyRetroMaterial(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.96,
          metalness: 0.02,
          side: THREE.DoubleSide,
        }),
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
    for (let s = 0; s < COURSE_LENGTH_M + 40; s += 22) {
      const sample = sampleCourse(s);
      for (const side of [-1, 1] as const) {
        const lat = side * (12.5 + ((s * 7 + (side > 0 ? 5 : 11)) % 16));
        out.push({
          pos: [
            sample.position[0] + sample.right[0] * lat,
            sample.position[1] + 0.4,
            sample.position[2] + sample.right[2] * lat,
          ],
          scale: 0.95 + ((s * 13) % 7) * 0.14,
        });
      }
    }
    return out;
  }, []);

  const startRampSample = useMemo(() => sampleCourse(-4.5), []);
  const finishSample = useMemo(() => sampleCourse(COURSE_LENGTH_M), []);
  const podiumSample = useMemo(() => sampleCourse(COURSE_LENGTH_M + 28), []);

  useFrame(() => {
    const veh = vehicleRef.current;
    const body = veh?.body;
    const now = performance.now();
    const px = derbyLive.playerPos[0];
    const py = derbyLive.playerPos[1];
    const pz = derbyLive.playerPos[2];

    if (body && useDerbyStore.getState().phase === "racing") {
      const mass = Math.max(100, body.mass());
      for (const bp of BOOST_PADS) {
        const last = boostCooldownRef.current.get(bp.id) ?? 0;
        if (now - last < 1600) continue;
        const s = sampleCourse(bp.s);
        const bx = s.position[0] + s.right[0] * bp.lateral;
        const by = s.position[1];
        const bz = s.position[2] + s.right[2] * bp.lateral;
        const dSq = (px - bx) ** 2 + (py - by) ** 2 + (pz - bz) ** 2;
        if (dSq < 11) {
          boostCooldownRef.current.set(bp.id, now);
          body.applyImpulse(
            { x: s.tangent[0] * mass * 10, y: mass * 0.8, z: s.tangent[2] * mass * 10 },
            true,
          );
          derbyLive.boostCharge = Math.min(100, derbyLive.boostCharge + 35);
          derbyAudio.playBoostPad();
          useDerbyStore.getState().addScore(150);
          useDerbyStore.getState().pushToast("Nitro Pad +150", "#22d3ee");
        }
      }

      for (const hz of hazardWorldItems) {
        const last = hazardCooldownRef.current.get(hz.id) ?? 0;
        if (now - last < 2500) continue;
        const dSq = (px - hz.pos[0]) ** 2 + (py - hz.pos[1]) ** 2 + (pz - hz.pos[2]) ** 2;
        if (dSq < 4.8) {
          hazardCooldownRef.current.set(hz.id, now);
          if (hz.kind === "hydrant" || hz.kind === "manhole") {
            body.applyImpulse({ x: 0, y: mass * 11, z: derbyLive.playerForward[2] * mass * 3 }, true);
            derbyAudio.playHydrantWhoosh();
            useDerbyStore.getState().pushToast(
              hz.kind === "hydrant" ? "Hydrant Geyser Launch!" : "Manhole Pop!",
              "#38bdf8",
            );
          } else if (hz.kind === "banana") {
            body.applyTorqueImpulse({ x: 0, y: mass * 7.5 * (Math.random() > 0.5 ? 1 : -1), z: 0 }, true);
            derbyAudio.playBananaSlip();
            useDerbyStore.getState().pushToast("Banana Spinout!", "#facc15");
          } else {
            body.applyImpulse({ x: (Math.random() - 0.5) * mass * 5, y: mass * 3.5, z: 0 }, true);
            derbyAudio.playShatter("metal");
            useDerbyStore.getState().pushToast("Rogue Cart Impact!", "#fb923c");
          }
        }
      }
    }

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

        if (carSpeed > 3.2) {
          const hitRadiusSq = snap.kind === "imported-glb" ? 8.2 : 4.5;
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
            // body removed
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
    const meta = SMASH_POINTS[key] ?? SMASH_POINTS.beans!;
    derbyAudio.playShatter(key === "bottle" ? "glass" : key === "lemonade" || key === "sawhorse" ? "wood" : "metal");
    useDerbyStore.getState().recordShatter(meta.pts, meta.label);
  }, []);

  return (
    <group name="DownhillCourseWorld">
      <RigidBody type="fixed" colliders={false} friction={0.95} restitution={0.04}>
        <TrimeshCollider args={[course.roadVertices, course.roadIndices]} />
        <mesh geometry={course.roadGeometry} material={roadMat} receiveShadow />
      </RigidBody>

      <RigidBody type="fixed" colliders={false} friction={0.2} restitution={0.55}>
        <TrimeshCollider args={[course.wallVertices, course.wallIndices]} />
        <mesh geometry={course.wallGeometry} material={wallMat} receiveShadow />
      </RigidBody>

      <RigidBody type="fixed" colliders={false} position={[0, -24, 450]}>
        <CuboidCollider args={[300, 1, 600]} />
      </RigidBody>

      <mesh geometry={course.terrainGeometry} material={terrainMat} receiveShadow />

      {treeProps.map((t, idx) => (
        <PineTreeProp key={idx} position={t.pos} scale={t.scale} />
      ))}

      <StartGateArch />
      <StaticGlbLandmark
        url="/assets/derby_start_ramp_3x6.glb"
        position={[startRampSample.position[0], startRampSample.position[1], startRampSample.position[2]]}
        rotationY={startRampSample.yaw}
        scale={1.5}
      />
      <StaticGlbLandmark
        url="/assets/derby_finish_arch_6x6.glb"
        position={[finishSample.position[0], finishSample.position[1], finishSample.position[2]]}
        rotationY={finishSample.yaw}
        scale={2.4}
      />
      <StaticGlbLandmark
        url="/assets/derby_winners_podium_3x3.glb"
        position={[podiumSample.position[0], podiumSample.position[1] + 0.15, podiumSample.position[2]]}
        rotationY={podiumSample.yaw + Math.PI}
        scale={2.0}
      />

      {BOOST_PADS.map((bp) => (
        <BoostPadStrip key={bp.id} s={bp.s} lateral={bp.lateral} />
      ))}

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

      {courseTargets.map((spec) => (
        <DestructibleTarget
          key={spec.id}
          spec={spec}
          registerTarget={registerTarget}
          onShatter={handleShatter}
        />
      ))}

      {dynamicJunk.map((spec) => (
        <DestructibleTarget
          key={spec.id}
          spec={spec}
          registerTarget={registerTarget}
          onShatter={handleShatter}
        />
      ))}

      <SuikaAvalanche />
    </group>
  );
}
