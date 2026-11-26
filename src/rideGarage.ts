import * as THREE from "three";
import { loadKhrGlb, type KhrAssetBundle } from "@khr3/core";
import { ENGINE_TORQUE_CURVES, STEER_SPEED_CURVES } from "@khr3/core/curves";
import {
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
  readonly category: "derby-glb" | "math-car" | "space-jet";
  readonly badge: string;
  readonly desc: string;
  readonly horsepower: number;
  readonly massKg: number;
  readonly targetLengthM: number;
  readonly flightCapable: boolean;
  readonly startFlight?: boolean;
  readonly glbUrl?: string;
}

export const DERBY_RIDES: readonly DerbyRideEntry[] = [
  {
    id: "bathtub",
    name: "Clawfoot Tub",
    category: "derby-glb",
    badge: "Soapbox GLB",
    desc: "Porcelain bathtub bolted onto a wide downhill kart axle.",
    horsepower: 280,
    massKg: 620,
    targetLengthM: 3.45,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_bathtub_1p.glb",
  },
  {
    id: "cardboard_rocket",
    name: "Cardboard Rocket",
    category: "derby-glb",
    badge: "Jets [Shift] · Fly [G]",
    desc: "Duct-taped appliance box rigged with twin rear rocket thrusters.",
    horsepower: 310,
    massKg: 580,
    targetLengthM: 3.55,
    flightCapable: true,
    glbUrl: "/assets/veh_derby_cardboard_rocket_1p.glb",
  },
  {
    id: "shopping_trolley",
    name: "Shopping Trolley",
    category: "derby-glb",
    badge: "2-Seat Cart",
    desc: "Reinforced wire grocery cart built for high-speed curb hops.",
    horsepower: 275,
    massKg: 590,
    targetLengthM: 3.4,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_shopping_trolley_2p.glb",
  },
  {
    id: "viking_keg",
    name: "Oak Barrel Rig",
    category: "derby-glb",
    badge: "Heavy Roller",
    desc: "Iron-hooped oak cask on chunky pneumatic tires.",
    horsepower: 295,
    massKg: 680,
    targetLengthM: 3.5,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_viking_keg_1p.glb",
  },
  {
    id: "firetruck",
    name: "Pedal Firetruck",
    category: "derby-glb",
    badge: "Battering Ram",
    desc: "Stretched two-seat ladder rig that plows straight through barricades.",
    horsepower: 330,
    massKg: 760,
    targetLengthM: 3.85,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_firetruck_2p.glb",
  },
  {
    id: "racer_1p",
    name: "Gravity Wedge",
    category: "derby-glb",
    badge: "Classic Derby",
    desc: "Low-slung plywood soapbox torpedo with sharp turn-in.",
    horsepower: 295,
    massKg: 560,
    targetLengthM: 3.45,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_racer_1p.glb",
  },
  {
    id: "radio_wagon",
    name: "Red Flyer Wagon",
    category: "derby-glb",
    badge: "Steel Pan",
    desc: "Stamped red yard wagon widened for 100+ km/h downhill runs.",
    horsepower: 280,
    massKg: 550,
    targetLengthM: 3.35,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_radio_wagon_1p.glb",
  },
  {
    id: "crate_rod",
    name: "Milk Crate Rod",
    category: "derby-glb",
    badge: "Backyard Rat",
    desc: "Lumber rails, stacked plastic crates, and zero bodywork.",
    horsepower: 285,
    massKg: 580,
    targetLengthM: 3.45,
    flightCapable: false,
    glbUrl: "/assets/veh_derby_crate_rod_1p.glb",
  },
  {
    id: "coupe_86",
    name: "Coupe 86",
    category: "math-car",
    badge: "PaperShell Math",
    desc: "Generated purely from Kolmo procedural car math — balanced RWD drift.",
    horsepower: 330,
    massKg: 1050,
    targetLengthM: 4.2,
    flightCapable: false,
  },
  {
    id: "kei_van",
    name: "Kei Cargo Van",
    category: "math-car",
    badge: "PaperShell Math",
    desc: "Boxy procedural micro-van with short wheelbase and snappy steering.",
    horsepower: 295,
    massKg: 1020,
    targetLengthM: 3.6,
    flightCapable: false,
  },
  {
    id: "six_by_six",
    name: "6x6 Jet Rig",
    category: "math-car",
    badge: "6WD + Jets [G]",
    desc: "Six driven PaperShell wheels paired with twin rear jet thrusters.",
    horsepower: 420,
    massKg: 1280,
    targetLengthM: 4.6,
    flightCapable: true,
  },
  {
    id: "starfighter_delta",
    name: "Delta Starfighter",
    category: "space-jet",
    badge: "6-DoF Space Jet",
    desc: "Procedural KHR space fighter craft with full aerial thruster flight.",
    horsepower: 520,
    massKg: 1450,
    targetLengthM: 5.8,
    flightCapable: true,
    startFlight: true,
  },
];

const SIX_BY_SIX_PRESET: PaperShellPreset = {
  id: "sedan_92",
  label: "6x6 Jet Rig",
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
  defaultHorsepower: 420,
  defaultMaxRPM: 6000,
};

function appendRearJetPropellers(glb: Uint8Array, zOffset = -1.65, yOffset = 0.65, maxThrust = 15000): Uint8Array {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLen = view.getUint32(12, true);
  const doc = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLen))) as {
    nodes: Array<Record<string, unknown>>;
  };
  const rootNode = doc.nodes[0];
  const children = Array.isArray(rootNode?.children) ? (rootNode.children as number[]) : [];
  for (const [name, xOff, invTorque] of [
    ["Jet_Booster_L", 0.48, false],
    ["Jet_Booster_R", -0.48, true],
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
  root.name = "Delta_Starfighter";
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.35, flatShading: true });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4, metalness: 0.25, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.45, flatShading: true });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.2, flatShading: true });

  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.82, 6.2, 6), hullMat);
  fuselage.name = "Fighter_Fuselage";
  fuselage.rotation.x = Math.PI * 0.5;
  fuselage.position.set(0, 0.75, 0.25);

  const canopyGeo = new THREE.OctahedronGeometry(0.56, 0);
  canopyGeo.scale(0.75, 0.6, 1.85);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.name = "Fighter_Canopy";
  canopy.position.set(0, 1.18, 0.65);

  const wingL = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.14, 2.4), hullMat);
  wingL.name = "Fighter_Wing_L";
  wingL.position.set(1.85, 0.68, -0.55);
  wingL.rotation.y = -0.28;

  const wingR = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.14, 2.4), hullMat);
  wingR.name = "Fighter_Wing_R";
  wingR.position.set(-1.85, 0.68, -0.55);
  wingR.rotation.y = 0.28;

  const finL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 1.25), accentMat);
  finL.name = "Fighter_Fin_L";
  finL.position.set(0.72, 1.32, -1.95);
  finL.rotation.z = -0.25;

  const finR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 1.25), accentMat);
  finR.name = "Fighter_Fin_R";
  finR.position.set(-0.72, 1.32, -1.95);
  finR.rotation.z = 0.25;

  const engineL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.8, 8), darkMat);
  engineL.name = "Fighter_Engine_L";
  engineL.rotation.x = Math.PI * 0.5;
  engineL.position.set(0.45, 0.72, -2.65);

  const engineR = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.8, 8), darkMat);
  engineR.name = "Fighter_Engine_R";
  engineR.rotation.x = Math.PI * 0.5;
  engineR.position.set(-0.45, 0.72, -2.65);

  root.add(fuselage, canopy, wingL, wingR, finL, finR, engineL, engineR);
  return root;
}

export interface CompiledDerbyRide {
  readonly id: string;
  readonly bundle: KhrAssetBundle;
  readonly bytes: Uint8Array;
  readonly flightMode: boolean;
}

const rideBundleCache = new Map<DerbyRideId, Promise<CompiledDerbyRide>>();

export function getRideSpec(id: DerbyRideId | "custom"): DerbyRideEntry {
  return DERBY_RIDES.find((r) => r.id === id) ?? DERBY_RIDES[0]!;
}

export function buildDerbyRideBundle(id: DerbyRideId): Promise<CompiledDerbyRide> {
  const hit = rideBundleCache.get(id);
  if (hit) return hit;

  const spec = getRideSpec(id);
  const task = (async (): Promise<CompiledDerbyRide> => {
    let finalBytes: Uint8Array;

    if (id === "coupe_86" || id === "kei_van") {
      const raw = await buildProceduralCarGlb(id, id === "coupe_86" ? "dc-smooth" : "psx-flat", {
        horsepower: spec.horsepower,
      });
      finalBytes = new Uint8Array(raw);
    } else if (id === "six_by_six") {
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
      finalBytes = appendRearJetPropellers(stamped, -2.75, 0.88, 16500);
    } else if (id === "starfighter_delta") {
      const grp = buildSpaceFighterGroup();
      const raw = await compileKhrAssetGlb(grp, {
        archetype: "craft",
        massKg: spec.massKg,
        powerOrThrust: 28000,
        name: "Delta_Starfighter",
        patches: [
          { nodeName: "Socket_seat_pilot", translation: [0, 0.95, 0.55], extension: { socket: "seat" } },
          { nodeName: "Socket_exit_pilot", translation: [2.1, 0.65, 0.2], extension: { socket: "exit" } },
          { nodeName: "Thruster_Plume_L", translation: [0.45, 0.72, -3.05], extension: { kind: "plume", drive: "throttle", color: [0.22, 0.78, 1], size: 1.35 } },
          { nodeName: "Thruster_Plume_R", translation: [-0.45, 0.72, -3.05], extension: { kind: "plume", drive: "throttle", color: [0.22, 0.78, 1], size: 1.35 } },
        ],
      });
      finalBytes = new Uint8Array(raw);
    } else {
      const url = spec.glbUrl ?? "/assets/veh_derby_bathtub_1p.glb";
      const { bytes } = await loadOrAutoCompileVehicleGlb(url, {
        horsepower: spec.horsepower,
        targetLengthM: spec.targetLengthM,
        massKg: spec.massKg,
        driveType: "AWD",
      });
      const stamped = new Uint8Array(
        stampKolmoNodesIntoGlb(
          bytes,
          [
            { nodeName: "Socket_exit_driver", translation: [1.6, 0.45, 0], extension: { socket: "exit" } },
            { nodeName: "Derby_Plume_L", translation: [0.42, 0.42, -1.68], extension: { kind: "plume", drive: "boost", color: [1, 0.55, 0.14], size: 1.05 } },
            { nodeName: "Derby_Plume_R", translation: [-0.42, 0.42, -1.68], extension: { kind: "plume", drive: "boost", color: [1, 0.55, 0.14], size: 1.05 } },
          ],
          {
            tune: {
              engineHorsepower: spec.horsepower,
              engineMaxRPM: 6200,
              gearRatios: [3.2, 2.05, 1.42, 1.05, 0.85],
              finalDriveRatio: 3.5,
              transmissionMode: "auto",
              steerRate: 7.2,
              maxSteerAngle: 0.62,
              reverseTorqueScale: 1,
              reverseRPMScale: 0.55,
              engineTorqueCurveData: ENGINE_TORQUE_CURVES.w16QuadTurbo,
              steerAngleCurveData: {
                samples: 60,
                points: [
                  { x: 0, y: 1, r_out: 0, w_out: 1 },
                  { x: 0.45, y: 0.96, r_in: -0.08, r_out: -0.15, w_in: 1, w_out: 1 },
                  { x: 0.75, y: 0.86, r_in: -0.32, r_out: -0.28, w_in: 1, w_out: 1 },
                  { x: 1, y: 0.78, r_in: -0.25, w_in: 1 },
                ],
              },
            },
          },
          { preserveExistingNodes: true },
        ),
      );
      finalBytes = id === "cardboard_rocket" ? appendRearJetPropellers(stamped, -1.75, 0.65, 9500) : stamped;
    }

    const ab = finalBytes.buffer.slice(finalBytes.byteOffset, finalBytes.byteOffset + finalBytes.byteLength) as ArrayBuffer;
    const bundle = await loadKhrGlb(ab);
    return {
      id,
      bundle,
      bytes: finalBytes,
      flightMode: Boolean(spec.startFlight),
    };
  })();

  rideBundleCache.set(id, task);
  task.catch(() => rideBundleCache.delete(id));
  return task;
}

export async function ingestCustomDerbyFile(
  fileName: string,
  buffer: ArrayBuffer,
): Promise<{ name: string; bytes: Uint8Array; flightMode: boolean }> {
  const cleanName = fileName.replace(/\.(glb|gltf|usd|usda|usdc|usdz)$/i, "") || "Custom Craft";
  let rawBytes: Uint8Array;
  if (isUsdFileName(fileName)) {
    const converted = await convertUsdToGlb(buffer);
    rawBytes = new Uint8Array(converted.glb);
  } else {
    rawBytes = new Uint8Array(buffer);
  }
  const compiled = await loadOrAutoCompileVehicleGlb(rawBytes, {
    horsepower: 340,
    targetLengthM: 3.6,
    massKg: 1180,
  });
  const flightMode = compiled.bundle.propellers.length > 0 && compiled.bundle.wheels.length === 0;
  return { name: cleanName, bytes: compiled.bytes, flightMode };
}
