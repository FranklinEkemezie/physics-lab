/**
 * The Lab: everything that lives on the bench.
 *
 * Responsibilities:
 *  - spawn/remove apparatus from the catalogue,
 *  - keep a registry of placed objects,
 *  - handle picking (raycasting), selection highlighting and dragging,
 *  - dispatch per-frame `update` hooks that models attach to `userData`.
 *
 * It deliberately knows *nothing* about physics or experiments. Those are
 * separate layers that talk to the Lab through events.
 */

import * as THREE from 'three';
import { EventBus } from '@/core/EventBus';
import { assert } from '@/core/assert';
import type { DragEvent, PlacedObject } from './types';
import { getEquipment } from './catalog';
import { BENCH_HEIGHT, BENCH_HALF_WIDTH, BENCH_HALF_DEPTH } from '@/engine/LabRoom';
import type { Viewport } from '@/engine/Viewport';

export interface LabEvents {
  'object:spawned': PlacedObject;
  'object:removed': { instanceId: string };
  'object:selected': { instanceId: string | null; object: THREE.Object3D | null };
  'object:dragStart': DragEvent;
  'object:dragged': DragEvent;
  'object:dragEnd': DragEvent;
  'object:clicked': {
    instanceId: string;
    object: THREE.Object3D;
    /** Name of the specific sub-mesh that was hit, if any. */
    part: string | null;
    point: THREE.Vector3;
  };
  'lab:cleared': Record<string, never>;
}

export interface SpawnOptions {
  /** World position. Defaults to the next free bench slot. */
  position?: THREE.Vector3;
  /** Rotation about Y in radians. */
  rotationY?: number;
  /** Uniform or non-uniform scale. */
  scale?: number | THREE.Vector3;
  /** Skip adding to the auto-placement bookkeeping. */
  manualPlacement?: boolean;
}

/** How a placed object responds to being dragged. */
export type DragMode = 'bench' | 'vertical' | 'custom' | 'none';

interface DragState {
  instanceId: string;
  object: THREE.Object3D;
  mode: DragMode;
  /** Offset between the hit point and the object's origin, in world space. */
  grabOffset: THREE.Vector3;
  /** A plane through the object, facing the camera, for screen-space drags. */
  plane: THREE.Plane;
  pointerId: number;
  moved: boolean;
  startClient: { x: number; y: number };
  startPosition: THREE.Vector3;
  /** Last pointer/plane intersection, for `custom` drags. */
  pointerPoint: THREE.Vector3;
}

const CLICK_PIXEL_TOLERANCE = 5;

export class Lab {
  readonly bus = new EventBus<LabEvents>();
  readonly root = new THREE.Group();

  #viewport: Viewport;
  #objects = new Map<string, PlacedObject>();
  #counters = new Map<string, number>();
  #selection: string | null = null;
  #selectionBox: THREE.BoxHelper;
  #raycaster = new THREE.Raycaster();
  #drag: DragState | null = null;
  #disposers: (() => void)[] = [];

  constructor(viewport: Viewport) {
    this.#viewport = viewport;
    this.root.name = 'LabObjects';
    viewport.scene.add(this.root);

    this.#selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0x62d0ff);
    this.#selectionBox.visible = false;
    this.#selectionBox.name = 'SelectionHighlight';
    (this.#selectionBox.material as THREE.LineBasicMaterial).depthTest = false;
    (this.#selectionBox.material as THREE.LineBasicMaterial).transparent = true;
    (this.#selectionBox.material as THREE.LineBasicMaterial).opacity = 0.9;
    this.#selectionBox.renderOrder = 999;
    viewport.helpers.add(this.#selectionBox);

    this.#bindPointer();
  }

  // -------------------------------------------------------------------------
  // Placement
  // -------------------------------------------------------------------------

  /** Spawn a catalogue item onto the bench. */
  spawn(definitionId: string, options: SpawnOptions = {}): PlacedObject {
    const definition = getEquipment(definitionId);
    const object = definition.build();
    const instanceId = this.#nextInstanceId(definitionId);

    object.userData.labInstanceId = instanceId;
    object.userData.definitionId = definitionId;
    object.userData.dragMode ??= definition.dragMode ?? 'bench';

    const position = options.position ?? this.#findFreeSlot(definition.footprintM ?? 0.06);
    object.position.copy(position);
    object.position.y = Math.max(object.position.y, BENCH_HEIGHT);
    if (options.rotationY !== undefined) object.rotation.y = options.rotationY;
    if (options.scale !== undefined) {
      if (typeof options.scale === 'number') object.scale.setScalar(options.scale);
      else object.scale.copy(options.scale);
    }

    this.root.add(object);
    const placed: PlacedObject = { instanceId, definitionId, object };
    this.#objects.set(instanceId, placed);
    object.traverse((child) => {
      child.userData.labInstanceId = instanceId;
    });

    this.bus.emit('object:spawned', placed);
    return placed;
  }

  /**
   * Adopt an externally built object as a lab item.
   *
   * The model library builds plain Three.js objects that know nothing about the
   * catalogue. `adopt` gives one a lab identity so it can be picked, dragged
   * and disposed like any other piece of apparatus.
   */
  adopt(
    object: THREE.Object3D,
    options: SpawnOptions & { definitionId?: string } = {},
  ): PlacedObject {
    const definitionId = options.definitionId ?? 'external-model';
    const instanceId = this.#nextInstanceId(definitionId);

    object.userData.labInstanceId = instanceId;
    object.userData.definitionId = definitionId;
    object.userData.dragMode ??= 'bench';

    const position = options.position ?? this.#findFreeSlot(0.1);
    object.position.copy(position);
    object.position.y = Math.max(object.position.y, BENCH_HEIGHT);
    if (options.rotationY !== undefined) object.rotation.y = options.rotationY;
    if (options.scale !== undefined) {
      if (typeof options.scale === 'number') object.scale.setScalar(options.scale);
      else object.scale.copy(options.scale);
    }

    this.root.add(object);
    const placed: PlacedObject = { instanceId, definitionId, object };
    this.#objects.set(instanceId, placed);
    object.traverse((child) => {
      child.userData.labInstanceId = instanceId;
    });

    this.bus.emit('object:spawned', placed);
    return placed;
  }

  /** Remove a single placed object. */
  remove(instanceId: string): void {
    const placed = this.#objects.get(instanceId);
    if (!placed) return;
    if (this.#selection === instanceId) this.select(null);
    placed.object.removeFromParent();
    disposeTree(placed.object);
    this.#objects.delete(instanceId);
    this.bus.emit('object:removed', { instanceId });
  }

  /** Remove every placed object (used by "reset bench"). */
  clear(): void {
    for (const instanceId of [...this.#objects.keys()]) this.remove(instanceId);
    this.#counters.clear();
    this.bus.emit('lab:cleared', {});
  }

  /** Remove everything whose definition id is in the list. */
  removeByDefinition(definitionIds: readonly string[]): void {
    const wanted = new Set(definitionIds);
    for (const [instanceId, placed] of [...this.#objects]) {
      if (wanted.has(placed.definitionId)) this.remove(instanceId);
    }
  }

  get(instanceId: string): PlacedObject | undefined {
    return this.#objects.get(instanceId);
  }

  /** Find the first placed object built from a given definition id. */
  find(definitionId: string): PlacedObject | undefined {
    for (const placed of this.#objects.values()) {
      if (placed.definitionId === definitionId) return placed;
    }
    return undefined;
  }

  /** Find every placed object built from a definition id. */
  findAll(definitionId: string): PlacedObject[] {
    return [...this.#objects.values()].filter((placed) => placed.definitionId === definitionId);
  }

  all(): PlacedObject[] {
    return [...this.#objects.values()];
  }

  get count(): number {
    return this.#objects.size;
  }

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  get selectedId(): string | null {
    return this.#selection;
  }

  select(instanceId: string | null): void {
    if (instanceId !== null && !this.#objects.has(instanceId)) return;
    this.#selection = instanceId;
    const object = instanceId ? (this.#objects.get(instanceId)?.object ?? null) : null;

    if (object) {
      this.#selectionBox.setFromObject(object);
      this.#selectionBox.visible = true;
      this.#selectionBox.update();
    } else {
      this.#selectionBox.visible = false;
    }
    this.bus.emit('object:selected', { instanceId, object });
  }

  // -------------------------------------------------------------------------
  // Frame loop
  // -------------------------------------------------------------------------

  /** Called once per frame by the app shell. */
  update(dt: number): void {
    for (const placed of this.#objects.values()) {
      const update = placed.object.userData.update as ((dt: number) => void) | undefined;
      update?.(dt);
    }
    if (this.#selectionBox.visible && this.#selection) {
      const object = this.#objects.get(this.#selection)?.object;
      if (object) this.#selectionBox.setFromObject(object);
    }
  }

  // -------------------------------------------------------------------------
  // Picking and dragging
  // -------------------------------------------------------------------------

  #bindPointer(): void {
    const element = this.#viewport.renderer.domElement;

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const ndc = this.#viewport.toNdc(event);
      this.#raycaster.setFromCamera(ndc, this.#viewport.camera);
      const hits = this.#raycaster.intersectObjects(this.root.children, true);
      const hit = hits.find((candidate) => candidate.object.visible);

      if (!hit) {
        this.select(null);
        return;
      }

      const instanceId = hit.object.userData.labInstanceId as string | undefined;
      if (!instanceId) return;
      const placed = this.#objects.get(instanceId);
      if (!placed) return;

      // Clicking a small part of apparatus selects its whole assembly.
      this.select(instanceId);
      this.bus.emit('object:clicked', {
        instanceId,
        object: placed.object,
        part: hit.object.name || null,
        point: hit.point.clone(),
      });

      const mode = (hit.object.userData.dragMode ?? placed.object.userData.dragMode ?? 'bench') as DragMode;
      if (mode === 'none') return;

      // Work out the drag plane: either the bench top, a vertical plane facing
      // the camera (height adjustments), or a plane chosen by the experiment.
      const cameraDirection = new THREE.Vector3();
      this.#viewport.camera.getWorldDirection(cameraDirection);
      const customPlane = placed.object.userData.dragPlane as
        | { normal: THREE.Vector3; point: THREE.Vector3 }
        | undefined;
      const plane =
        mode === 'bench'
          ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -placed.object.position.y)
          : mode === 'custom' && customPlane
            ? new THREE.Plane().setFromNormalAndCoplanarPoint(customPlane.normal, customPlane.point)
            : new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDirection, placed.object.position);

      const grabPoint = new THREE.Vector3();
      this.#raycaster.ray.intersectPlane(plane, grabPoint);

      this.#drag = {
        instanceId,
        object: placed.object,
        mode,
        grabOffset: new THREE.Vector3().subVectors(placed.object.position, grabPoint),
        plane,
        pointerId: event.pointerId,
        moved: false,
        startClient: { x: event.clientX, y: event.clientY },
        startPosition: placed.object.position.clone(),
        pointerPoint: grabPoint.clone(),
      };
      this.#viewport.controls.enabled = false;
      element.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent): void => {
      const drag = this.#drag;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (
        Math.abs(event.clientX - drag.startClient.x) > CLICK_PIXEL_TOLERANCE ||
        Math.abs(event.clientY - drag.startClient.y) > CLICK_PIXEL_TOLERANCE
      ) {
        drag.moved = true;
      }

      const ndc = this.#viewport.toNdc(event);
      this.#raycaster.setFromCamera(ndc, this.#viewport.camera);
      const point = new THREE.Vector3();
      if (!this.#raycaster.ray.intersectPlane(drag.plane, point)) return;
      drag.pointerPoint.copy(point);

      if (drag.mode === 'custom') {
        if (!drag.moved) this.bus.emit('object:dragStart', this.#dragPayload(drag, true));
        this.bus.emit('object:dragged', this.#dragPayload(drag, true));
        return;
      }

      point.add(drag.grabOffset);

      const next = drag.startPosition.clone();
      if (drag.mode === 'bench') {
        next.x = THREE.MathUtils.clamp(point.x, -BENCH_HALF_WIDTH + 0.05, BENCH_HALF_WIDTH - 0.05);
        next.z = THREE.MathUtils.clamp(point.z, -BENCH_HALF_DEPTH + 0.05, BENCH_HALF_DEPTH - 0.05);
        next.y = drag.startPosition.y;
      } else {
        next.y = point.y;
      }

      drag.object.position.copy(next);
      if (!drag.moved) this.bus.emit('object:dragStart', this.#dragPayload(drag, true));
      this.bus.emit('object:dragged', this.#dragPayload(drag, true));
    };

    const onPointerUp = (event: PointerEvent): void => {
      const drag = this.#drag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.moved) this.bus.emit('object:dragEnd', this.#dragPayload(drag, false));
      this.#drag = null;
      this.#viewport.controls.enabled = true;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };

    // Double-click focuses the camera on whatever was hit.
    const onDoubleClick = (event: MouseEvent): void => {
      const ndc = this.#viewport.toNdc(event);
      this.#raycaster.setFromCamera(ndc, this.#viewport.camera);
      const hits = this.#raycaster.intersectObjects(this.root.children, true);
      if (hits.length === 0) return;
      const box = new THREE.Box3().setFromObject(hits[0].object);
      const centre = box.getCenter(new THREE.Vector3());
      this.#viewport.focusOn(centre, Math.max(0.5, box.getSize(new THREE.Vector3()).length() * 1.8));
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
    element.addEventListener('dblclick', onDoubleClick);

    this.#disposers.push(() => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
      element.removeEventListener('dblclick', onDoubleClick);
    });
  }

  #dragPayload(drag: DragState, active: boolean): DragEvent {
    return {
      instanceId: drag.instanceId,
      object: drag.object,
      position: drag.object.position.clone(),
      pointerPoint: drag.pointerPoint.clone(),
      active,
    };
  }

  // -------------------------------------------------------------------------
  // Auto-placement
  // -------------------------------------------------------------------------

  /**
   * Benches fill up in a predictable spiral so spawning six items in a row
   * does not pile them all in the same spot.
   */
  #findFreeSlot(footprintM: number): THREE.Vector3 {
    const spacing = Math.max(0.12, footprintM * 2.4);
    const columns = Math.floor((BENCH_HALF_WIDTH * 2 - 0.2) / spacing);
    const rows = Math.floor((BENCH_HALF_DEPTH * 2 - 0.2) / spacing);

    for (let row = 0; row < Math.max(1, rows); row += 1) {
      for (let column = 0; column < Math.max(1, columns); column += 1) {
        const x = -BENCH_HALF_WIDTH + 0.12 + spacing * (column + 0.5);
        const z = -BENCH_HALF_DEPTH + 0.12 + spacing * (row + 0.5);
        const candidate = new THREE.Vector3(x, BENCH_HEIGHT, z);
        const clash = [...this.#objects.values()].some(
          (placed) => placed.object.position.distanceTo(candidate) < spacing * 0.85,
        );
        if (!clash) return candidate;
      }
    }
    // Bench is full: drop it in the middle and let the student move it.
    return new THREE.Vector3(0, BENCH_HEIGHT, 0);
  }

  #nextInstanceId(definitionId: string): string {
    const next = (this.#counters.get(definitionId) ?? 0) + 1;
    this.#counters.set(definitionId, next);
    return `${definitionId}#${next}`;
  }

  dispose(): void {
    for (const dispose of this.#disposers) dispose();
    this.#disposers = [];
    this.clear();
    this.#selectionBox.removeFromParent();
    this.#selectionBox.geometry.dispose();
    (this.#selectionBox.material as THREE.Material).dispose();
    this.root.removeFromParent();
  }
}

/** Recursively dispose geometries created for a removed object. */
function disposeTree(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      // Materials are shared/memoised, except clones we created per-object.
      if (child.userData.ownsMaterial) (child.material as THREE.Material)?.dispose();
    }
    if (child instanceof THREE.Line) child.geometry?.dispose();
  });
}

/** Guard used by the app shell to fail loudly on impossible states. */
export function assertPlaced(placed: PlacedObject | undefined): PlacedObject {
  assert(placed, 'Expected a placed object but found none');
  return placed;
}
