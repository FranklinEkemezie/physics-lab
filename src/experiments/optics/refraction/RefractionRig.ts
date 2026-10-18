/**
 * The bench layout for the refraction practical.
 *
 * Owns the sheet of paper, the glass block, the ray box and the light rays
 * drawn on the paper. The *physics* — where the refracted ray goes — lives in
 * `@/physics/optics`; this class only turns an angle of incidence into a
 * picture, and moves the ray box to keep its slit at the start of the beam.
 *
 * The block is built here rather than taken from the catalogue so the
 * experiment can give it a **hidden** refractive index: the label never prints
 * it, and the student has to measure it.
 */

import * as THREE from 'three';
import type { Lab } from '@/lab/Lab';
import { BENCH_HEIGHT } from '@/engine/LabRoom';
import { Materials } from '@/engine/materials';
import { RayBoxModel, buildGlassBlock, buildProtractor } from '@/engine/models/optics';
import { traceBlockRay } from '@/physics/optics';

/** The fixed geometry of the refraction bench, in metres. */
export const REFRACTION_RIG = {
  paperWidthM: 0.44,
  paperDepthM: 0.4,
  paperThicknessM: 0.002,
  blockLengthM: 0.1,
  blockWidthM: 0.06,
  blockHeightM: 0.05,
  /** Bench x at which the beam strikes the block's front face. */
  entryX: -0.02,
  /** Length of the drawn incident and emergent rays, in metres. */
  rayLengthM: 0.15,
  /** Distance from the ray box's origin to its slit, along its axis. */
  slitOffsetM: 0.0685,
} as const;

/** Height of the beam above the bench: the ray box's slit, sitting on the paper. */
const RAY_Y = BENCH_HEIGHT + REFRACTION_RIG.paperThicknessM + 0.038;
/** Warm yellow for the light rays. */
const RAY_COLOUR = 0xffd24a;
/** A cool grey for the normal. */
const NORMAL_COLOUR = 0x8b93a7;

export class RefractionRig {
  /** Refractive index of the block — the value the student must measure. */
  readonly refractiveIndex: number;

  readonly #overlay = new THREE.Group();
  readonly #rayBox: RayBoxModel;
  readonly #incident: THREE.Line;
  readonly #refracted: THREE.Line;
  readonly #emergent: THREE.Line;
  readonly #normal: THREE.Line;

  #incidenceRad: number;

  constructor(lab: Lab, refractiveIndex: number, incidenceRad: number) {
    this.refractiveIndex = refractiveIndex;
    this.#incidenceRad = incidenceRad;

    this.#overlay.name = 'RefractionRigOverlay';
    lab.root.add(this.#overlay);

    const paperTopY = BENCH_HEIGHT + REFRACTION_RIG.paperThicknessM;

    // The sheet of paper the rays are marked on.
    const paper = new THREE.Mesh(
      new THREE.BoxGeometry(REFRACTION_RIG.paperWidthM, REFRACTION_RIG.paperThicknessM, REFRACTION_RIG.paperDepthM),
      Materials.paint('#f4f0e4', 0.95),
    );
    paper.name = 'Paper';
    paper.position.set(0, BENCH_HEIGHT + REFRACTION_RIG.paperThicknessM / 2, 0);

    // A protractor, ready for reading the angles off the drawing.
    const protractor = buildProtractor(0.05);
    protractor.position.set(0.15, paperTopY + 0.001, -0.155);
    protractor.rotation.y = Math.PI / 2;

    // The block itself: long side across, thickness along z, so the beam enters
    // the front face and leaves the back face parallel but shifted sideways.
    const block = buildGlassBlock({
      lengthM: REFRACTION_RIG.blockLengthM,
      widthM: REFRACTION_RIG.blockWidthM,
      heightM: REFRACTION_RIG.blockHeightM,
      refractiveIndex,
      label: 'Glass block',
      showIndex: false,
    });
    block.position.set(0, paperTopY, 0);

    this.#rayBox = new RayBoxModel();
    this.#rayBox.setRayCount(1);
    // The model's own long beams would shoot clean across the bench; we draw
    // the path precisely instead, so hide them.
    for (const beam of this.#rayBox.beams) beam.visible = false;

    const makeRay = (colour: number): THREE.Line => {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: colour, depthTest: false, transparent: true, opacity: 0.95 }),
      );
      line.renderOrder = 12;
      return line;
    };

    this.#incident = makeRay(RAY_COLOUR);
    this.#refracted = makeRay(RAY_COLOUR);
    this.#emergent = makeRay(RAY_COLOUR);
    this.#normal = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({
        color: NORMAL_COLOUR,
        dashSize: 0.008,
        gapSize: 0.006,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.#normal.renderOrder = 11;

    this.#overlay.add(paper, protractor, block, this.#rayBox.group, this.#incident, this.#refracted, this.#emergent, this.#normal);
    this.#updateRays();
  }

  get incidenceRad(): number {
    return this.#incidenceRad;
  }

  /** Move the ray box and redraw the beam path for a new angle of incidence. */
  setIncidenceRad(radians: number): void {
    this.#incidenceRad = radians;
    this.#updateRays();
  }

  /** The angle of refraction the beam actually makes inside the block. */
  get refractionRad(): number {
    return traceBlockRay(this.#pathOptions()).refractionRad;
  }

  dispose(): void {
    this.#overlay.traverse((object) => {
      const mesh = object as Partial<THREE.Mesh>;
      mesh.geometry?.dispose();
    });
    this.#overlay.removeFromParent();
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  #pathOptions(): { incidenceRad: number; refractiveIndex: number; thicknessM: number; entry: { x: number; z: number } } {
    return {
      incidenceRad: this.#incidenceRad,
      refractiveIndex: this.refractiveIndex,
      thicknessM: REFRACTION_RIG.blockWidthM,
      entry: { x: REFRACTION_RIG.entryX, z: REFRACTION_RIG.blockWidthM / 2 },
    };
  }

  #updateRays(): void {
    const options = this.#pathOptions();
    const path = traceBlockRay(options);
    const { entry, exit } = path;

    // Direction the beam travels: down the bench (−z) and across (+x).
    const dx = Math.sin(this.#incidenceRad);
    const dz = -Math.cos(this.#incidenceRad);
    const length = REFRACTION_RIG.rayLengthM;

    const start = { x: entry.x - length * dx, z: entry.z - length * dz };
    const end = { x: exit.x + length * dx, z: exit.z + length * dz };
    const at = (point: { x: number; z: number }): THREE.Vector3 => new THREE.Vector3(point.x, RAY_Y, point.z);

    setLinePoints(this.#incident, [at(start), at(entry)]);
    setLinePoints(this.#refracted, [at(entry), at(exit)]);
    setLinePoints(this.#emergent, [at(exit), at(end)]);
    setLinePoints(this.#normal, [
      at({ x: entry.x, z: entry.z + 0.06 }),
      at({ x: entry.x, z: entry.z - 0.06 }),
    ]);

    // Sit the ray box so its slit lands exactly on the start of the beam.
    const slit = REFRACTION_RIG.slitOffsetM;
    this.#rayBox.group.rotation.y = Math.PI / 2 - this.#incidenceRad;
    this.#rayBox.group.position.set(
      start.x - slit * dx,
      BENCH_HEIGHT + REFRACTION_RIG.paperThicknessM,
      start.z - slit * dz,
    );
  }
}

/** Replace a line's geometry with a fresh run of points. */
function setLinePoints(line: THREE.Line, points: THREE.Vector3[]): void {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(points);
  if (line.material instanceof THREE.LineDashedMaterial) line.computeLineDistances();
}
