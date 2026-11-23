// Bericht für Ärztin/Arzt: Tracker-Tagebuch + Medikamente + Zyklusphase, zum Drucken oder als PDF.
// Es wird nichts verschickt: Der Bericht entsteht im Browser und geht an den Druckdialog
// („Als PDF speichern“ bzw. auf dem iPhone: Teilen → Drucken → Bild auseinanderziehen → Teilen/Sichern).
import { addDays, formatFull, formatWeekday, formatLong } from './dates.js';
import { esc } from './ui.js';
import { levelText, tracksOfDay, SCALES, hasLevels } from './trackers.js';
import { phaseOnDate, periodStarts, PHASES } from './cycle.js';
import { medSlots, weekStart } from './views/today.js';

const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

/** Alle Zahlen für den Bericht (reine Funktion, testbar). */
export function reportData(state, { from, to, trackerIds, withCycle = true }) {
  const keys = [];
  for (let k = from; k <= to; k = addDays(k, 1)) keys.push(k);
  const medName = Object.fromEntries(state.meds.map((m) => [m.id, m.name]));
  const hasCycle = withCycle && state.cycle.periodDays.length > 0;

  const trackers = state.trackers.filter((t) => trackerIds.includes(t.id)).map((tracker) => {
    const rows = [];
    for (const key of keys) {
      const day = state.days[key];
      const entries = tracksOfDay(day).filter((e) => e.trackerId === tracker.id);
      if (!entries.length) continue;
      const ph = hasCycle ? phaseOnDate(state, key) : null;
      const takenMeds = Object.keys(day?.medsTaken || {}).filter((k) => day.medsTaken[k])
        .map((k) => { const [id, time] = k.split('@'); return medName[id] ? `${medName[id]} ${time}` : null; }).filter(Boolean);
      for (const e of entries) rows.push({ key, entry: e, phase: ph, meds: takenMeds });
    }
    const levels = rows.map((r) => r.entry.level).filter((l) => Number.isFinite(l));
    const dayCount = new Set(rows.map((r) => r.key)).size;
    const byPhase = {};
    if (hasCycle) for (const p of Object.keys(PHASES)) byPhase[p] = new Set(rows.filter((r) => r.phase?.phase === p).map((r) => r.key)).size;
    return { tracker, rows, dayCount, entryCount: rows.length, avgLevel: avg(levels), maxLevel: levels.length ? Math.max(...levels) : null, byPhase };
  });

  // Medikamente: Einnahme in % über alle Tage mit Einträgen
  const medDays = keys.filter((k) => state.days[k]);
  let planned = 0, taken = 0;
  for (const k of medDays) {
    const d = state.days[k];
    const plan = d.medsPlanned || medSlots(state.meds).map((x) => x.key);
    planned += plan.length;
    taken += plan.filter((p) => d.medsTaken?.[p]).length;
  }

  return {
    from, to, days: keys.length, trackers,
    meds: state.meds,
    medsPct: planned ? Math.round((taken / planned) * 100) : null,
    medDays: medDays.length,
    periodStarts: hasCycle ? periodStarts(state.cycle.periodDays).filter((d) => d >= from && d <= to) : [],
    hasCycle,
  };
}

/** Druckfertiges HTML. */
export function reportHtml(data, now = new Date()) {
  const phaseName = (p) => (p ? `Tag ${p.cycleDay} · ${PHASES[p.phase].short}` : '–');
  return `
    <article class="report">
      <header class="report__head">
        <h1>Beschwerde-Tagebuch</h1>
        <p><strong>Zeitraum:</strong> ${formatFull(data.from)} – ${formatFull(data.to)} (${data.days} Tage) · <strong>Erstellt:</strong> ${now.toLocaleDateString('de-DE')}</p>
        <p class="report__note">Selbst erfasste Angaben aus der App „Daily Quests“.${data.hasCycle ? ' Zyklustag und -phase sind nach der Kalendermethode geschätzt.' : ''}</p>
      </header>

      ${data.trackers.map(({ tracker, rows, dayCount, entryCount, avgLevel, maxLevel, byPhase }) => `
        <section class="report__sec">
          <h2>${esc(tracker.name)}</h2>
          <p>
            <strong>${dayCount}</strong> von ${data.days} Tagen (${entryCount} ${entryCount === 1 ? 'Eintrag' : 'Einträge'})
            ${hasLevels(tracker.scale) && maxLevel !== null ? ` · Skala ${esc(SCALES[tracker.scale].label.replace('Stufe ', ''))} · Durchschnitt <strong>${String(avgLevel).replace('.', ',')}</strong> · höchste Stufe <strong>${maxLevel}</strong>` : ''}
          </p>
          ${data.hasCycle && dayCount ? `<p>Nach Zyklusphase: ${Object.entries(byPhase).map(([p, n]) => `${PHASES[p].name} ${n}`).join(' · ')}</p>` : ''}
          ${rows.length ? `<table>
            <thead><tr><th>Datum</th><th>Uhrzeit</th>${hasLevels(tracker.scale) ? '<th>Stufe</th>' : ''}${data.hasCycle ? '<th>Zyklus</th>' : ''}<th>Medikamente genommen</th><th>Notiz</th></tr></thead>
            <tbody>${rows.map((r) => `<tr>
              <td>${formatWeekday(r.key)} ${formatFull(r.key)}</td>
              <td>${esc(r.entry.time || '–')}</td>
              ${hasLevels(tracker.scale) ? `<td>${esc(levelText(tracker.scale, r.entry.level))}</td>` : ''}
              ${data.hasCycle ? `<td>${phaseName(r.phase)}</td>` : ''}
              <td>${r.meds.length ? esc(r.meds.join(', ')) : '–'}</td>
              <td>${esc(r.entry.note || '')}</td>
            </tr>`).join('')}</tbody>
          </table>` : '<p>Keine Einträge im Zeitraum.</p>'}
        </section>`).join('')}

      <section class="report__sec">
        <h2>Medikamente</h2>
        ${data.meds.length ? `<ul>${data.meds.map((m) => `<li>${esc(m.name)}: ${m.times.map(esc).join(', ')} Uhr</li>`).join('')}</ul>
          <p>Einnahme laut Abhaken: <strong>${data.medsPct === null ? '–' : `${data.medsPct} %`}</strong> (an ${data.medDays} Tagen mit Einträgen)</p>` : '<p>Keine Medikamente eingetragen.</p>'}
      </section>

      ${data.hasCycle ? `<section class="report__sec">
        <h2>Periode</h2>
        <p>${data.periodStarts.length ? `Beginn der Periode im Zeitraum: ${data.periodStarts.map(formatFull).join(', ')}` : 'Kein Periodenbeginn im Zeitraum eingetragen.'}</p>
      </section>` : ''}
    </article>`;
}

/** Bericht in den Druckdialog geben. */
export function printReport(html) {
  let root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.appendChild(root);
  }
  root.innerHTML = html;
  document.documentElement.classList.add('printing');
  const done = () => {
    document.documentElement.classList.remove('printing');
    root.innerHTML = '';
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}

/** Startdatum für „letzte n Monate“. */
export function rangeStart(today, months) {
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(y, m - 1 - months, d);
  const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return addDays(key, 1);
}

/* ---------- Rückblick: Kleine Erfolge & Abend-Reflexionen ---------- */

/** Zeitraum (Woche Mo–So, Monat oder Jahr), in dem `key` liegt. */
export function periodRange(mode, key) {
  if (mode === 'week') { const from = weekStart(key); return { from, to: addDays(from, 6) }; }
  if (mode === 'year') return { from: `${key.slice(0, 4)}-01-01`, to: `${key.slice(0, 4)}-12-31` };
  const [y, m] = key.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${key.slice(0, 7)}-01`, to: `${key.slice(0, 7)}-${String(last).padStart(2, '0')}` };
}

/** Tage mit Erfolgen oder Reflexion im Zeitraum, chronologisch. */
export function memoriesData(state, from, to) {
  return Object.keys(state.days).filter((k) => k >= from && k <= to).sort().map((key) => ({
    key,
    wins: (state.days[key].wins || []).filter(Boolean),
    reflection: (state.days[key].reflection || '').trim(),
  })).filter((d) => d.wins.length || d.reflection);
}

/** Liste der Erinnerungen (für Ansicht und Druck). */
export function memoriesListHtml(rows) {
  if (!rows.length) return '<p>In diesem Zeitraum gibt es noch keine Erfolge oder Reflexionen.</p>';
  return rows.map((r) => `<section class="memories">
    <h4>${formatLong(r.key)} ${r.key.slice(0, 4)}</h4>
    ${r.wins.length ? `<ul>${r.wins.map((w) => `<li>★ ${esc(w)}</li>`).join('')}</ul>` : ''}
    ${r.reflection ? `<p class="memories__text">♡ ${esc(r.reflection)}</p>` : ''}
  </section>`).join('');
}

/** Druckfassung des Rückblicks. */
export function memoriesReportHtml(rows, from, to) {
  return `<article class="report">
    <header class="report__head">
      <h1>Mein Rückblick</h1>
      <p><strong>Zeitraum:</strong> ${formatFull(from)} – ${formatFull(to)} · Kleine Erfolge und was ich in Erinnerung behalten will</p>
    </header>
    ${memoriesListHtml(rows)}
  </article>`;
}
