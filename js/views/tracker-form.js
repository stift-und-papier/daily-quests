// Gemeinsame Bausteine für Tracker-Einträge (Seite „Heute“ und Kalender).
import { levelsOf, levelWord, levelText, levelColor, trackerColor } from '../trackers.js';
import { esc } from '../ui.js';
import { line } from '../icons.js';

const HINT = { '0-10': '0 = keine, 10 = unerträglich', '1-5': '1 = kaum spürbar, 5 = sehr stark', '1-3': '' };

/** Farbpunkt eines Trackers. */
export const colorDot = (color) => `<span class="tdot" style="background:${color}" aria-hidden="true"></span>`;

/**
 * Formular für einen Eintrag: Stufe (falls Skala), Uhrzeit (optional), Notiz.
 * @param tracker  der Tracker
 * @param prefix   eindeutiger Präfix für IDs
 * @param time     vorausgefüllte Uhrzeit ('' = keine)
 */
export function trackerFormHtml(tracker, prefix, time = '', { level = null, note = '', editId = '' } = {}) {
  const levels = levelsOf(tracker.scale);
  return `
    <form class="stack tracker__form" data-form="track" data-tracker="${tracker.id}" ${editId ? `data-edit="${editId}"` : ''}>
      ${levels.length ? `<fieldset class="levels">
        <legend class="label">Stufe${HINT[tracker.scale] ? ` <span class="card__sub">(${HINT[tracker.scale]})</span>` : ''}</legend>
        <div class="levels__grid levels__grid--${levels.length}">
          ${levels.map((l) => `<label class="level-opt">
            <input type="radio" name="level" value="${l}" class="visually-hidden" required data-key="${prefix}-lv-${l}" ${level === l ? 'checked' : ''}>
            <span style="background:${levelColor(tracker.scale, l)}">${tracker.scale === '1-3' ? levelWord(tracker.scale, l) : l}</span>
          </label>`).join('')}
        </div>
      </fieldset>` : '<p class="card__sub">Dieser Tracker hat keine Skala – der Eintrag zählt einfach als „war da“.</p>'}
      <div class="inline-form">
        <div class="field" style="flex:none"><label for="${prefix}-time">Uhrzeit <span class="card__sub">(optional)</span></label>
          <input id="${prefix}-time" class="input input--time" type="time" name="time" value="${esc(time)}" data-key="${prefix}-time"></div>
        <div class="field" style="flex:1;min-width:0"><label for="${prefix}-note">Notiz <span class="card__sub">(optional)</span></label>
          <input id="${prefix}-note" class="input" name="note" maxlength="160" placeholder="z. B. Auslöser, Tablette" autocomplete="off" value="${esc(note)}" data-key="${prefix}-note"></div>
      </div>
      <div class="btn-row">
        <button class="btn btn--mint" type="submit" data-key="${prefix}-save">Speichern</button>
        ${editId ? `<button class="btn" type="button" data-action="track-edit-cancel" data-key="${prefix}-cancel">Abbrechen</button>` : ''}
      </div>
    </form>`;
}

/** Werte aus dem Formular lesen. */
export function readTrackerForm(form) {
  const lv = form.elements.level;
  return {
    trackerId: form.dataset.tracker,
    level: lv && lv.value !== '' ? Number(lv.value) : null,
    time: form.elements.time.value || '',
    note: form.elements.note.value.trim(),
  };
}

/** Liste der Einträge eines Tages (mit Löschen-Button). */
export function trackEntriesHtml(entries, trackers, { showName = true, editable = false } = {}) {
  return `<ul class="plain">${entries.map((e) => {
    const idx = trackers.findIndex((t) => t.id === e.trackerId);
    const t = trackers[idx];
    if (!t) return '';
    return `<li class="row">
      <span class="row__text">${showName ? `${colorDot(trackerColor(t, idx))}<strong>${esc(t.name)}</strong> ` : ''}${e.time ? `<strong>${esc(e.time)}</strong> · ` : ''}<span class="level" style="background:${levelColor(t.scale, e.level)}">${esc(levelText(t.scale, e.level))}</span>${e.note ? ` · ${esc(e.note)}` : ''}</span>
      ${editable ? `<button class="btn btn--ghost btn--icon" type="button" data-action="track-edit" data-id="${e.id}" data-key="tr-edit-${e.id}" aria-label="Eintrag ${esc(t.name)}${e.time ? ` um ${esc(e.time)}` : ''} bearbeiten">${line.edit()}</button>` : ''}
      <button class="btn btn--ghost btn--icon" type="button" data-action="track-delete" data-id="${e.id}" data-key="tr-del-${e.id}" aria-label="Eintrag ${esc(t.name)}${e.time ? ` um ${esc(e.time)}` : ''} löschen">${line.trash()}</button>
    </li>`;
  }).join('')}</ul>`;
}
