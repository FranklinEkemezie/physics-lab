/** Read-outs, cards and prose blocks. */

import { h } from './dom';
import { BaseWidget, type Widget } from './base';

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
