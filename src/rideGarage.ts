import * as THREE from "three";
import { ENGINE_TORQUE_CURVES, STEER_SPEED_CURVES } from "@khr3/core/curves";
import {
  PAPER_SHELL_PRESETS,
  buildPaperShellAssembly,
  exportPaperShellKhrGlb,
  type PaperShellPreset,
  type WheelSlotId,
} from "@khr3/vehicles/paper-shell";
import {
  buildProceduralCarGlb,
  compileKhrAssetGlb,
  convertUsdToGlb,
  isUsdFileName,
  loadOrAutoCompileVehicleGlb,
  stampKolmoNodesIntoGlb,
} from "@pinkaphant/kolmo";
import type { DerbyRideId } from "./derbyStore";

export interface DerbyRideEntry {
  readonly id: DerbyRideId;
  readonly name: string;
  readonly driver: string;
  readonly category: "derby-glb" | "math-car" | "space-jet";
  readonly badge: string;
  readonly roast: string;
  readonly horsepower: number;
  readonly massKg: number;
  readonly flightCapable: boolean;
  readonly startFlight?: boolean;
  readonly glbUrl?: string;
}

export const DERBY_RIDES: readonly DerbyRideEntry[] = [
  {
    id: "bathtub",
    name: "Porcelain Panic",
    driver: "Alfalfa (Age 41)",
    category: "derby-glb",
    badge: "Soapbox Tub",
    roast: "Cast-iron clawfoot tub on Harbor Freight casters. Zero lumbar support.",
    horsepower: 260,
    massKg: 420,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_bathtub_1p.glb",
  },
  {
    id: "cardboard_rocket",
    name: "Cardboard Apollo",
    driver: "Spanky (Age 43)",
    category: "derby-glb",
    badge: "Jets [Shift] / Fly [G]",
    roast: "Refrigerator box + duct tape + two sketchy model rocket boosters.",
    horsepower: 310,
    massKg: 340,
    flightCapable: true,
    glbUrl: "/assets/veh_derby_cardboard_rocket_1p.glb",
  },
  {
    id: "shopping_trolley",
    name: "Costco Express",
    driver: "Stymie (Age 42)",
    category: "derby-glb",
    badge: "Bulk-Aisle Drift",
    roast: "One front wheel permanently wobbles left. Holds 48 rotisserie chickens.",
    horsepower: 255,
    massKg: 380,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_shopping_trolley_2p.glb",
  },
  {
    id: "viking_keg",
    name: "Valhalla Keg",
    driver: "Buckwheat (Age 42)",
    category: "derby-glb",
    badge: "Oak Barrel",
    roast: "Craft IPA fermentation barrel on lawnmower axles. Smells like bad decisions.",
    horsepower: 280,
    massKg: 440,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_viking_keg_1p.glb",
  },
  {
    id: "firetruck",
    name: "HOA Fire Marshal",
    driver: "Porkchop (Age 44)",
    category: "derby-glb",
    badge: "Heavy Rammer",
    roast: "Pedal firetruck retrofitted with a leaf-blower supercharger.",
    horsepower: 340,
    massKg: 620,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_firetruck_2p.glb",
  },
  {
    id: "racer_1p",
    name: "The Blur 2.0",
    driver: "Butch (Age 43)",
    category: "derby-glb",
    badge: "Classic Wedge",
    roast: "Still painted the same shade of Krylon flame-red from 1994.",
    horsepower: 295,
    massKg: 390,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_racer_1p.glb",
  },
  {
    id: "radio_wagon",
    name: "Midlife Radio Flyer",
    driver: "Waldo (Age 43)",
    category: "derby-glb",
    badge: "Tax-Bracket Wagon",
    roast: "Bought a titanium chassis to beat his childhood friends. Still wobbles.",
    horsepower: 270,
    massKg: 330,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_radio_wagon_1p.glb",
  },
  {
    id: "crate_rod",
    name: "Milk Crate Hot Rod",
    driver: "Froggy (Age 41)",
    category: "derby-glb",
    badge: "Plywood Rat",
    roast: "4x4 fence posts, 2 milk crates, and a prayer to Sir Isaac Newton.",
    horsepower: 285,
    massKg: 370,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_crate_rod_1p.glb",
  },
  {
    id: "coupe_86",
    name: "Spanky's Paid-Off Coupe",
    driver: "Spanky (Math Car)",
    category: "math-car",
    badge: "Procedural PaperShell",
    roast: "Generated purely from Kolmo car math! 285,000 miles, zero payments left.",
    horsepower: 310,
    massKg: 940,
    flightCapable: false,
  },
  {
    id: "kei_van",
    name: "Dad-Bod Kei Van",
    driver: "Stymie (Math Van)",
    category: "math-car",
    badge: "Procedural PaperShell",
    roast: "Built with Kolmo math! Room for 6 kids' soccer bags and a potato cannon.",
    horsepower: 275,
    massKg: 880,
    flightCapable: false,
  },
  {
    id: "six_by_six",
    name: "6x6 HOA Nightmare",
    driver: "Buckwheat (Math 6x6)",
    category: "math-car",
    badge: "6WD + Jets [G]",
    roast: "Six PaperShell wheels + twin thrusters. Strictly illegal in cul-de-sacs.",
    horsepower: 410,
    massKg: 1180,
    flightCapable: true,
  },
  {
    id: "starfighter_delta",
    name: "Darla's Fighter Space Jet",
    driver: "Darla (Age 40)",
    category: "space-jet",
    badge: "6-DoF Space Fighter",
    roast: "Darla brought an orbital delta fighter jet to a wooden soapbox derby.",
    horsepower: 480,
    massKg: 1450,
    flightCapable: true,
    startFlight: true,
  },
];

const SIX_BY_SIX_PRESET: PaperShellPreset = {
  id: "sedan_92",
  label: "6x6 HOA Nightmare",
  doorCount: 4,
  wheelbase: 3.35,
  trackWidth: 1.82,
  halfWidth: 1.04,
  rearOverhang: 1.12,
  frontOverhang: 0.92,
  groundClearance: 0.28,
  bumperRearY: 0.74,
  trunkDeckY: 1.08,
  beltlineY: 1.06,
  roofY: 1.68,
  cowlY: 1.04,
  noseY: 0.72,
  archRadius: 0.46,
  wheelRadius: 0.4,
  wheelWidth: 0.29,
  suspensionTravel: 0.3,
  suspensionSag: 0.1,
  chassisMassKg: 900,
  engineMassKg: 280,
  defaultFuelLiters: 90,
  defaultHorsepower: 410,
  defaultMaxRPM: 6000,
};

function appendRearJetPropellers(glb: Uint8Array, zOffset = -1.35, yOffset = 0.62, maxThrust = 14000): Uint8Array {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLen = view.getUint32(12, true);
  const doc = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLen))) as {
    nodes: Array<Record<string, unknown>>;
  };
  const rootNode = doc.nodes[0];
  const children = Array.isArray(rootNode?.children) ? (rootNode.children as number[]) : [];
  for (const [name, xOff, invTorque] of [
    ["Jet_Booster_L", 0.45, false],
    ["Jet_Booster_R", -0.45, true],
  ] as const) {
    children.push(doc.nodes.length);
    doc.nodes.push({
      name,
      translation: [xOff, yOffset, zOffset],
      rotation: [Math.SQRT1_2, 0, 0, Math.SQRT1_2],
      extras: {
        role: "thruster",
        ecctrlPropeller: {
          position: [xOff, yOffset, zOffset],
          rotation: [1.5708, 0, 0],
          maxThrust,
          torqueRatio: 0.42,
          invertThrust: false,
          invertTorque: invTorque,
          propellerModelMaxSpin: 48,
        },
      },
    });
  }
  if (rootNode) rootNode.children = children;

  const rawJson = new TextEncoder().encode(JSON.stringify(doc));
  const paddedLen = (rawJson.byteLength + 3) & ~3;
  const binSlice = glb.subarray(20 + jsonLen);
  const totalLen = 20 + paddedLen + binSlice.byteLength;
  const out = new Uint8Array(totalLen);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, 0x46546c67, true);
  outView.setUint32(4, 2, true);
  outView.setUint32(8, totalLen, true);
  outView.setUint32(12, paddedLen, true);
  outView.setUint32(16, 0x4e4f534a, true);
  out.set(rawJson, 20);
  for (let i = rawJson.byteLength; i < paddedLen; i++) out[20 + i] = 0x20;
  out.set(binSlice, 20 + paddedLen);
  return out;
}

function buildSpaceFighterGroup(): THREE.Group {
  const root = new THREE.Group();
  root.name = "Darla_Space_Fighter";
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.35, flatShading: true });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.4, metalness: 0.25, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.45, flatShading: true });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.48, flatShading: true });

  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.76, 5.8, 6), hullMat);
  fuselage.name = "Fighter_Fuselage";
  fuselage.rotation.x = Math.PI * 0.5;
  fuselage.position.set(0, 0.72, 0.2);

  const canopy = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), canopyMat);
  canopy.name = "Fighter_Canopy";
  canopy.scale.set(0.72, 0.58, 1.8);
  canopy.position.set(0, 1.16, 0.58);

  const wingL = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 2.2), hullMat);
  wingL.name = "Fighter_Wing_L";
  wingL.position.set(1.72, 0.66, -0.55);
  wingL.rotation.y = -0.28;

  const wingR = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 2.2), hullMat);
  wingR.name = "Fighter_Wing_R";
  wingR.position.set(-1.72, 0.66, -0.55);
  wingR.rotation.y = 0.28;

  const finL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.0, 1.15), accentMat);
  finL.name = "Fighter_Fin_L";
  finL.position.set(0.68, 1.28, -1.85);
  finL.rotation.z = -0.24;

  const finR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.0, 1.15), accentMat);
  finR.name = "Fighter_Fin_R";
  finR.position.set(-0.68, 1.28, -1.85);
  finR.rotation.z = 0.24;

  const engineL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.75, 8), darkMat);
  engineL.name = "Fighter_Engine_L";
  engineL.rotation.x = Math.PI * 0.5;
  engineL.position.set(0.42, 0.7, -2.55);

  const engineR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.75, 8), darkMat);
  engineR.name = "Fighter_Engine_R";
  engineR.rotation.x = Math.PI * 0.5;
  engineR.position.set(-0.42, 0.7, -2.55);

  root.add(fuselage, canopy, wingL, wingR, finL, finR, engineL, engineR);
  return root;
}

const rideBytesCache = new Map<DerbyRideId, Promise<Uint8Array>>();

export function getRideSpec(id: DerbyRideId | "custom"): DerbyRideEntry {
  return DERBY_RIDES.find((r) => r.id === id) ?? DERBY_RIDES[0]!;
}

export function buildDerbyRideBytes(id: DerbyRideId): Promise<Uint8Array> {
  const hit = rideBytesCache.get(id);
  if (hit) return hit;

  const spec = getRideSpec(id);
  const task = (async (): Promise<Uint8Array> => {
    if (id === "coupe_86" || id === "kei_van") {
      const raw = await buildProceduralCarGlb(id, id === "coupe_86" ? "dc-smooth" : "psx-flat", {
        horsepower: spec.horsepower,
      });
      return new Uint8Array(raw);
    }

    if (id === "six_by_six") {
      const baseAsm = buildPaperShellAssembly(SIX_BY_SIX_PRESET, "dc-smooth");
      const rl = baseAsm.wheels.find((w) => w.slotId.includes("rl")) ?? baseAsm.wheels[2]!;
      const rr = baseAsm.wheels.find((w) => w.slotId.includes("rr")) ?? baseAsm.wheels[3]!;
      const asm = {
        ...baseAsm,
        wheels: [
          ...baseAsm.wheels,
          { ...rl, slotId: "wheel_ml" as WheelSlotId, position: [rl.position[0], rl.position[1], 0] as [number, number, number], omi: { ...rl.omi, propulsion: true } },
          { ...rr, slotId: "wheel_mr" as WheelSlotId, position: [rr.position[0], rr.position[1], 0] as [number, number, number], omi: { ...rr.omi, propulsion: true } },
        ],
      };
      const { glb } = await exportPaperShellKhrGlb(asm, undefined, 90);
      const stamped = new Uint8Array(
        stampKolmoNodesIntoGlb(
          glb,
          [
            { nodeName: "Socket_seat_driver", translation: [0.38, 0.9, 0.05], extension: { socket: "seat" } },
            { nodeName: "Socket_exit_driver", translation: [1.75, 0.55, 0], extension: { socket: "exit" } },
            { nodeName: "Exhaust_L", translation: [0.5, 0.36, -2.7], extension: { kind: "plume", drive: "boost", color: [1, 0.45, 0.1], size: 1.2 } },
            { nodeName: "Exhaust_R", translation: [-0.5, 0.36, -2.7], extension: { kind: "plume", drive: "boost", color: [1, 0.45, 0.1], size: 1.2 } },
          ],
          {
            tune: {
              engineHorsepower: spec.horsepower,
              engineMaxRPM: 6000,
              gearRatios: [3.6, 2.25, 1.5, 1.08, 0.84],
              finalDriveRatio: 4.1,
              transmissionMode: "auto",
              maxSteerAngle: 0.54,
              engineTorqueCurveData: ENGINE_TORQUE_CURVES.naScreamer,
              steerAngleCurveData: STEER_SPEED_CURVES.driftCountersteer,
            },
          },
        ),
      );
      return appendRearJetPropellers(stamped, -2.75, 0.88, 16000);
    }

    if (id === "starfighter_delta") {
      const grp = buildSpaceFighterGroup();
      const raw = await compileKhrAssetGlb(grp, {
        archetype: "craft",
        massKg: spec.massKg,
        powerOrThrust: 26000,
        name: "Darla_Space_Fighter",
        patches: [
          { nodeName: "Socket_seat_pilot", translation: [0, 0.95, 0.55], extension: { socket: "seat" } },
          { nodeName: "Socket_exit_pilot", translation: [2.1, 0.65, 0.2], extension: { socket: "exit" } },
          { nodeName: "Thruster_L", translation: [0.42, 0.7, -2.95], extension: { kind: "plume", drive: "throttle", color: [0.22, 0.78, 1], size: 1.35 } },
          { nodeName: "Thruster_R", translation: [-0.42, 0.7, -2.95], extension: { kind: "plume", drive: "throttle", color: [0.22, 0.78, 1], size: 1.35 } },
        ],
      });
      return new Uint8Array(raw);
    }

    // CubicWave Derby GLB vehicle -> auto-compile into 4-wheel KHR bundle + stamp derby boost plumes
    const url = spec.glbUrl ?? "/assets/veh_derby_bathtub_1p.glb";
    const { bytes } = await loadOrAutoCompileVehicleGlb(url, {
      horsepower: spec.horsepower,
      targetLengthM: 2.75,
      massKg: spec.massKg,
    });
    const stamped = new Uint8Array(
      stampKolmoNodesIntoGlb(
        bytes,
        [
          { nodeName: "Socket_seat_driver", translation: [0, 0.82, 0], extension: { socket: "seat" } },
          { nodeName: "Socket_exit_driver", translation: [1.45, 0.45, 0], extension: { socket: "exit" } },
          { nodeName: "Derby_Plume_L", translation: [0.34, 0.42, -1.38], extension: { kind: "plume", drive: "boost", color: [1, 0.55, 0.14], size: 1.05 } },
          { nodeName: "Derby_Plume_R", translation: [-0.34, 0.42, -1.38], extension: { kind: "plume", drive: "boost", color: [1, 0.55, 0.14], size: 1.05 } },
        ],
        {
          tune: {
            engineHorsepower: spec.horsepower,
            engineMaxRPM: 6800,
            gearRatios: [3.5, 2.25, 1.5, 1.1, 0.85],
            finalDriveRatio: 3.9,
            transmissionMode: "auto",
            maxSteerAngle: 0.58,
            engineTorqueCurveData: ENGINE_TORQUE_CURVES.naScreamer,
            steerAngleCurveData: STEER_SPEED_CURVES.driftCountersteer,
          },
        },
      ),
    );
    return id === "cardboard_rocket" ? appendRearJetPropellers(stamped, -1.42, 0.58, 11500) : stamped;
  })();

  rideBytesCache.set(id, task);
  task.catch(() => rideBytesCache.delete(id));
  return task;
}

export async function ingestCustomDerbyFile(
  fileName: string,
  buffer: ArrayBuffer,
): Promise<{ name: string; bytes: Uint8Array; flightMode: boolean }> {
  const cleanName = fileName.replace(/\.(glb|gltf|usd|usda|usdc|usdz)$/i, "") || "Custom Contraption";
  let rawBytes: Uint8Array;
  if (isUsdFileName(fileName)) {
    const converted = await convertUsdToGlb(buffer);
    rawBytes = new Uint8Array(converted.glb);
  } else {
    rawBytes = new Uint8Array(buffer);
  }
  const compiled = await loadOrAutoCompileVehicleGlb(rawBytes, {
    horsepower: 300,
    targetLengthM: 3.1,
    massKg: 520,
  });
  const flightMode = compiled.bundle.propellers.length > 0 && compiled.bundle.wheels.length === 0;
  return { name: cleanName, bytes: compiled.bytes, flightMode };
}
