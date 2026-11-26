import React, { useCallback, useRef, useState } from "react";
import * as THREE from "three";
import {
  Game,
  RETRO_DREAMCAST,
  type DestructibleTargetHandle,
  type KolmoInputState,
} from "@pinkaphant/kolmo";
import type { EcctrlVehicleHandle } from "@pinkaphant/ecctrl/vehicle";
import { CourseWorld } from "./CourseWorld";
import { projectToCourse, sampleCourse } from "./courseMath";
import { DerbyHud } from "./DerbyHud";
import { useDerbyStore } from "./derbyStore";
import { MobileTouchOverlay } from "./MobileTouchOverlay";
import { PlayerController } from "./PlayerController";
import { ingestCustomDerbyFile } from "./rideGarage";
import { RivalRacers } from "./RivalRacers";

export function App(): React.JSX.Element {
  const targetHandlesRef = useRef(new Map<string, DestructibleTargetHandle>());
  const vehicleRef = useRef<EcctrlVehicleHandle | null>(null);
  const touchInputRef = useRef<Partial<KolmoInputState>>({});
  const firePulseRef = useRef(false);
  const [dragActive, setDragActive] = useState(false);

  const getTouchInput = useCallback(() => touchInputRef.current, []);

  const handleDropAssetFile = useCallback((file: File) => {
    void file.arrayBuffer().then(async (buf) => {
      try {
        const res = await ingestCustomDerbyFile(file.name, buf);
        useDerbyStore.getState().setCustomRide(res.name, res.bytes, res.flightMode);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        useDerbyStore.getState().pushToast(`Import failed: ${msg}`, "#f87171");
      }
    });
  }, []);

  const handleRespawnOnTrack = useCallback(() => {
    const veh = vehicleRef.current;
    if (!veh?.body) return;
    const pos = veh.currPos;
    const proj = projectToCourse(pos.x, pos.z);
    const safeSample = sampleCourse(Math.max(8, proj.s));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(safeSample.pitch, safeSample.yaw, 0, "YXZ"));
    veh.body.setTranslation(
      { x: safeSample.position[0], y: safeSample.position[1] + 1.1, z: safeSample.position[2] },
      true,
    );
    veh.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    veh.body.setLinvel({ x: safeSample.tangent[0] * 14, y: 0, z: safeSample.tangent[2] * 14 }, true);
    veh.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, []);

  return (
    <div
      style={{ position: "relative", width: "100vw", height: "100dvh", overflow: "hidden", touchAction: "none" }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragActive) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleDropAssetFile(f);
      }}
    >
      <Game retro={RETRO_DREAMCAST} skybox="day">
        <CourseWorld targetHandlesRef={targetHandlesRef} vehicleRef={vehicleRef} />
        <RivalRacers />
        <PlayerController
          targetHandlesRef={targetHandlesRef}
          vehicleRef={vehicleRef}
          getTouchInput={getTouchInput}
          firePulseRef={firePulseRef}
        />
      </Game>

      <DerbyHud
        dragActive={dragActive}
        onDropAssetFile={handleDropAssetFile}
        onFireClick={() => {
          firePulseRef.current = true;
        }}
        onRespawnOnTrack={handleRespawnOnTrack}
      />

      <MobileTouchOverlay
        onInputChange={(next) => {
          touchInputRef.current = next;
        }}
        onFire={() => {
          firePulseRef.current = true;
        }}
      />
    </div>
  );
}

export default App;
