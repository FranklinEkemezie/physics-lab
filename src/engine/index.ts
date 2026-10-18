/**
 * The 3-D engine: everything that knows about Three.js but nothing about
 * physics or practicals.
 *
 * The layering is deliberate. {@link Viewport} owns the renderer and the frame
 * loop, {@link LabRoom} owns the bench and the lighting, `materials` and
 * `geometry` are the shared drawing kit, and `models` builds the individual
 * pieces of apparatus. Nothing here imports an experiment, so the same engine
 * could drive a chemistry bench or a geometry demo by swapping the catalogue.
 */

export * from './CanvasPanel';
export * from './LabRoom';
export * from './Viewport';
export * from './geometry';
export * from './materials';
export * from './models';
