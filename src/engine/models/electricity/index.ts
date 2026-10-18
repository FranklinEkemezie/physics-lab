/**
 * Electricity apparatus: cells, moving-coil meters, rheostats, switches,
 * resistors, lamps and patch leads.
 *
 * The meters are *real* instruments — a `MeterModel` owns a needle that swings
 * to the reading you give it, with a mirrored dial and a redline, so an
 * experiment can drive them with the same quantities it computes.
 */

export * from './meter';
export * from './cell';
export * from './lamp';
export * from './rheostat';
export * from './switch';
export * from './resistor';
export * from './patchLead';
export * from './multimeter';
