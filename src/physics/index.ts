/**
 * The physics domains of the lab.
 *
 * Every module under `physics/` is pure: no Three.js, no DOM, no UI. That is
 * what lets the same equations drive the 3-D bench, the self-checks in
 * `scripts/`, and any standalone demo or article that imports them directly.
 */
export * from './constants';
export * from './thermal';
export * from './mechanics';
export * from './electromagnetism';
export * from './optics';
export * from './measurement';
