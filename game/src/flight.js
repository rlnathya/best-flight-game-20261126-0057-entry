// SKYLINE — flight model and game state.
// Arcade physics with honest consequences: throttle makes speed, speed
// makes lift, the nose follows the stick, and below stall speed the wing
// quits and the nose drops. Ground, sea, runway and ring checks live here.

import * as THREE from 'three';
import { PLANE, RUNWAY, WORLD, clamp, degToRad } from './config.js';
import { terrainHeight, isOnRunway } from './terrain.js';

export const PHASE = {
  MENU: 'menu',
  FLYING: 'flying',
  PAUSED: 'paused',
  COMPLETE: 'complete',
  CRASHED: 'crashed',
};

export function createFlightState(mission) {
  return {
    phase: PHASE.MENU,
    mission,
    pos: new THREE.Vector3(RUNWAY.x, WORLD.runwayAltitude + 2.2, RUNWAY.z + 200),
    quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),
    speed: 0,
    throttle: 0,
    fuel: mission.fuel,
    damage: 0,
    score: 0,
    ringsPassed: 0,
    time: 0,
    verticalSpeed: 0,
    stalled: false,
    landed: false,
    rolling: false,
    message: '',
    messageUntil: 0,
    crashReason: '',
    // Smoothed stick inputs so the plane never snaps.
    pitchInput: 0, rollInput: 0, yawInput: 0,
    pitchTarget: 0, rollTarget: 0, yawTarget: 0,
    elapsed: 0,
  };
}

export function resetFlight(state, mission) {
  const fresh = createFlightState(mission);
  Object.assign(state, fresh);
  state.phase = PHASE.FLYING;
}

export function forwardOf(state) {
  return new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat);
}

export function eulerOf(state) {
  return new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
}

export function headingDegOf(state) {
  const f = forwardOf(state);
  // Compass heading, clockwise from north (-Z): 0 north, 90 east (+X).
  // The Euler yaw is the negative of this, so the heading is atan2(f.x, -f.z).
  let h = Math.atan2(f.x, -f.z) * 180 / Math.PI;
  if (h < 0) h += 360;
  return h;
}

export function altitudeOf(state) {
  return state.pos.y - terrainHeight(state.pos.x, state.pos.z);
}

export function applyShotPose(state, pose) {
  state.pos.set(pose.pos[0], pose.pos[1], pose.pos[2]);
  const e = new THREE.Euler(degToRad(pose.pitchDeg || 0), degToRad(pose.headingDeg), 0, 'YXZ');
  state.quat.setFromEuler(e);
  state.speed = pose.speed;
  state.throttle = pose.throttle;
  state.phase = PHASE.FLYING;
  state.fuel = state.mission.fuel;
}

// One physics step. `input` is { pitch, roll, yaw, throttleDelta } in -1..1.
export function stepFlight(state, input, dt) {
  if (state.phase !== PHASE.FLYING) return;
  dt = Math.min(dt, 0.05);
  state.time += dt;
  state.elapsed += dt;

  // Throttle: Shift/Ctrl keys and the mouse wheel feed throttleDelta.
  state.throttle = clamp(state.throttle + input.throttleDelta * dt, 0, 1);

  // Smooth the stick toward its target so rolls feel weighted.
  state.pitchTarget = clamp(input.pitch, -1, 1);
  state.rollTarget = clamp(input.roll, -1, 1);
  state.yawTarget = clamp(input.yaw, -1, 1);
  const k = 1 - Math.exp(-dt * 7);
  state.pitchInput += (state.pitchTarget - state.pitchInput) * k;
  state.rollInput += (state.rollTarget - state.rollInput) * k;
  state.yawInput += (state.yawTarget - state.yawInput) * k;

  const e = eulerOf(state);

  if (state.rolling) {
    // Rolling on the runway: steer gently, accelerate, lift off at speed.
    e.y -= state.rollInput * 0.35 * dt;
    e.x = 0; e.z *= Math.max(0, 1 - dt * 3);
    state.quat.setFromEuler(e);
    state.speed += (state.throttle * PLANE.accel * 1.15 - state.speed * 0.02) * dt;
    state.pos.addScaledVector(forwardOf(state), state.speed * dt);
    state.pos.y = terrainHeight(state.pos.x, state.pos.z) + 2.2;
    if (state.speed >= PLANE.takeoffSpeed && state.throttle > 0.35) {
      state.rolling = false;
      state.message = 'AIRBORNE — gear up, fly the rings!';
      state.messageUntil = state.elapsed + 3;
    }
    burnFuel(state, dt);
    return;
  }

  // In the air: pitch and roll rotate about the plane's own axes, but the
  // turn itself rotates about the WORLD vertical: banking tilts the local
  // yaw axis sideways, and yawing about it would pitch the nose down
  // into a spiral dive instead of turning the plane.
  const pitchRate = state.pitchInput * PLANE.pitchRate;
  const rollRate = -state.rollInput * PLANE.rollRate;
  const bank = e.z;
  const yawRate = state.yawInput * PLANE.yawRate + Math.sin(bank) * 0.75;
  const dqLocal = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(pitchRate * dt, 0, rollRate * dt, 'XYZ'));
  state.quat.multiply(dqLocal).normalize();
  if (yawRate !== 0) {
    const dqYaw = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), yawRate * dt);
    state.quat.premultiply(dqYaw).normalize();
  }
  // Arcade limits: the tourer can climb steeply and bank hard, but it
  // cannot loop on a held stick — the nose stops at +37° and the bank
  // at 72°, so a held ArrowUp is a climb, never a somersault.
  const ce = eulerOf(state);
  ce.x = clamp(ce.x, -0.45, 0.65);
  ce.z = clamp(ce.z, -1.25, 1.25);
  state.quat.setFromEuler(ce);

  // Speed: thrust minus drag, minus the climb penalty, plus a dive gain.
  const fwd = forwardOf(state);
  const climb = fwd.y; // +1 straight up, -1 straight down
  const thrust = state.throttle * PLANE.accel * (state.throttle > 0.02 ? 1 : 0);
  const drag = PLANE.drag * state.speed * state.speed + 0.35;
  state.speed += (thrust - drag - PLANE.climbPenalty * climb) * dt;
  state.speed = clamp(state.speed, 0, PLANE.maxSpeed * 1.25);

  // Stall: below stall speed lift collapses, the nose drops, speed bleeds.
  state.stalled = state.speed < PLANE.stallSpeed;
  let sink = 0;
  if (state.stalled) {
    sink = (PLANE.stallSpeed - state.speed) * 0.55 + 2.5;
    const drop = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55 * dt, 0, 0, 'XYZ'));
    state.quat.multiply(drop).normalize();
  }
  const fwd2 = forwardOf(state);
  state.pos.addScaledVector(fwd2, state.speed * dt);
  state.pos.y -= sink * dt;
  state.verticalSpeed = fwd2.y * state.speed - sink;

  burnFuel(state, dt);
  if (state.fuel <= 0) {
    state.fuel = 0;
    state.throttle = Math.max(0, state.throttle - dt * 0.5);
    if (state.throttle === 0 && state.speed < PLANE.stallSpeed) {
      state.message = 'OUT OF FUEL — glide to the runway!';
      state.messageUntil = state.elapsed + 2;
    }
  }

  checkGround(state);
}

function burnFuel(state, dt) {
  const burn = PLANE.fuelBurnIdle + (PLANE.fuelBurn - PLANE.fuelBurnIdle) * state.throttle;
  state.fuel = Math.max(0, state.fuel - burn * dt);
}

function checkGround(state) {
  const ground = terrainHeight(state.pos.x, state.pos.z);
  const agl = state.pos.y - ground;
  const onWater = ground < WORLD.seaLevel + 1.2;
  if (agl > 2.4) return;
  // Only ground contact counts when the plane is actually coming down —
  // a fresh take-off climbing away just above the strip is still flying.
  // The one exception is intersecting terrain (agl near zero or below),
  // which is contact whatever the vertical speed says.
  if (state.verticalSpeed > -0.5 && agl > 0.5) return;

  const e = eulerOf(state);
  const descent = -state.verticalSpeed;
  const gentle = descent < 6 && state.speed < 58 && Math.abs(e.z) < 0.3 && Math.abs(e.x) < 0.22;
  if (isOnRunway(state.pos.x, state.pos.z) && gentle) {
    // Touchdown on the strip: roll out, refuel, finish the mission.
    state.pos.y = ground + 2.2;
    state.rolling = true;
    state.landed = true;
    state.fuel = Math.min(100, state.fuel + 40);
    if (state.ringsPassed >= state.mission.rings.length) {
      finishMission(state, 'landed');
    } else if (state.elapsed - (state.touchdownBonusAt ?? -99) > 15) {
      state.touchdownBonusAt = state.elapsed;
      state.message = 'TOUCHDOWN — refuelled. Take off and finish the rings!';
      state.messageUntil = state.elapsed + 4;
      state.score += 250;
    }
    return;
  }
  if (onWater) {
    crash(state, 'Ditched in the sea — Coral Bay claims another one.');
    return;
  }
  if (descent > 12 || state.speed > 75) {
    crash(state, 'Crashed into the terrain. Mind the mountains and your speed.');
    return;
  }
  if (Math.abs(e.z) > 0.6) {
    // Touchdown with a wing down: a wing strike, not a landing. It costs
    // the airframe and the plane taxis away shaken, if it can.
    state.damage = Math.min(100, state.damage + 40);
    state.pos.y = ground + 2.2;
    state.speed *= 0.4;
    state.rolling = true;
    state.message = 'WING STRIKE — 40% damage! Level the wings before touchdown.';
    state.messageUntil = state.elapsed + 4;
    if (state.damage >= 100) crash(state, 'Airframe written off after too many rough landings.');
    return;
  }
  // Hard but survivable off-runway touchdown: damage, then taxi on the
  // field — it can take off again or roll to the runway.
  state.damage = Math.min(100, state.damage + 25);
  state.pos.y = ground + 2.2;
  state.speed *= 0.45;
  state.rolling = true;
  state.message = 'ROUGH FIELD LANDING — 25% damage! Get airborne or taxi to the runway.';
  state.messageUntil = state.elapsed + 4;
  if (state.damage >= 100) crash(state, 'Airframe written off after too many rough landings.');
}

export function crash(state, reason) {
  state.phase = PHASE.CRASHED;
  state.crashReason = reason;
  state.damage = 100;
}

export function finishMission(state, how) {
  const timeBonus = Math.max(0, Math.round((state.mission.parSeconds - state.time) * 10));
  const fuelBonus = Math.round(state.fuel * 10);
  const landingBonus = how === 'landed' ? 2000 : 0;
  state.score += timeBonus + fuelBonus + landingBonus;
  state.phase = PHASE.COMPLETE;
  state.finish = { timeBonus, fuelBonus, landingBonus, how };
}

// Ring pass: the next ring only, within its radius, near its plane.
export function checkRing(state, ringPos, radius) {
  if (state.phase !== PHASE.FLYING) return false;
  const d = state.pos.distanceTo(ringPos);
  if (d < radius) {
    state.ringsPassed += 1;
    state.score += 1000;
    state.message = `RING ${state.ringsPassed} / ${state.mission.rings.length} — +1000`;
    state.messageUntil = state.elapsed + 2.5;
    return true;
  }
  return false;
}

export function isOutOfBounds(state) {
  return Math.hypot(state.pos.x, state.pos.z) > WORLD.islandRadius + 700;
}
