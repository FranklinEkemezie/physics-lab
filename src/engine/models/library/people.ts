/**
 * People.
 *
 * A set of stylised but correctly-proportioned human figures. They exist
 * because "the weight of a person" is a real physics question, and because a
 * lab scene with nobody in it looks like a cupboard. Each figure carries its
 * mass and height in `userData.physical`, so a host can compute weight
 * (`W = mg`) without knowing anything about the builder.
 *
 * Everything is procedural, low-poly and in metres, with the origin between
 * the feet so a figure can simply be placed on a floor or a bench.
 */

import * as THREE from 'three';
import { meshOf } from '../../geometry';
import { Materials } from '../../materials';
import { applyDisplayOptions, type ModelDisplayOptions, type ModelEntry } from './types';

export interface PersonOptions extends ModelDisplayOptions {
  /** Total height in metres (the rest of the body scales from this). */
  heightM?: number;
  /** Shoulder/limb thickness. */
  build?: 'slim' | 'average' | 'broad';
  skin?: string;
  /** Shirt / blouse colour. */
  top?: string;
  trousers?: string;
  hair?: string;
  pose?: 'standing' | 'walking';
  /** Add a walking cane (used by the elder figure). */
  cane?: boolean;
  /** Mass recorded on the model, in kilograms. */
  massKg?: number;
}

export interface PersonPhysical {
  heightM: number;
  massKg: number;
}

const BUILD_FACTOR = { slim: 0.88, average: 1, broad: 1.14 } as const;

/**
 * Build one person.
 *
 * Limbs are groups pivoted at the hip or shoulder, so walking poses are a
 * rotation of the group rather than a rebuild of the geometry.
 */
export function buildPerson(options: PersonOptions = {}): THREE.Group {
  const {
    heightM = 1.75,
    build = 'average',
    skin = '#c98d63',
    top = '#3f6fa8',
    trousers = '#2f3540',
    hair = '#2a1d16',
    pose = 'standing',
    cane = false,
    massKg = 70,
    accent,
  } = options;

  const h = heightM;
  const width = BUILD_FACTOR[build];
  const group = new THREE.Group();
  group.name = 'Person';

  const skinMaterial = Materials.paint(skin, 0.72);
  const topMaterial = Materials.paint(accent ?? top, 0.82);
  const trouserMaterial = Materials.paint(trousers, 0.86);
  const hairMaterial = Materials.paint(hair, 0.9);
  const shoeMaterial = Materials.paint('#1b1b1d', 0.7);

  // ---- Torso -------------------------------------------------------------
  const torsoRadius = 0.071 * h * width;
  const torso = meshOf(
    new THREE.CapsuleGeometry(torsoRadius, 0.2 * h, 8, 18),
    topMaterial,
    'Torso',
  );
  torso.position.y = 0.665 * h;
  group.add(torso);

  // Hips, so the legs have something to join.
  const hips = meshOf(
    new THREE.CapsuleGeometry(0.055 * h * width, 0.05 * h, 6, 14),
    trouserMaterial,
    'Hips',
  );
  hips.position.y = 0.49 * h;
  hips.rotation.z = Math.PI / 2;
  group.add(hips);

  // ---- Head and neck -----------------------------------------------------
  const headY = 0.925 * h;
  const neck = meshOf(
    new THREE.CylinderGeometry(0.026 * h, 0.03 * h, 0.055 * h, 14),
    skinMaterial,
    'Neck',
  );
  neck.position.y = 0.855 * h;
  group.add(neck);

  const head = meshOf(new THREE.SphereGeometry(0.072 * h, 22, 16), skinMaterial, 'Head');
  head.position.y = headY;
  head.scale.set(0.92, 1.06, 0.98);
  group.add(head);

  const hairCap = meshOf(
    new THREE.SphereGeometry(0.0745 * h, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMaterial,
    'Hair',
  );
  hairCap.position.set(0, headY + 0.004 * h, -0.004 * h);
  hairCap.scale.set(0.94, 1.04, 1.02);
  group.add(hairCap);

  const eyeGeometry = new THREE.SphereGeometry(0.0075 * h, 10, 8);
  const eyeMaterial = Materials.paint('#17181a', 0.35);
  for (const side of [-1, 1]) {
    const eye = meshOf(eyeGeometry, eyeMaterial, 'Eye');
    eye.position.set(side * 0.026 * h, headY + 0.012 * h, 0.062 * h);
    group.add(eye);
  }

  // ---- Limbs -------------------------------------------------------------
  const legLength = 0.46 * h;
  const legRadius = 0.039 * h * width;
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = limb(
      new THREE.Vector3(side * 0.055 * h, 0.48 * h, 0),
      legLength,
      legRadius,
      trouserMaterial,
    );
    const shoe = meshOf(
      new THREE.BoxGeometry(0.072 * h, 0.03 * h, 0.16 * h),
      shoeMaterial,
      'Shoe',
    );
    shoe.position.set(0, -legLength + 0.015 * h, 0.028 * h);
    leg.add(shoe);
    legs.push(leg);
    group.add(leg);
  }

  const armLength = 0.39 * h;
  const armRadius = 0.026 * h * width;
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = limb(
      new THREE.Vector3(side * (torsoRadius + 0.018 * h), 0.815 * h, 0),
      armLength,
      armRadius,
      topMaterial,
    );
    // A bare hand at the end of the sleeve.
    const hand = meshOf(new THREE.SphereGeometry(0.028 * h, 12, 10), skinMaterial, 'Hand');
    hand.position.y = -armLength + 0.012 * h;
    arm.add(hand);
    // Arms hang a little away from the body rather than clipping the torso.
    arm.rotation.z = side * 0.07;
    arms.push(arm);
    group.add(arm);
  }

  if (pose === 'walking') {
    legs[0].rotation.x = 0.34;
    legs[1].rotation.x = -0.3;
    arms[0].rotation.x = -0.3;
    arms[1].rotation.x = 0.34;
  }

  if (cane) {
    const caneLength = 0.52 * h;
    const stick = meshOf(
      new THREE.CylinderGeometry(0.006 * h, 0.008 * h, caneLength, 10),
      Materials.darkWood(),
      'Cane',
    );
    stick.position.set(0.16 * h, caneLength / 2, 0.06 * h);
    group.add(stick);
    const handle = meshOf(
      new THREE.TorusGeometry(0.022 * h, 0.006 * h, 8, 16, Math.PI),
      Materials.darkWood(),
      'CaneHandle',
    );
    handle.position.set(0.16 * h, caneLength, 0.06 * h);
    handle.rotation.set(0, Math.PI / 2, 0);
    group.add(handle);
    // The near arm rests on the handle.
    arms[1].rotation.x = -0.16;
  }

  group.userData.physical = { heightM: h, massKg } satisfies PersonPhysical;
  group.userData.model = { id: 'person', label: 'Person' };

  return applyDisplayOptions(group, options) as THREE.Group;
}

/** A limb pivoted at its top end, so rotating the group swings it. */
function limb(
  origin: THREE.Vector3,
  lengthM: number,
  radiusM: number,
  material: THREE.Material,
): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.copy(origin);

  const bodyLength = Math.max(0.01, lengthM - radiusM * 2);
  const geometry = new THREE.CapsuleGeometry(radiusM, bodyLength, 6, 12);
  geometry.translate(0, -lengthM / 2, 0);
  pivot.add(meshOf(geometry, material));
  return pivot;
}

// ---------------------------------------------------------------------------
// Catalogue entries
// ---------------------------------------------------------------------------

interface PersonPreset {
  id: string;
  label: string;
  summary: string;
  options: PersonOptions;
  facts: readonly string[];
}

const PRESETS: readonly PersonPreset[] = [
  {
    id: 'person-adult-male',
    label: 'Adult man',
    summary: 'A 1.76 m adult, about 74 kg — close to the average adult male.',
    options: { heightM: 1.76, massKg: 74, build: 'average', skin: '#c98d63', top: '#3f6fa8' },
    facts: ['Weight W = mg = 74 × 9.81 ≈ 726 N.', 'Average adult male height is about 1.7–1.8 m.'],
  },
  {
    id: 'person-adult-female',
    label: 'Adult woman',
    summary: 'A 1.64 m adult, about 60 kg.',
    options: { heightM: 1.64, massKg: 60, build: 'slim', skin: '#b97a52', top: '#a34a5c', trousers: '#33383f' },
    facts: ['Weight W = mg = 60 × 9.81 ≈ 589 N.', 'Centre of mass sits around hip height.'],
  },
  {
    id: 'person-teenager',
    label: 'Teenager',
    summary: 'A 1.58 m adolescent, about 50 kg — still growing.',
    options: { heightM: 1.58, massKg: 50, build: 'slim', skin: '#8d5a3b', top: '#3f8f74', trousers: '#2a2f3a' },
    facts: ['Weight W = mg ≈ 490 N.', 'Bone density and muscle mass are still changing.'],
  },
  {
    id: 'person-child',
    label: 'Child',
    summary: 'A 1.24 m child, about 27 kg.',
    options: { heightM: 1.24, massKg: 27, build: 'slim', skin: '#d39a70', top: '#e0a63b', trousers: '#3c4a6b' },
    facts: ['Weight W = mg ≈ 265 N.', 'A child’s head is proportionally larger than an adult’s.'],
  },
  {
    id: 'person-elder',
    label: 'Older person',
    summary: 'A 1.70 m older adult with a cane, about 68 kg.',
    options: {
      heightM: 1.7,
      massKg: 68,
      build: 'average',
      skin: '#c08a63',
      top: '#6b6f78',
      trousers: '#4a4038',
      hair: '#c9c4bd',
      pose: 'walking',
      cane: true,
    },
    facts: ['Weight W = mg ≈ 667 N.', 'A walking cane widens the support base and improves balance.'],
  },
];

export const PEOPLE_MODELS: readonly ModelEntry[] = PRESETS.map((preset) => {
  const { heightM, massKg } = preset.options;
  return {
    id: preset.id,
    label: preset.label,
    category: 'people',
    summary: preset.summary,
    facts: preset.facts,
    data: { heightM: heightM ?? 1.75, massKg: massKg ?? 70 },
    build: (options: ModelDisplayOptions = {}) => buildPerson({ ...preset.options, ...options }),
  };
});
