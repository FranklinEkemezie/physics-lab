/**
 * States of matter.
 *
 * The three states differ in one thing a student can *see*: how much freedom
 * the particles have. In a solid they vibrate about fixed sites; in a liquid
 * they are still close together but can slide past one another; in a gas they
 * fly about, filling the whole container.
 *
 * The motion is animated through `userData.update(dt)`, so the models work in
 * the lab, in the gallery and in any other Three.js host.
 */

import * as THREE from 'three';
import { meshOf } from '../../geometry';
import { applyDisplayOptions, seeded, type ModelDisplayOptions, type ModelEntry } from './types';

export type MatterState = 'solid' | 'liquid' | 'gas';

export interface MatterOptions extends ModelDisplayOptions {
  /** Side length of the container in metres. */
  boxM?: number;
  /** Particle radius in metres. */
  particleRadiusM?: number;
  /** Particle colour. */
  accent?: string;
}

interface Particle {
  mesh: THREE.Mesh;
  /** Rest position (solids and liquids) in metres. */
  site: THREE.Vector3;
  velocity: THREE.Vector3;
  phase: number;
}

/** A glass box with crisp edges, open at the top for the gas? No — sealed. */
function buildContainer(sizeM: number): THREE.Group {
  const container = new THREE.Group();
  container.name = 'Container';

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(sizeM, sizeM, sizeM),
    new THREE.MeshPhysicalMaterial({
      color: 0xbfd8ea,
      transparent: true,
      opacity: 0.06,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  glass.position.y = sizeM / 2;
  container.add(glass);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(sizeM, sizeM, sizeM)),
    new THREE.LineBasicMaterial({ color: 0x7d93a8, transparent: true, opacity: 0.6 }),
  );
  edges.position.y = sizeM / 2;
  container.add(edges);
  return container;
}

/** Build one of the three states. */
export function buildMatterState(state: MatterState, options: MatterOptions = {}): THREE.Group {
  const { boxM = 0.2, particleRadiusM = 0.012, accent = '#5aa9e6' } = options;
  const group = new THREE.Group();
  group.name = `Matter${state[0].toUpperCase()}${state.slice(1)}`;

  group.add(buildContainer(boxM));

  const sides = 3;
  const spacing = boxM / (sides + 1);
  const startY = state === 'solid' ? boxM * 0.5 : state === 'liquid' ? boxM * 0.28 : boxM * 0.5;
  const spread = state === 'gas' ? boxM * 0.4 : spacing;

  const geometry = new THREE.SphereGeometry(particleRadiusM, 14, 10);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accent),
    roughness: 0.38,
    metalness: 0.05,
    emissive: new THREE.Color(accent),
    emissiveIntensity: state === 'gas' ? 0.18 : 0.06,
  });

  const particles: Particle[] = [];
  const random = seeded(state === 'solid' ? 3 : state === 'liquid' ? 11 : 29);

  if (state === 'gas') {
    const count = 22;
    for (let index = 0; index < count; index += 1) {
      const mesh = meshOf(geometry, material, 'Particle');
      const position = new THREE.Vector3(
        (random() - 0.5) * (boxM - 2 * particleRadiusM),
        particleRadiusM + random() * (boxM - 2 * particleRadiusM),
        (random() - 0.5) * (boxM - 2 * particleRadiusM),
      );
      mesh.position.copy(position);
      group.add(mesh);
      const speed = 0.18 + random() * 0.28;
      const direction = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1);
      if (direction.lengthSq() < 1e-6) direction.set(1, 0, 0);
      direction.normalize().multiplyScalar(speed);
      particles.push({ mesh, site: position.clone(), velocity: direction, phase: random() * Math.PI * 2 });
    }
  } else {
    for (let ix = 0; ix < sides; ix += 1) {
      for (let iy = 0; iy < sides; iy += 1) {
        for (let iz = 0; iz < sides; iz += 1) {
          const mesh = meshOf(geometry, material, 'Particle');
          const site = new THREE.Vector3(
            (ix - (sides - 1) / 2) * spread,
            startY + (iy - (sides - 1) / 2) * spread * (state === 'liquid' ? 0.55 : 1),
            (iz - (sides - 1) / 2) * spread,
          );
          // Liquids sit low in the container, so lift them off the floor.
          site.y = Math.max(particleRadiusM * 1.2, site.y);
          mesh.position.copy(site);
          group.add(mesh);
          particles.push({
            mesh,
            site,
            velocity: new THREE.Vector3(),
            phase: random() * Math.PI * 2,
          });
        }
      }
    }
  }

  let elapsed = 0;
  group.userData.update = (dt: number): void => {
    elapsed += dt;

    if (state === 'gas') {
      const limit = boxM / 2 - particleRadiusM;
      for (const particle of particles) {
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        // Reflect off each wall, like an elastic collision.
        if (particle.mesh.position.x > limit || particle.mesh.position.x < -limit) {
          particle.velocity.x *= -1;
          particle.mesh.position.x = THREE.MathUtils.clamp(particle.mesh.position.x, -limit, limit);
        }
        if (particle.mesh.position.z > limit || particle.mesh.position.z < -limit) {
          particle.velocity.z *= -1;
          particle.mesh.position.z = THREE.MathUtils.clamp(particle.mesh.position.z, -limit, limit);
        }
        if (
          particle.mesh.position.y > boxM - particleRadiusM ||
          particle.mesh.position.y < particleRadiusM
        ) {
          particle.velocity.y *= -1;
          particle.mesh.position.y = THREE.MathUtils.clamp(
            particle.mesh.position.y,
            particleRadiusM,
            boxM - particleRadiusM,
          );
        }
      }
      return;
    }

    // Solids and liquids: vibrate around a site. A liquid's particles wander
    // further and slide past each other, which is exactly the distinction.
    const amplitude = state === 'solid' ? 0.0018 : 0.009;
    const speed = state === 'solid' ? 9 : 3.4;
    for (const particle of particles) {
      const wobble = Math.sin(elapsed * speed + particle.phase);
      const wobble2 = Math.cos(elapsed * speed * 0.77 + particle.phase * 1.7);
      const wobble3 = Math.sin(elapsed * speed * 0.61 + particle.phase * 0.6);
      particle.mesh.position.set(
        particle.site.x + wobble * amplitude,
        particle.site.y + wobble2 * amplitude * (state === 'liquid' ? 0.6 : 1),
        particle.site.z + wobble3 * amplitude,
      );
    }
  };

  group.userData.model = { id: `matter-${state}`, label: `${state} particles` };
  group.userData.facts = FACTS[state];

  return applyDisplayOptions(group, options) as THREE.Group;
}

const FACTS: Record<MatterState, readonly string[]> = {
  solid: [
    'Particles vibrate about fixed positions and stay in a regular lattice.',
    'The shape and volume are both fixed.',
  ],
  liquid: [
    'Particles are still close together but can slide past one another.',
    'Volume is fixed; shape takes the container’s.',
  ],
  gas: [
    'Particles are far apart and move at high speed in straight lines until they hit a wall.',
    'Both shape and volume are those of the container.',
  ],
};

export const MATTER_MODELS: readonly ModelEntry[] = [
  {
    id: 'matter-solid',
    label: 'Solid',
    category: 'matter',
    summary: 'A regular lattice: particles vibrate but never change places.',
    facts: FACTS.solid,
    build: (options: ModelDisplayOptions = {}) => buildMatterState('solid', options),
  },
  {
    id: 'matter-liquid',
    label: 'Liquid',
    category: 'matter',
    summary: 'Particles are still touching, but free to slide past one another.',
    facts: FACTS.liquid,
    build: (options: ModelDisplayOptions = {}) => buildMatterState('liquid', options),
  },
  {
    id: 'matter-gas',
    label: 'Gas',
    category: 'matter',
    summary: 'Particles fly about at speed, filling the whole container.',
    facts: FACTS.gas,
    build: (options: ModelDisplayOptions = {}) => buildMatterState('gas', options),
  },
];
