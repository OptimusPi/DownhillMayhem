import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { applySceneRetroMaterials } from "@pinkaphant/kolmo";
import { COURSE_LENGTH_M, TOTAL_TRACK_M, sampleCourse } from "./courseMath";
import { derbyLive, useDerbyStore } from "./derbyStore";

interface RivalSpec {
  readonly index: number;
  readonly id: string;
  readonly glbUrl: string;
  readonly baseSpeedMps: number;
  readonly laneFreq: number;
  readonly laneAmp: number;
  readonly lanePhase: number;
  readonly rubberBand: number;
}

const RIVAL_SPECS: readonly RivalSpec[] = [
  { index: 0, id: "rival-1", glbUrl: "/assets/veh_derby_radio_wagon_1p.glb", baseSpeedMps: 31, laneFreq: 0.7, laneAmp: 3.6, lanePhase: 0.4, rubberBand: 0.25 },
  { index: 1, id: "rival-2", glbUrl: "/assets/veh_derby_cardboard_rocket_1p.glb", baseSpeedMps: 33.5, laneFreq: 0.95, laneAmp: 4.1, lanePhase: 1.7, rubberBand: 0.3 },
  { index: 2, id: "rival-3", glbUrl: "/assets/veh_derby_viking_keg_1p.glb", baseSpeedMps: 29.5, laneFreq: 0.55, laneAmp: 3.2, lanePhase: 2.9, rubberBand: 0.22 },
  { index: 3, id: "rival-4", glbUrl: "/assets/veh_derby_crate_rod_1p.glb", baseSpeedMps: 32, laneFreq: 0.85, laneAmp: 3.9, lanePhase: 4.2, rubberBand: 0.28 },
];

const _q = new THREE.Quaternion();
const _euler = new THREE.Euler();

function RivalCarEntity({ spec }: { readonly spec: RivalSpec }): React.JSX.Element {
  const gltf = useGLTF(spec.glbUrl);
  const cloned = useMemo(() => {
    const c = gltf.scene.clone(true);
    applySceneRetroMaterials(c);
    return c;
  }, [gltf.scene]);

  const rbRef = useRef<RapierRigidBody | null>(null);
  const visualSpinRef = useRef<THREE.Group | null>(null);
  const spinAngleRef = useRef(0);

  useFrame((_, rawDelta) => {
    const dt = Math.min(0.05, Math.max(1e-4, rawDelta));
    const phase = useDerbyStore.getState().phase;
    const rival = derbyLive.rivals[spec.index]!;

    if (phase === "countdown") {
      spinAngleRef.current = 0;
    } else {
      if (rival.spinTimer > 0) {
        rival.spinTimer = Math.max(0, rival.spinTimer - dt);
        spinAngleRef.current += dt * 11;
      } else {
        spinAngleRef.current *= 0.85;
      }

      const gap = derbyLive.playerS - rival.s;
      const targetSpeed =
        rival.s >= COURSE_LENGTH_M + 22
          ? 0
          : Math.max(
              14,
              Math.min(46, spec.baseSpeedMps + gap * spec.rubberBand - (rival.spinTimer > 0 ? 15 : 0)),
            );
      rival.speedMps += (targetSpeed - rival.speedMps) * Math.min(1, dt * 2.5);
      rival.s = Math.min(TOTAL_TRACK_M - 15, rival.s + rival.speedMps * dt);
      rival.lateral =
        Math.sin(derbyLive.raceTimeSec * spec.laneFreq + spec.lanePhase) * spec.laneAmp;
    }

    const sample = sampleCourse(rival.s);
    const wx = sample.position[0] + sample.right[0] * rival.lateral;
    const wy = sample.position[1] + 0.45 + (rival.spinTimer > 0 ? Math.sin(rival.spinTimer * 6) * 0.45 : 0);
    const wz = sample.position[2] + sample.right[2] * rival.lateral;
    rival.pos = [wx, wy, wz];

    if (rbRef.current) {
      rbRef.current.setNextKinematicTranslation({ x: wx, y: wy, z: wz });
      _euler.set(sample.pitch, sample.yaw, 0, "YXZ");
      _q.setFromEuler(_euler);
      rbRef.current.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    }
    if (visualSpinRef.current) {
      visualSpinRef.current.rotation.y = spinAngleRef.current;
    }
  });

  const initialSample = useMemo(() => sampleCourse(derbyLive.rivals[spec.index]?.s ?? 10), [spec.index]);

  return (
    <RigidBody
      ref={rbRef}
      type="kinematicPosition"
      colliders={false}
      position={[initialSample.position[0], initialSample.position[1] + 0.45, initialSample.position[2]]}
      userData={{ rivalId: spec.id, rivalIndex: spec.index }}
    >
      <CuboidCollider args={[0.72, 0.55, 1.3]} />
      <group ref={visualSpinRef}>
        <primitive object={cloned} />
        <mesh position={[0, 1.65, 0]}>
          <octahedronGeometry args={[0.2, 0]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      </group>
    </RigidBody>
  );
}

export function RivalRacers(): React.JSX.Element {
  return (
    <group name="RivalRacers">
      {RIVAL_SPECS.map((spec) => (
        <RivalCarEntity key={spec.id} spec={spec} />
      ))}
    </group>
  );
}
