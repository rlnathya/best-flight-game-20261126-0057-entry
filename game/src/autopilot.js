// SKYLINE — hands-free demo pilot.
// Flies the selected sortie end to end: take-off, ring by ring, a lined-up
// final approach with a flare, and a touchdown on the mission's own runway.
// Any manual input hands control back to the player (see main.js).
// The same module drives the headless test harness: it only reads the
// flight state and returns stick inputs in the shape readInput() makes,
// so a harness run exercises the exact code the demo button runs.

import * as THREE from 'three';
import { RUNWAY, degToRad, clamp } from './config.js';
import { eulerOf, headingDegOf, altitudeOf } from './flight.js';
import { terrainHeight } from './terrain.js';
import { nextRingPosition } from './missions.js';

const CRUISE_SPEED = 58;   // m/s between rings
const FINAL_SPEED = 46;    // m/s on the glidepath, above the 27 m/s stall
const FIX_DISTANCE = 1400; // metres out from the threshold, on centreline
const FIX_ALTITUDE = 150;  // metres, level at the fix before descending
const GLIDE_SLOPE = 0.088; // ~5 degrees: the fix altitude meets the runway
const FLARE_AGL = 13;      // metres: throttle idle, settle onto the strip
const TERRAIN_CLEARANCE = 36; // metres above the highest ground ahead

export function createAutopilot() {
  return {
    phase: 'takeoff', // takeoff | enroute | approach | final | flare
    goArounds: 0,
  };
}

function wrapDeg(a) {
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
}

// Landing direction of a strip, as a unit vector in the ground plane:
// heading 0 (runway 36) flies north (-Z), heading 180 (runway 18) south.
function landingDir(runway) {
  const r = degToRad(runway.headingDeg);
  return { x: Math.sin(r), z: -Math.cos(r) };
}

function thresholdOf(runway) {
  const d = landingDir(runway);
  return { x: runway.x - d.x * (runway.length / 2), z: runway.z - d.z * (runway.length / 2) };
}

function touchdownOf(runway) {
  const d = landingDir(runway);
  const t = thresholdOf(runway);
  return { x: t.x + d.x * 180, z: t.z + d.z * 180 };
}

function fixOf(runway) {
  const d = landingDir(runway);
  const t = thresholdOf(runway);
  return { x: t.x - d.x * FIX_DISTANCE, y: FIX_ALTITUDE, z: t.z - d.z * FIX_DISTANCE };
}

// Steer toward a point at a desired altitude and speed. Two inner loops:
// bank chases the heading error, pitch chases the vertical speed the
// altitude error asks for. Returns { pitch, roll, yaw, throttleDelta }.
function steerTo(state, target, altDes, speedDes) {
  const dx = target.x - state.pos.x;
  const dz = target.z - state.pos.z;
  const desiredHeading = Math.atan2(dx, -dz) * 180 / Math.PI;
  const headingErr = wrapDeg(desiredHeading - headingDegOf(state));
  const e = eulerOf(state);
  // Bank into the turn: a right turn needs negative Euler z (see flight.js:
  // ArrowRight rolls the wing down to the right and the nose follows).
  const bankDes = clamp(-headingErr * 0.03, -1.05, 1.05);
  const roll = clamp((e.z - bankDes) * 2.2, -1, 1);
  // Pitch inner loop: nose at the climb the altitude error asks for.
  const vsDes = clamp((altDes - state.pos.y) * 0.45, -9, 9);
  const speed = Math.max(20, state.speed);
  const pitchDes = clamp(Math.asin(clamp(vsDes / speed, -0.45, 0.45)), -0.4, 0.5);
  const pitch = clamp((pitchDes - e.x) * 3.0, -1, 1);
  const throttleDelta = clamp((speedDes - state.speed) * 0.06, -0.6, 0.6);
  return { pitch, roll, yaw: 0, throttleDelta };
}

// Highest ground under the plane and 250 m ahead of it: never fly below
// this plus clearance except on the glidepath, where the runway pad is flat.
function terrainFloor(state) {
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat);
  const ahead = terrainHeight(state.pos.x + fwd.x * 250, state.pos.z + fwd.z * 250);
  const here = terrainHeight(state.pos.x, state.pos.z);
  return Math.max(here, ahead) + TERRAIN_CLEARANCE;
}

export function autopilotInput(auto, state, dt) {
  const home = state.mission.landingRunway || RUNWAY;
  const dir = landingDir(home);
  const td = touchdownOf(home);

  // On the ground: take off again. A touchdown only finishes the mission
  // inside stepFlight itself (gentle, on the mission's own strip, rings
  // done) — so any rolling state the autopilot still sees is a refuel
  // stop, a wrong-field touchdown, or a rough-field landing, and the
  // right move in every case is to get airborne and keep flying.
  if (state.rolling) {
    auto.phase = 'takeoff';
    return { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0.6 };
  }

  switch (auto.phase) {
    case 'takeoff': {
      // Climb out straight ahead off Coral Bay until clear of the ground.
      const climbOut = {
        x: RUNWAY.x + Math.sin(degToRad(RUNWAY.headingDeg)) * 1000,
        z: RUNWAY.z - Math.cos(degToRad(RUNWAY.headingDeg)) * 1000,
      };
      const out = steerTo(state, climbOut, 130, CRUISE_SPEED);
      if (altitudeOf(state) > 30) auto.phase = 'enroute';
      return out;
    }
    case 'enroute': {
      const next = nextRingPosition(state);
      if (!next) {
        // Rings done: join the final directly when already lined up close
        // and low (the Harbour Landing last ring sits on the final leg);
        // otherwise fly out to the fix and come back down the centreline.
        // Re-enter now so this tick already flies the new phase.
        const toTd = Math.hypot(td.x - state.pos.x, td.z - state.pos.z);
        const headingErr = Math.abs(wrapDeg(home.headingDeg - headingDegOf(state)));
        const along = (state.pos.x - td.x) * dir.x + (state.pos.z - td.z) * dir.z;
        if (toTd < 900 && headingErr < 70 && state.pos.y < 120 && along < 0) {
          auto.phase = 'final';
        } else {
          auto.phase = 'approach';
        }
        return autopilotInput(auto, state, dt);
      }
      const altDes = Math.max(next.y, terrainFloor(state));
      return steerTo(state, next, altDes, CRUISE_SPEED);
    }
    case 'approach': {
      const fix = fixOf(home);
      const out = steerTo(state, fix, FIX_ALTITUDE, 52);
      const toFix = Math.hypot(fix.x - state.pos.x, fix.z - state.pos.z);
      const headingErr = Math.abs(wrapDeg(home.headingDeg - headingDegOf(state)));
      if (toFix < 280 && headingErr < 25) auto.phase = 'final';
      return out;
    }
    case 'final': {
      // Glidepath: a point 300 m past the touchdown zone keeps the nose
      // on the centreline; altitude follows the slope down to the strip.
      const aim = { x: td.x + dir.x * 300, z: td.z + dir.z * 300 };
      const toTd = Math.hypot(td.x - state.pos.x, td.z - state.pos.z);
      const altDes = 9.2 + GLIDE_SLOPE * toTd;
      const out = steerTo(state, aim, altDes, FINAL_SPEED);
      const along = (state.pos.x - td.x) * dir.x + (state.pos.z - td.z) * dir.z;
      if (altitudeOf(state) < FLARE_AGL) {
        auto.phase = 'flare';
      } else if (along > 250) {
        // Overshot the touchdown zone without landing: go around.
        auto.phase = 'approach';
        auto.goArounds += 1;
      }
      return out;
    }
    case 'flare': {
      // Throttle idle, nose held so the sink rate eases to about -1.5 m/s
      // and the wheels kiss the strip instead of slamming it.
      const vsDes = altitudeOf(state) > 6 ? -2.5 : -1.2;
      const speed = Math.max(20, state.speed);
      const e = eulerOf(state);
      const pitchDes = clamp(Math.asin(clamp(vsDes / speed, -0.45, 0.45)), -0.4, 0.5);
      const pitch = clamp((pitchDes - e.x) * 3.0, -1, 1);
      const roll = clamp((e.z - 0) * 2.2, -1, 1);
      const along = (state.pos.x - td.x) * dir.x + (state.pos.z - td.z) * dir.z;
      if (along > 400) {
        // Floated past the strip: power up and go around.
        auto.phase = 'approach';
        auto.goArounds += 1;
        return { pitch: 0.3, roll, yaw: 0, throttleDelta: 0.6 };
      }
      return { pitch, roll, yaw: 0, throttleDelta: -0.6 };
    }
    default:
      return { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0 };
  }
}
