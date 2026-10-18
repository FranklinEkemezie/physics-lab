/** Parsed numeric text-entry widget. */

import { h } from './dom';
import { BaseWidget, type Widget } from './base';

export interface NumberFieldOptions {
  label: string;
  unit?: string;
  placeholder?: string;
  decimals?: number;
  step?: number;
  value?: number | null;
  hint?: string;
  onCommit?: (value: number | null) => void;
}

export interface NumberFieldWidget extends Widget {
  /** Current parsed value, or null when the field is empty/invalid. */
  value(): number | null;
  setValue(value: number | null): void;
  /** Mark the field as accepted (green) or suspect (amber), with a reason. */
  setStatus(status: 'none' | 'good' | 'warn' | 'bad', message?: string): void;
  focus(): void;
}

export function numberField(options: NumberFieldOptions): NumberFieldWidget {
  const input = h('input', {
    class: 'pl-input__control',
    type: 'number',
    step: String(options.step ?? 0.01),
    placeholder: options.placeholder ?? '',
    inputmode: 'decimal',
  }) as HTMLInputElement;
  if (options.value !== null && options.value !== undefined) input.value = String(options.value);

  const status = h('span', { class: 'pl-input__status' });
  const root = h(
    'div',
    { class: 'pl-input' },
    h('span', { class: 'pl-field__label' }, options.label),
    h(
      'div',
      { class: 'pl-input__row' },
      input,
      options.unit ? h('span', { class: 'pl-input__unit' }, options.unit) : null,
      status,
    ),
    options.hint ? h('p', { class: 'pl-slider__hint' }, options.hint) : null,
  );

  const widget = new (class extends BaseWidget implements NumberFieldWidget {
    value(): number | null {
      if (input.value.trim() === '') return null;
      const parsed = Number(input.value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    setValue(value: number | null): void {
      input.value = value === null ? '' : value.toFixed(options.decimals ?? 2);
    }
    setStatus(next: 'none' | 'good' | 'warn' | 'bad', message?: string): void {
      root.classList.remove('is-good', 'is-warn', 'is-bad');
      if (next !== 'none') root.classList.add(`is-${next}`);
      status.textContent = message ?? '';
      status.title = message ?? '';
    }
    focus(): void {
      input.focus();
      input.select();
    }
  })(root);

  if (options.onCommit) {
    const commit = (): void => options.onCommit?.(widget.value());
    input.addEventListener('change', commit);
    widget.track(() => input.removeEventListener('change', commit));
  }
  return widget;
}
