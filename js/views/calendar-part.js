// Monatskalender (Seite „Kalender“).
// Tag antippen → Liste aller Einträge des Tages (bearbeiten / löschen) in zwei Reitern:
// „Termine“ (inkl. Geburtstage) und „Tracker“. Neue Einträge öffnen sich erst per Button.
// Mehrtägige Termine erscheinen als farbiger Strich über den Symbolen.
// Neue Einträge: runder +-Knopf neben den Reitern. Wichtige Termine färben den Tag rosa-rot.
import { getState, update, uid, ensureDay } from '../store.js';
import { toKey, pad, formatLong, formatShort } from '../dates.js';
import {
  eventsOfDay, tracksOfDay, trackerColor, REPEATS, TRACKER_COLORS, isBirthday, eventLabel,
} from '../trackers.js';
import { line, cake } from '../icons.js';
import { cardHead, tape, esc, toast } from '../ui.js';
import { trackerFormHtml, readTrackerForm, trackEntriesHtml, colorDot } from './tracker-form.js';
import { REGIONS, holidaysOn, feiertageOn, outsideCoverage, ferienRegion, feiertagRegion } from '../holidays.js';
import { deleteSeriesAsk } from './today.js';

let calMonth = null;     // 'JJJJ-MM'
let selected = null;     // 'JJJJ-MM-TT'
let dayTab = 'events';   // 'events' | 'tracker'
let pickTracker = null;  // im Reiter „Tracker“ gewählter Tracker
let formOpen = null;     // null | 'event' | 'birthday' | 'track'
let editId = null;       // Termin, der gerade bearbeitet wird
let editTrack = null;    // Tracker-Eintrag, der gerade bearbeitet wird
const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

const isSeries = (t) => t.repeat && t.repeat !== 'none';
const resetForms = () => { formOpen = null; editId = null; editTrack = null; };

/** Lage eines Tages in einem mehrtägigen Termin: 'start' | 'mid' | 'end' */
export function spanPos(occ) {
  if (!occ.multi) return null;
  if (occ.dayIndex === 1) return 'start';
  if (occ.dayIndex === occ.dayCount) return 'end';
  return 'mid';
}

/* ---------- Formulare ---------- */

const colorSelect = (id, value = '') => `
  <div class="field">
    <label for="${id}">Farbe <span class="card__sub">(optional)</span></label>
    <select id="${id}" class="select" name="color" data-key="${id}">
      <option value="">keine Farbe</option>
      ${TRACKER_COLORS.map((c) => `<option value="${c.hex}" ${c.hex === value ? 'selected' : ''}>${c.name}</option>`).join('')}
    </select>
  </div>`;

/** Umschalter oben im „Neu“-Formular: Termin oder Geburtstag. */
const typeSwitch = (active) => `
  <div class="seg" role="group" aria-label="Was möchtest du eintragen?">
    <button type="button" class="seg__btn" data-action="form-type" data-form-type="event" data-key="ft-event" aria-pressed="${active === 'event'}">📅 Termin</button>
    <button type="button" class="seg__btn" data-action="form-type" data-form-type="birthday" data-key="ft-bday" aria-pressed="${active === 'birthday'}">🎂 Geburtstag</button>
  </div>`;

/** Formular für neuen oder bestehenden Termin. */
function eventForm(ev = null) {
  const p = ev ? `e-${ev.id}` : 'ev';
  const v = ev || { text: '', time: '', color: '', repeat: 'none', until: '', endDate: '', important: false };
  return `
    <form class="stack form-box" data-form="${ev ? 'event-edit' : 'event'}" ${ev ? `data-id="${ev.id}"` : ''}>
      ${ev ? '' : typeSwitch('event')}
      <h4>${ev ? 'Termin bearbeiten' : `Neuer Termin am ${formatShort(selected)}`}</h4>
      ${ev && isSeries(ev) ? '<p class="card__sub">Änderungen gelten für alle Termine dieser Serie.</p>' : ''}
      <div class="field">
        <label for="${p}-title">Titel</label>
        <input id="${p}-title" class="input" name="title" maxlength="120" required autocomplete="off" placeholder="z. B. Zahnarzt" value="${esc(v.text)}" data-key="${p}-title">
      </div>
      <label class="switch-row switch-row--wichtig">
        <input type="checkbox" class="check" name="important" data-key="${p}-imp" ${v.important ? 'checked' : ''}>
        <span><strong>❗ Wichtig</strong> <span class="card__sub">– Tag im Kalender rosa-rot markieren und Termin hervorheben</span></span>
      </label>
      <div class="inline-form">
        <div class="field" style="flex:none">
          <label for="${p}-time">Uhrzeit <span class="card__sub">(optional)</span></label>
          <input id="${p}-time" class="input input--time" type="time" name="time" value="${esc(v.time || '')}" data-key="${p}-time">
        </div>
        <div class="field" style="flex:1;min-width:0">
          <label for="${p}-repeat">Wiederholen</label>
          <select id="${p}-repeat" class="select" name="repeat" data-key="${p}-repeat">
            ${Object.entries(REPEATS).map(([k, l]) => `<option value="${k}" ${k === (v.repeat || 'none') ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      ${colorSelect(`${p}-color`, v.color || '')}
      <div class="field">
        <label for="${p}-end">Endet am <span class="card__sub">(optional – für Termine über mehrere Tage, z. B. Urlaub)</span></label>
        <input id="${p}-end" class="input" type="date" name="endDate" min="${ev ? ev.date : selected}" value="${esc(v.endDate || '')}" data-key="${p}-end">
      </div>
      <div class="field">
        <label for="${p}-until">Serie endet am <span class="card__sub">(optional, nur bei Wiederholung)</span></label>
        <input id="${p}-until" class="input" type="date" name="until" min="${ev ? ev.date : selected}" value="${esc(v.until || '')}" data-key="${p}-until">
      </div>
      <div class="btn-row">
        <button class="btn btn--butter" type="submit" data-key="${p}-save">${ev ? 'Speichern' : `${line.plus()} Eintragen`}</button>
        <button class="btn" type="button" data-action="form-cancel" data-key="${p}-cancel">Abbrechen</button>
      </div>
    </form>`;
}

/** Formular für einen Geburtstag. */
function birthdayForm(ev = null) {
  const p = ev ? `b-${ev.id}` : 'bd';
  return `
    <form class="stack form-box form-box--bday" data-form="${ev ? 'birthday-edit' : 'birthday'}" ${ev ? `data-id="${ev.id}"` : ''}>
      ${ev ? '' : typeSwitch('birthday')}
      <h4>${cake({ size: 64 })}<span>${ev ? 'Geburtstag bearbeiten' : 'Neuer Geburtstag'}</span></h4>
      <div class="field">
        <label for="${p}-name">Wer hat Geburtstag?</label>
        <input id="${p}-name" class="input" name="name" maxlength="80" required autocomplete="off" placeholder="z. B. Oma Ilse" value="${esc(ev?.text || '')}" data-key="${p}-name">
      </div>
      <div class="field">
        <label for="${p}-date">Geburtsdatum <span class="card__sub">(mit Geburtsjahr zeigt die App das Alter an)</span></label>
        <input id="${p}-date" class="input" type="date" name="date" required value="${esc(ev?.date || selected)}" data-key="${p}-date">
      </div>
      <div class="btn-row">
        <button class="btn btn--rosa" type="submit" data-key="${p}-save">${ev ? 'Speichern' : '🎂 Eintragen'}</button>
        <button class="btn" type="button" data-action="form-cancel" data-key="${p}-cancel">Abbrechen</button>
      </div>
    </form>`;
}

/* ---------- Reiter „Termine“ ---------- */

function eventsPanel(s) {
  const events = eventsOfDay(s.todos, selected);
  const series = (t) => s.todos.find((x) => x.id === t.id);
  return `
    ${events.length ? `<ul class="plain">${events.map((t) => {
      if (editId === t.id) return `<li>${isBirthday(t) ? birthdayForm(series(t)) : eventForm(series(t))}</li>`;
      const bd = isBirthday(t);
      return `<li class="row ${t.done ? 'row--done' : ''} ${t.color ? 'row--colored' : ''} ${t.important ? 'row--wichtig' : ''}"${t.color ? ` style="--c:${t.color}"` : ''}>
        <span class="row__text">${t.important ? '<span class="chip chip--wichtig">❗ Wichtig</span> ' : ''}${bd ? '<span class="chip chip--bday">🎂 Geburtstag</span>' : `<span class="chip chip--event">📅 ${t.time ? esc(t.time) : 'ganztägig'}</span>`}
          ${esc(eventLabel(t, selected))}
          ${t.recurring && !bd ? ` <span class="chip">🔁 ${REPEATS[t.repeat]}${t.until ? ` bis ${formatShort(t.until)}` : ''}</span>` : ''}
          ${t.multi ? ` <span class="chip">↔ ${formatShort(t.startDate)} – ${formatShort(t.endDate)} · Tag ${t.dayIndex}/${t.dayCount}</span>` : ''}</span>
        <button class="btn btn--ghost btn--icon" type="button" data-action="event-edit" data-id="${t.id}" data-key="eve-${t.id}" aria-label="„${esc(t.text)}“ bearbeiten">${line.edit()}</button>
        <button class="btn btn--ghost btn--icon" type="button" data-action="event-delete" data-id="${t.id}" data-key="evd-${t.id}" aria-label="„${esc(t.text)}“ löschen">${line.trash()}</button>
      </li>`;
    }).join('')}</ul>` : `<p class="card__sub">Keine Termine an diesem Tag.${formOpen ? '' : ' Mit <strong>+</strong> trägst du einen ein.'}</p>`}
    ${formOpen === 'event' ? eventForm() : formOpen === 'birthday' ? birthdayForm() : ''}`;
}

/** Runder +-Knopf neben den Reitern: klappt das Formular für einen neuen Eintrag auf/zu. */
function addButton(today) {
  if (editId || editTrack) return '';
  if (dayTab === 'tracker' && (selected > today || !getState().trackers.length)) return '';
  const open = !!formOpen;
  const what = dayTab === 'events' ? 'Termin oder Geburtstag' : 'Tracker-Eintrag';
  return `<button class="btn btn--butter btn--icon btn--add ${open ? 'is-open' : ''}" type="button" data-action="form-toggle" data-key="form-toggle"
    aria-expanded="${open}" aria-label="${open ? 'Formular schließen' : `Neuen ${what} eintragen`}" title="${open ? 'Schließen' : 'Neu eintragen'}">${line.plus()}</button>`;
}

/* ---------- Reiter „Tracker“ ---------- */

function trackerPanel(s, today) {
  const entries = tracksOfDay(s.days[selected]);
  const future = selected > today;
  if (!s.trackers.length) return '<p>Noch keine Tracker angelegt – das geht unter <a href="#einstellungen">Einstellungen</a>.</p>';
  if (!pickTracker || !s.trackers.some((t) => t.id === pickTracker)) pickTracker = s.trackers[0].id;
  const tracker = s.trackers.find((t) => t.id === pickTracker);
  const editing = editTrack && entries.find((e) => e.id === editTrack);
  const editTracker = editing && s.trackers.find((t) => t.id === editing.trackerId);
  return `
    ${entries.length ? trackEntriesHtml(entries.filter((e) => e.id !== editTrack), s.trackers, { editable: true }) : `<p class="card__sub">Keine Tracker-Einträge an diesem Tag.${formOpen || future ? '' : ` Mit <strong>+</strong> trägst du etwas ${selected === today ? 'ein' : 'nach'}.`}</p>`}
    ${editing && editTracker ? `<div class="form-box"><h4>${colorDot(trackerColor(editTracker, s.trackers.indexOf(editTracker)))}${esc(editTracker.name)} bearbeiten</h4>
      ${trackerFormHtml(editTracker, `ke-${editing.id}`, editing.time || '', { level: editing.level, note: editing.note || '', editId: editing.id })}</div>` : ''}
    ${future ? '<p class="note" style="margin-top:var(--s3)">Für zukünftige Tage kann man noch nichts eintragen.</p>'
      : formOpen === 'track' ? `
      <div class="form-box">
        <p class="label" id="pick-label">${selected === today ? 'Eintragen für heute' : 'Nachtragen für diesen Tag'}</p>
        <div class="pick-row" role="group" aria-labelledby="pick-label">
          ${s.trackers.map((t, idx) => `<button type="button" class="btn btn--small pick ${t.id === pickTracker ? 'is-on' : ''}" data-action="cal-tr-pick" data-id="${t.id}" data-key="pick-${t.id}" aria-pressed="${t.id === pickTracker}">${colorDot(trackerColor(t, idx))}${esc(t.name)}</button>`).join('')}
        </div>
        ${trackerFormHtml(tracker, `k-${tracker.id}`, '')}
        <button class="btn btn--ghost" type="button" data-action="form-cancel" data-key="tr-cancel">Abbrechen</button>
      </div>`
      : ''}`;
}

/* ---------- Kalender ---------- */

export function calendarHtml(today) {
  const s = getState();
  const bundesland = s.settings.schoolRegion || null;
  const region = ferienRegion(s.settings);
  const ftRegion = feiertagRegion(s.settings);
  if (!selected) selected = today;
  if (!calMonth) calMonth = selected.slice(0, 7);
  const [y, m] = calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cal__cell cal__cell--empty"></span>');
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${pad(m)}-${pad(d)}`;
    const evs = eventsOfDay(s.todos, key);
    const bdays = evs.filter(isBirthday);
    const multi = evs.filter((e) => e.multi);
    const single = evs.filter((e) => !isBirthday(e) && !e.multi);
    const tracks = s.days[key]?.tracks || [];
    const trackersHere = s.trackers.map((t, idx) => ({ t, idx })).filter(({ t }) => tracks.some((e) => e.trackerId === t.id));
    const ferien = holidaysOn(region, key);
    const feiertage = feiertageOn(ftRegion, key);
    const important = evs.some((e) => e.important);
    const desc = [
      important && 'wichtiger Termin',
      feiertage.map((f) => `Feiertag: ${f.name}${f.local ? ' (nur örtlich)' : ''}`).join(', '),
      ferien.map((f) => f.name).join(', '),
      bdays.length && `Geburtstag: ${bdays.map((b) => b.text).join(', ')}`,
      multi.length && multi.map((e) => e.text).join(', '),
      single.length && `${single.length} ${single.length === 1 ? 'Termin' : 'Termine'}`,
      ...trackersHere.map(({ t }) => t.name),
      key === today && 'heute',
    ].filter(Boolean).join(', ');
    const bars = multi.slice(0, 2).map((e) => `<i class="bar bar--${spanPos(e)}" style="background:${e.color || '#4A3B36'}"></i>`).join('');
    const marks = [
      bdays.length ? `<span class="m-bd">${cake({ size: 64 })}</span>` : '',
      single.length ? '<i class="m-ev"></i>' : '',
      ...trackersHere.slice(0, 3).map(({ t, idx }) => `<i style="background:${trackerColor(t, idx)}"></i>`),
    ].join('');
    cells.push(`<button type="button" class="cal__day ${key === today ? 'is-today' : ''} ${key === selected ? 'is-selected' : ''} ${ferien.length ? 'is-ferien' : ''} ${feiertage.some((f) => !f.local) ? 'is-feiertag' : ''} ${important ? 'is-wichtig' : ''}"
      data-action="cal-select" data-day="${key}" data-key="kal-${key}" aria-pressed="${key === selected}"
      aria-label="${formatLong(key)}${desc ? ` – ${esc(desc)}` : ''}">${d}
      ${bars ? `<span class="cal__bars" aria-hidden="true">${bars}</span>` : ''}
      ${marks ? `<span class="cal__marks" aria-hidden="true">${marks}</span>` : ''}</button>`);
  }

  const nEv = eventsOfDay(s.todos, selected).length;
  const nTr = (s.days[selected]?.tracks || []).filter((e) => s.trackers.some((t) => t.id === e.trackerId)).length;

  return `
    <section class="card card--himmel card--wide" aria-labelledby="kal-h">
      ${tape('rosa')}
      ${cardHead('', 'Termine & Kalender', { id: 'kal-h', sub: `Tippe einen Tag an, um seine Einträge zu sehen und zu bearbeiten. ${bundesland ? `Ferien & Feiertage: ${esc(REGIONS[bundesland])}` : 'Ferien & Feiertage:'} <a href="#einstellungen">${bundesland ? 'ändern' : 'Bundesland wählen'}</a>`
        + (region && outsideCoverage(`${calMonth}-01`, region) ? ' · <strong>Für diesen Monat liegen noch keine Ferien-Daten vor.</strong>' : '') })}
      <div class="kal">
        <div>
          <div class="cal__nav">
            <button class="btn btn--icon btn--ghost" type="button" data-action="cal-month" data-dir="-1" data-key="kal-prev" aria-label="Vorheriger Monat">${line.arrowLeft()}</button>
            <h3 aria-live="polite">${monthFmt.format(first)}</h3>
            <button class="btn btn--icon btn--ghost" type="button" data-action="cal-month" data-dir="1" data-key="kal-next" aria-label="Nächster Monat">${line.arrowRight()}</button>
          </div>
          <div class="cal" role="group" aria-label="Kalender ${monthFmt.format(first)}">
            ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<span class="cal__wd" aria-hidden="true">${w}</span>`).join('')}
            ${cells.join('')}
          </div>
          <ul class="cal__legend plain" aria-label="Legende">
            <li><span class="dot m-ev"></span> Termin</li>
            <li><span class="legend-bar"></span> mehrtägig</li>
            <li><span class="m-bd m-bd--legend">${cake({ size: 64 })}</span> Geburtstag</li>
            <li><span class="dot dot--wichtig"></span> wichtig</li>
            ${ftRegion ? '<li><span class="dot dot--feiertag"></span> Feiertag</li>' : ''}
            ${region ? `<li><span class="dot dot--ferien"></span> Schulferien</li>` : ''}
            ${s.trackers.map((t, idx) => `<li><span class="dot" style="background:${trackerColor(t, idx)}"></span> ${esc(t.name)}</li>`).join('')}
            ${selected !== today ? '<li><button class="btn btn--small" type="button" data-action="cal-today" data-key="kal-today">Zu heute</button></li>' : ''}
          </ul>
        </div>

        <div class="kal__day">
          <h3>${formatLong(selected)}</h3>
          ${feiertageOn(ftRegion, selected).map((f) => `<p class="ferien-chip feiertag-chip">🎉 Feiertag: <strong>${esc(f.name)}</strong>${f.local ? ' <span class="card__sub">(nur örtlich)</span>' : ''}</p>`).join('')}
          ${holidaysOn(region, selected).map((f) => `<p class="ferien-chip">🏖️ <strong>${esc(f.name)}</strong> · ${formatShort(f.from)}${f.from !== f.to ? ` – ${formatShort(f.to)}` : ''}</p>`).join('')}
          <div class="tabs-row">
          <div class="tabs" role="tablist" aria-label="Einträge an diesem Tag">
            <button type="button" role="tab" id="tab-ev" class="tab" aria-selected="${dayTab === 'events'}" aria-controls="panel-day" data-action="cal-tab" data-tab="events" data-key="tab-ev" tabindex="${dayTab === 'events' ? 0 : -1}">📅 Termine${nEv ? ` <span class="tab__count">${nEv}</span>` : ''}</button>
            <button type="button" role="tab" id="tab-tr" class="tab" aria-selected="${dayTab === 'tracker'}" aria-controls="panel-day" data-action="cal-tab" data-tab="tracker" data-key="tab-tr" tabindex="${dayTab === 'tracker' ? 0 : -1}">🌡️ Tracker${nTr ? ` <span class="tab__count">${nTr}</span>` : ''}</button>
          </div>
          ${addButton(today)}
          </div>
          <div class="tabpanel" role="tabpanel" id="panel-day" aria-labelledby="${dayTab === 'events' ? 'tab-ev' : 'tab-tr'}">
            ${dayTab === 'events' ? eventsPanel(s) : trackerPanel(s, today)}
          </div>
        </div>
      </div>
    </section>`;
}

/* ---------- Ereignisse ---------- */

/** Klicks des Kalenders. Gibt true zurück, wenn behandelt. */
export function handleCalendarClick(btn, ctx) {
  const { action } = btn.dataset;
  const focusForm = () => setTimeout(() => document.querySelector('.form-box input:not([type=radio]), .form-box .level-opt input')?.focus(), 0);
  if (action === 'cal-select') { if (selected !== btn.dataset.day) resetForms(); selected = btn.dataset.day; }
  else if (action === 'cal-month') {
    const [y, m] = calMonth.split('-').map(Number);
    calMonth = toKey(new Date(y, m - 1 + Number(btn.dataset.dir), 1)).slice(0, 7);
  } else if (action === 'cal-today') { selected = ctx.today; calMonth = ctx.today.slice(0, 7); resetForms(); }
  else if (action === 'cal-tab') { dayTab = btn.dataset.tab; resetForms(); }
  else if (action === 'cal-tr-pick') { pickTracker = btn.dataset.id; }
  else if (action === 'form-toggle') {
    const wasOpen = !!formOpen;
    resetForms();
    if (!wasOpen) { formOpen = dayTab === 'events' ? 'event' : 'track'; ctx.refresh(); focusForm(); return true; }
  } else if (action === 'form-type') { formOpen = btn.dataset.formType; }
  else if (action === 'form-cancel' || action === 'track-edit-cancel') { resetForms(); }
  else if (action === 'event-edit') { resetForms(); editId = btn.dataset.id; ctx.refresh(); focusForm(); return true; }
  else if (action === 'track-edit') { resetForms(); editTrack = btn.dataset.id; ctx.refresh(); focusForm(); return true; }
  else if (action === 'event-delete') {
    const ev = getState().todos.find((t) => t.id === btn.dataset.id);
    if (!ev) return true;
    if (isSeries(ev)) {
      deleteSeriesAsk(ev, selected).then((changed) => { if (changed) ctx.refresh(); });
      return true;
    }
    if (!confirm(`„${ev.text}“${ev.endDate ? ` (${formatShort(ev.date)} – ${formatShort(ev.endDate)})` : ''} löschen?`)) return true;
    update((st) => { st.todos = st.todos.filter((t) => t.id !== ev.id); });
    toast('Termin gelöscht');
  } else if (action === 'track-delete') {
    if (!confirm('Diesen Tracker-Eintrag löschen?')) return true;
    update((st) => { const dd = ensureDay(st, selected); dd.tracks = (dd.tracks || []).filter((e) => e.id !== btn.dataset.id); });
    toast('Eintrag gelöscht');
  } else return false;
  ctx.refresh();
  return true;
}

/** Pfeiltasten zwischen den Reitern (Tastatur-Bedienung nach WAI-ARIA). */
export function handleCalendarKey(ev, ctx) {
  const tab = ev.target.closest('[role="tab"]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
  ev.preventDefault();
  dayTab = dayTab === 'events' ? 'tracker' : 'events';
  resetForms();
  ctx.refresh();
  document.querySelector(`[data-key="${dayTab === 'events' ? 'tab-ev' : 'tab-tr'}"]`)?.focus();
}

/** Werte aus dem Termin-Formular prüfen. Gibt null zurück, wenn etwas nicht passt. */
export function readEventForm(f, startDate) {
  const text = f.elements.title.value.trim();
  if (!text) return null;
  const repeat = f.elements.repeat.value in REPEATS ? f.elements.repeat.value : 'none';
  const endRaw = f.elements.endDate.value;
  const endDate = endRaw && endRaw > startDate ? endRaw : null;
  if (endDate && repeat !== 'none') return { error: 'Mehrtägige Termine können nicht wiederholt werden – bitte eins von beiden wählen' };
  const untilRaw = f.elements.until.value;
  return {
    text,
    time: f.elements.time.value || null,
    color: f.elements.color.value || null,
    repeat,
    until: repeat !== 'none' && untilRaw >= startDate ? untilRaw : null,
    endDate,
    important: !!f.elements.important?.checked,
  };
}

export function handleCalendarSubmit(form, ctx) {
  const kind = form.dataset.form;

  if (kind === 'track') {
    const entry = readTrackerForm(form);
    if (form.dataset.edit) {
      update((st) => {
        const e = (ensureDay(st, selected).tracks || []).find((x) => x.id === form.dataset.edit);
        if (e) Object.assign(e, { level: entry.level, time: entry.time, note: entry.note });
      });
      toast('Eintrag gespeichert');
    } else {
      if (selected > ctx.today) return true;
      update((st) => {
        const dd = ensureDay(st, selected);
        dd.tracks = [...(dd.tracks || []), { id: uid(), ...entry }];
      });
      toast(selected === ctx.today ? 'Eingetragen ♡' : `Nachgetragen für ${formatLong(selected)}`);
    }
    resetForms();
    ctx.refresh();
    return true;
  }

  if (kind === 'birthday' || kind === 'birthday-edit') {
    const text = form.elements.name.value.trim();
    const date = form.elements.date.value;
    if (!text || !date) return true;
    if (kind === 'birthday') {
      update((st) => { st.todos.push({ id: uid(), text, date, time: null, kind: 'event', type: 'birthday', repeat: 'yearly', doneDates: [], skipDates: [], done: false, color: null }); });
      toast(`🎂 Geburtstag von ${text} eingetragen – kommt jedes Jahr`);
    } else {
      update((st) => { Object.assign(st.todos.find((t) => t.id === form.dataset.id), { text, date }); });
      toast('Geburtstag gespeichert');
    }
    resetForms();
    ctx.refresh();
    return true;
  }

  if (kind === 'event' || kind === 'event-edit') {
    const old = kind === 'event-edit' ? getState().todos.find((t) => t.id === form.dataset.id) : null;
    const v = readEventForm(form, old ? old.date : selected);
    if (!v) return true;
    if (v.error) { toast(v.error); form.elements.repeat.focus(); return true; }
    const fields = {
      text: v.text, time: v.time, color: v.color,
      repeat: v.repeat === 'none' ? undefined : v.repeat,
      until: v.repeat === 'none' ? undefined : v.until,
      endDate: v.endDate || undefined,
      important: v.important || undefined,
    };
    if (old) {
      update((st) => {
        const t = st.todos.find((x) => x.id === old.id);
        Object.assign(t, fields);
        if (fields.repeat) { t.doneDates = t.doneDates || []; t.skipDates = t.skipDates || []; }
        for (const k of ['repeat', 'until', 'endDate', 'important']) if (t[k] === undefined) delete t[k];
      });
      toast('Termin gespeichert');
    } else {
      update((st) => {
        const t = { id: uid(), date: selected, kind: 'event', done: false, doneOn: null, ...fields };
        if (t.repeat) { t.doneDates = []; t.skipDates = []; }
        for (const k of ['repeat', 'until', 'endDate', 'important']) if (t[k] === undefined) delete t[k];
        st.todos.push(t);
      });
      toast(v.repeat !== 'none' ? `Serie angelegt: ${REPEATS[v.repeat]} ab ${formatLong(selected)}`
        : v.endDate ? `Termin eingetragen: ${formatShort(selected)} – ${formatShort(v.endDate)}`
        : selected === ctx.today ? 'Termin eingetragen – steht jetzt bei deinen To-Dos' : `Termin am ${formatLong(selected)} eingetragen`);
    }
    resetForms();
    ctx.refresh();
    return true;
  }
  return false;
}

/** Für Tests: Startzustand */
export function _setSelected(key) { selected = key; calMonth = key.slice(0, 7); resetForms(); }
