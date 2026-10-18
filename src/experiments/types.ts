/**
 * The contract every practical implements.
 *
 * An experiment owns three things: the apparatus it puts on the bench, the
 * columns it records, and the analysis it offers. The UI is generic — it
 * renders whatever columns an experiment declares and plots whichever two the
 * student picks — so adding a new practical never means touching the UI.
 */

import type * as THREE from 'three';
import type { Lab } from '@/lab/Lab';
import type { GroupId } from '@/lab/types';
import type { Viewport } from '@/engine/Viewport';
import type { LabRoom } from '@/engine/LabRoom';
import type { LabClock } from '@/physics/LabClock';
import type { Rng } from '@/core/random';
import type { EventBus } from '@/core/EventBus';
import type { FitResult } from '@/physics/statistics';

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

/** How a column takes part in the analysis. */
export type ColumnRole = 'independent' | 'dependent' | 'raw' | 'derived';

export interface ColumnDef {
  /** Machine key, used in `TrialRow.values`. */
  id: string;
  /** Table heading, e.g. "L". */
  header: string;
  /** Unit shown under the heading. */
  unit?: string;
  /** Decimals to display. */
  decimals: number;
  /** How the column participates in the graph and analysis. */
  role: ColumnRole;
  /** Set false to keep a column out of the axis pickers. */
  plottable?: boolean;
  /** Optional explanation shown in the table header tooltip. */
  hint?: string;
}

/** One recorded observation. */
export interface TrialRow {
  id: string;
  /** 1-based order in which it was recorded. */
  index: number;
  /** Raw measured quantities only — everything derived is recomputed. */
  values: Record<string, number>;
  /** Optional note written by the experiment ("timed 10 swings"). */
  note?: string;
  /** Anything the app considers unreliable, e.g. a parallax-heavy reading. */
  warnings?: string[];
  /** When the row was recorded (ms since epoch). */
  recordedAt: number;
}

/** The complete table plus the current graph selection. */
export interface DataSet {
  columns: ColumnDef[];
  rows: TrialRow[];
  xColumnId: string | null;
  yColumnId: string | null;
}

/** Result of analysing the recorded data. */
export interface AnalysisResult {
  /** Big number at the top of the analysis card, e.g. "g = 9.8 ± 0.2 m/s²". */
  headline: string;
  /** Supporting lines, rendered as a list. */
  lines: string[];
  /** The fit, when one could be computed. */
  fit?: FitResult;
  /** Anything the app thinks the student got wrong. */
  tips?: string[];
}

// ---------------------------------------------------------------------------
// Services handed to an experiment
// ---------------------------------------------------------------------------

/** Abstraction over the shared recording table, so experiments stay UI-free. */
export interface IDataStore {
  /** Replace the table's schema (called when an experiment starts). */
  setSchema(columns: readonly ColumnDef[], defaultX?: string, defaultY?: string): void;
  /** Append a row. `values` must contain every column id. */
  addRow(values: Record<string, number>, meta?: { note?: string; warnings?: string[] }): TrialRow;
  removeRow(id: string): void;
  clear(): void;
  /** Rows recorded so far (read-only view). */
  readonly rows: readonly TrialRow[];
  /** The full dataset, ready for analysis. */
  readonly dataset: DataSet;
}

/** Everything an experiment may use. Injected, never imported globally. */
export interface LabServices {
  lab: Lab;
  viewport: Viewport;
  room: LabRoom;
  clock: LabClock;
  rng: Rng;
  bus: EventBus<AppEvents>;
  data: IDataStore;
  /** Ask the UI to rebuild any panels bound to experiment state. */
  requestPanelRefresh(): void;
}

/** Live summary shown in the HUD while the practical runs. */
export interface ExperimentStatus {
  /** Short state word: "ready", "swinging", "timing", "recorded". */
  state: string;
  /** Key/value pairs shown as chips in the HUD. */
  chips: { label: string; value: string; tone?: 'default' | 'good' | 'warn' }[];
  /** One-line instruction for the student. */
  hint: string;
}

/** Global application events (as opposed to Lab-local ones). */
export interface AppEvents {
  toast: { message: string; level?: 'info' | 'good' | 'warn' | 'error'; durationMs?: number };
  'data:changed': { dataset: DataSet };
  'data:cleared': Record<string, never>;
  'experiment:started': { id: string; title: string };
  'experiment:disposed': { id: string };
  'status:changed': ExperimentStatus;
  'panel:refresh': Record<string, never>;
  'graph:refresh': Record<string, never>;
  /** Ask the camera to show something specific. */
  'camera:focus': { target: THREE.Vector3; distance?: number };
  /** A short teaching message shown under the toolbar. */
  'coach:say': { text: string; level?: 'info' | 'warn' | 'good' };
}

// ---------------------------------------------------------------------------
// The experiment interface
// ---------------------------------------------------------------------------

export interface Experiment {
  /** Stable id, used in the URL hash and by the registry. */
  readonly id: string;
  /** Practical title, e.g. "Simple pendulum: determine g". */
  readonly title: string;
  /** Which topic tab it belongs to. */
  readonly group: GroupId;
  /** WAEC-style aim. */
  readonly aim: string;
  /** The theory the student is asked to apply. */
  readonly theory: string;
  /** Ordered procedure steps. */
  readonly procedure: readonly string[];

  /** Columns this experiment records. */
  readonly columns: readonly ColumnDef[];

  /** Put the apparatus on the bench and wire up interactions. */
  setup(services: LabServices): void;

  /** Per-frame hook (already receives real seconds, not simulated time). */
  update(dt: number, services: LabServices): void;

  /** Return the bench to the experiment's starting state. */
  reset(services: LabServices): void;

  /** Current state, for the HUD. */
  status(services: LabServices): ExperimentStatus;

  /** Analyse recorded data. Never throws: returns tips instead. */
  analyse(dataset: DataSet): AnalysisResult;
  /** Tear down listeners and apparatus. */
  dispose(services: LabServices): void;

  /**
   * Optional experiment-specific controls, mounted into the "apparatus"
   * panel. Called again whenever the app requests a panel refresh.
   */
  buildControls?(container: HTMLElement, services: LabServices): void;
}

/**
 * Convenience base class: implements the boring parts so a real experiment
 * only has to write its own `setup`, `update` and `analyse`.
 */
export abstract class BaseExperiment implements Experiment {
  abstract readonly id: string;
  abstract readonly title: string;
  abstract readonly group: GroupId;
  abstract readonly aim: string;
  abstract readonly theory: string;
  abstract readonly procedure: readonly string[];
  abstract readonly columns: readonly ColumnDef[];

  /** Cleanup callbacks registered during `setup`. */
  protected readonly teardown: (() => void)[] = [];

  abstract setup(services: LabServices): void;

  update(_dt: number, _services: LabServices): void {
    /* most experiments are event-driven; override if needed */
  }

  reset(services: LabServices): void {
    this.dispose(services);
    this.setup(services);
  }

  status(_services: LabServices): ExperimentStatus {
    return { state: 'ready', chips: [], hint: '' };
  }

  analyse(_dataset: DataSet): AnalysisResult {
    return { headline: 'No analysis available.', lines: [] };
  }

  dispose(_services: LabServices): void {
    for (const dispose of this.teardown.splice(0)) dispose();
  }

  /** Register a cleanup callback, returning the disposer for convenience. */
  protected onDispose(dispose: () => void): () => void {
    this.teardown.push(dispose);
    return dispose;
  }
}
