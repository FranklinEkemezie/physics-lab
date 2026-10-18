/**
 * Shared, memoised PBR materials.
 *
 * Materials are expensive-ish objects (shader program + uniforms) and the lab
 * spawns many meshes, so every material is created once and reused. Callers
 * must **not** mutate the returned materials; ask for a new one instead
 * (e.g. `Materials.paint('#ff0000')`).
 */

import * as THREE from 'three';

/** Emissive-friendly name keys so we can memoise cheaply. */
const cache = new Map<string, THREE.Material>();

function memo<T extends THREE.Material>(key: string, factory: () => T): T {
  const existing = cache.get(key);
  if (existing) return existing as T;
  const created = factory();
  cache.set(key, created);
  return created;
}

/** Releases every cached material (used when tearing the app down). */
export function disposeMaterials(): void {
  for (const material of cache.values()) material.dispose();
  cache.clear();
}

export const Materials = {
  /** Warm polished brass — pendulum bobs, slotted masses, old terminals. */
  brass: () =>
    memo(
      'brass',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xb08d3a,
          metalness: 1,
          roughness: 0.28,
        }),
    ),

  /** Darker, duller brass for aged apparatus. */
  agedBrass: () =>
    memo(
      'agedBrass',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x8a6b2c,
          metalness: 0.95,
          roughness: 0.48,
        }),
    ),

  /** Bright chrome / nickel plating — rods, clips, stands. */
  chrome: () =>
    memo(
      'chrome',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xd8dde2,
          metalness: 1,
          roughness: 0.14,
        }),
    ),

  /** Painted cast-iron stand base. */
  castIron: () =>
    memo(
      'castIron',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x2b2f33,
          metalness: 0.6,
          roughness: 0.62,
        }),
    ),

  /** Blackened steel — clamps, bosses, screw threads. */
  blackSteel: () =>
    memo(
      'blackSteel',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x1d1f22,
          metalness: 0.85,
          roughness: 0.45,
        }),
    ),

  /** Soft-drawn copper — coil wire, magnet windings. */
  copper: () =>
    memo(
      'copper',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xb05a2a,
          metalness: 1,
          roughness: 0.33,
        }),
    ),

  /** Loudspeaker / transformer iron. */
  softIron: () =>
    memo(
      'softIron',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x555b60,
          metalness: 0.9,
          roughness: 0.5,
        }),
    ),

  /** Lacquered beech lab bench / rule body. */
  wood: () =>
    memo(
      'wood',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xb07b45,
          metalness: 0,
          roughness: 0.72,
        }),
    ),

  /** Dark hardboard. */
  darkWood: () =>
    memo(
      'darkWood',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x5c3a22,
          metalness: 0,
          roughness: 0.8,
        }),
    ),

  /** Cast aluminium — optical bench rails, boxes. */
  aluminium: () =>
    memo(
      'aluminium',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xa9b0b6,
          metalness: 0.9,
          roughness: 0.3,
        }),
    ),

  /** Instrument casing plastic (dark grey). */
  casing: () =>
    memo(
      'casing',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x23262b,
          metalness: 0.35,
          roughness: 0.55,
        }),
    ),

  /** Cream/ivory enamel housing of meters and resistance boxes. */
  enamel: () =>
    memo(
      'enamel',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xe8e3d6,
          metalness: 0.05,
          roughness: 0.6,
        }),
    ),

  /** Rubber feet, insulators, insulated wire sheath. */
  rubber: () =>
    memo(
      'rubber',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x141414,
          metalness: 0,
          roughness: 0.95,
        }),
    ),

  /** Glossy acrylic — glass blocks, lens bodies. */
  acrylic: () =>
    memo(
      'acrylic',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0,
          roughness: 0.05,
          transmission: 0.94,
          thickness: 0.6,
          ior: 1.5,
          transparent: true,
          opacity: 0.55,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
          side: THREE.DoubleSide,
        }),
    ),

  /** Real glass for lenses, mirrors and the tank. */
  glass: () =>
    memo(
      'glass',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0,
          roughness: 0.02,
          transmission: 0.98,
          thickness: 0.25,
          ior: 1.52,
          transparent: true,
          opacity: 0.4,
        }),
    ),

  /** Front-silvered mirror surface. */
  mirror: () =>
    memo(
      'mirror',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xf2f5f8,
          metalness: 1,
          roughness: 0.02,
        }),
    ),

  /** Frosted white screen for optical work. */
  screen: () =>
    memo(
      'screen',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xf6f6f2,
          metalness: 0,
          roughness: 0.9,
        }),
    ),

  /** Cotton/hemp thread — pendulum suspension. */
  string: () =>
    memo(
      'string',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xd9cfae,
          metalness: 0,
          roughness: 0.95,
        }),
    ),

  /** Generic painted plastic, memoised per colour. */
  paint: (color: THREE.ColorRepresentation, roughness = 0.5) =>
    memo(
      `paint:${String(color)}:${roughness}`,
      () =>
        new THREE.MeshStandardMaterial({
          color,
          metalness: 0.1,
          roughness,
        }),
    ),

  /** Red/black insulated wire, memoised per colour. */
  wire: (color: THREE.ColorRepresentation) =>
    memo(
      `wire:${String(color)}`,
      () =>
        new THREE.MeshStandardMaterial({
          color,
          metalness: 0.05,
          roughness: 0.85,
        }),
    ),
};

/** Convenience: a dark, faintly reflective floor surface for the lab room. */
export function labFloorMaterial(): THREE.Material {
  return memo(
    'labFloor',
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x6f7379,
        metalness: 0.08,
        roughness: 0.86,
      }),
  );
}
