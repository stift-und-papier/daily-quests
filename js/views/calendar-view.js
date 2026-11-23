// Seite „Kalender“: Monatskalender (Termine & Tracker) und Bericht für die Ärztin / den Arzt.
import { getState } from '../store.js';
import { trackerIcon } from '../icons.js';
import { cardHead, tape, esc, toast } from '../ui.js';
import { pageHead } from './placeholder.js';
import { calendarHtml, handleCalendarClick, handleCalendarSubmit, handleCalendarKey } from './calendar-part.js';
import { trackerColor } from '../trackers.js';
import { colorDot } from './tracker-form.js';
import { reportData, reportHtml, printReport, rangeStart } from '../report.js';
import { isOn } from '../layout.js';

export function render(root, ctx) {
  const today = ctx.today;
  const s = getState();

  root.innerHTML = `
    ${pageHead('Kalender')}
    <div class="cards">
      ${calendarHtml(today)}
      ${s.trackers.length ? `
      <section class="card card--butter card--wide" aria-labelledby="rep-h">
        ${tape('flieder', 'left')}
        ${cardHead('', 'Bericht für die Ärztin / den Arzt', { id: 'rep-h', icon: trackerIcon(), sub: `Tagebuch deiner Tracker mit Uhrzeit, Stufe, Notiz${isOn(s.settings, 'cycle') ? ', Zyklusphase' : ''} und Medikamenten – zum Ausdrucken oder als PDF. Nichts wird verschickt.` })}
        <form class="stack" data-form="report">
          <div class="field">
            <label for="rep-range">Zeitraum</label>
            <select id="rep-range" class="select" name="months" data-key="rep-range">
              ${[[1, 'letzter Monat'], [3, 'letzte 3 Monate'], [6, 'letzte 6 Monate'], [12, 'letzte 12 Monate']].map(([m, l]) => `<option value="${m}" ${m === 3 ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <fieldset class="ics-opts">
            <legend class="label">Welche Tracker?</legend>
            ${s.trackers.map((t, idx) => `<label class="switch-row"><input type="checkbox" class="check" name="tracker" value="${t.id}" checked data-key="rep-${t.id}"><span>${colorDot(trackerColor(t, idx))}${esc(t.name)}</span></label>`).join('')}
          </fieldset>
          <button class="btn btn--mint" type="submit" data-key="rep-go">🖨️ Bericht drucken / als PDF speichern</button>
          <p class="card__sub">Im Druckfenster „Als PDF speichern“ wählen. iPhone: im Druckfenster mit zwei Fingern auf die Vorschau „aufziehen“ → Teilen → „In Dateien sichern“.</p>
        </form>
      </section>` : ''}
    </div>`;

  root.onsubmit = (ev) => {
    ev.preventDefault();
    const f = ev.target;
    if (f.dataset.form === 'report') {
      const trackerIds = [...f.querySelectorAll('input[name="tracker"]:checked')].map((x) => x.value);
      if (!trackerIds.length) { toast('Bitte mindestens einen Tracker auswählen'); return; }
      const from = rangeStart(today, Number(f.elements.months.value));
      const st = getState();
      printReport(reportHtml(reportData(st, { from, to: today, trackerIds, withCycle: isOn(st.settings, 'cycle') })));
      return;
    }
    handleCalendarSubmit(f, ctx);
  };
  root.onkeydown = (ev) => handleCalendarKey(ev, ctx);
  root.onclick = (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (btn) handleCalendarClick(btn, ctx);
  };
}
