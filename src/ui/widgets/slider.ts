/** Range slider widget. */

import { h } from './dom';
import { BaseWidget, type Widget } from './base';

export interface SliderOptions {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  decimals?: number;
  hint?: string;
  onInput: (value: number) => void;
}

export interface SliderWidget extends Widget {
  setValue(value: number): void;
  setReadout(text: string): void;
}

export function slider(options: SliderOptions): SliderWidget {
  const { decimals = 1, unit = '' } = options;
  const readout = h('span', { class: 'pl-slider__value' }, `${options.value.toFixed(decimals)}${unit}`);

  const input = h('input', {
    class: 'pl-slider__input',
    type: 'range',
    min: String(options.min),
    max: String(options.max),
    step: String(options.step),
    value: String(options.value),
  }) as HTMLInputElement;

  const root = h(
    'div',
    { class: 'pl-slider' },
    h(
      'div',
      { class: 'pl-slider__head' },
      h('span', { class: 'pl-field__label' }, options.label),
      readout,
    ),
    input,
    options.hint ? h('p', { class: 'pl-slider__hint' }, options.hint) : null,
  );

  const widget = new (class extends BaseWidget implements SliderWidget {
    setValue(value: number): void {
      input.value = String(value);
      readout.textContent = `${value.toFixed(decimals)}${unit}`;
    }
    setReadout(text: string): void {
      readout.textContent = text;
    }
  })(root);

  const onInput = (): void => {
    const value = Number(input.value);
    readout.textContent = `${value.toFixed(decimals)}${unit}`;
    options.onInput(value);
  };
  input.addEventListener('input', onInput);
  widget.track(() => input.removeEventListener('input', onInput));
  return widget;
}
