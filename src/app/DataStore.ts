/**
 * The recording table shared by every practical.
 *
 * Holds the columns an experiment declares plus the rows it records, and
 * publishes changes on the app bus so the table, the graph and the analysis
 * panel all stay in step without knowing about each other.
 */

import type { ColumnDef, DataSet, IDataStore, TrialRow } from '@/experiments/types';
import { EventBus } from '@/core/EventBus';
import type { AppEvents } from '@/experiments/types';

export class DataStore implements IDataStore {
  #columns: ColumnDef[] = [];
  #rows: TrialRow[] = [];
  #xColumnId: string | null = null;
  #yColumnId: string | null = null;
  #nextId = 1;
  #bus: EventBus<AppEvents>;

  constructor(bus: EventBus<AppEvents>) {
    this.#bus = bus;
  }

  get columns(): readonly ColumnDef[] {
    return this.#columns;
  }

  get rows(): readonly TrialRow[] {
    return this.#rows;
  }

  get dataset(): DataSet {
    return {
      columns: this.#columns,
      rows: this.#rows,
      xColumnId: this.#xColumnId,
      yColumnId: this.#yColumnId,
    };
  }

  setSchema(columns: readonly ColumnDef[], defaultX?: string, defaultY?: string): void {
    this.#columns = [...columns];
    const plottable = this.#columns.filter((column) => column.plottable !== false);
    this.#xColumnId =
      defaultX ?? plottable.find((column) => column.role === 'independent')?.id ?? plottable[0]?.id ?? null;
    this.#yColumnId =
      defaultY ??
      [...plottable].reverse().find((column) => column.role === 'dependent')?.id ??
      plottable[plottable.length - 1]?.id ??
      null;
    this.#emit();
  }

  setAxes(xColumnId: string, yColumnId: string): void {
    this.#xColumnId = xColumnId;
    this.#yColumnId = yColumnId;
    this.#emit();
  }

  get xColumnId(): string | null {
    return this.#xColumnId;
  }

  get yColumnId(): string | null {
    return this.#yColumnId;
  }

  addRow(values: Record<string, number>, meta: { note?: string; warnings?: string[] } = {}): TrialRow {
    const row: TrialRow = {
      id: `row-${this.#nextId}`,
      index: this.#nextId,
      values: { ...values },
      note: meta.note,
      warnings: meta.warnings && meta.warnings.length > 0 ? [...meta.warnings] : undefined,
      recordedAt: Date.now(),
    };
    this.#nextId += 1;
    this.#rows.push(row);
    this.#emit();
    return row;
  }

  removeRow(id: string): void {
    const index = this.#rows.findIndex((row) => row.id === id);
    if (index === -1) return;
    this.#rows.splice(index, 1);
    this.#rows.forEach((row, position) => {
      row.index = position + 1;
    });
    this.#emit();
  }

  clear(): void {
    this.#rows = [];
    this.#nextId = 1;
    this.#emit();
    this.#bus.emit('data:cleared', {});
  }

  /** Values of one column across every row, in recording order. */
  columnValues(columnId: string): number[] {
    return this.#rows.map((row) => row.values[columnId]).filter((value) => Number.isFinite(value));
  }

  /** Export the table as CSV (one header row + one row per trial). */
  toCsv(): string {
    const headers = this.#columns.map((column) => (column.unit ? `${column.header} (${column.unit})` : column.header));
    const lines = [headers.join(',')];
    for (const row of this.#rows) {
      lines.push(
        this.#columns
          .map((column) => {
            const value = row.values[column.id];
            return Number.isFinite(value) ? value.toFixed(column.decimals) : '';
          })
          .join(','),
      );
    }
    return lines.join('\n');
  }

  #emit(): void {
    this.#bus.emit('data:changed', { dataset: this.dataset });
  }
}
