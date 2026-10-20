/**
 * The application shell.
 *
 * Owns the layout, the services every experiment receives, and the wiring
 * between the 3D bench, the equipment sidebar and the tabbed panel. It is the
 * only place that knows about *all* the parts; everything else is pluggable.
 */

import { EventBus } from '@/core/EventBus';
import { Rng } from '@/core/math';
import * as THREE from 'three';
import { Viewport } from '@/engine/Viewport';
import { LabRoom, BENCH_HEIGHT } from '@/engine/LabRoom';
import { Lab } from '@/lab/Lab';
import type { EquipmentDefinition } from '@/lab/types';
import { LabClock } from '@/core/sim/LabClock';
import { DataStore } from '@/app/DataStore';
import { EXPERIMENTS, findExperiment } from '@/experiments/registry';
import type { ExperimentInfo } from '@/experiments/registry';
import type { AppEvents, Experiment, ExperimentStatus, LabServices } from '@/experiments/types';
import { Sidebar } from '@/ui/Sidebar';
import { RightPanel } from '@/ui/RightPanel';
import { ToastHost } from '@/ui/Toast';
import { button, h, segmented } from '@/ui/widgets';
import type { ButtonWidget, SegmentedWidget } from '@/ui/widgets';
import { downloadTextFile } from '@/core/dom';
import { ModelGallery } from './ModelGallery';

/** Remembers whether the camera toolbar was folded away. */
const VIEWTOOLS_STORAGE_KEY = 'physics-lab.viewtools.collapsed';

export class App {
  #viewport: Viewport;
  #room: LabRoom;
  #lab: Lab;
  #clock = new LabClock({ fixedStep: 1 / 480, timeScale: 1 });
  #data: DataStore;
  #rng = new Rng(20261018);
  #sidebar: Sidebar;
  #panel: RightPanel;
  #toasts: ToastHost;
  #experiment: Experiment | null = null;
  #experimentInfo: ExperimentInfo | null = null;
  #services: LabServices;
  #bus: EventBus<AppEvents>;
  #chipHost: HTMLElement;
  #coachBar: HTMLElement;
  #statusState: HTMLElement;
  #panelRefreshQueued = false;
  #revealed = false;

  constructor(container: HTMLElement) {
    // --- 3D world ---------------------------------------------------------
    const stage = h('div', { class: 'pl-stage__canvas' });
    this.#viewport = new Viewport(stage);
    this.#room = new LabRoom({ shadows: true });
    this.#viewport.scene.add(this.#room.root);
    this.#lab = new Lab(this.#viewport);

    // The shell's own event bus is the typed one from experiments/types.
    this.#bus = new EventBus<AppEvents>();
    const appBus = this.#bus;
    this.#data = new DataStore(appBus);
    this.#toasts = new ToastHost();

    this.#services = {
      lab: this.#lab,
      viewport: this.#viewport,
      room: this.#room,
      clock: this.#clock,
      rng: this.#rng,
      bus: appBus,
      data: this.#data,
      requestPanelRefresh: () => this.#queuePanelRefresh(),
    };

    // --- Layout -----------------------------------------------------------
    this.#chipHost = h('div', { class: 'pl-hud__chips' });
    this.#coachBar = h('div', { class: 'pl-coach' }, 'Welcome to the lab. Choose a practical, or pick apparatus from the store.');
    this.#statusState = h('span', { class: 'pl-hud__state' }, 'ready');

    const hud = h(
      'div',
      { class: 'pl-hud' },
      h('div', { class: 'pl-hud__row' }, this.#statusState, this.#chipHost),
      this.#coachBar,
    );

    const viewportTools = this.#buildViewportToolbar();

    // One-time camera hint. The bench controls are a gesture set, so name the
    // gestures once and then fade out (the fade is pure CSS).
    const cameraHint = h(
      'div',
      { class: 'pl-camhint', 'aria-hidden': 'true' },
      h('span', {}, 'Drag to look around'),
      h('span', {}, 'Scroll to step in'),
      h('span', {}, 'Shift-drag to slide'),
      h('span', {}, 'Double-click apparatus to inspect'),
    );

    stage.append(hud, viewportTools, cameraHint);

    this.#sidebar = new Sidebar({
      onAdd: (definition) => this.#addEquipment(definition),
      onAddAndFocus: (definition) => {
        const placed = this.#addEquipment(definition);
        this.#viewport.focusOn(placed.object.position.clone().setY(BENCH_HEIGHT + 0.15), 0.85);
      },
      onClearBench: () => this.#clearBench(),
    });

    this.#panel = new RightPanel({
      onClearData: () => {
        this.#data.clear();
        appBus.emit('toast', { message: 'Reading table cleared.', level: 'info' });
      },
      onExportCsv: () => this.#exportCsv(),
      onAxesChange: (x, y) => {
        this.#data.setAxes(x, y);
      },
      onRemoveRow: (rowId) => this.#data.removeRow(rowId),
      onRefreshPanel: () => this.#queuePanelRefresh(),
      onReveal: () => this.#reveal(),
    });

    const topbar = this.#buildTopbar();

    container.append(
      h(
        'div',
        { class: 'pl-app' },
        topbar,
        h('div', { class: 'pl-main' }, this.#sidebar.root, h('main', { class: 'pl-stage' }, stage), this.#panel.root),
      ),
      this.#toasts.root,
    );

    this.#bindBus(appBus);
    this.#bindLabEvents();
    this.#startExperiment(findExperiment('simple-pendulum') ?? null);

    // --- Frame loop -------------------------------------------------------
    this.#viewport.addUpdater((dt) => {
      this.#lab.update(dt);
      this.#experiment?.update(dt, this.#services);
    });
    this.#viewport.start();

    // Give the layout a frame before measuring canvases.
    requestAnimationFrame(() => this.#panel.graph.resize());
  }

  // -------------------------------------------------------------------------
  // Chrome
  // -------------------------------------------------------------------------

  #buildTopbar(): HTMLElement {
    const select = h('select', { class: 'pl-topbar__select', 'aria-label': 'Choose a practical' }) as HTMLSelectElement;

    const ready = h('optgroup', { label: 'Ready to run' });
    for (const info of EXPERIMENTS.filter((candidate) => candidate.available)) {
      ready.append(h('option', { value: info.id }, info.title));
    }
    const planned = h('optgroup', { label: 'In progress' });
    for (const info of EXPERIMENTS.filter((candidate) => !candidate.available)) {
      planned.append(h('option', { value: info.id, disabled: true }, `${info.title} — coming soon`));
    }
    select.append(h('option', { value: 'free-play' }, '🧪 Free play — assemble anything'), ready, planned);
    select.value = 'simple-pendulum';

    select.addEventListener('change', () => {
      if (select.value === 'free-play') this.#startFreePlay();
      else this.#startExperiment(findExperiment(select.value) ?? null);
    });

    const actions = h('div', { class: 'pl-topbar__actions' });
    actions.append(
      button({
        label: 'Restart practical',
        glyph: '↻',
        title: 'Rebuild the apparatus and start again',
        onClick: () => this.#restartExperiment(),
      }).root,
      button({
        label: 'Clear bench',
        glyph: '🧹',
        title: 'Remove every object from the bench',
        onClick: () => this.#clearBench(),
      }).root,
      button({
        label: 'Models',
        glyph: '🧊',
        title: 'Browse the reusable 3D model library',
        onClick: () => this.#openModelGallery(),
      }).root,
      button({
        label: 'Help',
        glyph: '❔',
        title: 'How to use the lab',
        onClick: () => this.#showHelp(),
      }).root,
    );

    return h(
      'header',
      { class: 'pl-topbar' },
      h(
        'div',
        { class: 'pl-topbar__brand' },
        h('span', { class: 'pl-topbar__logo' }, '⚗️'),
        h(
          'div',
          { class: 'pl-topbar__titles' },
          h('span', { class: 'pl-topbar__name' }, 'Virtual Physics Lab'),
          h('span', { class: 'pl-topbar__tagline' }, 'WAEC-style practicals, real physics'),
        ),
      ),
      h('div', { class: 'pl-topbar__menu' }, h('span', { class: 'pl-topbar__label' }, 'Practical'), select),
      actions,
    );
  }

  #buildViewportToolbar(): HTMLElement {
    const shell = h('div', { class: 'pl-viewtools' });
    const body = h('div', { class: 'pl-viewtools__body' });

    const lightButton: ButtonWidget = button({
      label: 'Room lights',
      glyph: '💡',
      title: 'Dim the room for optics work',
      onClick: () => {
        this.#room.setCeilingLight(!this.#room.ceilingOn);
        lightButton.setActive(!this.#room.ceilingOn);
      },
    });

    // Panning is not a secret handshake: give it a visible mode. Right-drag,
    // middle-drag and Shift-drag still pan whichever mode is selected.
    const dragMode = segmented<'look' | 'pan'>({
      label: 'Drag',
      options: [
        { value: 'look', label: '👁 Look', title: 'Left-drag looks around the apparatus' },
        { value: 'pan', label: '✋ Pan', title: 'Left-drag slides the view along the bench' },
      ],
      value: this.#viewport.controls.dragMode,
      onChange: (value) => {
        this.#viewport.controls.dragMode = value;
      },
    });

    body.append(
      button({
        label: 'Front',
        glyph: '⬛',
        title: 'Look straight at the bench from the front',
        onClick: () => this.#setCamera('front'),
      }).root,
      button({
        label: 'Reading view',
        glyph: '📏',
        title: 'Square up to the metre rule to remove parallax',
        onClick: () => this.#setCamera('rule'),
      }).root,
      button({
        label: 'Top',
        glyph: '⬒',
        title: 'Look down on the bench',
        onClick: () => this.#setCamera('top'),
      }).root,
      button({
        label: 'Reset view',
        glyph: '🏠',
        title: 'Step back to the bench (Home)',
        onClick: () => this.#viewport.resetView(),
      }).root,
      lightButton.root,
    );

    const speed: SegmentedWidget<string> = segmented<string>({
      label: 'Clock',
      options: [
        { value: '0', label: '❚❚', title: 'Pause the simulation' },
        { value: '1', label: '1×' },
        { value: '2', label: '2×' },
        { value: '4', label: '4×' },
      ],
      value: '1',
      onChange: (value) => {
        const scale = Number(value);
        this.#clock.paused = scale === 0;
        if (scale > 0) this.#clock.timeScale = scale;
      },
    });
    body.append(dragMode.root, speed.root);

    // The toolbar sits over the bench, so let it fold away to a single tab.
    const toggle = h(
      'button',
      {
        class: 'pl-viewtools__toggle',
        type: 'button',
        title: 'Hide the camera tools',
        'aria-expanded': 'true',
      },
      '⟨',
    );

    const setCollapsed = (collapsed: boolean): void => {
      shell.classList.toggle('is-collapsed', collapsed);
      toggle.textContent = collapsed ? '🎛' : '⟨';
      toggle.title = collapsed ? 'Show the camera tools' : 'Hide the camera tools';
      toggle.setAttribute('aria-expanded', String(!collapsed));
      try {
        localStorage.setItem(VIEWTOOLS_STORAGE_KEY, collapsed ? '1' : '0');
      } catch {
        // private mode / storage disabled: the fold still works for this visit
      }
    };

    toggle.addEventListener('click', () => {
      setCollapsed(!shell.classList.contains('is-collapsed'));
    });

    shell.append(toggle, body);
    let collapsed = false;
    try {
      collapsed = localStorage.getItem(VIEWTOOLS_STORAGE_KEY) === '1';
    } catch {
      collapsed = false;
    }
    setCollapsed(collapsed);

    return shell;
  }

  // -------------------------------------------------------------------------
  // Experiments
  // -------------------------------------------------------------------------

  #startExperiment(info: ExperimentInfo | null): void {
    this.#experiment?.dispose(this.#services);
    this.#lab.clear();
    this.#clock.reset();
    this.#clock.paused = false;
    this.#revealed = false;

    if (!info || !info.create) {
      this.#experiment = null;
      this.#experimentInfo = null;
      this.#data.setSchema([]);
      this.#panel.setExperiment(null, null, null);
      this.#panel.setData(this.#data.dataset, null);
      this.#panel.setAnalysis(null);
      return;
    }

    this.#experimentInfo = info;
    this.#experiment = info.create();
    this.#data.setSchema(this.#experiment.columns);
    this.#experiment.setup(this.#services);
    this.#panel.setExperiment(info, this.#experiment, this.#services);
    this.#panel.showTab('practical');
    this.#recompute();
    this.#services.bus.emit('panel:refresh', {});
    this.#services.bus.emit('toast', { message: `${info.title} is set up on the bench.`, level: 'good' });
  }

  #startFreePlay(): void {
    this.#experiment?.dispose(this.#services);
    this.#lab.clear();
    this.#experiment = null;
    this.#experimentInfo = null;
    this.#data.setSchema([]);
    this.#panel.setExperiment(null, null, null);
    this.#panel.setData(this.#data.dataset, null);
    this.#panel.setAnalysis(null);
    this.#setCamera('front');
    this.#services.bus.emit('coach:say', {
      text: 'Free play: add apparatus from the store and move it around. Drag to move, double-click to zoom.',
    });
  }

  #restartExperiment(): void {
    if (this.#experimentInfo) this.#startExperiment(this.#experimentInfo);
    else this.#lab.clear();
  }

  #clearBench(): void {
    if (this.#experiment) {
      this.#experiment.dispose(this.#services);
      this.#experiment = null;
      this.#experimentInfo = null;
    }
    this.#lab.clear();
    this.#data.setSchema([]);
    this.#panel.setExperiment(null, null, null);
    this.#panel.setData(this.#data.dataset, null);
    this.#panel.setAnalysis(null);
    this.#services.bus.emit('toast', { message: 'Bench cleared.', level: 'info' });
  }

  #addEquipment(definition: EquipmentDefinition): ReturnType<Lab['spawn']> {
    const placed = this.#lab.spawn(definition.id);
    this.#services.bus.emit('toast', { message: `${definition.name} placed on the bench.`, level: 'info' });
    return placed;
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  #bindBus(bus: EventBus<AppEvents>): void {
    bus.on('toast', ({ message, level, durationMs }) => this.#toasts.show({ message, level, durationMs }));
    bus.on('coach:say', ({ text, level }) => {
      this.#coachBar.textContent = text;
      this.#coachBar.dataset.level = level ?? 'info';
    });
    bus.on('status:changed', (status) => this.#renderStatus(status));
    bus.on('data:changed', () => this.#recompute());
    bus.on('panel:refresh', () => this.#queuePanelRefresh());
    bus.on('graph:refresh', () => requestAnimationFrame(() => this.#panel.graph.resize()));
    bus.on('camera:focus', ({ target, distance }) => this.#viewport.focusOn(target, distance));
    bus.on('experiment:started', ({ title }) => {
      this.#coachBar.textContent = `${title} — read the Practical tab first.`;
    });
  }

  #bindLabEvents(): void {
    this.#lab.bus.on('object:clicked', (event) => {
      // Clicking the stopwatch's real buttons works like the real thing.
      if (event.part === 'ButtonStart' && this.#experiment) {
        const experiment = this.#experiment as Experiment & { toggleStopwatch?: (services: LabServices) => void };
        experiment.toggleStopwatch?.(this.#services);
      }
    });
  }

  #queuePanelRefresh(): void {
    if (this.#panelRefreshQueued) return;
    this.#panelRefreshQueued = true;
    window.setTimeout(() => {
      this.#panelRefreshQueued = false;
      this.#panel.refreshControls(this.#experiment, this.#services);
    }, 120);
  }

  #recompute(): void {
    const dataset = this.#data.dataset;
    const analysis = this.#experiment ? this.#experiment.analyse(dataset) : null;
    const decorations = this.#experiment?.graphDecorations?.(dataset);
    this.#panel.setData(dataset, analysis, decorations);
    this.#panel.setAnalysis(analysis, Boolean(this.#experiment?.reveal?.()) && !this.#revealed);
  }

  #renderStatus(status: ExperimentStatus): void {
    this.#statusState.textContent = status.state;
    this.#statusState.dataset.state = status.state;
    this.#chipHost.replaceChildren();
    for (const chip of status.chips) {
      this.#chipHost.append(
        h(
          'span',
          { class: 'pl-chip', 'data-tone': chip.tone ?? 'default' },
          h('span', { class: 'pl-chip__label' }, chip.label),
          h('span', { class: 'pl-chip__value' }, chip.value),
        ),
      );
    }
    if (status.hint) this.#coachBar.textContent = status.hint;
  }

  #reveal(): void {
    const text = this.#experiment?.reveal?.();
    if (!text) return;
    this.#revealed = true;
    this.#panel.setAnalysis(this.#experiment ? this.#experiment.analyse(this.#data.dataset) : null, false);
    this.#panel.showRevealed(text);
    this.#services.bus.emit('toast', { message: text, level: 'good', durationMs: 8000 });
  }

  #exportCsv(): void {
    const csv = this.#data.toCsv();
    if (!csv.split('\n').some((line) => line.trim().length > 0) || this.#data.rows.length === 0) {
      this.#services.bus.emit('toast', { message: 'Nothing to export yet.', level: 'warn' });
      return;
    }
    const slug = (this.#experimentInfo?.id ?? 'lab').replace(/[^a-z0-9-]/gi, '');
    downloadTextFile(`physics-lab-${slug}.csv`, csv, 'text/csv');
    this.#services.bus.emit('toast', { message: 'Table exported as CSV.', level: 'good' });
  }

  #setCamera(view: 'front' | 'rule' | 'top'): void {
    const { camera, controls } = this.#viewport;
    if (view === 'front') {
      camera.position.set(0.1, BENCH_HEIGHT + 0.55, 1.75);
      controls.target.set(0, BENCH_HEIGHT + 0.35, -0.1);
    } else if (view === 'rule') {
      camera.position.set(0.195, BENCH_HEIGHT + 0.5, -0.232 + 1.05);
      controls.target.set(0.195, BENCH_HEIGHT + 0.45, -0.232);
    } else {
      camera.position.set(0.05, BENCH_HEIGHT + 1.35, 0.55);
      controls.target.set(0.05, BENCH_HEIGHT, -0.1);
    }
    controls.update();
  }

  /** Open the model-library browser and let it place models on the bench. */
  #openModelGallery(): void {
    const gallery = new ModelGallery({
      onPlace: (object, entry) => {
        const placed = this.#lab.adopt(object, { definitionId: `model:${entry.id}` });
        const position = placed.object.position;
        this.#services.bus.emit('toast', {
          message: `${entry.label} placed on the bench.`,
          level: 'good',
        });
        this.#viewport.focusOn(
          new THREE.Vector3(position.x, BENCH_HEIGHT + 0.18, position.z),
          1.15,
        );
      },
    });
    gallery.open();
  }

  #showHelp(): void {    const help = h(
      'div',
      { class: 'pl-help' },
      h('h3', {}, 'How to use the lab'),
      h(
        'ul',
        { class: 'pl-list' },
        h('li', {}, 'Choose a practical from the menu at the top. The apparatus is placed for you.'),
        h(
          'li',
          {},
          'You are standing at the bench: drag to look around, scroll to step towards what you point at, ' +
            'Shift-drag to slide along the bench. Home (or Reset view) steps back.',
        ),
        h('li', {}, 'Drag apparatus to move it. Drag the red arrow on the bob to set the swing, then let go.'),
        h('li', {}, 'Drag the boss head up or down the rod to raise or lower the pendulum.'),
        h('li', {}, 'Read lengths from the magnified rule in the Practical tab — type what you see.'),
        h('li', {}, 'Start and stop the stopwatch with the button, the 3D button, or the space bar.'),
        h('li', {}, 'Press Record (or Enter) to add the trial to the Readings tab.'),
        h('li', {}, 'The Graph tab plots your data and the Analysis tab does the maths.'),
      ),
      h(
        'p',
        { class: 'pl-prose' },
        'Every measurement in this lab carries a real error: your reaction time, the finite amplitude of the swing, ' +
          'the resolution of the rule and the parallax of your viewpoint. Getting a good value for g is a skill, not a formality.',
      ),
    );
    const dialog = h(
      'div',
      { class: 'pl-modal' },
      h('div', { class: 'pl-modal__backdrop' }),
      h(
        'div',
        { class: 'pl-modal__card' },
        help,
        button({ label: 'Close', variant: 'primary', onClick: () => dialog.remove() }).root,
      ),
    );
    document.body.append(dialog);
  }

  /** Tear everything down (used if the app is ever unmounted). */
  dispose(): void {
    this.#experiment?.dispose(this.#services);
    this.#viewport.stop();
    this.#lab.dispose();
    this.#room.dispose();
    this.#sidebar.dispose();
    this.#panel.dispose();
    this.#toasts.dispose();
    this.#viewport.dispose();
  }
}
