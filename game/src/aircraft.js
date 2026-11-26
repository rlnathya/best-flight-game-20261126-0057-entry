// SKYLINE — the aircraft, built from plain Three.js geometry.
// A bright orange-and-white prop tourer: rounded fuselage, glass canopy,
// high wing, tail feathers, landing gear and a spinning propeller.
// Forward is -Z in the model's local space.

import * as THREE from 'three';

export function buildAircraft() {
  const plane = new THREE.Group();
  const orange = new THREE.MeshLambertMaterial({ color: 0xff6a1a });
  const white = new THREE.MeshLambertMaterial({ color: 0xf4f6f8 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22282e });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x9fd8ff, shininess: 140, specular: 0xffffff, transparent: true, opacity: 0.85,
  });
  const metal = new THREE.MeshLambertMaterial({ color: 0x8a97a3 });

  // Fuselage: tapered cylinder along Z, nose forward (-Z).
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.72, 7.6, 14), white);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.4;
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 10), orange);
  nose.scale.set(1, 1, 1.5);
  nose.position.z = -3.4;
  plane.add(nose);
  // Orange cheatline stripe along each side.
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 6.4), orange);
    stripe.position.set(side * 0.98, -0.1, 0.5);
    plane.add(stripe);
  }
  // Glass canopy over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), glass);
  canopy.scale.set(0.95, 0.75, 1.7);
  canopy.position.set(0, 0.85, -0.9);
  plane.add(canopy);
  // Main wing, high on the fuselage, with orange tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.28, 2.1), white);
  wing.position.set(0, 0.85, -0.4);
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 2.1), orange);
    tip.position.set(side * 6.2, 0.85, -0.4);
    plane.add(tip);
    // Wing struts down to the fuselage.
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 6), metal);
    strut.position.set(side * 2.6, -0.05, -0.4);
    strut.rotation.z = side * 0.5;
    plane.add(strut);
  }
  // Tail: horizontal stabiliser + fin, orange.
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 1.5), orange);
  tailWing.position.set(0, 0.35, 4.1);
  plane.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 1.7), orange);
  fin.position.set(0, 1.25, 4.1);
  plane.add(fin);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.18, 1.6, 10), white);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 4.6;
  plane.add(tailCone);
  // Propeller: spinner + two blades, spins in the loop.
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 12), dark);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.4;
  prop.add(spinner);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.4, 0.12), dark);
    blade.rotation.z = a;
    prop.add(blade);
  }
  prop.position.z = -4.55;
  plane.add(prop);
  // Landing gear: two mains + tail wheel, with fairings.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 6), metal);
    leg.position.set(side * 1.1, -1.25, -1.2);
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.1, -1.9, -1.2);
    plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -1.05, 4.4);
  plane.add(tailWheel);
  // Navigation lights: red left, green right, white tail.
  const navLights = [];
  for (const [side, color] of [[-1, 0xff2222], [1, 0x22ff66]]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color }));
    lamp.position.set(side * 6.7, 0.85, -0.4);
    plane.add(lamp); navLights.push(lamp);
  }
  const tailLamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  tailLamp.position.set(0, 0.35, 5.45);
  plane.add(tailLamp); navLights.push(tailLamp);

  plane.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group: plane, prop, navLights };
}

// A glowing ring the pilot flies through. Passed rings turn green.
export function buildRing(radius) {
  const group = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 2.4, 12, 40),
    new THREE.MeshBasicMaterial({ color: 0xffa500 }));
  group.add(torus);
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 1.1, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  group.add(inner);
  // Small chevron markers around the rim so the ring reads from afar.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    group.add(dot);
  }
  return group;
}
