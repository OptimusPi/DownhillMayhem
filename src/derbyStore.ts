import { create } from "zustand";
import type { DestructibleTargetSpec } from "@pinkaphant/kolmo";
import { COURSE_LENGTH_M, START_ELEVATION_M } from "./courseMath";
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

export interface CommentaryLine {
  readonly id: number;
  readonly speaker: string;
  readonly text: string;
  readonly color: string;
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
  readonly finesDollars: number;
  readonly shatters: number;
  readonly suikaMerges: number;
  readonly bestSuikaTier: number;
  readonly rideLabel: string;
  readonly superlative: string;
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
  playerPos: [0, START_ELEVATION_M + 1.2, 4] as [number, number, number],
  playerForward: [0, 0, 1] as [number, number, number],
  playerVel: [0, 0, 0] as [number, number, number],
  playerS: 4,
  playerSpeedKmh: 0,
  playerElevM: START_ELEVATION_M,
  raceTimeSec: 0,
  rank: 1,
  boostCharge: 100,
  airTimeSec: 0,
  countdownElapsed: 0,
  rivals: [
    { id: "rival-waldo", name: "Waldo (Hedge-Fund Tub)", s: 8, lateral: -3.2, speedMps: 0, spinTimer: 0, pos: [0, START_ELEVATION_M, 8] },
    { id: "rival-alfalfa", name: "Alfalfa (Duct-Tape Rocket)", s: 7, lateral: 3.1, speedMps: 0, spinTimer: 0, pos: [0, START_ELEVATION_M, 7] },
    { id: "rival-buckwheat", name: "Buckwheat (BBQ Keg)", s: 5.5, lateral: -1.6, speedMps: 0, spinTimer: 0, pos: [0, START_ELEVATION_M, 5.5] },
    { id: "rival-spanky", name: "Spanky (CPA Crate Rod)", s: 6.2, lateral: 1.7, speedMps: 0, spinTimer: 0, pos: [0, START_ELEVATION_M, 6.2] },
  ] as RivalLiveState[],
};

export function resetDerbyLive(): void {
  derbyLive.playerPos = [0, START_ELEVATION_M + 1.2, 4];
  derbyLive.playerForward = [0, 0, 1];
  derbyLive.playerVel = [0, 0, 0];
  derbyLive.playerS = 4;
  derbyLive.playerSpeedKmh = 0;
  derbyLive.playerElevM = START_ELEVATION_M;
  derbyLive.raceTimeSec = 0;
  derbyLive.rank = 1;
  derbyLive.boostCharge = 100;
  derbyLive.airTimeSec = 0;
  derbyLive.countdownElapsed = 0;
  const startOffsets = [
    { s: 8, lat: -3.2 },
    { s: 7, lat: 3.1 },
    { s: 5.5, lat: -1.6 },
    { s: 6.2, lat: 1.7 },
  ];
  derbyLive.rivals.forEach((r, idx) => {
    const off = startOffsets[idx]!;
    r.s = off.s;
    r.lateral = off.lat;
    r.speedMps = 0;
    r.spinTimer = 0;
    r.pos = [off.lat, START_ELEVATION_M, off.s];
  });
}

interface DerbyStoreState {
  phase: RacePhase;
  countdownNum: number;
  activeRideId: DerbyRideId | "custom";
  customRide: { name: string; bytes: Uint8Array; flightMode: boolean } | null;
  weapon: DerbyWeaponId;
  suikaTier: number;
  hoaFineDollars: number;
  shatters: number;
  suikaMerges: number;
  bestSuikaTier: number;
  combo: number;
  commentary: CommentaryLine | null;
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
  pushCommentary: (speaker: string, text: string, color?: string) => void;
  addFine: (dollars: number) => void;
  recordShatter: (fineDollars: number, label?: string) => void;
  recordSuikaMerge: (toTier: number, scoreGain: number) => void;
  toggleGarage: (force?: boolean) => void;
  toggleWorkshop: (force?: boolean) => void;
  toggleMute: () => void;
  spawnDynamicJunk: (spec: DestructibleTargetSpec) => void;
  spawnPotatoShot: (shot: ActivePotatoShot) => void;
  pruneProjectiles: (nowMs: number) => void;
  finishRace: (rideLabel: string) => void;
  restartRace: () => void;
}

let commentSeq = 1;

function pickSuperlative(rank: number, fines: number, shatters: number, merges: number): string {
  if (fines >= 4000) return "Most Wanted by the Oakridge Estates HOA";
  if (merges >= 3) return "Certified Suika Avalanche Menace";
  if (shatters >= 10) return "Lemonade Stand Demolition Contractor";
  if (rank === 1) return "Undisputed 40-Something Soapbox Legend";
  if (rank === 5) return "Best Attempt While Checking Work Email";
  return "Survived Without Pulling a Hamstring";
}

export const useDerbyStore = create<DerbyStoreState>((set, get) => ({
  phase: "countdown",
  countdownNum: 3,
  activeRideId: "bathtub",
  customRide: null,
  weapon: "potato",
  suikaTier: 1,
  hoaFineDollars: 0,
  shatters: 0,
  suikaMerges: 0,
  bestSuikaTier: 0,
  combo: 0,
  commentary: {
    id: 0,
    speaker: "SPANKY (RACE STEWARD)",
    text: "35 years later, zero health insurance, 118 meters of downhill regret. HANDS OFF THE BRAKES!",
    color: "#fde047",
  },
  garageOpen: false,
  workshopOpen: false,
  muted: false,
  runNonce: 1,
  finishSummary: null,
  dynamicJunk: [],
  projectiles: [],

  setPhase: (phase) => set({ phase }),
  setCountdownNum: (countdownNum) => set({ countdownNum }),
  selectRide: (id) =>
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
    })),
  setCustomRide: (name, bytes, flightMode) =>
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
    })),
  setWeapon: (weapon) => set({ weapon }),
  setSuikaTier: (t) => set({ suikaTier: Math.max(0, Math.min(4, t)) }),
  pushCommentary: (speaker, text, color = "#38bdf8") =>
    set({
      commentary: { id: ++commentSeq, speaker, text, color },
    }),
  addFine: (dollars) =>
    set((s) => ({ hoaFineDollars: s.hoaFineDollars + dollars })),
  recordShatter: (fineDollars, label) =>
    set((s) => ({
      shatters: s.shatters + 1,
      combo: s.combo + 1,
      hoaFineDollars: s.hoaFineDollars + fineDollars,
      commentary: label
        ? {
            id: ++commentSeq,
            speaker: "HOA CLAIMS ADJUSTER",
            text: `${label} OBLITERATED! +$${fineDollars} property fine`,
            color: "#fb923c",
          }
        : s.commentary,
    })),
  recordSuikaMerge: (toTier, scoreGain) =>
    set((s) => ({
      suikaMerges: s.suikaMerges + 1,
      bestSuikaTier: Math.max(s.bestSuikaTier, toTier),
      hoaFineDollars: s.hoaFineDollars + scoreGain,
      commentary: {
        id: ++commentSeq,
        speaker: "SUIKA PHYSICS",
        text: `TIER ${toTier} MEGA-ORB MERGE! Gravity is now legally a weapon (+$${scoreGain})`,
        color: "#f472b6",
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
  pruneProjectiles: (nowMs) => {
    const cur = get().projectiles;
    if (cur.length === 0) return;
    const filtered = cur.filter((p) => nowMs - p.bornAt < 2400);
    if (filtered.length !== cur.length) set({ projectiles: filtered });
  },
  finishRace: (rideLabel) => {
    const s = get();
    if (s.phase === "finished") return;
    const rank = derbyLive.rank;
    const timeSec = derbyLive.raceTimeSec;
    derbyAudio.playFinishFanfare(rank);
    set({
      phase: "finished",
      finishSummary: {
        rank,
        timeSec,
        finesDollars: s.hoaFineDollars,
        shatters: s.shatters,
        suikaMerges: s.suikaMerges,
        bestSuikaTier: s.bestSuikaTier,
        rideLabel,
        superlative: pickSuperlative(rank, s.hoaFineDollars, s.shatters, s.suikaMerges),
      },
      commentary: {
        id: ++commentSeq,
        speaker: "FINISH ARCH",
        text:
          rank === 1
            ? `1ST PLACE IN ${timeSec.toFixed(1)}s! Somebody ice Spanky's lower back!`
            : `FINISHED #${rank} IN ${timeSec.toFixed(1)}s! Total HOA Fines: $${s.hoaFineDollars}`,
        color: "#4ade80",
      },
    });
  },
  restartRace: () => {
    resetDerbyLive();
    set((s) => ({
      phase: "countdown",
      countdownNum: 3,
      hoaFineDollars: 0,
      shatters: 0,
      suikaMerges: 0,
      bestSuikaTier: 0,
      combo: 0,
      finishSummary: null,
      dynamicJunk: [],
      projectiles: [],
      runNonce: s.runNonce + 1,
      commentary: {
        id: ++commentSeq,
        speaker: "DARLA (TIMING BOOTH)",
        text: `Track cleared (${COURSE_LENGTH_M}m). Nobody tell our cardiologists.`,
        color: "#fde047",
      },
    }));
  },
}));
