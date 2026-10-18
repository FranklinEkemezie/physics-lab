/**
 * Tiny DOM widget helpers.
 *
 * The lab deliberately uses no UI framework: the whole interface is a handful
 * of panels, and plain DOM keeps the bundle small and the behaviour obvious.
 * Every helper returns a small handle object with setters, so callers can
 * update a widget without rebuilding it.
 */

export * from './dom';
export type { Widget } from './base';
export * from './buttons';
export * from './inputs';
export * from './display';
