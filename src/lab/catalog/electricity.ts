/**
 * Electricity equipment definitions.
 */

import type { EquipmentDefinition } from '../types';

import {
  KnifeSwitchModel,
  LampModel,
  MeterModel,
  MultimeterModel,
  PatchLead,
  RheostatModel,
  buildDryCell,
  buildResistor,
} from '../../engine/models/electricity';
import { withUpdate } from './helpers';

export const ELECTRICITY_EQUIPMENT: EquipmentDefinition[] = [
  {
    id: 'dry-cell',
    name: 'Dry cell (1.5 V)',
    group: 'electricity',
    summary: '1.5 V cell, 0.6 Ω internal resistance.',
    glyph: '🔋',
    keywords: ['cell', 'battery', 'emf', 'voltage'],
    footprintM: 0.02,
    build: () => buildDryCell(1.5),
  },
  {
    id: 'ammeter',
    name: 'Ammeter (0 – 1 A)',
    group: 'electricity',
    summary: 'Moving-coil ammeter, 0.5 Ω internal.',
    glyph: '🅰️',
    keywords: ['ammeter', 'current', 'meter'],
    footprintM: 0.06,
    build: () => {
      const meter = new MeterModel({ label: 'AMMETER', unit: 'A', fullScale: 1, redline: 0.9 }, 0.5);
      return meter.group;
    },
  },
  {
    id: 'voltmeter',
    name: 'Voltmeter (0 – 5 V)',
    group: 'electricity',
    summary: 'Moving-coil voltmeter, 1000 Ω internal.',
    glyph: '🆅',
    keywords: ['voltmeter', 'voltage', 'meter'],
    footprintM: 0.06,
    build: () => {
      const meter = new MeterModel({ label: 'VOLTMETER', unit: 'V', fullScale: 5, redline: 4.5 }, 1000);
      return meter.group;
    },
  },
  {
    id: 'galvanometer',
    name: 'Galvanometer',
    group: 'electricity',
    summary: 'Centre-zero detector for null methods.',
    glyph: '🧭',
    keywords: ['galvanometer', 'null', 'detector'],
    footprintM: 0.06,
    build: () => {
      const meter = new MeterModel({ label: 'GALVANOMETER', unit: 'mA', fullScale: 50, redline: 40 }, 40);
      return meter.group;
    },
  },
  {
    id: 'multimeter',
    name: 'Digital multimeter',
    group: 'electricity',
    summary: 'Volts, amps and ohms on one LCD face.',
    glyph: '📟',
    keywords: ['multimeter', 'digital', 'dmm'],
    footprintM: 0.05,
    build: () => new MultimeterModel().group,
  },
  {
    id: 'rheostat',
    name: 'Rheostat (0 – 20 Ω)',
    group: 'electricity',
    summary: 'Sliding-contact variable resistor.',
    glyph: '🎛️',
    keywords: ['rheostat', 'variable', 'resistor', 'potentiometer'],
    footprintM: 0.09,
    build: () => {
      const model = new RheostatModel(20, 0.14);
      // Experiments drive the sliding contact through this handle.
      model.group.userData.rheostatModel = model;
      return model.group;
    },
  },
  {
    id: 'knife-switch',
    name: 'Switch',
    group: 'electricity',
    summary: 'Single-pole knife switch on a wooden base.',
    glyph: '🔘',
    keywords: ['switch', 'key', 'knife'],
    footprintM: 0.05,
    build: () => {
      const model = new KnifeSwitchModel();
      model.group.userData.switchModel = model;
      return withUpdate(model.group, (dt) => model.update(dt));
    },
  },
  {
    id: 'resistor-10',
    name: 'Resistor 10 Ω',
    group: 'electricity',
    summary: 'Carbon film, 5 % tolerance. Brown-black-black.',
    glyph: '🟤',
    keywords: ['resistor', 'ohms'],
    footprintM: 0.01,
    build: () => buildResistor(10),
  },
  {
    id: 'resistor-47',
    name: 'Resistor 47 Ω',
    group: 'electricity',
    summary: 'Carbon film, 5 % tolerance. Yellow-violet-black.',
    glyph: '🟡',
    keywords: ['resistor', 'ohms'],
    footprintM: 0.01,
    build: () => buildResistor(47),
  },
  {
    id: 'resistor-100',
    name: 'Resistor 100 Ω',
    group: 'electricity',
    summary: 'Carbon film, 5 % tolerance. Brown-black-brown.',
    glyph: '🟠',
    keywords: ['resistor', 'ohms'],
    footprintM: 0.01,
    build: () => buildResistor(100),
  },
  {
    id: 'lamp',
    name: 'Lamp (2.5 V, 0.3 W)',
    group: 'electricity',
    summary: 'Tungsten filament: resistance rises as it heats.',
    glyph: '💡',
    keywords: ['lamp', 'bulb', 'filament', 'light'],
    footprintM: 0.02,
    build: () => {
      const lamp = new LampModel(2.5, 0.3);
      lamp.group.userData.lampModel = lamp;
      return lamp.group;
    },
  },
  {
    id: 'lead-red',
    name: 'Connecting lead (red)',
    group: 'electricity',
    summary: 'Patch lead with crocodile clips at both ends.',
    glyph: '🔴',
    keywords: ['lead', 'wire', 'crocodile', 'cable'],
    footprintM: 0.1,
    build: () => new PatchLead('#c0392b', 0.3).group,
  },
  {
    id: 'lead-black',
    name: 'Connecting lead (black)',
    group: 'electricity',
    summary: 'Patch lead with crocodile clips at both ends.',
    glyph: '⚫',
    keywords: ['lead', 'wire', 'crocodile', 'cable'],
    footprintM: 0.1,
    build: () => new PatchLead('#1f2226', 0.3).group,
  },
];
