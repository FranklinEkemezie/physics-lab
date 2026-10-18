/**
 * Hooke's law and helical springs.
 *
 * A real spring is linear only up to its **elastic limit**: pull it harder and
 * it yields, then it either breaks or comes back permanently stretched. The
 * lab models the linear region exactly (`F = kx`) and bends the curve past the
 * limit, because "why does my graph stop being a straight line?" is one of the
 * things the practical is meant to teach.
 */

/** A helical spring, reduced to the numbers that matter on the bench. */
export interface Spring {
  /** Stiffness (spring constant) in N/m. */
  stiffnessNm: number;
  /** Un-stretched length in metres. */
  naturalLengthM: number;
  /** Load beyond which the spring stops obeying Hooke's law, in newtons. */
  elasticLimitN: number;
}

/** One reading from the practical: a load and the extension it produced. */
export interface SpringReading {
  loadN: number;
  extensionM: number;
  /** True when this load took the spring past its elastic limit. */
  beyondLimit: boolean;
}

/** Extension predicted by Hooke's law, `F = kx` → `x = F/k`. */
export function extensionForLoad(loadN: number, stiffnessNm: number): number {
  if (stiffnessNm <= 0) return Number.NaN;
  return loadN / stiffnessNm;
}

/** The load that produces a given extension: `F = kx`. */
export function loadForExtension(extensionM: number, stiffnessNm: number): number {
  return stiffnessNm * extensionM;
}

/**
 * Extension of a *real* spring.
 *
 * Up to the elastic limit the spring is linear. Beyond it the spring yields:
 * the extra extension needed per extra newton grows (a softer tail), which is
 * exactly the curve a student sees if they overload their spring.
 */
export function realExtensionM(spring: Spring, loadN: number): number {
  const { stiffnessNm, elasticLimitN } = spring;
  const linearM = extensionForLoad(Math.min(loadN, elasticLimitN), stiffnessNm);
  if (loadN <= elasticLimitN) return linearM;

  // Yielded region: the effective stiffness drops to ~35 % of its elastic value.
  const overloadN = loadN - elasticLimitN;
  return linearM + overloadN / (stiffnessNm * 0.35);
}

/** A single reading from hanging `loadN` on `spring`. */
export function springReadingM(spring: Spring, loadN: number): SpringReading {
  return {
    loadN,
    extensionM: realExtensionM(spring, loadN),
    beyondLimit: loadN > spring.elasticLimitN,
  };
}

/** Stiffness recovered from the gradient of a load-versus-extension graph. */
export function stiffnessFromGradient(gradientNmPerM: number): number {
  return gradientNmPerM;
}

/** Elastic potential energy stored in a spring: `E = ½kx²`. */
export function elasticPotentialEnergy(stiffnessNm: number, extensionM: number): number {
  return 0.5 * stiffnessNm * extensionM * extensionM;
}

/**
 * Period of a mass bobbing on the spring: `T = 2π√(m/k)`.
 *
 * A bonus measurement a strong candidate can make with the same spring, and a
 * second, independent route to `k`.
 */
export function springPeriodS(massKg: number, stiffnessNm: number): number {
  if (stiffnessNm <= 0) return Number.NaN;
  return 2 * Math.PI * Math.sqrt(massKg / stiffnessNm);
}

/** Stiffness of springs joined end to end: `1/k = Σ 1/kᵢ`. */
export function seriesStiffness(...stiffnesses: number[]): number {
  const reciprocalSum = stiffnesses.reduce((sum, k) => sum + 1 / k, 0);
  return reciprocalSum === 0 ? Number.NaN : 1 / reciprocalSum;
}

/** Stiffness of springs joined side by side: `k = Σ kᵢ`. */
export function parallelStiffness(...stiffnesses: number[]): number {
  return stiffnesses.reduce((sum, k) => sum + k, 0);
}
