/** The widget handle contract and its shared base implementation. */

export interface Widget {
  readonly root: HTMLElement;
  setDisabled(disabled: boolean): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

/** Base class handling the boring parts of the {@link Widget} contract. */
export abstract class BaseWidget implements Widget {
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
