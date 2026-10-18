/**
 * The control panel for the bar-magnet field practical.
 *
 * Pure DOM: it knows nothing about the field, the rig or the camera. The
 * experiment hands it a {@link MagnetControlsModel} and gets back a
 * refresh/dispose pair so every read-out — the compass's position on the
 * scale, the verdicts on the two entry fields — stays in step with the bench.
 * The panel owns nothing disposable of its own, but it keeps the same handle
 * shape as the other practicals so the orchestrator reads the same either way.
 */

import { button, card, h, note, numberField, stat, toggle } from '@/ui/widgets';
import type { NumberFieldWidget } from '@/ui/widgets';
import type { ReadingField, ReadingStatus } from './MagnetReading';

/** Live state the panel displays. */
export interface MagnetSnapshot {
  /** Earth's horizontal field at the bench, in microtesla. Fixed for a run. */
  earthFieldUT: number;
  showGuide: boolean;
  showFilings: boolean;
  /** Distance read or typed, in centimetres; null when the entry is empty. */
  dCm: number | null;
  /** Needle deflection read or typed, in degrees; null when empty. */
  thetaDeg: number | null;
  /** Where the compass currently sits on the printed scale. */
  position: { text: string; tone: 'default' | 'good' | 'warn' };
}

/** Everything the panel can ask of the experiment, and everything it shows. */
export interface MagnetControlsModel {
  // --- Apparatus ---
  walkStep(): void;
  newLine(): void;
  rubOutLines(): void;
  squareUp(): void;
  setShowGuide(on: boolean): void;
  setShowFilings(on: boolean): void;

  // --- Reading the scale ---
  /** Copy the scale and needle readings into the entry fields. */
  takeReading(): void;
  setTypedReading(field: ReadingField, value: number | null): void;
  readingStatus(field: ReadingField): ReadingStatus;

  // --- Recording ---
  record(): void;

  snapshot(): MagnetSnapshot;
}

/**
 * The mounted panel. The magnet panel is pure DOM and owns nothing that needs
 * releasing, but the handle keeps a `dispose` so the orchestrator can treat it
 * exactly like the pendulum's.
 */
export interface MagnetControlsHandle {
  /** Push the current model values into the widgets. */
  refresh(): void;
  /** Release the panel's own resources (the magnet panel owns none). */
  dispose(): void;
}

/** Mount the panel and hand back the refresh/dispose pair. */
export function mountMagnetControls(
  container: HTMLElement,
  model: MagnetControlsModel,
): MagnetControlsHandle {
  container.replaceChildren();
  const initial = model.snapshot();

  // ---- 1. Apparatus -----------------------------------------------------
  const apparatus = card('Plotting the field', { glyph: '🧭' });
  apparatus.body.append(
    note(
      'The needle points along the resultant of the magnet and the Earth, so every pencil mark you walk out is a real field line.',
      'info',
    ),
  );

  const bar = h('div', { class: 'pl-btnrow' });
  bar.append(
    button({
      label: 'Walk one step',
      glyph: '👣',
      variant: 'primary',
      title: 'Advance the compass 1 cm along the needle and leave a pencil mark (W)',
      onClick: () => model.walkStep(),
    }).root,
  );
  bar.append(
    button({
      label: 'New line',
      glyph: '✏️',
      title: 'Finish this pencil line and start a fresh one (N)',
      onClick: () => model.newLine(),
    }).root,
  );
  apparatus.body.append(bar);

  const bar2 = h('div', { class: 'pl-btnrow' });
  bar2.append(
    button({
      label: 'Rub out lines',
      glyph: '🧹',
      title: 'Clear every pencil line',
      onClick: () => model.rubOutLines(),
    }).root,
  );
  bar2.append(
    button({
      label: 'Square up',
      glyph: '👁',
      title: 'Look straight down on the paper',
      onClick: () => model.squareUp(),
    }).root,
  );
  apparatus.body.append(bar2);

  const guideToggle = toggle({
    label: 'Training wheels — draw the whole field line',
    hint: 'Shows the complete field line through the compass (dashed). Turn it off in exam conditions and plot the line yourself.',
    value: initial.showGuide,
    onChange: (value) => model.setShowGuide(value),
  });
  apparatus.body.append(guideToggle.root);

  const filingsToggle = toggle({
    label: 'Lay the iron-filings card over the magnet',
    hint: 'Sprinkle-on-a-card view of the same dipole field.',
    value: initial.showFilings,
    onChange: (value) => model.setShowFilings(value),
  });
  apparatus.body.append(filingsToggle.root);

  apparatus.body.append(
    stat('Earth\'s horizontal field', `${initial.earthFieldUT.toFixed(0)} µT`).root,
  );

  container.append(apparatus.root);

  // ---- 2. Reading the scale --------------------------------------------
  const reading = card('Reading the scale and the needle', { glyph: '📏' });
  reading.body.append(
    note(
      'Read the distance d from the printed centimetre scale and the deflection θ of the red end of the needle from N. The table stores d in metres.',
      'info',
    ),
  );

  const positionStat = stat('Compass on the scale', '—');
  reading.body.append(positionStat.root);

  const takeRow = h('div', { class: 'pl-btnrow' });
  takeRow.append(
    button({
      label: 'Use this reading',
      glyph: '🔍',
      variant: 'primary',
      title: 'Copy the scale distance and the needle deflection into the fields below',
      onClick: () => model.takeReading(),
    }).root,
  );
  reading.body.append(takeRow);

  // Keep what the student has committed, so a refresh never wipes a
  // half-typed number. The NaN sentinel means the first refresh formats both
  // fields from the model, exactly as a rebuild used to.
  let lastD: number | null = Number.NaN;
  let lastTheta: number | null = Number.NaN;
  let lastDStatus = '';
  let lastThetaStatus = '';

  const dField = numberField({
    label: 'Distance d from the centre',
    unit: 'cm',
    step: 0.05,
    decimals: 2,
    value: initial.dCm,
    placeholder: 'read from the scale',
    hint: 'Measured along the equatorial line, from the centre of the magnet.',
    onCommit: (value) => {
      // Record what was typed before refreshing, so the field is not
      // reformatted under the student's fingers.
      lastD = value;
      model.setTypedReading('d', value);
    },
  });
  const thetaField = numberField({
    label: 'Deflection θ of the needle',
    unit: '°',
    step: 1,
    decimals: 0,
    value: initial.thetaDeg,
    placeholder: 'read from the card',
    hint: 'Angle between the red end of the needle and the N mark.',
    onCommit: (value) => {
      lastTheta = value;
      model.setTypedReading('theta', value);
    },
  });
  reading.body.append(dField.root, thetaField.root);

  reading.body.append(
    note(
      'Where the magnet\'s field is comparable to the Earth\'s the needle swings a long way round — that is the part of the paper where the reading is most sensitive, and where the graph is best defined.',
      'info',
    ),
  );

  container.append(reading.root);

  // ---- 3. Record --------------------------------------------------------
  const record = card('Record the reading', { glyph: '📝' });
  record.body.append(
    button({
      label: 'Record reading',
      glyph: '➕',
      variant: 'primary',
      title: 'Add d, θ, 1/d³ and tan θ to the table (Enter)',
      onClick: () => model.record(),
    }).root,
  );
  record.body.append(
    note('1/d³ and tan θ are computed for you. Keep the compass on the equatorial line or the graph will bend.', 'info'),
  );
  container.append(record.root);

  // -------------------------------------------------------------------------

  /** Push the model's reading into the field, unless it is being typed into. */
  const syncField = (field: NumberFieldWidget, value: number | null, last: number | null): number | null => {
    if (value === last) return last;
    const input = field.root.querySelector('input');
    if (input && document.activeElement === input) return last;
    field.setValue(value);
    return value;
  };

  /** Only touch the field's status when the verdict actually changes. */
  const applyStatus = (field: NumberFieldWidget, status: ReadingStatus, last: string): string => {
    const key = `${status.level}|${status.detail ?? ''}`;
    if (key === last) return last;
    field.setStatus(status.level, status.detail);
    return key;
  };

  const refresh = (): void => {
    const snapshot = model.snapshot();

    // --- Apparatus ---
    guideToggle.setValue(snapshot.showGuide);
    filingsToggle.setValue(snapshot.showFilings);
    positionStat.set(snapshot.position.text, snapshot.position.tone);

    // --- Reading the scale ---
    lastD = syncField(dField, snapshot.dCm, lastD);
    lastTheta = syncField(thetaField, snapshot.thetaDeg, lastTheta);
    lastDStatus = applyStatus(dField, model.readingStatus('d'), lastDStatus);
    lastThetaStatus = applyStatus(thetaField, model.readingStatus('theta'), lastThetaStatus);
  };

  refresh();
  return {
    refresh,
    dispose: () => {
      /* the panel owns nothing that needs releasing */
    },
  };
}
