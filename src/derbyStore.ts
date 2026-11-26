import { create } from "zustand";
import type { DestructibleTargetSpec } from "@pinkaphant/kolmo";
import { START_ELEVATION_M } from "./courseMath";
import { derbyAudio } from "./derbyAudio";

export type DerbyRideId =
  | "bathtub"
  | "cardboard_rocket"
  | "shopping_trolley"
  | "viking_keg"
  | "firetruck"
  | "racer_1p"
  | "radio_wagon"
  | "crate_rod"
  | "coupe_86"
  | "kei_van"
  | "starfighter_delta"
  | "six_by_six";

export type DerbyWeaponId = "potato" | "suika" | "junk";
export type RacePhase = "countdown" | "racing" | "finished";

export interface ToastNotice {
  readonly id: number;
  readonly text: string;
  readonly color: string;
  readonly untilMs: number;
}

export interface ActivePotatoShot {
  readonly id: string;
  readonly origin: [number, number, number];
  readonly velocity: [number, number, number];
  readonly bornAt: number;
}

export interface FinishSummary {
  readonly rank: number;
  readonly timeSec: number;
  readonly score: number;
  readonly shatters: number;
  readonly suikaMerges: number;
  readonly bestSuikaTier: number;
  readonly rideLabel: string;
}

export interface RivalLiveState {
  readonly id: string;
  readonly name: string;
  s: number;
  lateral: number;
  speedMps: number;
  spinTimer: number;
  pos: [number, number, number];
}

export const derbyLive = {
  playerPos: [0, START_ELEVATION_M + 0.65, 8] as [number, number, number],
  playerForward: [0, 0, 1] as [number, number, number],
  playerVel: [0, 0, 0] as [number, number, number],
  playerS: 8,
  playerSpeedKmh: 0,
  playerElevM: START_ELEVATION_M,
  raceTimeSec: 0,
  rank: 1,
  boostCharge: 100,
  countdownElapsed: 0,
  rivals: [
    { id: "rival-1", name: "Red Wagon", s: 18, lateral: -3.6, speedMps: 0, spinTimer: 0, pos: [3.6, START_ELEVATION_M, 18] },
    { id: "rival-2", name: "Cardboard Booster", s: 22, lateral: 3.6, speedMps: 0, spinTimer: 0, pos: [-3.6, START_ELEVATION_M, 22] },
    { id: "rival-3", name: "Oak Barrel", s: 14, lateral: -2.6, speedMps: 0, spinTimer: 0, pos: [2.6, START_ELEVATION_M, 14] },
    { id: "rival-4", name: "Crate Rod", s: 15, lateral: 2.6, speedMps: 0, spinTimer: 0, pos: [-2.6, START_ELEVATION_M, 15] },
  ] as RivalLiveState[],
};

export function resetDerbyLive(): void {
  derbyLive.playerPos = [0, START_ELEVATION_M + 0.65, 8];
  derbyLive.playerForward = [0, 0, 1];
  derbyLive.playerVel = [0, 0, 0];
  derbyLive.playerS = 8;
  derbyLive.playerSpeedKmh = 0;
  derbyLive.playerElevM = START_ELEVATION_M;
  derbyLive.raceTimeSec = 0;
  derbyLive.rank = 1;
  derbyLive.boostCharge = 100;
  derbyLive.countdownElapsed = 0;
  const startOffsets = [
    { s: 18, lat: -3.6 },
    { s: 22, lat: 3.6 },
    { s: 14, lat: -2.6 },
    { s: 15, lat: 2.6 },
  ];
  derbyLive.rivals.forEach((r, idx) => {
    const off = startOffsets[idx]!;
    r.s = off.s;
    r.lateral = off.lat;
    r.speedMps = 0;
    r.spinTimer = 0;
    r.pos = [-off.lat, START_ELEVATION_M, off.s];
  });
}

interface DerbyStoreState {
  phase: RacePhase;
  countdownNum: number;
  activeRideId: DerbyRideId | "custom";
  customRide: { name: string; bytes: Uint8Array; flightMode: boolean } | null;
  weapon: DerbyWeaponId;
  suikaTier: number;
  score: number;
  shatters: number;
  suikaMerges: number;
  bestSuikaTier: number;
  toast: ToastNotice | null;
  garageOpen: boolean;
  workshopOpen: boolean;
  muted: boolean;
  runNonce: number;
  finishSummary: FinishSummary | null;
  dynamicJunk: DestructibleTargetSpec[];
  projectiles: ActivePotatoShot[];

  setPhase: (phase: RacePhase) => void;
  setCountdownNum: (n: number) => void;
  selectRide: (id: DerbyRideId) => void;
  setCustomRide: (name: string, bytes: Uint8Array, flightMode: boolean) => void;
  setWeapon: (w: DerbyWeaponId) => void;
  setSuikaTier: (t: number) => void;
  pushToast: (text: string, color?: string) => void;
  addScore: (points: number) => void;
  recordShatter: (points: number, label?: string) => void;
  recordSuikaMerge: (toTier: number, scoreGain: number) => void;
  toggleGarage: (force?: boolean) => void;
  toggleWorkshop: (force?: boolean) => void;
  toggleMute: () => void;
  spawnDynamicJunk: (spec: DestructibleTargetSpec) => void;
  spawnPotatoShot: (shot: ActivePotatoShot) => void;
  pruneTransient: (nowMs: number) => void;
  finishRace: (rideLabel: string) => void;
  restartRace: () => void;
}

let toastSeq = 1;

export const useDerbyStore = create<DerbyStoreState>((set, get) => ({
  phase: "countdown",
  countdownNum: 3,
  activeRideId: "bathtub",
  customRide: null,
  weapon: "potato",
  suikaTier: 1,
  score: 0,
  shatters: 0,
  suikaMerges: 0,
  bestSuikaTier: 0,
  toast: null,
  garageOpen: false,
  workshopOpen: false,
  muted: false,
  runNonce: 1,
  finishSummary: null,
  dynamicJunk: [],
  projectiles: [],

  setPhase: (phase) => set({ phase }),
  setCountdownNum: (countdownNum) => set({ countdownNum }),
  selectRide: (id) => {
    resetDerbyLive();
    set((s) => ({
      activeRideId: id,
      customRide: null,
      garageOpen: false,
      runNonce: s.runNonce + 1,
      phase: "countdown",
      countdownNum: 3,
      finishSummary: null,
      dynamicJunk: [],
      projectiles: [],
      toast: null,
    }));
  },
  setCustomRide: (name, bytes, flightMode) => {
    resetDerbyLive();
    set((s) => ({
      activeRideId: "custom",
      customRide: { name, bytes, flightMode },
      garageOpen: false,
      workshopOpen: false,
      runNonce: s.runNonce + 1,
      phase: "countdown",
      countdownNum: 3,
      finishSummary: null,
      dynamicJunk: [],
      projectiles: [],
      toast: { id: ++toastSeq, text: `Spawned ${name}`, color: "#38bdf8", untilMs: performance.now() + 2200 },
    }));
  },
  setWeapon: (weapon) => set({ weapon }),
  setSuikaTier: (t) => set({ suikaTier: Math.max(0, Math.min(4, t)) }),
  pushToast: (text, color = "#38bdf8") =>
    set({
      toast: { id: ++toastSeq, text, color, untilMs: performance.now() + 2100 },
    }),
  addScore: (points) => set((s) => ({ score: s.score + points })),
  recordShatter: (points, label) =>
    set((s) => ({
      shatters: s.shatters + 1,
      score: s.score + points,
      toast: label
        ? { id: ++toastSeq, text: `${label} +${points}`, color: "#fb923c", untilMs: performance.now() + 1800 }
        : s.toast,
    })),
  recordSuikaMerge: (toTier, scoreGain) =>
    set((s) => ({
      suikaMerges: s.suikaMerges + 1,
      bestSuikaTier: Math.max(s.bestSuikaTier, toTier),
      score: s.score + scoreGain,
      toast: {
        id: ++toastSeq,
        text: `Tier ${toTier} Suika Merge +${scoreGain}`,
        color: "#f472b6",
        untilMs: performance.now() + 2000,
      },
    })),
  toggleGarage: (force) =>
    set((s) => ({ garageOpen: force ?? !s.garageOpen, workshopOpen: false })),
  toggleWorkshop: (force) =>
    set((s) => ({ workshopOpen: force ?? !s.workshopOpen, garageOpen: false })),
  toggleMute: () =>
    set((s) => {
      const next = !s.muted;
      derbyAudio.setMuted(next);
      return { muted: next };
    }),
  spawnDynamicJunk: (spec) =>
    set((s) => {
      const next = [...s.dynamicJunk, spec];
      if (next.length > 28) next.shift();
      return { dynamicJunk: next };
    }),
  spawnPotatoShot: (shot) =>
    set((s) => {
      const next = [...s.projectiles, shot];
      if (next.length > 18) next.shift();
      return { projectiles: next };
    }),
  pruneTransient: (nowMs) => {
    const st = get();
    const nextProj = st.projectiles.length > 0 ? st.projectiles.filter((p) => nowMs - p.bornAt < 2400) : st.projectiles;
    const clearToast = st.toast !== null && nowMs >= st.toast.untilMs;
    if (nextProj.length !== st.projectiles.length || clearToast) {
      set({
        projectiles: nextProj,
        ...(clearToast ? { toast: null } : {}),
      });
    }
  },
  finishRace: (rideLabel) => {
    const s = get();
    if (s.phase === "finished") return;
    const rank = derbyLive.rank;
    const timeSec = derbyLive.raceTimeSec;
    const bonus = Math.max(0, (6 - rank) * 500);
    derbyAudio.playFinishFanfare(rank);
    set({
      phase: "finished",
      score: s.score + bonus,
      finishSummary: {
        rank,
        timeSec,
        score: s.score + bonus,
        shatters: s.shatters,
        suikaMerges: s.suikaMerges,
        bestSuikaTier: s.bestSuikaTier,
        rideLabel,
      },
    });
  },
  restartRace: () => {
    resetDerbyLive();
    set((s) => ({
      phase: "countdown",
      countdownNum: 3,
      score: 0,
      shatters: 0,
      suikaMerges: 0,
      bestSuikaTier: 0,
      finishSummary: null,
      dynamicJunk: [],
      projectiles: [],
      toast: null,
      runNonce: s.runNonce + 1,
    }));
  },
}));
