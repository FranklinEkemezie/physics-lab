/** The apparatus shelf of the model library. */

import type { ModelEntry } from '../types';
import { KNIFE_EDGE_MODEL } from './knifeEdge';
import { PULLEY_MODEL } from './pulley';
import { INCLINED_PLANE_MODEL } from './inclinedPlane';
import { POWER_SUPPLY_MODEL } from './powerSupply';
import {
  BEAKER_MODEL,
  BOMB_CALORIMETER_MODEL,
  BUNSEN_MODEL,
  THERMOMETER_MODEL,
  TRIPOD_MODEL,
} from './thermal';

export * from './knifeEdge';
export * from './pulley';
export * from './inclinedPlane';
export * from './powerSupply';
export * from './thermal';

export const APPARATUS_MODELS: readonly ModelEntry[] = [
  KNIFE_EDGE_MODEL,
  PULLEY_MODEL,
  INCLINED_PLANE_MODEL,
  THERMOMETER_MODEL,
  BOMB_CALORIMETER_MODEL,
  BEAKER_MODEL,
  TRIPOD_MODEL,
  BUNSEN_MODEL,
  POWER_SUPPLY_MODEL,
];
