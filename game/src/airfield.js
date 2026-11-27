// SKYLINE — the second airfield, Harbour Field on the east coast.
// A shorter strip than Coral Bay, with its own markings, edge lights,
// windsock and hangar, plus a row of green approach lamps north of its
// threshold: the Harbour Landing sortie comes in southbound over them.
// The strip is placed by RUNWAY2 in config.js; the flattened pad under
// it is carved by terrainHeight in terrain.js.

import * as THREE from 'three';
import { WORLD, RUNWAY2 } from './config.js';

export function buildSecondAirfield(scene) {
  const group = new THREE.Group();
  const y = WORLD.runwayAltitude + 0.35;
  const R = RUNWAY2;

  // Asphalt strip.
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(R.width, R.length),
    new THREE.MeshLambertMaterial({ color: 0x33363b }));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(R.x, y, R.z);
  group.add(asphalt);

  // Centreline dashes and threshold bars at both ends.
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f2ea });
  for (let i = 0; i < 8; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 24), white);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(R.x, y + 0.06, R.z - R.length / 2 + 55 + i * 58);
    group.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(3, 13), white);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(R.x + k * 6.5, y + 0.06, R.z + end * (R.length / 2 - 15));
      group.add(bar);
    }
  }
  // Edge lights down both sides.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i <= 10; i++) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), lightMat);
      lamp.position.set(R.x + side * (R.width / 2 + 3), y + 0.8,
        R.z - R.length / 2 + i * (R.length / 10));
      group.add(lamp);
    }
  }
  // Green approach lamps north of the threshold: the pilot lands
  // southbound, so the final leg comes down this row of lights.
  const approachMat = new THREE.MeshBasicMaterial({ color: 0x37d67a });
  for (let i = 0; i < 5; i++) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), approachMat);
    lamp.position.set(R.x, y + 1.5, R.z - R.length / 2 - 40 - i * 60);
    group.add(lamp);
  }
  // Apron + hangar east of the strip.
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(120, 100),
    new THREE.MeshLambertMaterial({ color: 0x4a4d52 }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(R.x + 95, y, R.z + 110);
  group.add(apron);
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(40, 14, 26),
    new THREE.MeshLambertMaterial({ color: 0xd8c9a3 }));
  hangar.position.set(R.x + 95, y + 7, R.z + 150);
  group.add(hangar);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 40, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0x7a6a4f }));
  roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2;
  roof.position.set(R.x + 95, y + 14, R.z + 150);
  group.add(roof);
  // Windsock west of the strip.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
  pole.position.set(R.x - 40, y + 7, R.z - 180);
  group.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 10),
    new THREE.MeshLambertMaterial({ color: 0xff7a2f }));
  sock.rotation.z = -Math.PI / 2 + 0.35;
  sock.position.set(R.x - 36, y + 13.4, R.z - 180);
  group.add(sock);

  scene.add(group);
  return group;
}
