/**
 * Pendulum components: bobs and the thread they hang from.
 *
 * Small details matter here. A real pendulum bob is not a mathematical point:
 * it is a sphere of finite radius `r`, which makes the true period slightly
 * longer than `2π√(L/g)` when `L` is measured to the centre. The models carry
 * their physical properties in `userData.physics` so the simulation can use
 * them without guessing.
 */

import * as THREE from 'three';
import { Materials } from '../materials';
import { meshOf, stretchThread, threadBetween } from '../geometry';

export type BobMaterialName = 'brass' | 'steel' | 'plastic' | 'lead';

export interface PendulumBobOptions {
  /** Sphere diameter in metres. School bobs are 20–30 mm. */
  diameterM?: number;
  material?: BobMaterialName;
}

/** Densities in kg/m³, for labelling and (later) mass-dependent experiments. */
export const BOB_DENSITY: Record<BobMaterialName, number> = {
  brass: 8500,
  steel: 7850,
  lead: 11340,
  plastic: 1200,
};

function bobMaterial(name: BobMaterialName): THREE.Material {
  switch (name) {
    case 'steel':
      return Materials.chrome();
    case 'plastic':
      return Materials.paint('#c0392b', 0.45);
    case 'lead':
      return Materials.paint('#6e7378', 0.55);
    case 'brass':
    default:
      return Materials.brass();
  }
}

/**
 * A pendulum bob: sphere + hook + a tiny centre punch mark so students can
 * aim at the centre of mass when reading the rule.
 *
 * <b>Anchors:</b> `Centre` — the centre of mass, the point `L` is measured to.
 * <b>Anchors:</b> `Hook` — where the thread is tied.
 */
export function buildPendulumBob(options: PendulumBobOptions = {}): THREE.Group {
  const { diameterM = 0.025, material = 'brass' } = options;
  const radius = diameterM / 2;

  const group = new THREE.Group();
  group.name = 'PendulumBob';

  const sphere = meshOf(new THREE.SphereGeometry(radius, 40, 28), bobMaterial(material), 'BobSphere');
  group.add(sphere);

  // The little neck + loop where the thread is tied.
  const neck = meshOf(new THREE.CylinderGeometry(radius * 0.22, radius * 0.34, radius * 0.5, 16), bobMaterial(material), 'Neck');
  neck.position.y = radius * 1.2;
  group.add(neck);

  const hook = meshOf(new THREE.TorusGeometry(radius * 0.32, radius * 0.1, 10, 20), bobMaterial(material), 'Hook');
  hook.position.y = radius * 1.62;
  group.add(hook);

  // Punch mark: a dark disc on the front of the bob, facing the rule.
  const mark = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.22, 20),
    new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.8 }),
  );
  mark.name = 'CentreMark';
  mark.position.z = radius * 1.001;
  group.add(mark);

  const centre = new THREE.Object3D();
  centre.name = 'Centre';
  group.add(centre);

  const hookAnchor = new THREE.Object3D();
  hookAnchor.name = 'Hook';
  hookAnchor.position.y = radius * 1.62;
  group.add(hookAnchor);

  group.userData.isHandle = true;
  group.userData.physics = {
    kind: 'bob',
    radiusM: radius,
    material,
    massKg: BOB_DENSITY[material] * (4 / 3) * Math.PI * radius ** 3,
    /** Moment of inertia factor: I = k·m·r². Solid sphere → 2/5. */
    inertiaFactor: 2 / 5,
  };
  group.userData.apparatus = { id: 'pendulum-bob', label: `${material} bob` };
  return group;
}

/**
 * The suspension thread. Its origin is at the pivot (top) and the mesh is a
 * 1 m unit cylinder pivoting at its base, so a single `scale.y` sets length.
 *
 * <b>Anchors:</b> `Thread` — the mesh itself.
 */
export function buildThread(maxLengthM = 1.2, radiusM = 0.0005): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SuspensionThread';

  const mesh = threadBetween(radiusM, 8);
  mesh.name = 'Thread';
  mesh.scale.y = maxLengthM;
  mesh.castShadow = true;
  mesh.material = Materials.string();
  group.add(mesh);

  group.userData.maxLengthM = maxLengthM;
  return group;
}

/** Convenience wrapper: set a thread group's length in metres. */
export function setThreadLength(group: THREE.Group, lengthM: number): void {
  const mesh = group.getObjectByName('Thread') as THREE.Mesh | undefined;
  if (!mesh) return;
  mesh.scale.y = Math.max(lengthM, 1e-4);
}

/**
 * Stretch a thread so it spans two world-space points. Used when the
 * pendulum pivot or the bob is being repositioned.
 */
export function spanThread(group: THREE.Group, from: THREE.Vector3, to: THREE.Vector3): void {
  const mesh = group.getObjectByName('Thread') as THREE.Mesh | undefined;
  if (!mesh) return;
  mesh.scale.x = 1;
  mesh.scale.z = 1;
  stretchThread(mesh, from, to);
}

/** A wooden reel of thread sitting on the bench, for flavour. */
export function buildThreadReel(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ThreadReel';

  const wood = Materials.wood();
  const flangeGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.004, 28);
  const coreGeometry = new THREE.CylinderGeometry(0.022, 0.022, 0.036, 24);

  const core = meshOf(coreGeometry, Materials.paint('#d8cfae', 0.9), 'Core');
  const top = meshOf(flangeGeometry, wood, 'FlangeTop');
  top.position.y = 0.019;
  const bottom = meshOf(flangeGeometry, wood, 'FlangeBottom');
  bottom.position.y = -0.019;

  // A few dozen visible turns of thread wound round the core.
  const turns = 26;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= turns * 24; i += 1) {
    const t = i / (turns * 24);
    const angle = t * turns * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * 0.0235, -0.018 + t * 0.036, Math.sin(angle) * 0.0235));
  }
  const wound = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), turns * 12, 0.0005, 6, false),
    Materials.string(),
  );
  wound.name = 'WoundThread';

  // A loose end trailing off the reel.
  const loose = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.023, 0.017, 0),
        new THREE.Vector3(0.06, 0.012, 0.01),
        new THREE.Vector3(0.1, 0.001, 0.03),
        new THREE.Vector3(0.145, 0.0007, 0.05),
      ]),
      24,
      0.0005,
      6,
      false,
    ),
    Materials.string(),
  );
  loose.name = 'LooseEnd';

  group.add(core, top, bottom, wound, loose);
  group.userData.isHandle = true;
  return group;
}
