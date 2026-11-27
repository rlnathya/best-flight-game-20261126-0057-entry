// SKYLINE — procedural island terrain, runway, town and sky.
// One height function drives both the mesh and the flight model, so the
// ground you see is exactly the ground you can hit. All placement uses a
// fixed-seed generator: the island is identical on every load.

import * as THREE from 'three';
import { WORLD, RUNWAY, RUNWAY2, clamp, smoothstep } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ridge(x, z, cx, cz, radius, height) {
  const d = Math.hypot(x - cx, z - cz) / radius;
  if (d >= 1) return 0;
  const fall = (1 - d * d) * (1 - d * d);
  return height * fall * (0.72 + 0.28 * Math.sin(x * 0.011 + z * 0.017));
}

// Height of the island at (x, z), in metres above sea level.
export function terrainHeight(x, z) {
  const dist = Math.hypot(x, z);
  const coast = 1 - smoothstep(WORLD.islandRadius * 0.82, WORLD.islandRadius * 1.18, dist);
  let h = -14 * (1 - coast); // seabed shelf outside the island
  h += 26 * coast;
  // Rolling hills: a few slow sine waves, deterministic by construction.
  h += coast * (14 * Math.sin(x * 0.0016 + 1.7) * Math.cos(z * 0.0013 - 0.6)
    + 9 * Math.sin(x * 0.0041 - z * 0.0033) + 6 * Math.cos(x * 0.007 + z * 0.005));
  // Two mountain masses, north-west and north-east.
  h += ridge(x, z, -1250, -950, 620, 265);
  h += ridge(x, z, 1350, -1150, 540, 205);
  h += ridge(x, z, 1150, 1150, 480, 120);
  // Flatten a pad for the runway and the airfield apron.
  const dx = Math.abs(x - RUNWAY.x);
  const dz = Math.abs(z - RUNWAY.z);
  const pad = 1 - smoothstep(0, 1, Math.max((dx - 130) / 170, (dz - 420) / 190));
  h = h * (1 - pad) + WORLD.runwayAltitude * pad;
  // Same for the second airfield, Harbour Field on the east coast.
  const dx2 = Math.abs(x - RUNWAY2.x);
  const dz2 = Math.abs(z - RUNWAY2.z);
  const pad2 = 1 - smoothstep(0, 1, Math.max((dx2 - 130) / 170, (dz2 - 380) / 190));
  h = h * (1 - pad2) + WORLD.runwayAltitude * pad2;
  return h;
}

function groundColor(height, x, z, out) {
  if (height < 2.5) { out.setRGB(0.85, 0.76, 0.52); return out; }       // sand
  if (height < 55) { out.setRGB(0.32, 0.55, 0.26); return out; }        // low grass
  if (height < 130) { out.setRGB(0.22, 0.45, 0.22); return out; }       // forest green
  if (height < 200) { out.setRGB(0.45, 0.42, 0.36); return out; }       // rock
  out.setRGB(0.92, 0.93, 0.95); return out;                             // snow caps
}

export function buildTerrain(scene) {
  const size = WORLD.size;
  const segments = 180;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    groundColor(h, x, z, c);
    // Gentle variation so flat areas still read as terrain.
    const v = 0.94 + 0.06 * Math.sin(x * 0.05 + z * 0.043);
    colors[i * 3] = c.r * v; colors[i * 3 + 1] = c.g * v; colors[i * 3 + 2] = c.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  scene.add(mesh);
  return mesh;
}

export function buildSea(scene) {
  const geo = new THREE.PlaneGeometry(WORLD.size * 2.4, WORLD.size * 2.4);
  geo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    color: 0x14608f, transparent: true, opacity: 0.94, shininess: 180, specular: 0xbbddff,
  }));
  sea.position.y = WORLD.seaLevel;
  scene.add(sea);
  // Surf foam where the sea meets the island: a pale annulus hugging the
  // coastline, so the shore reads from altitude.
  const foam = new THREE.Mesh(
    new THREE.RingGeometry(1930, 2130, 96),
    new THREE.MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = WORLD.seaLevel + 0.15;
  scene.add(foam);
  return sea;
}

export function buildSky(scene) {
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0x9fc8e8, 1600, 5200);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.1);
  sun.position.set(900, 1400, 500);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x3d6b3a, 0.9));
  return sun;
}

export function buildClouds(scene) {
  const group = new THREE.Group();
  const rng = mulberry32(20261126);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 34; i++) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const r = 28 + rng() * 38;
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      s.position.set((rng() - 0.5) * 150, (rng() - 0.5) * 12, (rng() - 0.5) * 70);
      s.scale.y = 0.42;
      cloud.add(s);
    }
    cloud.position.set((rng() - 0.5) * 4600, 300 + rng() * 220, (rng() - 0.5) * 4600);
    group.add(cloud);
  }
  scene.add(group);
  return group;
}

// The runway: dark asphalt, white centreline dashes, threshold bars,
// edge lights and a windsock, plus a small apron and hangar.
export function buildRunway(scene) {
  const group = new THREE.Group();
  const y = WORLD.runwayAltitude + 0.35;
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
    new THREE.MeshLambertMaterial({ color: 0x2e3136 }));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(RUNWAY.x, y, RUNWAY.z);
  group.add(asphalt);

  const white = new THREE.MeshLambertMaterial({ color: 0xf2f2ea });
  for (let i = 0; i < 9; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 26), white);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(RUNWAY.x, y + 0.06, RUNWAY.z - RUNWAY.length / 2 + 60 + i * 62);
    group.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(3, 14), white);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(RUNWAY.x + k * 6.5, y + 0.06, RUNWAY.z + end * (RUNWAY.length / 2 - 16));
      group.add(bar);
    }
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i <= 12; i++) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), lightMat);
      lamp.position.set(RUNWAY.x + side * (RUNWAY.width / 2 + 3), y + 0.8,
        RUNWAY.z - RUNWAY.length / 2 + i * (RUNWAY.length / 12));
      group.add(lamp);
    }
  }
  // Apron + hangar beside the strip.
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(150, 120),
    new THREE.MeshLambertMaterial({ color: 0x4a4d52 }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(RUNWAY.x + 105, y, RUNWAY.z + 130);
  group.add(apron);
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(46, 16, 30),
    new THREE.MeshLambertMaterial({ color: 0xcfd8de }));
  hangar.position.set(RUNWAY.x + 105, y + 8, RUNWAY.z + 175);
  group.add(hangar);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 46, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0x8a97a3 }));
  roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2;
  roof.position.set(RUNWAY.x + 105, y + 16, RUNWAY.z + 175);
  group.add(roof);
  // Windsock on a pole.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
  pole.position.set(RUNWAY.x - 42, y + 7, RUNWAY.z + 240);
  group.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 10),
    new THREE.MeshLambertMaterial({ color: 0xff7a2f }));
  sock.rotation.z = Math.PI / 2 - 0.35;
  sock.position.set(RUNWAY.x - 38, y + 13.4, RUNWAY.z + 240);
  group.add(sock);
  scene.add(group);
  return group;
}

// Coral Bay town: a tight cluster of small coloured houses with red roofs,
// plus a lighthouse on the southern point so the coast reads at a glance.
// Windows glow warm and a few street lamps stand along the main street,
// so the town stays alive from the air at any hour.
export function buildTown(scene) {
  const group = new THREE.Group();
  const rng = mulberry32(777);
  const wallColors = [0xf3e2c7, 0xffffff, 0xffd9a0, 0xcfe4f7, 0xf7c8c8];
  const winGeo = new THREE.PlaneGeometry(2.4, 3.2);
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffd97a });
  for (let i = 0; i < 54; i++) {
    const w = 9 + rng() * 10, d = 9 + rng() * 10, h = 6 + rng() * 14;
    const x = 330 + (rng() - 0.5) * 420;
    const z = 330 + (rng() - 0.5) * 380;
    const gy = terrainHeight(x, z);
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: wallColors[i % wallColors.length] }));
    house.position.set(x, gy + h / 2, z);
    house.rotation.y = rng() * Math.PI;
    group.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 4.5, 4),
      new THREE.MeshLambertMaterial({ color: 0xb3402e }));
    roof.position.set(x, gy + h + 2.2, z);
    roof.rotation.y = Math.PI / 4 + house.rotation.y;
    group.add(roof);
    // One lit window on the front face, turned with the house.
    if (rng() < 0.75) {
      const win = new THREE.Mesh(winGeo, winMat);
      const fy = house.rotation.y;
      win.position.set(
        x + Math.sin(fy) * (d / 2 + 0.08),
        gy + h * 0.45,
        z + Math.cos(fy) * (d / 2 + 0.08));
      win.rotation.y = fy;
      group.add(win);
    }
  }
  // Street lamps down the town's main street (roughly north-south).
  const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < 8; i++) {
    const x = 330 + (rng() - 0.5) * 60;
    const z = 160 + i * 48;
    const gy = terrainHeight(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 6), lampPoleMat);
    pole.position.set(x, gy + 3.5, z);
    group.add(pole);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), lampGlowMat);
    glow.position.set(x, gy + 7.2, z);
    group.add(glow);
  }
  // Lighthouse on the south point.
  const lx = 60, lz = 1750, ly = terrainHeight(lx, lz);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 34, 12),
    new THREE.MeshLambertMaterial({ color: 0xf5f0e6 }));
  tower.position.set(lx, ly + 17, lz);
  group.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 5, 12),
    new THREE.MeshLambertMaterial({ color: 0xc22e2e }));
  band.position.set(lx, ly + 24, lz);
  group.add(band);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lamp.position.set(lx, ly + 36, lz);
  group.add(lamp);
  // The beam: a long soft cone on a pivot at the lamp, spun by the main
  // loop so the lighthouse sweeps the bay. The cone's apex sits at the
  // lamp; its wide end reaches out over the water.
  const beamPivot = new THREE.Group();
  beamPivot.name = 'lighthouse-beam-pivot';
  beamPivot.position.set(lx, ly + 36, lz);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(17, 260, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false,
    }));
  beam.rotation.z = Math.PI / 2;
  beam.position.x = 130;
  beamPivot.add(beam);
  group.add(beamPivot);
  scene.add(group);
  return group;
}

export function buildTrees(scene) {
  const group = new THREE.Group();
  const rng = mulberry32(4242);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2c6b2f });
  const trunkGeo = new THREE.CylinderGeometry(0.7, 1, 6, 6);
  const leafGeo = new THREE.ConeGeometry(4.2, 13, 8);
  for (let i = 0; i < 320; i++) {
    const x = (rng() - 0.5) * 3800;
    const z = (rng() - 0.5) * 3800;
    const h = terrainHeight(x, z);
    if (h < 4 || h > 120) continue;
    if (Math.abs(x - RUNWAY.x) < 160 && Math.abs(z - RUNWAY.z) < 460) continue;
    if (Math.abs(x - RUNWAY2.x) < 160 && Math.abs(z - RUNWAY2.z) < 420) continue;
    const s = 0.7 + rng() * 0.9;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, h + 3 * s, z); trunk.scale.setScalar(s);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(x, h + (6 + 6.5) * s, z); leaf.scale.setScalar(s);
    group.add(trunk); group.add(leaf);
  }
  scene.add(group);
  return group;
}

export function isOnRunway(x, z, runway = RUNWAY) {
  return Math.abs(x - runway.x) <= runway.width / 2 + 6
    && Math.abs(z - runway.z) <= runway.length / 2 + 6;
}

// Which strip, if any, the point is on: Harbour Field first, then Coral
// Bay (the strips never overlap, so the order is only a tie-break).
export function runwayAt(x, z) {
  if (isOnRunway(x, z, RUNWAY2)) return RUNWAY2;
  if (isOnRunway(x, z, RUNWAY)) return RUNWAY;
  return null;
}
export function distanceToRunwayCentre(x, z) {
  return Math.hypot(x - RUNWAY.x, z - RUNWAY.z);
}
