import * as THREE from "three";

export const COURSE_LENGTH_M = 820;
export const RUNOFF_LENGTH_M = 90;
export const TOTAL_TRACK_M = COURSE_LENGTH_M + RUNOFF_LENGTH_M;
export const TRACK_HALF_WIDTH = 8.2;
export const WALL_HEIGHT = 2.4;
export const START_ELEVATION_M = 122;

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
  const t = Math.max(-12, Math.min(TOTAL_TRACK_M, s));
  if (t <= 22) return 0;
  const rampIn = Math.min(1, (t - 22) / 65);
  const fadeOut =
    t > COURSE_LENGTH_M - 30
      ? Math.max(0, 1 - (t - (COURSE_LENGTH_M - 30)) / 90)
      : 1;
  const amp = rampIn * fadeOut;
  return (
    amp *
    (Math.sin((t - 22) * 0.0115) * 28 +
      Math.sin((t - 22) * 0.028 - 0.5) * 11 +
      Math.cos((t - 22) * 0.0062) * 14 -
      14 * rampIn)
  );
}

function rawElevationY(s: number): number {
  const t = Math.max(-12, Math.min(TOTAL_TRACK_M, s));
  // Smooth gentle staging pad for s <= 18m so vehicles park cleanly without fighting slope
  if (t <= 18) {
    return START_ELEVATION_M - Math.max(0, t) * 0.025;
  }
  const apronEnd = START_ELEVATION_M - 18 * 0.025;
  if (t >= COURSE_LENGTH_M) {
    const over = t - COURSE_LENGTH_M;
    return Math.max(0, (over / RUNOFF_LENGTH_M) ** 2 * 3.8);
  }
  const u = (t - 18) / (COURSE_LENGTH_M - 18);
  // C1-continuous ease-in matching the -0.025 staging slope at t=18, steepening smoothly downhill
  const slopeMatch = 0.025 * (COURSE_LENGTH_M - 18) / apronEnd;
  const smoothDrop = u * slopeMatch + u * u * ((3 - 2 * u) * (1 - slopeMatch));
  let y = apronEnd * (1 - smoothDrop) + Math.sin(u * Math.PI * 3.0) * 3.2 * u * (1 - u * 0.65);
  const kick1 = Math.exp(-(((t - 240) / 15) ** 2)) * 2.2;
  const kick2 = Math.exp(-(((t - 560) / 16) ** 2)) * 2.5;
  y += kick1 + kick2;
  return Math.max(0, y);
}

export function sampleCourse(s: number): CourseSample {
  const clamped = Math.max(-10, Math.min(TOTAL_TRACK_M, s));
  const ds = 0.5;
  const s0 = Math.max(-12, clamped - ds);
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

  // Screen-right when facing +Z is (-tz, 0, tx)
  const rxRaw = -tz;
  const rzRaw = tx;
  const rLen = Math.hypot(rxRaw, rzRaw) || 1;
  const rx = rxRaw / rLen;
  const rz = rzRaw / rLen;

  // Upward road normal = cross(tangent, right) -> (0, +1, 0) on flat +Z road
  const nx = ty * rz;
  const ny = tz * rx - tx * rz; // wait: tz*(-tz) - tx*(tx) = -1, so negate for +Y:
  const upX = -nx;
  const upY = -ny;
  const upZ = -(tx * 0 - ty * rx);
  const nLen = Math.hypot(upX, upY, upZ) || 1;

  const yaw = Math.atan2(tx, tz);
  const pitch = Math.asin(Math.max(-0.95, Math.min(0.95, -ty)));

  const width =
    clamped > COURSE_LENGTH_M - 15
      ? TRACK_HALF_WIDTH * 2 + Math.min(18, (clamped - (COURSE_LENGTH_M - 15)) * 0.4)
      : TRACK_HALF_WIDTH * 2;

  return {
    s: clamped,
    position: [x, y, z],
    tangent: [tx, ty, tz],
    right: [rx, 0, rz],
    normal: [upX / nLen, upY / nLen, upZ / nLen],
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
  const approxS = Math.max(-8, Math.min(TOTAL_TRACK_M, z));
  let bestS = approxS;
  let bestDistSq = Infinity;
  const startS = Math.max(-8, approxS - 30);
  const endS = Math.min(TOTAL_TRACK_M, approxS + 30);
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
  { id: "boost-1", s: 64, lateral: -2.0 },
  { id: "boost-2", s: 172, lateral: 2.4 },
  { id: "boost-3", s: 230, lateral: 0 },
  { id: "boost-4", s: 408, lateral: -2.6 },
  { id: "boost-5", s: 550, lateral: 0 },
  { id: "boost-6", s: 702, lateral: 1.8 },
];

export const HAZARDS: readonly HazardSpec[] = [
  { id: "haz-ban-1", kind: "banana", s: 98, lateral: 2.5, label: "Banana Spill" },
  { id: "haz-hyd-1", kind: "hydrant", s: 152, lateral: -3.2, label: "Hydrant Geyser" },
  { id: "haz-man-1", kind: "manhole", s: 285, lateral: 1.6, label: "Popping Manhole" },
  { id: "haz-cart-1", kind: "cart", s: 345, lateral: -1.8, label: "Runaway Cart" },
  { id: "haz-ban-2", kind: "banana", s: 448, lateral: -3.0, label: "Banana Crate" },
  { id: "haz-hyd-2", kind: "hydrant", s: 515, lateral: 3.1, label: "Hydrant Geyser" },
  { id: "haz-man-2", kind: "manhole", s: 640, lateral: -1.2, label: "Steam Manhole" },
  { id: "haz-cart-2", kind: "cart", s: 745, lateral: 2.6, label: "Runaway Cart" },
];

export const SMASH_ZONES: readonly SmashClusterSpec[] = [
  { id: "sm-bean-0", kind: "beans", s: 44, lateral: -1.8 },
  { id: "sm-soda-0", kind: "soda", s: 44, lateral: 1.8 },
  { id: "sm-lem-1", kind: "lemonade", s: 122, lateral: -3.4 },
  { id: "sm-bean-1", kind: "beans", s: 126, lateral: 0.4 },
  { id: "sm-soda-1", kind: "soda", s: 128, lateral: 1.8 },
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
  startS: number,
  endS: number,
  stepM: number,
  profileOffsets: readonly { x: number; y: number; color: (s: number) => THREE.Color }[],
): { geometry: THREE.BufferGeometry; vertices: Float32Array; indices: Uint32Array } {
  const span = endS - startS;
  const rows = Math.floor(span / stepM) + 1;
  const cols = profileOffsets.length;
  const positions = new Float32Array(rows * cols * 3);
  const colors = new Float32Array(rows * cols * 3);
  const idxList: number[] = [];

  for (let r = 0; r < rows; r++) {
    const s = Math.min(endS, startS + r * stepM);
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

  // IMPORTANT: c increases from -width to +width along `right` = (-1, 0, 0),
  // while r increases along `+Z` = (0, 0, +1).
  // (b - a) x (d - a) = (-1, 0, 0) x (0, 0, +1) = (0, +1, 0) -> UPWARD +Y NORMAL!
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = r * cols + (c + 1);
      const d = (r + 1) * cols + c;
      const e = (r + 1) * cols + (c + 1);
      idxList.push(a, b, d, b, e, d);
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
  const cAsphaltA = new THREE.Color("#2b3340");
  const cAsphaltB = new THREE.Color("#343e4f");
  const cShoulder = new THREE.Color("#475569");
  const cYellow = new THREE.Color("#facc15");
  const cCurbRed = new THREE.Color("#dc2626");
  const cCurbWhite = new THREE.Color("#f8fafc");
  const cCheckDark = new THREE.Color("#0f172a");
  const cCheckLight = new THREE.Color("#f8fafc");
  const cJump = new THREE.Color("#ea580c");
  const cSlab = new THREE.Color("#1e293b");

  const roadColor = (s: number, zone: "skirt" | "curb" | "shoulder" | "lane" | "center"): THREE.Color => {
    if (zone === "skirt") return cSlab;
    const stripe = Math.floor((s + 20) / 3) % 2 === 0;
    if ((s >= 13 && s <= 17) || (s >= COURSE_LENGTH_M - 2.5 && s <= COURSE_LENGTH_M + 2.5)) {
      return stripe ? cCheckLight : cCheckDark;
    }
    if ((s >= 228 && s <= 252) || (s >= 548 && s <= 572)) {
      return zone === "center" ? cYellow : cJump;
    }
    if (zone === "curb") return stripe ? cCurbRed : cCurbWhite;
    if (zone === "shoulder") return cShoulder;
    if (zone === "center") return Math.floor((s + 20) / 6) % 2 === 0 ? cYellow : cAsphaltA;
    return Math.floor((s + 20) / 8) % 2 === 0 ? cAsphaltA : cAsphaltB;
  };

  const road = buildIndexedRibbon(-10, TOTAL_TRACK_M, 2.5, [
    { x: -TRACK_HALF_WIDTH - 0.8, y: -1.1, color: (s) => roadColor(s, "skirt") },
    { x: -TRACK_HALF_WIDTH - 0.65, y: 0.16, color: (s) => roadColor(s, "curb") },
    { x: -TRACK_HALF_WIDTH, y: 0.16, color: (s) => roadColor(s, "curb") },
    { x: -TRACK_HALF_WIDTH + 0.55, y: 0.01, color: (s) => roadColor(s, "shoulder") },
    { x: -0.28, y: 0.03, color: (s) => roadColor(s, "lane") },
    { x: 0, y: 0.035, color: (s) => roadColor(s, "center") },
    { x: 0.28, y: 0.03, color: (s) => roadColor(s, "lane") },
    { x: TRACK_HALF_WIDTH - 0.55, y: 0.01, color: (s) => roadColor(s, "shoulder") },
    { x: TRACK_HALF_WIDTH, y: 0.16, color: (s) => roadColor(s, "curb") },
    { x: TRACK_HALF_WIDTH + 0.65, y: 0.16, color: (s) => roadColor(s, "curb") },
    { x: TRACK_HALF_WIDTH + 0.8, y: -1.1, color: (s) => roadColor(s, "skirt") },
  ]);

  const cRailWood = new THREE.Color("#92400e");
  const cRailStripe = new THREE.Color("#d97706");
  const cRailCap = new THREE.Color("#fef08a");

  const leftWall = buildIndexedRibbon(-10, TOTAL_TRACK_M, 4, [
    { x: -TRACK_HALF_WIDTH - 1.15, y: -0.6, color: () => cRailWood },
    { x: -TRACK_HALF_WIDTH - 0.95, y: WALL_HEIGHT, color: () => cRailCap },
    { x: -TRACK_HALF_WIDTH - 0.45, y: WALL_HEIGHT, color: () => cRailCap },
    { x: -TRACK_HALF_WIDTH - 0.2, y: 0.0, color: (s) => (Math.floor((s + 20) / 8) % 2 === 0 ? cRailWood : cRailStripe) },
  ]);

  const rightWall = buildIndexedRibbon(-10, TOTAL_TRACK_M, 4, [
    { x: TRACK_HALF_WIDTH + 0.2, y: 0.0, color: (s) => (Math.floor((s + 20) / 8) % 2 === 0 ? cRailWood : cRailStripe) },
    { x: TRACK_HALF_WIDTH + 0.45, y: WALL_HEIGHT, color: () => cRailCap },
    { x: TRACK_HALF_WIDTH + 0.95, y: WALL_HEIGHT, color: () => cRailCap },
    { x: TRACK_HALF_WIDTH + 1.15, y: -0.6, color: () => cRailWood },
  ]);

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

  // Continuous canyon hillside & valley floor directly beneath the road so there is zero sky void
  const cGrassA = new THREE.Color("#2d6a4f");
  const cGrassB = new THREE.Color("#40916c");
  const cSoil = new THREE.Color("#5c4738");
  const cRidge = new THREE.Color("#4a5568");

  const terrain = buildIndexedRibbon(-20, TOTAL_TRACK_M + 40, 8, [
    { x: -160, y: 42, color: () => cRidge },
    { x: -85, y: 19, color: (s) => (Math.floor((s + 30) / 24) % 2 === 0 ? cGrassA : cGrassB) },
    { x: -32, y: 4.5, color: (s) => (Math.floor((s + 30) / 16) % 2 === 0 ? cGrassB : cGrassA) },
    { x: -TRACK_HALF_WIDTH - 1.0, y: -0.5, color: () => cSoil },
    { x: 0, y: -1.6, color: () => cSoil },
    { x: TRACK_HALF_WIDTH + 1.0, y: -0.5, color: () => cSoil },
    { x: 32, y: 4.5, color: (s) => (Math.floor((s + 30) / 16) % 2 === 0 ? cGrassA : cGrassB) },
    { x: 85, y: 19, color: (s) => (Math.floor((s + 30) / 24) % 2 === 0 ? cGrassB : cGrassA) },
    { x: 160, y: 42, color: () => cRidge },
  ]);

  return {
    roadGeometry: road.geometry,
    wallGeometry,
    terrainGeometry: terrain.geometry,
    roadVertices: road.vertices,
    roadIndices: road.indices,
    wallVertices: wallVertices,
    wallIndices: wallIndices,
  };
}
