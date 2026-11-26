// SKYLINE — entry point: scene, input, cameras, game loop, screens.
// The plane starts on Coral Bay runway. Fly the glowing rings in order,
// then land back on the strip. C toggles chase / cockpit. ?shot=1..4
// freezes a fixed pose for deterministic screenshots.

import * as THREE from 'three';
import { MISSIONS, SHOT_POSES, RUNWAY, WORLD, clamp } from './config.js';
import { buildTerrain, buildSea, buildSky, buildClouds, buildRunway, buildTown, buildTrees, terrainHeight } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { createFlightState, resetFlight, stepFlight, forwardOf, eulerOf, headingDegOf, altitudeOf, PHASE, applyShotPose, isOutOfBounds } from './flight.js';
import { createMissionRings, disposeMissionRings, updateMissionRings } from './missions.js';
import { showHud, showCockpit, updateHud, setMessage, clearMessage } from './hud.js';
import { ensureAudio, updateEngineSound, playRingChime, playTouchdown, playCrash, playClick, toggleMute } from './sound.js';

const params = new URLSearchParams(window.location.search);
const shotNumber = Number(params.get('shot') || 0);
const shotMode = shotNumber >= 1 && shotNumber <= 4;
const missionId = params.get('mission') === 'sprint' ? 'sprint' : 'tour';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 12000);

buildSky(scene);
buildTerrain(scene);
buildSea(scene);
buildClouds(scene);
buildRunway(scene);
buildTown(scene);
buildTrees(scene);

const { group: planeMesh, prop, navLights } = buildAircraft();
scene.add(planeMesh);

// Runway approach lights: a row of green threshold lamps the pilot can
// spot from the final leg, plus a windsock shadow already in the terrain.
const approachLights = new THREE.Group();
for (let i = 0; i < 5; i++) {
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x37d67a }));
  lamp.position.set(RUNWAY.x, WORLD.runwayAltitude + 1.5, RUNWAY.z + RUNWAY.length / 2 + 40 + i * 60);
  approachLights.add(lamp);
}
scene.add(approachLights);

let state = createFlightState(MISSIONS[missionId]);
let missionRings = createMissionRings(scene, state.mission);
let cameraMode = 'chase';
let selectedMission = missionId;
let lastRingCount = 0;
let wasRolling = false;
let crashedAt = 0;

// ---------------- input ----------------
const keys = new Set();
const mouse = { dragging: false, dx: 0, dy: 0, wheel: 0 };
window.addEventListener('keydown', (ev) => {
  if (ev.repeat) return;
  keys.add(ev.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
  if (ev.code === 'KeyC') toggleCamera();
  if (ev.code === 'KeyM') toggleMute();
  if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
  if (ev.code === 'KeyR') restartMission();
  if (ev.code === 'Enter' && state.phase === PHASE.MENU) startMission(selectedMission);
  ensureAudio();
});
window.addEventListener('keyup', (ev) => keys.delete(ev.code));
canvas.addEventListener('mousedown', (ev) => { mouse.dragging = true; mouse.dx = 0; mouse.dy = 0; });
window.addEventListener('mouseup', () => { mouse.dragging = false; });
window.addEventListener('mousemove', (ev) => {
  if (!mouse.dragging) return;
  mouse.dx += ev.movementX || 0;
  mouse.dy += ev.movementY || 0;
});
canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  mouse.wheel += ev.deltaY < 0 ? 0.12 : -0.12;
}, { passive: false });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function readInput(dt) {
  let pitch = 0, roll = 0, yaw = 0;
  if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) pitch -= 1;
  if (keys.has('ArrowLeft')) roll -= 1;
  if (keys.has('ArrowRight')) roll += 1;
  if (keys.has('KeyA')) yaw += 1;
  if (keys.has('KeyD')) yaw -= 1;
  if (keys.has('KeyQ')) yaw += 0.7;
  if (keys.has('KeyE')) yaw -= 0.7;
  // Mouse drag steers: drag right to bank right, drag up to pitch down.
  if (mouse.dragging) {
    roll += clamp(mouse.dx / 90, -1, 1);
    pitch -= clamp(mouse.dy / 90, -1, 1);
    mouse.dx *= 0.86; mouse.dy *= 0.86;
  }
  let throttleDelta = 0;
  if (keys.has('ShiftLeft') || keys.has('ShiftRight')) throttleDelta += 0.55;
  if (keys.has('ControlLeft') || keys.has('ControlRight')) throttleDelta -= 0.55;
  throttleDelta += mouse.wheel * 4;
  mouse.wheel = 0;
  return { pitch: clamp(pitch, -1, 1), roll: clamp(roll, -1, 1), yaw: clamp(yaw, -1, 1), throttleDelta };
}

function toggleCamera() {
  cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
  showCockpit(cameraMode === 'cockpit' && state.phase === PHASE.FLYING);
}
function togglePause() {
  if (state.phase === PHASE.FLYING) {
    state.phase = PHASE.PAUSED;
    setMessage('PAUSED', 'Press P to keep flying — R restarts the sortie');
  } else if (state.phase === PHASE.PAUSED) {
    state.phase = PHASE.FLYING;
    clearMessage();
  }
}

// ---------------- screens ----------------
const menuEl = document.getElementById('menu');
const endEl = document.getElementById('end');

function startMission(id) {
  selectedMission = id;
  disposeMissionRings(scene, missionRings);
  resetFlight(state, MISSIONS[id]);
  missionRings = createMissionRings(scene, state.mission);
  lastRingCount = 0; wasRolling = false;
  state.rolling = true;
  state.throttle = 0.35;
  menuEl.classList.add('hidden');
  endEl.classList.add('hidden');
  showHud(true);
  showCockpit(cameraMode === 'cockpit');
  ensureAudio();
  playClick();
  setMessage(`${state.mission.name.toUpperCase()}`, state.mission.blurb);
  state.messageUntil = state.elapsed + 4;
}

function restartMission() {
  if (state.phase === PHASE.MENU) return;
  startMission(selectedMission);
}

function showEnd(title, sub, statsHtml) {
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-sub').textContent = sub;
  document.getElementById('end-stats').innerHTML = statsHtml;
  endEl.classList.remove('hidden');
  showCockpit(false);
}

function statsHtml(state) {
  const f = state.finish || { timeBonus: 0, fuelBonus: 0, landingBonus: 0 };
  return `Rings flown <b>${state.ringsPassed} / ${state.mission.rings.length}</b><br>` +
    `Time <b>${Math.round(state.time)} s</b> &middot; time bonus <b>+${f.timeBonus}</b><br>` +
    `Fuel left <b>${Math.round(state.fuel)}%</b> &middot; fuel bonus <b>+${f.fuelBonus}</b><br>` +
    `Landing bonus <b>+${f.landingBonus}</b><br>` +
    `<span style="font-size:22px">FINAL SCORE <b>${state.score}</b></span>`;
}

document.getElementById('start-btn').addEventListener('click', () => startMission(selectedMission));
document.getElementById('again-btn').addEventListener('click', () => restartMission());
document.getElementById('menu-btn').addEventListener('click', () => {
  state.phase = PHASE.MENU;
  endEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
  showHud(false); showCockpit(false);
});
document.querySelectorAll('.mission-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mission-btn').forEach((b) => b.classList.remove('sel'));
    btn.classList.add('sel');
    selectedMission = btn.dataset.mission;
    playClick();
  });
});

// ---------------- cameras ----------------
const chaseOffset = new THREE.Vector3();
const chaseLook = new THREE.Vector3();
function updateCamera(dt) {
  const fwd = forwardOf(state);
  if (cameraMode === 'cockpit') {
    // Sit high in the canopy, looking forward and slightly down over the
    // nose, so the runway and the next ring stay in view.
    const eye = state.pos.clone().addScaledVector(fwd, 0.3);
    eye.y += 1.75;
    camera.position.copy(eye);
    camera.up.set(0, 1, 0);
    const target = eye.clone().addScaledVector(fwd, 10);
    target.y -= 1.0;
    camera.lookAt(target);
    camera.fov = 72;
  } else {
    // Three-quarter chase: behind, above and a touch to the side, so the
    // whole aircraft reads instead of just its tail.
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(state.quat);
    const back = fwd.clone().multiplyScalar(-14).addScaledVector(right, 5);
    back.y += 3.4;
    chaseOffset.copy(state.pos).add(back);
    // Keep the chase camera out of the terrain.
    const ground = terrainHeight(chaseOffset.x, chaseOffset.z);
    chaseOffset.y = Math.max(chaseOffset.y, ground + 3);
    camera.position.lerp(chaseOffset, 1 - Math.exp(-dt * 6));
    chaseLook.copy(state.pos).addScaledVector(fwd, 26);
    camera.up.set(0, 1, 0);
    camera.lookAt(chaseLook);
    camera.fov = 62;
  }
  camera.updateProjectionMatrix();
}

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let frames = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  frames += 1;

  if (shotMode) {
    // Deterministic frame: pose is re-applied every frame, no physics drift.
    const pose = SHOT_POSES[shotNumber];
    applyShotPose(state, pose);
    cameraMode = pose.camera;
    state.ringsPassed = shotNumber === 4 ? 7 : shotNumber - 1;
    state.score = state.ringsPassed * 1000;
    state.time = 95 + shotNumber * 23;
    state.fuel = 78 - shotNumber * 4;
    updateHud(state);
    updateMissionRings(state, missionRings, 0);
    planeMesh.position.copy(state.pos);
    planeMesh.quaternion.copy(state.quat);
    prop.rotation.z = 0.7; // fixed diagonal blades: a deterministic frame
    updateCamera(1);
    renderer.render(scene, camera);
    return;
  }

  if (state.phase === PHASE.FLYING) {
    const input = readInput(dt);
    stepFlight(state, input, dt);
    if (updateMissionRings(state, missionRings, state.elapsed)) playRingChime();
    if (!wasRolling && state.rolling && state.landed) playTouchdown();
    wasRolling = state.rolling;
    if (state.ringsPassed !== lastRingCount) lastRingCount = state.ringsPassed;
    if (isOutOfBounds(state)) {
      setMessage('TURN BACK', 'You are leaving the island — the sea goes on forever');
    }
    updateEngineSound(state.throttle, state.speed);
  }

  if (state.phase === PHASE.COMPLETE && !endEl.classList.contains('hidden') === false) {
    showEnd('MISSION COMPLETE', `${state.mission.name} — all rings flown, wheels on the runway.`, statsHtml(state));
    playTouchdown();
  }
  if (state.phase === PHASE.CRASHED && frames - crashedAt > 30) {
    if (crashedAt === 0) { crashedAt = frames; playCrash(); }
    if (endEl.classList.contains('hidden')) {
      showEnd('CRASHED', state.crashReason, statsHtml(state));
    }
  }
  if (state.phase === PHASE.CRASHED && crashedAt === 0) crashedAt = frames;

  // Menu idle: slow orbit around the parked plane so the menu is alive.
  if (state.phase === PHASE.MENU) {
    const t = clock.elapsedTime * 0.08;
    camera.position.set(
      state.pos.x + Math.cos(t) * 26,
      state.pos.y + 9 + Math.sin(t * 0.7) * 2,
      state.pos.z + Math.sin(t) * 26);
    camera.lookAt(state.pos.x, state.pos.y + 1, state.pos.z);
    camera.fov = 55;
    camera.updateProjectionMatrix();
  } else {
    updateCamera(dt);
  }

  planeMesh.position.copy(state.pos);
  planeMesh.quaternion.copy(state.quat);
  // Propeller spins with throttle; nav lights blink.
  prop.rotation.z += dt * (4 + state.throttle * 26 + state.speed * 0.25);
  const blink = Math.sin(clock.elapsedTime * 4) > 0;
  navLights.forEach((lamp) => { lamp.visible = blink || lamp === navLights[2]; });

  if (state.phase === PHASE.FLYING || state.phase === PHASE.PAUSED) updateHud(state);
  renderer.render(scene, camera);
}

// Screenshot mode starts flying immediately, menu hidden, HUD on.
if (shotMode) {
  const pose = SHOT_POSES[shotNumber];
  cameraMode = pose.camera;
  menuEl.classList.add('hidden');
  document.getElementById('loading').remove();
  showHud(true);
  showCockpit(cameraMode === 'cockpit');
  state.mission = MISSIONS.tour;
  applyShotPose(state, pose);
  state.ringsPassed = shotNumber === 4 ? 7 : shotNumber - 1;
  state.score = state.ringsPassed * 1000;
  state.time = 95 + shotNumber * 23;
  state.fuel = 78 - shotNumber * 4;
  // Ring colours: passed rings green, next ring orange.
  missionRings.rings.forEach((ring, i) => {
    if (i < state.ringsPassed) {
      ring.children.forEach((c) => { if (c.material && c.material.color) c.material.color.set(0x37d67a); });
    }
  });
  const next = missionRings.rings[state.ringsPassed];
  if (next) {
    missionRings.beacon.position.copy(next.position);
    missionRings.beacon.position.y += 380;
  }
  updateHud(state);
} else {
  document.getElementById('loading').remove();
}

animate();
window.__skyline = { state, get phase() { return state.phase; }, startMission, restartMission };
