/**
 * The composition root: wiring the engine, the bench, the physics and the
 * interface into one page.
 *
 * {@link App} is the only place that knows about all the layers at once, so it
 * is also the only place that has to change if the lab is embedded somewhere
 * else — a host page can mount `new App(container)` and get the whole bench, or
 * skip this folder entirely and compose the subsystems itself.
 */
export * from './App';
export * from './DataStore';
