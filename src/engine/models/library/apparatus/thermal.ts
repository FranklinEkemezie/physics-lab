/**
 * Thermal apparatus: thermometers, a bomb calorimeter, a tripod, a Bunsen
 * burner and a beaker.
 *
 * The calorimeter is the important one. It is a complete, instrumented model:
 * the thermometer column moves, the heater coil glows when it is powered, and
 * the stirrer turns. A practical can drive all of that through the view object
 * attached to `userData.calorimeter` without knowing how the model is built.
 */

import * as THREE from 'three';
import { makeLabelTexture, meshOf, roundedBox } from '../../../geometry';
import { Materials } from '../../../materials';
import { applyDisplayOptions, type ModelDisplayOptions, type ModelEntry } from '../types';

// ---------------------------------------------------------------------------
// Thermometer
// ---------------------------------------------------------------------------

export interface ThermometerOptions extends ModelDisplayOptions {
  /** Stem length in metres (above the bulb). */
  heightM?: number;
  minC?: number;
  maxC?: number;
}

export interface ThermometerView {
  setTemperature(celsius: number): void;
  readonly temperatureC: number;
}

/** A printed °C scale for the thermometer's backing strip. */
function makeThermometerTexture(minC: number, maxC: number): THREE.CanvasTexture {
  const widthPx = 96;
  const heightPx = 512;
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#f7f3e6';
  ctx.fillRect(0, 0, widthPx, heightPx);

  const margin = heightPx * 0.02;
  const yOf = (value: number): number =>
    heightPx - margin - ((value - minC) / (maxC - minC)) * (heightPx - margin * 2);

  for (let value = minC; value <= maxC; value += 2) {
    const major = value % 10 === 0;
    const y = yOf(value);
    ctx.strokeStyle = '#22262b';
    ctx.lineWidth = major ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(widthPx, y);
    ctx.lineTo(widthPx - (major ? 26 : 14), y);
    ctx.stroke();
  }

  ctx.fillStyle = '#22262b';
  ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let value = minC; value <= maxC; value += 20) {
    ctx.fillText(String(value), 4, yOf(value));
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function buildThermometer(options: ThermometerOptions = {}): THREE.Group {
  const { heightM = 0.16, minC = 0, maxC = 100, accent = '#c0392b' } = options;
  const group = new THREE.Group();
  group.name = 'Thermometer';

  const bulbY = 0.007;
  const bulbRadius = 0.0055;

  const bulb = meshOf(new THREE.SphereGeometry(bulbRadius, 16, 12), Materials.paint(accent, 0.2), 'Bulb');
  bulb.position.y = bulbY;
  group.add(bulb);

  const stemBottom = 0.006;
  const stem = meshOf(
    new THREE.CylinderGeometry(0.0032, 0.0036, heightM, 16, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.24,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    'Stem',
  );
  stem.position.y = stemBottom + heightM / 2;
  group.add(stem);

  // The liquid column: a unit-height cylinder scaled to the reading.
  const column = meshOf(
    new THREE.CylinderGeometry(0.0015, 0.0015, 1, 10),
    Materials.paint(accent, 0.25),
    'Column',
  );
  column.position.y = bulbY;
  group.add(column);

  const scaleTexture = makeThermometerTexture(minC, maxC);
  const scale = new THREE.Mesh(
    new THREE.PlaneGeometry(0.016, heightM * 0.96),
    new THREE.MeshStandardMaterial({ map: scaleTexture, roughness: 0.8, side: THREE.DoubleSide }),
  );
  scale.name = 'LabelScale';
  scale.position.set(0, stemBottom + heightM * 0.5, -0.0038);
  group.add(scale);

  const cap = meshOf(
    new THREE.SphereGeometry(0.0038, 12, 8),
    Materials.paint('#2b2f33', 0.4),
    'Cap',
  );
  cap.position.y = stemBottom + heightM;
  group.add(cap);

  let temperatureC = 20;
  const setTemperature = (celsius: number): void => {
    temperatureC = THREE.MathUtils.clamp(celsius, minC, maxC);
    const fraction = (temperatureC - minC) / (maxC - minC);
    const columnHeight = 0.004 + fraction * (heightM * 0.94);
    column.scale.y = columnHeight;
    column.position.y = bulbY + columnHeight / 2;
  };
  setTemperature(temperatureC);

  const view: ThermometerView = {
    setTemperature,
    get temperatureC() {
      return temperatureC;
    },
  };

  group.userData.thermometer = view;
  group.userData.model = { id: 'apparatus-thermometer', label: 'Thermometer' };
  group.userData.facts = [
    'A liquid-in-glass thermometer works because the liquid expands more than the glass.',
    'Read at eye level to avoid parallax error.',
  ];
  return applyDisplayOptions(group, options) as THREE.Group;
}

export const THERMOMETER_MODEL: ModelEntry = {
  id: 'apparatus-thermometer',
  label: 'Thermometer',
  category: 'apparatus',
  summary: 'A liquid-in-glass thermometer with a printed °C scale and a moving column.',
  facts: ['The bulb holds the liquid; the column shows its expansion.'],
  build: (options) => buildThermometer(options),
};

// ---------------------------------------------------------------------------
// Bomb calorimeter
// ---------------------------------------------------------------------------

export interface BombCalorimeterOptions extends ModelDisplayOptions {
  /** Initial water mass in kilograms (sets the visible water level). */
  waterMassKg?: number;
}

export interface BombCalorimeterView {
  setTemperature(celsius: number): void;
  setHeating(on: boolean): void;
  setStirring(on: boolean): void;
  setWaterMass(kg: number): void;
  readonly temperatureC: number;
  readonly heating: boolean;
  readonly stirring: boolean;
}

export function buildBombCalorimeter(options: BombCalorimeterOptions = {}): THREE.Group {
  const { waterMassKg = 0.45 } = options;
  const group = new THREE.Group();
  group.name = 'BombCalorimeter';

  const vesselRadius = 0.062;
  const waterRadius = 0.055;
  const baseY = 0.014;

  const base = meshOf(roundedBox(0.22, baseY, 0.16, 0.005), Materials.darkWood(), 'Base');
  base.position.y = baseY / 2;
  group.add(base);

  // Outer jacket, open at the top.
  const jacket = meshOf(
    new THREE.CylinderGeometry(vesselRadius, vesselRadius, 0.13, 44, 1, true),
    Materials.copper(),
    'Jacket',
  );
  jacket.position.y = baseY + 0.065;
  group.add(jacket);

  const jacketFloor = meshOf(
    new THREE.CylinderGeometry(vesselRadius, vesselRadius, 0.006, 44),
    Materials.copper(),
    'JacketFloor',
  );
  jacketFloor.position.y = baseY + 0.003;
  group.add(jacketFloor);

  const rim = meshOf(
    new THREE.TorusGeometry(vesselRadius, 0.0035, 10, 48),
    Materials.copper(),
    'Rim',
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = baseY + 0.13;
  group.add(rim);

  // The water. Its material is owned by this model so the temperature tint can
  // change without affecting any other translucent object in the scene.
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#4f8fbf'),
    transparent: true,
    opacity: 0.52,
    roughness: 0.12,
    metalness: 0,
    transmission: 0.35,
    depthWrite: false,
  });
  const water = meshOf(
    new THREE.CylinderGeometry(waterRadius, waterRadius, 1, 40),
    waterMaterial,
    'Water',
  );
  water.position.y = baseY;
  group.add(water);

  // The bomb itself: a stout steel cylinder with a clamped lid.
  const bomb = meshOf(
    new THREE.CylinderGeometry(0.028, 0.028, 0.06, 32),
    Materials.blackSteel(),
    'Bomb',
  );
  bomb.position.y = baseY + 0.03;
  group.add(bomb);

  const bombLid = meshOf(
    new THREE.CylinderGeometry(0.032, 0.032, 0.01, 32),
    Materials.paint('#5b636c', 0.3),
    'BombLid',
  );
  bombLid.position.y = baseY + 0.065;
  group.add(bombLid);

  // Electrodes for the firing circuit / heater.
  const electrodeMaterial = Materials.agedBrass();
  for (const [index, side] of [-1, 1].entries()) {
    const post = meshOf(new THREE.CylinderGeometry(0.0035, 0.0035, 0.018, 12), electrodeMaterial, 'Electrode');
    post.position.set(side * 0.012, baseY + 0.079, 0);
    group.add(post);
    const cap = meshOf(
      new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 12),
      Materials.paint(index === 0 ? '#c0392b' : '#1f2226', 0.4),
      'ElectrodeCap',
    );
    cap.position.set(side * 0.012, baseY + 0.089, 0);
    group.add(cap);
  }

  // Heating coil around the bomb.
  const coilMaterial = new THREE.MeshStandardMaterial({
    color: 0x5b4a3a,
    emissive: new THREE.Color('#ff5a1f'),
    emissiveIntensity: 0,
    roughness: 0.45,
    metalness: 0.6,
  });
  const coil = new THREE.Mesh(helixGeometrySafe(0.034, 0.045, 6, 0.0016), coilMaterial);
  coil.name = 'HeaterCoil';
  coil.position.y = baseY + 0.014;
  group.add(coil);

  const glow = new THREE.PointLight(0xff7a33, 0, 0.32, 2);
  glow.position.set(0, baseY + 0.05, 0);
  glow.name = 'HeaterGlow';
  group.add(glow);

  // Stirrer: a paddled rod through the lid.
  const stirrer = new THREE.Group();
  stirrer.name = 'Stirrer';
  stirrer.position.set(0.045, 0, 0.0);
  const stirrerRod = meshOf(
    new THREE.CylinderGeometry(0.0028, 0.0028, 0.17, 10),
    Materials.paint('#8a929b', 0.3),
    'StirrerRod',
  );
  stirrerRod.position.y = baseY + 0.085;
  stirrer.add(stirrerRod);
  for (const angle of [0, Math.PI / 2]) {
    const paddle = meshOf(
      new THREE.BoxGeometry(0.03, 0.012, 0.006),
      Materials.paint('#8a929b', 0.35),
      'StirrerPaddle',
    );
    paddle.position.set(0, baseY + 0.02, 0);
    paddle.rotation.y = angle;
    stirrer.add(paddle);
  }
  group.add(stirrer);

  // Thermometer through the lid, bulb in the water.
  const thermometer = buildThermometer({ heightM: 0.15, minC: 0, maxC: 100 });
  thermometer.position.set(-0.04, baseY + 0.012, 0.012);
  group.add(thermometer);
  const thermometerView = thermometer.userData.thermometer as ThermometerView;

  // Terminal block and two drooping leads.
  const block = meshOf(
    roundedBox(0.035, 0.012, 0.05, 0.004),
    Materials.paint('#2b2f33', 0.5),
    'TerminalBlock',
  );
  block.position.set(0.092, baseY + 0.006, 0);
  group.add(block);
  const leadMaterial = Materials.paint('#1f2226', 0.6);
  for (const side of [-1, 1]) {
    const endX = 0.092 + side * 0.009;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.012, baseY + 0.092, 0),
      new THREE.Vector3(side * 0.04, baseY + 0.1, 0.018),
      new THREE.Vector3(0.075 + side * 0.005, baseY + 0.07, 0.022),
      new THREE.Vector3(endX, baseY + 0.014, 0.012),
    ]);
    const lead = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 30, 0.0018, 6, false),
      leadMaterial,
    );
    lead.name = 'Lead';
    group.add(lead);
    const post = meshOf(new THREE.CylinderGeometry(0.0035, 0.0035, 0.01, 10), Materials.agedBrass(), 'Terminal');
    post.position.set(endX, baseY + 0.012, 0.012);
    group.add(post);
  }

  // A ring-shaped lid so the apparatus stays visible from above.
  const lid = meshOf(
    new THREE.RingGeometry(0.034, vesselRadius, 48),
    Materials.copper(),
    'Lid',
  );
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = baseY + 0.131;
  group.add(lid);

  let temperatureC = 20;
  let heating = false;
  let stirring = false;

  const setWaterMass = (kg: number): void => {
    const height = THREE.MathUtils.clamp(kg / (1000 * Math.PI * waterRadius * waterRadius), 0.01, 0.11);
    water.scale.y = height;
    water.position.y = baseY + height / 2;
  };
  setWaterMass(waterMassKg);

  const setTemperature = (celsius: number): void => {
    temperatureC = celsius;
    thermometerView.setTemperature(celsius);
    // A gentle warm tint: cold water is blue, hot water drifts towards teal.
    const warmth = THREE.MathUtils.clamp((celsius - 10) / 80, 0, 1);
    waterMaterial.color.setRGB(
      THREE.MathUtils.lerp(0.31, 0.16, warmth),
      THREE.MathUtils.lerp(0.56, 0.62, warmth),
      THREE.MathUtils.lerp(0.75, 0.62, warmth),
    );
  };
  setTemperature(temperatureC);

  const setHeating = (on: boolean): void => {
    heating = on;
    coilMaterial.emissiveIntensity = on ? 1.5 : 0;
    glow.intensity = on ? 0.55 : 0;
  };

  const setStirring = (on: boolean): void => {
    stirring = on;
  };

  group.userData.update = (dt: number): void => {
    if (stirring) stirrer.rotation.y += dt * 5.5;
    if (heating) {
      // A little flicker, so the coil looks hot rather than painted orange.
      coilMaterial.emissiveIntensity = 1.35 + Math.sin(performance.now() * 0.012) * 0.18;
    }
  };

  const view: BombCalorimeterView = {
    setTemperature,
    setHeating,
    setStirring,
    setWaterMass,
    get temperatureC() {
      return temperatureC;
    },
    get heating() {
      return heating;
    },
    get stirring() {
      return stirring;
    },
  };

  group.userData.calorimeter = view;
  group.userData.model = { id: 'apparatus-bomb-calorimeter', label: 'Bomb calorimeter' };
  group.userData.facts = [
    'The bomb is a constant-volume vessel: the reaction happens in a sealed steel cylinder.',
    'The water jacket absorbs the heat, and its temperature rise gives the energy released.',
    'The stirrer keeps the water at a uniform temperature.',
  ];
  return applyDisplayOptions(group, options) as THREE.Group;
}

/** Local helix helper, kept here so this module has no hidden dependency. */
function helixGeometrySafe(
  radius: number,
  height: number,
  turns: number,
  wireRadius: number,
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const total = Math.max(24, Math.floor(turns * 28));
  for (let index = 0; index <= total; index += 1) {
    const t = index / total;
    const angle = t * turns * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, t * height, Math.sin(angle) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, total, wireRadius, 6, false);
}

export const BOMB_CALORIMETER_MODEL: ModelEntry = {
  id: 'apparatus-bomb-calorimeter',
  label: 'Bomb calorimeter',
  category: 'apparatus',
  summary: 'A sealed steel bomb in a water jacket, with a heater, stirrer and thermometer.',
  facts: [
    'Used to measure the energy released by burning a sample.',
    'In the electrical-calibration method, a known heater energy gives the water’s specific heat capacity.',
  ],
  build: (options) => buildBombCalorimeter(options),
};

// ---------------------------------------------------------------------------
// Tripod, Bunsen burner, beaker
// ---------------------------------------------------------------------------

export interface TripodOptions extends ModelDisplayOptions {
  heightM?: number;
}

export function buildTripod(options: TripodOptions = {}): THREE.Group {
  const { heightM = 0.12 } = options;
  const group = new THREE.Group();
  group.name = 'Tripod';

  const ringRadius = 0.055;
  const ring = meshOf(new THREE.TorusGeometry(ringRadius, 0.004, 10, 48), Materials.blackSteel(), 'Ring');
  ring.rotation.x = Math.PI / 2;
  ring.position.y = heightM;
  group.add(ring);

  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2;
    const top = new THREE.Vector3(Math.cos(angle) * ringRadius, heightM, Math.sin(angle) * ringRadius);
    const bottom = new THREE.Vector3(Math.cos(angle) * 0.075, 0, Math.sin(angle) * 0.075);
    const direction = new THREE.Vector3().subVectors(bottom, top);
    const leg = meshOf(
      new THREE.CylinderGeometry(0.0035, 0.0042, direction.length(), 10),
      Materials.blackSteel(),
      'Leg',
    );
    leg.position.copy(top).addScaledVector(direction, 0.5);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    group.add(leg);
  }

  group.userData.model = { id: 'apparatus-tripod', label: 'Tripod' };
  return applyDisplayOptions(group, options) as THREE.Group;
}

export const TRIPOD_MODEL: ModelEntry = {
  id: 'apparatus-tripod',
  label: 'Tripod',
  category: 'apparatus',
  summary: 'A three-legged stand with a ring for a gauze or a beaker.',
  build: (options) => buildTripod(options),
};

export interface BunsenOptions extends ModelDisplayOptions {
  lit?: boolean;
}

export function buildBunsenBurner(options: BunsenOptions = {}): THREE.Group {
  const { lit = false } = options;
  const group = new THREE.Group();
  group.name = 'BunsenBurner';

  const base = meshOf(new THREE.CylinderGeometry(0.035, 0.038, 0.012, 28), Materials.castIron(), 'Base');
  base.position.y = 0.006;
  group.add(base);

  const barrel = meshOf(new THREE.CylinderGeometry(0.011, 0.013, 0.1, 24), Materials.brass(), 'Barrel');
  barrel.position.y = 0.062;
  group.add(barrel);

  const collar = meshOf(new THREE.CylinderGeometry(0.015, 0.015, 0.018, 24), Materials.brass(), 'Collar');
  collar.position.y = 0.075;
  group.add(collar);

  const inlet = meshOf(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 12), Materials.rubber(), 'GasInlet');
  inlet.rotation.z = Math.PI / 2;
  inlet.position.set(-0.02, 0.012, 0);
  group.add(inlet);

  const flameMaterial = new THREE.MeshStandardMaterial({
    color: 0x66b8ff,
    emissive: new THREE.Color('#4a9bff'),
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.55,
    roughness: 0.2,
    depthWrite: false,
  });
  const flame = meshOf(new THREE.ConeGeometry(0.014, 0.075, 18, 1, true), flameMaterial, 'Flame');
  flame.position.y = 0.15;
  flame.visible = lit;
  group.add(flame);

  const light = new THREE.PointLight(0x6fb6ff, lit ? 0.35 : 0, 0.4, 2);
  light.position.y = 0.15;
  group.add(light);

  group.userData.burner = {
    setLit(on: boolean): void {
      flame.visible = on;
      light.intensity = on ? 0.35 : 0;
    },
  };
  group.userData.model = { id: 'apparatus-bunsen-burner', label: 'Bunsen burner' };
  return applyDisplayOptions(group, options) as THREE.Group;
}

export const BUNSEN_MODEL: ModelEntry = {
  id: 'apparatus-bunsen-burner',
  label: 'Bunsen burner',
  category: 'apparatus',
  summary: 'A laboratory gas burner with a blue flame.',
  facts: ['The air hole controls the mix: a yellow, sooty flame is cooler than a blue one.'],
  build: (options) => buildBunsenBurner(options),
};

export interface BeakerOptions extends ModelDisplayOptions {
  /** Fraction of the beaker filled with water, 0–1. */
  fill?: number;
  /** Capacity printed on the side, in millilitres. */
  capacityMl?: number;
}

export function buildBeaker(options: BeakerOptions = {}): THREE.Group {
  const { fill = 0.45, capacityMl = 250 } = options;
  const group = new THREE.Group();
  group.name = 'Beaker';

  const radius = 0.04;
  const height = 0.09;

  const glass = meshOf(
    new THREE.CylinderGeometry(radius, radius, height, 36, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    'Glass',
  );
  glass.position.y = height / 2;
  group.add(glass);

  const floor = meshOf(
    new THREE.CylinderGeometry(radius, radius, 0.003, 36),
    Materials.glass(),
    'Floor',
  );
  floor.position.y = 0.0015;
  group.add(floor);

  const water = meshOf(
    new THREE.CylinderGeometry(radius * 0.96, radius * 0.96, 1, 36),
    new THREE.MeshPhysicalMaterial({
      color: 0x6aa6cf,
      transparent: true,
      opacity: 0.45,
      roughness: 0.08,
      transmission: 0.4,
      depthWrite: false,
    }),
    'Water',
  );
  const waterHeight = Math.max(0.002, height * THREE.MathUtils.clamp(fill, 0, 0.95));
  water.scale.y = waterHeight;
  water.position.y = waterHeight / 2 + 0.003;
  group.add(water);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.03, 0.012),
    new THREE.MeshBasicMaterial({
      map: makeLabelTexture({ text: `${capacityMl} ml`, foreground: '#3a4652' }),
      transparent: true,
      depthWrite: false,
    }),
  );
  label.name = 'LabelCapacity';
  label.position.set(0, height * 0.72, radius + 0.0005);
  group.add(label);

  group.userData.model = { id: 'apparatus-beaker', label: 'Beaker' };
  return applyDisplayOptions(group, options) as THREE.Group;
}

export const BEAKER_MODEL: ModelEntry = {
  id: 'apparatus-beaker',
  label: 'Beaker',
  category: 'apparatus',
  summary: 'A glass beaker with a printed capacity and an optional water fill.',
  build: (options) => buildBeaker(options),
};
