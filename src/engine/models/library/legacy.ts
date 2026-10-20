/**
 * The apparatus that already existed before the library.
 *
 * Rather than duplicate geometry, the library simply *presents* the existing
 * builders under a common `ModelEntry` contract. That is the point of the
 * registry: a host asks for `apparatus-ammeter` and gets a configured meter,
 * without caring that it came from a class rather than a function.
 */

import type * as THREE from 'three';
import { MeterModel } from '../electricity/meter';
import { MultimeterModel } from '../electricity/multimeter';
import { buildBarMagnet } from '../magnetism/barMagnet';
import { buildHorseshoeMagnet } from '../magnetism/horseshoeMagnet';
import { buildGlassBlock } from '../optics/glassBlock';
import { ConvexLensModel } from '../optics/lens';
import { buildPrism } from '../optics/prism';
import { buildProtractor } from '../optics/protractor';
import { buildMetreRule } from '../rule';
import { SpringModel } from '../masses/spring';
import { buildStopwatch } from '../stopwatch';
import { applyDisplayOptions, type ModelDisplayOptions, type ModelEntry } from './types';

function wrap<T extends THREE.Object3D>(
  build: () => T,
): (options?: ModelDisplayOptions) => THREE.Object3D {
  return (options: ModelDisplayOptions = {}) => applyDisplayOptions(build(), options);
}

function ammeter(): THREE.Object3D {
  const meter = new MeterModel({ label: 'AMMETER', unit: 'A', fullScale: 5, redline: 4.5 }, 0.05);
  meter.setReading(2.7);
  return meter.group;
}

function voltmeter(): THREE.Object3D {
  const meter = new MeterModel({ label: 'VOLTMETER', unit: 'V', fullScale: 5, redline: 4.5 }, 1000);
  meter.setReading(3.4);
  return meter.group;
}

export const LEGACY_MODELS: readonly ModelEntry[] = [
  {
    id: 'apparatus-metre-rule',
    label: 'Metre rule',
    category: 'apparatus',
    summary: 'A one-metre rule with millimetre graduations and a manila-yellow face.',
    facts: ['Read at eye level: viewing at an angle introduces parallax error.'],
    build: wrap(() => buildMetreRule({ lengthM: 1 })),
  },
  {
    id: 'apparatus-ammeter',
    label: 'Ammeter',
    category: 'apparatus',
    summary: 'A moving-coil ammeter with a dark bakelite case and a cream dial.',
    facts: ['Connected in series; a real ammeter has a small but non-zero resistance.'],
    build: wrap(ammeter),
  },
  {
    id: 'apparatus-voltmeter',
    label: 'Voltmeter',
    category: 'apparatus',
    summary: 'A moving-coil voltmeter, the companion to the ammeter.',
    facts: ['Connected in parallel; a real voltmeter draws a little current.'],
    build: wrap(voltmeter),
  },
  {
    id: 'apparatus-multimeter',
    label: 'Digital multimeter',
    category: 'apparatus',
    summary: 'A handheld digital meter with an LCD face and a selector dial.',
    facts: ['Autoranging meters pick the range for you; older ones do not.'],
    build: wrap(() => new MultimeterModel().group),
  },
  {
    id: 'apparatus-bar-magnet',    label: 'Bar magnet',
    category: 'apparatus',
    summary: 'A painted bar magnet with north and south poles.',
    facts: ['Like poles repel; unlike poles attract.', 'The field is strongest at the poles.'],
    build: wrap(() => buildBarMagnet(0.1)),
  },
  {
    id: 'apparatus-horseshoe-magnet',
    label: 'Horseshoe magnet',
    category: 'apparatus',
    summary: 'A U-shaped permanent magnet with a narrow gap.',
    facts: ['The narrow gap concentrates the field, which is why it lifts more.'],
    build: wrap(() => buildHorseshoeMagnet()),
  },
  {
    id: 'apparatus-glass-block',
    label: 'Glass block',
    category: 'apparatus',
    summary: 'A rectangular Perspex block for refraction experiments.',
    facts: ['Light bends towards the normal on entering a denser medium.'],
    build: wrap(() => buildGlassBlock({})),
  },
  {
    id: 'apparatus-convex-lens',
    label: 'Convex lens',
    category: 'apparatus',
    summary: 'A biconvex lens on a small foot.',
    facts: ['A converging lens forms a real image when the object is beyond F.'],
    build: wrap(() => new ConvexLensModel(0.15, 0.028).group),
  },
  {
    id: 'apparatus-prism',
    label: 'Prism',
    category: 'apparatus',
    summary: 'A triangular glass prism for dispersion and deviation.',
    facts: ['White light splits because each wavelength has a different refractive index.'],
    build: wrap(() => buildPrism()),
  },
  {
    id: 'apparatus-protractor',
    label: 'Protractor',
    category: 'apparatus',
    summary: 'A half-disc protractor graduated in degrees.',
    build: wrap(() => buildProtractor()),
  },
  {
    id: 'apparatus-stopwatch',
    label: 'Stopwatch',
    category: 'apparatus',
    summary: 'A digital stopwatch with hundredths of a second.',
    facts: ['Reaction time is typically 0.2 s — far larger than the display resolution.'],
    build: wrap(() => buildStopwatch().group),
  },
  {
    id: 'apparatus-spring',
    label: 'Extension spring',
    category: 'apparatus',
    summary: 'A helical spring with hooks at both ends.',
    facts: ['Hooke’s law: F = kx, up to the elastic limit.'],
    build: wrap(() => new SpringModel({ naturalLengthM: 0.12 }).group),
  },
];
