/**
 * The camera at the bench.
 *
 * Orbiting a fixed point in mid-air reads as a turntable: the whole room swings
 * round and the bench slides past, so you never feel like you are standing at
 * it. This controller instead treats the camera as a person at the bench —
 *
 *  - it pivots about a point **on the bench surface**, where the apparatus is,
 *    and that pivot is kept inside the bench footprint;
 *  - the viewpoint never drops below the bench top and never climbs to a
 *    straight-overhead map, so the bench always looks like a bench;
 *  - dragging **looks around**, scrolling **steps towards what the cursor is
 *    over**, and Shift-dragging **slides along the bench**;
 *  - every change is eased, so the camera settles rather than snapping.
 *
 * It deliberately owns no DOM of its own beyond the canvas listeners it needs,
 * so the same controller can drive any `PerspectiveCamera` in front of any
 * bench-sized world.
 */

import * as THREE from 'three';
import { BENCH_HALF_DEPTH, BENCH_HALF_WIDTH, BENCH_HEIGHT } from './LabRoom';

/** Where a standing student's eye settles when the lab opens. */
const SEAT_AZIMUTH_RAD = 0.34;
const SEAT_POLAR_RAD = 1.14;
const SEAT_DISTANCE_M = 1.5;

/**
 * The seat's look-at point sits just above the bench surface, not at the middle
 * of the room: that is what turns "orbit the scene" into "walk round the bench".
 */
const SEAT_TARGET = new THREE.Vector3(0, BENCH_HEIGHT + 0.06, 0);

/** Steepest (near overhead) and shallowest (nearly level) viewpoints. */
const MIN_POLAR_RAD = 0.3;
const MAX_POLAR_RAD = 1.54;

const MIN_DISTANCE_M = 0.35;
const MAX_DISTANCE_M = 3.6;

/** The pivot is kept on the bench, with a margin so the edge stays usable. */
const TARGET_MARGIN_X_M = 0.12;
const TARGET_MARGIN_Z_M = 0.08;
const TARGET_MIN_Y_M = BENCH_HEIGHT - 0.02;
const TARGET_MAX_Y_M = BENCH_HEIGHT + 0.75;

/** Radians of view per CSS pixel of drag. */
const ROTATE_RAD_PER_PX = 0.0052;
/** Metres of pan per CSS pixel, per metre of viewing distance. */
const PAN_M_PER_PX = 0.0016;
/** Zoom exponent per unit of wheel delta. */
const ZOOM_PER_DELTA = 0.0012;

/** Time constants of the easing, in seconds. Small = snappier. */
const ROTATE_TAU_S = 0.075;
const ZOOM_TAU_S = 0.11;
const TARGET_TAU_S = 0.22;

export interface BenchControlsOptions {
  /** Initial look-at point. Defaults to the bench centre. */
  target?: THREE.Vector3;
  azimuthRad?: number;
  polarRad?: number;
  distanceM?: number;
  /** Arrow keys move the camera. Turn off in a host that needs them. */
  keyboard?: boolean;
}

type DragMode = 'none' | 'rotate' | 'pan' | 'pinch';

export class BenchControls {
  /**
   * The point the camera looks at. Setting it (or `camera.position`) from
   * outside takes effect on the next `update`, which is how the preset views
   * and the practicals' own "square up" buttons work.
   */
  readonly target: THREE.Vector3;

  /** The `Lab` turns this off while it is dragging a piece of apparatus. */
  enabled = true;

  /**
   * What a plain left-drag does: look around (`'look'`) or slide along the
   * bench (`'pan'`). Right-drag, middle-drag and Shift-drag always pan, so the
   * explicit mode is only a convenience for people who expect a hand tool.
   */
  dragMode: 'look' | 'pan' = 'look';

  readonly #camera: THREE.PerspectiveCamera;
  readonly #dom: HTMLElement;
  readonly #disposers: (() => void)[] = [];

  /** Where we are now… */
  #azimuth = SEAT_AZIMUTH_RAD;
  #polar = SEAT_POLAR_RAD;
  #distance = SEAT_DISTANCE_M;
  /** …and where we are heading. */
  #goalAzimuth = SEAT_AZIMUTH_RAD;
  #goalPolar = SEAT_POLAR_RAD;
  #goalDistance = SEAT_DISTANCE_M;
  readonly #goalTarget = new THREE.Vector3();

  /**
   * What we last wrote, so an outside write can be told apart from our own
   * easing and adopted instead of fought.
   */
  readonly #lastPosition = new THREE.Vector3();
  readonly #lastTarget = new THREE.Vector3();
  #hasApplied = false;

  readonly #pointers = new Map<number, { x: number; y: number }>();
  #mode: DragMode = 'none';
  #lastPointer = { x: 0, y: 0 };
  #pinchSpreadPx = 0;
  #pinchMidpoint = { x: 0, y: 0 };

  readonly #raycaster = new THREE.Raycaster();
  readonly #plane = new THREE.Plane();

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement, options: BenchControlsOptions = {}) {
    const {
      target = SEAT_TARGET,
      azimuthRad = SEAT_AZIMUTH_RAD,
      polarRad = SEAT_POLAR_RAD,
      distanceM = SEAT_DISTANCE_M,
      keyboard = true,
    } = options;

    this.#camera = camera;
    this.#dom = dom;
    this.target = target.clone();
    this.#goalTarget.copy(this.target);

    this.#azimuth = this.#goalAzimuth = azimuthRad;
    this.#polar = this.#goalPolar = clamp(polarRad, MIN_POLAR_RAD, MAX_POLAR_RAD);
    this.#distance = this.#goalDistance = clamp(distanceM, MIN_DISTANCE_M, MAX_DISTANCE_M);

    this.#clampTarget();
    this.#goalTarget.copy(this.target);

    // The browser's own gestures would fight ours on a touch screen.
    dom.style.touchAction = 'none';

    dom.addEventListener('pointerdown', this.#onPointerDown);
    dom.addEventListener('pointermove', this.#onPointerMove);
    dom.addEventListener('pointerup', this.#onPointerUp);
    dom.addEventListener('pointercancel', this.#onPointerUp);
    dom.addEventListener('wheel', this.#onWheel, { passive: false });
    dom.addEventListener('contextmenu', this.#onContextMenu);
    if (keyboard) window.addEventListener('keydown', this.#onKeyDown);

    this.#disposers.push(
      () => dom.removeEventListener('pointerdown', this.#onPointerDown),
      () => dom.removeEventListener('pointermove', this.#onPointerMove),
      () => dom.removeEventListener('pointerup', this.#onPointerUp),
      () => dom.removeEventListener('pointercancel', this.#onPointerUp),
      () => dom.removeEventListener('wheel', this.#onWheel),
      () => dom.removeEventListener('contextmenu', this.#onContextMenu),
      () => {
        if (keyboard) window.removeEventListener('keydown', this.#onKeyDown);
      },
    );

    // Put the camera in place before the first frame is drawn. `#apply` is used
    // rather than `update` so the *caller's* camera position is not mistaken for
    // an external write and adopted over the seat pose.
    this.#apply();
  }

  /**
   * Advance the easing and place the camera. `dt` is seconds; call once a frame.
   */
  update(dt = 1 / 60): void {
    const step = clamp(dt, 0, 0.1);
    this.#adoptExternalPose();

    const turn = 1 - Math.exp(-step / ROTATE_TAU_S);
    const zoom = 1 - Math.exp(-step / ZOOM_TAU_S);
    const slide = 1 - Math.exp(-step / TARGET_TAU_S);

    this.#azimuth += (this.#goalAzimuth - this.#azimuth) * turn;
    this.#polar += (this.#goalPolar - this.#polar) * turn;
    this.#distance += (this.#goalDistance - this.#distance) * zoom;
    this.target.lerp(this.#goalTarget, slide);

    this.#apply();
  }

  /**
   * Glide to look at `point`, optionally settling at `distance` metres from it.
   * The current viewing direction is kept, so this reads as stepping towards
   * the apparatus rather than teleporting.
   */
  focusOn(point: THREE.Vector3, distance?: number): void {
    this.#goalTarget.copy(point);
    this.#clampVector(this.#goalTarget);
    if (distance !== undefined) {
      this.#goalDistance = clamp(distance, MIN_DISTANCE_M, MAX_DISTANCE_M);
    }
  }

  /** Glide back to the standing view. */
  resetView(): void {
    this.#goalTarget.copy(SEAT_TARGET);
    this.#goalAzimuth = SEAT_AZIMUTH_RAD;
    this.#goalPolar = SEAT_POLAR_RAD;
    this.#goalDistance = SEAT_DISTANCE_M;
  }

  /** Nudge the view, for buttons and keyboard nudges. */
  nudge(azimuthRad: number, polarRad = 0, zoomFactor = 1): void {
    this.#goalAzimuth += azimuthRad;
    this.#goalPolar = clamp(this.#goalPolar + polarRad, MIN_POLAR_RAD, MAX_POLAR_RAD);
    this.#goalDistance = clamp(this.#goalDistance * zoomFactor, MIN_DISTANCE_M, MAX_DISTANCE_M);
  }

  dispose(): void {
    for (const dispose of this.#disposers) dispose();
    this.#disposers.length = 0;
    this.#pointers.clear();
  }

  // -------------------------------------------------------------------------
  // Pose bookkeeping
  // -------------------------------------------------------------------------

  /**
   * If anything wrote to the camera or the target since we last applied, take
   * those values as the new pose. Without this, a preset view or an
   * experiment's "square up" would be eased back to where we were.
   */
  #adoptExternalPose(): void {
    const movedExternally =
      !this.#hasApplied ||
      this.#camera.position.distanceToSquared(this.#lastPosition) > 1e-12 ||
      this.target.distanceToSquared(this.#lastTarget) > 1e-12;

    if (!movedExternally) return;

    this.#clampTarget();
    const offset = new THREE.Vector3().subVectors(this.#camera.position, this.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    this.#distance = clamp(offset.length(), MIN_DISTANCE_M, MAX_DISTANCE_M);
    this.#polar = clamp(spherical.phi, MIN_POLAR_RAD, MAX_POLAR_RAD);
    this.#azimuth = spherical.theta;

    this.#goalDistance = this.#distance;
    this.#goalPolar = this.#polar;
    this.#goalAzimuth = this.#azimuth;
    this.#goalTarget.copy(this.target);
  }

  #apply(): void {
    this.#clampTarget();

    const sinPolar = Math.sin(this.#polar);
    const offset = new THREE.Vector3(
      this.#distance * sinPolar * Math.sin(this.#azimuth),
      this.#distance * Math.cos(this.#polar),
      this.#distance * sinPolar * Math.cos(this.#azimuth),
    );

    this.#camera.position.copy(this.target).add(offset);
    this.#camera.lookAt(this.target);

    this.#lastPosition.copy(this.#camera.position);
    this.#lastTarget.copy(this.target);
    this.#hasApplied = true;
  }

  /** Keep the pivot on the bench, so we never orbit empty space. */
  #clampTarget(): void {
    this.#clampVector(this.target);
  }

  #clampVector(vector: THREE.Vector3): void {
    vector.x = clamp(vector.x, -(BENCH_HALF_WIDTH - TARGET_MARGIN_X_M), BENCH_HALF_WIDTH - TARGET_MARGIN_X_M);
    vector.z = clamp(vector.z, -(BENCH_HALF_DEPTH - TARGET_MARGIN_Z_M), BENCH_HALF_DEPTH - TARGET_MARGIN_Z_M);
    vector.y = clamp(vector.y, TARGET_MIN_Y_M, TARGET_MAX_Y_M);
  }

  // -------------------------------------------------------------------------
  // Gestures
  // -------------------------------------------------------------------------

  #onPointerDown = (event: PointerEvent): void => {
    if (!this.enabled) return;
    if (event.pointerType === 'mouse' && event.button > 2) return;

    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // Capture keeps the gesture alive if the pointer leaves the canvas. Not
    // every host (or a synthetic test event) has an active pointer to capture,
    // and failing to capture is harmless.
    try {
      this.#dom.setPointerCapture(event.pointerId);
    } catch {
      // ignore: the gesture still works while the pointer is over the canvas
    }

    if (this.#pointers.size === 1) {
      // Right button, middle button or Shift means "slide", like a map.
      const wantsPan =
        event.button === 1 || event.button === 2 || event.shiftKey || this.dragMode === 'pan';
      this.#mode = wantsPan ? 'pan' : 'rotate';
      this.#lastPointer = { x: event.clientX, y: event.clientY };
    } else if (this.#pointers.size === 2) {
      this.#mode = 'pinch';
      this.#pinchSpreadPx = this.#pointerSpread();
      this.#pinchMidpoint = this.#pointerMidpoint();
    }

    event.preventDefault();
  };

  #onPointerMove = (event: PointerEvent): void => {
    if (!this.#pointers.has(event.pointerId)) return;
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!this.enabled) return;

    if (this.#mode === 'pinch') {
      const spread = this.#pointerSpread();
      if (this.#pinchSpreadPx > 0 && spread > 0) {
        this.#goalDistance = clamp(
          this.#goalDistance * (this.#pinchSpreadPx / spread),
          MIN_DISTANCE_M,
          MAX_DISTANCE_M,
        );
      }
      this.#pinchSpreadPx = spread;

      // Two fingers also slide: whichever way the midpoint travels, the bench
      // travels with it, exactly like dragging a map.
      const midpoint = this.#pointerMidpoint();
      this.#pan(midpoint.x - this.#pinchMidpoint.x, midpoint.y - this.#pinchMidpoint.y);
      this.#pinchMidpoint = midpoint;
      return;
    }

    const dx = event.clientX - this.#lastPointer.x;
    const dy = event.clientY - this.#lastPointer.y;
    this.#lastPointer = { x: event.clientX, y: event.clientY };

    if (this.#mode === 'rotate') {
      // Drag right and the bench turns under your hand; drag down and you rise
      // to look down on it — the same convention as turning your head.
      this.#goalAzimuth -= dx * ROTATE_RAD_PER_PX;
      this.#goalPolar = clamp(this.#goalPolar - dy * ROTATE_RAD_PER_PX, MIN_POLAR_RAD, MAX_POLAR_RAD);
    } else if (this.#mode === 'pan') {
      this.#pan(dx, dy);
    }
  };

  #onPointerUp = (event: PointerEvent): void => {
    this.#pointers.delete(event.pointerId);
    try {
      if (this.#dom.hasPointerCapture(event.pointerId)) {
        this.#dom.releasePointerCapture(event.pointerId);
      }
    } catch {
      // ignore: capture was never taken
    }
    if (this.#pointers.size === 0) {
      this.#mode = 'none';
    } else if (this.#pointers.size === 1) {
      // Drop back to rotating with whichever finger is left.
      const [only] = [...this.#pointers.values()];
      this.#mode = 'rotate';
      this.#lastPointer = { x: only.x, y: only.y };
    }
  };

  #onWheel = (event: WheelEvent): void => {
    if (!this.enabled) return;
    event.preventDefault();

    const factor = Math.exp(clamp(event.deltaY, -240, 240) * ZOOM_PER_DELTA);
    const before = this.#goalDistance;
    const after = clamp(before * factor, MIN_DISTANCE_M, MAX_DISTANCE_M);
    if (after === before) return;

    // Keep the point under the cursor still: the pivot slides towards it as we
    // step in, which is what makes "point at the bob and scroll" feel right.
    const underCursor = this.#pointUnderCursor(event.clientX, event.clientY);
    if (underCursor) {
      const shift = 1 - after / before;
      this.#goalTarget.addScaledVector(
        new THREE.Vector3().subVectors(underCursor, this.#goalTarget),
        clamp(shift, -0.5, 0.5),
      );
      this.#clampVector(this.#goalTarget);
    }

    this.#goalDistance = after;
  };

  #onContextMenu = (event: MouseEvent): void => {
    // Right-drag is the pan gesture, so suppress the menu on the canvas.
    event.preventDefault();
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled || isTyping(event.target)) return;

    const turn = event.shiftKey ? 0.12 : 0.05;
    switch (event.key) {
      case 'ArrowLeft':
        this.#goalAzimuth += turn;
        break;
      case 'ArrowRight':
        this.#goalAzimuth -= turn;
        break;
      case 'ArrowUp':
        this.#goalPolar = clamp(this.#goalPolar - turn, MIN_POLAR_RAD, MAX_POLAR_RAD);
        break;
      case 'ArrowDown':
        this.#goalPolar = clamp(this.#goalPolar + turn, MIN_POLAR_RAD, MAX_POLAR_RAD);
        break;
      case '+':
      case '=':
      case 'PageUp':
        this.#goalDistance = clamp(this.#goalDistance * 0.88, MIN_DISTANCE_M, MAX_DISTANCE_M);
        break;
      case '-':
      case '_':
      case 'PageDown':
        this.#goalDistance = clamp(this.#goalDistance / 0.88, MIN_DISTANCE_M, MAX_DISTANCE_M);
        break;
      case 'Home':
        this.resetView();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /** Move the pivot across the bench plane under the pointer. */
  #pan(dx: number, dy: number): void {
    const scale = this.#distance * PAN_M_PER_PX;

    const right = new THREE.Vector3().setFromMatrixColumn(this.#camera.matrix, 0);
    right.y = 0;
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();

    const forward = new THREE.Vector3().subVectors(this.target, this.#camera.position);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();

    // The scene follows the hand: drag right and the bench slides right.
    this.#goalTarget.addScaledVector(right, -dx * scale);
    this.#goalTarget.addScaledVector(forward, dy * scale);
    this.#clampVector(this.#goalTarget);
  }

  /** Where the cursor's ray meets the horizontal plane through the pivot. */
  #pointUnderCursor(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.#dom.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;

    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    // The camera may have been eased since the last render, so make sure the
    // ray is cast from where it is now rather than from last frame's pose.
    this.#camera.updateMatrixWorld();
    this.#raycaster.setFromCamera(ndc, this.#camera);
    this.#plane.set(new THREE.Vector3(0, 1, 0), -this.target.y);

    const hit = new THREE.Vector3();
    if (!this.#raycaster.ray.intersectPlane(this.#plane, hit)) return null;

    // A near-level view can meet the bench plane miles away; ignore those.
    if (hit.distanceTo(this.target) > 2.5) return null;
    return hit;
  }

  #pointerSpread(): number {
    const points = [...this.#pointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  #pointerMidpoint(): { x: number; y: number } {
    const points = [...this.#pointers.values()];
    if (points.length === 0) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    for (const point of points) {
      x += point.x;
      y += point.y;
    }
    return { x: x / points.length, y: y / points.length };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** True when the key event came from a text field, so we leave it alone. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
