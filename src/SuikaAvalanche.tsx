import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { create } from "zustand";
import { derbyAudio } from "./derbyAudio";
import { useDerbyStore } from "./derbyStore";

export interface SuikaOrbTier {
  readonly id: number;
  readonly name: string;
  readonly radius: number;
  readonly color: string;
  readonly emissive: string;
  readonly mass: number;
  readonly score: number;
  readonly detail: number;
}

export const GOLDEN_RATIO = 1.618;

export const SUIKA_TIERS: readonly SuikaOrbTier[] = [
  { id: 0, name: "Cherry Marble", radius: 0.24, color: "#ff1744", emissive: "#ff5252", mass: 4, score: 50, detail: 0 },
  { id: 1, name: "Tangerine Bomb", radius: 0.39, color: "#ff6d00", emissive: "#ff9100", mass: 9, score: 120, detail: 0 },
  { id: 2, name: "Lemon Ricochet", radius: 0.63, color: "#ffd600", emissive: "#ffea00", mass: 20, score: 250, detail: 1 },
  { id: 3, name: "Lime Bowling Ball", radius: 1.02, color: "#00e676", emissive: "#69f0ae", mass: 46, score: 550, detail: 1 },
  { id: 4, name: "Cerenkov Melon", radius: 1.65, color: "#00e5ff", emissive: "#18ffff", mass: 110, score: 1200, detail: 2 },
  { id: 5, name: "Cobalt Boulder", radius: 2.67, color: "#2979ff", emissive: "#448aff", mass: 260, score: 2600, detail: 2 },
  { id: 6, name: "Violet Planetoid", radius: 4.32, color: "#aa00ff", emissive: "#e040fb", mass: 620, score: 6000, detail: 2 },
  { id: 7, name: "HOA Doom Melon", radius: 6.99, color: "#ff007f", emissive: "#ff4081", mass: 1500, score: 15000, detail: 3 },
];

export interface ActiveSuikaBall {
  readonly id: string;
  readonly tier: number;
  readonly position: [number, number, number];
  readonly velocity: [number, number, number];
}

interface BurstFx {
  readonly id: string;
  readonly position: [number, number, number];
  readonly color: string;
  readonly radius: number;
  readonly bornAt: number;
}

interface SuikaStoreState {
  orbs: ActiveSuikaBall[];
  bursts: BurstFx[];
  bodies: Map<string, RapierRigidBody>;
  spawnOrb: (tier: number, position: [number, number, number], velocity: [number, number, number]) => void;
  mergePair: (idA: string, idB: string, tier: number, midpoint: [number, number, number], avgVel: [number, number, number]) => void;
  clearOrbs: () => void;
  pruneBursts: (now: number) => void;
}

let orbSeq = 1;
const mergingIds = new Set<string>();

export const useSuikaAvalancheStore = create<SuikaStoreState>((set) => ({
  orbs: [],
  bursts: [],
  bodies: new Map(),
  spawnOrb: (tier, position, velocity) =>
    set((s) => {
      const clampedTier = Math.max(0, Math.min(SUIKA_TIERS.length - 1, tier));
      const next: ActiveSuikaBall[] = [
        ...s.orbs,
        { id: `suika-${++orbSeq}`, tier: clampedTier, position, velocity },
      ];
      if (next.length > 34) next.shift();
      return { orbs: next };
    }),
  mergePair: (idA, idB, tier, midpoint, avgVel) =>
    set((s) => {
      const nextTier = Math.min(SUIKA_TIERS.length - 1, tier + 1);
      const spec = SUIKA_TIERS[nextTier]!;
      const filtered = s.orbs.filter((o) => o.id !== idA && o.id !== idB);
      filtered.push({
        id: `suika-${++orbSeq}`,
        tier: nextTier,
        position: [midpoint[0], midpoint[1] + spec.radius * 0.25, midpoint[2]],
        velocity: [avgVel[0], Math.max(avgVel[1], 3.2), avgVel[2]],
      });
      return {
        orbs: filtered,
        bursts: [
          ...s.bursts.slice(-10),
          {
            id: `burst-${orbSeq}`,
            position: midpoint,
            color: spec.color,
            radius: spec.radius,
            bornAt: performance.now(),
          },
        ],
      };
    }),
  clearOrbs: () => {
    mergingIds.clear();
    set({ orbs: [], bursts: [] });
  },
  pruneBursts: (now) =>
    set((s) => {
      if (s.bursts.length === 0) return s;
      const alive = s.bursts.filter((b) => now - b.bornAt < 450);
      return alive.length === s.bursts.length ? s : { bursts: alive };
    }),
}));

export function launchSuikaAvalancheOrb(
  tier: number,
  position: [number, number, number],
  velocity: [number, number, number],
): void {
  useSuikaAvalancheStore.getState().spawnOrb(tier, position, velocity);
}

export function resetSuikaAvalanche(): void {
  useSuikaAvalancheStore.getState().clearOrbs();
}

function SuikaBallEntity({ orb }: { readonly orb: ActiveSuikaBall }): React.JSX.Element {
  const rbRef = useRef<RapierRigidBody | null>(null);
  const spec = SUIKA_TIERS[orb.tier] ?? SUIKA_TIERS[0]!;

  useEffect(() => {
    const bodies = useSuikaAvalancheStore.getState().bodies;
    if (rbRef.current) bodies.set(orb.id, rbRef.current);
    return () => {
      bodies.delete(orb.id);
      mergingIds.delete(orb.id);
    };
  }, [orb.id]);

  const geo = useMemo(() => {
    if (orb.tier === 0) return new THREE.OctahedronGeometry(spec.radius, 0);
    if (orb.tier === 1) return new THREE.DodecahedronGeometry(spec.radius, 0);
    return new THREE.IcosahedronGeometry(spec.radius, spec.detail);
  }, [orb.tier, spec.radius, spec.detail]);

  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <RigidBody
      ref={rbRef}
      type="dynamic"
      colliders={false}
      ccd
      position={orb.position}
      linearVelocity={orb.velocity}
      linearDamping={0.04}
      angularDamping={0.2}
      restitution={0.62}
      friction={0.35}
      userData={{ suikaId: orb.id, suikaTier: orb.tier }}
      onCollisionEnter={({ other }) => {
        const otherData = other.rigidBodyObject?.userData as { suikaId?: string; suikaTier?: number } | undefined;
        if (!otherData?.suikaId || otherData.suikaTier !== orb.tier) return;
        if (orb.tier >= SUIKA_TIERS.length - 1) return;
        if (orb.id >= otherData.suikaId) return; // deterministic single arbiter
        if (mergingIds.has(orb.id) || mergingIds.has(otherData.suikaId)) return;
        const bodyA = rbRef.current;
        const bodyB = other.rigidBody;
        if (!bodyA || !bodyB) return;

        mergingIds.add(orb.id);
        mergingIds.add(otherData.suikaId);
        const pA = bodyA.translation();
        const pB = bodyB.translation();
        const vA = bodyA.linvel();
        const vB = bodyB.linvel();
        const mid: [number, number, number] = [(pA.x + pB.x) * 0.5, (pA.y + pB.y) * 0.5, (pA.z + pB.z) * 0.5];
        const avgV: [number, number, number] = [(vA.x + vB.x) * 0.5, (vA.y + vB.y) * 0.5, (vA.z + vB.z) * 0.5];

        const nextSpec = SUIKA_TIERS[Math.min(SUIKA_TIERS.length - 1, orb.tier + 1)]!;
        derbyAudio.playSuikaMerge(nextSpec.id);
        useDerbyStore.getState().recordSuikaMerge(nextSpec.id, nextSpec.score);
        useSuikaAvalancheStore.getState().mergePair(orb.id, otherData.suikaId, orb.tier, mid, avgV);
      }}
    >
      <BallCollider args={[spec.radius]} mass={spec.mass} restitution={0.62} friction={0.35} />
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial
          color={spec.color}
          emissive={spec.emissive}
          emissiveIntensity={0.45}
          roughness={0.22}
          metalness={0.25}
          flatShading
        />
      </mesh>
    </RigidBody>
  );
}

function BurstRing({ burst }: { readonly burst: BurstFx }): React.JSX.Element {
  const meshRef = useRef<THREE.Mesh | null>(null);
  useFrame(() => {
    const t = Math.min(1, (performance.now() - burst.bornAt) / 450);
    if (meshRef.current) meshRef.current.scale.setScalar(0.6 + t * burst.radius * 2.2);
  });
  return (
    <mesh ref={meshRef} position={burst.position} scale={[0.6, 0.6, 0.6]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color={burst.color} wireframe transparent opacity={0.7} />
    </mesh>
  );
}

export function SuikaAvalanche(): React.JSX.Element {
  const orbs = useSuikaAvalancheStore((s) => s.orbs);
  const bursts = useSuikaAvalancheStore((s) => s.bursts);

  useFrame(() => {
    if (bursts.length > 0) {
      useSuikaAvalancheStore.getState().pruneBursts(performance.now());
    }
  });

  return (
    <group name="SuikaAvalanche">
      {orbs.map((o) => (
        <SuikaBallEntity key={o.id} orb={o} />
      ))}
      {bursts.map((b) => (
        <BurstRing key={b.id} burst={b} />
      ))}
    </group>
  );
}
