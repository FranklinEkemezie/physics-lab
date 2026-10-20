/**
 * Circuit-diagram components.
 *
 * These are the symbols from a circuit diagram, given a physical body: a
 * resistor's zigzag, an inductor's coil, a capacitor's parallel plates, a
 * knife switch, a cell, a lamp, and the two meters. Each sits on a small tile
 * with binding posts at either end, so it can be laid out on a bench and wired
 * up — and each is readable from above, where a circuit diagram is normally
 * drawn.
 *
 * Nothing here imports the lab or the catalogue: a host can build a resistor
 * tile for a quiz, a poster or another simulator.
 */

import * as THREE from 'three';
import { helixGeometry, makeLabelTexture, meshOf, roundedBox } from '../../geometry';
import { Materials } from '../../materials';
import { applyDisplayOptions, type ModelDisplayOptions, type ModelEntry } from './types';

export interface CircuitSymbolOptions extends ModelDisplayOptions {
  /** Width of the tile in metres. */
  widthM?: number;
  /** Accent colour for the symbol itself. */
  accent?: string;
  /** Knife-switch position (ignored by other components). */
  closed?: boolean;
}

const TILE_DEPTH_M = 0.075;
const TILE_THICKNESS_M = 0.006;
const SYMBOL_Y = TILE_THICKNESS_M + 0.003;

/** The plinth every symbol sits on, with a pair of binding posts. */
function buildTile(widthM: number): { tile: THREE.Group; leftX: number; rightX: number } {
  const tile = new THREE.Group();
  tile.name = 'SymbolTile';

  const base = meshOf(
    roundedBox(widthM, TILE_THICKNESS_M, TILE_DEPTH_M, 0.004),
    Materials.paint('#1d2a31', 0.62),
    'Tile',
  );
  base.position.y = TILE_THICKNESS_M / 2;
  tile.add(base);

  const leftX = -widthM * 0.42;
  const rightX = widthM * 0.42;
  const postGeometry = new THREE.CylinderGeometry(0.004, 0.004, 0.014, 14);
  for (const [x, colour] of [
    [leftX, '#c0392b'],
    [rightX, '#2c3136'],
  ] as const) {
    const post = meshOf(postGeometry, Materials.agedBrass(), 'Terminal');
    post.position.set(x, TILE_THICKNESS_M + 0.007, 0);
    tile.add(post);
    const cap = meshOf(new THREE.CylinderGeometry(0.0046, 0.0046, 0.003, 14), Materials.paint(colour, 0.5), 'TerminalCap');
    cap.position.set(x, TILE_THICKNESS_M + 0.014, 0);
    tile.add(cap);
  }

  return { tile, leftX, rightX };
}

/** A straight wire between two points, built as a cylinder. */
function wire(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radiusM: number,
  material: THREE.Material,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radiusM, radiusM, length, 10);
  const mesh = meshOf(geometry, material, 'Wire');
  mesh.position.copy(from).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

/** Connect both binding posts to the symbol's ends. */
function leads(
  tile: THREE.Group,
  leftX: number,
  rightX: number,
  symbolHalfWidthM: number,
  material: THREE.Material,
): void {
  const y = SYMBOL_Y;
  tile.add(wire(new THREE.Vector3(leftX, y, 0), new THREE.Vector3(-symbolHalfWidthM, y, 0), 0.0016, material));
  tile.add(wire(new THREE.Vector3(symbolHalfWidthM, y, 0), new THREE.Vector3(rightX, y, 0), 0.0016, material));
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function buildResistorSymbol(options: CircuitSymbolOptions = {}): THREE.Group {
  const { widthM = 0.18, accent = '#c98b4a' } = options;
  const { tile, leftX, rightX } = buildTile(widthM);
  const material = Materials.paint(accent, 0.34);
  const half = widthM * 0.22;
  const amplitude = TILE_DEPTH_M * 0.3;

  const points: THREE.Vector3[] = [new THREE.Vector3(-half, SYMBOL_Y, 0)];
  const teeth = 6;
  for (let index = 0; index < teeth; index += 1) {
    const x = -half + ((index + 0.5) / teeth) * half * 2;
    points.push(new THREE.Vector3(x, SYMBOL_Y, index % 2 === 0 ? amplitude : -amplitude));
  }
  points.push(new THREE.Vector3(half, SYMBOL_Y, 0));

  for (let index = 0; index < points.length - 1; index += 1) {
    tile.add(wire(points[index], points[index + 1], 0.0022, material));
  }
  leads(tile, leftX, rightX, half, material);

  tile.name = 'Resistor';
  tile.userData.model = { id: 'circuit-resistor', label: 'Resistor' };
  return applyDisplayOptions(tile, options) as THREE.Group;
}

export function buildInductor(options: CircuitSymbolOptions = {}): THREE.Group {
  const { widthM = 0.18, accent = '#c98b4a' } = options;
  const { tile, leftX, rightX } = buildTile(widthM);
  const material = Materials.paint(accent, 0.3);
  const half = widthM * 0.2;

  const coil = new THREE.Mesh(helixGeometry(0.016, half * 2, 5, 0.0022), material);
  coil.name = 'Coil';
  // helixGeometry runs along +Y; stand it on its side so the axis is +X.
  coil.rotation.z = -Math.PI / 2;
  coil.position.set(-half, 0.019, 0);
  tile.add(coil);

  leads(tile, leftX, rightX, half, material);
  tile.name = 'Inductor';
  tile.userData.model = { id: 'circuit-inductor', label: 'Inductor' };
  return applyDisplayOptions(tile, options) as THREE.Group;
}

export function buildCapacitor(options: CircuitSymbolOptions = {}): THREE.Group {
  const { widthM = 0.18, accent = '#b9c4cf' } = options;
  const { tile, leftX, rightX } = buildTile(widthM);
  const material = Materials.paint(accent, 0.28);
  const half = widthM * 0.12;

  for (const side of [-1, 1]) {
    const plate = meshOf(
      new THREE.BoxGeometry(0.003, 0.036, TILE_DEPTH_M * 0.46),
      material,
      'Plate',
    );
    plate.position.set(side * 0.007, SYMBOL_Y + 0.018, 0);
    tile.add(plate);
    tile.add(
      wire(
        new THREE.Vector3(side * 0.007, SYMBOL_Y + 0.018, 0),
        new THREE.Vector3(side * half, SYMBOL_Y, 0),
        0.0016,
        material,
      ),
    );
  }
  leads(tile, leftX, rightX, half, material);

  tile.name = 'Capacitor';
  tile.userData.model = { id: 'circuit-capacitor', label: 'Capacitor' };
  return applyDisplayOptions(tile, options) as THREE.Group;
}

export function buildSwitch(options: CircuitSymbolOptions = {}): THREE.Group {
  const { widthM = 0.18, accent = '#d8b24a', closed = false } = options;
  const { tile, leftX, rightX } = buildTile(widthM);
  const material = Materials.paint(accent, 0.3);
  const half = widthM * 0.2;

  // Hinge post and contact post.
  for (const side of [-1, 1]) {
    const post = meshOf(
      new THREE.CylinderGeometry(0.005, 0.005, 0.02, 14),
      Materials.agedBrass(),
      'SwitchPost',
    );
    post.position.set(side * half, SYMBOL_Y + 0.01, 0);
    tile.add(post);
  }

  const bladeLength = half * 2;
  const blade = meshOf(new THREE.BoxGeometry(bladeLength, 0.004, 0.008), material, 'Blade');
  blade.position.set(0, SYMBOL_Y + 0.02, 0);
  // Pivot at the left post: build it as a group so the angle is honest.
  const bladePivot = new THREE.Group();
  bladePivot.position.set(-half, SYMBOL_Y + 0.02, 0);
  blade.position.x = bladeLength / 2;
  bladePivot.add(blade);

  const knob = meshOf(new THREE.SphereGeometry(0.009, 12, 10), Materials.paint('#e8e3d6', 0.5), 'Knob');
  knob.position.set(bladeLength, 0, 0);
  bladePivot.add(knob);

  bladePivot.rotation.z = closed ? 0 : THREE.MathUtils.degToRad(26);
  tile.add(bladePivot);

  leads(tile, leftX, rightX, half, material);
  tile.name = 'Switch';
  tile.userData.model = { id: 'circuit-switch', label: closed ? 'Closed switch' : 'Open switch' };
  tile.userData.facts = [closed ? 'The blade bridges the contacts: current can flow.' : 'The blade is lifted: the circuit is broken.'];
  return applyDisplayOptions(tile, options) as THREE.Group;
}

export function buildCell(options: CircuitSymbolOptions = {}): THREE.Group {
  const { widthM = 0.18, accent = '#7f8a96' } = options;
  const { tile, leftX, rightX } = buildTile(widthM);
  const material = Materials.paint(accent, 0.3);
  const half = widthM * 0.12;

  // The long line is the positive terminal; the short, thicker line is negative.
  const longPlate = meshOf(new THREE.BoxGeometry(0.003, 0.04, TILE_DEPTH_M * 0.5), material, 'PositivePlate');
  longPlate.position.set(-0.012, SYMBOL_Y + 0.02, 0);
  tile.add(longPlate);

  const shortPlate = meshOf(new THREE.BoxGeometry(0.007, 0.024, TILE_DEPTH_M * 0.5), material, 'NegativePlate');
  shortPlate.position.set(0.012, SYMBOL_Y + 0.012, 0);
  tile.add(shortPlate);

  for (const side of [-1, 1]) {
    tile.add(
      wire(
        new THREE.Vector3(side * 0.012, SYMBOL_Y + 0.018, 0),
        new THREE.Vector3(side * half, SYMBOL_Y, 0),
        0.0016,
        material,
      ),
    );
  }
  leads(tile, leftX, rightX, half, material);

  tile.name = 'Cell';
  tile.userData.model = { id: 'circuit-cell', label: 'Cell' };
  return applyDisplayOptions(tile, options) as THREE.Group;
}

export function buildLampSymbol(options: CircuitSymbolOptions = {}): THREE.Group {
  const { widthM = 0.18, accent = '#e8c34a' } = options;
  const { tile, leftX, rightX } = buildTile(widthM);
  const material = Materials.paint(accent, 0.3);
  const radius = 0.028;

  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0022, 8, 48), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, SYMBOL_Y, 0);
  tile.add(ring);

  const diagonal = radius * Math.SQRT2 * 0.92;
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    const bar = meshOf(new THREE.BoxGeometry(diagonal, 0.002, 0.0022), material, 'Cross');
    bar.position.set(0, SYMBOL_Y, 0);
    bar.rotation.y = angle;
    tile.add(bar);
  }

  leads(tile, leftX, rightX, radius, material);
  tile.name = 'LampSymbol';
  tile.userData.model = { id: 'circuit-lamp', label: 'Lamp' };
  return applyDisplayOptions(tile, options) as THREE.Group;
}

/** A round meter symbol with a letter in the middle. */
function buildMeterSymbol(letter: string, id: string, label: string, options: CircuitSymbolOptions): THREE.Group {
  const { widthM = 0.18, accent = '#9fb2c4' } = options;
  const { tile, leftX, rightX } = buildTile(widthM);
  const material = Materials.paint(accent, 0.3);
  const radius = 0.028;

  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0022, 8, 48), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, SYMBOL_Y, 0);
  tile.add(ring);

  const texture = makeLabelTexture({ text: letter, foreground: '#f7f3e6', fontScale: 0.62 });
  const glyph = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 1.35, radius * 1.35),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  glyph.name = `Label${letter}`;
  glyph.rotation.x = -Math.PI / 2;
  glyph.position.set(0, SYMBOL_Y + 0.0005, 0);
  tile.add(glyph);

  leads(tile, leftX, rightX, radius, material);
  tile.name = label.replace(/\s+/g, '');
  tile.userData.model = { id, label };
  return applyDisplayOptions(tile, options) as THREE.Group;
}

export function buildAmmeterSymbol(options: CircuitSymbolOptions = {}): THREE.Group {
  return buildMeterSymbol('A', 'circuit-ammeter', 'Ammeter', options);
}

export function buildVoltmeterSymbol(options: CircuitSymbolOptions = {}): THREE.Group {
  return buildMeterSymbol('V', 'circuit-voltmeter', 'Voltmeter', options);
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export const CIRCUIT_MODELS: readonly ModelEntry[] = [
  {
    id: 'circuit-resistor',
    label: 'Resistor',
    category: 'circuit',
    summary: 'The zigzag symbol for a fixed resistance, on a wiring tile.',
    facts: ['A resistor converts electrical energy to heat.', 'The zigzag is the standard IEC/BS symbol.'],
    build: (options) => buildResistorSymbol(options),
  },
  {
    id: 'circuit-inductor',
    label: 'Inductor',
    category: 'circuit',
    summary: 'A coil of wire: it opposes changes in current.',
    facts: ['Energy is stored in the magnetic field around the coil.', 'The unit is the henry (H).'],
    build: (options) => buildInductor(options),
  },
  {
    id: 'circuit-capacitor',
    label: 'Capacitor',
    category: 'circuit',
    summary: 'Two parallel plates separated by an insulator.',
    facts: ['Stores charge Q = CV.', 'The unit is the farad (F).'],
    build: (options) => buildCapacitor(options),
  },
  {
    id: 'circuit-switch',
    label: 'Switch (open)',
    category: 'circuit',
    summary: 'A knife switch with the blade lifted: the circuit is broken.',
    facts: ['Closing the switch completes the circuit.'],
    build: (options) => buildSwitch({ ...options, closed: false }),
  },
  {
    id: 'circuit-switch-closed',
    label: 'Switch (closed)',
    category: 'circuit',
    summary: 'The same knife switch, closed and conducting.',
    facts: ['A closed switch has (almost) zero resistance.'],
    build: (options) => buildSwitch({ ...options, closed: true }),
  },
  {
    id: 'circuit-cell',
    label: 'Cell',
    category: 'circuit',
    summary: 'The long-line/short-line symbol for a single electrochemical cell.',
    facts: ['The long line is the positive terminal.', 'E.m.f. is measured in volts.'],
    build: (options) => buildCell(options),
  },
  {
    id: 'circuit-lamp',
    label: 'Lamp',
    category: 'circuit',
    summary: 'A circle with a cross: the standard lamp symbol.',
    facts: ['The filament’s resistance rises as it heats up.'],
    build: (options) => buildLampSymbol(options),
  },
  {
    id: 'circuit-ammeter',
    label: 'Ammeter',
    category: 'circuit',
    summary: 'A circle with an A, connected in series.',
    facts: ['An ammeter has very low resistance and is connected in series.'],
    build: (options) => buildAmmeterSymbol(options),
  },
  {
    id: 'circuit-voltmeter',
    label: 'Voltmeter',
    category: 'circuit',
    summary: 'A circle with a V, connected in parallel.',
    facts: ['A voltmeter has very high resistance and is connected in parallel.'],
    build: (options) => buildVoltmeterSymbol(options),
  },
];
