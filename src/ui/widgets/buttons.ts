/** Button-like widgets. */

import { h } from './dom';
import { BaseWidget, type Widget } from './base';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';

export interface ButtonOptions {
  label: string;
  glyph?: string;
  variant?: ButtonVariant;
  title?: string;
  onClick: () => void;
}

export interface ButtonWidget extends Widget {
  setLabel(label: string): void;
  setActive(active: boolean): void;
}

export function button(options: ButtonOptions): ButtonWidget {
  const glyph = options.glyph ? h('span', { class: 'pl-btn__glyph' }, options.glyph) : null;
  const label = h('span', { class: 'pl-btn__label' }, options.label);
  const root = h(
    'button',
    { class: `pl-btn pl-btn--${options.variant ?? 'default'}`, type: 'button', title: options.title ?? options.label },
    glyph,
    label,
  );
  const widget = new (class extends BaseWidget implements ButtonWidget {
    setLabel(next: string): void {
      label.textContent = next;
    }
    setActive(active: boolean): void {
      root.classList.toggle('is-active', active);
    }
  })(root);

  root.addEventListener('click', options.onClick);
  widget.track(() => root.removeEventListener('click', options.onClick));
  return widget;
}

/** A row of buttons that behaves like a segmented control. */
export interface SegmentedOptions<T extends string> {
  label?: string;
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (value: T) => void;
}

export interface SegmentedWidget<T extends string> extends Widget {
  setValue(value: T): void;
}

export function segmented<T extends string>(options: SegmentedOptions<T>): SegmentedWidget<T> {
  const group = h('div', { class: 'pl-segmented', role: 'group' });
  const buttons = new Map<T, HTMLButtonElement>();

  for (const option of options.options) {
    const element = h(
      'button',
      {
        class: 'pl-segmented__item',
        type: 'button',
        title: option.title ?? option.label,
        'aria-pressed': String(option.value === options.value),
      },
      option.label,
    );
    buttons.set(option.value, element);
    element.addEventListener('click', () => {
      widget.setValue(option.value);
      options.onChange(option.value);
    });
    group.append(element);
  }

  const root = options.label
    ? h('div', { class: 'pl-field' }, h('span', { class: 'pl-field__label' }, options.label), group)
    : group;

  const widget = new (class extends BaseWidget implements SegmentedWidget<T> {
    setValue(value: T): void {
      for (const [key, element] of buttons) {
        const active = key === value;
        element.classList.toggle('is-active', active);
        element.setAttribute('aria-pressed', String(active));
      }
    }
  })(root);

  widget.setValue(options.value);
  return widget;
}
