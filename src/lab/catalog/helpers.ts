/**
 * Shared helpers for the equipment catalogue.
 */

import type * as THREE from 'three';

/**
 * Attach a per-frame update hook to a model's root object. {@link Lab} calls
 * it automatically, so animated apparatus (needles, blades, compasses) keeps
 * working without the catalogue needing to expose classes.
 */
export function withUpdate<T extends THREE.Object3D>(object: T, update: (dt: number) => void): T {
  object.userData.update = update;
  return object;
}
