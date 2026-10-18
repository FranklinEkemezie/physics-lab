/** Dropdown select widget. */

import { h } from './dom';
import { BaseWidget, type Widget } from './base';

export interface SelectOptions<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  hint?: string;
  onChange: (value: T) => void;
}

export interface SelectWidget<T extends string> extends Widget {
  setValue(value: T): void;
}

export function select<T extends string>(options: SelectOptions<T>): SelectWidget<T> {
  const element = h('select', { class: 'pl-select__input' }) as HTMLSelectElement;
  for (const option of options.options) {
    element.append(h('option', { value: option.value, selected: option.value === options.value }, option.label));
  }
  element.value = options.value;

  const root = h(
    'div',
    { class: 'pl-field pl-field--select' },
    h('span', { class: 'pl-field__label' }, options.label),
    h('div', { class: 'pl-select' }, element),
    options.hint ? h('p', { class: 'pl-slider__hint' }, options.hint) : null,
  );

  const widget = new (class extends BaseWidget implements SelectWidget<T> {
    setValue(value: T): void {
      element.value = value;
    }
  })(root);

  const onChange = (): void => options.onChange(element.value as T);
  element.addEventListener('change', onChange);
  widget.track(() => element.removeEventListener('change', onChange));
  return widget;
}
