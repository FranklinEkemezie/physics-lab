/**
 * A tiny, dependency-free publish/subscribe event bus.
 *
 * The lab is made of many parts that must not know about each other: 3D
 * instruments, the measurement table, the graph, the sidebar... They all
 * communicate through this bus instead of holding direct references.
 *
 * @example
 * ```ts
 * const bus = new EventBus<AppEvents>();
 * const off = bus.on('reading:add', (row) => console.log(row));
 * bus.emit('reading:add', row);
 * off(); // unsubscribe
 * ```
 */

export type Listener<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  readonly #listeners = new Map<keyof Events, Set<(payload: never) => void>>();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let bucket = this.#listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      this.#listeners.set(event, bucket);
    }
    bucket.add(listener as (payload: never) => void);
    return () => this.off(event, listener);
  }

  /** Subscribe for exactly one delivery, then auto-unsubscribe. */
  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  /** Remove a previously registered listener. */
  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.#listeners.get(event)?.delete(listener as (payload: never) => void);
  }

  /** Publish an event to every current listener. */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const bucket = this.#listeners.get(event);
    if (!bucket) return;
    // Copy first: a listener may unsubscribe while we iterate.
    for (const listener of [...bucket]) {
      (listener as Listener<Events[K]>)(payload);
    }
  }

  /** Remove every listener (optionally only for one event). */
  clear(event?: keyof Events): void {
    if (event === undefined) this.#listeners.clear();
    else this.#listeners.delete(event);
  }
}
