// SKYLINE — shared tuning numbers and mission definitions.
// Every value here is picked so the plane feels like a light prop tourer:
// honest at cruise, forgiving in a turn, and honest about a stall.

export const WORLD = {
  size: 5200,          // terrain plane, metres across
  islandRadius: 2050,  // island fades into sea past this
  seaLevel: 0.5,
  runwayAltitude: 7,   // flattened strip the runway sits on
};

export const RUNWAY = {
  x: 0, z: -260,       // centre of the strip
  length: 640, width: 42,
  headingDeg: 0,       // strip runs north-south (along -Z take-off)
  name: 'Coral Bay',   // home airfield, land heading north
  label: 'RUNWAY 36',
};

// Second airfield on the east coast, beside the town: a shorter strip the
// Harbour Landing sortie finishes on, landing southbound.
export const RUNWAY2 = {
  x: 1350, z: 420,     // centre of the strip
  length: 560, width: 40,
  headingDeg: 180,     // land heading south, over the north threshold
  name: 'Harbour Field',
  label: 'RUNWAY 18',
};

export const PLANE = {
  maxSpeed: 92,        // m/s, full throttle level flight
  cruiseSpeed: 58,
  stallSpeed: 27,      // below this the wing quits
  takeoffSpeed: 34,
  accel: 15,           // m/s^2 at full throttle
  drag: 0.0016,        // quadratic drag coefficient
  pitchRate: 0.65,     // rad/s at full stick
  rollRate: 1.9,
  yawRate: 0.55,
  climbPenalty: 9.8,   // gravity component along the flight path
  fuelBurn: 0.2,       // % per second at full throttle
  fuelBurnIdle: 0.08,
};

export const RING_RADIUS = 30;

// Three sorties over the same island. Tour is the gentle introduction;
// Sprint is lower, tighter and thirstier, with a par time to beat;
// Harbour Landing threads six rings east across the island and finishes
// with a southbound landing on the second airfield, Harbour Field.
// Every mission takes off from Coral Bay; `landingRunway` says which
// strip the sortie must finish on (Coral Bay when omitted).
export const MISSIONS = {
  tour: {
    id: 'tour',
    name: 'Island Tour',
    blurb: 'Thread all 8 rings over Coral Bay, then land on runway 36.',
    parSeconds: 420,
    fuel: 100,
    rings: [
      { x: 0,    y: 110, z: -900 },
      { x: -560, y: 150, z: -1150 },
      { x: -1250, y: 210, z: -700 },
      { x: -1050, y: 260, z: 250 },
      { x: -250, y: 190, z: 1050 },
      { x: 700,  y: 160, z: 900 },
      { x: 1250, y: 220, z: 150 },
      { x: 620,  y: 120, z: -650 },
    ],
  },
  sprint: {
    id: 'sprint',
    name: 'Sunset Sprint',
    blurb: 'Five low rings, little fuel, beat the clock — then land.',
    parSeconds: 240,
    fuel: 80,
    rings: [
      { x: -300, y: 70,  z: -1000 },
      { x: -1100, y: 95, z: -250 },
      { x: -500, y: 80,  z: 950 },
      { x: 800,  y: 90,  z: 700 },
      { x: 900,  y: 110, z: -500 },
    ],
  },
  landing: {
    id: 'landing',
    name: 'Harbour Landing',
    blurb: 'Six rings east across the island, then a southbound landing on Harbour Field runway 18.',
    parSeconds: 300,
    fuel: 90,
    landingRunway: RUNWAY2,
    rings: [
      { x: 350,  y: 140, z: -700 },
      { x: 950,  y: 160, z: -500 },
      { x: 1400, y: 120, z: -300 },
      { x: 1750, y: 110, z: -100 },
      { x: 1350, y: 70,  z: -250 },
      { x: 1350, y: 45,  z: 60 },
    ],
  },
};

// Fixed screenshot poses: plane position, heading and camera for each
// ?shot=1..4 frame, so every render is identical run to run.
// 1: cover — chase view, first tour ring dead ahead.
// 2: cockpit over the town, next ring beyond the rooftops.
// 3: chase on short final to Harbour Field runway 18, ring + strip ahead.
// 4: chase high over the north-west mountains, sea and clouds ahead.
export const SHOT_POSES = {
  1: { mission: 'tour', pos: [0, 120, -600], headingDeg: 0, pitchDeg: -2, speed: 62, throttle: 0.62, camera: 'chase', ringsPassed: 0 },
  2: { mission: 'tour', pos: [600, 140, 0], headingDeg: 140, pitchDeg: -4, speed: 58, throttle: 0.55, camera: 'cockpit', ringsPassed: 4 },
  3: { mission: 'landing', pos: [1350, 75, -350], headingDeg: 180, pitchDeg: -3, speed: 55, throttle: 0.5, camera: 'chase', ringsPassed: 5 },
  4: { mission: 'tour', pos: [1100, 280, 1400], headingDeg: 20, pitchDeg: -2, speed: 66, throttle: 0.7, camera: 'chase', ringsPassed: 2 },
};

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
export function degToRad(d) { return (d * Math.PI) / 180; }
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
