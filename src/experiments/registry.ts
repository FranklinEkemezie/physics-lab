/**
 * The practical register.
 *
 * Every practical knows how to build itself; the app only needs this list to
 * populate the "choose a practical" menu. Entries marked `available: false`
 * are road-map items — the apparatus for them already exists in the
 * catalogue, so they are a good indication of where to add code next.
 */

import type { Experiment } from './types';
import type { GroupId } from '@/lab/types';
import { SimplePendulumExperiment } from './mechanics/SimplePendulum';
import { HookesLawExperiment } from './mechanics/hookes';
import { BarMagnetFieldExperiment } from './magnetism/BarMagnetField';

export interface ExperimentInfo {
  id: string;
  title: string;
  group: GroupId;
  /** One-line summary for the menu. */
  summary: string;
  /** Which catalogue items it uses (shown as a hint in the menu). */
  apparatus: string[];
  available: boolean;
  /** Optional reason shown when the practical is not yet implemented. */
  note?: string;
  create?: () => Experiment;
}

export const EXPERIMENTS: readonly ExperimentInfo[] = [
  {
    id: 'simple-pendulum',
    title: 'Simple pendulum — determine g',
    group: 'mechanics',
    summary: 'Time n oscillations for six lengths, plot T² against L, find g from the gradient.',
    apparatus: ['Retort stand', 'Boss head', 'Clamp', 'Split cork', 'Pendulum bob', 'Thread', 'Metre rule', 'Stopwatch'],
    available: true,
    create: () => new SimplePendulumExperiment(),
  },
  {
    id: 'hookes-law',
    title: "Hooke's law — extension of a spring",
    group: 'mechanics',
    summary: 'Add slotted masses, read the pointer against the rule, plot extension against load.',
    apparatus: ['Retort stand', 'Spring', 'Mass hanger', 'Slotted masses', 'Metre rule'],
    available: true,
    create: () => new HookesLawExperiment(),
  },
  {
    id: 'ohms-law',
    title: "Ohm's law — verify V = IR",
    group: 'electricity',
    summary: 'Vary the rheostat, read the ammeter and voltmeter, plot V against I.',
    apparatus: ['Dry cell', 'Rheostat', 'Ammeter', 'Voltmeter', 'Connecting leads'],
    available: false,
    note: 'The meters already animate; a circuit solver is the next piece to write.',
  },
  {
    id: 'refraction',
    title: 'Refraction through a glass block',
    group: 'optics',
    summary: 'Trace rays through the block and measure the angle of refraction for several angles.',
    apparatus: ['Ray box', 'Glass block', 'Protractor', 'Plain paper'],
    available: false,
    note: 'Needs a ray-tracing renderer for the beams.',
  },
  {
    id: 'magnetic-field',
    title: 'Plotting the field of a bar magnet',
    group: 'magnetism',
    summary:
      'Walk a plotting compass around a bar magnet to map the field lines, then measure the inverse-cube fall-off of the deflection and find the magnet\'s moment.',
    apparatus: ['Bar magnet', 'Plotting compass', 'Iron filings card', 'Plotting paper'],
    available: true,
    create: () => new BarMagnetFieldExperiment(),
  },
];

/** Practicals that are ready to run. */
export function availableExperiments(): ExperimentInfo[] {
  return EXPERIMENTS.filter((info) => info.available && info.create);
}

export function findExperiment(id: string): ExperimentInfo | undefined {
  return EXPERIMENTS.find((info) => info.id === id);
}
