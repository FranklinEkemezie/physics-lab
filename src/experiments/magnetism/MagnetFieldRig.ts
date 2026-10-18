/**
 * The bench layout for the bar-magnet field practical.
 *
 * Owns the geometry: the plotting paper with its printed centimetre scale, the
 * bar magnet lying along the scale's cross-line, and the plotting compass the
 * student walks around. The *physics* — what the needle does — lives in
 * `src/physics/magnetism.ts`; this class only converts state into 3-D objects.
 *
 * The layout is chosen so that the experiment is geometrically honest:
 *
 *  - The magnet points **across** the bench (its moment along +z), so its
 *    equatorial line runs **left to right** (+x) — the direction that is easy
 *    to drag the compass along.
 *  - The Earth's horizontal field points along +x, printed on the paper as
 *    "magnetic north". On the equatorial line the two fields are therefore at
 *    right angles, which is what makes `tan θ = B/H` clean.
 */

import * as THREE from 'three';
import type { Lab } from '@/lab/Lab';
import type { PlacedObject } from '@/lab/types';
import { BENCH_HEIGHT } from '@/engine/LabRoom';
import { Materials } from '@/engine/materials';
import type { PlottingCompassModel } from '@/engine/models/magnetism';
import {
  EARTH_HORIZONTAL_T,
  type DipoleMagnet,
  type PlanarField,
  compassHeadingRad,
  totalFieldAt,
  uniformField,
} from '@/physics/electromagnetism';
import { traceStreamline } from '@/core/math';

/** Design constants. Changing these moves the whole practical. */
export const MAGNET_RIG = {
  /** Centre of the paper, and of the magnet, on the bench. */
  centreX: 0,
  centreZ: 0,
  /** The plotting sheet. */
  paperWidthM: 1.1,
  paperDepthM: 0.5,
  paperThicknessM: 0.0012,
  /** The bar magnet. */
  magnetLengthM: 0.1,
  /** Moment along +z: the magnet lies pointing across the bench. */
  momentAngleRad: Math.PI / 2,
  /** Earth's horizontal field (magnetic north) along +x. */
  earthAngleRad: 0,
  /** Distance from the centre at which the compass starts. */
  startDistanceM: 0.24,
  /** The range of distances over which the point-dipole theory is fair. */
  minDistanceM: 0.11,
  maxDistanceM: 0.5,
  /** Length of one "walk the compass along the needle" step. */
  stepM: 0.01,
  /** Compass yaw that turns its printed N towards magnetic north (+x). */
  compassYawRad: -Math.PI / 2,
} as const;

/** Height of the printed surface of the paper above the floor. */
export const PAPER_SURFACE_Y = BENCH_HEIGHT + MAGNET_RIG.paperThicknessM;

export interface MagnetFieldRigOptions {
  /** Magnetic moment of the bar magnet, A·m². The experiment randomises it. */
  momentAm2: number;
}

export class MagnetFieldRig {
  /** The magnet reduced to the dipole the theory uses. */
  readonly magnet: DipoleMagnet;
  /** Earth's horizontal field at the bench, as a planar vector. */
  readonly earth: PlanarField;

  readonly paper: THREE.Mesh;
  readonly magnetObject: PlacedObject;
  readonly compass: PlacedObject;

  readonly #overlays = new THREE.Group();
  readonly #lab: Lab;
  #compassModel: PlottingCompassModel | null = null;

  // --- Pencil lines the student draws ------------------------------------
  #activePoints: THREE.Vector3[] = [];
  #activeLine: THREE.Line | null = null;
  readonly #finishedLines: THREE.Line[] = [];

  // --- Training-wheels guide --------------------------------------------
  #guideLine: THREE.Line | null = null;
  #guideSeed: { x: number; z: number } | null = null;
  #filings: PlacedObject | null = null;

  constructor(lab: Lab, options: MagnetFieldRigOptions) {
    this.#lab = lab;
    this.magnet = {
      x: MAGNET_RIG.centreX,
      z: MAGNET_RIG.centreZ,
      momentAm2: options.momentAm2,
      momentAngleRad: MAGNET_RIG.momentAngleRad,
    };
    this.earth = uniformField(MAGNET_RIG.earthAngleRad, EARTH_HORIZONTAL_T);

    this.#overlays.name = 'MagnetFieldOverlays';
    lab.root.add(this.#overlays);

    // --- Plotting sheet ---------------------------------------------------
    const sheet = buildPlottingPaper(MAGNET_RIG.paperWidthM, MAGNET_RIG.paperDepthM);
    sheet.position.set(MAGNET_RIG.centreX, BENCH_HEIGHT + MAGNET_RIG.paperThicknessM / 2, MAGNET_RIG.centreZ);
    this.#overlays.add(sheet);

    const printed = new THREE.Mesh(
      new THREE.PlaneGeometry(MAGNET_RIG.paperWidthM, MAGNET_RIG.paperDepthM),
      new THREE.MeshStandardMaterial({
        map: makePlottingTexture(MAGNET_RIG.paperWidthM, MAGNET_RIG.paperDepthM),
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    printed.name = 'PlottingPaperFace';
    printed.rotation.x = -Math.PI / 2;
    printed.position.set(MAGNET_RIG.centreX, PAPER_SURFACE_Y, MAGNET_RIG.centreZ);
    printed.receiveShadow = false;
    this.#overlays.add(printed);
    this.paper = printed;

    // --- Bar magnet -------------------------------------------------------
    this.magnetObject = lab.spawn('bar-magnet', {
      position: new THREE.Vector3(MAGNET_RIG.centreX, PAPER_SURFACE_Y, MAGNET_RIG.centreZ),
      // local +x (the north pole) maps to +z, matching momentAngleRad.
      rotationY: -MAGNET_RIG.momentAngleRad,
      manualPlacement: true,
    });
    this.magnetObject.object.userData.dragMode = 'none';

    // --- Plotting compass -------------------------------------------------
    this.compass = lab.spawn('plotting-compass', {
      position: new THREE.Vector3(
        MAGNET_RIG.centreX + MAGNET_RIG.startDistanceM,
        PAPER_SURFACE_Y,
        MAGNET_RIG.centreZ,
      ),
      rotationY: MAGNET_RIG.compassYawRad,
      manualPlacement: true,
    });
    this.#compassModel =
      (this.compass.object.userData.compassModel as PlottingCompassModel | undefined) ?? null;
    this.setNeedleImmediate();
  }

  // -------------------------------------------------------------------------
  // Field
  // -------------------------------------------------------------------------

  /** The total horizontal field anywhere on the paper. */
  fieldAt = (x: number, z: number): PlanarField => totalFieldAt(x, z, this.magnet, this.earth);

  /** Point the compass needle along the field where the compass currently sits. */
  setNeedle(): void {
    const { x, z } = this.compassPosition();
    this.#compassModel?.setHeading(compassHeadingRad(this.fieldAt(x, z)));
  }

  /** Snap the needle without the damped swing (used at setup). */
  setNeedleImmediate(): void {
    const { x, z } = this.compassPosition();
    this.#compassModel?.setHeading(compassHeadingRad(this.fieldAt(x, z)), true);
  }

  // -------------------------------------------------------------------------
  // Compass position
  // -------------------------------------------------------------------------

  compassPosition(): { x: number; z: number } {
    return { x: this.compass.object.position.x, z: this.compass.object.position.z };
  }

  /** Move the compass (used by the "walk one step" button). */
  setCompassPosition(x: number, z: number): void {
    this.compass.object.position.set(x, PAPER_SURFACE_Y, z);
  }

  /** Signed offset from the magnet's centre along the equatorial line. */
  get compassOffsetX(): number {
    return this.compass.object.position.x - this.magnet.x;
  }

  /** How far the compass sits *off* the equatorial line, in metres. */
  get compassOffLine(): number {
    return Math.abs(this.compass.object.position.z - this.magnet.z);
  }

  /** Distance from the centre, measured along the equatorial line. */
  get scaleDistanceM(): number {
    return Math.abs(this.compassOffsetX);
  }

  /** True centre-to-compass distance (the quantity the theory really uses). */
  get trueDistanceM(): number {
    const { x, z } = this.compassPosition();
    return Math.hypot(x - this.magnet.x, z - this.magnet.z);
  }

  /** True deflection of the needle from magnetic north, in radians. */
  get deflectionRad(): number {
    const { x, z } = this.compassPosition();
    return Math.atan2(this.fieldAt(x, z).z, this.fieldAt(x, z).x);
  }

  /** Walk the compass one step along the needle — how a student plots a line. */
  walkStep(): void {
    const { x, z } = this.compassPosition();
    const field = this.fieldAt(x, z);
    const magnitude = Math.hypot(field.x, field.z) || 1;
    const nextX = x + (field.x / magnitude) * MAGNET_RIG.stepM;
    const nextZ = z + (field.z / magnitude) * MAGNET_RIG.stepM;
    if (this.insidePaper(nextX, nextZ)) this.setCompassPosition(nextX, nextZ);
  }

  /** Mark where the compass is, step it along the needle, and mark again. */
  traceStep(): void {
    this.recordPencilPoint();
    this.walkStep();
    this.recordPencilPoint();
  }

  /** Is a point comfortably on the sheet of paper? */
  insidePaper(x: number, z: number): boolean {
    const halfWidth = MAGNET_RIG.paperWidthM / 2 - 0.01;
    const halfDepth = MAGNET_RIG.paperDepthM / 2 - 0.01;
    return (
      Math.abs(x - MAGNET_RIG.centreX) < halfWidth && Math.abs(z - MAGNET_RIG.centreZ) < halfDepth
    );
  }

  // -------------------------------------------------------------------------
  // Pencil lines
  // -------------------------------------------------------------------------

  /**
   * Add the compass's current position to the line being drawn. Small movements
   * are ignored so a jittery drag still leaves a smooth pencil line.
   */
  recordPencilPoint(): void {
    const { x, z } = this.compassPosition();
    const point = new THREE.Vector3(x, PAPER_SURFACE_Y + 0.0006, z);
    const last = this.#activePoints[this.#activePoints.length - 1];
    if (last && last.distanceTo(point) < 0.003) return;
    if (this.#activePoints.length > 6000) return;
    this.#activePoints.push(point);
    this.#redrawPencil();
  }

  #redrawPencil(): void {
    if (this.#activePoints.length < 2) return;
    if (!this.#activeLine) {
      this.#activeLine = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0x2b2b33, transparent: true, opacity: 0.85 }),
      );
      this.#activeLine.renderOrder = 5;
      (this.#activeLine.material as THREE.LineBasicMaterial).depthWrite = false;
      this.#overlays.add(this.#activeLine);
    }
    setLinePoints(this.#activeLine, this.#activePoints);
    this.#activeLine.visible = true;
  }

  /** Finish the current pencil line and start a fresh one. */
  startNewLine(): void {
    if (this.#activeLine && this.#activePoints.length >= 2) {
      this.#finishedLines.push(this.#activeLine);
    } else if (this.#activeLine) {
      this.#activeLine.removeFromParent();
      this.#activeLine.geometry.dispose();
      (this.#activeLine.material as THREE.Material).dispose();
    }
    this.#activeLine = null;
    this.#activePoints = [];
  }

  /** Rub out every pencil line. */
  clearPencilLines(): void {
    for (const line of this.#finishedLines.splice(0)) {
      line.removeFromParent();
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    if (this.#activeLine) {
      this.#activeLine.removeFromParent();
      this.#activeLine.geometry.dispose();
      (this.#activeLine.material as THREE.Material).dispose();
      this.#activeLine = null;
    }
    this.#activePoints = [];
  }

  get pencilPointCount(): number {
    return this.#activePoints.length;
  }

  // -------------------------------------------------------------------------
  // Training-wheels guide
  // -------------------------------------------------------------------------

  /** Draw the complete field line through the compass (training wheels). */
  updateGuideLine(visible: boolean): void {
    if (!visible) {
      if (this.#guideLine) this.#guideLine.visible = false;
      this.#guideSeed = null;
      return;
    }
    const { x, z } = this.compassPosition();
    const unchanged =
      this.#guideSeed !== null && Math.hypot(x - this.#guideSeed.x, z - this.#guideSeed.z) < 0.001;
    this.#guideSeed = { x, z };
    if (unchanged && this.#guideLine?.visible) return;

    const points = traceStreamline(this.fieldAt, { x, z }, {
      stepM: 0.006,
      bounds: {
        minX: MAGNET_RIG.centreX - MAGNET_RIG.paperWidthM / 2 + 0.005,
        maxX: MAGNET_RIG.centreX + MAGNET_RIG.paperWidthM / 2 - 0.005,
        minZ: MAGNET_RIG.centreZ - MAGNET_RIG.paperDepthM / 2 + 0.005,
        maxZ: MAGNET_RIG.centreZ + MAGNET_RIG.paperDepthM / 2 - 0.005,
      },
      stop: (px, pz) => Math.hypot(px - this.magnet.x, pz - this.magnet.z) < 0.022,
    });

    const vectors = points.map((p) => new THREE.Vector3(p.x, PAPER_SURFACE_Y + 0.0004, p.z));
    if (!this.#guideLine) {
      this.#guideLine = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineDashedMaterial({
          color: 0xd94f3d,
          dashSize: 0.008,
          gapSize: 0.006,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        }),
      );
      this.#guideLine.renderOrder = 4;
      this.#overlays.add(this.#guideLine);
    }
    setLinePoints(this.#guideLine, vectors);
    this.#guideLine.visible = vectors.length > 1;
  }

  // -------------------------------------------------------------------------
  // Iron filings card
  // -------------------------------------------------------------------------

  /** Lay the iron-filings card over the magnet, or pick it back up. */
  setFilingsVisible(visible: boolean): void {
    if (visible && !this.#filings) {
      this.#filings = this.#lab.spawn('iron-filings', {
        position: new THREE.Vector3(
          MAGNET_RIG.centreX,
          BENCH_HEIGHT + 0.012,
          MAGNET_RIG.centreZ,
        ),
        // The card's printed pattern is drawn with its dipole along +x, so it
        // is turned to match this magnet's moment (along +z).
        rotationY: -MAGNET_RIG.momentAngleRad,
        manualPlacement: true,
      });
      this.#filings.object.userData.dragMode = 'bench';
    } else if (!visible && this.#filings) {
      this.#lab.remove(this.#filings.instanceId);
      this.#filings = null;
    }
  }

  get filingsVisible(): boolean {
    return this.#filings !== null;
  }

  // -------------------------------------------------------------------------

  dispose(): void {
    this.setFilingsVisible(false);
    this.clearPencilLines();
    if (this.#guideLine) {
      this.#guideLine.removeFromParent();
      this.#guideLine.geometry.dispose();
      (this.#guideLine.material as THREE.Material).dispose();
      this.#guideLine = null;
    }
    // Any extra overlays (the sheet) are disposed with the group.
    this.#overlays.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry?.dispose();
        const material = object.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material?.dispose();
      }
    });
    this.#overlays.removeFromParent();
  }
}

// ---------------------------------------------------------------------------
// The plotting sheet
// ---------------------------------------------------------------------------

/** A cream card the thickness of good cartridge paper. */
function buildPlottingPaper(widthM: number, depthM: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(widthM, MAGNET_RIG.paperThicknessM, depthM),
    Materials.paint('#efe7d4', 0.95),
  );
  mesh.name = 'PlottingPaper';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Rasterise the printed face of the plotting paper: a centimetre grid, the
 * equatorial line with a centimetre scale, and an arrow showing magnetic north.
 */
function makePlottingTexture(widthM: number, depthM: number): THREE.CanvasTexture {
  const pxPerM = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(widthM * pxPerM);
  canvas.height = Math.round(depthM * pxPerM);
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const px = (m: number): number => m * pxPerM;
  const centrePx = canvas.width / 2;
  const middlePx = canvas.height / 2;

  ctx.fillStyle = '#f7f1e2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --- 1 cm grid --------------------------------------------------------
  ctx.strokeStyle = 'rgba(70,80,95,0.16)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= widthM + 1e-6; x += 0.01) {
    ctx.beginPath();
    ctx.moveTo(px(x), 0);
    ctx.lineTo(px(x), canvas.height);
    ctx.stroke();
  }
  for (let z = 0; z <= depthM + 1e-6; z += 0.01) {
    ctx.beginPath();
    ctx.moveTo(0, px(z));
    ctx.lineTo(canvas.width, px(z));
    ctx.stroke();
  }

  // --- The equatorial line ----------------------------------------------
  ctx.strokeStyle = 'rgba(25,40,70,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, middlePx);
  ctx.lineTo(canvas.width, middlePx);
  ctx.stroke();

  // --- Centimetre scale along the line ----------------------------------
  ctx.strokeStyle = 'rgba(25,40,70,0.9)';
  ctx.fillStyle = 'rgba(25,40,70,0.95)';
  ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const halfWidthCm = Math.floor(widthM * 100) / 2;
  for (let cm = 0; cm <= halfWidthCm; cm += 1) {
    const isMajor = cm % 10 === 0;
    const isMid = cm % 5 === 0;
    const tick = isMajor ? 14 : isMid ? 10 : 5;
    for (const direction of [-1, 1]) {
      const x = centrePx + direction * px(cm / 100);
      ctx.lineWidth = isMajor ? 1.8 : 1;
      ctx.beginPath();
      ctx.moveTo(x, middlePx - tick);
      ctx.lineTo(x, middlePx + tick);
      ctx.stroke();
      if (isMajor && cm > 0) ctx.fillText(String(cm), x, middlePx - tick - 4);
    }
  }
  ctx.fillText('0', centrePx, middlePx + 30);

  // --- The magnet's footprint -------------------------------------------
  const magnetHalfLength = px(MAGNET_RIG.magnetLengthM / 2);
  const magnetHalfWidth = px(0.008);
  ctx.strokeStyle = 'rgba(150,40,30,0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(centrePx - magnetHalfWidth, middlePx - magnetHalfLength, magnetHalfWidth * 2, magnetHalfLength * 2);

  // --- Magnetic north ---------------------------------------------------
  ctx.strokeStyle = 'rgba(30,110,60,0.9)';
  ctx.fillStyle = 'rgba(30,110,60,0.95)';
  ctx.lineWidth = 2.5;
  const arrowY = px(0.05);
  const arrowX0 = centrePx + px(0.3);
  const arrowX1 = arrowX0 + px(0.12);
  ctx.beginPath();
  ctx.moveTo(arrowX0, arrowY);
  ctx.lineTo(arrowX1, arrowY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(arrowX1, arrowY);
  ctx.lineTo(arrowX1 - 9, arrowY - 5);
  ctx.lineTo(arrowX1 - 9, arrowY + 5);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('geographic / magnetic N', arrowX0 - px(0.075), arrowY);

  ctx.font = 'italic 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(60,60,70,0.8)';
  ctx.fillText('equatorial line — keep the compass on this line', 16, middlePx + px(0.16));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// ---------------------------------------------------------------------------
// Line rendering
// ---------------------------------------------------------------------------

/**
 * Point a line at a fresh list of points.
 *
 * `BufferGeometry.setFromPoints` reuses whatever buffer is already attached, so
 * a line that grows (as a pencil line does, one step at a time) silently loses
 * its newest points once the buffer fills. Rebuilding the geometry keeps the
 * drawing honest and costs nothing at these sizes.
 */
function setLinePoints(line: THREE.Line, points: THREE.Vector3[]): void {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(points);
  // Needed by the dashed training-wheels guide; harmless elsewhere.
  line.computeLineDistances();
}
