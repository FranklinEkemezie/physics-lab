/** Switch/toggle widget. */

import { h } from './dom';
import { BaseWidget, type Widget } from './base';

export interface ToggleOptions {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export interface ToggleWidget extends Widget {
  setValue(value: boolean): void;
}

export function toggle(options: ToggleOptions): ToggleWidget {
  const input = h('input', { type: 'checkbox', class: 'pl-switch__input' }) as HTMLInputElement;
  input.checked = options.value;

  const root = h(
    'label',
    { class: 'pl-switch' },
    input,
    h('span', { class: 'pl-switch__track' }, h('span', { class: 'pl-switch__thumb' })),
    h(
      'span',
      { class: 'pl-switch__text' },
      h('span', { class: 'pl-switch__label' }, options.label),
      options.hint ? h('span', { class: 'pl-switch__hint' }, options.hint) : null,
    ),
  );

  const widget = new (class extends BaseWidget implements ToggleWidget {
    setValue(value: boolean): void {
      input.checked = value;
    }
  })(root);

  const onChange = (): void => options.onChange(input.checked);
  input.addEventListener('change', onChange);
  widget.track(() => input.removeEventListener('change', onChange));
  return widget;
}
