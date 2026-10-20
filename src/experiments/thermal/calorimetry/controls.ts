/**
 * Control panel for the bomb-calorimeter practical.
 *
 * Pure DOM: it receives a small model, renders the heater switch, the
 * thermometer read-out and the recording controls, and returns a `refresh`
 * closure. It knows nothing about the physics or the 3D apparatus.
 */

import { button, card, h, note, stat, toggle } from '@/ui/widgets';

/** Live state the panel displays. */
export interface CalorimetrySnapshot {
  /** Simulated lab time since the run started, in seconds. */
  timeS: number;
  /** Thermometer reading, °C. */
  readingC: number;
  /** Rise since the first recorded reading, °C. */
  deltaTC: number;
  heating: boolean;
  /** Electrical power, W. */
  powerW: number;
  /** Mass of water in the calorimeter, kg (the balance reading). */
  waterMassKg: number;
  autoRecord: boolean;
  recorded: number;
  canRecord: boolean;
  /** Five minutes of heating has been done. */
  enoughData: boolean;
}

export interface CalorimetryControlsModel {
  setHeating(on: boolean): void;
  record(): void;
  setAutoRecord(on: boolean): void;
  snapshot(): CalorimetrySnapshot;
}

export function mountCalorimetryControls(
  container: HTMLElement,
  model: CalorimetryControlsModel,
): () => void {
  container.replaceChildren();

  const initial = model.snapshot();

  const clock = h('div', { class: 'pl-stopwatch-display' }, '0.0 s');
  const massStat = stat('Water mass', '—', 'Read from the balance before the water goes into the bomb.');
  const temperatureStat = stat('Thermometer', '—', 'Read the column at eye level, to the nearest 0.1 °C.');
  const riseStat = stat('Temperature rise Δθ', '—', 'Measured from the first reading you recorded.');
  const powerStat = stat('Heater power', '—', 'P = VI. The supply holds these values steady.');

  const heaterButton = button({
    label: 'Switch on heater',
    variant: 'primary',
    glyph: '🔥',
    title: 'Energise the heater coil',
    onClick: () => model.setHeating(!model.snapshot().heating),
  });

  const thermometerCard = card('Calorimeter', { glyph: '🌡️' });
  thermometerCard.body.append(
    clock,
    massStat.root,
    temperatureStat.root,
    riseStat.root,
    note('The clock and the heating run 10× faster than bench time, so a five-minute run takes 30 seconds.', 'info'),
  );

  const heaterCard = card('Heater', { glyph: '⚡' });
  heaterCard.body.append(
    powerStat.root,
    heaterButton.root,
    note('Check the supply: 12 V across the coil, about 3.5 A through it.', 'info'),
  );

  const autoToggle = toggle({
    label: 'Take a reading every 30 s',
    hint: 'A datalogger, so you can watch the thermometer instead of the clock.',
    value: initial.autoRecord,
    onChange: (value) => model.setAutoRecord(value),
  });

  const recordButton = button({
    label: 'Record reading',
    variant: 'default',
    glyph: '✏️',
    title: 'Add the current time and temperature to the table',
    onClick: () => model.record(),
  });

  const recordedStat = stat('Recorded readings', '0');

  const recordCard = card('Recording', { glyph: '📝' });
  recordCard.body.append(
    autoToggle.root,
    recordButton.root,
    recordedStat.root,
    note('Five minutes gives eleven readings. Plot Δθ against t and use the initial straight part.', 'info'),
  );

  container.append(thermometerCard.root, heaterCard.root, recordCard.root);

  const refresh = (): void => {
    const snapshot = model.snapshot();

    clock.textContent = `${snapshot.timeS.toFixed(1)} s`;
    massStat.set(`${(snapshot.waterMassKg * 1000).toFixed(1)} g`);
    temperatureStat.set(`${snapshot.readingC.toFixed(1)} °C`);
    riseStat.set(
      `${snapshot.deltaTC >= 0 ? '+' : '−'}${Math.abs(snapshot.deltaTC).toFixed(1)} °C`,
      snapshot.deltaTC > 0 ? 'good' : 'default',
    );
    powerStat.set(
      `${snapshot.powerW.toFixed(1)} W`,
      snapshot.heating ? 'warn' : 'default',
    );

    heaterButton.setLabel(snapshot.heating ? 'Switch off heater' : 'Switch on heater');
    heaterButton.setActive(snapshot.heating);

    recordedStat.set(String(snapshot.recorded));
    recordButton.setDisabled(!snapshot.canRecord);
    autoToggle.setValue(snapshot.autoRecord);
  };

  refresh();
  return refresh;
}
