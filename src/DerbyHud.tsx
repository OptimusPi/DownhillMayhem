import React, { useEffect, useRef } from "react";
import {
  GlbImportGate,
  RETRO_PRESETS,
  useKolmoGame,
  type GateWorldPayload,
} from "@pinkaphant/kolmo";
import { COURSE_LENGTH_M } from "./courseMath";
import { derbyLive, useDerbyStore, type DerbyWeaponId } from "./derbyStore";
import { DERBY_RIDES, getRideSpec } from "./rideGarage";
import { SUIKA_TIERS } from "./SuikaAvalanche";

const SHADER_LABELS: Record<string, string> = {
  dreamcast: "Dreamcast",
  "psx-plus": "PSX Plus",
  "ps2-shinobi": "PS2 Shinobi",
  "clean-hd": "Clean HD",
};

function ordinal(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

const panelStyle: React.CSSProperties = {
  boxSizing: "border-box",
  background: "rgba(9, 13, 24, 0.84)",
  border: "1px solid rgba(56, 189, 248, 0.32)",
  borderRadius: 10,
  padding: "9px 12px",
  color: "#f1f5f9",
  backdropFilter: "blur(6px)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

const btnBase: React.CSSProperties = {
  boxSizing: "border-box",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  color: "#e2e8f0",
  background: "rgba(30, 41, 59, 0.88)",
  touchAction: "none",
  userSelect: "none",
};

export interface DerbyHudProps {
  readonly dragActive: boolean;
  readonly onDropAssetFile: (file: File) => void;
  readonly onFireClick: () => void;
  readonly onRespawnOnTrack: () => void;
}

export function DerbyHud({
  dragActive,
  onDropAssetFile,
  onFireClick,
  onRespawnOnTrack,
}: DerbyHudProps): React.JSX.Element {
  const game = useKolmoGame();
  const phase = useDerbyStore((s) => s.phase);
  const countdownNum = useDerbyStore((s) => s.countdownNum);
  const activeRideId = useDerbyStore((s) => s.activeRideId);
  const customRide = useDerbyStore((s) => s.customRide);
  const weapon = useDerbyStore((s) => s.weapon);
  const suikaTier = useDerbyStore((s) => s.suikaTier);
  const score = useDerbyStore((s) => s.score);
  const shatters = useDerbyStore((s) => s.shatters);
  const suikaMerges = useDerbyStore((s) => s.suikaMerges);
  const toast = useDerbyStore((s) => s.toast);
  const garageOpen = useDerbyStore((s) => s.garageOpen);
  const workshopOpen = useDerbyStore((s) => s.workshopOpen);
  const muted = useDerbyStore((s) => s.muted);
  const finishSummary = useDerbyStore((s) => s.finishSummary);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const telemetryRef = useRef<HTMLSpanElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const boostBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0;
    let prevText = "";
    const tick = () => {
      const kmh = Math.round(derbyLive.playerSpeedKmh);
      const dist = Math.round(derbyLive.playerS);
      const line = `${ordinal(derbyLive.rank)}/5 · ${kmh} km/h · ${dist}/${COURSE_LENGTH_M} m · ${derbyLive.raceTimeSec.toFixed(1)}s`;
      if (line !== prevText && telemetryRef.current) {
        telemetryRef.current.textContent = line;
        prevText = line;
      }
      const pct = Math.min(100, Math.max(0, (derbyLive.playerS / COURSE_LENGTH_M) * 100));
      if (progressBarRef.current) progressBarRef.current.style.width = `${pct.toFixed(1)}%`;
      if (boostBarRef.current) boostBarRef.current.style.width = `${Math.round(derbyLive.boostCharge)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const currentRide = getRideSpec(activeRideId);
  const rideTitle = activeRideId === "custom" && customRide ? customRide.name : currentRide.name;
  const suikaSpec = SUIKA_TIERS[suikaTier] ?? SUIKA_TIERS[0]!;

  const cycleShader = () => {
    const ids = RETRO_PRESETS.map((p) => p.id);
    const idx = ids.indexOf(game.retroPreset);
    game.setRetroPreset(ids[(idx + 1) % ids.length]!);
  };

  const handleWorkshopSpawn = (payload: GateWorldPayload) => {
    const flight = payload.bundle.propellers.length > 0 && payload.bundle.wheels.length === 0;
    useDerbyStore.getState().setCustomRide(payload.label || "Workbench Craft", payload.glbBytes, flight);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 25,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
        color: "#f8fafc",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf,.usd,.usda,.usdc,.usdz"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onDropAssetFile(f);
          e.target.value = "";
        }}
      />

      {/* Top-Left Compact Bar (Longline style) */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          alignItems: "flex-start",
          maxWidth: "calc(100vw - 24px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", pointerEvents: "auto" }}>
          <span
            style={{
              background: "rgba(9, 13, 24, 0.9)",
              border: "1px solid rgba(250, 204, 21, 0.45)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: 800,
              color: "#fde047",
              whiteSpace: "nowrap",
            }}
          >
            Downhill Mayhem
          </span>
          <span
            ref={telemetryRef}
            style={{
              background: "rgba(9, 13, 24, 0.86)",
              border: "1px solid rgba(56, 189, 248, 0.32)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: 600,
              color: "#e2e8f0",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            1st/5 · 0 km/h · 8/{COURSE_LENGTH_M} m · 0.0s
          </span>
          <button
            type="button"
            style={{ ...btnBase, borderColor: "#f59e0b", color: "#fde047" }}
            onClick={() => useDerbyStore.getState().toggleGarage()}
          >
            Rides: {rideTitle}
          </button>
          <button
            type="button"
            style={{ ...btnBase, borderColor: "#818cf8", color: "#c7d2fe" }}
            onClick={() => useDerbyStore.getState().toggleWorkshop()}
          >
            GLB Workbench
          </button>
          <button type="button" style={btnBase} onClick={cycleShader}>
            Shader: {SHADER_LABELS[game.retroPreset] ?? game.retroPreset}
          </button>
          <button type="button" style={btnBase} onClick={onRespawnOnTrack}>
            [R] Reset
          </button>
          <button type="button" style={btnBase} onClick={() => useDerbyStore.getState().toggleMute()}>
            Sound: {muted ? "Off" : "On"}
          </button>
          <button type="button" style={btnBase} onClick={() => useDerbyStore.getState().restartRace()}>
            Restart
          </button>
        </div>

        {/* Compact Progress + Boost + Score Card */}
        <div style={{ ...panelStyle, width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "#cbd5e1" }}>
            <span>Score: <strong style={{ color: "#fde047" }}>{score}</strong></span>
            <span>Shatters: <strong style={{ color: "#fb923c" }}>{shatters}</strong></span>
            <span>Merges: <strong style={{ color: "#f472b6" }}>{suikaMerges}</strong></span>
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#94a3b8", width: 34 }}>Course</span>
            <div style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
              <div ref={progressBarRef} style={{ width: "0%", height: "100%", background: "linear-gradient(90deg,#f97316,#fde047)" }} />
            </div>
          </div>
          <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#94a3b8", width: 34 }}>Boost</span>
            <div style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
              <div ref={boostBarRef} style={{ width: "100%", height: "100%", background: "linear-gradient(90deg,#06b6d4,#38bdf8)" }} />
            </div>
          </div>
        </div>

        {/* Brief Auto-Fading Event Toast */}
        {toast && (
          <div
            key={toast.id}
            style={{
              background: "rgba(9, 13, 24, 0.88)",
              border: `1px solid ${toast.color}`,
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 700,
              color: toast.color,
            }}
          >
            {toast.text}
          </div>
        )}
      </div>

      {/* Countdown */}
      {phase === "countdown" && (
        <div
          style={{
            position: "absolute",
            top: "32%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: countdownNum <= 0 ? "#4ade80" : "#fde047",
              textShadow: "0 4px 20px rgba(0,0,0,0.75)",
            }}
          >
            {countdownNum <= 0 ? "GO!" : countdownNum}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", textShadow: "0 2px 8px rgba(0,0,0,0.85)" }}>
            W/S Drive · A/D Steer · Shift Boost · Click / E Fire · G Flight
          </div>
        </div>
      )}

      {/* Bottom Launcher Hotbar */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
          alignItems: "center",
          pointerEvents: "auto",
          background: "rgba(9, 13, 24, 0.86)",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          borderRadius: 10,
          padding: "6px 8px",
          backdropFilter: "blur(6px)",
        }}
      >
        {(
          [
            { id: "potato", key: "1", label: "Potato Cannon", sub: "Ballistic shatter" },
            { id: "suika", key: "2", label: `Suika T${suikaTier}`, sub: suikaSpec.name },
            { id: "junk", key: "3", label: "Cans & Bottles", sub: "Drop targets" },
          ] as const satisfies readonly { id: DerbyWeaponId; key: string; label: string; sub: string }[]
        ).map((w) => {
          const active = weapon === w.id;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => useDerbyStore.getState().setWeapon(w.id)}
              style={{
                background: active ? "rgba(2, 132, 199, 0.34)" : "rgba(30, 41, 59, 0.72)",
                border: active ? "1px solid #38bdf8" : "1px solid rgba(148,163,184,0.25)",
                borderRadius: 7,
                padding: "5px 10px",
                color: "#f8fafc",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700 }}>
                [{w.key}] {w.label}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{w.sub}</div>
            </button>
          );
        })}

        {weapon === "suika" && (
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" style={btnBase} onClick={() => useDerbyStore.getState().setSuikaTier(suikaTier - 1)}>
              -
            </button>
            <button type="button" style={btnBase} onClick={() => useDerbyStore.getState().setSuikaTier(suikaTier + 1)}>
              +
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onFireClick}
          style={{
            background: "#ea580c",
            border: "1px solid #fdba74",
            borderRadius: 7,
            padding: "8px 12px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Fire [Click / E]
        </button>
      </div>

      {/* Rides Popover */}
      {garageOpen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(2, 6, 23, 0.75)",
            pointerEvents: "auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "min(900px, 100%)",
              maxHeight: "84vh",
              overflowY: "auto",
              background: "#0f172a",
              border: "1px solid rgba(56, 189, 248, 0.45)",
              borderRadius: 12,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, color: "#f8fafc" }}>
                  Select Contraption (12 Rides)
                </h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8" }}>
                  8 soapbox GLBs, 3 procedural PaperShell vehicles, and 1 6-DoF space fighter — or import any .GLB / .USD.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  style={{ ...btnBase, background: "#0284c7", borderColor: "#38bdf8" }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import .GLB / .USD
                </button>
                <button type="button" style={btnBase} onClick={() => useDerbyStore.getState().toggleGarage(false)}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(205px, 1fr))", gap: 8 }}>
              {DERBY_RIDES.map((r) => {
                const selected = activeRideId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => useDerbyStore.getState().selectRide(r.id)}
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderRadius: 8,
                      cursor: "pointer",
                      background: selected ? "rgba(2, 132, 199, 0.28)" : "rgba(30, 41, 59, 0.78)",
                      border: selected ? "1px solid #38bdf8" : "1px solid rgba(148,163,184,0.22)",
                      color: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <strong style={{ fontSize: 13, color: "#f8fafc" }}>{r.name.trim()}</strong>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 99, background: "rgba(56,189,248,0.18)", color: "#7dd3fc" }}>
                        {r.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 5, lineHeight: 1.35 }}>{r.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Kolmo GLB Importer Workbench */}
      {workshopOpen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 40,
            background: "#020617",
            pointerEvents: "auto",
          }}
        >
          <GlbImportGate
            onSpawnInWorld={handleWorkshopSpawn}
            headerAction={
              <button
                type="button"
                style={{ ...btnBase, background: "#dc2626", borderColor: "#f87171" }}
                onClick={() => useDerbyStore.getState().toggleWorkshop(false)}
              >
                Back to Course
              </button>
            }
          />
        </div>
      )}

      {/* Finish Summary */}
      {phase === "finished" && finishSummary && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(2, 6, 23, 0.72)",
            pointerEvents: "auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "min(420px, 100%)",
              background: "#0f172a",
              border: "1px solid #4ade80",
              borderRadius: 12,
              padding: 22,
              textAlign: "center",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", letterSpacing: 1 }}>
              RUN COMPLETE · {finishSummary.rideLabel.toUpperCase()}
            </div>
            <h2 style={{ margin: "6px 0 14px", fontSize: 30, color: "#fde047" }}>
              {ordinal(finishSummary.rank)} Place
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                background: "rgba(30, 41, 59, 0.7)",
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <div>Time: <strong>{finishSummary.timeSec.toFixed(2)}s</strong></div>
              <div>Score: <strong style={{ color: "#fde047" }}>{finishSummary.score}</strong></div>
              <div>Shatters: <strong style={{ color: "#fb923c" }}>{finishSummary.shatters}</strong></div>
              <div>Suika Merges: <strong style={{ color: "#f472b6" }}>{finishSummary.suikaMerges}</strong></div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                type="button"
                style={{ ...btnBase, background: "#16a34a", borderColor: "#4ade80", padding: "8px 16px" }}
                onClick={() => useDerbyStore.getState().restartRace()}
              >
                Run Again
              </button>
              <button
                type="button"
                style={{ ...btnBase, background: "#0284c7", borderColor: "#38bdf8", padding: "8px 16px" }}
                onClick={() => useDerbyStore.getState().toggleGarage(true)}
              >
                Switch Ride
              </button>
            </div>
          </div>
        </div>
      )}

      {dragActive && (
        <div
          style={{
            position: "absolute",
            inset: 16,
            border: "2px dashed #38bdf8",
            borderRadius: 12,
            background: "rgba(15, 23, 42, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 800,
            color: "#7dd3fc",
          }}
        >
          Drop .GLB or .USD to spawn on course
        </div>
      )}
    </div>
  );
}
