/**
 * Atomic models.
 *
 * Three historical pictures of the atom, built so their *differences* are
 * visible at a glance:
 *
 *  - Thomson's plum pudding: a diffuse positive sphere with electrons stuck
 *    in it;
 *  - Rutherford's nucleus: a tiny dense centre with electrons far away, and
 *    therefore almost entirely empty space;
 *  - Bohr's shells: electrons confined to discrete orbits;
 *  - the modern electron cloud: no orbits at all, just probability density.
 *
 * All four are built from the same few primitives, and all are animated by a
 * `userData.update(dt)` hook so a host can simply call it once a frame.
 */

import * as THREE from 'three';
import { makeLabelTexture, meshOf } from '../../geometry';
import { Materials } from '../../materials';
import { applyDisplayOptions, seeded, type ModelDisplayOptions, type ModelEntry } from './types';

export interface AtomOptions extends ModelDisplayOptions {
  /** Overall radius of the model in metres. */
  radiusM?: number;
  /** Colour of the electron shells / cloud. */
  accent?: string;
  /** Draw K, L, M labels on the Bohr shells. */
  labels?: boolean;
}

/** A small glowing electron. */
function electronMesh(geometry: THREE.BufferGeometry, colour: string): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color: colour,
    emissive: new THREE.Color(colour),
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.1,
  });
  return meshOf(geometry, material, 'Electron');
}

/** A cluster of protons and neutrons, roughly spherical. */
function buildNucleus(radiusM: number, protons: number, neutrons: number): THREE.Group {
  const nucleus = new THREE.Group();
  nucleus.name = 'Nucleus';
  const total = protons + neutrons;
  const particleRadius = radiusM * Math.min(0.42, 1.35 / Math.cbrt(Math.max(1, total)));
  const geometry = new THREE.SphereGeometry(particleRadius, 12, 10);
  const protonMaterial = Materials.paint('#d9534f', 0.42);
  const neutronMaterial = Materials.paint('#8a94a6', 0.46);
  const random = seeded(7);

  for (let index = 0; index < total; index += 1) {
    const particle = meshOf(
      geometry,
      index < protons ? protonMaterial : neutronMaterial,
      index < protons ? 'Proton' : 'Neutron',
    );
    // Rejection-free spherical placement: a random direction at a radius that
    // fills the nucleus evenly.
    const u = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const r = radiusM * Math.cbrt(random()) * 0.62;
    const planar = Math.sqrt(Math.max(0, 1 - u * u));
    particle.position.set(r * planar * Math.cos(theta), r * u, r * planar * Math.sin(theta));
    nucleus.add(particle);
  }
  return nucleus;
}

/** A thin orbit ring in the XZ plane. */
function orbitRing(radiusM: number, colour: string, opacity = 0.55): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radiusM, 0.0011, 6, 96),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.name = 'Orbit';
  return ring;
}

/** A camera-facing text label. */
function labelSprite(text: string, sizeM: number, colour = '#dfe9f5'): THREE.Sprite {
  const texture = makeLabelTexture({ text, foreground: colour, fontScale: 0.5 });
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.name = `Label${text}`;
  sprite.scale.set(sizeM, sizeM, 1);
  return sprite;
}

// ---------------------------------------------------------------------------
// Thomson
// ---------------------------------------------------------------------------

export function buildThomsonAtom(options: AtomOptions = {}): THREE.Group {
  const { radiusM = 0.11, accent = '#5aa9e6' } = options;
  const group = new THREE.Group();
  group.name = 'ThomsonAtom';

  const pudding = new THREE.Mesh(
    new THREE.SphereGeometry(radiusM, 32, 24),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(accent),
      transparent: true,
      opacity: 0.18,
      roughness: 0.15,
      metalness: 0,
      transmission: 0.6,
      thickness: radiusM,
      side: THREE.DoubleSide,
    }),
  );
  pudding.name = 'PositiveSphere';
  group.add(pudding);

  const electronGeometry = new THREE.SphereGeometry(radiusM * 0.055, 10, 8);
  const random = seeded(21);
  for (let index = 0; index < 9; index += 1) {
    const u = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const planar = Math.sqrt(Math.max(0, 1 - u * u));
    const r = radiusM * 0.72 * Math.cbrt(random());
    const electron = electronMesh(electronGeometry, '#7fd3ff');
    electron.position.set(r * planar * Math.cos(theta), r * u, r * planar * Math.sin(theta));
    group.add(electron);
  }

  group.userData.model = { id: 'atom-thomson', label: 'Thomson (plum pudding) atom' };
  group.userData.facts = ['Electrons are embedded in a diffuse positive sphere.', 'No nucleus: charge is spread throughout.'];
  return applyDisplayOptions(group, options) as THREE.Group;
}

// ---------------------------------------------------------------------------
// Rutherford
// ---------------------------------------------------------------------------

export function buildRutherfordAtom(options: AtomOptions = {}): THREE.Group {
  const { radiusM = 0.12 } = options;
  const group = new THREE.Group();
  group.name = 'RutherfordAtom';

  group.add(buildNucleus(radiusM * 0.075, 6, 6));

  // A very faint sphere only hints at the atom's outer extent.
  const extent = new THREE.Mesh(
    new THREE.SphereGeometry(radiusM, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0x6f8ab0,
      transparent: true,
      opacity: 0.06,
      wireframe: true,
    }),
  );
  extent.name = 'Extent';
  group.add(extent);

  const electronGeometry = new THREE.SphereGeometry(radiusM * 0.022, 10, 8);
  const random = seeded(43);
  for (let index = 0; index < 6; index += 1) {
    const u = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const planar = Math.sqrt(Math.max(0, 1 - u * u));
    const r = radiusM * (0.45 + 0.45 * random());
    const electron = electronMesh(electronGeometry, '#8fd8ff');
    electron.position.set(r * planar * Math.cos(theta), r * u, r * planar * Math.sin(theta));
    group.add(electron);
  }

  const nucleusLabel = labelSprite('nucleus', radiusM * 0.3);
  nucleusLabel.position.set(0, -radiusM * 0.42, 0);
  group.add(nucleusLabel);

  group.userData.model = { id: 'atom-rutherford', label: 'Rutherford atom' };
  group.userData.facts = [
    'Almost all the mass is in a tiny, positively charged nucleus.',
    'Most alpha particles pass straight through — the atom is mostly empty space.',
  ];
  return applyDisplayOptions(group, options) as THREE.Group;
}

// ---------------------------------------------------------------------------
// Bohr
// ---------------------------------------------------------------------------

export function buildBohrAtom(options: AtomOptions = {}): THREE.Group {
  const { radiusM = 0.13, accent = '#5aa9e6' } = options;
  const group = new THREE.Group();
  group.name = 'BohrAtom';

  group.add(buildNucleus(radiusM * 0.065, 8, 8));

  const shellCounts = [2, 8, 8];
  const shellNames = ['K', 'L', 'M'];
  const shells: THREE.Group[] = [];

  shellCounts.forEach((count, shellIndex) => {
    const orbitRadius = radiusM * (0.36 + 0.24 * shellIndex);
    const shell = new THREE.Group();
    shell.name = `Shell${shellNames[shellIndex]}`;
    // Tilt each shell a little so the orbits read as 3D.
    shell.rotation.z = (shellIndex - 1) * 0.36;
    shell.rotation.x = (shellIndex % 2 === 0 ? 1 : -1) * 0.18 * shellIndex;

    shell.add(orbitRing(orbitRadius, accent, 0.5));

    const electronGeometry = new THREE.SphereGeometry(radiusM * 0.024, 10, 8);
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const electron = electronMesh(electronGeometry, '#8fd8ff');
      electron.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius);
      shell.add(electron);
    }

    if (options.labels !== false) {
      const tag = labelSprite(shellNames[shellIndex], radiusM * 0.16, '#cfe3f7');
      tag.position.set(orbitRadius, radiusM * 0.05, 0);
      shell.add(tag);
    }

    shells.push(shell);
    group.add(shell);
  });

  group.userData.update = (dt: number): void => {
    shells.forEach((shell, index) => {
      shell.rotation.y += dt * (0.28 + index * 0.12);
    });
  };

  group.userData.model = { id: 'atom-bohr', label: 'Bohr atom' };
  group.userData.facts = [
    'Electrons occupy discrete shells: 2, 8, 8 for this atom.',
    'An electron emits or absorbs a photon only when it changes shell.',
  ];
  return applyDisplayOptions(group, options) as THREE.Group;
}

// ---------------------------------------------------------------------------
// Electron cloud
// ---------------------------------------------------------------------------

export function buildElectronCloud(options: AtomOptions = {}): THREE.Group {
  const { radiusM = 0.12, accent = '#66d0c0' } = options;
  const group = new THREE.Group();
  group.name = 'ElectronCloud';

  group.add(buildNucleus(radiusM * 0.06, 6, 6));

  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(radiusM, 32, 24),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(accent),
      transparent: true,
      opacity: 0.07,
      side: THREE.BackSide,
    }),
  );
  group.add(haze);

  // A point cloud whose density falls off from the centre.
  const count = 420;
  const positions = new Float32Array(count * 3);
  const random = seeded(97);
  for (let index = 0; index < count; index += 1) {
    const u = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const planar = Math.sqrt(Math.max(0, 1 - u * u));
    // r ~ cbrt(u) gives uniform density; squaring biases points inward the way
    // a real s-orbital probability density does.
    const r = radiusM * Math.cbrt(random()) * 0.92;
    positions[index * 3] = r * planar * Math.cos(theta);
    positions[index * 3 + 1] = r * u;
    positions[index * 3 + 2] = r * planar * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: new THREE.Color(accent),
      size: radiusM * 0.045,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    }),
  );
  points.name = 'ProbabilityCloud';
  group.add(points);

  group.userData.update = (dt: number): void => {
    points.rotation.y += dt * 0.16;
    points.rotation.x += dt * 0.04;
  };

  group.userData.model = { id: 'atom-cloud', label: 'Electron cloud' };
  group.userData.facts = [
    'Electrons do not follow definite orbits; only their probability distribution is known.',
    'The denser the cloud, the more likely the electron is there.',
  ];
  return applyDisplayOptions(group, options) as THREE.Group;
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export const ATOMIC_MODELS: readonly ModelEntry[] = [
  {
    id: 'atom-thomson',
    label: 'Thomson atom',
    category: 'atomic',
    summary: 'The “plum pudding” model: electrons embedded in a diffuse positive sphere.',
    facts: ['Proposed by J. J. Thomson in 1904, after the discovery of the electron.'],
    build: (options) => buildThomsonAtom(options),
  },
  {
    id: 'atom-rutherford',
    label: 'Rutherford atom',
    category: 'atomic',
    summary: 'A tiny dense nucleus with electrons far away — mostly empty space.',
    facts: ['The 1909–11 alpha-particle scattering experiment led Rutherford here.'],
    build: (options) => buildRutherfordAtom(options),
  },
  {
    id: 'atom-bohr',
    label: 'Bohr atom',
    category: 'atomic',
    summary: 'Electrons confined to discrete shells, each with a fixed energy.',
    facts: ['Explains the sharp lines in hydrogen’s emission spectrum.'],
    build: (options) => buildBohrAtom(options),
  },
  {
    id: 'atom-cloud',
    label: 'Electron cloud',
    category: 'atomic',
    summary: 'The quantum picture: a probability cloud instead of definite orbits.',
    facts: ['An orbital is a probability distribution, not a path.'],
    build: (options) => buildElectronCloud(options),
  },
];
