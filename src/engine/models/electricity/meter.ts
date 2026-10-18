/**
 * Moving-coil meters. The ammeter, voltmeter and galvanometer are all the same
 * instrument with different dials, so they share this one `MeterModel`.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { makeDialTexture, meshOf, roundedBox } from '../../geometry';

/** Everything a meter needs to display a reading. */
export interface MeterOptions {
  /** Printed on the dial, e.g. "AMMETER". */
  label: string;
  /** Unit symbol, e.g. "A". */
  unit: string;
  /** Full-scale deflection value. */
  fullScale: number;
  /** Value at which the dial is red-lined. */
  redline?: number;
  /** Number of terminals (2 for a simple meter, 3 for a galvanometer). */
  terminals?: number;
  /** Rotate the needle about the vertical axis instead of tilting it. */
  needleAxisLengthM?: number;
}

/**
 * A moving-coil meter (ammeter, voltmeter or galvanometer).
 *
 * Meters are *not* ideal: {@link MeterModel#resistanceOhms} carries the
 * internal resistance a real meter has, so it loads the circuit it measures.
 */
export class MeterModel {
  readonly group = new THREE.Group();
  readonly options: MeterOptions;
  /** Internal resistance of the meter, in ohms. */
  readonly resistanceOhms: number;

  #needle: THREE.Object3D;
  #reading = 0;

  constructor(options: MeterOptions, internalResistanceOhms = 5) {
    this.options = options;
    this.resistanceOhms = internalResistanceOhms;
    const { label, unit, fullScale, redline, terminals = 2 } = options;

    this.group.name = label.replace(/\s+/g, '');

    const width = 0.115;
    const height = 0.092;
    const depth = 0.052;

    const caseMaterial = Materials.enamel();
    const body = meshOf(roundedBox(width, height, depth, 0.008), caseMaterial, 'Case');
    // Lab meters lean back ~18° so you can read them from a normal seat.
    body.rotation.x = -Math.PI / 2 - THREE.MathUtils.degToRad(18);
    body.position.set(0, height / 2, depth * 0.18);
    this.group.add(body);

    const dialTexture = makeDialTexture({
      label,
      unit,
      fullScale,
      redline,
      background: '#f7f3e6',
    });

    const dial = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.78, width * 0.78),
      new THREE.MeshStandardMaterial({ map: dialTexture, roughness: 0.55 }),
    );
    dial.name = 'Dial';
    dial.rotation.x = -THREE.MathUtils.degToRad(18);
    dial.position.set(0, height * 0.53, depth / 2 + 0.0015);
    this.group.add(dial);

    // Needle: pivot at the dial centre, tip sweeping ±60°.
    const needleLength = width * 0.62;
    const needleGeometry = new THREE.BoxGeometry(0.0009, needleLength, 0.0009);
    needleGeometry.translate(0, needleLength / 2, 0);
    const needleMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 });
    this.#needle = new THREE.Mesh(needleGeometry, needleMaterial);
    this.#needle.name = 'Needle';
    this.#needle.position.set(0, height * 0.42, depth / 2 + 0.004);
    this.#needle.rotation.x = -THREE.MathUtils.degToRad(18);
    this.group.add(this.#needle);

    // Glossy cover glass.
    const glassCover = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.86, width * 0.86),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.13,
        roughness: 0.02,
        metalness: 0,
        transmission: 0.9,
      }),
    );
    glassCover.rotation.x = -THREE.MathUtils.degToRad(18);
    glassCover.position.set(0, height * 0.53, depth / 2 + 0.006);
    glassCover.name = 'CoverGlass';
    this.group.add(glassCover);

    // Zero-adjust screw, a lovely period detail.
    const zeroScrew = meshOf(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 16), Materials.blackSteel(), 'ZeroScrew');
    zeroScrew.rotation.x = Math.PI / 2 - THREE.MathUtils.degToRad(18);
    zeroScrew.position.set(-width * 0.33, height * 0.3, depth / 2 + 0.002);
    this.group.add(zeroScrew);

    // Binding posts along the bottom front edge.
    const postGeometry = new THREE.CylinderGeometry(0.0055, 0.0055, 0.009, 16);
    for (let i = 0; i < terminals; i += 1) {
      const post = meshOf(postGeometry, Materials.agedBrass(), 'Terminal');
      const spread = terminals === 1 ? 0 : (i / Math.max(1, terminals - 1) - 0.5) * width * 0.6;
      post.position.set(spread, 0.008, depth * 0.42);
      this.group.add(post);
      const cap = meshOf(new THREE.TorusGeometry(0.0055, 0.0016, 8, 18), Materials.paint(i === 0 ? '#c0392b' : '#1f2226', 0.5), 'TerminalCap');
      cap.rotation.x = Math.PI / 2;
      cap.position.set(spread, 0.013, depth * 0.42);
      this.group.add(cap);
    }

    this.group.userData.apparatus = { id: 'meter', label };
    this.group.userData.isHandle = true;
    this.group.userData.meter = this;
  }

  /** Current reading (in the meter's own units). */
  get reading(): number {
    return this.#reading;
  }

  /**
   * Drive the needle. Values beyond full scale peg the needle against the
   * end stop — a real meter does not politely stay in range.
   */
  setReading(value: number): void {
    this.#reading = value;
    const fraction = Math.max(-0.02, Math.min(1.05, value / this.options.fullScale));
    const angle = THREE.MathUtils.degToRad(-60 + fraction * 120);
    this.#needle.rotation.z = -angle;
  }
}

/** Small "meter reading" helper for the UI: format with the right precision. */
export function formatMeterReading(value: number, fullScale: number): string {
  const decimals = fullScale >= 100 ? 0 : fullScale >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)}`;
}
