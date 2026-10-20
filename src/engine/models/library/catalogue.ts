/**
 * The model-library registry.
 *
 * One flat list of everything, plus category metadata and a couple of lookups.
 * A host can render a picker from {@link MODEL_CATEGORIES}, then call
 * {@link buildModel} with an id — it never needs to know which module the
 * builder lives in.
 */

import type * as THREE from 'three';
import { ATOMIC_MODELS } from './atomic';
import { CIRCUIT_MODELS } from './circuit';
import { LEGACY_MODELS } from './legacy';
import { MATTER_MODELS } from './matter';
import { PEOPLE_MODELS } from './people';
import { APPARATUS_MODELS } from './apparatus';
import type { ModelCategory, ModelCategoryId, ModelDisplayOptions, ModelEntry } from './types';

export const MODEL_CATEGORIES: readonly ModelCategory[] = [
  {
    id: 'people',
    label: 'People',
    blurb: 'Human figures with realistic heights and masses.',
    glyph: '🧍',
  },
  {
    id: 'atomic',
    label: 'Atomic models',
    blurb: 'Thomson, Rutherford, Bohr and the electron cloud.',
    glyph: '⚛️',
  },
  {
    id: 'matter',
    label: 'States of matter',
    blurb: 'Solid, liquid and gas, with particles that actually move.',
    glyph: '🧊',
  },
  {
    id: 'circuit',
    label: 'Circuit symbols',
    blurb: 'Resistors, inductors, switches and meters as 3D symbols.',
    glyph: '🔌',
  },
  {
    id: 'apparatus',
    label: 'Apparatus',
    blurb: 'Knife edges, pulleys, calorimeters and the rest of the bench.',
    glyph: '🧪',
  },
];

/** Every model, in shelf order. */
export const MODEL_LIBRARY: readonly ModelEntry[] = [
  ...PEOPLE_MODELS,
  ...ATOMIC_MODELS,
  ...MATTER_MODELS,
  ...CIRCUIT_MODELS,
  ...APPARATUS_MODELS,
  ...LEGACY_MODELS,
];

const byId = new Map<string, ModelEntry>(MODEL_LIBRARY.map((entry) => [entry.id, entry]));

/** Look up a single model entry. */
export function findModel(id: string): ModelEntry | undefined {
  return byId.get(id);
}

/** All models on one shelf. */
export function modelsInCategory(category: ModelCategoryId): readonly ModelEntry[] {
  return MODEL_LIBRARY.filter((entry) => entry.category === category);
}

/** Build a model by id, or `null` if the id is unknown. */
export function buildModel(id: string, options?: ModelDisplayOptions): THREE.Object3D | null {
  const entry = byId.get(id);
  return entry ? entry.build(options) : null;
}
