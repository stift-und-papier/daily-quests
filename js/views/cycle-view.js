// Zyklus-Seite: aktuelle Phase, Prognose, Kalender zum Nachtragen, Einstellungen.
import { getState, update } from '../store.js';
import { addDays, toKey, pad, formatLong, formatShort } from '../dates.js';
import { computeCycle, predictions, phaseForDay, PHASES, trackerCycleStats } from '../cycle.js';
import { phaseIcon, line, trackerIcon } from '../icons.js';
import { cardHead, tape, toast, esc } from '../ui.js';
import { trackerColor } from '../trackers.js';
import { colorDot } from './tracker-form.js';
import { pageHead } from './placeholder.js';

let viewMonth = null; // 'JJJJ-MM' des angezeigten Kalendermonats

const PHASE_COLOR = {
  menstruation: '#EFA3B6', follicular: '#86CBB8', ovulation: '#F5D77A', luteal: '#B7A6E3',
};
const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

/** Phasen-Ring: jeder Abschnitt zeigt eine Phase, der Punkt den heutigen Tag. */
function ring(st) {
  const R = 78, CIRC = 2 * Math.PI * R, len = st.cycleLength;
  // Phase für jeden Tag bestimmen und zu Abschnitten zusammenfassen
  const segs = [];
  for (let day = 1; day <= len; day++) {
    const p = phaseForDay(day, len, st.periodLength);
    const last = segs[segs.length - 1];
    if (last && last.phase === p) last.to = day; else segs.push({ phase: p, from: day, to: day });
  }
  const arcs = segs.map((sg) => {
    const start = ((sg.from - 1) / len) * CIRC;
    const size = ((sg.to - sg.from + 1) / len) * CIRC;
    return `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${PHASE_COLOR[sg.phase]}" stroke-width="22"
      stroke-dasharray="${size} ${CIRC}" stroke-dashoffset="${-start}" transform="rotate(-90 100 100)"/>`;
  }).join('');
  const dayPos = Math.min(st.cycleDay, len) - 0.5;
  const ang = (dayPos / len) * 2 * Math.PI - Math.PI / 2;
  const mx = 100 + R * Math.cos(ang), my = 100 + R * Math.sin(ang);
  return `
    <svg viewBox="0 0 200 200" class="cycle-ring" aria-hidden="true" focusable="false">
      <circle cx="100" cy="100" r="${R + 12}" fill="none" stroke="#4A3B36" stroke-width="2"/>
      <circle cx="100" cy="100" r="${R - 12}" fill="#FFFDF9" stroke="#4A3B36" stroke-width="2"/>
      ${arcs}
      <circle cx="100" cy="100" r="${R + 12}" fill="none" stroke="#4A3B36" stroke-width="2"/>
      <circle cx="100" cy="100" r="${R - 12}" fill="none" stroke="#4A3B36" stroke-width="2"/>
      <circle cx="${mx}" cy="${my}" r="12" fill="#FFFDF9" stroke="#4A3B36" stroke-width="3"/>
      <circle cx="${mx}" cy="${my}" r="4" fill="#4A3B36"/>
      <text x="100" y="92" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="16" fill="#6E5B53">Zyklustag</text>
      <text x="100" y="128" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="600" font-size="42" fill="#4A3B36">${st.cycleDay}</text>
    </svg>`;
}

function calendar(today, periodSet, pred, s) {
  const [y, m] = viewMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Montag = 0
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cal__cell cal__cell--empty"></span>');
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${pad(m)}-${pad(d)}`;
    const isPeriod = periodSet.has(key);
    const isPred = !isPeriod && pred.period.has(key) && key > today;
    const isOv = pred.ovulation.has(key);
    const future = key > today;
    const cls = ['cal__day', isPeriod && 'is-period', isPred && 'is-pred', isOv && 'is-ov', key === today && 'is-today'].filter(Boolean).join(' ');
    const tracks = s.days[key]?.tracks || [];
    const here = s.trackers.map((t, idx) => ({ t, idx })).filter(({ t }) => tracks.some((e) => e.trackerId === t.id));
    const desc = [isPeriod && 'Periodentag eingetragen', isPred && 'Periode geschätzt', isOv && 'Eisprung geschätzt', ...here.map(({ t }) => t.name), key === today && 'heute'].filter(Boolean).join(', ');
    cells.push(`<button type="button" class="${cls}" data-action="toggle-day" data-day="${key}" data-key="cal-${key}"
      ${future ? 'disabled' : `aria-pressed="${isPeriod}"`}
      aria-label="${formatLong(key)}${desc ? ` – ${desc}` : ''}">${d}${here.length ? `<span class="cal__marks cal__marks--top" aria-hidden="true">${here.slice(0, 3).map(({ t, idx }) => `<i style="background:${trackerColor(t, idx)}"></i>`).join('')}</span>` : ''}</button>`);
  }
  return `
    <div class="cal__nav">
      <button class="btn btn--icon btn--ghost" type="button" data-action="month" data-dir="-1" data-key="m-prev" aria-label="Vorheriger Monat">${line.arrowLeft()}</button>
      <h3 aria-live="polite">${monthFmt.format(first)}</h3>
      <button class="btn btn--icon btn--ghost" type="button" data-action="month" data-dir="1" data-key="m-next" aria-label="Nächster Monat">${line.arrowRight()}</button>
    </div>
    <div class="cal" role="group" aria-label="Kalender ${monthFmt.format(first)}">
      ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<span class="cal__wd" aria-hidden="true">${w}</span>`).join('')}
      ${cells.join('')}
    </div>
    <ul class="cal__legend plain" aria-label="Legende">
      <li><span class="dot is-period"></span> eingetragen</li>
      <li><span class="dot is-pred"></span> geschätzt</li>
      <li><span class="dot is-ov"></span> Eisprung (geschätzt)</li>
      ${s.trackers.map((t, idx) => `<li><span class="dot" style="background:${trackerColor(t, idx)}"></span> ${esc(t.name)}</li>`).join('')}
    </ul>`;
}

/** Karte „Tracker im Zyklus“: in welcher Phase / an welchem Zyklustag treten Beschwerden auf? */
function trackerCard(s, st) {
  if (!s.trackers.length) return '';
  const stats = trackerCycleStats(s);
  const len = Math.max(st?.cycleLength || s.settings.cycleLength, ...stats.map((x) => x.byCycleDay.length));
  return `
    <section class="card card--wide" aria-labelledby="cy-tr">
      ${tape('butter', 'left')}
      ${cardHead('', 'Tracker im Zyklus', { id: 'cy-tr', icon: trackerIcon(), sub: 'Zeigt, in welcher Phase deine Einträge lagen – so erkennst du vielleicht Muster. Grundlage ist die Schätzung oben.' })}
      <div class="stack">
        ${stats.map((x, idx) => {
          if (!x.total) return `<p>${colorDot(trackerColor(x.tracker, idx))}<strong>${esc(x.tracker.name)}</strong> · noch keine Einträge</p>`;
          const known = x.total - x.unknown;
          const maxDay = Math.max(1, ...x.byCycleDay.filter(Boolean));
          return `<div class="cy-tr">
            <p>${colorDot(trackerColor(x.tracker, idx))}<strong>${esc(x.tracker.name)}</strong> · ${x.total} ${x.total === 1 ? 'Tag' : 'Tage'} eingetragen${x.unknown ? ` (${x.unknown} vor deiner ersten eingetragenen Periode, ohne Phase)` : ''}</p>
            ${known ? `<div class="table-wrap"><table class="phase-table">
              <caption class="visually-hidden">${esc(x.tracker.name)} nach Zyklusphase</caption>
              <thead><tr><th scope="col">Phase</th><th scope="col">Tage</th><th scope="col">Anteil</th>${x.tracker.scale !== 'yesno' ? '<th scope="col">Ø stärkste Stufe</th>' : ''}</tr></thead>
              <tbody>${Object.entries(PHASES).map(([k, p]) => {
                const ph = x.phases[k];
                const pct = Math.round((ph.days / known) * 100);
                return `<tr><th scope="row"><span class="dot" style="background:${PHASE_COLOR[k]}"></span> ${p.name}</th>
                  <td>${ph.days}</td>
                  <td><span class="pbar" aria-hidden="true"><span style="width:${pct}%;background:${trackerColor(x.tracker, idx)}"></span></span> ${pct} %</td>
                  ${x.tracker.scale !== 'yesno' ? `<td>${ph.avg ?? '–'}</td>` : ''}</tr>`;
              }).join('')}</tbody>
            </table></div>
            <p class="label" style="margin-top:var(--s2)">An welchem Zyklustag?</p>
            <div class="cday-strip" role="img" aria-label="${esc(x.tracker.name)} je Zyklustag: ${x.byCycleDay.map((n, i) => (n ? `Tag ${i + 1}: ${n}` : '')).filter(Boolean).join(', ')}">
              ${Array.from({ length: len }, (_, i) => {
                const n = x.byCycleDay[i] || 0;
                return `<span class="cday ${n ? 'has' : ''}" style="${n ? `background:${trackerColor(x.tracker, idx)};opacity:${0.45 + 0.55 * (n / maxDay)}` : ''}" title="Tag ${i + 1}: ${n}"></span>`;
              }).join('')}
            </div>
            <div class="cday-axis" aria-hidden="true"><span>Tag 1</span><span>Tag ${Math.round(len / 2)}</span><span>Tag ${len}</span></div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </section>`;
}

export function render(root, ctx) {
  const today = ctx.today;
  const s = getState();
  if (!viewMonth) viewMonth = today.slice(0, 7);
  const { cycleLength, periodLength } = s.settings;
  const st = computeCycle({ periodDays: s.cycle.periodDays, cycleLength, periodLength, today });
  const pred = predictions(st);
  const periodSet = new Set(s.cycle.periodDays);
  const info = st ? PHASES[st.phase] : null;

  root.innerHTML = `
    ${pageHead('Zyklus')}
    <div class="cards">
      <p class="note card--wide"><strong>Hinweis:</strong> Das ist nur eine Schätzung nach der Kalendermethode – kein medizinisches Werkzeug und nicht zur Verhütung geeignet. Bei Fragen oder Beschwerden wende dich an deine Ärztin oder deinen Arzt.</p>

      ${st ? `
      <section class="card card--rosa" aria-labelledby="cy-now">
        ${tape('flieder')}
        ${cardHead('', `Heute: ${info.name}`, { id: 'cy-now', icon: phaseIcon(st.phase), sub: info.text })}
        <div class="cycle-now">
          ${ring(st)}
          <dl class="facts">
            <div><dt>Zyklustag</dt><dd>${st.cycleDay} von ca. ${st.cycleLength}</dd></div>
            <div><dt>Nächste Periode</dt><dd>${st.late
              ? `seit ${st.late} ${st.late === 1 ? 'Tag' : 'Tagen'} erwartet`
              : st.daysUntilNext === 0 ? 'heute erwartet' : `in ${st.daysUntilNext} ${st.daysUntilNext === 1 ? 'Tag' : 'Tagen'} · ${formatShort(st.nextPeriod)}`}</dd></div>
            <div><dt>Eisprung (geschätzt)</dt><dd>um den ${formatShort(st.ovulationDate)}</dd></div>
            <div><dt>Zykluslänge</dt><dd>${st.lengthFromData ? `${st.cycleLength} Tage (Durchschnitt aus ${st.lengthFromData} ${st.lengthFromData === 1 ? 'Zyklus' : 'Zyklen'})` : `${st.cycleLength} Tage (Einstellung)`}</dd></div>
          </dl>
        </div>
        <ul class="cal__legend plain" aria-label="Farben der Phasen">
          ${Object.entries(PHASES).map(([k, p]) => `<li><span class="dot" style="background:${PHASE_COLOR[k]}"></span> ${p.name}</li>`).join('')}
        </ul>
      </section>` : `
      <section class="card card--rosa" aria-labelledby="cy-empty">
        ${tape('flieder')}
        ${cardHead('', 'Noch keine Daten', { id: 'cy-empty', icon: phaseIcon('menstruation'), sub: 'Trag unten das Startdatum deiner letzten Periode ein oder tippe die Tage im Kalender an.' })}
      </section>`}

      <section class="card" aria-labelledby="cy-cal">
        ${tape('rosa', 'left')}
        ${cardHead('', 'Periodentage nachtragen', { id: 'cy-cal', sub: 'Tippe einen Tag an, um ihn als Periodentag zu markieren oder die Markierung zu entfernen.' })}
        ${calendar(today, periodSet, pred, s)}
      </section>

      ${trackerCard(s, st)}

      <section class="card card--flieder" aria-labelledby="cy-set">
        ${tape('mint')}
        ${cardHead('', 'Meine Angaben', { id: 'cy-set' })}
        <form class="stack" data-form="start">
          <div class="field">
            <label for="cy-start">Startdatum der letzten Periode</label>
            <input id="cy-start" class="input" type="date" name="start" max="${today}" value="${st ? st.lastStart : ''}" required data-key="cy-start">
          </div>
          <button class="btn btn--rosa" type="submit" data-key="cy-start-save">Periode eintragen</button>
        </form>
        <form class="stack" data-form="lengths" style="margin-top:var(--s4)">
          <div class="field">
            <label for="cy-len">Durchschnittliche Zykluslänge (Tage)</label>
            <input id="cy-len" class="input" type="number" inputmode="numeric" name="len" min="20" max="45" value="${cycleLength}" required data-key="cy-len">
          </div>
          <div class="field">
            <label for="cy-per">Periodendauer (Tage)</label>
            <input id="cy-per" class="input" type="number" inputmode="numeric" name="per" min="2" max="10" value="${periodLength}" required data-key="cy-per">
          </div>
          <p class="card__sub">Sobald du mindestens zwei Perioden eingetragen hast, rechnet die App mit deinem eigenen Durchschnitt.</p>
          <button class="btn btn--butter" type="submit" data-key="cy-len-save">Speichern</button>
        </form>
      </section>
    </div>`;

  root.onclick = (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.action === 'month') {
      const [y, m] = viewMonth.split('-').map(Number);
      viewMonth = toKey(new Date(y, m - 1 + Number(btn.dataset.dir), 1)).slice(0, 7);
    }
    if (btn.dataset.action === 'toggle-day') {
      const key = btn.dataset.day;
      update((s2) => {
        const set = new Set(s2.cycle.periodDays);
        if (set.has(key)) set.delete(key); else set.add(key);
        s2.cycle.periodDays = [...set].sort();
      });
    }
    ctx.refresh();
  };

  root.onsubmit = (ev) => {
    ev.preventDefault();
    const f = ev.target;
    if (f.dataset.form === 'start') {
      const start = f.elements.start.value;
      if (!start || start > today) { toast('Bitte ein Datum bis heute wählen'); return; }
      update((s2) => {
        const set = new Set(s2.cycle.periodDays);
        for (let k = 0; k < s2.settings.periodLength; k++) {
          const d = addDays(start, k);
          if (d <= today) set.add(d);
        }
        s2.cycle.periodDays = [...set].sort();
      });
      viewMonth = start.slice(0, 7);
      toast('Periode eingetragen');
    }
    if (f.dataset.form === 'lengths') {
      const len = Math.round(Number(f.elements.len.value));
      const per = Math.round(Number(f.elements.per.value));
      if (!(len >= 20 && len <= 45) || !(per >= 2 && per <= 10) || per >= len) {
        toast('Bitte Zykluslänge 20–45 und Periodendauer 2–10 Tage angeben'); return;
      }
      update((s2) => { s2.settings.cycleLength = len; s2.settings.periodLength = per; });
      toast('Gespeichert');
    }
    ctx.refresh();
  };
}

// Für Tests: aktuell angezeigten Monat zurücksetzen
export function _resetMonth() { viewMonth = null; }
