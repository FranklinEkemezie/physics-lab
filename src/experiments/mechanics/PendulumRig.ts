/**
 * The physical assembly of a simple pendulum.
 *
 * Owns the geometry of the practical: where the stand is, where the clamp sits
 * on the rod, how long the thread is, and therefore where the bob hangs. The
 * *physics* is in `src/physics/pendulum.ts`; this class only ever converts a
 * state angle into world positions.
 *
 * Everything is in metres and in bench coordinates (bench top at y = 0.92).
 */

import * as THREE from 'three';
import type { Lab } from '@/lab/Lab';
import type { PlacedObject } from '@/lab/types';
import { BENCH_HEIGHT } from '@/engine/LabRoom';
import { spanThread } from '@/engine/models/pendulum';

/** Design constants of the rig. Changing these moves the whole practical. */
export const RIG = {
  /** Position of the retort stand base. */
  standX: 0.12,
  standZ: -0.2,
  /** The bob swings in the vertical plane z = standZ. */
  /** Horizontal offset from the rod to the clamp jaws. */
  bossToJawsX: 0.075,
  /** Where the metre rule stands (behind the swing plane). */
  ruleX: 0.12 + 0.075,
  ruleZ: -0.232,
  /** Height of the split cork, in metres (must match the model). */
  corkHeightM: 0.05,
  /** Boss head height range on the 75 cm rod. */
  minClampHeightM: 0.12,
  maxClampHeightM: 0.7,
  /** Shortest and longest thread the cork can carry. */
  minThreadM: 0.12,
  maxThreadM: 0.6,
  /** Minimum clearance between the bottom of the bob and the bench. */
  minBenchClearanceM: 0.012,
} as const;

export interface PendulumRigParts {
  stand: PlacedObject;
  bossHead: PlacedObject;
  clamp: PlacedObject;
  cork: PlacedObject;
  thread: PlacedObject;
  bob: PlacedObject;
  rule: PlacedObject;
  ruleFoot: PlacedObject;
}

export interface BobProperties {
  radiusM: number;
  massKg: number;
  /** Display name, e.g. "brass". */
  material: string;
}

export class PendulumRig {
  readonly parts: PendulumRigParts;
  readonly bob: BobProperties;

  /** Height of the boss head above the bench, in metres. */
  #clampHeightM: number;
  /** Length of thread from the cork to the bob's centre, in metres. */
  #threadLengthM: number;
  /** Current swing angle, radians from the downward vertical. */
  #theta = 0;

  #pivot = new THREE.Vector3();
  #bobCentre = new THREE.Vector3();

  constructor(lab: Lab, options: { clampHeightM?: number; threadLengthM?: number; bobDefinitionId?: string } = {}) {
    const { clampHeightM = 0.62, threadLengthM = 0.4, bobDefinitionId = 'pendulum-bob-brass' } = options;

    this.#clampHeightM = THREE.MathUtils.clamp(clampHeightM, RIG.minClampHeightM, RIG.maxClampHeightM);
    this.#threadLengthM = THREE.MathUtils.clamp(threadLengthM, RIG.minThreadM, RIG.maxThreadM);

    const spec = (id: string, position: THREE.Vector3): PlacedObject =>
      lab.spawn(id, { position, manualPlacement: true });

    const stand = spec('retort-stand', new THREE.Vector3(RIG.standX, BENCH_HEIGHT, RIG.standZ));
    const bossHead = spec(
      'boss-head',
      new THREE.Vector3(RIG.standX, BENCH_HEIGHT + this.#clampHeightM, RIG.standZ),
    );
    const clamp = spec(
      'clamp',
      new THREE.Vector3(RIG.standX + 0.03, BENCH_HEIGHT + this.#clampHeightM, RIG.standZ),
    );
    const cork = spec(
      'split-cork',
      new THREE.Vector3(RIG.standX + RIG.bossToJawsX, BENCH_HEIGHT + this.#clampHeightM, RIG.standZ),
    );
    const thread = spec(
      'thread',
      new THREE.Vector3(RIG.standX + RIG.bossToJawsX, BENCH_HEIGHT + this.#clampHeightM, RIG.standZ),
    );
    const bob = spec(
      bobDefinitionId,
      new THREE.Vector3(RIG.standX + RIG.bossToJawsX, BENCH_HEIGHT + this.#clampHeightM, RIG.standZ),
    );
    const rule = spec('metre-rule', new THREE.Vector3(RIG.ruleX, BENCH_HEIGHT, RIG.ruleZ));
    const ruleFoot = spec('rule-foot', new THREE.Vector3(RIG.ruleX, BENCH_HEIGHT, RIG.ruleZ));

    this.parts = { stand, bossHead, clamp, cork, thread, bob, rule, ruleFoot };

    // The thread model is built with a unit-length mesh, not a modelled string
    // of a given length; the reel is what the student takes off the shelf.
    const physics = bob.object.userData.physics as { radiusM?: number; massKg?: number; material?: string } | undefined;
    this.bob = {
      radiusM: physics?.radiusM ?? 0.0125,
      massKg: physics?.massKg ?? 0.07,
      material: physics?.material ?? 'brass',
    };

    // Interaction rules for each part.
    bossHead.object.userData.dragMode = 'vertical';
    clamp.object.userData.dragMode = 'none';
    cork.object.userData.dragMode = 'none';
    thread.object.userData.dragMode = 'none';
    rule.object.userData.dragMode = 'bench';
    stand.object.userData.dragMode = 'bench';
    ruleFoot.object.userData.dragMode = 'bench';

    // The bob is dragged by the experiment (it must follow an arc, not a plane).
    bob.object.userData.dragMode = 'custom';
    bob.object.userData.dragPlane = {
      normal: new THREE.Vector3(0, 0, 1),
      point: new THREE.Vector3(0, BENCH_HEIGHT + this.#clampHeightM, RIG.standZ),
    };

    // Selection names shown in the inspector.
    for (const [key, part] of Object.entries(this.parts)) {
      part.object.name = `Pendulum:${key}`;
    }

    this.applyGeometry();
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  get clampHeightM(): number {
    return this.#clampHeightM;
  }

  get threadLengthM(): number {
    return this.#threadLengthM;
  }

  get theta(): number {
    return this.#theta;
  }

  /** Height of the point of suspension above the bench, in metres. */
  get pivotHeightM(): number {
    return this.#clampHeightM - RIG.corkHeightM / 2;
  }

  /** The one quantity the practical is about: cork to centre of bob. */
  get lengthM(): number {
    return this.#threadLengthM;
  }

  /** How much thread can still be paid out before the bob touches the bench. */
  get maxThreadForCurrentClampM(): number {
    return Math.min(
      RIG.maxThreadM,
      this.#clampHeightM - RIG.corkHeightM / 2 - this.bob.radiusM - RIG.minBenchClearanceM,
    );
  }

  setClampHeight(heightM: number): void {
    this.#clampHeightM = THREE.MathUtils.clamp(heightM, RIG.minClampHeightM, RIG.maxClampHeightM);
    this.#threadLengthM = Math.min(this.#threadLengthM, this.maxThreadForCurrentClampM);
    this.#threadLengthM = Math.max(this.#threadLengthM, RIG.minThreadM);
    this.applyGeometry();
  }

  setThreadLength(lengthM: number): void {
    const upper = this.maxThreadForCurrentClampM;
    this.#threadLengthM = THREE.MathUtils.clamp(lengthM, RIG.minThreadM, Math.max(RIG.minThreadM, upper));
    this.applyGeometry();
  }

  /** Point the bob at a swing angle (positive = to the right, +x). */
  setTheta(theta: number): void {
    this.#theta = theta;
    this.applyGeometry();
  }

  // -------------------------------------------------------------------------
  // Geometry
  // -------------------------------------------------------------------------

  /** World position of the point of suspension (bottom of the split cork). */
  get pivot(): THREE.Vector3 {
    return this.#pivot.clone();
  }

  /** World position of the centre of the bob. */
  get bobCentre(): THREE.Vector3 {
    return this.#bobCentre.clone();
  }

  /** Where the centre of the bob rests when hanging straight down. */
  get bobRestCentre(): THREE.Vector3 {
    return new THREE.Vector3(
      RIG.standX + RIG.bossToJawsX,
      BENCH_HEIGHT + this.pivotHeightM - this.#threadLengthM,
      RIG.standZ,
    );
  }

  /** Recompute every dependent position from the current parameters. */
  private applyGeometry(): void {
    const pivotX = RIG.standX + RIG.bossToJawsX;
    const pivotY = BENCH_HEIGHT + this.pivotHeightM;
    const z = RIG.standZ;

    this.#pivot.set(pivotX, pivotY, z);

    // Bob centre: pivot displaced by the thread along the swing direction.
    this.#bobCentre.set(
      pivotX + this.#threadLengthM * Math.sin(this.#theta),
      pivotY - this.#threadLengthM * Math.cos(this.#theta),
      z,
    );

    // --- Stand, boss, clamp, cork -----------------------------------------
    const bench = BENCH_HEIGHT;
    this.parts.bossHead.object.position.set(RIG.standX, bench + this.#clampHeightM, z);
    this.parts.clamp.object.position.set(RIG.standX + 0.03, bench + this.#clampHeightM, z);
    this.parts.cork.object.position.set(pivotX, bench + this.#clampHeightM, z);
    this.parts.rule.object.position.set(RIG.ruleX, bench, RIG.ruleZ);
    this.parts.ruleFoot.object.position.set(RIG.ruleX, bench, RIG.ruleZ);

    // The drag plane must follow the pivot so the bob is grabbed correctly.
    const dragPlane = this.parts.bob.object.userData.dragPlane as
      | { normal: THREE.Vector3; point: THREE.Vector3 }
      | undefined;
    if (dragPlane) dragPlane.point.set(0, bench + this.#clampHeightM, z);

    // --- Bob ---------------------------------------------------------------
    const bobObject = this.parts.bob.object;
    bobObject.position.copy(this.#bobCentre);
    bobObject.rotation.z = this.#theta;

    // --- Thread ------------------------------------------------------------
    // The thread runs from the cork to the bob's hook, which sits above the
    // bob's centre along its own local +Y axis.
    const hookLocal = new THREE.Vector3(0, this.bob.radiusM * 1.62, 0).applyAxisAngle(
      new THREE.Vector3(0, 0, 1),
      this.#theta,
    );
    const hookWorld = this.#bobCentre.clone().add(hookLocal);
    const threadVisible = this.#threadLengthM - this.bob.radiusM * 1.62;
    const threadMesh = this.parts.thread.object.getObjectByName('Thread') as THREE.Mesh | undefined;
    if (threadMesh) {
      if (threadVisible > 0.005) {
        threadMesh.visible = true;
        spanThread(this.parts.thread.object, this.#pivot, hookWorld);
      } else {
        threadMesh.visible = false;
      }
    }
    void threadVisible;
  }

  /**
   * Convert a point on the swing plane into a swing angle.
   * Used when the student drags the bob: the pointer position defines the arc.
   */
  angleFromPlanePoint(point: { x: number; y: number }): number {
    const pivotX = RIG.standX + RIG.bossToJawsX;
    const pivotY = BENCH_HEIGHT + this.pivotHeightM;
    const dx = point.x - pivotX;
    const dy = pivotY - point.y;
    return Math.atan2(dx, Math.max(1e-4, dy));
  }

  /** World position of the fiducial mark the student reads on the rule. */
  get bobCentreMark(): THREE.Vector3 {
    return this.bobCentre;
  }

  /** Height above the bench of the suspension point, in metres. */
  get pivotHeightAboveBenchM(): number {
    return this.pivotHeightM;
  }

  /** Height above the bench of the bob's centre when at rest, in metres. */
  get bobCentreHeightAboveBenchM(): number {
    return this.pivotHeightM - this.#threadLengthM;
  }

  dispose(): void {
    // The Lab owns the objects; the experiment removes them.
  }
}
