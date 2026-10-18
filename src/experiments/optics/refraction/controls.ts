/**
 * The control panel for the refraction practical.
 *
 * Pure DOM: it knows nothing about the block or the rays. The experiment hands
 * it a small {@link RefractionControlsModel} and gets back a `refresh` callback
 * so the angle read-outs stay live while the slider is dragged.
 */

import { button, card, note, slider, stat } from '@/ui/widgets';

/** Live state the panel displays. */
export interface RefractionSnapshot {
  /** Angle of incidence, in degrees. */
  incidenceDeg: number;
  /** Angle of refraction in the glass, in degrees. */
  refractionDeg: number;
  sinI: number;
  sinR: number;
  canRecord: boolean;
  recorded: number;
}

export interface RefractionControlsModel {
  setIncidenceDeg(degrees: number): void;
  record(): void;
  snapshot(): RefractionSnapshot;
}

/** Mount the panel and return a function that refreshes its read-outs. */
export function mountRefractionControls(container: HTMLElement, model: RefractionControlsModel): () => void {
  container.replaceChildren();

  const incidenceStat = stat('Angle of incidence i', '—', 'Between the incident ray and the normal.');
  const refractionStat = stat('Angle of refraction r', '—', 'Inside the block, between the refracted ray and the normal.');
  const sineStat = stat('sin i ÷ sin r', '—', 'Snell\'s law says this ratio should stay constant.');

  const incidenceSlider = slider({
    label: 'Angle of incidence',
    min: 5,
    max: 80,
    step: 1,
    value: model.snapshot().incidenceDeg,
    unit: '°',
    decimals: 0,
    hint: 'Six angles spread over the range make the best graph.',
    onInput: (value) => model.setIncidenceDeg(value),
  });

  const recordButton = button({
    label: 'Record angles',
    variant: 'primary',
    glyph: '✏️',
    title: 'Read i and r off the drawing and add them to the table',
    onClick: () => model.record(),
  });

  const recordedStat = stat('Recorded readings', '0');

  const angleCard = card('Reading the angles', { glyph: '📐' });
  angleCard.body.append(
    incidenceStat.root,
    refractionStat.root,
    sineStat.root,
    note('Both angles are measured from the normal — the dashed line at right angles to the face.', 'info'),
  );

  const controlCard = card('Ray box', { glyph: '🔆' });
  controlCard.body.append(
    incidenceSlider.root,
    note('Move the ray box round the protractor; the beam always strikes the same point on the face.', 'info'),
  );

  const recordCard = card('Recording', { glyph: '📝' });
  recordCard.body.append(
    recordButton.root,
    recordedStat.root,
    note('Record each new angle, then plot sin i against sin r.', 'info'),
  );

  container.append(angleCard.root, controlCard.root, recordCard.root);

  const refresh = (): void => {
    const snapshot = model.snapshot();
    incidenceStat.set(`${snapshot.incidenceDeg.toFixed(0)}°`);
    refractionStat.set(`${snapshot.refractionDeg.toFixed(0)}°`);
    sineStat.set(snapshot.sinR > 0 ? (snapshot.sinI / snapshot.sinR).toFixed(2) : '—');
    recordedStat.set(String(snapshot.recorded));
    recordButton.setDisabled(!snapshot.canRecord);
  };

  refresh();
  return refresh;
}
