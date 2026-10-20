/**
 * Thermal equipment definitions.
 *
 * The builders live in the reusable model library, so the same calorimeter and
 * thermometer can be used by the practical, the gallery and any other host.
 */

import type { EquipmentDefinition } from '../types';

import {
  buildBeaker,
  buildBombCalorimeter,
  buildBunsenBurner,
  buildThermometer,
  buildTripod,
} from '../../engine/models/library';
import { buildPowerSupply } from '../../engine/models/library/apparatus/powerSupply';

export const THERMAL_EQUIPMENT: EquipmentDefinition[] = [
  {
    id: 'bomb-calorimeter',
    name: 'Bomb calorimeter',
    group: 'thermal',
    summary: 'Steel bomb, water jacket, lid, stirrer and an electric heater coil.',
    glyph: '🧪',
    keywords: ['calorimeter', 'bomb', 'heat', 'specific heat', 'water', 'jacket'],
    footprintM: 0.14,
    build: () => buildBombCalorimeter({ waterMassKg: 0.4 }),
  },
  {
    id: 'thermometer',
    name: 'Thermometer (−10 to 110 °C)',
    group: 'thermal',
    summary: 'Mercury-in-glass thermometer with 1 °C graduations, read to 0.1 °C.',
    glyph: '🌡️',
    keywords: ['temperature', 'mercury', 'heat', 'reading'],
    footprintM: 0.02,
    build: () => buildThermometer(),
  },
  {
    id: 'power-supply',
    name: 'Bench power supply',
    group: 'thermal',
    summary: 'Variable d.c. supply with a green LCD, 0–15 V and 0–5 A.',
    glyph: '🔌',
    keywords: ['supply', 'voltage', 'current', 'heater', 'dc', 'power'],
    footprintM: 0.14,
    build: () => buildPowerSupply({ voltageV: 12, currentA: 3.5 }),
  },
  {
    id: 'beaker-250',
    name: 'Beaker (250 cm³)',
    group: 'thermal',
    summary: 'Thin-walled glass beaker with a graduated scale.',
    glyph: '🥛',
    keywords: ['beaker', 'glass', 'water', 'volume'],
    footprintM: 0.05,
    build: () => buildBeaker({ capacityMl: 250 }),
  },
  {
    id: 'tripod',
    name: 'Tripod stand',
    group: 'thermal',
    summary: 'Three-legged stand for heating a beaker over a burner.',
    glyph: '🔺',
    keywords: ['tripod', 'stand', 'gauze', 'heat'],
    footprintM: 0.12,
    build: () => buildTripod(),
  },
  {
    id: 'bunsen-burner',
    name: 'Bunsen burner',
    group: 'thermal',
    summary: 'Gas burner with an air hole and a blue flame when lit.',
    glyph: '🔥',
    keywords: ['bunsen', 'burner', 'flame', 'gas', 'heat'],
    footprintM: 0.06,
    build: () => buildBunsenBurner(),
  },
];
