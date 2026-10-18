/**
 * The practicals, and the register that lists them.
 *
 * This barrel deliberately stops at the register and the shared types. Each
 * topic keeps its own barrel — `./mechanics`, `./magnetism`, `./optics`,
 * `./electricity` — because the practicals have grown their own vocabularies:
 * the pendulum's rule and the magnet's compass each have a `ReadingStatus`, and
 * flattening them into one namespace would make the names a lie.
 */

export * from './types';
export * from './registry';
