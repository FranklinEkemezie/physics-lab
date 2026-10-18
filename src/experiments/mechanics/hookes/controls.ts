/**
 * The control panel for the Hooke's-law practical.
 *
 * Pure DOM: it knows nothing about the spring, the physics or the rig. The
 * experiment hands it a small {@link HookesControlsModel} and gets back a
 * `refresh` callback to keep the read-outs live.
 */

import { button, card, h, note, stat } from '@/ui/widgets';
import { MASS_SET_G } from './SpringRig';

/** Live state the panel displays. */
export interface HookesSnapshot {
  /** Load from the slotted masses only, in N. */
  slottedLoadN: number;
  /** Load including the hanger, in N. */
  totalLoadN: number;
  /** Extension measured from the hanger-only zero, in metres. */
  extensionM: number;
  settled: boolean;
  pastLimit: boolean;
  /** True when there is a mass hung and the spring has settled. */
  canRecord: boolean;
  recorded: number;
}

export interface HookesControlsModel {
  addMass(grams: number): void;
  removeLastMass(): void;
  clearMasses(): void;
  record(): void;
  snapshot(): HookesSnapshot;
}

/** Mount the panel and return a function that refreshes its read-outs. */
export function mountHookesControls(container: HTMLElement, model: HookesControlsModel): () => void {
  container.replaceChildren();

  const loadStat = stat('Load on spring', '—', 'Weight of the hanger plus every slotted mass.');
  const extensionStat = stat('Extension', '—', 'Pointer reading minus the reading with the hanger alone.');
  const stateStat = stat('Spring', '—');
  const recordedStat = stat('Recorded readings', '0');

  const addRow = h(
    'div',
    { class: 'pl-btnrow' },
    ...MASS_SET_G.map((grams) =>
      button({
        label: `+${grams} g`,
        variant: 'ghost',
        title: `Hang another ${grams} g slotted mass`,
        onClick: () => model.addMass(grams),
      }).root,
    ),
  );

  const changeRow = h(
    'div',
    { class: 'pl-btnrow' },
    button({ label: 'Remove last', variant: 'ghost', glyph: '↩️', onClick: () => model.removeLastMass() }).root,
    button({ label: 'Clear all', variant: 'ghost', glyph: '🧹', onClick: () => model.clearMasses() }).root,
  );

  const recordButton = button({
    label: 'Record reading',
    variant: 'primary',
    glyph: '✏️',
    title: 'Take the pointer reading and add it to the table',
    onClick: () => model.record(),
  });

  const massesCard = card('Slotted masses', { glyph: '⚖️' });
  massesCard.body.append(
    loadStat.root,
    addRow,
    changeRow,
    note('The masses are exact. It is the extension you have to measure.', 'info'),
  );

  const readingCard = card('Reading the pointer', { glyph: '📏' });
  readingCard.body.append(
    extensionStat.root,
    stateStat.root,
    recordButton.root,
    recordedStat.root,
    note('Wait for the spring to stop moving before you record.', 'info'),
  );

  container.append(massesCard.root, readingCard.root);

  const refresh = (): void => {
    const snapshot = model.snapshot();
    loadStat.set(`${snapshot.totalLoadN.toFixed(2)} N`, snapshot.pastLimit ? 'warn' : 'default');
    extensionStat.set(`${(snapshot.extensionM * 100).toFixed(1)} cm`);
    stateStat.set(
      snapshot.pastLimit ? 'past elastic limit' : snapshot.settled ? 'settled' : 'settling…',
      snapshot.pastLimit ? 'bad' : snapshot.settled ? 'good' : 'warn',
    );
    recordedStat.set(String(snapshot.recorded));
    recordButton.setDisabled(!snapshot.canRecord);
  };

  refresh();
  return refresh;
}
