/**
 * Magnetism equipment definitions.
 */

import type { EquipmentDefinition } from '../types';

import { PlottingCompassModel, SolenoidModel, buildBarMagnet, buildHorseshoeMagnet, buildIronFilingsCard, buildKeeper } from '../../engine/models/magnetism';
import { withUpdate } from './helpers';

export const MAGNETISM_EQUIPMENT: EquipmentDefinition[] = [
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
      const group = withUpdate(model.group, (dt) => model.update(dt));
      // Expose the model so an experiment can aim the needle at the local field.
      group.userData.compassModel = model;
      return group;
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
