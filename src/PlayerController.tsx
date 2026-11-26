import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { loadKhrGlb, type KhrAssetBundle } from "@khr3/core";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { BallCollider, RigidBody } from "@react-three/rapier";
import {
  Vehicle,
  applySceneRetroMaterials,
  type DestructibleTargetHandle,
  type KolmoInputState,
} from "@pinkaphant/kolmo";
import type { EcctrlVehicleHandle } from "@pinkaphant/ecctrl/vehicle";
import { COURSE_LENGTH_M, projectToCourse, sampleCourse } from "./courseMath";
import { derbyAudio } from "./derbyAudio";
import {
  derbyLive,
  resetDerbyLive,
  useDerbyStore,
  type ActivePotatoShot,
  type DerbyWeaponId,
} from "./derbyStore";
import { buildDerbyRideBundle, getRideSpec } from "./rideGarage";
import { launchSuikaAvalancheOrb, resetSuikaAvalanche, useSuikaAvalancheStore } from "./SuikaAvalanche";

const LAUNCHER_GLB: Record<DerbyWeaponId, string> = {
  potato: "/assets/launcher_potato_cannon.glb",
  suika: "/assets/launcher_paintball_marker.glb",
  junk: "/assets/launcher_water_balloon_slingshot.glb",
};

function HoodLauncherMount({ weapon }: { readonly weapon: DerbyWeaponId }): React.JSX.Element {
  const gPotato = useGLTF(LAUNCHER_GLB.potato);
  const gSuika = useGLTF(LAUNCHER_GLB.suika);
  const gJunk = useGLTF(LAUNCHER_GLB.junk);

  const cloned = useMemo(() => {
    const src = weapon === "potato" ? gPotato.scene : weapon === "suika" ? gSuika.scene : gJunk.scene;
    const c = src.clone(true);
    applySceneRetroMaterials(c);
    return c;
  }, [weapon, gPotato.scene, gSuika.scene, gJunk.scene]);

  return (
    <group position={[0.34, 0.56, 0.35]} scale={[0.52, 0.52, 0.52]}>
      <primitive object={cloned} />
    </group>
  );
}

function PotatoBolt({ shot }: { readonly shot: ActivePotatoShot }): React.JSX.Element {
  return (
    <RigidBody
      type="dynamic"
      ccd
      colliders={false}
      position={shot.origin}
      linearVelocity={shot.velocity}
      restitution={0.45}
      friction={0.4}
    >
      <BallCollider args={[0.2]} mass={3.5} />
      <mesh castShadow>
        <dodecahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color="#d97706" emissive="#b45309" emissiveIntensity={0.25} flatShading roughness={0.85} />
      </mesh>
    </RigidBody>
  );
}

export interface PlayerControllerProps {
  readonly targetHandlesRef: React.RefObject<Map<string, DestructibleTargetHandle>>;
  readonly vehicleRef: React.RefObject<EcctrlVehicleHandle | null>;
  readonly getTouchInput: () => Partial<KolmoInputState>;
  readonly firePulseRef: React.MutableRefObject<boolean>;
}

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _targetPos = new THREE.Vector3();

let shotSeq = 1;
let junkSeq = 1;

interface LoadedPlayerRide {
  readonly matchKey: string;
  readonly bundle: KhrAssetBundle;
  readonly bytes: Uint8Array;
  readonly flightMode: boolean;
}

export function PlayerController({
  targetHandlesRef,
  vehicleRef,
  getTouchInput,
  firePulseRef,
}: PlayerControllerProps): React.JSX.Element {
  const { gl } = useThree();
  const activeRideId = useDerbyStore((s) => s.activeRideId);
  const customRide = useDerbyStore((s) => s.customRide);
  const runNonce = useDerbyStore((s) => s.runNonce);
  const weapon = useDerbyStore((s) => s.weapon);
  const projectiles = useDerbyStore((s) => s.projectiles);

  const currentMatchKey = `${activeRideId}:${customRide?.name ?? ""}`;
  const [loadedRide, setLoadedRide] = useState<LoadedPlayerRide | null>(null);
  const lastShotMsRef = useRef(0);
  const lastCountdownBeepRef = useRef(4);
  const lastResetPressedRef = useRef(false);
  const keysHeldRef = useRef(new Set<string>());

  useEffect(() => {
    resetDerbyLive();
    resetSuikaAvalanche();
    lastCountdownBeepRef.current = 4;
  }, [runNonce]);

  useEffect(() => {
    let alive = true;
    const matchKey = `${activeRideId}:${customRide?.name ?? ""}`;
    if (activeRideId === "custom" && customRide) {
      const ab = customRide.bytes.buffer.slice(
        customRide.bytes.byteOffset,
        customRide.bytes.byteOffset + customRide.bytes.byteLength,
      ) as ArrayBuffer;
      void loadKhrGlb(ab).then((bundle) => {
        if (alive) {
          setLoadedRide({
            matchKey,
            bundle,
            bytes: customRide.bytes,
            flightMode: customRide.flightMode,
          });
        }
      });
      return () => {
        alive = false;
      };
    }

    const id = activeRideId === "custom" ? "bathtub" : activeRideId;
    void buildDerbyRideBundle(id).then((compiled) => {
      if (alive) {
        setLoadedRide({
          matchKey,
          bundle: compiled.bundle,
          bytes: compiled.bytes,
          flightMode: compiled.flightMode,
        });
      }
    });
    return () => {
      alive = false;
    };
  }, [activeRideId, customRide]);

  useEffect(() => {
    const dom = gl.domElement;
    const onKeyDown = (e: KeyboardEvent) => {
      derbyAudio.unlock();
      keysHeldRef.current.add(e.code);
      if (e.code === "Digit1") useDerbyStore.getState().setWeapon("potato");
      else if (e.code === "Digit2") useDerbyStore.getState().setWeapon("suika");
      else if (e.code === "Digit3") useDerbyStore.getState().setWeapon("junk");
      else if (e.code === "KeyE") firePulseRef.current = true;
      else if (e.code === "Tab") {
        e.preventDefault();
        useDerbyStore.getState().toggleGarage();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      derbyAudio.unlock();
      firePulseRef.current = true;
    };
    const onWheel = (e: WheelEvent) => {
      const st = useDerbyStore.getState();
      if (st.weapon === "suika" && !st.garageOpen && !st.workshopOpen) {
        st.setSuikaTier(st.suikaTier + (e.deltaY > 0 ? -1 : 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [gl, firePulseRef]);

  const getCombinedInput = useCallback((): Partial<KolmoInputState> => {
    const touch = getTouchInput();
    const st = useDerbyStore.getState();
    if (st.phase === "countdown") {
      return {
        forward: false,
        backward: false,
        left: false,
        right: false,
        brake: true,
        boost: false,
        interact: false,
      };
    }
    return {
      ...touch,
      interact: false,
    };
  }, [getTouchInput]);

  const fireActiveWeapon = useCallback(
    (veh: EcctrlVehicleHandle) => {
      const st = useDerbyStore.getState();
      const now = performance.now();
      const cooldown = st.weapon === "potato" ? 210 : st.weapon === "suika" ? 270 : 240;
      if (now - lastShotMsRef.current < cooldown) return;
      lastShotMsRef.current = now;

      _fwd.copy(veh.bodyZAxis).normalize();
      _up.copy(veh.bodyYAxis).normalize();
      const muzzle: [number, number, number] = [
        veh.currPos.x + _fwd.x * 1.65 + _up.x * 0.85,
        veh.currPos.y + _fwd.y * 1.65 + _up.y * 0.85,
        veh.currPos.z + _fwd.z * 1.65 + _up.z * 0.85,
      ];

      if (st.weapon === "potato") {
        derbyAudio.playPotatoThoomp();
        const speed = 60;
        st.spawnPotatoShot({
          id: `spud-${++shotSeq}`,
          origin: muzzle,
          velocity: [
            _fwd.x * speed + veh.currLinVel.x,
            _fwd.y * speed + veh.currLinVel.y + 3.0,
            _fwd.z * speed + veh.currLinVel.z,
          ],
          bornAt: now,
        });

        _rayDir.copy(_fwd).addScaledVector(_up, 0.03).normalize();
        const handles = targetHandlesRef.current;
        if (handles) {
          let bestId: string | null = null;
          let bestDist = 90;
          handles.forEach((h, id) => {
            const snap = h.getSnapshot();
            if (!snap.alive) return;
            _toTarget.set(snap.position[0] - muzzle[0], snap.position[1] - muzzle[1], snap.position[2] - muzzle[2]);
            const proj = _toTarget.dot(_rayDir);
            if (proj < 0 || proj > bestDist) return;
            _closest.set(muzzle[0], muzzle[1], muzzle[2]).addScaledVector(_rayDir, proj);
            _targetPos.set(snap.position[0], snap.position[1], snap.position[2]);
            if (_closest.distanceTo(_targetPos) <= 2.2) {
              bestDist = proj;
              bestId = id;
            }
          });
          if (bestId) {
            const h = handles.get(bestId);
            if (h) {
              _closest.set(muzzle[0], muzzle[1], muzzle[2]).addScaledVector(_rayDir, bestDist);
              h.applyHit({
                targetId: bestId,
                point: [_closest.x, _closest.y, _closest.z],
                normal: [-_rayDir.x, -_rayDir.y, -_rayDir.z],
                impulse: [_rayDir.x * 18, _rayDir.y * 18 + 3, _rayDir.z * 18],
                distance: bestDist,
              });
            }
          }
        }

        for (const rival of derbyLive.rivals) {
          _toTarget.set(rival.pos[0] - muzzle[0], rival.pos[1] - muzzle[1], rival.pos[2] - muzzle[2]);
          const proj = _toTarget.dot(_rayDir);
          if (proj > 0 && proj < 75) {
            _closest.set(muzzle[0], muzzle[1], muzzle[2]).addScaledVector(_rayDir, proj);
            _targetPos.set(rival.pos[0], rival.pos[1], rival.pos[2]);
            if (_closest.distanceTo(_targetPos) <= 2.3) {
              rival.spinTimer = 1.9;
              st.addScore(250);
              st.pushToast(`Spud Hit: ${rival.name} +250`, "#facc15");
              break;
            }
          }
        }
      } else if (st.weapon === "suika") {
        derbyAudio.playSuikaLaunch();
        const speed = 28;
        launchSuikaAvalancheOrb(st.suikaTier, muzzle, [
          _fwd.x * speed + veh.currLinVel.x,
          _fwd.y * speed + veh.currLinVel.y + 4.5,
          _fwd.z * speed + veh.currLinVel.z,
        ]);
      } else {
        derbyAudio.playSuikaLaunch();
        const cycle = junkSeq % 4;
        const kind = cycle === 3 ? "glass-bottle" : "tin-can";
        const labelId =
          cycle === 0
            ? "garys-beans"
            : cycle === 1
              ? "tris-soda"
              : cycle === 2
                ? "goofy-emoji"
                : "target";
        st.spawnDynamicJunk({
          id: `dyn-junk-${++junkSeq}`,
          kind,
          labelId,
          customAlbedoUrl: null,
          canLodMode: "12-gon",
          position: [
            veh.currPos.x + _fwd.x * 4.2,
            veh.currPos.y + 1.2,
            veh.currPos.z + _fwd.z * 4.2,
          ],
          hp: 15,
          maxHp: 15,
          fragile: true,
          shatterPieceCount: 6,
        });
      }
    },
    [targetHandlesRef],
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(0.05, Math.max(1e-4, rawDelta));
    const st = useDerbyStore.getState();
    st.pruneTransient(performance.now());

    const veh = vehicleRef.current;
    if (!veh || !veh.body) return;

    const pos = veh.currPos;
    const vel = veh.currLinVel;
    derbyLive.playerPos = [pos.x, pos.y, pos.z];
    derbyLive.playerForward = [veh.bodyZAxis.x, veh.bodyZAxis.y, veh.bodyZAxis.z];
    derbyLive.playerVel = [vel.x, vel.y, vel.z];
    derbyLive.playerSpeedKmh = Math.hypot(vel.x, vel.y, vel.z) * 3.6;

    const proj = projectToCourse(pos.x, pos.z);
    derbyLive.playerS = Math.max(0, proj.s);
    derbyLive.playerElevM = Math.max(0, Math.round(pos.y));

    if (st.phase === "countdown") {
      derbyLive.countdownElapsed += dt;
      const rem = Math.max(0, 3 - Math.floor(derbyLive.countdownElapsed));
      if (rem !== lastCountdownBeepRef.current) {
        lastCountdownBeepRef.current = rem;
        st.setCountdownNum(rem);
        derbyAudio.playCountdownBeep(rem === 0);
      }
      if (derbyLive.countdownElapsed >= 2.6) {
        st.setPhase("racing");
        const mass = Math.max(100, veh.body.mass());
        veh.body.applyImpulse(
          {
            x: spawn.tangent[0] * mass * 3.5,
            y: spawn.tangent[1] * mass * 3.5,
            z: spawn.tangent[2] * mass * 3.5,
          },
          true,
        );
      }
      return;
    }

    if (st.phase === "racing") {
      derbyLive.raceTimeSec += dt;
    }

    let rank = 1;
    for (const r of derbyLive.rivals) {
      if (r.s > derbyLive.playerS) rank++;
      // Soft bumper check so ramming a rival spins them out instead of hitting a kinematic brick wall
      if (r.spinTimer <= 0.4) {
        const dSq = (pos.x - r.pos[0]) ** 2 + (pos.y - r.pos[1]) ** 2 + (pos.z - r.pos[2]) ** 2;
        if (dSq < 5.2 && derbyLive.playerSpeedKmh > 18) {
          r.spinTimer = 1.6;
          st.addScore(150);
          st.pushToast(`Bumped ${r.name} +150`, "#facc15");
        }
      }
    }
    derbyLive.rank = rank;

    const shiftHeld =
      keysHeldRef.current.has("ShiftLeft") ||
      keysHeldRef.current.has("ShiftRight") ||
      Boolean(getTouchInput().boost);
    if (shiftHeld && derbyLive.boostCharge > 2 && st.phase === "racing") {
      const mass = Math.max(100, veh.body.mass());
      const isFlightMode = Boolean(readyRide?.flightMode);
      const boostY = isFlightMode
        ? veh.bodyZAxis.y * mass * 14 * dt
        : (Math.min(0, veh.bodyZAxis.y * 0.5) - 0.18) * mass * 12 * dt;
      veh.body.applyImpulse(
        {
          x: veh.bodyZAxis.x * mass * 12 * dt,
          y: boostY,
          z: veh.bodyZAxis.z * mass * 12 * dt,
        },
        true,
      );
      derbyLive.boostCharge = Math.max(0, derbyLive.boostCharge - 32 * dt);
    } else {
      derbyLive.boostCharge = Math.min(100, derbyLive.boostCharge + 14 * dt);
    }

    const rHeld = keysHeldRef.current.has("KeyR");
    if (
      (rHeld && !lastResetPressedRef.current) ||
      pos.y < proj.sample.position[1] - 10 ||
      Math.abs(proj.lateral) > 45
    ) {
      const safeSample = sampleCourse(Math.max(8, proj.s));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(safeSample.pitch, safeSample.yaw, 0, "YXZ"));
      veh.body.setTranslation(
        { x: safeSample.position[0], y: safeSample.position[1] + 1.1, z: safeSample.position[2] },
        true,
      );
      veh.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      veh.body.setLinvel({ x: safeSample.tangent[0] * 14, y: 0, z: safeSample.tangent[2] * 14 }, true);
      veh.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    lastResetPressedRef.current = rHeld;

    const suikaBodies = useSuikaAvalancheStore.getState().bodies;
    for (const [, orbRb] of suikaBodies) {
      try {
        const op = orbRb.translation();
        for (const rival of derbyLive.rivals) {
          if (rival.spinTimer > 0.5) continue;
          const dSq = (op.x - rival.pos[0]) ** 2 + (op.y - rival.pos[1]) ** 2 + (op.z - rival.pos[2]) ** 2;
          if (dSq < 6.5) {
            rival.spinTimer = 2.2;
            st.addScore(300);
            st.pushToast(`Suika Strike: ${rival.name} +300`, "#f472b6");
          }
        }
      } catch {
        // ignore removed body
      }
    }

    if (firePulseRef.current) {
      firePulseRef.current = false;
      fireActiveWeapon(veh);
    }

    if (st.phase === "racing" && derbyLive.playerS >= COURSE_LENGTH_M) {
      const label =
        activeRideId === "custom" && customRide
          ? customRide.name
          : getRideSpec(activeRideId).name;
      st.finishRace(label);
    }
  });

  const spawn = useMemo(() => sampleCourse(8), []);
  const readyRide = loadedRide?.matchKey === currentMatchKey ? loadedRide : null;
  const spawnLift = readyRide?.flightMode ? 1.5 : 0.12;
  const showHoodLauncher = activeRideId !== "starfighter_delta" && !readyRide?.flightMode;

  return (
    <>
      {readyRide && (
        <Vehicle
          key={`veh-${readyRide.matchKey}-${runNonce}`}
          bundle={readyRide.bundle}
          rawGlbBytes={readyRide.bytes}
          position={[spawn.position[0], spawn.position[1] + spawnLift, spawn.position[2]]}
          rotation={[spawn.pitch, spawn.yaw, 0]}
          piloted
          flightMode={readyRide.flightMode}
          angularDamping={1.65}
          linearDamping={0.08}
          vehicleRef={vehicleRef}
          getInput={getCombinedInput}
        >
          {showHoodLauncher && <HoodLauncherMount weapon={weapon} />}
        </Vehicle>
      )}
      {projectiles.map((shot) => (
        <PotatoBolt key={shot.id} shot={shot} />
      ))}
    </>
  );
}
