/**
 * Measurement: the instruments, the observer, and the errors they introduce.
 *
 * Everything that turns a perfect simulation into a realistic set of readings
 * lives here — reaction times, parallax, reading resolution — kept apart from
 * the ideal physics it corrupts.
 */
export * from './readings';
export * from './parallax';
export * from './stopwatch';
export * from './reactionTime';
