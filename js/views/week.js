// Wochenrückblick: 7 Tage Trinken, Medikamente, Energie und Erfolge.
import { getState, update } from '../store.js';
import { addDays, lastNDays, formatWeekday, formatShort, formatLong } from '../dates.js';
import { battery, star, bottle, pillbox, line } from '../icons.js';
import { tape, esc, foldCard } from '../ui.js';
import { medSlots } from './today.js';
import { trackerSummary, levelText, levelColor, trackerColor } from '../trackers.js';
import { colorDot } from './tracker-form.js';
import { layoutOf, toggleIn } from '../layout.js';

let weekOffset = 0; // 0 = die letzten 7 Tage bis heute, -1 = die 7 Tage davor …

/** Kennzahlen für einen Tag. Tage ohne Eintrag gelten als "keine Daten", nicht als 0 %. */
export function dayStats(state, key) {
  const d = state.days[key];
  if (!d) return { key, has: false, water: 0, energy: null, wins: [], medsPlanned: 0, medsTaken: 0 };
  const planned = d.medsPlanned || medSlots(state.meds).map((x) => x.key);
  const taken = planned.filter((k) => d.medsTaken?.[k]).length;
  return {
    key, has: true,
    water: d.water || 0,
    energy: d.energy ?? null,
    wins: (d.wins || []).filter(Boolean),
    medsPlanned: planned.length,
    medsTaken: taken,
  };
}

export function weekSummary(state, endKey) {
  const days = lastNDays(endKey, 7).map((k) => dayStats(state, k));
  const goal = state.settings.waterGoal || 2000;
  const withData = days.filter((d) => d.has);
  const planned = days.reduce((a, d) => a + d.medsPlanned, 0);
  const taken = days.reduce((a, d) => a + d.medsTaken, 0);
  const energies = days.filter((d) => d.energy !== null).map((d) => d.energy);
  return {
    days, goal,
    waterAvg: withData.length ? Math.round(withData.reduce((a, d) => a + d.water, 0) / withData.length) : 0,
    goalDays: days.filter((d) => d.water >= goal).length,
    medsPct: planned ? Math.round((taken / planned) * 100) : null,
    energyAvg: energies.length ? Math.round(energies.reduce((a, b) => a + b, 0) / energies.length) : null,
    wins: days.flatMap((d) => d.wins.map((w) => ({ key: d.key, text: w }))),
  };
}

const ml = (n) => `${n.toLocaleString('de-DE')} ml`;

function waterChart(sum, today) {
  const max = Math.max(sum.goal, ...sum.days.map((d) => d.water)) * 1.05;
  const goalPct = (sum.goal / max) * 100;
  return `
    <div class="wchart" role="list" aria-label="Trinkmenge pro Tag">
      <div class="wchart__goal" style="bottom:${goalPct}%" aria-hidden="true"><span>Ziel ${ml(sum.goal)}</span></div>
      ${sum.days.map((d) => {
        const h = (d.water / max) * 100;
        const reached = d.water >= sum.goal;
        return `<div class="wchart__col" role="listitem" tabindex="0" data-tip
            aria-label="${formatLong(d.key)}: ${d.has ? ml(d.water) : 'keine Daten'}${reached ? ', Ziel erreicht' : ''}">
          <div class="wchart__track"><div class="wchart__bar ${reached ? 'is-full' : ''}" style="height:${h}%"></div></div>
          <span class="wchart__tip" aria-hidden="true">${formatShort(d.key)}<br><strong>${d.has ? ml(d.water) : '–'}</strong></span>
        </div>`;
      }).join('')}
    </div>
    <div class="wchart__labels" aria-hidden="true">
      ${sum.days.map((d) => `<span class="${d.key === today ? 'is-today' : ''}">${formatWeekday(d.key)}<br><small>${d.has ? (d.water / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' l' : '–'}</small></span>`).join('')}
    </div>`;
}

/* ---------- Kästen der Woche ---------- */

function winsCard(sum) {
  return {
    cls: 'card--butter card--wide', tapeHtml: tape('flieder', 'left'), title: 'Kleine Erfolge',
    sub: `${sum.wins.length} ${sum.wins.length === 1 ? 'Erfolg' : 'Erfolge'} in 7 Tagen ★`,
    body: sum.wins.length ? `<ul class="plain wins-week">
      ${sum.wins.map((w) => `<li><span class="wins-week__star">${star(true)}</span><span><strong>${formatWeekday(w.key)}, ${formatShort(w.key)}:</strong> ${esc(w.text)}</span></li>`).join('')}
    </ul>` : '<p>In diesen 7 Tagen sind noch keine Erfolge notiert. Auch kleine Dinge zählen! ♡</p>',
  };
}

function energyCard(sum, today) {
  return {
    cls: 'card--wide', tapeHtml: tape('butter'), title: 'Energielevel',
    body: `<ul class="plain energy-week">
      ${sum.days.map((d) => `<li>
        <span class="energy-week__bat">${d.energy !== null ? battery(d.energy) : '<span class="energy-week__none" aria-hidden="true">–</span>'}</span>
        <span class="energy-week__day ${d.key === today ? 'is-today' : ''}">${formatWeekday(d.key)}</span>
        <span class="visually-hidden">${formatLong(d.key)}: ${d.energy !== null ? d.energy + ' Prozent' : 'nicht eingetragen'}</span>
      </li>`).join('')}
    </ul>`,
  };
}

function waterCard(sum, today) {
  return {
    cls: 'card--wide', tapeHtml: tape('himmel'), title: 'Trinkmenge',
    icon: bottle(Math.min(1, sum.waterAvg / sum.goal)),
    sub: `Ziel an ${sum.goalDays} von 7 Tagen erreicht`,
    body: waterChart(sum, today),
  };
}

function medsCard(s, sum) {
  return {
    cls: 'card--flieder', tapeHtml: tape('rosa', 'left'), title: 'Medikamente genommen',
    icon: pillbox(sum.medsPct === 100 ? 'joy' : 'happy'),
    body: s.meds.length || sum.days.some((d) => d.medsPlanned) ? `
      <ul class="plain meds-week">
        ${sum.days.map((d) => {
          const pct = d.medsPlanned ? Math.round((d.medsTaken / d.medsPlanned) * 100) : null;
          return `<li>
            <span class="meds-week__day">${formatWeekday(d.key)}</span>
            <span class="progress progress--slim" aria-hidden="true"><span class="progress__bar" style="width:${pct ?? 0}%" data-full="${pct === 100}"></span></span>
            <span class="meds-week__val">${d.has && pct !== null ? `${d.medsTaken}/${d.medsPlanned}` : '–'}</span>
            <span class="visually-hidden">${formatLong(d.key)}: ${d.has && pct !== null ? `${d.medsTaken} von ${d.medsPlanned} genommen` : 'keine Daten'}</span>
          </li>`;
        }).join('')}
      </ul>` : '<p>Noch keine Medikamente eingetragen.</p>',
  };
}

function trackerCard(tsum) {
  return {
    cls: 'card--rosa card--wide', tapeHtml: tape('himmel', 'left'), title: 'Tracker',
    sub: 'Pro Tag die stärkste eingetragene Stufe.',
    body: tsum.length ? `<div class="stack">
      ${tsum.map((x, idx) => `
        <div>
          <p>${colorDot(trackerColor(x.tracker, idx))}<strong>${esc(x.tracker.name)}</strong> · ${x.dayCount ? `an ${x.dayCount} von 7 Tagen${x.maxLevel !== null ? `, höchstens ${esc(levelText(x.tracker.scale, x.maxLevel))}` : ''}` : 'nichts eingetragen 🌿'}</p>
          <ul class="plain track-week" aria-label="${esc(x.tracker.name)} pro Tag">
            ${x.days.map((d) => `<li>
              <span class="track-week__cell ${d.count ? 'has' : ''}" style="${d.count ? `background:${levelColor(x.tracker.scale, d.max)}` : ''}">${d.count ? (d.max !== null ? (x.tracker.scale === '1-3' ? ['L', 'M', 'S'][d.max - 1] : d.max) : '✓') : '·'}</span>
              <span class="track-week__day" aria-hidden="true">${formatWeekday(d.key)}</span>
              <span class="visually-hidden">${formatLong(d.key)}: ${d.count ? (d.max !== null ? levelText(x.tracker.scale, d.max) : 'eingetragen') : 'kein Eintrag'}</span>
            </li>`).join('')}
          </ul>
        </div>`).join('')}
    </div>` : '<p>Noch keine Tracker angelegt.</p>',
  };
}

function tableCard(sum, tsum, range) {
  return {
    cls: 'card--wide', title: 'Alle Werte als Tabelle',
    body: `<div class="table-wrap table-view">
      <table>
        <caption class="visually-hidden">Wochenübersicht ${range}</caption>
        <thead><tr><th scope="col">Tag</th><th scope="col">Erfolge</th><th scope="col">Energie</th><th scope="col">Trinken</th><th scope="col">Medikamente</th>${tsum.map((x) => `<th scope="col">${esc(x.tracker.name)}</th>`).join('')}</tr></thead>
        <tbody>${sum.days.map((d) => `<tr>
          <th scope="row">${formatWeekday(d.key)} ${formatShort(d.key)}</th>
          <td>${d.wins.length}</td>
          <td>${d.energy !== null ? d.energy + ' %' : '–'}</td>
          <td>${d.has ? ml(d.water) : '–'}</td>
          <td>${d.has && d.medsPlanned ? `${d.medsTaken}/${d.medsPlanned}` : '–'}</td>
          ${tsum.map((x) => { const c = x.days.find((y) => y.key === d.key); return `<td>${c.count ? (c.max !== null ? esc(levelText(x.tracker.scale, c.max)) : '✓') : '–'}</td>`; }).join('')}
        </tr>`).join('')}</tbody>
      </table>
    </div>`,
  };
}

export function render(root, ctx) {
  const today = ctx.today;
  const s = getState();
  const end = addDays(today, weekOffset * 7);
  const sum = weekSummary(s, end);
  const range = `${formatShort(sum.days[0].key)} – ${formatShort(end)}`;
  const tsum = trackerSummary(s, sum.days.map((d) => d.key));
  const layout = layoutOf(s.settings, 'week');

  const builders = {
    wins: () => winsCard(sum),
    energy: () => energyCard(sum, today),
    water: () => waterCard(sum, today),
    meds: () => medsCard(s, sum),
    tracker: () => trackerCard(tsum),
    table: () => tableCard(sum, tsum, range),
  };
  const visible = layout.order.filter((id) => !layout.hidden.has(id));

  root.innerHTML = `
    <div class="page-head">
      <h1>Woche</h1>
      <a class="btn btn--small btn--ghost" href="#einstellungen" data-key="customize-week" title="Reihenfolge und Kästen anpassen">${line.edit()} Anpassen</a>
    </div>
    <div class="week-nav">
      <button class="btn btn--icon" type="button" data-action="week" data-dir="-1" data-key="wk-prev" aria-label="Vorherige 7 Tage">${line.arrowLeft()}</button>
      <p class="week-nav__range" aria-live="polite"><strong>${range}</strong>${weekOffset === 0 ? '<br><small>die letzten 7 Tage</small>' : ''}</p>
      <button class="btn btn--icon" type="button" data-action="week" data-dir="1" data-key="wk-next" aria-label="Nächste 7 Tage" ${weekOffset >= 0 ? 'disabled' : ''}>${line.arrowRight()}</button>
    </div>
    <div class="cards">
      ${visible.map((id) => foldCard({ id: `wk-${id}`, collapsed: layout.collapsed.has(id), ...builders[id]() })).join('')}
      ${!visible.length ? '<p class="note card--wide">Alle Kästen sind ausgeblendet. Unter <a href="#einstellungen">Einstellungen</a> kannst du sie wieder einschalten.</p>' : ''}
    </div>`;

  root.onclick = (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.action === 'fold') {
      const id = btn.dataset.module.replace(/^wk-/, '');
      update((st) => toggleIn(st.settings, 'collapsed', id, !layoutOf(st.settings, 'week').collapsed.has(id), 'week'));
      ctx.refresh();
      return;
    }
    if (btn.dataset.action !== 'week') return;
    weekOffset = Math.min(0, weekOffset + Number(btn.dataset.dir));
    ctx.refresh();
  };
}
