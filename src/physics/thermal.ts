/**
 * Thermal expansion.
 *
 * A wooden metre rule really does change length with temperature: a 100 cm rule
 * at 40 °C is about 0.06 mm longer than at 20 °C. Tiny, but the lab models it
 * rather than pretending it does not happen.
 */

/**
 * Length of a body after a temperature change.
 * @param expansionPerC Coefficient of linear expansion, per °C.
 */
export function thermalLength(baseLengthM: number, expansionPerC: number, deltaTC: number): number {
  return baseLengthM * (1 + expansionPerC * deltaTC);
}
