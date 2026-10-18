/**
 * Electricity apparatus: cells, moving-coil meters, rheostats, switches,
 * resistors, lamps and patch leads.
 *
 * The meters are *real* instruments — a `MeterModel` owns a needle that swings
 * to the reading you give it, with a mirrored dial and a redline, so an
 * experiment can drive them with the same quantities it computes.
 */

import * as THREE from 'three';
import { Materials } from '../materials';
import {
  makeDialTexture,
  makeLabelPlane,
  meshOf,
  roundedBox,
  stretchThread,
  threadBetween,
} from '../geometry';
import { CanvasPanel, drawBezel, drawLcdDigits } from '../CanvasPanel';

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

/** A dry cell (Leclanché/dry cell) with terminals and a printed voltage. */
export function buildDryCell(voltageV = 1.5, options: { label?: string } = {}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'DryCell';

  const radius = 0.017;
  const height = 0.062;

  const shrink = meshOf(new THREE.CylinderGeometry(radius, radius, height, 28), Materials.paint('#1f2226', 0.55), 'Shrink');
  shrink.position.y = height / 2;
  group.add(shrink);

  const band = meshOf(new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, height * 0.28, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5, side: THREE.DoubleSide }), 'Band');
  band.position.y = height * 0.34;
  group.add(band);

  const label = makeLabelPlane({
    text: `${voltageV.toFixed(1)} V\n${options.label ?? 'DRY CELL'}`,
    widthM: radius * 2.6,
    fontScale: 0.15,
    foreground: '#f3efe4',
    background: null,
  });
  label.rotation.y = 0;
  label.scale.set(1, 1, 1);
  label.position.set(0, height * 0.55, radius * 1.01);
  group.add(label);

  // Positive brass pip and negative flat cap.
  const pip = meshOf(new THREE.CylinderGeometry(0.004, 0.005, 0.006, 16), Materials.brass(), 'PositivePip');
  pip.position.y = height + 0.003;
  group.add(pip);
  const cap = meshOf(new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 0.003, 24), Materials.chrome(), 'NegativeCap');
  cap.position.y = -0.0015;
  group.add(cap);

  const positiveTerminal = new THREE.Object3D();
  positiveTerminal.name = 'Positive';
  positiveTerminal.position.y = height + 0.006;
  const negativeTerminal = new THREE.Object3D();
  negativeTerminal.name = 'Negative';
  negativeTerminal.position.y = -0.003;
  group.add(positiveTerminal, negativeTerminal);

  group.userData.isHandle = true;
  group.userData.physics = { kind: 'cell', emfV: voltageV, internalResistanceOhms: 0.6 };
  group.userData.apparatus = { id: 'dry-cell', label: `${voltageV.toFixed(1)} V cell` };
  return group;
}

/**
 * A lamp bulb for series/parallel and I–V characteristics work.
 * {@link LampModel#setCurrent} lights it up, and the filament resistance rises
 * with temperature exactly as a tungsten filament does.
 */
export class LampModel {
  readonly group = new THREE.Group();
  readonly ratedVoltageV: number;
  readonly ratedPowerW: number;
  #filament: THREE.Mesh;
  #glow: THREE.PointLight;

  constructor(ratedVoltageV = 2.5, ratedPowerW = 0.3) {
    this.ratedVoltageV = ratedVoltageV;
    this.ratedPowerW = ratedPowerW;
    this.group.name = 'Lamp';

    const base = meshOf(new THREE.CylinderGeometry(0.007, 0.008, 0.016, 20), Materials.brass(), 'Base');
    base.position.y = 0.008;
    this.group.add(base);

    const screw = meshOf(new THREE.TorusGeometry(0.0072, 0.0012, 6, 20), Materials.brass(), 'ScrewThread');
    screw.rotation.x = Math.PI / 2;
    screw.position.y = 0.006;
    this.group.add(screw);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.32,
        roughness: 0.02,
        transmission: 0.92,
        thickness: 0.004,
        ior: 1.5,
        side: THREE.DoubleSide,
      }),
    );
    bulb.name = 'Bulb';
    bulb.position.y = 0.021;
    this.group.add(bulb);

    this.#filament = meshOf(
      new THREE.CylinderGeometry(0.0006, 0.0006, 0.012, 6),
      new THREE.MeshBasicMaterial({ color: 0x332a1a }),
      'Filament',
    );
    this.#filament.position.y = 0.022;
    this.group.add(this.#filament);

    this.#glow = new THREE.PointLight(0xffd9a0, 0, 1.2, 2);
    this.#glow.position.y = 0.022;
    this.group.add(this.#glow);

    const positive = new THREE.Object3D();
    positive.name = 'TerminalA';
    positive.position.y = 0;
    const negative = new THREE.Object3D();
    negative.name = 'TerminalB';
    negative.position.set(0, 0.016, 0);
    this.group.add(positive, negative);

    this.setCurrent(0);
    this.group.userData.isHandle = true;
    this.group.userData.apparatus = { id: 'lamp', label: `Lamp ${ratedVoltageV} V ${ratedPowerW} W` };
  }

  /**
   * Light the filament. Resistance is ~10× higher hot than cold, so the
   * current is *not* simply V/R(cold) — that is why I–V graphs curve.
   */
  setCurrent(currentA: number): void {
    const ratedCurrent = this.ratedPowerW / this.ratedVoltageV;
    const fraction = Math.min(1.6, Math.abs(currentA) / ratedCurrent);
    const material = this.#filament.material as THREE.MeshBasicMaterial;
    material.color.setRGB(
      Math.min(1, 0.2 + fraction * 1.6),
      Math.min(1, 0.14 + fraction * 1.2),
      Math.min(1, 0.1 + fraction * 0.35),
    );
    this.#glow.intensity = fraction ** 2.4 * 2.2;
    (this.group.getObjectByName('Bulb') as THREE.Mesh | undefined)?.scale.setScalar(1 + fraction * 0.03);
  }

  /** Cold filament resistance in ohms. */
  get coldResistanceOhms(): number {
    return (this.ratedVoltageV * this.ratedVoltageV) / this.ratedPowerW / 10;
  }
}

/**
 * Sliding-contact rheostat (variable resistor) with a graduated ceramic
 * former, a metal slide rod and three terminals.
 *
 * <b>Anchors:</b> `Slider`.
 */
export class RheostatModel {
  readonly group = new THREE.Group();
  readonly maxResistanceOhms: number;
  #slider: THREE.Mesh;
  #fraction = 1;

  constructor(maxResistanceOhms = 20, lengthM = 0.14) {
    this.maxResistanceOhms = maxResistanceOhms;
    this.group.name = 'Rheostat';

    const former = meshOf(
      new THREE.CylinderGeometry(0.012, 0.012, lengthM, 28),
      Materials.paint('#d9d2c0', 0.85),
      'Former',
    );
    former.rotation.z = Math.PI / 2;
    former.position.y = 0.026;
    this.group.add(former);

    // Bare resistance wire wound round the former.
    const points: THREE.Vector3[] = [];
    const turns = 90;
    for (let i = 0; i <= turns * 12; i += 1) {
      const t = i / (turns * 12);
      const angle = t * turns * Math.PI * 2;
      points.push(
        new THREE.Vector3(-lengthM / 2 + t * lengthM, 0.026 + Math.sin(angle) * 0.0122, Math.cos(angle) * 0.0122),
      );
    }
    const winding = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), turns * 6, 0.00035, 5, false),
      Materials.agedBrass(),
    );
    winding.name = 'Winding';
    this.group.add(winding);

    const rail = meshOf(new THREE.CylinderGeometry(0.0028, 0.0028, lengthM + 0.03, 12), Materials.chrome(), 'SlideRod');
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 0.052, 0.004);
    this.group.add(rail);

    this.#slider = meshOf(new THREE.BoxGeometry(0.012, 0.016, 0.03), Materials.blackSteel(), 'Slider');
    this.#slider.position.set(0, 0.041, 0.002);
    this.group.add(this.#slider);

    const knob = meshOf(new THREE.CylinderGeometry(0.006, 0.006, 0.014, 16), Materials.paint('#c0392b', 0.45), 'SliderKnob');
    knob.position.set(0, 0.055, 0.015);
    this.group.add(knob);

    for (const x of [-lengthM / 2 - 0.005, lengthM / 2 + 0.005]) {
      const endCap = meshOf(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 24), Materials.paint('#3a3f45', 0.6), 'EndCap');
      endCap.rotation.z = Math.PI / 2;
      endCap.position.set(x, 0.026, 0);
      this.group.add(endCap);
    }

    const base = meshOf(roundedBox(0.16, 0.008, 0.05, 0.003), Materials.darkWood(), 'Base');
    base.position.y = 0.004;
    this.group.add(base);

    const label = makeLabelPlane({
      text: `0 – ${maxResistanceOhms} Ω`,
      widthM: 0.09,
      fontScale: 0.2,
      foreground: '#3a2b16',
    });
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.0085, 0.02);
    this.group.add(label);

    this.setResistance(maxResistanceOhms);
    this.group.userData.isHandle = true;
    this.group.userData.apparatus = { id: 'rheostat', label: `Rheostat 0–${maxResistanceOhms} Ω` };
  }

  setResistance(ohms: number): void {
    this.#fraction = Math.min(1, Math.max(0, ohms / this.maxResistanceOhms));
    const span = 0.12;
    this.#slider.position.x = -span / 2 + this.#fraction * span;
  }

  get resistanceOhms(): number {
    return this.#fraction * this.maxResistanceOhms;
  }
}

/** Knife switch on a wooden base. */
export class KnifeSwitchModel {
  readonly group = new THREE.Group();
  #blade: THREE.Group;
  #closed = false;

  constructor() {
    this.group.name = 'KnifeSwitch';

    const base = meshOf(roundedBox(0.1, 0.01, 0.045, 0.003), Materials.darkWood(), 'Base');
    base.position.y = 0.005;
    this.group.add(base);

    const jawPost = meshOf(new THREE.CylinderGeometry(0.004, 0.004, 0.018, 16), Materials.brass(), 'JawPost');
    jawPost.position.set(0.03, 0.019, 0);
    const pivotPost = jawPost.clone();
    pivotPost.name = 'PivotPost';
    pivotPost.position.set(-0.03, 0.019, 0);
    this.group.add(jawPost, pivotPost);

    for (const post of [jawPost, pivotPost]) {
      const terminal = meshOf(new THREE.CylinderGeometry(0.0042, 0.0042, 0.008, 16), Materials.agedBrass(), 'Terminal');
      terminal.position.set(post.position.x, 0.008, 0.016);
      this.group.add(terminal);
    }

    this.#blade = new THREE.Group();
    this.#blade.name = 'Blade';
    this.#blade.position.set(-0.03, 0.026, 0);
    const metal = meshOf(new THREE.BoxGeometry(0.062, 0.002, 0.008), Materials.brass(), 'BladeBar');
    metal.position.x = 0.031;
    const handle = meshOf(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 16), Materials.rubber(), 'BladeHandle');
    handle.rotation.z = Math.PI / 2;
    handle.position.x = 0.066;
    this.#blade.add(metal, handle);
    this.group.add(this.#blade);

    this.setClosed(false);
    this.group.userData.isHandle = true;
    this.group.userData.apparatus = { id: 'knife-switch', label: 'Switch' };
  }

  /** Open or close the switch — animated by the experiment each frame. */
  setClosed(closed: boolean, animate = false): void {
    this.#closed = closed;
    this.#blade.userData.targetAngle = closed ? 0 : -0.62;
    if (!animate) {
      this.#blade.rotation.z = this.#blade.userData.targetAngle as number;
    }
  }

  get isClosed(): boolean {
    return this.#closed;
  }

  update(dt: number): void {
    const target = (this.#blade.userData.targetAngle as number) ?? 0;
    this.#blade.rotation.z += (target - this.#blade.rotation.z) * Math.min(1, dt * 12);
  }
}

/** Colour bands for a carbon-film resistor, in the standard order. */
const RESISTOR_COLOURS: Record<number, string> = {
  0: '#111111',
  1: '#6b3f1d',
  2: '#c0392b',
  3: '#e67e22',
  4: '#f1c40f',
  5: '#27ae60',
  6: '#2980b9',
  7: '#8e44ad',
  8: '#7f8c8d',
  9: '#ecf0f1',
};

/** Decode a 4-band resistor value into band colours. */
export function resistorBands(ohms: number): string[] {
  const value = Math.max(1, Math.round(ohms));
  const digits = String(value);
  const first = Number(digits[0]);
  const second = digits.length > 1 ? Number(digits[1]) : 0;
  const multiplier = digits.length > 2 ? digits.length - 2 : 0;
  return [
    RESISTOR_COLOURS[first] ?? '#111',
    RESISTOR_COLOURS[second] ?? '#111',
    RESISTOR_COLOURS[Math.min(9, multiplier)] ?? '#111',
    '#c9a227', // gold tolerance band = ±5 %
  ];
}

/** A carbon-film resistor with authentic colour-code bands. */
export function buildResistor(ohms = 100): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Resistor';

  const lengthM = 0.014;
  const radius = 0.0028;

  const body = meshOf(new THREE.CylinderGeometry(radius, radius, lengthM, 24), Materials.paint('#cbb98a', 0.7), 'Body');
  body.rotation.z = Math.PI / 2;
  body.position.y = radius + 0.0004;
  group.add(body);

  const bands = resistorBands(ohms);
  bands.forEach((colour, index) => {
    const band = meshOf(
      new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, 0.0016, 24),
      Materials.paint(colour, 0.55),
      `Band${index}`,
    );
    band.rotation.z = Math.PI / 2;
    band.position.set(-lengthM / 2 + 0.0022 + index * 0.0028, radius + 0.0004, 0);
    group.add(band);
  });

  const leadGeometry = new THREE.CylinderGeometry(0.0006, 0.0006, 0.02, 10);
  const leadA = meshOf(leadGeometry, Materials.chrome(), 'LeadA');
  leadA.rotation.z = Math.PI / 2;
  leadA.position.set(-lengthM / 2 - 0.01, radius + 0.0004, 0);
  const leadB = leadA.clone();
  leadB.name = 'LeadB';
  leadB.position.x = lengthM / 2 + 0.01;
  group.add(leadA, leadB);

  group.userData.isHandle = true;
  group.userData.physics = { kind: 'resistor', resistanceOhms: ohms };
  group.userData.apparatus = { id: 'resistor', label: `Resistor ${ohms} Ω` };
  return group;
}

/**
 * A flexible patch lead that can be connected between two points in the
 * scene. The cable sags under its own weight (a catenary), because straight
 * wires look wrong and students use the sag to see which lead is which.
 */
export class PatchLead {
  readonly group = new THREE.Group();
  readonly colour: string;
  #lengthM: number;

  constructor(colour: string, lengthM = 0.3) {
    this.colour = colour;
    this.#lengthM = lengthM;
    this.group.name = 'PatchLead';

    const mesh = threadBetween(0.0022, 10);
    mesh.name = 'Cable';
    mesh.material = Materials.wire(colour);
    mesh.castShadow = true;
    this.group.add(mesh);

    const clipGeometry = new THREE.ConeGeometry(0.0045, 0.016, 12);
    for (const name of ['ClipA', 'ClipB'] as const) {
      const clip = meshOf(clipGeometry, Materials.chrome(), name);
      this.group.add(clip);
    }
    this.group.userData.apparatus = { id: 'patch-lead', label: `${colour} lead` };
  }

  /**
   * Route the cable between two world points, hanging with a sag proportional
   * to the slack (any cable shorter than the distance is pulled taut).
   */
  connect(from: THREE.Vector3, to: THREE.Vector3, slack = 0.35): void {
    const direct = from.distanceTo(to);
    const length = Math.max(direct * (1 + slack), this.#lengthM * 0.4);
    const sag = Math.max(0, length - direct) * 0.55 + 0.004;

    const mids: THREE.Vector3[] = [];
    const segments = 24;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const point = new THREE.Vector3().lerpVectors(from, to, t);
      // Parabolic sag, deepest in the middle.
      point.y -= sag * Math.sin(Math.PI * t);
      mids.push(point);
    }

    const cable = this.group.getObjectByName('Cable') as THREE.Mesh;
    cable.geometry.dispose();
    cable.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mids), segments, 0.0022, 8, false);

    const clipA = this.group.getObjectByName('ClipA') as THREE.Mesh;
    const clipB = this.group.getObjectByName('ClipB') as THREE.Mesh;
    const dirA = new THREE.Vector3().subVectors(mids[1] ?? to, from).normalize();
    const dirB = new THREE.Vector3().subVectors(to, mids[segments - 1] ?? from).normalize();
    clipA.position.copy(from);
    clipA.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirA);
    clipB.position.copy(to);
    clipB.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirB);
  }

  /** Straight-line shortcut used when a lead is not connected to anything. */
  span(from: THREE.Vector3, to: THREE.Vector3): void {
    const cable = this.group.getObjectByName('Cable') as THREE.Mesh;
    stretchThread(cable, from, to);
  }
}

/**
 * A digital multimeter — the modern companion to the moving-coil meter.
 * Shows a live LCD face and has a selector dial.
 */
export class MultimeterModel {
  readonly group = new THREE.Group();
  #panel = new CanvasPanel(512, 256);
  #displayValue = 0;
  #displayUnit = 'V';
  #mode = 'DC V';

  constructor() {
    this.group.name = 'Multimeter';

    const width = 0.086;
    const height = 0.17;
    const depth = 0.03;
    const body = meshOf(roundedBox(width, height, depth, 0.008), Materials.paint('#d9a02b', 0.45), 'Body');
    body.rotation.x = -Math.PI / 2 - THREE.MathUtils.degToRad(12);
    body.position.set(0, height / 2, depth * 0.12);
    this.group.add(body);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.72, height * 0.24), this.#panel.material());
    screen.name = 'Lcd';
    screen.rotation.x = -THREE.MathUtils.degToRad(12);
    screen.position.set(0, height * 0.8, depth / 2 + 0.0015);
    this.group.add(screen);

    const dial = meshOf(new THREE.CylinderGeometry(width * 0.24, width * 0.24, 0.008, 28), Materials.paint('#2b2f33', 0.5), 'Dial');
    dial.rotation.x = Math.PI / 2 - THREE.MathUtils.degToRad(12);
    dial.position.set(0, height * 0.53, depth / 2 + 0.002);
    this.group.add(dial);

    const marker = meshOf(new THREE.BoxGeometry(0.002, width * 0.2, 0.003), Materials.paint('#e8e3d6', 0.4), 'DialMarker');
    marker.rotation.x = -THREE.MathUtils.degToRad(12);
    marker.position.set(0, height * 0.45, depth / 2 + 0.006);
    this.group.add(marker);

    const socketGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.004, 14);
    for (const [i, colour] of ['#1f2226', '#c0392b', '#c0392b'].entries()) {
      const socket = meshOf(socketGeometry, Materials.paint(colour, 0.5), 'Socket');
      socket.rotation.x = Math.PI / 2 - THREE.MathUtils.degToRad(12);
      socket.position.set((i - 1) * width * 0.28, height * 0.1, depth / 2 + 0.002);
      this.group.add(socket);
    }

    this.setReading(0, 'V', 'DC V');
    this.group.userData.isHandle = true;
    this.group.userData.apparatus = { id: 'multimeter', label: 'Digital multimeter' };
  }

  setReading(value: number, unit: string, mode: string): void {
    this.#displayValue = value;
    this.#displayUnit = unit;
    this.#mode = mode;
    this.#panel.update((ctx, w, h) => {
      drawBezel(ctx, w, h, { radius: 14, fill: '#a8b8a0', inset: 'rgba(255,255,255,0.5)' });
      ctx.fillStyle = 'rgba(20,30,20,0.35)';
      ctx.font = `${Math.round(h * 0.16)}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.#mode, w * 0.07, h * 0.22);
      drawLcdDigits(ctx, value.toFixed(2), {
        x: w * 0.5,
        y: h * 0.62,
        size: h * 0.42,
        align: 'center',
      });
      ctx.font = `bold ${Math.round(h * 0.2)}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(this.#displayUnit, w * 0.95, h * 0.62);
    });
  }

  get reading(): { value: number; unit: string; mode: string } {
    return { value: this.#displayValue, unit: this.#displayUnit, mode: this.#mode };
  }
}

/** Small "meter reading" helper for the UI: format with the right precision. */
export function formatMeterReading(value: number, fullScale: number): string {
  const decimals = fullScale >= 100 ? 0 : fullScale >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)}`;
}
