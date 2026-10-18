/**
 * Every piece of apparatus the lab can build.
 *
 * Grouped by topic so the catalogue and the sidebar can ask for just the
 * electricity models, say, without dragging the optics in. The flat modules at
 * this level are the general-purpose pieces (a rule, a stand, a stopwatch) that
 * belong to no one topic.
 */
export * from './electricity';
export * from './magnetism';
export * from './masses';
export * from './optics';
export * from './pendulum';
export * from './rule';
export * from './stand';
export * from './stopwatch';
