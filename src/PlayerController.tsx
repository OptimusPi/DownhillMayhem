import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
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
import { buildDerbyRideBytes, getRideSpec } from "./rideGarage";
import { launchSuikaAvalancheOrb, resetSuikaAvalanche, useSuikaAvalancheStore } from "./SuikaAvalanche";

const LAUNCHER_GLB: Record<DerbyWeaponId, string> = {
  potato: "/assets/launcher_potato_cannon.glb",
  suika: "/assets/launcher_paintball_marker.glb",
  junk: "/assets/launcher_water_balloon_slingshot.glb",
};

function RoofLauncherModel({ weapon }: { readonly weapon: DerbyWeaponId }): React.JSX.Element {
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
    <group position={[0, 1.08, 0.15]} scale={[0.95, 0.95, 0.95]}>
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

  const [rideBytes, setRideBytes] = useState<Uint8Array | null>(null);
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
    if (activeRideId === "custom" && customRide) {
      setRideBytes(customRide.bytes);
      return;
    }
    let alive = true;
    const id = activeRideId === "custom" ? "bathtub" : activeRideId;
    void buildDerbyRideBytes(id).then((bytes) => {
      if (alive) setRideBytes(bytes);
    });
    return () => {
      alive = false;
    };
  }, [activeRideId, customRide]);

  // Keyboard shortcuts for weapons + firing + wheel for Suika tier
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
    const locked = st.phase === "countdown";
    if (locked) {
      return {
        forward: false,
        backward: false,
        left: false,
        right: false,
        brake: true,
        boost: false,
      };
    }
    return {
      ...touch,
      // Keep Kolmo's built-in E interact from colliding with our E launcher fire key
      interact: false,
    };
  }, [getTouchInput]);

  const fireActiveWeapon = useCallback(
    (veh: EcctrlVehicleHandle) => {
      const st = useDerbyStore.getState();
      const now = performance.now();
      const cooldown = st.weapon === "potato" ? 210 : st.weapon === "suika" ? 280 : 250;
      if (now - lastShotMsRef.current < cooldown) return;
      lastShotMsRef.current = now;

      _fwd.copy(veh.bodyZAxis).normalize();
      _up.copy(veh.bodyYAxis).normalize();
      const muzzle: [number, number, number] = [
        veh.currPos.x + _fwd.x * 1.45 + _up.x * 1.15,
        veh.currPos.y + _fwd.y * 1.45 + _up.y * 1.15,
        veh.currPos.z + _fwd.z * 1.45 + _up.z * 1.15,
      ];

      if (st.weapon === "potato") {
        derbyAudio.playPotatoThoomp();
        const speed = 58;
        st.spawnPotatoShot({
          id: `spud-${++shotSeq}`,
          origin: muzzle,
          velocity: [
            _fwd.x * speed + veh.currLinVel.x,
            _fwd.y * speed + veh.currLinVel.y + 3.5,
            _fwd.z * speed + veh.currLinVel.z,
          ],
          bornAt: now,
        });

        // Hitscan against DestructibleTargets downrange for instant satisfying BVH shatter!
        _rayDir.copy(_fwd).addScaledVector(_up, 0.04).normalize();
        const handles = targetHandlesRef.current;
        if (handles) {
          let bestId: string | null = null;
          let bestDist = 85;
          handles.forEach((h, id) => {
            const snap = h.getSnapshot();
            if (!snap.alive) return;
            _toTarget.set(snap.position[0] - muzzle[0], snap.position[1] - muzzle[1], snap.position[2] - muzzle[2]);
            const proj = _toTarget.dot(_rayDir);
            if (proj < 0 || proj > bestDist) return;
            _closest.set(muzzle[0], muzzle[1], muzzle[2]).addScaledVector(_rayDir, proj);
            _targetPos.set(snap.position[0], snap.position[1], snap.position[2]);
            if (_closest.distanceTo(_targetPos) <= 2.1) {
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

        // Check rival hit downrange -> hilarious spin-out!
        for (const rival of derbyLive.rivals) {
          _toTarget.set(rival.pos[0] - muzzle[0], rival.pos[1] - muzzle[1], rival.pos[2] - muzzle[2]);
          const proj = _toTarget.dot(_rayDir);
          if (proj > 0 && proj < 75) {
            _closest.set(muzzle[0], muzzle[1], muzzle[2]).addScaledVector(_rayDir, proj);
            _targetPos.set(rival.pos[0], rival.pos[1], rival.pos[2]);
            if (_closest.distanceTo(_targetPos) <= 2.3) {
              rival.spinTimer = 1.9;
              st.addFine(300);
              st.pushCommentary(
                "POTATO SNIPER",
                `DIRECT SPUD HIT ON ${rival.name.toUpperCase()}! +$300 Sportsmanship Fine!`,
                "#facc15",
              );
              break;
            }
          }
        }
      } else if (st.weapon === "suika") {
        derbyAudio.playSuikaLaunch();
        const speed = 28;
        launchSuikaAvalancheOrb(st.suikaTier, muzzle, [
          _fwd.x * speed + veh.currLinVel.x,
          _fwd.y * speed + veh.currLinVel.y + 4.8,
          _fwd.z * speed + veh.currLinVel.z,
        ]);
      } else {
        // Junk dropper: Gary's Beans, Tris' Soda, Goofy Emoji cans & Glass Bottles!
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
            veh.currPos.x + _fwd.x * 3.5,
            veh.currPos.y + 1.4,
            veh.currPos.z + _fwd.z * 3.5,
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
    st.pruneProjectiles(performance.now());

    const veh = vehicleRef.current;
    if (!veh || !veh.body) return;

    // 1. Countdown sequence
    if (st.phase === "countdown") {
      derbyLive.countdownElapsed += dt;
      const rem = Math.max(0, 3 - Math.floor(derbyLive.countdownElapsed));
      if (rem !== lastCountdownBeepRef.current) {
        lastCountdownBeepRef.current = rem;
        st.setCountdownNum(rem);
        derbyAudio.playCountdownBeep(rem === 0);
      }
      // Keep car parked cleanly on the start ramp
      const startSample = sampleCourse(4);
      veh.body.setTranslation({ x: startSample.position[0], y: startSample.position[1] + 0.85, z: startSample.position[2] }, true);
      veh.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      veh.body.setAngvel({ x: 0, y: 0, z: 0 }, true);

      if (derbyLive.countdownElapsed >= 3.0) {
        st.setPhase("racing");
        const mass = Math.max(100, veh.body.mass());
        veh.body.applyImpulse({ x: 0, y: mass * 1.2, z: mass * 14 }, true);
        st.pushCommentary("SPANKY", "NO BRAKES! FIRST ONE TO THE BOTTOM DOESN'T PAY FOR PIZZA!", "#4ade80");
      }
      return;
    }

    // 2. Update race timer & telemetry
    if (st.phase === "racing") {
      derbyLive.raceTimeSec += dt;
    }

    const pos = veh.currPos;
    const vel = veh.currLinVel;
    derbyLive.playerPos = [pos.x, pos.y, pos.z];
    derbyLive.playerForward = [veh.bodyZAxis.x, veh.bodyZAxis.y, veh.bodyZAxis.z];
    derbyLive.playerVel = [vel.x, vel.y, vel.z];
    derbyLive.playerSpeedKmh = Math.hypot(vel.x, vel.y, vel.z) * 3.6;

    const proj = projectToCourse(pos.x, pos.z);
    derbyLive.playerS = proj.s;
    derbyLive.playerElevM = Math.max(0, Math.round(pos.y));

    // Compute live rank against 4 rivals
    let rank = 1;
    for (const r of derbyLive.rivals) {
      if (r.s > derbyLive.playerS) rank++;
    }
    derbyLive.rank = rank;

    // 3. Downhill Tuck Boost [Shift]
    const shiftHeld = keysHeldRef.current.has("ShiftLeft") || keysHeldRef.current.has("ShiftRight") || Boolean(getTouchInput().boost);
    if (shiftHeld && derbyLive.boostCharge > 2 && st.phase === "racing") {
      const mass = Math.max(100, veh.body.mass());
      veh.body.applyImpulse(
        { x: veh.bodyZAxis.x * mass * 16 * dt, y: veh.bodyZAxis.y * mass * 16 * dt, z: veh.bodyZAxis.z * mass * 16 * dt },
        true,
      );
      derbyLive.boostCharge = Math.max(0, derbyLive.boostCharge - 34 * dt);
    } else {
      derbyLive.boostCharge = Math.min(100, derbyLive.boostCharge + 14 * dt);
    }

    // 4. [R] On-track safety recovery if player flies off the mountain or falls below deck
    const rHeld = keysHeldRef.current.has("KeyR");
    if ((rHeld && !lastResetPressedRef.current) || pos.y < proj.sample.position[1] - 12 || Math.abs(proj.lateral) > 48) {
      const safeSample = sampleCourse(Math.max(4, proj.s));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(safeSample.pitch, safeSample.yaw, 0, "YXZ"));
      veh.body.setTranslation(
        { x: safeSample.position[0], y: safeSample.position[1] + 1.4, z: safeSample.position[2] },
        true,
      );
      veh.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      veh.body.setLinvel({ x: safeSample.tangent[0] * 14, y: 0, z: safeSample.tangent[2] * 14 }, true);
      veh.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      st.pushCommentary("TRACK MARSHAL", "Put back on the asphalt! Keep your elbows in the tub!", "#fde047");
    }
    lastResetPressedRef.current = rHeld;

    // 5. Suika boulder knocking over rivals
    const suikaBodies = useSuikaAvalancheStore.getState().bodies;
    for (const [, orbRb] of suikaBodies) {
      try {
        const op = orbRb.translation();
        for (const rival of derbyLive.rivals) {
          if (rival.spinTimer > 0.5) continue;
          const dSq = (op.x - rival.pos[0]) ** 2 + (op.y - rival.pos[1]) ** 2 + (op.z - rival.pos[2]) ** 2;
          if (dSq < 6.5) {
            rival.spinTimer = 2.2;
            st.addFine(400);
            st.pushCommentary("SUIKA STRIKE", `${rival.name} bowled over by a giant Suika orb! +$400!`, "#f472b6");
          }
        }
      } catch {
        // ignore removed body
      }
    }

    // 6. Firing weapon
    if (firePulseRef.current) {
      firePulseRef.current = false;
      fireActiveWeapon(veh);
    }

    // 7. Finish check
    if (st.phase === "racing" && derbyLive.playerS >= COURSE_LENGTH_M) {
      const label =
        activeRideId === "custom" && customRide
          ? customRide.name
          : getRideSpec(activeRideId).name;
      st.finishRace(label);
    }
  });

  const rideSpec = getRideSpec(activeRideId);
  const startFlight = activeRideId === "custom" ? Boolean(customRide?.flightMode) : Boolean(rideSpec.startFlight);
  const spawn = useMemo(() => sampleCourse(4), []);

  return (
    <>
      {rideBytes && (
        <Vehicle
          key={`player-ride-${activeRideId}-${customRide?.name ?? "stock"}-${runNonce}`}
          rawGlbBytes={rideBytes}
          position={[spawn.position[0], spawn.position[1] + 0.9, spawn.position[2]]}
          rotation={[spawn.pitch, spawn.yaw, 0]}
          piloted
          flightMode={startFlight}
          vehicleRef={vehicleRef}
          getInput={getCombinedInput}
        >
          <RoofLauncherModel weapon={weapon} />
        </Vehicle>
      )}
      {projectiles.map((shot) => (
        <PotatoBolt key={shot.id} shot={shot} />
      ))}
    </>
  );
}
