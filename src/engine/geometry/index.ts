/**
 * Geometry helpers used by every procedural model.
 *
 * The lab's apparatus is *built from code* rather than loaded from binary
 * assets. That keeps the repository text-only, makes every dimension
 * inspectable and tweakable, and lets models be parameterised (a 50 cm rule
 * and a 1 m rule are the same builder with a different argument).
 */

export * from './buffers';
export * from './primitives';
export * from './curves';
export * from './textures';
