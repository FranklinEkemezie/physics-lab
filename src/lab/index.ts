/**
 * The bench: the catalogue of apparatus, the placement rules, and the drag and
 * drop interactions.
 *
 * A practical only ever talks to {@link Lab} — it asks for an apparatus id and
 * gets back an object on the bench. That indirection is what lets the same
 * practical run on a differently-stocked bench, and what makes the catalogue
 * the single place to add a new instrument.
 */
export * from './Lab';
export * from './catalog';
export * from './types';
