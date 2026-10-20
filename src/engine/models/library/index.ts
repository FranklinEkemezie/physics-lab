/**
 * The reusable 3D model library.
 *
 * Five shelves — people, atomic models, states of matter, circuit symbols and
 * apparatus — built from procedural geometry with the same Three.js-only
 * contract. Import a builder directly for an app that needs one model, or use
 * the registry for a browser/gallery.
 *
 * ```ts
 * import { buildBohrAtom } from '@/engine/models/library';
 * const atom = buildBohrAtom({ radiusM: 0.2, accent: '#7fd3ff' });
 * scene.add(atom);
 * ```
 */

export * from './types';
export * from './people';
export * from './atomic';
export * from './matter';
export * from './circuit';
export * from './apparatus';
export * from './legacy';
export * from './catalogue';
