/**
 * Tiny DOM widget helpers.
 *
 * The lab deliberately uses no UI framework: the whole interface is a handful
 * of panels, and plain DOM keeps the bundle small and the behaviour obvious.
 * Every helper returns a small handle object with setters, so callers can
 * update a widget without rebuilding it.
 */

export type ClassValue = string | false | null | undefined;

/** Create an element with attributes, classes and children in one call. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class' || key === 'className') {
      element.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value as Partial<CSSStyleDeclaration>);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(element.dataset, value as Record<string, string>);
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'html') {
      element.innerHTML = String(value);
    } else if (value === true) {
      element.setAttribute(key, '');
    } else {
      element.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return element;
}

export interface Widget {
  readonly root: HTMLElement;
  setDisabled(disabled: boolean): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

/** Base class handling the boring parts of the {@link Widget} contract. */
abstract class BaseWidget implements Widget {
  readonly root: HTMLElement;
  protected listeners: (() => void)[] = [];

  constructor(root: HTMLElement) {
    this.root = root;
  }

  setDisabled(disabled: boolean): void {
    this.root.classList.toggle('is-disabled', disabled);
    for (const element of this.root.querySelectorAll('input, button, select')) {
      (element as HTMLInputElement).disabled = disabled;
    }
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('is-hidden', !visible);
  }

  dispose(): void {
    for (const off of this.listeners) off();
    this.listeners = [];
    this.root.remove();
  }

  /**
   * Register a disposer for a listener that was attached outside the class
   * body (e.g. in a factory function). Keeps `dispose()` complete.
   */
  track(dispose: () => void): void {
    this.listeners.push(dispose);
  }
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sliders
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Toggles and selects
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Text/number entry
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Read-outs, cards and prose blocks
// ---------------------------------------------------------------------------

export interface StatWidget extends Widget {
  set(value: string, tone?: 'default' | 'good' | 'warn' | 'bad'): void;
}

/** A label + monospaced value pair, used all over the HUD. */
export function stat(label: string, value = '—', hint?: string): StatWidget {
  const valueElement = h('span', { class: 'pl-stat__value' }, value);
  const root = h(
    'div',
    { class: 'pl-stat' },
    h('span', { class: 'pl-stat__label' }, label),
    valueElement,
  );
  if (hint) root.title = hint;

  return new (class extends BaseWidget implements StatWidget {
    set(next: string, tone: 'default' | 'good' | 'warn' | 'bad' = 'default'): void {
      valueElement.textContent = next;
      root.dataset.tone = tone;
    }
  })(root);
}

export interface CardWidget extends Widget {
  readonly body: HTMLElement;
  setCollapsed(collapsed: boolean): void;
}

/** A titled, collapsible section. */
export function card(title: string, options: { glyph?: string; collapsed?: boolean } = {}): CardWidget {
  const body = h('div', { class: 'pl-card__body' });
  const header = h(
    'button',
    { class: 'pl-card__header', type: 'button' },
    options.glyph ? h('span', { class: 'pl-card__glyph' }, options.glyph) : null,
    h('span', { class: 'pl-card__title' }, title),
    h('span', { class: 'pl-card__chevron' }, '▾'),
  );
  const root = h('section', { class: 'pl-card' }, header, body);

  const widget = new (class extends BaseWidget implements CardWidget {
    readonly body = body;
    setCollapsed(collapsed: boolean): void {
      root.classList.toggle('is-collapsed', collapsed);
    }
  })(root);

  if (options.collapsed) widget.setCollapsed(true);
  header.addEventListener('click', () => root.classList.toggle('is-collapsed'));
  return widget;
}

export type NoteLevel = 'info' | 'good' | 'warn' | 'bad';

/** A coloured note block. */
export function note(text: string, level: NoteLevel = 'info'): HTMLElement {
  return h('p', { class: `pl-note pl-note--${level}` }, text);
}

/** A definition-style list used for theory and procedure text. */
export function list(items: readonly string[], ordered = true): HTMLElement {
  const element = h(ordered ? 'ol' : 'ul', { class: 'pl-list' });
  for (const item of items) element.append(h('li', {}, item));
  return element;
}

/** Draw a horizontal divider with an optional caption. */
export function divider(caption?: string): HTMLElement {
  return h(
    'div',
    { class: 'pl-divider' },
    h('span', { class: 'pl-divider__line' }),
    caption ? h('span', { class: 'pl-divider__caption' }, caption) : null,
    h('span', { class: 'pl-divider__line' }),
  );
}

/** Escape text for safe use as innerHTML (theory blurbs support markdown-ish). */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/**
 * Render a very small subset of markdown: `**bold**`, `*italic*` and `` `code` ``.
 * Enough for the theory cards without pulling in a parser.
 */
export function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
