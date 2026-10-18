/**
 * The equipment catalogue.
 *
 * Every item a student can take off the shelf is described here: what it is,
 * which topic it belongs to, and how to build its 3D model. Keeping the
 * catalogue in one place means the sidebar, the search box and the
 * experiments all agree about what exists.
 *
 * To add apparatus: write a builder in `src/engine/models/*`, then add an
 * entry below. Nothing else needs to change.
 */

import * as THREE from 'three';
import type { EquipmentDefinition, GroupId } from './types';

import { buildBossHead, buildClamp, buildRetortStand, buildSplitCork } from '@/engine/models/stand';
import { buildPendulumBob, buildThreadReel } from '@/engine/models/pendulum';
import { buildFlatRule, buildMetreRule, buildRuleFoot } from '@/engine/models/rule';
import { buildStopwatch } from '@/engine/models/stopwatch';
import { SpringBalance, SpringModel, buildMassHanger, buildSlottedMass } from '@/engine/models/masses';
import {
  ConcaveMirrorModel,
  ConvexLensModel,
  OpticalBenchModel,
  RayBoxModel,
  buildGlassBlock,
  buildPlaneMirror,
  buildPrism,
  buildProtractor,
  buildScreen,
} from '@/engine/models/optics';
import {
  KnifeSwitchModel,
  LampModel,
  MeterModel,
  MultimeterModel,
  PatchLead,
  RheostatModel,
  buildDryCell,
  buildResistor,
} from '@/engine/models/electricity';
import { PlottingCompassModel, SolenoidModel, buildBarMagnet, buildHorseshoeMagnet, buildIronFilingsCard, buildKeeper } from '@/engine/models/magnetism';

/**
 * Attach a per-frame update hook to a model's root object. {@link Lab} calls
 * it automatically, so animated apparatus (needles, blades, compasses) keeps
 * working without the catalogue needing to expose classes.
 */
function withUpdate<T extends THREE.Object3D>(object: T, update: (dt: number) => void): T {
  object.userData.update = update;
  return object;
}

// ---------------------------------------------------------------------------
// Mechanics
// ---------------------------------------------------------------------------

const mechanics: EquipmentDefinition[] = [
  {
    id: 'retort-stand',
    name: 'Retort stand',
    group: 'mechanics',
    summary: 'Cast-iron base with a 75 cm rod. Carries clamps "at any height".',
    glyph: '🗼',
    keywords: ['stand', 'boss', 'rod', 'support'],
    footprintM: 0.16,
    build: buildRetortStand,
  },
  {
    id: 'boss-head',
    name: 'Boss head',
    group: 'mechanics',
    summary: 'Double clamp that locks a rod to the stand.',
    glyph: '🔩',
    keywords: ['clamp', 'boss', 'grip'],
    footprintM: 0.03,
    build: buildBossHead,
  },
  {
    id: 'clamp',
    name: 'Clamp',
    group: 'mechanics',
    summary: 'Holds the split cork — the point of suspension.',
    glyph: '🗜️',
    keywords: ['clamp', 'jaw', 'grip'],
    footprintM: 0.1,
    build: () => buildClamp({ rodLength: 0.2 }),
  },
  {
    id: 'split-cork',
    name: 'Split cork',
    group: 'mechanics',
    summary: 'A cork with a slit to trap the thread precisely.',
    glyph: '🪵',
    keywords: ['cork', 'suspension', 'pivot'],
    footprintM: 0.02,
    build: () => buildSplitCork(),
  },
  {
    id: 'pendulum-bob-brass',
    name: 'Pendulum bob (brass)',
    group: 'mechanics',
    summary: '25 mm brass bob. Deforms nothing, rusts never.',
    glyph: '🟡',
    keywords: ['bob', 'pendulum', 'brass', 'sphere'],
    footprintM: 0.02,
    build: () => buildPendulumBob({ diameterM: 0.025, material: 'brass' }),
  },
  {
    id: 'pendulum-bob-steel',
    name: 'Pendulum bob (steel)',
    group: 'mechanics',
    summary: '25 mm steel bob — same period, different mass.',
    glyph: '⚪',
    keywords: ['bob', 'pendulum', 'steel'],
    footprintM: 0.02,
    build: () => buildPendulumBob({ diameterM: 0.025, material: 'steel' }),
  },
  {
    id: 'pendulum-bob-plastic',
    name: 'Pendulum bob (plastic)',
    group: 'mechanics',
    summary: '25 mm plastic bob — light enough to feel the air.',
    glyph: '🔴',
    keywords: ['bob', 'pendulum', 'plastic', 'light'],
    footprintM: 0.02,
    build: () => buildPendulumBob({ diameterM: 0.025, material: 'plastic' }),
  },
  {
    id: 'pendulum-bob-small',
    name: 'Pendulum bob (15 mm)',
    group: 'mechanics',
    summary: 'A smaller bob: the point-mass approximation improves.',
    glyph: '🔵',
    keywords: ['bob', 'pendulum', 'small'],
    footprintM: 0.012,
    build: () => buildPendulumBob({ diameterM: 0.015, material: 'brass' }),
  },
  {
    id: 'thread',
    name: 'Suspension thread',
    group: 'mechanics',
    summary: 'Inextensible cotton thread, 1.2 m, with a reel.',
    glyph: '🧵',
    keywords: ['thread', 'string', 'cotton', 'reel'],
    footprintM: 0.05,
    build: buildThreadReel,
  },
  {
    id: 'metre-rule',
    name: 'Metre rule',
    group: 'mechanics',
    summary: '0 – 100 cm, graduations to 1 mm. The measuring workhorse.',
    glyph: '📏',
    keywords: ['rule', 'ruler', 'metre', 'length', 'scale'],
    footprintM: 0.05,
    build: () => buildMetreRule({ lengthM: 1, label: 'METRE RULE' }),
  },
  {
    id: 'half-metre-rule',
    name: 'Half-metre rule',
    group: 'mechanics',
    summary: '0 – 50 cm rule, handy for short pendulums.',
    glyph: '📐',
    keywords: ['rule', 'ruler', 'half', 'length'],
    footprintM: 0.05,
    build: () => buildMetreRule({ lengthM: 0.5, label: 'HALF-METRE RULE' }),
  },
  {
    id: 'rule-foot',
    name: 'Rule foot',
    group: 'mechanics',
    summary: 'Slotted block that holds a rule upright.',
    glyph: '🧱',
    keywords: ['foot', 'holder', 'block'],
    footprintM: 0.08,
    build: buildRuleFoot,
  },
  {
    id: 'stopwatch',
    name: 'Digital stopwatch',
    group: 'mechanics',
    summary: '0.01 s resolution. Your reaction time is the real limit.',
    glyph: '⏱️',
    keywords: ['stopwatch', 'timer', 'time', 'clock'],
    footprintM: 0.04,
    build: () => {
      const view = buildStopwatch();
      // Experiments drive the LCD through this handle.
      view.group.userData.stopwatchView = view;
      return withUpdate(view.group, (dt) => view.update(dt));
    },
  },
  {
    id: 'ticker-timer-rule',
    name: 'Short rule (30 cm)',
    group: 'mechanics',
    summary: 'Flat 30 cm rule for short distances.',
    glyph: '📊',
    keywords: ['rule', 'short', 'optical'],
    footprintM: 0.16,
    build: () => buildFlatRule({ lengthM: 0.3 }),
  },
  {
    id: 'mass-hanger',
    name: 'Mass hanger',
    group: 'mechanics',
    summary: '50 g hanger with a stem for slotted masses.',
    glyph: '🪝',
    keywords: ['hanger', 'mass', 'weight'],
    footprintM: 0.03,
    build: buildMassHanger,
  },
  {
    id: 'mass-10g',
    name: 'Slotted mass 10 g',
    group: 'mechanics',
    summary: '10 g brass disc. The smallest in the box.',
    glyph: '🔘',
    keywords: ['mass', 'weight', 'slotted'],
    footprintM: 0.02,
    build: () => buildSlottedMass(10),
  },
  {
    id: 'mass-20g',
    name: 'Slotted mass 20 g',
    group: 'mechanics',
    summary: '20 g brass disc.',
    glyph: '🔘',
    keywords: ['mass', 'weight', 'slotted'],
    footprintM: 0.02,
    build: () => buildSlottedMass(20),
  },
  {
    id: 'mass-50g',
    name: 'Slotted mass 50 g',
    group: 'mechanics',
    summary: '50 g brass disc.',
    glyph: '🔘',
    keywords: ['mass', 'weight', 'slotted'],
    footprintM: 0.025,
    build: () => buildSlottedMass(50),
  },
  {
    id: 'mass-100g',
    name: 'Slotted mass 100 g',
    group: 'mechanics',
    summary: '100 g brass disc — the heavyweight.',
    glyph: '🔘',
    keywords: ['mass', 'weight', 'slotted'],
    footprintM: 0.03,
    build: () => buildSlottedMass(100),
  },
  {
    id: 'spring-stiff',
    name: 'Spring A (stiff)',
    group: 'mechanics',
    summary: 'Extension spring, k ≈ 25 N/m. Hooke\'s law material.',
    glyph: '🌀',
    keywords: ['spring', 'helix', 'extension', 'hooke'],
    footprintM: 0.03,
    build: () => {
      const spring = new SpringModel({ naturalLengthM: 0.12, springConstantNm: 25 });
      return spring.group;
    },
  },
  {
    id: 'spring-soft',
    name: 'Spring B (soft)',
    group: 'mechanics',
    summary: 'A softer spring, k ≈ 12 N/m. Stretches twice as far.',
    glyph: '🌀',
    keywords: ['spring', 'helix', 'soft'],
    footprintM: 0.03,
    build: () => {
      const spring = new SpringModel({ naturalLengthM: 0.12, springConstantNm: 12 });
      return spring.group;
    },
  },
  {
    id: 'spring-balance',
    name: 'Spring balance',
    group: 'mechanics',
    summary: '0 – 5 N newton meter for weighing in newtons.',
    glyph: '🎣',
    keywords: ['spring', 'balance', 'newton', 'force'],
    footprintM: 0.03,
    build: () => new SpringBalance(5).group,
  },
];

// ---------------------------------------------------------------------------
// Optics
// ---------------------------------------------------------------------------

const optics: EquipmentDefinition[] = [
  {
    id: 'ray-box',
    name: 'Ray box',
    group: 'optics',
    summary: 'Projects 1, 3 or 5 collimated rays.',
    glyph: '🔆',
    keywords: ['ray', 'box', 'light', 'beam'],
    footprintM: 0.08,
    build: () => {
      const model = new RayBoxModel();
      return withUpdate(model.group, () => undefined);
    },
  },
  {
    id: 'convex-lens-f10',
    name: 'Convex lens (f = 10 cm)',
    group: 'optics',
    summary: 'Short-focus converging lens on a stand.',
    glyph: '🔎',
    keywords: ['lens', 'convex', 'converging', 'focal'],
    footprintM: 0.04,
    build: () => new ConvexLensModel(0.1, 0.026).group,
  },
  {
    id: 'convex-lens-f15',
    name: 'Convex lens (f = 15 cm)',
    group: 'optics',
    summary: 'Standard school converging lens.',
    glyph: '🔎',
    keywords: ['lens', 'convex', 'converging'],
    footprintM: 0.04,
    build: () => new ConvexLensModel(0.15, 0.028).group,
  },
  {
    id: 'concave-mirror',
    name: 'Concave mirror',
    group: 'optics',
    summary: 'f = 15 cm converging mirror on a base.',
    glyph: '🪞',
    keywords: ['mirror', 'concave', 'converging'],
    footprintM: 0.05,
    build: () => new ConcaveMirrorModel(0.15, 0.035).group,
  },
  {
    id: 'plane-mirror',
    name: 'Plane mirror',
    group: 'optics',
    summary: 'Reflection, images and the law of reflection.',
    glyph: '🪞',
    keywords: ['mirror', 'plane', 'reflection'],
    footprintM: 0.05,
    build: buildPlaneMirror,
  },
  {
    id: 'glass-block',
    name: 'Glass block (n = 1.50)',
    group: 'optics',
    summary: 'Rectangular block for Snell\'s law.',
    glyph: '🧊',
    keywords: ['glass', 'block', 'refraction', 'snell'],
    footprintM: 0.06,
    build: buildGlassBlock,
  },
  {
    id: 'prism',
    name: 'Glass prism',
    group: 'optics',
    summary: '60° prism: deviation and dispersion.',
    glyph: '🔺',
    keywords: ['prism', 'dispersion', 'refraction'],
    footprintM: 0.04,
    build: buildPrism,
  },
  {
    id: 'screen',
    name: 'White screen',
    group: 'optics',
    summary: 'Gridded screen for catching images.',
    glyph: '🖼️',
    keywords: ['screen', 'card', 'image'],
    footprintM: 0.07,
    build: buildScreen,
  },
  {
    id: 'optical-bench',
    name: 'Optical bench',
    group: 'optics',
    summary: '1 m graduated rail with sliding carriers.',
    glyph: '🛤️',
    keywords: ['bench', 'rail', 'optical'],
    footprintM: 0.5,
    build: () => new OpticalBenchModel(1).group,
  },
  {
    id: 'protractor',
    name: 'Protractor',
    group: 'optics',
    summary: '0 – 180° in 1° divisions.',
    glyph: '📐',
    keywords: ['protractor', 'angle', 'degrees'],
    footprintM: 0.05,
    build: () => buildProtractor(0.05),
  },
];

// ---------------------------------------------------------------------------
// Electricity
// ---------------------------------------------------------------------------

const electricity: EquipmentDefinition[] = [
  {
    id: 'dry-cell',
    name: 'Dry cell (1.5 V)',
    group: 'electricity',
    summary: '1.5 V cell, 0.6 Ω internal resistance.',
    glyph: '🔋',
    keywords: ['cell', 'battery', 'emf', 'voltage'],
    footprintM: 0.02,
    build: () => buildDryCell(1.5),
  },
  {
    id: 'ammeter',
    name: 'Ammeter (0 – 1 A)',
    group: 'electricity',
    summary: 'Moving-coil ammeter, 0.5 Ω internal.',
    glyph: '🅰️',
    keywords: ['ammeter', 'current', 'meter'],
    footprintM: 0.06,
    build: () => {
      const meter = new MeterModel({ label: 'AMMETER', unit: 'A', fullScale: 1, redline: 0.9 }, 0.5);
      return meter.group;
    },
  },
  {
    id: 'voltmeter',
    name: 'Voltmeter (0 – 5 V)',
    group: 'electricity',
    summary: 'Moving-coil voltmeter, 1000 Ω internal.',
    glyph: '🆅',
    keywords: ['voltmeter', 'voltage', 'meter'],
    footprintM: 0.06,
    build: () => {
      const meter = new MeterModel({ label: 'VOLTMETER', unit: 'V', fullScale: 5, redline: 4.5 }, 1000);
      return meter.group;
    },
  },
  {
    id: 'galvanometer',
    name: 'Galvanometer',
    group: 'electricity',
    summary: 'Centre-zero detector for null methods.',
    glyph: '🧭',
    keywords: ['galvanometer', 'null', 'detector'],
    footprintM: 0.06,
    build: () => {
      const meter = new MeterModel({ label: 'GALVANOMETER', unit: 'mA', fullScale: 50, redline: 40 }, 40);
      return meter.group;
    },
  },
  {
    id: 'multimeter',
    name: 'Digital multimeter',
    group: 'electricity',
    summary: 'Volts, amps and ohms on one LCD face.',
    glyph: '📟',
    keywords: ['multimeter', 'digital', 'dmm'],
    footprintM: 0.05,
    build: () => new MultimeterModel().group,
  },
  {
    id: 'rheostat',
    name: 'Rheostat (0 – 20 Ω)',
    group: 'electricity',
    summary: 'Sliding-contact variable resistor.',
    glyph: '🎛️',
    keywords: ['rheostat', 'variable', 'resistor', 'potentiometer'],
    footprintM: 0.09,
    build: () => new RheostatModel(20, 0.14).group,
  },
  {
    id: 'knife-switch',
    name: 'Switch',
    group: 'electricity',
    summary: 'Single-pole knife switch on a wooden base.',
    glyph: '🔘',
    keywords: ['switch', 'key', 'knife'],
    footprintM: 0.05,
    build: () => {
      const model = new KnifeSwitchModel();
      return withUpdate(model.group, (dt) => model.update(dt));
    },
  },
  {
    id: 'resistor-10',
    name: 'Resistor 10 Ω',
    group: 'electricity',
    summary: 'Carbon film, 5 % tolerance. Brown-black-black.',
    glyph: '🟤',
    keywords: ['resistor', 'ohms'],
    footprintM: 0.01,
    build: () => buildResistor(10),
  },
  {
    id: 'resistor-47',
    name: 'Resistor 47 Ω',
    group: 'electricity',
    summary: 'Carbon film, 5 % tolerance. Yellow-violet-black.',
    glyph: '🟡',
    keywords: ['resistor', 'ohms'],
    footprintM: 0.01,
    build: () => buildResistor(47),
  },
  {
    id: 'resistor-100',
    name: 'Resistor 100 Ω',
    group: 'electricity',
    summary: 'Carbon film, 5 % tolerance. Brown-black-brown.',
    glyph: '🟠',
    keywords: ['resistor', 'ohms'],
    footprintM: 0.01,
    build: () => buildResistor(100),
  },
  {
    id: 'lamp',
    name: 'Lamp (2.5 V, 0.3 W)',
    group: 'electricity',
    summary: 'Tungsten filament: resistance rises as it heats.',
    glyph: '💡',
    keywords: ['lamp', 'bulb', 'filament', 'light'],
    footprintM: 0.02,
    build: () => {
      const lamp = new LampModel(2.5, 0.3);
      return lamp.group;
    },
  },
  {
    id: 'lead-red',
    name: 'Connecting lead (red)',
    group: 'electricity',
    summary: 'Patch lead with crocodile clips at both ends.',
    glyph: '🔴',
    keywords: ['lead', 'wire', 'crocodile', 'cable'],
    footprintM: 0.1,
    build: () => new PatchLead('#c0392b', 0.3).group,
  },
  {
    id: 'lead-black',
    name: 'Connecting lead (black)',
    group: 'electricity',
    summary: 'Patch lead with crocodile clips at both ends.',
    glyph: '⚫',
    keywords: ['lead', 'wire', 'crocodile', 'cable'],
    footprintM: 0.1,
    build: () => new PatchLead('#1f2226', 0.3).group,
  },
];

// ---------------------------------------------------------------------------
// Magnetism
// ---------------------------------------------------------------------------

const magnetism: EquipmentDefinition[] = [
  {
    id: 'bar-magnet',
    name: 'Bar magnet',
    group: 'magnetism',
    summary: '10 cm painted steel magnet with N and S stamped.',
    glyph: '🟥',
    keywords: ['magnet', 'bar', 'pole', 'north', 'south'],
    footprintM: 0.06,
    build: () => buildBarMagnet(0.1),
  },
  {
    id: 'keeper',
    name: 'Keeper',
    group: 'magnetism',
    summary: 'Soft-iron bar that "keeps" a magnet strong in storage.',
    glyph: '➖',
    keywords: ['keeper', 'iron', 'storage'],
    footprintM: 0.02,
    build: () => buildKeeper(0.032),
  },
  {
    id: 'horseshoe-magnet',
    name: 'Horseshoe magnet',
    group: 'magnetism',
    summary: 'U-shaped magnet with close-together poles.',
    glyph: '🧲',
    keywords: ['magnet', 'horseshoe', 'u', 'poles'],
    footprintM: 0.04,
    build: () => buildHorseshoeMagnet(),
  },
  {
    id: 'plotting-compass',
    name: 'Plotting compass',
    group: 'magnetism',
    summary: 'Small needle compass for mapping field lines.',
    glyph: '🧭',
    keywords: ['compass', 'needle', 'field', 'plotting'],
    footprintM: 0.015,
    build: () => {
      const model = new PlottingCompassModel(0.011);
      return withUpdate(model.group, (dt) => model.update(dt));
    },
  },
  {
    id: 'solenoid',
    name: 'Solenoid',
    group: 'magnetism',
    summary: '120-turn coil with a removable soft-iron core.',
    glyph: '🌀',
    keywords: ['solenoid', 'coil', 'electromagnet', 'induction'],
    footprintM: 0.08,
    build: () => new SolenoidModel({ lengthM: 0.14, radiusM: 0.013, turns: 120 }).group,
  },
  {
    id: 'iron-filings',
    name: 'Iron filings card',
    group: 'magnetism',
    summary: 'Filings sprinkled on a card reveal the field pattern.',
    glyph: '✨',
    keywords: ['filings', 'field', 'lines', 'card'],
    footprintM: 0.09,
    build: () => buildIronFilingsCard({ sizeM: 0.16 }),
  },
];

/** Every definition, in sidebar order. */
export const CATALOG: readonly EquipmentDefinition[] = [
  ...mechanics,
  ...optics,
  ...electricity,
  ...magnetism,
];

const byId = new Map<string, EquipmentDefinition>(CATALOG.map((definition) => [definition.id, definition]));

/** Look up a definition by id (throws if it does not exist — a coding error). */
export function getEquipment(id: string): EquipmentDefinition {
  const definition = byId.get(id);
  if (!definition) throw new Error(`Unknown equipment id: ${id}`);
  return definition;
}

/** Look up a definition, returning undefined instead of throwing. */
export function findEquipment(id: string): EquipmentDefinition | undefined {
  return byId.get(id);
}

/** All definitions in a group. */
export function equipmentInGroup(group: GroupId): EquipmentDefinition[] {
  return CATALOG.filter((definition) => definition.group === group);
}

/** Simple fuzzy search over name, summary and keywords. */
export function searchEquipment(query: string): EquipmentDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...CATALOG];
  const terms = q.split(/\s+/);
  return CATALOG.filter((definition) => {
    const haystack = [definition.name, definition.summary, definition.group, ...(definition.keywords ?? [])]
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
