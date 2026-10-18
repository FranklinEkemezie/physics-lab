/**
 * The control panel for the simple-pendulum practical.
 *
 * Pure DOM: it knows nothing about the swing, the physics or the camera. The
 * experiment hands it a {@link PendulumControlsModel} and gets back a `refresh`
 * callback so every read-out — the length, the parallax note, the start button
 * — stays in step with the bench. The reading lens lives here too, because it
 * is a piece of interface rather than a piece of apparatus.
 */

import { button, card, h, note, numberField, segmented, select, slider, stat, toggle } from '@/ui/widgets';
import type { ButtonWidget, NumberFieldWidget } from '@/ui/widgets';
import { ReadingLens } from '@/ui/ReadingLens';
import type { LensMarker } from '@/ui/ReadingLens';
import { LOCATIONS } from '@/physics/constants';
import { RIG } from './PendulumRig';
import type { LengthReading, ReadingStatus, ReadingTarget } from './PendulumReading';

/** Radians to degrees, kept local so the panel needs no Three.js. */
const RAD_TO_DEG = 180 / Math.PI;

/** Live state the panel displays. */
export interface PendulumSnapshot {
  // --- Apparatus ---
  threadLengthM: number;
  clampHeightM: number;
  releaseAngleDeg: number;
  locationId: string;
  draught: boolean;
  showSwingCounter: boolean;
  // --- Timing ---
  stopwatchElapsedS: number;
  stopwatchRunning: boolean;
  oscillations: number;
  timeScale: number;
  /** Completed oscillations, mirrored from the HUD chips. */
  completedSwings: number;
  /** Current swing amplitude, in degrees, mirrored from the HUD chips. */
  amplitudeDeg: number;
  // --- Reading ---
  readingTarget: ReadingTarget;
  reading: LengthReading;
  measuredLengthM: number | null;
  azimuthRad: number;
  /** Where the lens should draw the mark currently being read. */
  lensMarker: LensMarker | null;
}

/** Everything the panel can ask of the experiment, and everything it shows. */
export interface PendulumControlsModel {
  // --- Apparatus ---
  release(): void;
  stopSwing(): void;
  squareUp(): void;
  setThreadLength(lengthM: number): void;
  setClampHeight(heightM: number): void;
  setReleaseAngleDeg(degrees: number): void;
  setLocation(id: string): void;
  setDraught(on: boolean): void;

  // --- Reading the rule ---
  setReadingTarget(target: ReadingTarget): void;
  /** Where the chosen mark appears, in metres above the bench. */
  apparentHeightM(target: ReadingTarget): number;
  /** Copy the lens cursor into the chosen reading. */
  takeReading(target: ReadingTarget, cursorHeightM: number): void;
  setTypedReading(target: ReadingTarget, cm: number | null): void;
  readingStatus(target: ReadingTarget): ReadingStatus;

  // --- Timing ---
  toggleStopwatch(): void;
  resetStopwatch(): void;
  zeroSwings(): void;
  setOscillations(n: number): void;
  setShowSwingCounter(on: boolean): void;
  setTimeScale(scale: number): void;

  // --- Recording ---
  record(): void;

  snapshot(): PendulumSnapshot;
}

/**
 * The mounted panel.
 *
 * Most panels in the lab are pure DOM and need only a `refresh`, but this one
 * owns a {@link ReadingLens} — a canvas with its own pointer listeners — so it
 * also has to be told when to let go. The orchestrator disposes one handle
 * before mounting the next, because the app rebuilds the panel whenever the
 * practical's state changes shape.
 */
export interface PendulumControlsHandle {
  /** Push the current model values into the widgets. */
  refresh(): void;
  /** Release the panel's own resources (the reading lens owns a canvas). */
  dispose(): void;
}

/** Mount the panel and hand back the refresh/dispose pair. */
export function mountPendulumControls(
  container: HTMLElement,
  model: PendulumControlsModel,
): PendulumControlsHandle {
  container.replaceChildren();
  const initial = model.snapshot();

  // ---- 1. Apparatus -----------------------------------------------------
  const apparatus = card('Apparatus', { glyph: '🧰' });
  const bar = h('div', { class: 'pl-btnrow' });

  bar.append(
    button({
      label: 'Release bob',
      glyph: '🎯',
      variant: 'primary',
      title: 'Displace the bob by the chosen angle and let it go',
      onClick: () => model.release(),
    }).root,
  );
  bar.append(
    button({
      label: 'Stop swing',
      glyph: '✋',
      title: 'Bring the bob to rest (R)',
      onClick: () => model.stopSwing(),
    }).root,
  );
  bar.append(
    button({
      label: 'Square up',
      glyph: '👁',
      title: 'Move the camera so you look straight at the metre rule',
      onClick: () => model.squareUp(),
    }).root,
  );
  apparatus.body.append(bar);

  const threadsSlider = slider({
    label: 'Thread paid out of the cork',
    min: RIG.minThreadM,
    max: RIG.maxThreadM,
    step: 0.005,
    value: initial.threadLengthM,
    decimals: 1,
    hint: 'Adjusting the thread is how you change L. Read L from the rule afterwards — never trust the slider.',
    onInput: (value) => model.setThreadLength(value),
  });
  // The absolute length is deliberately not displayed.
  threadsSlider.setReadout(`${((initial.threadLengthM - RIG.minThreadM) * 100).toFixed(1)} cm from minimum`);
  apparatus.body.append(threadsSlider.root);

  const clampSlider = slider({
    label: 'Height of the clamp on the rod',
    min: RIG.minClampHeightM,
    max: RIG.maxClampHeightM,
    step: 0.005,
    value: initial.clampHeightM,
    unit: ' m',
    decimals: 3,
    hint: 'Raising the clamp gives the pendulum more room; it does not change L.',
    onInput: (value) => model.setClampHeight(value),
  });
  apparatus.body.append(clampSlider.root);

  const releaseSlider = slider({
    label: 'Release angle',
    min: 2,
    max: 30,
    step: 1,
    value: initial.releaseAngleDeg,
    unit: '°',
    decimals: 0,
    hint: 'Small angles give a more accurate g. Above ~15° the period grows measurably.',
    onInput: (value) => model.setReleaseAngleDeg(value),
  });
  apparatus.body.append(releaseSlider.root);

  const locationOptions = LOCATIONS.map((location) => ({
    value: location.id,
    label: location.hidden ? '🛸 Planet X (mystery g)' : location.name,
  }));
  const locationSelect = select({
    label: 'Location',
    options: locationOptions,
    value: initial.locationId,
    hint: 'The same apparatus, different gravity. Planet X hides its g until you measure it.',
    onChange: (value) => model.setLocation(value),
  });
  apparatus.body.append(locationSelect.root);

  const draughtToggle = toggle({
    label: 'Window open (draughts)',
    hint: 'Random air currents perturb the swing and scatter your timings.',
    value: initial.draught,
    onChange: (value) => model.setDraught(value),
  });
  apparatus.body.append(draughtToggle.root);

  container.append(apparatus.root);

  // ---- 2. Reading the rule ---------------------------------------------
  const reading = card('Reading the metre rule', { glyph: '📏' });
  reading.body.append(
    note(
      'Read the height of the bottom of the cork and the height of the centre of the bob. L is the difference.',
      'info',
    ),
  );

  // Keep what the student has committed, so a per-frame refresh never wipes a
  // half-typed number. The NaN sentinel means the first refresh formats both
  // fields from the model, exactly as a rebuild used to.
  let lastPivotCm: number | null = Number.NaN;
  let lastBobCm: number | null = Number.NaN;
  let lastPivotStatus = '';
  let lastBobStatus = '';

  const lens = new ReadingLens({ heightPx: 300, windowHeightM: 0.06 });

  const targetSwitch = segmented<'bob' | 'pivot'>({
    label: 'Reading',
    options: [
      { value: 'bob', label: 'Centre of bob' },
      { value: 'pivot', label: 'Bottom of cork' },
    ],
    value: initial.readingTarget,
    onChange: (value) => {
      model.setReadingTarget(value);
      const height = model.apparentHeightM(value);
      lens.centreOn(height);
      lens.setCursor(height);
    },
  });
  reading.body.append(targetSwitch.root);

  const startHeight = model.apparentHeightM(initial.readingTarget);
  lens.centreOn(startHeight);
  lens.setCursor(startHeight);
  reading.body.append(lens.root);

  const takeRow = h('div', { class: 'pl-btnrow' });
  takeRow.append(
    button({
      label: 'Use this reading',
      glyph: '🔍',
      variant: 'primary',
      title: 'Copy the value under the red line into the field below',
      onClick: () => model.takeReading(model.snapshot().readingTarget, lens.cursorHeightM),
    }).root,
  );
  takeRow.append(
    button({
      label: 'Locate mark',
      glyph: '🎯',
      title: 'Centre the lens on the mark being read',
      onClick: () => lens.centreOn(model.apparentHeightM(model.snapshot().readingTarget)),
    }).root,
  );
  reading.body.append(takeRow);

  const pivotField = numberField({
    label: 'Height of suspension point',
    unit: 'cm',
    step: 0.05,
    decimals: 2,
    value: initial.reading.pivotCm,
    placeholder: 'read from the rule',
    onCommit: (value) => {
      model.setTypedReading('pivot', value);
      // The field already shows what was typed, so don't reformat it.
      lastPivotCm = value;
    },
  });
  const bobField = numberField({
    label: 'Height of centre of bob',
    unit: 'cm',
    step: 0.05,
    decimals: 2,
    value: initial.reading.bobCm,
    placeholder: 'read from the rule',
    onCommit: (value) => {
      model.setTypedReading('bob', value);
      lastBobCm = value;
    },
  });
  reading.body.append(pivotField.root, bobField.root);

  const lengthStat = stat('L (from your readings)', '—');
  reading.body.append(lengthStat.root);

  const parallaxNote = h('p', { class: 'pl-slider__hint' });
  reading.body.append(parallaxNote);

  container.append(reading.root);

  // ---- 3. Timing --------------------------------------------------------
  const timing = card('Timing', { glyph: '⏱️' });

  const display = h('div', { class: 'pl-stopwatch-display' }, initial.stopwatchElapsedS.toFixed(2));
  timing.body.append(display);

  const nControl = segmented<string>({
    label: 'Oscillations to time (n)',
    options: ['1', '5', '10', '20'].map((value) => ({ value, label: value })),
    value: String(initial.oscillations),
    onChange: (value) => model.setOscillations(Number(value)),
  });
  timing.body.append(nControl.root);

  const timingRow = h('div', { class: 'pl-btnrow' });
  const startButton = button({
    label: initial.stopwatchRunning ? 'STOP' : 'START',
    glyph: initial.stopwatchRunning ? '⏹' : '▶',
    variant: initial.stopwatchRunning ? 'danger' : 'primary',
    title: 'Start or stop the stopwatch (Space)',
    onClick: () => model.toggleStopwatch(),
  });
  timingRow.append(startButton.root);
  timingRow.append(
    button({
      label: 'Reset',
      glyph: '↺',
      onClick: () => model.resetStopwatch(),
    }).root,
  );
  timingRow.append(
    button({
      label: 'Zero swing',
      glyph: '↔',
      title: 'Reset the oscillation counter (start again from the current position)',
      onClick: () => model.zeroSwings(),
    }).root,
  );
  timing.body.append(timingRow);

  timing.body.append(
    note(
      'Your reaction time (~200 ms) is the biggest error here. Time 10 or 20 swings and always start and stop at the centre of the swing.',
      'info',
    ),
  );

  const counterToggle = toggle({
    label: 'Show swing counter (training wheels)',
    hint: 'Turn off for exam conditions: count the swings yourself.',
    value: initial.showSwingCounter,
    onChange: (value) => model.setShowSwingCounter(value),
  });
  timing.body.append(counterToggle.root);

  const speedRow = segmented<string>({
    label: 'Clock speed',
    options: [
      { value: '1', label: '1×', title: 'Real time' },
      { value: '2', label: '2×' },
      { value: '4', label: '4×', title: 'Fast-forward: the recorded times stay correct' },
    ],
    value: String(initial.timeScale),
    onChange: (value) => model.setTimeScale(Number(value)),
  });
  timing.body.append(speedRow.root);

  container.append(timing.root);

  // ---- 4. Record --------------------------------------------------------
  const record = card('Record the trial', { glyph: '📝' });
  record.body.append(
    button({
      label: 'Record reading',
      glyph: '➕',
      variant: 'primary',
      title: 'Add L, n, t, T and T² to the table (Enter)',
      onClick: () => model.record(),
    }).root,
  );
  record.body.append(
    note(
      'L comes from your two rule readings, t from the stopwatch and n from the selector. T = t/n and T² are computed for you.',
      'info',
    ),
  );
  container.append(record.root);

  // -------------------------------------------------------------------------

  /** Set a button's variant by swapping the modifier class the kit uses. */
  const setVariant = (widget: ButtonWidget, variant: 'primary' | 'danger'): void => {
    widget.root.classList.toggle('pl-btn--primary', variant === 'primary');
    widget.root.classList.toggle('pl-btn--danger', variant === 'danger');
  };

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

  let lastMarker: LensMarker | null = null;
  let lastDisplay = initial.stopwatchElapsedS.toFixed(2);
  let lastThread = initial.threadLengthM;
  let lastClamp = initial.clampHeightM;
  let lastRelease = initial.releaseAngleDeg;

  const refresh = (): void => {
    const snapshot = model.snapshot();

    // --- Apparatus ---
    if (snapshot.threadLengthM !== lastThread) {
      lastThread = snapshot.threadLengthM;
      threadsSlider.setValue(snapshot.threadLengthM);
      threadsSlider.setReadout(`${((snapshot.threadLengthM - RIG.minThreadM) * 100).toFixed(1)} cm from minimum`);
    }
    if (snapshot.clampHeightM !== lastClamp) {
      lastClamp = snapshot.clampHeightM;
      clampSlider.setValue(snapshot.clampHeightM);
    }
    if (snapshot.releaseAngleDeg !== lastRelease) {
      lastRelease = snapshot.releaseAngleDeg;
      releaseSlider.setValue(snapshot.releaseAngleDeg);
    }
    locationSelect.setValue(snapshot.locationId);
    draughtToggle.setValue(snapshot.draught);

    // --- Reading the rule ---
    targetSwitch.setValue(snapshot.readingTarget);
    lastPivotCm = syncField(pivotField, snapshot.reading.pivotCm, lastPivotCm);
    lastBobCm = syncField(bobField, snapshot.reading.bobCm, lastBobCm);
    lastPivotStatus = applyStatus(pivotField, model.readingStatus('pivot'), lastPivotStatus);
    lastBobStatus = applyStatus(bobField, model.readingStatus('bob'), lastBobStatus);

    const measured = snapshot.measuredLengthM;
    lengthStat.set(
      measured === null ? 'not read yet' : `${(measured * 100).toFixed(2)} cm`,
      measured === null ? 'warn' : 'good',
    );

    const depth = Math.abs(RIG.ruleZ + 0.0025 - RIG.standZ);
    const shiftMm = Math.tan(snapshot.azimuthRad) * depth * 1000;
    parallaxNote.textContent =
      `Viewing angle ${(snapshot.azimuthRad * RAD_TO_DEG).toFixed(0)}° off the normal → each apparent height is displaced ` +
      `${shiftMm >= 0 ? '+' : ''}${shiftMm.toFixed(1)} mm. Both marks sit at the same depth, so the shift **cancels** in L.`;

    if (snapshot.lensMarker && snapshot.lensMarker !== lastMarker) {
      lastMarker = snapshot.lensMarker;
      lens.setMarker(lastMarker);
    }

    // --- Timing ---
    const shown = snapshot.stopwatchElapsedS.toFixed(2);
    if (shown !== lastDisplay) {
      lastDisplay = shown;
      display.textContent = shown;
    }
    startButton.setLabel(snapshot.stopwatchRunning ? 'STOP' : 'START');
    setVariant(startButton, snapshot.stopwatchRunning ? 'danger' : 'primary');
    const startGlyph = startButton.root.querySelector('.pl-btn__glyph');
    if (startGlyph) startGlyph.textContent = snapshot.stopwatchRunning ? '⏹' : '▶';
    nControl.setValue(String(snapshot.oscillations));
    counterToggle.setValue(snapshot.showSwingCounter);
    speedRow.setValue(String(snapshot.timeScale));
  };

  refresh();
  return { refresh, dispose: () => lens.dispose() };
}
