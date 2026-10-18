/**
 * Transient messages ("toasts") that slide in when something is recorded,
 * warned about, or goes wrong.
 */

import { h } from './widgets';

export type ToastLevel = 'info' | 'good' | 'warn' | 'error';

interface ToastOptions {
  message: string;
  level?: ToastLevel;
  durationMs?: number;
}

export class ToastHost {
  readonly root: HTMLElement;
  #timers = new Set<number>();

  constructor() {
    this.root = h('div', { class: 'pl-toasts', role: 'status', 'aria-live': 'polite' });
  }

  show({ message, level = 'info', durationMs = 4200 }: ToastOptions): void {
    const glyph = { info: 'ℹ', good: '✔', warn: '⚠', error: '✖' }[level];
    const element = h(
      'div',
      { class: `pl-toast pl-toast--${level}` },
      h('span', { class: 'pl-toast__glyph' }, glyph),
      h('span', { class: 'pl-toast__text' }, message),
    );

    const dismiss = (): void => {
      element.classList.add('is-leaving');
      window.setTimeout(() => element.remove(), 200);
    };
    element.addEventListener('click', dismiss);
    this.root.append(element);

    const timeout = window.setTimeout(() => {
      this.#timers.delete(timeout);
      dismiss();
    }, durationMs);
    this.#timers.add(timeout);

    // Keep the stack short.
    while (this.root.childElementCount > 4) this.root.firstElementChild?.remove();
  }

  dispose(): void {
    for (const timer of this.#timers) window.clearTimeout(timer);
    this.#timers.clear();
    this.root.remove();
  }
}
