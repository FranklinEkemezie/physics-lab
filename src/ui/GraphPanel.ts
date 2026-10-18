/**
 * The graph panel: a canvas plotter for experimental data.
 *
 * Deliberately written from scratch rather than pulling in a charting
 * library: physics graphs need a specific look (points, error bars, a
 * hand-drawn-style best fit, the gradient written on the line) and full
 * control over the axes suits the teaching goals.
 */

import { h } from './widgets';
import type { ColumnDef, DataSet } from '@/experiments/types';
import type { FitResult } from '@/core/math';

export interface GraphSeries {
  /** Column id plotted on x. */
  xColumnId: string;
  /** Column id plotted on y. */
  yColumnId: string;
  /** Optional 1-sigma uncertainties per point, in axis units. */
  xErrors?: number[];
  yErrors?: number[];
  /** Overlay the least-squares line. */
  fit?: FitResult;
  /** Label for the fitted line, e.g. "gradient = 4.05 s²/m". */
  fitLabel?: string;
  /** Optional theoretical line (gradient + intercept) drawn dashed. */
  theory?: { slope: number; intercept: number; label: string };
}

export class GraphPanel {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  #data: DataSet | null = null;
  #series: GraphSeries | null = null;
  #placeholder: HTMLElement;
  #resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.canvas = h('canvas', { class: 'pl-graph__canvas' }) as HTMLCanvasElement;
    this.#placeholder = h(
      'div',
      { class: 'pl-graph__placeholder' },
      h('span', { class: 'pl-graph__placeholder-glyph' }, '📈'),
      h('p', {}, 'Record at least two trials to see the graph.'),
    );
    this.root = h('div', { class: 'pl-graph' }, this.canvas, this.#placeholder);
    this.#observeResize();
  }

  #observeResize(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver = new ResizeObserver(() => this.resize());
      this.#resizeObserver.observe(this.root);
    }
    window.addEventListener('resize', () => this.resize());
  }

  setData(data: DataSet, series: GraphSeries): void {
    this.#data = data;
    this.#series = series;
    const points = this.#extractPoints();
    const hasData = points.x.length >= 1;
    this.#placeholder.classList.toggle('is-hidden', hasData);
    this.canvas.classList.toggle('is-hidden', !hasData);
    this.resize();
  }

  #extractPoints(): { x: number[]; y: number[]; xs: number[]; ys: number[] } {
    const x: number[] = [];
    const y: number[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    if (!this.#data || !this.#series) return { x, y, xs, ys };
    const { xColumnId, yColumnId } = this.#series;
    for (const row of this.#data.rows) {
      const xv = row.values[xColumnId];
      const yv = row.values[yColumnId];
      if (Number.isFinite(xv) && Number.isFinite(yv)) {
        x.push(xv);
        y.push(yv);
        xs.push(xv);
        ys.push(yv);
      }
    }
    return { x, y, xs, ys };
  }

  resize(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(200, this.root.clientWidth);
    const height = Math.max(200, this.root.clientHeight);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    const ctx = this.canvas.getContext('2d');
    if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.draw();
  }

  /** Choose a "nice" axis range and tick step. */
  static niceScale(min: number, max: number, targetTicks = 6): { min: number; max: number; step: number } {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, step: 0.2 };
    if (max - min < 1e-9) {
      const pad = Math.max(0.5, Math.abs(max) * 0.5);
      return { min: min - pad, max: max + pad, step: pad / 2 };
    }
    const rawStep = (max - min) / targetTicks;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalised = rawStep / magnitude;
    const niceNormalised = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
    const step = niceNormalised * magnitude;
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    return { min: niceMin, max: niceMax, step };
  }

  #column(id: string): ColumnDef | undefined {
    return this.#data?.columns.find((column) => column.id === id);
  }

  #axisLabel(column: ColumnDef | undefined): string {
    if (!column) return '';
    return column.unit ? `${column.header} / ${column.unit}` : column.header;
  }

  draw(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx || !this.#series || !this.#data) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = this.canvas.width / ratio;
    const height = this.canvas.height / ratio;
    if (width < 10 || height < 10) return;

    const { x, y } = this.#extractPoints();
    if (x.length === 0) return;

    const margin = { left: 62, right: 26, top: 26, bottom: 52 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    // --- Ranges ------------------------------------------------------------
    const xErrors = this.#series.xErrors ?? [];
    const yErrors = this.#series.yErrors ?? [];
    const xMinRaw = Math.min(...x.map((value, index) => value - (xErrors[index] ?? 0)));
    const xMaxRaw = Math.max(...x.map((value, index) => value + (xErrors[index] ?? 0)));
    const yMinRaw = Math.min(...y.map((value, index) => value - (yErrors[index] ?? 0)));
    const yMaxRaw = Math.max(...y.map((value, index) => value + (yErrors[index] ?? 0)));
    // Always let the origin into the frame for these plots.
    const xRange = GraphPanel.niceScale(Math.min(0, xMinRaw), xMaxRaw * 1.05);
    const yRange = GraphPanel.niceScale(Math.min(0, yMinRaw), yMaxRaw * 1.08);

    const toX = (value: number): number =>
      margin.left + ((value - xRange.min) / (xRange.max - xRange.min)) * plotWidth;
    const toY = (value: number): number =>
      margin.top + plotHeight - ((value - yRange.min) / (yRange.max - yRange.min)) * plotHeight;

    // --- Background --------------------------------------------------------
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0f1216';
    ctx.fillRect(0, 0, width, height);

    // --- Grid --------------------------------------------------------------
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.font = '11px "Inter", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(226,232,240,0.72)';

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let value = yRange.min; value <= yRange.max + yRange.step / 2; value += yRange.step) {
      const py = toY(value);
      ctx.beginPath();
      ctx.moveTo(margin.left, py);
      ctx.lineTo(margin.left + plotWidth, py);
      ctx.stroke();
      ctx.fillText(formatTick(value, yRange.step), margin.left - 8, py);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let value = xRange.min; value <= xRange.max + xRange.step / 2; value += xRange.step) {
      const px = toX(value);
      ctx.beginPath();
      ctx.moveTo(px, margin.top);
      ctx.lineTo(px, margin.top + plotHeight);
      ctx.stroke();
      ctx.fillText(formatTick(value, xRange.step), px, margin.top + plotHeight + 8);
    }

    // --- Axes --------------------------------------------------------------
    ctx.strokeStyle = 'rgba(226,232,240,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + plotHeight);
    ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
    ctx.stroke();

    ctx.fillStyle = 'rgba(226,232,240,0.9)';
    ctx.font = '600 12px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.#axisLabel(this.#column(this.#series.xColumnId)), margin.left + plotWidth / 2, height - 6);

    ctx.save();
    ctx.translate(16, margin.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.#axisLabel(this.#column(this.#series.yColumnId)), 0, 0);
    ctx.restore();

    // --- Fit lines ---------------------------------------------------------
    const drawLine = (slope: number, intercept: number, colour: string, dash: number[], label?: string): void => {
      ctx.save();
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(toX(xRange.min), toY(slope * xRange.min + intercept));
      ctx.lineTo(toX(xRange.max), toY(slope * xRange.max + intercept));
      ctx.stroke();
      ctx.restore();

      if (label) {
        const labelX = toX(xRange.max) - 104;
        const labelY = Math.max(margin.top + 8, toY(slope * xRange.max + intercept) - 30);
        ctx.font = '600 11px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(label).width + 14;
        ctx.fillStyle = 'rgba(15,18,22,0.86)';
        ctx.beginPath();
        ctx.roundRect(labelX, labelY, textWidth, 20, 5);
        ctx.fill();
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(labelX, labelY, textWidth, 20, 5);
        ctx.stroke();
        ctx.fillStyle = colour;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, labelX + 7, labelY + 10);
      }
    };

    if (this.#series.theory) {
      drawLine(
        this.#series.theory.slope,
        this.#series.theory.intercept,
        'rgba(139,195,74,0.85)',
        [6, 5],
        this.#series.theory.label,
      );
    }
    if (this.#series.fit) {
      drawLine(
        this.#series.fit.slope,
        this.#series.fit.intercept,
        '#5aa9e6',
        [],
        this.#series.fitLabel ?? `gradient = ${this.#series.fit.slope.toPrecision(4)}`,
      );
    }

    // --- Points (with error bars) ------------------------------------------
    for (let i = 0; i < x.length; i += 1) {
      const px = toX(x[i]);
      const py = toY(y[i]);
      const xErr = xErrors[i] ?? 0;
      const yErr = yErrors[i] ?? 0;

      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.2;
      if (yErr > 0) {
        ctx.beginPath();
        ctx.moveTo(px, toY(y[i] - yErr));
        ctx.lineTo(px, toY(y[i] + yErr));
        ctx.moveTo(px - 4, toY(y[i] - yErr));
        ctx.lineTo(px + 4, toY(y[i] - yErr));
        ctx.moveTo(px - 4, toY(y[i] + yErr));
        ctx.lineTo(px + 4, toY(y[i] + yErr));
        ctx.stroke();
      }
      if (xErr > 0) {
        ctx.beginPath();
        ctx.moveTo(toX(x[i] - xErr), py);
        ctx.lineTo(toX(x[i] + xErr), py);
        ctx.moveTo(toX(x[i] - xErr), py - 4);
        ctx.lineTo(toX(x[i] - xErr), py + 4);
        ctx.moveTo(toX(x[i] + xErr), py - 4);
        ctx.lineTo(toX(x[i] + xErr), py + 4);
        ctx.stroke();
      }

      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#1b1f24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (this.#data && this.#data.rows.length <= 12) {
        ctx.fillStyle = 'rgba(226,232,240,0.65)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(this.#data.rows[i]?.index ?? i + 1), px + 7, py - 5);
      }
    }

    // --- Legend ------------------------------------------------------------
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '11px "Inter", system-ui, sans-serif';
    const legend: [string, string][] = [['points', '#ffd166']];
    if (this.#series.fit) legend.push(['best fit', '#5aa9e6']);
    if (this.#series.theory) legend.push(['theory', 'rgba(139,195,74,0.95)']);

    let legendY = margin.top + 6;
    for (const [label, colour] of legend) {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(margin.left + 12, legendY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(226,232,240,0.75)';
      ctx.fillText(label, margin.left + 22, legendY);
      legendY += 16;
    }
  }

  dispose(): void {
    this.#resizeObserver?.disconnect();
    this.root.remove();
  }
}

/** Format a tick label at a sensible precision for the step size. */
function formatTick(value: number, step: number): string {
  const decimals = Math.max(0, Math.min(4, -Math.floor(Math.log10(step))));
  return value.toFixed(decimals).replace('-', '\u2212');
}
