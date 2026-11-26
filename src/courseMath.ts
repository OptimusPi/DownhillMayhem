import * as THREE from "three";

export const COURSE_LENGTH_M = 820;
export const RUNOFF_LENGTH_M = 90;
export const TOTAL_TRACK_M = COURSE_LENGTH_M + RUNOFF_LENGTH_M;
export const TRACK_HALF_WIDTH = 8.0;
export const WALL_HEIGHT = 2.6;
export const START_ELEVATION_M = 118;

export interface CourseSample {
  readonly s: number;
  readonly position: [number, number, number];
  readonly tangent: [number, number, number];
  readonly right: [number, number, number];
  readonly normal: [number, number, number];
  readonly yaw: number;
  readonly pitch: number;
  readonly width: number;
}

function rawCenterX(s: number): number {
  const t = Math.max(0, Math.min(TOTAL_TRACK_M, s));
  const rampIn = Math.min(1, t / 75);
  const fadeOut = t > COURSE_LENGTH_M - 30 ? Math.max(0, 1 - (t - (COURSE_LENGTH_M - 30)) / 90) : 1;
  const amp = rampIn * fadeOut;
  return (
    amp *
    (Math.sin(t * 0.0115) * 28 +
      Math.sin(t * 0.029 - 0.6) * 11 +
      Math.cos(t * 0.0062) * 14 -
      14 * rampIn)
  );
}

function rawElevationY(s: number): number {
  const t = Math.max(0, Math.min(TOTAL_TRACK_M, s));
  if (t >= COURSE_LENGTH_M) {
    // Bowl runoff past finish arch
    const over = t - COURSE_LENGTH_M;
    return Math.max(0, (over / RUNOFF_LENGTH_M) ** 2 * 4.5);
  }
  const u = t / COURSE_LENGTH_M;
  // Smooth steep-at-top, sweeping middle chutes, flat finish apron
  let y = START_ELEVATION_M * (1 - u) + Math.sin(u * Math.PI * 3.0) * 3.8 * (1 - u * 0.6);
  // Subtle kicker ramps at s=240m and s=560m
  const kick1 = Math.exp(-(((t - 240) / 14) ** 2)) * 2.1;
  const kick2 = Math.exp(-(((t - 560) / 15) ** 2)) * 2.5;
  // Smooth flare into finish bowl
  const flare = u > 0.9 ? ((u - 0.9) / 0.1) ** 2 * 2.2 : 0;
  y += kick1 + kick2 - flare * 0.4;
  return Math.max(0, y);
}

export function sampleCourse(s: number): CourseSample {
  const clamped = Math.max(0, Math.min(TOTAL_TRACK_M, s));
  const ds = 0.5;
  const s0 = Math.max(0, clamped - ds);
  const s1 = Math.min(TOTAL_TRACK_M, clamped + ds);

  const x = rawCenterX(clamped);
  const y = rawElevationY(clamped);
  const z = clamped;

  const dx = rawCenterX(s1) - rawCenterX(s0);
  const dy = rawElevationY(s1) - rawElevationY(s0);
  const dz = s1 - s0;
  const tanLen = Math.hypot(dx, dy, dz) || 1;
  const tx = dx / tanLen;
  const ty = dy / tanLen;
  const tz = dz / tanLen;

  // Right vector = cross(tangent, up) normalized in XZ
  const rxRaw = -tz;
  const rzRaw = tx;
  const rLen = Math.hypot(rxRaw, rzRaw) || 1;
  const rx = rxRaw / rLen;
  const rz = rzRaw / rLen;

  // Normal = cross(right, tangent) (points upward out of road deck)
  const nx = -rz * ty;
  const ny = rz * tx - rx * tz;
  const nz = rx * ty;
  const nLen = Math.hypot(nx, ny, nz) || 1;

  const yaw = Math.atan2(tx, tz);
  const pitch = Math.asin(Math.max(-0.95, Math.min(0.95, -ty)));

  // Slightly wider finish bowl
  const width =
    clamped > COURSE_LENGTH_M - 15
      ? TRACK_HALF_WIDTH * 2 + Math.min(18, (clamped - (COURSE_LENGTH_M - 15)) * 0.4)
      : TRACK_HALF_WIDTH * 2;

  return {
    s: clamped,
    position: [x, y, z],
    tangent: [tx, ty, tz],
    right: [rx, 0, rz],
    normal: [nx / nLen, ny / nLen, nz / nLen],
    yaw,
    pitch,
    width,
  };
}

export function projectToCourse(x: number, z: number): {
  s: number;
  lateral: number;
  sample: CourseSample;
} {
  const approxS = Math.max(0, Math.min(TOTAL_TRACK_M, z));
  let bestS = approxS;
  let bestDistSq = Infinity;
  const startS = Math.max(0, approxS - 28);
  const endS = Math.min(TOTAL_TRACK_M, approxS + 28);
  for (let probe = startS; probe <= endS; probe += 2) {
    const cx = rawCenterX(probe);
    const d2 = (x - cx) ** 2 + (z - probe) ** 2;
    if (d2 < bestDistSq) {
      bestDistSq = d2;
      bestS = probe;
    }
  }
  const sample = sampleCourse(bestS);
  const dx = x - sample.position[0];
  const dz = z - sample.position[2];
  const lateral = dx * sample.right[0] + dz * sample.right[2];
  return { s: bestS, lateral, sample };
}

export interface BoostPadSpec {
  readonly id: string;
  readonly s: number;
  readonly lateral: number;
}

export interface HazardSpec {
  readonly id: string;
  readonly kind: "hydrant" | "banana" | "manhole" | "cart";
  readonly s: number;
  readonly lateral: number;
  readonly label: string;
}

export interface SmashClusterSpec {
  readonly id: string;
  readonly kind: "lemonade" | "sawhorse" | "beans" | "soda" | "emoji" | "bottle";
  readonly s: number;
  readonly lateral: number;
}

export const BOOST_PADS: readonly BoostPadSpec[] = [
  { id: "boost-1", s: 68, lateral: -2.2 },
  { id: "boost-2", s: 175, lateral: 2.5 },
  { id: "boost-3", s: 232, lateral: 0 },
  { id: "boost-4", s: 410, lateral: -2.8 },
  { id: "boost-5", s: 552, lateral: 0 },
  { id: "boost-6", s: 705, lateral: 1.8 },
];

export const HAZARDS: readonly HazardSpec[] = [
  { id: "haz-ban-1", kind: "banana", s: 98, lateral: 2.4, label: "Produce Spill" },
  { id: "haz-hyd-1", kind: "hydrant", s: 152, lateral: -3.2, label: "Hydrant Geyser" },
  { id: "haz-man-1", kind: "manhole", s: 285, lateral: 1.6, label: "Popping Manhole" },
  { id: "haz-cart-1", kind: "cart", s: 345, lateral: -1.8, label: "Rogue Cart" },
  { id: "haz-ban-2", kind: "banana", s: 448, lateral: -3.0, label: "Banana Pile" },
  { id: "haz-hyd-2", kind: "hydrant", s: 515, lateral: 3.1, label: "Hydrant Geyser" },
  { id: "haz-man-2", kind: "manhole", s: 640, lateral: -1.2, label: "Sewer Launcher" },
  { id: "haz-cart-2", kind: "cart", s: 745, lateral: 2.6, label: "Runaway Cart" },
];

export const SMASH_ZONES: readonly SmashClusterSpec[] = [
  { id: "sm-lem-1", kind: "lemonade", s: 122, lateral: -3.4 },
  { id: "sm-bean-1", kind: "beans", s: 126, lateral: 0.4 },
  { id: "sm-soda-1", kind: "soda", s: 128, lateral: 1.6 },
  { id: "sm-saw-1", kind: "sawhorse", s: 205, lateral: 2.8 },
  { id: "sm-bot-1", kind: "bottle", s: 262, lateral: -1.5 },
  { id: "sm-emoji-1", kind: "emoji", s: 264, lateral: 1.5 },
  { id: "sm-lem-2", kind: "lemonade", s: 378, lateral: 3.3 },
  { id: "sm-bean-2", kind: "beans", s: 382, lateral: -0.5 },
  { id: "sm-saw-2", kind: "sawhorse", s: 472, lateral: 0.5 },
  { id: "sm-soda-2", kind: "soda", s: 478, lateral: -2.6 },
  { id: "sm-bot-2", kind: "bottle", s: 590, lateral: 2.2 },
  { id: "sm-lem-3", kind: "lemonade", s: 618, lateral: -3.1 },
  { id: "sm-emoji-2", kind: "emoji", s: 675, lateral: 0.2 },
  { id: "sm-saw-3", kind: "sawhorse", s: 722, lateral: -2.4 },
  { id: "sm-bean-3", kind: "beans", s: 780, lateral: -1.4 },
  { id: "sm-soda-3", kind: "soda", s: 780, lateral: 1.4 },
  { id: "sm-lem-4", kind: "lemonade", s: 798, lateral: 3.4 },
  // Finish bowl bowling pins!
  { id: "sm-bowl-1", kind: "beans", s: 842, lateral: -2.2 },
  { id: "sm-bowl-2", kind: "soda", s: 842, lateral: 0 },
  { id: "sm-bowl-3", kind: "emoji", s: 842, lateral: 2.2 },
  { id: "sm-bowl-4", kind: "bottle", s: 846, lateral: -1.1 },
  { id: "sm-bowl-5", kind: "bottle", s: 846, lateral: 1.1 },
];

export interface CourseMeshData {
  readonly roadGeometry: THREE.BufferGeometry;
  readonly wallGeometry: THREE.BufferGeometry;
  readonly terrainGeometry: THREE.BufferGeometry;
  readonly roadVertices: Float32Array;
  readonly roadIndices: Uint32Array;
  readonly wallVertices: Float32Array;
  readonly wallIndices: Uint32Array;
}

function buildIndexedRibbon(
  stepM: number,
  profileOffsets: readonly { x: number; y: number; color: (s: number) => THREE.Color }[],
  closeCrossSection = false,
): { geometry: THREE.BufferGeometry; vertices: Float32Array; indices: Uint32Array } {
  const rows = Math.floor(TOTAL_TRACK_M / stepM) + 1;
  const cols = profileOffsets.length;
  const positions = new Float32Array(rows * cols * 3);
  const colors = new Float32Array(rows * cols * 3);
  const idxList: number[] = [];

  for (let r = 0; r < rows; r++) {
    const s = Math.min(TOTAL_TRACK_M, r * stepM);
    const sample = sampleCourse(s);
    const hwScale = sample.width / (TRACK_HALF_WIDTH * 2);

    for (let c = 0; c < cols; c++) {
      const p = profileOffsets[c]!;
      const lat = p.x * hwScale;
      const vx = sample.position[0] + sample.right[0] * lat;
      const vy = sample.position[1] + p.y;
      const vz = sample.position[2] + sample.right[2] * lat;
      const vi = (r * cols + c) * 3;
      positions[vi] = vx;
      positions[vi + 1] = vy;
      positions[vi + 2] = vz;

      const col = p.color(s);
      colors[vi] = col.r;
      colors[vi + 1] = col.g;
      colors[vi + 2] = col.b;
    }
  }

  const segCols = closeCrossSection ? cols : cols - 1;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < segCols; c++) {
      const nextC = (c + 1) % cols;
      const a = r * cols + c;
      const b = r * cols + nextC;
      const d = (r + 1) * cols + c;
      const e = (r + 1) * cols + nextC;
      idxList.push(a, d, b, b, d, e);
    }
  }

  const indices = new Uint32Array(idxList);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return { geometry, vertices: positions, indices };
}

export function buildCourseGeometry(): CourseMeshData {
  const cAsphaltA = new THREE.Color("#293241");
  const cAsphaltB = new THREE.Color("#323d4f");
  const cYellow = new THREE.Color("#facc15");
  const cCurbRed = new THREE.Color("#ef4444");
  const cCurbWhite = new THREE.Color("#f8fafc");
  const cFinishDark = new THREE.Color("#0f172a");
  const cFinishLight = new THREE.Color("#f8fafc");
  const cRamp = new THREE.Color("#f97316");

  const roadColor = (s: number, lane: "curbL" | "curbR" | "center" | "asphalt"): THREE.Color => {
    const stripe = Math.floor(s / 4) % 2 === 0;
    if (s >= COURSE_LENGTH_M - 3 && s <= COURSE_LENGTH_M + 3) {
      return stripe ? cFinishLight : cFinishDark;
    }
    if (s <= 8) return stripe ? cFinishLight : cFinishDark;
    if ((s >= 228 && s <= 252) || (s >= 548 && s <= 572)) {
      return lane === "center" ? cYellow : cRamp;
    }
    if (lane === "curbL" || lane === "curbR") return stripe ? cCurbRed : cCurbWhite;
    if (lane === "center") return Math.floor(s / 6) % 2 === 0 ? cYellow : cAsphaltA;
    return Math.floor(s / 8) % 2 === 0 ? cAsphaltA : cAsphaltB;
  };

  const road = buildIndexedRibbon(2.5, [
    { x: -TRACK_HALF_WIDTH - 0.9, y: -0.35, color: (s) => roadColor(s, "curbL") },
    { x: -TRACK_HALF_WIDTH, y: 0.08, color: (s) => roadColor(s, "curbL") },
    { x: -TRACK_HALF_WIDTH + 0.9, y: 0.0, color: (s) => roadColor(s, "asphalt") },
    { x: -0.35, y: 0.02, color: (s) => roadColor(s, "asphalt") },
    { x: 0, y: 0.02, color: (s) => roadColor(s, "center") },
    { x: 0.35, y: 0.02, color: (s) => roadColor(s, "asphalt") },
    { x: TRACK_HALF_WIDTH - 0.9, y: 0.0, color: (s) => roadColor(s, "asphalt") },
    { x: TRACK_HALF_WIDTH, y: 0.08, color: (s) => roadColor(s, "curbR") },
    { x: TRACK_HALF_WIDTH + 0.9, y: -0.35, color: (s) => roadColor(s, "curbR") },
  ]);

  // Guardrails: angled inward slightly so cars & Suika orbs ricochet back onto the road!
  const cWallWood = new THREE.Color("#b45309");
  const cWallTop = new THREE.Color("#fde047");
  const cWallOut = new THREE.Color("#78350f");

  const leftWall = buildIndexedRibbon(5, [
    { x: -TRACK_HALF_WIDTH - 1.1, y: -0.4, color: () => cWallOut },
    { x: -TRACK_HALF_WIDTH - 0.9, y: WALL_HEIGHT, color: () => cWallTop },
    { x: -TRACK_HALF_WIDTH - 0.3, y: WALL_HEIGHT, color: () => cWallTop },
    { x: -TRACK_HALF_WIDTH - 0.05, y: -0.2, color: (s) => (Math.floor(s / 10) % 2 === 0 ? cWallWood : cCurbRed) },
  ]);

  const rightWall = buildIndexedRibbon(5, [
    { x: TRACK_HALF_WIDTH + 0.05, y: -0.2, color: (s) => (Math.floor(s / 10) % 2 === 0 ? cWallWood : cCurbRed) },
    { x: TRACK_HALF_WIDTH + 0.3, y: WALL_HEIGHT, color: () => cWallTop },
    { x: TRACK_HALF_WIDTH + 0.9, y: WALL_HEIGHT, color: () => cWallTop },
    { x: TRACK_HALF_WIDTH + 1.1, y: -0.4, color: () => cWallOut },
  ]);

  // Merge left and right guardrails into a single wall mesh + collider
  const lPos = leftWall.vertices;
  const rPos = rightWall.vertices;
  const wallVertices = new Float32Array(lPos.length + rPos.length);
  wallVertices.set(lPos, 0);
  wallVertices.set(rPos, lPos.length);

  const lCol = leftWall.geometry.getAttribute("color")!.array as Float32Array;
  const rCol = rightWall.geometry.getAttribute("color")!.array as Float32Array;
  const wallColors = new Float32Array(lCol.length + rCol.length);
  wallColors.set(lCol, 0);
  wallColors.set(rCol, lCol.length);

  const vOffset = lPos.length / 3;
  const wallIndices = new Uint32Array(leftWall.indices.length + rightWall.indices.length);
  wallIndices.set(leftWall.indices, 0);
  for (let i = 0; i < rightWall.indices.length; i++) {
    wallIndices[leftWall.indices.length + i] = rightWall.indices[i]! + vOffset;
  }

  const wallGeometry = new THREE.BufferGeometry();
  wallGeometry.setAttribute("position", new THREE.BufferAttribute(wallVertices, 3));
  wallGeometry.setAttribute("color", new THREE.BufferAttribute(wallColors, 3));
  wallGeometry.setIndex(new THREE.BufferAttribute(wallIndices, 1));
  wallGeometry.computeVertexNormals();
  leftWall.geometry.dispose();
  rightWall.geometry.dispose();

  // Scenic suburban canyon terrain skirt (visual backdrop)
  const cGrassA = new THREE.Color("#2d6a4f");
  const cGrassB = new THREE.Color("#40916c");
  const cCliff = new THREE.Color("#52463a");
  const terrain = buildIndexedRibbon(10, [
    { x: -95, y: 26, color: () => cCliff },
    { x: -42, y: 7, color: (s) => (Math.floor(s / 20) % 2 === 0 ? cGrassA : cGrassB) },
    { x: -TRACK_HALF_WIDTH - 1.2, y: -0.5, color: () => cGrassB },
    { x: TRACK_HALF_WIDTH + 1.2, y: -0.5, color: () => cGrassB },
    { x: 42, y: 7, color: (s) => (Math.floor(s / 20) % 2 === 0 ? cGrassB : cGrassA) },
    { x: 95, y: 26, color: () => cCliff },
  ]);

  return {
    roadGeometry: road.geometry,
    wallGeometry,
    terrainGeometry: terrain.geometry,
    roadVertices: road.vertices,
    roadIndices: road.indices,
    wallVertices,
    wallIndices,
  };
}
