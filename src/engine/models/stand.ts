/**
 * Retort stand, boss head and clamp — the humble scaffolding of every
 * school physics practical.
 *
 * Dimensions follow the kit found in most West African school labs:
 * a 25 cm × 15 cm cast base, a 12 mm diameter rod about 75 cm long, and a
 * boss head that can be locked anywhere on that rod.
 */

import * as THREE from 'three';
import { Materials } from '../materials';
import { meshOf, roundedBox } from '../geometry';

/** Standard retort rod radius in metres (12 mm rod). */
export const ROD_RADIUS = 0.006;
/** Height of the rod above the bench, in metres. */
export const ROD_HEIGHT = 0.75;

/**
 * The cast-iron base + vertical rod.
 *
 * <b>Anchors:</b> `Rod` (the cylinder, for measuring clamp heights).
 */
export function buildRetortStand(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RetortStand';

  // Base: an elongated cast-iron slab with a raised boss round the rod.
  const base = meshOf(roundedBox(0.26, 0.1, 0.02, 0.02), Materials.castIron(), 'Base');
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.011;
  group.add(base);

  const boss = meshOf(new THREE.CylinderGeometry(0.026, 0.03, 0.03, 32), Materials.castIron(), 'BaseBoss');
  boss.position.set(0, 0.026, 0);
  group.add(boss);

  // Four rubber feet keep it from sliding on a polished bench.
  const footGeometry = new THREE.CylinderGeometry(0.009, 0.011, 0.006, 12);
  for (const [x, z] of [
    [0.105, 0.088],
    [-0.105, 0.088],
    [0.105, -0.088],
    [-0.105, -0.088],
  ]) {
    const foot = meshOf(footGeometry, Materials.rubber());
    foot.position.set(x, 0.003, z);
    group.add(foot);
  }

  // Rod. Its origin sits at the bench so `position.y` is a height in metres —
  // very handy when a clamp has to slide along it.
  const rod = meshOf(new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, ROD_HEIGHT, 24), Materials.chrome(), 'Rod');
  rod.position.set(0, ROD_HEIGHT / 2, 0);
  rod.userData.isHandle = true; // draggable in "move apparatus" mode
  group.add(rod);

  // A neat collar near the top, like most school stands have.
  const collar = meshOf(new THREE.TorusGeometry(0.0085, 0.0018, 8, 24), Materials.chrome(), 'Collar');
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, ROD_HEIGHT - 0.05, 0);
  group.add(collar);

  group.userData.rodRadius = ROD_RADIUS;
  group.userData.rodHeight = ROD_HEIGHT;
  return group;
}

/**
 * The boss head: a double socket that clamps the horizontal rod to the
 * vertical rod and can be tightened with two knurled screws.
 *
 * <b>Anchors:</b> `RodSocket` — the point where the horizontal rod enters.
 */
export function buildBossHead(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'BossHead';

  const body = meshOf(roundedBox(0.036, 0.036, 0.034, 0.006), Materials.blackSteel(), 'Body');
  group.add(body);

  // Socket that grips the vertical rod (a ring around it).
  const socket = meshOf(new THREE.CylinderGeometry(0.0115, 0.0115, 0.036, 20, 1, true), Materials.blackSteel(), 'VerticalSocket');
  socket.position.y = 0;
  group.add(socket);

  // Horizontal collar where the clamp rod passes through.
  const collar = meshOf(new THREE.CylinderGeometry(0.0105, 0.0105, 0.03, 20, 1, true), Materials.blackSteel(), 'RodSocket');
  collar.rotation.z = Math.PI / 2;
  collar.position.x = 0.03;
  group.add(collar);

  // Two knurled tightening screws.
  for (const [x, y, z, axis] of [
    [-0.024, 0, 0, 'z'],
    [0.018, 0.024, 0, 'y'],
  ] as const) {
    const screw = meshOf(new THREE.CylinderGeometry(0.0035, 0.0035, 0.03, 12), Materials.chrome(), 'Screw');
    const knob = meshOf(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 16), Materials.blackSteel(), 'Knob');
    if (axis === 'z') screw.rotation.x = Math.PI / 2;
    else screw.rotation.z = Math.PI / 2;
    screw.position.set(x, y, z);
    knob.position.set(x, y + (axis === 'y' ? 0.016 : 0), z + (axis === 'z' ? 0.016 : 0));
    knob.rotation.copy(screw.rotation);
    group.add(screw, knob);
  }

  group.userData.isHandle = true;
  return group;
}

/**
 * The jaw clamp that carries the split cork (or a thermometer, burette...).
 *
 * <b>Anchors:</b> `Jaws` — the gripping point, where a suspended object's
 * string would leave the clamp.
 */
export function buildClamp(options: { rodLength?: number } = {}): THREE.Group {
  const { rodLength = 0.19 } = options;
  const group = new THREE.Group();
  group.name = 'Clamp';

  // Horizontal rod that goes into the boss head.
  const rod = meshOf(
    new THREE.CylinderGeometry(0.0048, 0.0048, rodLength, 16),
    Materials.chrome(),
    'ClampRod',
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.set(-rodLength / 2 + 0.01, 0, 0);
  group.add(rod);

  // Pivot block and jaws at the far end.
  const pivot = meshOf(roundedBox(0.024, 0.026, 0.026, 0.005), Materials.blackSteel(), 'PivotBlock');
  pivot.position.x = 0.012;
  group.add(pivot);

  const jawMaterial = Materials.blackSteel();
  const upperJaw = meshOf(roundedBox(0.058, 0.008, 0.026, 0.004), jawMaterial, 'UpperJaw');
  upperJaw.position.set(0.045, 0.011, 0);
  const lowerJaw = meshOf(roundedBox(0.058, 0.008, 0.026, 0.004), jawMaterial, 'LowerJaw');
  lowerJaw.position.set(0.045, -0.011, 0);
  group.add(upperJaw, lowerJaw);

  // Clamping screw with a knurled head below the jaws.
  const screw = meshOf(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 12), Materials.chrome(), 'JawScrew');
  screw.position.set(0.03, -0.032, 0);
  const knurl = meshOf(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 18), Materials.blackSteel(), 'JawKnurl');
  knurl.position.set(0.03, -0.052, 0);
  group.add(screw, knurl);

  // Cork pads on the inside of the jaws (they grip without crushing glass).
  const pad = meshOf(new THREE.BoxGeometry(0.05, 0.004, 0.022), Materials.paint('#c19a6b', 1));
  pad.position.set(0.045, 0.005, 0);
  const padLower = pad.clone();
  padLower.position.y = -0.005;
  group.add(pad, padLower);

  // Invisible marker at the exact gripping point.
  const jaws = new THREE.Object3D();
  jaws.name = 'Jaws';
  jaws.position.set(0.045, 0, 0);
  group.add(jaws);

  group.userData.isHandle = true;
  return group;
}

/**
 * A split cork: a cork sliced down the middle so a thread can be trapped
 * between the two halves. Exactly the trick used in the real practical to
 * define a clean point of suspension.
 *
 * <b>Anchors:</b> `SuspensionPoint` — where the thread leaves the cork.
 */
export function buildSplitCork(radius = 0.011, height = 0.05): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SplitCork';

  const corkMaterial = Materials.paint('#c8a066', 1);
  const half = new THREE.CylinderGeometry(radius, radius * 0.94, height, 20, 1, false, 0, Math.PI);
  const halfA = meshOf(half, corkMaterial, 'CorkHalfA');
  const halfB = meshOf(half, corkMaterial, 'CorkHalfB');
  halfB.rotation.y = Math.PI;
  group.add(halfA, halfB);

  // The slit: a thin dark plane down the middle.
  const slit = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, height * 0.98),
    new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 1 }),
  );
  slit.rotation.x = 0;
  slit.position.z = 0;
  group.add(slit);

  const suspension = new THREE.Object3D();
  suspension.name = 'SuspensionPoint';
  suspension.position.set(0, -height / 2, 0);
  group.add(suspension);

  return group;
}
