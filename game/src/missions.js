// SKYLINE — mission rings: placement, pass detection and the next-ring beacon.
// Rings hang in the air facing the pilot's approach line, so each one reads
// as a gate to fly through rather than a floating hoop.

import * as THREE from 'three';
import { RING_RADIUS, RUNWAY } from './config.js';
import { buildRing } from './aircraft.js';
import { checkRing } from './flight.js';

export function createMissionRings(scene, mission) {
  const rings = mission.rings.map((r, i) => {
    const group = buildRing(RING_RADIUS);
    group.position.set(r.x, r.y, r.z);
    // Face the ring toward the previous point (or the runway for ring 0)
    // so the pilot always sees the hole, not the edge.
    const from = i === 0
      ? { x: 0, y: 40, z: 0 }
      : mission.rings[i - 1];
    const dir = new THREE.Vector3(r.x - from.x, r.y - from.y, r.z - from.z).normalize();
    group.lookAt(new THREE.Vector3(r.x, r.y, r.z).add(dir));
    group.userData.passed = false;
    group.userData.index = i;
    scene.add(group);
    return group;
  });
  // A tall light beam over the next ring so it can be found from anywhere.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 900, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffc23d, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false,
    }));
  beacon.position.copy(rings[0].position);
  beacon.position.y += 380;
  scene.add(beacon);
  return { rings, beacon };
}

export function disposeMissionRings(scene, missionRings) {
  for (const ring of missionRings.rings) scene.remove(ring);
  scene.remove(missionRings.beacon);
}

// Returns true when the next ring was just passed.
export function updateMissionRings(state, missionRings, elapsed) {
  const next = missionRings.rings[state.ringsPassed];
  if (!next) return false;
  const passed = checkRing(state, next.position, RING_RADIUS * 0.92);
  if (passed) {
    next.children.forEach((child) => {
      if (child.material && child.material.color) child.material.color.set(0x37d67a);
    });
    const after = missionRings.rings[state.ringsPassed];
    if (after) {
      missionRings.beacon.position.copy(after.position);
      missionRings.beacon.position.y += 380;
    } else {
      missionRings.beacon.visible = false;
      const home = state.mission.landingRunway || RUNWAY;
      state.message = `ALL RINGS CLEAR — land on ${home.label} (${home.name}) to finish!`;
      state.messageUntil = state.elapsed + 5;
    }
    return true;
  }
  // Pulse the next ring so it stands out against the terrain.
  const s = 1 + 0.05 * Math.sin(elapsed * 4);
  next.scale.setScalar(s);
  return false;
}

export function nextRingPosition(state) {
  if (state.ringsPassed >= state.mission.rings.length) return null;
  const r = state.mission.rings[state.ringsPassed];
  return new THREE.Vector3(r.x, r.y, r.z);
}

// Bearing from the plane to the next objective, in degrees (0 = north).
export function bearingToNext(state) {
  const home = state.mission.landingRunway || RUNWAY;
  const target = nextRingPosition(state)
    || new THREE.Vector3(home.x, 10, home.z); // home strip when rings are done
  const dx = target.x - state.pos.x;
  const dz = target.z - state.pos.z;
  let b = Math.atan2(dx, -dz) * 180 / Math.PI;
  if (b < 0) b += 360;
  return { bearing: b, distance: Math.hypot(dx, dz, target.y - state.pos.y) };
}
