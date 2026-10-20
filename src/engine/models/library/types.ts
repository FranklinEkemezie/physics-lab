/**
 * The model library's contract.
 *
 * These models are pure Three.js: they know nothing about the lab, the
 * catalogue, the DOM shell or any experiment. That is deliberate — the same
 * `buildPerson()` or `buildBohrAtom()` can be dropped into a chemistry app, a
 * museum kiosk or a static article about atomic theory.
 *
 * Every entry is parameterised by {@link ModelDisplayOptions}, so a host can
 * rescale a model or recolour its signature part without editing the builder.
 */

import type * as THREE from 'three';

/** The shelves of the library. */
export type ModelCategoryId = 'people' | 'atomic' | 'matter' | 'circuit' | 'apparatus';

export interface ModelCategory {
  id: ModelCategoryId;
  label: string;
  /** One line describing what lives on this shelf. */
  blurb: string;
  glyph: string;
}

/** Display options every model understands. */
export interface ModelDisplayOptions {
  /** Uniform scale; 1 builds the model at its real-world size in metres. */
  scale?: number;
  /** Accent colour for the model's signature part (shells, a resistor, a coat). */
  accent?: string;
  /** Show text labels where the model has them. */
  labels?: boolean;
}

/** A single model in the library. */
export interface ModelEntry {
  /** Stable kebab-case id. */
  id: string;
  label: string;
  category: ModelCategoryId;
  /** One-line description for the gallery. */
  summary: string;
  /** Teaching facts shown beside the model. */
  facts?: readonly string[];
  /** Plain physical metadata other programs can read (mass, height, …). */
  data?: Readonly<Record<string, number | string>>;
  /** Build a fresh instance. Never share the returned object between hosts. */
  build(options?: ModelDisplayOptions): THREE.Object3D;
}

/** Apply the common display options and the label visibility flag. */
export function applyDisplayOptions(object: THREE.Object3D, options: ModelDisplayOptions = {}): THREE.Object3D {
  const { scale = 1 } = options;
  if (scale !== 1) object.scale.multiplyScalar(scale);
  object.userData.modelDisplay = { labels: options.labels ?? true, accent: options.accent ?? null };
  object.traverse((child) => {
    if (child.name.startsWith('Label') && options.labels === false) child.visible = false;
  });
  return object;
}

/** A tiny deterministic random source, so a model looks the same every build. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
