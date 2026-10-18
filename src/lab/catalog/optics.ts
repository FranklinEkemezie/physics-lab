/**
 * Optics equipment definitions.
 */

import type { EquipmentDefinition } from '../types';

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
} from '../../engine/models/optics';
import { withUpdate } from './helpers';

export const OPTICS_EQUIPMENT: EquipmentDefinition[] = [
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
