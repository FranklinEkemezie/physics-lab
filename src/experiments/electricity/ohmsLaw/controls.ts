/**
 * The control panel for the e.m.f./internal-resistance practical.
 *
 * Pure DOM: it knows nothing about the circuit. The experiment hands it a
 * {@link OhmsControlsModel} and gets back a `refresh` callback so the meter
 * read-outs stay live while the rheostat is dragged.
 */

import { button, card, note, slider, stat } from '@/ui/widgets';
import { CIRCUIT_RIG } from './CircuitRig';

/** Live state the panel displays. */
export interface OhmsSnapshot {
  switchClosed: boolean;
  rheostatOhm: number;
  currentA: number;
  voltageV: number;
  powerW: number;
  canRecord: boolean;
  recorded: number;
}

export interface OhmsControlsModel {
  setRheostat(ohms: number): void;
  setSwitchClosed(closed: boolean): void;
  record(): void;
  snapshot(): OhmsSnapshot;
}

/** Mount the panel and return a function that refreshes its read-outs. */
export function mountOhmsControls(container: HTMLElement, model: OhmsControlsModel): () => void {
  container.replaceChildren();

  const currentStat = stat('Ammeter', '—', 'Current through the rheostat.');
  const voltageStat = stat('Voltmeter', '—', 'Terminal p.d. of the cell.');
  const powerStat = stat('Rheostat power', '—', 'P = I²R — how hard the rheostat is working.');

  const switchButton = button({
    label: 'Open switch',
    variant: 'ghost',
    glyph: '🎚️',
    title: 'Break the circuit',
    onClick: () => model.setSwitchClosed(!model.snapshot().switchClosed),
  });

  const rheostatSlider = slider({
    label: 'Rheostat',
    min: 0,
    max: CIRCUIT_RIG.maxRheostatOhm,
    step: 0.5,
    value: model.snapshot().rheostatOhm,
    unit: ' Ω',
    decimals: 1,
    hint: 'Slide to change the current. Six well-spread settings make a good graph.',
    onInput: (value) => model.setRheostat(value),
  });

  const recordButton = button({
    label: 'Record V and I',
    variant: 'primary',
    glyph: '✏️',
    title: 'Read both meters and add the pair to the table',
    onClick: () => model.record(),
  });

  const recordedStat = stat('Recorded readings', '0');

  const circuitCard = card('Circuit', { glyph: '🔌' });
  circuitCard.body.append(
    currentStat.root,
    voltageStat.root,
    powerStat.root,
    switchButton.root,
    note('The voltmeter is across the cell; the ammeter is in series with the rheostat.', 'info'),
  );

  const rheostatCard = card('Rheostat setting', { glyph: '🎛️' });
  rheostatCard.body.append(rheostatSlider.root);

  const recordCard = card('Recording', { glyph: '📝' });
  recordCard.body.append(
    recordButton.root,
    recordedStat.root,
    note('Change the rheostat, then record V and I together, without changing anything in between.', 'info'),
  );

  container.append(circuitCard.root, rheostatCard.root, recordCard.root);

  const refresh = (): void => {
    const snapshot = model.snapshot();
    currentStat.set(`${snapshot.currentA.toFixed(2)} A`);
    voltageStat.set(`${snapshot.voltageV.toFixed(2)} V`);
    powerStat.set(`${snapshot.powerW.toFixed(2)} W`, snapshot.powerW > 2 ? 'warn' : 'default');
    switchButton.setLabel(snapshot.switchClosed ? 'Open switch' : 'Close switch');
    switchButton.setActive(snapshot.switchClosed);
    recordedStat.set(String(snapshot.recorded));
    recordButton.setDisabled(!snapshot.canRecord);
  };

  refresh();
  return refresh;
}
