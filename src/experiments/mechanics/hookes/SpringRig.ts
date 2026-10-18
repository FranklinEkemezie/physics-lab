/**
 * The bench layout for the Hooke's-law practical.
 *
 * Owns the geometry: the retort stand, the spring hanging from the clamp, the
 * hanger with its slotted masses, and the rule the pointer is read against.
 * The *physics* — how far the spring stretches under a load — lives in
 * `@/physics/mechanics/hookes`; this class only turns a length into world
 * positions.
 *
 * The spring is built here rather than taken from the catalogue so the
 * experiment can give it a **hidden** stiffness: the student has to measure the
 * spring constant, not read it off a shelf label.
 */

import * as THREE from 'three';
import type { Lab } from '@/lab/Lab';
import type { PlacedObject } from '@/lab/types';
import { BENCH_HEIGHT } from '@/engine/LabRoom';
import { SpringModel } from '@/engine/models/masses';
import type { Spring } from '@/physics/mechanics/hookes';

/** Design constants. Changing these moves the whole practical. */
export const SPRING_RIG = {
  /** Position of the retort stand base. */
  standX: -0.34,
  standZ: 0,
  /** Height of the clamp above the bench. */
  clampHeightM: 0.74,
  /** Horizontal offset from the rod to the clamp jaws. */
  bossToJawsX: 0.075,
  /** The rule stands this far to the +x side of the spring. */
  ruleOffsetX: 0.06,
  /** Vertical gap between stacked slotted masses. */
  massSpacingM: 0.0065,
  /** Exponential settle rate, in s⁻¹ (higher = snappier). */
  settleRate: 14,
} as const;

/** The slotted masses the equipment box holds, in grams. */
export const MASS_SET_G = [10, 20, 50, 100] as const;

/** Catalogue id for a slotted mass of the given size. */
export function massDefinitionId(grams: number): string {
  return `mass-${grams}g`;
}

export interface SpringRigParts {
  stand: PlacedObject;
  bossHead: PlacedObject;
  clamp: PlacedObject;
  hanger: PlacedObject;
  rule: PlacedObject;
  ruleFoot: PlacedObject;
}

export class SpringRig {
  /** The physical spring this rig draws. */
  readonly spec: Spring;
  readonly parts: SpringRigParts;

  readonly #lab: Lab;
  readonly #overlay = new THREE.Group();
  readonly #spring: SpringModel;
  readonly #spawned: PlacedObject[] = [];
  readonly #springX: number;
  readonly #springZ: number;
  readonly #topY: number;

  #masses: PlacedObject[] = [];
  #currentLengthM: number;
  #targetLengthM: number;

  constructor(lab: Lab, spec: Spring) {
    this.#lab = lab;
    this.spec = spec;
    this.#springX = SPRING_RIG.standX + SPRING_RIG.bossToJawsX;
    this.#springZ = SPRING_RIG.standZ;
    this.#topY = BENCH_HEIGHT + SPRING_RIG.clampHeightM;

    const spawn = (id: string, position: THREE.Vector3): PlacedObject => {
      const placed = lab.spawn(id, { position, manualPlacement: true });
      this.#spawned.push(placed);
      return placed;
    };

    const stand = spawn('retort-stand', new THREE.Vector3(SPRING_RIG.standX, BENCH_HEIGHT, this.#springZ));
    const bossHead = spawn('boss-head', new THREE.Vector3(SPRING_RIG.standX, this.#topY, this.#springZ));
    const clamp = spawn('clamp', new THREE.Vector3(SPRING_RIG.standX + 0.03, this.#topY, this.#springZ));
    const hanger = spawn('mass-hanger', new THREE.Vector3(this.#springX, BENCH_HEIGHT, this.#springZ));

    const ruleX = this.#springX + SPRING_RIG.ruleOffsetX;
    const rule = spawn('metre-rule', new THREE.Vector3(ruleX, BENCH_HEIGHT, this.#springZ));
    const ruleFoot = spawn('rule-foot', new THREE.Vector3(ruleX, BENCH_HEIGHT, this.#springZ));

    this.parts = { stand, bossHead, clamp, hanger, rule, ruleFoot };

    // This assembly is a fixed piece of apparatus: none of it is dragged around.
    for (const part of this.#spawned) part.object.userData.dragMode = 'none';

    this.#spring = new SpringModel({
      naturalLengthM: spec.naturalLengthM,
      springConstantNm: spec.stiffnessNm,
    });
    this.#overlay.name = 'SpringRigOverlay';
    this.#overlay.add(this.#spring.group);
    lab.root.add(this.#overlay);

    this.#currentLengthM = spec.naturalLengthM;
    this.#targetLengthM = spec.naturalLengthM;
    this.#applyGeometry();
  }

  /** Mass of the hanger itself, in kg (read from the model). */
  get hangerMassKg(): number {
    const physics = this.parts.hanger.object.userData.physics as { massKg?: number } | undefined;
    return physics?.massKg ?? 0.05;
  }

  /** Height above the bench of the pointer, in metres — the reading. */
  get fiducialHeightAboveBenchM(): number {
    return this.#topY - this.#coilHeightM() - BENCH_HEIGHT;
  }

  /** True once the spring has stopped moving. */
  get settled(): boolean {
    return Math.abs(this.#targetLengthM - this.#currentLengthM) < 0.0004;
  }

  /** Aim the spring at a new total length (coil + hooks), in metres. */
  setSpringLength(totalLengthM: number): void {
    this.#targetLengthM = Math.max(this.spec.naturalLengthM * 0.4, totalLengthM);
  }

  /** Jump straight to the aimed-for length instead of easing to it. */
  snapToTarget(): void {
    this.#currentLengthM = this.#targetLengthM;
    this.#applyGeometry();
  }

  /** Replace the stack of slotted masses (grams, bottom mass first). */
  setMasses(grams: readonly number[]): void {
    for (const placed of this.#masses) this.#lab.remove(placed.instanceId);
    this.#masses = grams.map((size) => {
      const placed = this.#lab.spawn(massDefinitionId(size), {
        position: new THREE.Vector3(this.#springX, BENCH_HEIGHT, this.#springZ),
        manualPlacement: true,
      });
      placed.object.userData.dragMode = 'none';
      return placed;
    });
    this.#applyGeometry();
  }

  update(dt: number): void {
    const gap = this.#targetLengthM - this.#currentLengthM;
    if (gap === 0) return;
    this.#currentLengthM += gap * (1 - Math.exp(-SPRING_RIG.settleRate * dt));
    this.#applyGeometry();
  }

  dispose(): void {
    for (const placed of [...this.#spawned, ...this.#masses]) this.#lab.remove(placed.instanceId);
    this.#spawned.length = 0;
    this.#masses = [];

    this.#overlay.traverse((object) => {
      const mesh = object as Partial<THREE.Mesh>;
      mesh.geometry?.dispose();
    });
    this.#overlay.removeFromParent();
  }

  #coilHeightM(): number {
    return Math.max(0.02, this.#currentLengthM - 0.028);
  }

  /** Recompute every dependent position from the current spring length. */
  #applyGeometry(): void {
    const coilHeightM = this.#coilHeightM();
    this.#spring.setLength(this.#currentLengthM);

    // Keep the *top* of the spring pinned to the clamp; the bottom moves.
    const springBottomY = this.#topY - coilHeightM;
    this.#spring.group.position.set(this.#springX, springBottomY, this.#springZ);

    // The hanger's stem top hooks onto the spring's bottom.
    this.parts.hanger.object.position.set(this.#springX, springBottomY - 0.028, this.#springZ);

    // Slotted masses rest on the hanger's plate and stack upwards.
    const plateTopLocalY = -0.02;
    this.#masses.forEach((placed, index) => {
      placed.object.position.set(
        this.#springX,
        this.parts.hanger.object.position.y + plateTopLocalY + 0.003 + index * SPRING_RIG.massSpacingM,
        this.#springZ,
      );
    });
  }
}
