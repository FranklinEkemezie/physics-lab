/**
 * The readings table: what the student would have written in their notebook.
 *
 * Columns come from the active experiment, so this component never needs to
 * know that it is looking at a pendulum rather than a resistance wire.
 */

import { h } from './widgets';
import type { ColumnDef, DataSet, TrialRow } from '@/experiments/types';

export interface DataTableCallbacks {
  onRemove: (rowId: string) => void;
  onFocusRow?: (row: TrialRow) => void;
}

export class DataTable {
  readonly root: HTMLElement;
  #body: HTMLElement;
  #empty: HTMLElement;
  #callbacks: DataTableCallbacks;
  #data: DataSet | null = null;

  constructor(callbacks: DataTableCallbacks) {
    this.#callbacks = callbacks;
    this.#body = h('tbody');
    this.#empty = h(
      'div',
      { class: 'pl-table__empty' },
      h('span', { class: 'pl-table__empty-glyph' }, '🗒️'),
      h('p', {}, 'No readings yet.'),
      h('p', { class: 'pl-table__empty-hint' }, 'Take a measurement, then press Record.'),
    );

    const table = h(
      'table',
      { class: 'pl-table__table' },
      h('thead'),
      this.#body,
    );

    this.root = h('div', { class: 'pl-table' }, h('div', { class: 'pl-table__scroll' }, table), this.#empty);
  }

  setData(data: DataSet): void {
    this.#data = data;
    const table = this.root.querySelector('table') as HTMLTableElement;
    const thead = table.querySelector('thead') as HTMLElement;

    // Header
    thead.replaceChildren();
    const headerRow = h('tr');
    headerRow.append(h('th', { class: 'pl-table__index' }, '#'));
    for (const column of data.columns) {
      const hint = column.hint ?? '';
      headerRow.append(
        h(
          'th',
          { class: 'pl-table__head', title: hint },
          h('span', { class: 'pl-table__head-main' }, column.header),
          column.unit ? h('span', { class: 'pl-table__head-unit' }, column.unit) : null,
        ),
      );
    }
    headerRow.append(h('th', { class: 'pl-table__actions' }, ''));
    thead.append(headerRow);

    // Rows
    this.#body.replaceChildren();
    for (const row of data.rows) {
      const tr = h('tr', { class: row.warnings?.length ? 'is-flagged' : '' });
      tr.append(h('td', { class: 'pl-table__index' }, String(row.index)));
      for (const column of data.columns) {
        const value = row.values[column.id];
        tr.append(
          h(
            'td',
            { class: 'pl-table__cell' },
            Number.isFinite(value) ? value.toFixed(column.decimals) : '—',
          ),
        );
      }

      const actions = h('td', { class: 'pl-table__actions' });
      if (row.warnings?.length) {
        actions.append(
          h(
            'span',
            { class: 'pl-table__warn', title: row.warnings.join('\n') },
            '⚠',
          ),
        );
      }
      if (row.note) {
        actions.append(h('span', { class: 'pl-table__note', title: row.note }, 'ⓘ'));
      }
      const remove = h('button', { class: 'pl-table__remove', type: 'button', title: 'Delete this reading' }, '✕');
      remove.addEventListener('click', () => this.#callbacks.onRemove(row.id));
      actions.append(remove);
      tr.append(actions);

      tr.addEventListener('click', () => this.#callbacks.onFocusRow?.(row));
      this.#body.append(tr);
    }

    const hasRows = data.rows.length > 0;
    this.#empty.classList.toggle('is-hidden', hasRows);
    table.classList.toggle('is-hidden', !hasRows);
  }

  /** Export the current table as CSV. */
  toCsv(): string {
    if (!this.#data) return '';
    const headers = this.#data.columns.map(
      (column: ColumnDef) => `"${column.header}${column.unit ? ` (${column.unit})` : ''}"`,
    );
    const lines = [`# Virtual Physics Lab export`];
    lines.push(headers.join(','));
    for (const row of this.#data.rows) {
      lines.push(
        this.#data.columns
          .map((column) => {
            const value = row.values[column.id];
            return Number.isFinite(value) ? value.toFixed(column.decimals) : '';
          })
          .join(','),
      );
    }
    return lines.join('\n');
  }

  dispose(): void {
    this.root.remove();
  }
}
