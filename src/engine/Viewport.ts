/**
 * The rendering viewport: renderer, scene, camera, controls and the frame loop.
 *
 * This is the only place in the app that talks to WebGL. Everything else
 * registers an "updater" callback and receives `(dt, elapsed)` once per frame.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type FrameUpdater = (dt: number, elapsed: number, camera: THREE.PerspectiveCamera) => void;

export interface ViewportOptions {
  /** Cap on devicePixelRatio; 2 keeps retina crisp without melting laptops. */
  maxPixelRatio?: number;
  /** Initial camera target. */
  target?: THREE.Vector3;
}

export class Viewport {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  /** Objects the UI should not pick/select (helpers, gizmos...). */
  readonly helpers = new THREE.Group();

  #updaters = new Set<FrameUpdater>();
  #clock = new THREE.Clock();
  #elapsed = 0;
  #resizeObserver: ResizeObserver | null = null;
  #disposed = false;
  #environmentTarget: THREE.WebGLRenderTarget | null = null;

  constructor(container: HTMLElement, options: ViewportOptions = {}) {
    const { maxPixelRatio = 2, target = new THREE.Vector3(0, 1.15, 0) } = options;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f1115);
    this.scene.fog = new THREE.Fog(0x0f1115, 14, 34);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 120);
    this.camera.position.set(1.9, 1.75, 2.35);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.minDistance = 0.35;
    this.controls.maxDistance = 12;
    this.controls.maxPolarAngle = Math.PI * 0.495; // never dive below the bench
    this.controls.minPolarAngle = 0.15;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.7;
    this.controls.update();

    this.scene.add(this.helpers);

    // Image-based lighting: a neutral studio room gives metals something to
    // reflect. Generated procedurally, so still no binary assets.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.#environmentTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.#environmentTarget.texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.#observeResize(container);
    this.#applySize(container);
  }

  /** Register a per-frame callback. Returns an unsubscribe function. */
  addUpdater(updater: FrameUpdater): () => void {
    this.#updaters.add(updater);
    return () => this.#updaters.delete(updater);
  }

  /** Seconds of simulated wall-clock time since the viewport started. */
  get elapsed(): number {
    return this.#elapsed;
  }

  /** Start the render loop. */
  start(): void {
    if (this.#disposed) return;
    this.#clock.start();
    this.renderer.setAnimationLoop(() => this.#tick());
  }

  /** Pause the render loop. */
  stop(): void {
    this.renderer.setAnimationLoop(null);
  }

  #tick(): void {
    // Clamp dt so tab-switching doesn't teleport the physics.
    const dt = Math.min(this.#clock.getDelta(), 0.05);
    this.#elapsed += dt;

    for (const updater of this.#updaters) updater(dt, this.#elapsed, this.camera);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Smoothly move the orbit target towards `point` and pull the camera to a
   * comfortable distance. Used by "focus on apparatus" buttons.
   */
  focusOn(point: THREE.Vector3, distance?: number): void {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const currentDistance = offset.length();
    const wanted = distance ?? Math.min(Math.max(currentDistance, 0.8), 4);

    this.controls.target.copy(point);
    this.camera.position.copy(point).add(offset.setLength(wanted));
    this.controls.update();
  }

  /** Convert a world position into CSS pixel coordinates inside the canvas. */
  projectToScreen(point: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const projected = point.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: (projected.x * 0.5 + 0.5) * rect.width,
      y: (-projected.y * 0.5 + 0.5) * rect.height,
      visible: projected.z < 1,
    };
  }

  /** Map a pointer event in the canvas to a normalised device coordinate. */
  toNdc(event: { clientX: number; clientY: number }): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  #observeResize(container: HTMLElement): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver = new ResizeObserver(() => this.#applySize(container));
      this.#resizeObserver.observe(container);
    }
    window.addEventListener('resize', this.#onWindowResize);
  }

  #onWindowResize = (): void => {
    const parent = this.renderer.domElement.parentElement;
    if (parent) this.#applySize(parent);
  };

  #applySize(container: HTMLElement): void {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /** Tear down GPU resources. */
  dispose(): void {
    this.#disposed = true;
    this.stop();
    this.#resizeObserver?.disconnect();
    window.removeEventListener('resize', this.#onWindowResize);
    this.controls.dispose();
    this.#environmentTarget?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
