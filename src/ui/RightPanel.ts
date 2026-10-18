/**
 * The right-hand panel: everything you read rather than manipulate.
 *
 * Four tabs, all driven by the active experiment's own declarations:
 *  - **Practical** — aim, theory, procedure and the experiment's controls
 *  - **Readings** — the recording table
 *  - **Graph**     — plot with selectable axes, error bars and a best fit
 *  - **Analysis**  — the computed result, with feedback
 */

import { h, button, card, list, note, select, inlineMarkdown } from './widgets';
import type { ButtonWidget, SelectWidget } from './widgets';
import { DataTable } from './DataTable';
import { GraphPanel } from './GraphPanel';
import type { AnalysisResult, DataSet, Experiment, LabServices } from '@/experiments/types';
import type { ExperimentInfo } from '@/experiments/registry';

export type PanelTab = 'practical' | 'readings' | 'graph' | 'analysis';

export interface RightPanelCallbacks {
  onClearData: () => void;
  onExportCsv: () => void;
  onAxesChange: (xColumnId: string, yColumnId: string) => void;
  onRemoveRow: (rowId: string) => void;
  onRefreshPanel: () => void;
  /** Called when the student asks to reveal hidden values. */
  onReveal: () => void;
}

const TAB_LABELS: { id: PanelTab; label: string; glyph: string }[] = [
  { id: 'practical', label: 'Practical', glyph: '🧭' },
  { id: 'readings', label: 'Readings', glyph: '📋' },
  { id: 'graph', label: 'Graph', glyph: '📈' },
  { id: 'analysis', label: 'Analysis', glyph: '🧮' },
];

export class RightPanel {
  readonly root: HTMLElement;
  readonly table: DataTable;
  readonly graph: GraphPanel;

  #callbacks: RightPanelCallbacks;
  #tabButtons = new Map<PanelTab, HTMLButtonElement>();
  #pages = new Map<PanelTab, HTMLElement>();
  #activeTab: PanelTab = 'practical';

  #controlsHost: HTMLElement;
  #aimHost: HTMLElement;
  #analysisHost: HTMLElement;
  #graphStats: HTMLElement;
  #xSelect: SelectWidget<string> | null = null;
  #ySelect: SelectWidget<string> | null = null;
  #xValue = '';
  #yValue = '';
  #axisHost: HTMLElement;
  #revealButton: ButtonWidget | null = null;
  #emptyState: HTMLElement;

  constructor(callbacks: RightPanelCallbacks) {
    this.#callbacks = callbacks;
    this.table = new DataTable({ onRemove: callbacks.onRemoveRow });
    this.graph = new GraphPanel();

    const tabs = h('div', { class: 'pl-panel__tabs', role: 'tablist' });
    for (const tab of TAB_LABELS) {
      const element = h(
        'button',
        { class: 'pl-panel__tab', type: 'button', role: 'tab', 'data-tab': tab.id },
        h('span', { class: 'pl-panel__tab-glyph' }, tab.glyph),
        h('span', { class: 'pl-panel__tab-label' }, tab.label),
      );
      element.addEventListener('click', () => this.showTab(tab.id));
      this.#tabButtons.set(tab.id, element);
      tabs.append(element);
    }

    // --- Practical page ----------------------------------------------------
    this.#aimHost = h('div', { class: 'pl-panel__aim' });
    this.#controlsHost = h('div', { class: 'pl-panel__controls' });
    const practicalPage = h('div', { class: 'pl-panel__page' }, this.#aimHost, this.#controlsHost);

    // --- Readings page -----------------------------------------------------
    const readingsToolbar = h('div', { class: 'pl-btnrow pl-btnrow--tight' });
    readingsToolbar.append(
      button({ label: 'Export CSV', glyph: '⤓', onClick: callbacks.onExportCsv }).root,
      button({ label: 'Clear table', glyph: '🗑', variant: 'danger', onClick: callbacks.onClearData }).root,
    );
    const readingsPage = h(
      'div',
      { class: 'pl-panel__page' },
      readingsToolbar,
      this.table.root,
    );

    // --- Graph page --------------------------------------------------------
    this.#axisHost = h('div', { class: 'pl-panel__axes' });
    this.#graphStats = h('div', { class: 'pl-panel__graph-stats' });
    const graphPage = h(
      'div',
      { class: 'pl-panel__page pl-panel__page--graph' },
      this.#axisHost,
      h('div', { class: 'pl-graph-host' }, this.graph.root),
      this.#graphStats,
    );

    // --- Analysis page -----------------------------------------------------
    this.#analysisHost = h('div', { class: 'pl-panel__analysis' });
    const analysisPage = h('div', { class: 'pl-panel__page' }, this.#analysisHost);

    this.#pages.set('practical', practicalPage);
    this.#pages.set('readings', readingsPage);
    this.#pages.set('graph', graphPage);
    this.#pages.set('analysis', analysisPage);

    this.#emptyState = h(
      'div',
      { class: 'pl-panel__empty' },
      h('p', {}, 'No practical running.'),
      h('p', { class: 'pl-panel__empty-hint' }, 'Pick one from the Practical menu, or just explore the apparatus.'),
    );

    const body = h('div', { class: 'pl-panel__body' }, ...this.#pages.values());
    this.root = h('aside', { class: 'pl-panel' }, tabs, body);

    // Tab badges for the readings count.
    this.showTab('practical');
    this.setAnalysis(null);
  }

  showTab(tab: PanelTab): void {
    this.#activeTab = tab;
    for (const [id, element] of this.#tabButtons) element.classList.toggle('is-active', id === tab);
    for (const [id, page] of this.#pages) page.classList.toggle('is-hidden', id !== tab);
    if (tab === 'graph') {
      // The canvas needs a layout pass before it can be sized.
      requestAnimationFrame(() => this.graph.resize());
    }
  }

  get activeTab(): PanelTab {
    return this.#activeTab;
  }

  /** Number of readings, shown as a badge on the Readings tab. */
  setRowCount(count: number): void {
    const element = this.#tabButtons.get('readings');
    if (!element) return;
    let badge = element.querySelector('.pl-panel__tab-badge') as HTMLElement | null;
    if (count <= 0) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = h('span', { class: 'pl-panel__tab-badge' });
      element.append(badge);
    }
    badge.textContent = String(count);
  }

  /** Rebuild the Practical tab for a new (or refreshed) experiment. */
  setExperiment(
    info: ExperimentInfo | null,
    experiment: Experiment | null,
    services: LabServices | null,
  ): void {
    this.#controlsHost.replaceChildren();
    this.#aimHost.replaceChildren();

    if (!info || !experiment || !services) {
      this.#aimHost.append(this.#emptyState);
      return;
    }

    this.#aimHost.append(
      h('h2', { class: 'pl-panel__title' }, experiment.title),
      h('p', { class: 'pl-panel__aim-text', html: `<strong>Aim.</strong> ${inlineMarkdown(experiment.aim)}` }),
    );

    const theoryCard = card('Theory', { glyph: '📚', collapsed: true });
    theoryCard.body.append(h('p', { class: 'pl-prose', html: inlineMarkdown(experiment.theory) }));
    this.#aimHost.append(theoryCard.root);

    const procedureCard = card('Procedure', { glyph: '📝', collapsed: true });
    procedureCard.body.append(list(experiment.procedure));
    this.#aimHost.append(procedureCard.root);

    experiment.buildControls?.(this.#controlsHost, services);
  }

  /** Refresh just the experiment's controls (state changed). */
  refreshControls(experiment: Experiment | null, services: LabServices | null): void {
    this.#controlsHost.replaceChildren();
    if (!experiment || !services || !experiment.buildControls) return;
    experiment.buildControls(this.#controlsHost, services);
  }

  setData(dataset: DataSet, analysis: AnalysisResult | null, decorations?: ReturnType<NonNullable<Experiment['graphDecorations']>>): void {
    this.table.setData(dataset);
    this.setRowCount(dataset.rows.length);
    this.#buildAxisSelectors(dataset);

    const xColumnId = dataset.xColumnId;
    const yColumnId = dataset.yColumnId;
    if (xColumnId && yColumnId) {
      this.graph.setData(dataset, {
        xColumnId,
        yColumnId,
        xErrors: decorations?.xErrors,
        yErrors: decorations?.yErrors,
        fit: analysis?.fit,
        fitLabel: analysis?.fit
          ? `gradient = ${analysis.fit.slope.toPrecision(4)}`
          : undefined,
        theory: decorations?.theory,
      });
    }

    // Fit statistics under the graph.
    this.#graphStats.replaceChildren();
    if (analysis?.fit) {
      const fit = analysis.fit;
      this.#graphStats.append(
        h(
          'div',
          { class: 'pl-fitstats' },
          this.#fitStat('Points', String(fit.n)),
          this.#fitStat('Gradient', fit.slope.toPrecision(4)),
          this.#fitStat('±', fit.slopeStdError ? fit.slopeStdError.toPrecision(2) : '—'),
          this.#fitStat('Intercept', fit.intercept.toPrecision(4)),
          this.#fitStat('r²', fit.r2.toFixed(5)),
        ),
      );
    } else if (dataset.rows.length > 0) {
      this.#graphStats.append(note('Record at least two trials for a straight-line fit.', 'info'));
    }
  }

  #fitStat(label: string, value: string): HTMLElement {
    return h(
      'div',
      { class: 'pl-fitstat' },
      h('span', { class: 'pl-fitstat__label' }, label),
      h('span', { class: 'pl-fitstat__value' }, value),
    );
  }

  #buildAxisSelectors(dataset: DataSet): void {
    const plottable = dataset.columns.filter((column) => column.plottable !== false);
    const options = plottable.map((column) => ({
      value: column.id,
      label: column.unit ? `${column.header} / ${column.unit}` : column.header,
    }));
    if (options.length < 2) {
      this.#axisHost.replaceChildren();
      return;
    }

    this.#xValue = dataset.xColumnId ?? options[0].value;
    this.#yValue = dataset.yColumnId ?? options[options.length - 1].value;

    this.#xSelect = select<string>({
      label: 'x axis',
      options,
      value: this.#xValue,
      onChange: (value) => {
        this.#xValue = value;
        this.#callbacks.onAxesChange(this.#xValue, this.#yValue);
      },
    });
    this.#ySelect = select<string>({
      label: 'y axis',
      options,
      value: this.#yValue,
      onChange: (value) => {
        this.#yValue = value;
        this.#callbacks.onAxesChange(this.#xValue, this.#yValue);
      },
    });

    this.#axisHost.replaceChildren(this.#xSelect.root, this.#ySelect.root);
  }

  setAnalysis(result: AnalysisResult | null, canReveal = false): void {
    this.#analysisHost.replaceChildren();
    this.#revealButton = null;

    if (!result) {
      this.#analysisHost.append(note('The analysis appears here once you have recorded some readings.', 'info'));
      return;
    }

    this.#analysisHost.append(h('div', { class: 'pl-analysis__headline' }, result.headline));

    if (result.lines.length > 0) {
      const linesCard = card('Working', { glyph: '🧮' });
      linesCard.body.append(
        h(
          'ul',
          { class: 'pl-list pl-list--plain' },
          ...result.lines.map((line) => h('li', { class: 'pl-mono', html: inlineMarkdown(line) })),
        ),
      );
      this.#analysisHost.append(linesCard.root);
    }

    if (result.tips && result.tips.length > 0) {
      const tipsCard = card('Examiner notes', { glyph: '🎓' });
      for (const tip of result.tips) {
        tipsCard.body.append(note(tip, tip.startsWith('Excellent') || tip.startsWith('Good') ? 'good' : 'warn'));
      }
      this.#analysisHost.append(tipsCard.root);
    }

    if (canReveal) {
      this.#revealButton = button({
        label: 'Reveal the true value',
        glyph: '🔓',
        variant: 'primary',
        title: 'Check what the hidden gravity really was',
        onClick: () => this.#callbacks.onReveal(),
      });
      this.#analysisHost.append(this.#revealButton.root);
    }
  }

  /** Show a revealed secret in the analysis tab. */
  showRevealed(text: string): void {
    this.#analysisHost.append(note(text, 'good'));
  }

  dispose(): void {
    this.table.dispose();
    this.graph.dispose();
    this.root.remove();
  }
}
