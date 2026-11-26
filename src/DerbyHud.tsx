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
  if (rank === 1) return "1ST";
  if (rank === 2) return "2ND";
  if (rank === 3) return "3RD";
  return `${rank}TH`;
}

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
  const hoaFineDollars = useDerbyStore((s) => s.hoaFineDollars);
  const shatters = useDerbyStore((s) => s.shatters);
  const suikaMerges = useDerbyStore((s) => s.suikaMerges);
  const commentary = useDerbyStore((s) => s.commentary);
  const garageOpen = useDerbyStore((s) => s.garageOpen);
  const workshopOpen = useDerbyStore((s) => s.workshopOpen);
  const muted = useDerbyStore((s) => s.muted);
  const finishSummary = useDerbyStore((s) => s.finishSummary);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rankRef = useRef<HTMLSpanElement | null>(null);
  const progressTextRef = useRef<HTMLSpanElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<HTMLSpanElement | null>(null);
  const speedRef = useRef<HTMLSpanElement | null>(null);
  const elevRef = useRef<HTMLSpanElement | null>(null);
  const boostBarRef = useRef<HTMLDivElement | null>(null);

  // 60Hz transient DOM updates for telemetry (zero React re-renders!)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (rankRef.current) rankRef.current.textContent = `${ordinal(derbyLive.rank)} / 5`;
      const pct = Math.min(100, Math.max(0, (derbyLive.playerS / COURSE_LENGTH_M) * 100));
      if (progressTextRef.current) {
        progressTextRef.current.textContent = `${Math.round(derbyLive.playerS)}m / ${COURSE_LENGTH_M}m`;
      }
      if (progressBarRef.current) progressBarRef.current.style.width = `${pct.toFixed(1)}%`;
      if (timerRef.current) timerRef.current.textContent = `${derbyLive.raceTimeSec.toFixed(1)}s`;
      if (speedRef.current) speedRef.current.textContent = `${Math.round(derbyLive.playerSpeedKmh)} km/h`;
      if (elevRef.current) elevRef.current.textContent = `Elev ${derbyLive.playerElevM}m`;
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

  const pillBtn: React.CSSProperties = {
    background: "rgba(15, 23, 42, 0.82)",
    color: "#f8fafc",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    backdropFilter: "blur(6px)",
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
        color: "#f8fafc",
      }}
    >
      {/* Hidden GLB/USD File Input */}
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

      {/* Top HUD Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          padding: "12px 14px",
        }}
      >
        {/* Left: Rank, Progress, HOA Fines */}
        <div
          style={{
            pointerEvents: "auto",
            background: "rgba(9, 13, 22, 0.84)",
            border: "1px solid rgba(250, 204, 21, 0.35)",
            borderRadius: 12,
            padding: "10px 14px",
            minWidth: 235,
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <span ref={rankRef} style={{ fontSize: 22, fontWeight: 900, color: "#fde047", letterSpacing: 0.5 }}>
              1ST / 5
            </span>
            <span ref={timerRef} style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", fontVariantNumeric: "tabular-nums" }}>
              0.0s
            </span>
          </div>
          <div style={{ marginTop: 6, height: 7, borderRadius: 99, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
            <div ref={progressBarRef} style={{ width: "0%", height: "100%", background: "linear-gradient(90deg,#f97316,#fde047)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
            <span ref={progressTextRef}>0m / {COURSE_LENGTH_M}m</span>
            <span>{rideTitle}</span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12, fontWeight: 700 }}>
            <span style={{ color: "#fb923c" }}>HOA Fines: ${hoaFineDollars}</span>
            <span style={{ color: "#38bdf8" }}>Smashes: {shatters}</span>
            <span style={{ color: "#f472b6" }}>Merges: {suikaMerges}</span>
          </div>
        </div>

        {/* Center: Title + Live Comedy Commentary */}
        <div style={{ maxWidth: 480, textAlign: "center", flex: 1 }}>
          <div
            style={{
              display: "inline-block",
              background: "rgba(9, 13, 22, 0.8)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 999,
              padding: "4px 14px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1,
              color: "#e2e8f0",
              textTransform: "uppercase",
            }}
          >
            Downhill Mayhem &bull; Grown-Up Little Rascals Derby &rsquo;99
          </div>
          {commentary && (
            <div
              key={commentary.id}
              style={{
                marginTop: 8,
                background: "rgba(15, 23, 42, 0.88)",
                border: `1px solid ${commentary.color}`,
                borderRadius: 10,
                padding: "7px 12px",
                fontSize: 12,
                boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
              }}
            >
              <span style={{ color: commentary.color, fontWeight: 900, marginRight: 6 }}>
                {commentary.speaker}:
              </span>
              <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{commentary.text}</span>
            </div>
          )}
        </div>

        {/* Right: Speed, Boost, Controls */}
        <div
          style={{
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <div
            style={{
              background: "rgba(9, 13, 22, 0.84)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              borderRadius: 12,
              padding: "8px 14px",
              minWidth: 175,
              textAlign: "right",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span ref={elevRef} style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>
                Elev 118m
              </span>
              <span ref={speedRef} style={{ fontSize: 20, fontWeight: 900, color: "#38bdf8", fontVariantNumeric: "tabular-nums" }}>
                0 km/h
              </span>
            </div>
            <div style={{ marginTop: 6, height: 6, borderRadius: 99, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
              <div ref={boostBarRef} style={{ width: "100%", height: "100%", background: "linear-gradient(90deg,#06b6d4,#a855f7)" }} />
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
            <button style={{ ...pillBtn, background: "rgba(234, 88, 12, 0.9)", borderColor: "#fdba74" }} onClick={() => useDerbyStore.getState().toggleGarage()}>
              Garage (12 Rides)
            </button>
            <button style={{ ...pillBtn, background: "rgba(124, 58, 237, 0.85)", borderColor: "#c4b5fd" }} onClick={() => useDerbyStore.getState().toggleWorkshop()}>
              GLB Workbench
            </button>
            <button style={pillBtn} onClick={cycleShader}>
              {SHADER_LABELS[game.retroPreset] ?? game.retroPreset}
            </button>
            <button style={pillBtn} onClick={() => useDerbyStore.getState().toggleMute()}>
              {muted ? "Unmute" : "Sound On"}
            </button>
            <button style={pillBtn} onClick={onRespawnOnTrack}>
              [R] Track Reset
            </button>
            <button style={pillBtn} onClick={() => useDerbyStore.getState().restartRace()}>
              New Race
            </button>
          </div>
        </div>
      </div>

      {/* Big Countdown Overlay */}
      {phase === "countdown" && (
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 78,
              fontWeight: 900,
              color: countdownNum <= 0 ? "#4ade80" : "#fde047",
              textShadow: "0 6px 24px rgba(0,0,0,0.8)",
            }}
          >
            {countdownNum <= 0 ? "NO BRAKES!" : countdownNum}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
            W/S Drive &bull; A/D Steer &bull; Shift Tuck Boost &bull; Click / E Fire Launcher &bull; G Jet Flight
          </div>
        </div>
      )}

      {/* Bottom Weapon & Launcher Hotbar */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          alignItems: "center",
          pointerEvents: "auto",
          background: "rgba(9, 13, 22, 0.86)",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          borderRadius: 12,
          padding: "8px 10px",
          backdropFilter: "blur(8px)",
        }}
      >
        {(
          [
            { id: "potato", key: "1", label: "Spud Cannon", sub: "Shatters & Spins" },
            { id: "suika", key: "2", label: `Suika T${suikaTier}`, sub: suikaSpec.name },
            { id: "junk", key: "3", label: "Junk Dropper", sub: "Beans & Bottles" },
          ] as const satisfies readonly { id: DerbyWeaponId; key: string; label: string; sub: string }[]
        ).map((w) => {
          const active = weapon === w.id;
          return (
            <button
              key={w.id}
              onClick={() => useDerbyStore.getState().setWeapon(w.id)}
              style={{
                background: active ? "rgba(250, 204, 21, 0.22)" : "rgba(30, 41, 59, 0.7)",
                border: active ? "2px solid #fde047" : "1px solid rgba(148,163,184,0.25)",
                borderRadius: 9,
                padding: "6px 12px",
                color: "#f8fafc",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800 }}>
                [{w.key}] {w.label}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{w.sub}</div>
            </button>
          );
        })}

        {weapon === "suika" && (
          <div style={{ display: "flex", gap: 4 }}>
            <button style={pillBtn} onClick={() => useDerbyStore.getState().setSuikaTier(suikaTier - 1)}>
              -
            </button>
            <button style={pillBtn} onClick={() => useDerbyStore.getState().setSuikaTier(suikaTier + 1)}>
              +
            </button>
          </div>
        )}

        <button
          onClick={onFireClick}
          style={{
            background: "linear-gradient(135deg,#ef4444,#f97316)",
            border: "none",
            borderRadius: 9,
            padding: "9px 14px",
            color: "#fff",
            fontWeight: 900,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          FIRE [Click / E]
        </button>
      </div>

      {/* Garage Drawer (12 Rides + GLB/USD Importer) */}
      {garageOpen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(2, 6, 23, 0.78)",
            pointerEvents: "auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "min(960px, 100%)",
              maxHeight: "86vh",
              overflowY: "auto",
              background: "#0f172a",
              border: "2px solid #f59e0b",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: "#fde047" }}>
                  Midlife Crisis Soapbox &amp; Space Jet Garage
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
                  8 CubicWave Derby GLBs + 3 Kolmo Math Cars + Darla&rsquo;s Space Fighter Jet, or drop any .GLB / .USD file!
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{ ...pillBtn, background: "#0284c7", borderColor: "#38bdf8" }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import .GLB / .USD
                </button>
                <button style={pillBtn} onClick={() => useDerbyStore.getState().toggleGarage(false)}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))", gap: 10 }}>
              {DERBY_RIDES.map((r) => {
                const selected = activeRideId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => useDerbyStore.getState().selectRide(r.id)}
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 10,
                      cursor: "pointer",
                      background: selected ? "rgba(245, 158, 11, 0.2)" : "rgba(30, 41, 59, 0.78)",
                      border: selected ? "2px solid #fbbf24" : "1px solid rgba(148,163,184,0.25)",
                      color: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <strong style={{ fontSize: 14, color: "#fde047" }}>{r.name}</strong>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 99, background: "rgba(56,189,248,0.2)", color: "#7dd3fc" }}>
                        {r.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 3 }}>{r.driver}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, lineHeight: 1.35 }}>{r.roast}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Kolmo GLB Importer Workbench Modal */}
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
                style={{ ...pillBtn, background: "#dc2626", borderColor: "#f87171" }}
                onClick={() => useDerbyStore.getState().toggleWorkshop(false)}
              >
                Back to Race
              </button>
            }
          />
        </div>
      )}

      {/* Finish Podium Modal */}
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
              width: "min(460px, 100%)",
              background: "#0f172a",
              border: "2px solid #4ade80",
              borderRadius: 16,
              padding: 24,
              textAlign: "center",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: "#4ade80", letterSpacing: 1 }}>
              FINISH LINE CROSSED
            </div>
            <h2 style={{ margin: "6px 0", fontSize: 34, color: "#fde047" }}>
              {ordinal(finishSummary.rank)} PLACE!
            </h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#cbd5e1", fontStyle: "italic" }}>
              &ldquo;{finishSummary.superlative}&rdquo;
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                background: "rgba(30, 41, 59, 0.7)",
                borderRadius: 10,
                padding: 12,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <div>Time: <strong>{finishSummary.timeSec.toFixed(2)}s</strong></div>
              <div>HOA Fines: <strong style={{ color: "#fb923c" }}>${finishSummary.finesDollars}</strong></div>
              <div>Shatters: <strong style={{ color: "#38bdf8" }}>{finishSummary.shatters}</strong></div>
              <div>Suika Merges: <strong style={{ color: "#f472b6" }}>{finishSummary.suikaMerges}</strong></div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                style={{ ...pillBtn, background: "#16a34a", borderColor: "#4ade80", padding: "10px 18px" }}
                onClick={() => useDerbyStore.getState().restartRace()}
              >
                Race Again
              </button>
              <button
                style={{ ...pillBtn, background: "#ea580c", borderColor: "#fdba74", padding: "10px 18px" }}
                onClick={() => useDerbyStore.getState().toggleGarage(true)}
              >
                Switch Contraption
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drag & Drop Banner */}
      {dragActive && (
        <div
          style={{
            position: "absolute",
            inset: 16,
            border: "3px dashed #fde047",
            borderRadius: 16,
            background: "rgba(15, 23, 42, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 900,
            color: "#fde047",
          }}
        >
          DROP ANY .GLB OR .USD TO RACE IT DOWN THE HILL!
        </div>
      )}
    </div>
  );
}
