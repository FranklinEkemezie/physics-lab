/**
 * Masses and springs — the equipment for Hooke's law and "extension vs load".
 *
 * Slotted masses are modelled with a genuine radial slot (an extruded shape),
 * not a fake decal, because students need to see how the masses stack on the
 * hanger.
 */

import * as THREE from 'three';
import { Materials } from '../materials';
import { helixGeometry, makeLabelPlane, meshOf } from '../geometry';

/**
 * A slotted Mass: a brass disc with a radial slot to the centre so it can be
 * dropped onto the hanger's stem.
 *
 * <b>Anchors:</b> `Centre` — the centre of the disc.
 */
export function buildSlottedMass(massG: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `SlottedMass${massG}g`;

  // Roughly constant thickness, radius ∝ √mass so they look like real sets.
  const thickness = 0.006;
  const radius = Math.max(0.014, 0.0032 * Math.sqrt(massG));
  const slotHalfWidth = Math.max(0.0035, radius * 0.12);

  const shape = new THREE.Shape();
  const halfAngle = Math.asin(Math.min(0.85, slotHalfWidth / radius));
  const a1 = Math.PI / 2 + halfAngle;
  const a0 = Math.PI / 2 - halfAngle;

  shape.moveTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
  shape.absarc(0, 0, radius, a1, a0 - Math.PI * 2, true);
  shape.lineTo(0, 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.0008,
    bevelThickness: 0.0008,
    bevelSegments: 2,
    curveSegments: 32,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateX(-Math.PI / 2); // lay the disc flat (thickness along Y)

  const disc = meshOf(geometry, Materials.agedBrass(), 'Disc');
  group.add(disc);

  const label = makeLabelPlane({
    text: `${massG} g`,
    widthM: radius * 1.5,
    fontScale: 0.22,
    bold: true,
    foreground: '#3a2d12',
  });
  label.name = 'MassLabel';
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, thickness / 2 + 0.0004, -radius * 0.28);
  group.add(label);

  const centre = new THREE.Object3D();
  centre.name = 'Centre';
  group.add(centre);

  group.userData.isHandle = true;
  group.userData.physics = { kind: 'mass', massKg: massG / 1000 };
  group.userData.apparatus = { id: 'slotted-mass', label: `${massG} g mass` };
  return group;
}

/**
 * The mass hanger: a small plate with a stem that slotted masses slide onto
 * and a hook at the bottom for the next hanger.
 *
 * <b>Anchors:</b> `StemTop` (where the hanger is suspended) and `PlateTop`
 * (where masses rest).
 */
export function buildMassHanger(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'MassHanger';

  const plate = meshOf(new THREE.CylinderGeometry(0.019, 0.019, 0.002, 28), Materials.chrome(), 'Plate');
  plate.position.y = -0.022;
  group.add(plate);

  const stem = meshOf(new THREE.CylinderGeometry(0.0025, 0.0025, 0.05, 12), Materials.chrome(), 'Stem');
  stem.position.y = 0.003;
  group.add(stem);

  const stemTop = meshOf(new THREE.SphereGeometry(0.0035, 16, 12), Materials.chrome(), 'StemTop');
  stemTop.position.y = 0.028;
  group.add(stemTop);

  const hook = meshOf(new THREE.TorusGeometry(0.007, 0.0014, 8, 20, Math.PI * 1.5), Materials.chrome(), 'Hook');
  hook.position.y = -0.032;
  hook.rotation.z = Math.PI;
  group.add(hook);

  const stemAnchor = new THREE.Object3D();
  stemAnchor.name = 'StemTop';
  stemAnchor.position.y = 0.028;
  const plateAnchor = new THREE.Object3D();
  plateAnchor.name = 'PlateTop';
  plateAnchor.position.y = -0.02;
  group.add(stemAnchor, plateAnchor);

  group.userData.isHandle = true;
  group.userData.physics = { kind: 'hanger', massKg: 0.05 };
  return group;
}

export interface SpringOptions {
  /** Natural (unstretched) length in metres. */
  naturalLengthM?: number;
  /** Coil radius in metres. */
  coilRadiusM?: number;
  /** Spring constant in N/m — the quantity the student is trying to find. */
  springConstantNm?: number;
}

/**
 * A helical extension spring with hooks at both ends.
 *
 * The <b>geometry is rebuilt</b> from the current extension so the coils
 * visibly open up as it stretches — the same cue students use in the lab to
 * see that a spring is loaded.
 *
 * <b>Anchors:</b> `Top` (fixed end) and `Bottom` (moving end).
 */
export class SpringModel {
  readonly group = new THREE.Group();
  readonly naturalLengthM: number;
  readonly springConstantNm: number;
  readonly coilRadiusM: number;

  #coils: THREE.Mesh;
  #topHook: THREE.Mesh;
  #bottomHook: THREE.Mesh;
  #sideWire: THREE.Mesh;
  #pointer: THREE.Mesh;

  constructor(options: SpringOptions = {}) {
    const { naturalLengthM = 0.12, coilRadiusM = 0.011, springConstantNm = 25 } = options;
    this.naturalLengthM = naturalLengthM;
    this.coilRadiusM = coilRadiusM;
    this.springConstantNm = springConstantNm;

    this.group.name = 'Spring';

    const wireRadius = 0.0007;
    const coilHeight = naturalLengthM - 0.028; // leave room for the hooks
    const turns = 42;

    this.#coils = new THREE.Mesh(helixGeometry(coilRadiusM, coilHeight, turns, wireRadius, 20), Materials.chrome());
    this.#coils.name = 'Coils';
    this.#coils.castShadow = true;
    this.group.add(this.#coils);

    // Hooks: half-tori at each end.
    const hookGeometry = new THREE.TorusGeometry(0.006, wireRadius * 1.3, 8, 20, Math.PI);
    this.#topHook = new THREE.Mesh(hookGeometry, Materials.chrome());
    this.#topHook.name = 'TopHook';
    this.#topHook.position.y = coilHeight;
    this.#topHook.rotation.z = Math.PI;
    this.#bottomHook = new THREE.Mesh(hookGeometry, Materials.chrome());
    this.#bottomHook.name = 'BottomHook';
    this.#bottomHook.rotation.z = Math.PI;
    this.group.add(this.#topHook, this.#bottomHook);

    // A straight wire run down the side carries the fiducial pointer. Real
    // school springs have exactly this, so the pointer does not wobble.
    this.#sideWire = new THREE.Mesh(
      new THREE.CylinderGeometry(wireRadius, wireRadius, coilHeight, 6),
      Materials.chrome(),
    );
    this.#sideWire.name = 'SideWire';
    this.#sideWire.position.set(coilRadiusM + 0.006, coilHeight / 2, 0);
    this.group.add(this.#sideWire);

    this.#pointer = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, 0.0008, 0.0008),
      Materials.paint('#c0392b', 0.4),
    );
    this.#pointer.name = 'Pointer';
    this.#pointer.position.set(coilRadiusM + 0.019, coilHeight, 0);
    this.group.add(this.#pointer);

    const top = new THREE.Object3D();
    top.name = 'Top';
    top.position.y = naturalLengthM;
    const bottom = new THREE.Object3D();
    bottom.name = 'Bottom';
    this.group.add(top, bottom);

    this.group.userData.isHandle = true;
    this.group.userData.physics = {
      kind: 'spring',
      springConstantNm,
      naturalLengthM,
    };

    this.setLength(naturalLengthM);
  }

  /**
   * Redraw the spring at a given total length.
   * Coils stretch uniformly; the wire radius stays constant, so the spring
   * genuinely looks like metal being pulled apart.
   */
  setLength(totalLengthM: number): void {
    const length = Math.max(this.naturalLengthM * 0.35, totalLengthM);
    const coilHeight = Math.max(0.02, length - 0.028);
    const turns = 42;

    this.#coils.geometry.dispose();
    this.#coils.geometry = helixGeometry(this.coilRadiusM, coilHeight, turns, 0.0007, 20);

    this.#topHook.position.y = coilHeight;
    this.#bottomHook.position.y = 0;

    this.#sideWire.scale.y = coilHeight / (this.naturalLengthM - 0.028);
    this.#sideWire.position.y = coilHeight / 2;

    this.#pointer.position.y = coilHeight;

    const bottom = this.group.getObjectByName('Bottom');
    if (bottom) bottom.position.y = length;
  }

  get pointer(): THREE.Object3D {
    return this.#pointer;
  }

  dispose(): void {
    this.#coils.geometry.dispose();
    this.#topHook.geometry.dispose();
    this.#bottomHook.geometry.dispose();
  }
}

/**
 * A spring balance (newton meter): a tube with a graduated window and a hook.
 * Handy for weighing apparatus directly in newtons.
 */
export class SpringBalance {
  readonly group = new THREE.Group();
  #pointer: THREE.Mesh;
  readonly maxNewtons: number;
  readonly lengthM: number;

  constructor(maxNewtons = 5, lengthM = 0.14) {
    this.maxNewtons = maxNewtons;
    this.lengthM = lengthM;
    this.group.name = 'SpringBalance';

    const radius = 0.011;
    const body = meshOf(
      new THREE.CylinderGeometry(radius, radius, lengthM, 28, 1, true),
      Materials.paint('#e8e3d6', 0.5),
      'Body',
    );
    body.position.y = lengthM / 2;
    this.group.add(body);

    const bodyInner = meshOf(
      new THREE.CylinderGeometry(radius * 0.96, radius * 0.96, lengthM * 0.98, 24, 1, true),
      Materials.paint('#3a3f45', 0.6),
      'Inner',
    );
    bodyInner.position.y = lengthM / 2;
    this.group.add(bodyInner);

    const cap = meshOf(new THREE.SphereGeometry(radius, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), Materials.paint('#c0392b', 0.45), 'Cap');
    cap.position.y = lengthM;
    this.group.add(cap);

    // Circular spring inside, visible through the slot.
    const spring = meshOf(helixGeometry(radius * 0.55, lengthM * 0.8, 22, 0.0006, 14), Materials.chrome(), 'InnerSpring');
    spring.position.y = lengthM * 0.06;
    this.group.add(spring);

    this.#pointer = meshOf(new THREE.BoxGeometry(radius * 1.6, 0.0009, 0.0012), Materials.paint('#c0392b', 0.4), 'Pointer');
    this.#pointer.position.set(0, lengthM * 0.85, radius * 0.95);
    this.group.add(this.#pointer);

    const hook = meshOf(new THREE.TorusGeometry(0.0075, 0.0016, 8, 20, Math.PI * 1.5), Materials.chrome(), 'Hook');
    hook.position.y = -0.004;
    hook.rotation.z = Math.PI;
    this.group.add(hook);

    const anchor = new THREE.Object3D();
    anchor.name = 'Hook';
    this.group.add(anchor);

    this.group.userData.isHandle = true;
    this.setLoad(0);
  }

  /** Move the pointer to reflect a load in newtons. */
  setLoad(newtons: number): void {
    const fraction = Math.min(1, Math.max(0, newtons / this.maxNewtons));
    this.#pointer.position.y = this.lengthM * (0.1 + fraction * 0.75);
  }
}
