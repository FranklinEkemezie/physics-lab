/**
 * The model gallery.
 *
 * A browser for the reusable 3D library. It is deliberately a *separate
 * renderer* from the lab: the gallery must be able to show a Bohr atom while
 * a pendulum practical is still on the bench behind it, and it must not
 * disturb the experiment's scene.
 *
 * The "Place on bench" button is the proof of reuse: it builds the selected
 * model through the same public `ModelEntry` contract and hands the object to
 * the lab, where it becomes a normal draggable piece of apparatus.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  MODEL_CATEGORIES,
  MODEL_LIBRARY,
  modelsInCategory,
  type ModelCategoryId,
  type ModelDisplayOptions,
  type ModelEntry,
} from '@/engine/models/library';
import { button, h, slider, toggle } from '@/ui/widgets';

export interface ModelGalleryOptions {
  onClose?: () => void;
  /** Called with a fresh build when the user places the model on the bench. */
  onPlace?: (object: THREE.Object3D, entry: ModelEntry) => void;
}

/** A small standalone 3D preview with its own renderer and turntable. */
class ModelPreview {
  readonly root: HTMLElement;
  #renderer: THREE.WebGLRenderer;
  #scene = new THREE.Scene();
  #camera: THREE.PerspectiveCamera;
  #turntable = new THREE.Group();
  #platform: THREE.Mesh;
  #shadow: THREE.Mesh;
  #current: THREE.Object3D | null = null;
  #frameId = 0;
  #lastTime = 0;
  #spin = true;
  #yaw = 0.55;
  #pitch = 0.2;
  #distance = 0.7;
  #targetY = 0.1;
  #radius = 0.1;
  #dragging = false;
  #pointer = { x: 0, y: 0 };
  #resizeObserver: ResizeObserver;
  #environment: THREE.WebGLRenderTarget | null = null;

  constructor() {
    this.root = h('div', { class: 'pl-gallery__canvas' });

    this.#renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.#renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.#renderer.toneMappingExposure = 1.15;
    this.root.append(this.#renderer.domElement);

    // Metals need something to reflect: without an environment map, copper,
    // chrome and steel render almost black.
    const pmrem = new THREE.PMREMGenerator(this.#renderer);
    this.#environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.#scene.environment = this.#environment.texture;
    this.#scene.environmentIntensity = 0.7;
    pmrem.dispose();

    this.#camera = new THREE.PerspectiveCamera(38, 1, 0.005, 30);

    this.#scene.add(new THREE.HemisphereLight(0xd7e9ff, 0x141b24, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(0.7, 1.2, 0.8);
    this.#scene.add(key);
    const fill = new THREE.DirectionalLight(0x87b8ff, 0.8);
    fill.position.set(-0.9, 0.5, -0.7);
    this.#scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd9a0, 0.5);
    rim.position.set(0.2, 0.4, -1.2);
    this.#scene.add(rim);

    this.#scene.add(this.#turntable);

    this.#platform = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 64),
      new THREE.MeshStandardMaterial({ color: 0x131b24, roughness: 0.92, metalness: 0.05 }),
    );
    this.#platform.rotation.x = -Math.PI / 2;
    this.#platform.position.y = -0.0015;
    this.#scene.add(this.#platform);

    this.#shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: makeShadowTexture(),
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    );
    this.#shadow.rotation.x = -Math.PI / 2;
    this.#shadow.position.y = -0.0005;
    this.#scene.add(this.#shadow);

    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(this.root);
    this.#resize();

    this.#bindPointer();
    this.#lastTime = performance.now();
    this.#tick();
  }

  /** Replace the displayed model and frame it. */
  setModel(object: THREE.Object3D): void {
    if (this.#current) {
      this.#turntable.remove(this.#current);
      disposeGeometry(this.#current);
    }
    this.#current = object;
    this.#turntable.rotation.y = 0;
    this.#turntable.add(object);
    this.#frame(object);
  }

  setSpin(spin: boolean): void {
    this.#spin = spin;
  }

  resetView(): void {
    this.#yaw = 0.55;
    this.#pitch = 0.2;
    this.#turntable.rotation.y = 0;
    this.#updateCamera();
  }

  dispose(): void {
    cancelAnimationFrame(this.#frameId);
    this.#resizeObserver.disconnect();
    if (this.#current) disposeGeometry(this.#current);
    this.#environment?.dispose();
    this.#renderer.dispose();
    this.root.remove();
  }

  #tick = (): void => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.#lastTime) / 1000);
    this.#lastTime = now;

    if (this.#spin && !this.#dragging) this.#turntable.rotation.y += dt * 0.5;
    this.#current?.userData.update?.(dt);
    this.#renderer.render(this.#scene, this.#camera);
    this.#frameId = requestAnimationFrame(this.#tick);
  };

  #frame(object: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());

    object.position.x -= centre.x;
    object.position.z -= centre.z;
    object.position.y -= box.min.y;

    this.#radius = Math.max(0.035, size.length() * 0.5);
    this.#targetY = Math.max(0.04, size.y * 0.5);
    const fov = THREE.MathUtils.degToRad(this.#camera.fov);
    this.#distance = (this.#radius / Math.sin(fov / 2)) * 0.94;

    const floor = Math.max(this.#radius * 2.4, 0.22);
    this.#platform.scale.setScalar(floor);
    this.#shadow.scale.setScalar(floor * 0.82);
    this.#updateCamera();
  }

  #updateCamera(): void {
    const cosPitch = Math.cos(this.#pitch);
    this.#camera.position.set(
      Math.sin(this.#yaw) * cosPitch * this.#distance,
      this.#targetY + Math.sin(this.#pitch) * this.#distance,
      Math.cos(this.#yaw) * cosPitch * this.#distance,
    );
    this.#camera.lookAt(0, this.#targetY, 0);
  }

  #resize(): void {
    const width = Math.max(240, this.root.clientWidth);
    const height = Math.max(200, this.root.clientHeight);
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
  }

  #bindPointer(): void {
    const canvas = this.#renderer.domElement;
    canvas.addEventListener('pointerdown', (event) => {
      this.#dragging = true;
      this.#pointer = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!this.#dragging) return;
      const dx = event.clientX - this.#pointer.x;
      const dy = event.clientY - this.#pointer.y;
      this.#pointer = { x: event.clientX, y: event.clientY };
      this.#yaw -= dx * 0.006;
      this.#pitch = THREE.MathUtils.clamp(this.#pitch + dy * 0.004, 0.03, 1.15);
      this.#updateCamera();
    });
    const end = (event: PointerEvent): void => {
      this.#dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }
}

/** A soft radial blob used as a contact shadow under the model. */
function makeShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.24)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

/** Free GPU memory held by a model's geometry. Materials are shared/memoised. */
function disposeGeometry(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.Line ||
      child instanceof THREE.Points
    ) {
      child.geometry?.dispose();
    }
  });
}

export class ModelGallery {
  #options: ModelGalleryOptions;
  #root: HTMLElement;
  #preview: ModelPreview;
  #shelves: HTMLElement | null = null;
  #list: HTMLElement | null = null;
  #info: HTMLElement | null = null;
  #category: ModelCategoryId = 'people';
  #selected: ModelEntry;
  #scale = 1;
  #accent: string | undefined;
  #labels = true;
  #spin = true;
  #keyHandler: (event: KeyboardEvent) => void;

  constructor(options: ModelGalleryOptions = {}) {
    this.#options = options;
    this.#selected = modelsInCategory('people')[0] ?? MODEL_LIBRARY[0];
    this.#preview = new ModelPreview();
    this.#root = this.#build();

    this.#keyHandler = (event) => {
      if (event.key === 'Escape') this.dispose();
    };
    window.addEventListener('keydown', this.#keyHandler);
  }

  open(): void {
    document.body.append(this.#root);
    // Let the dialog lay out before framing the first model.
    requestAnimationFrame(() => this.#show(this.#selected));
  }

  dispose(): void {
    window.removeEventListener('keydown', this.#keyHandler);
    this.#preview.dispose();
    this.#root.remove();
    this.#options.onClose?.();
  }

  #build(): HTMLElement {
    const closeButton = button({
      label: 'Close',
      variant: 'ghost',
      onClick: () => this.dispose(),
    });

    this.#shelves = h('nav', { class: 'pl-gallery__shelves', 'aria-label': 'Model categories' });
    this.#list = h('div', { class: 'pl-gallery__models' });
    this.#info = h('div', { class: 'pl-gallery__info' });

    const options = h(
      'div',
      { class: 'pl-gallery__options' },
      slider({
        label: 'Scale',
        min: 0.5,
        max: 2,
        step: 0.05,
        value: this.#scale,
        decimals: 2,
        unit: '×',
        hint: '1× is real-world size in metres.',
        onInput: (value) => {
          this.#scale = value;
          this.#show(this.#selected);
        },
      }).root,
      h(
        'label',
        { class: 'pl-field' },
        h('span', { class: 'pl-field__label' }, 'Accent'),
        h('input', {
          class: 'pl-gallery__colour',
          type: 'color',
          value: this.#accent ?? '#5aa9e6',
          onInput: (event: Event) => {
            this.#accent = (event.target as HTMLInputElement).value;
            this.#show(this.#selected);
          },
        }),
      ),
      toggle({
        label: 'Spin',
        value: this.#spin,
        onChange: (value) => {
          this.#spin = value;
          this.#preview.setSpin(value);
        },
      }).root,
      toggle({
        label: 'Labels',
        value: this.#labels,
        onChange: (value) => {
          this.#labels = value;
          this.#show(this.#selected);
        },
      }).root,
    );

    const stage = h(
      'section',
      { class: 'pl-gallery__stage' },
      this.#preview.root,
      this.#info,
      options,
      button({
        label: 'Place on bench',
        glyph: '🧰',
        variant: 'primary',
        title: 'Add this model to the lab as draggable apparatus',
        onClick: () => this.#placeOnBench(),
      }).root,
    );

    const card = h(
      'div',
      { class: 'pl-modal__card pl-gallery' },
      h(
        'header',
        { class: 'pl-gallery__head' },
        h(
          'div',
          {},
          h('h2', { class: 'pl-gallery__title' }, '3D model library'),
          h(
            'p',
            { class: 'pl-gallery__subtitle' },
            'People, atoms, states of matter, circuit symbols and apparatus — all procedural, all reusable.',
          ),
        ),
        closeButton.root,
      ),
      h('div', { class: 'pl-gallery__body' }, this.#shelves, this.#list, stage),
    );

    const root = h(
      'div',
      { class: 'pl-modal' },
      h('div', { class: 'pl-modal__backdrop', onClick: () => this.dispose() }),
      card,
    );

    this.#renderShelves();
    return root;
  }

  #renderShelves(): void {
    const shelves = this.#shelves;
    if (!shelves) return;
    shelves.replaceChildren();

    for (const category of MODEL_CATEGORIES) {
      const shelf = h(
        'button',
        {
          class: `pl-gallery__shelf${category.id === this.#category ? ' is-active' : ''}`,
          type: 'button',
          title: category.blurb,
        },
        h('span', { class: 'pl-gallery__glyph' }, category.glyph),
        h('span', { class: 'pl-gallery__shelf-label' }, category.label),
      );
      shelf.addEventListener('click', () => {
        this.#category = category.id;
        this.#renderShelves();
        this.#renderList();
      });
      shelves.append(shelf);
    }

    this.#renderList();
  }

  #renderList(): void {
    const list = this.#list;
    if (!list) return;
    list.replaceChildren();

    const entries = modelsInCategory(this.#category);
    if (entries.length === 0) {
      list.append(h('p', { class: 'pl-prose' }, 'Nothing on this shelf yet.'));
      return;
    }

    for (const entry of entries) {
      const chip = h(
        'button',
        {
          class: `pl-gallery__model${entry.id === this.#selected.id ? ' is-active' : ''}`,
          type: 'button',
        },
        h('span', { class: 'pl-gallery__model-name' }, entry.label),
        h('span', { class: 'pl-gallery__model-summary' }, entry.summary),
      );
      chip.addEventListener('click', () => this.#select(entry));
      list.append(chip);
    }

    // If the shelf changed, select its first model so the stage is never blank.
    if (!entries.some((entry) => entry.id === this.#selected.id)) {
      this.#select(entries[0]);
    }
  }

  #select(entry: ModelEntry): void {
    this.#selected = entry;
    this.#renderList();
    this.#show(entry);
  }

  #displayOptions(): ModelDisplayOptions {
    return {
      scale: this.#scale,
      accent: this.#accent,
      labels: this.#labels,
    };
  }

  #show(entry: ModelEntry): void {
    const object = entry.build(this.#displayOptions());
    this.#preview.setModel(object);

    const info = this.#info;
    if (info) {
      info.replaceChildren(
        h('h3', { class: 'pl-gallery__model-title' }, entry.label),
        h('p', { class: 'pl-prose' }, entry.summary),
        ...(entry.facts ?? []).map((fact) => h('p', { class: 'pl-gallery__fact' }, `• ${fact}`)),
      );
    }
  }

  #placeOnBench(): void {
    if (!this.#options.onPlace) return;
    const object = this.#selected.build(this.#displayOptions());
    this.#options.onPlace(object, this.#selected);
    this.dispose();
  }
}
