// Heute-Seite. Oben fest: Fokus, Hinweis auf offene Medikamente, Mutmach-Banner.
// Darunter die Kästen in der selbst gewählten Reihenfolge – einklappbar und ausblendbar
// (Einstellungen → „Heute-Seite & Bereiche“).
import { getState, update, peekDay, ensureDay, uid } from '../store.js';
import { addDays, formatShort, timeToMinutes, minutesNow, fromKey } from '../dates.js';
import { missedMeds } from '../reminders.js';
import { eventsOfDay, tracksOfDay, trackerColor, setEventDone, skipOccurrence, TRACKER_COLORS, isBirthday, eventLabel, isHabit } from '../trackers.js';
import { trackerFormHtml, readTrackerForm, trackEntriesHtml, colorDot } from './tracker-form.js';
import { bottle, pillbox, battery, star, heartFace, sparkle, line, trackerIcon } from '../icons.js';
import { esc, toast, tape, foldCard, choose } from '../ui.js';
import { pageHead } from './placeholder.js';
import { layoutOf, toggleIn, isOn } from '../layout.js';
import { feiertageOn, feiertagRegion } from '../holidays.js';

const nowTime = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; };

export const QUOTES = [
  'Pausen sind auch produktiv.',
  'Kleine Schritte zählen.',
  'Du musst heute nicht alles schaffen.',
  'Ein Glas Wasser ist auch Selbstfürsorge.',
  'Langsam ist auch ein Tempo.',
  'Heute reicht, was du schaffst.',
  'Atme einmal tief durch.',
  'Gut genug ist wirklich gut genug.',
  'Ruhetage gehören dazu.',
  'Sei heute freundlich zu dir.',
  'Fortschritt ist nicht immer laut.',
  'Du darfst stolz auf dich sein.',
];

const ENERGY = [
  { value: 0, label: 'leer' },
  { value: 25, label: 'müde' },
  { value: 50, label: 'okay' },
  { value: 75, label: 'gut' },
  { value: 100, label: 'voll' },
];

let quoteOffset = 0;    // "Neuer Satz"-Button
let openTracker = null; // welches Tracker-Formular gerade offen ist
let todoEdit = false;   // To-Do-Kasten im Modus „Sortieren & Farben“

function quoteFor(day) {
  const seed = [...day].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return QUOTES[(seed + quoteOffset) % QUOTES.length];
}

/** Medikamenten-Einnahmen eines Tages als sortierte Liste. */
export function medSlots(meds) {
  return meds
    .flatMap((m) => m.times.map((t) => ({ key: `${m.id}@${t}`, name: m.name, time: t })))
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time) || a.name.localeCompare(b.name));
}

/** Fokus-Notizen, die heute gelten. */
export function activeFocus(focus, day) {
  return focus.filter((f) => f.from <= day && day <= f.until);
}

/**
 * Sortierung im To-Do-Kasten:
 * 1. Offenes vor Erledigtem (erledigt rutscht nach unten)
 * 2. selbst gewählte Reihenfolge (`order`), falls vorhanden
 * 3. sonst: Termine nach Uhrzeit, dann Aufgaben in der Reihenfolge des Anlegens
 */
export function sortItems(items) {
  return items
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.done ? 1 : 0) - (b.t.done ? 1 : 0)
      || (Number.isFinite(a.t.order) ? a.t.order : 1e12 + a.i) - (Number.isFinite(b.t.order) ? b.t.order : 1e12 + b.i))
    .map((x) => x.t);
}

/** Einträge der To-Do-Liste für einen Tag: Termine des Tages + offene/heute erledigte Aufgaben. */
export function todosFor(todos, day) {
  const events = eventsOfDay(todos, day);
  const tasks = todos.filter((t) => t.kind !== 'event'
    && ((!t.done && t.date <= day) || (t.done && (t.doneOn || t.date) === day)));
  return sortItems([...events, ...tasks]);
}

/** Für morgen: Aufgaben mit Datum morgen + Termine morgen. */
export function tomorrowFor(todos, day) {
  const tm = addDays(day, 1);
  return sortItems([
    ...eventsOfDay(todos, tm).filter((t) => !t.done),
    ...todos.filter((t) => t.kind !== 'event' && !t.done && t.date === tm),
  ]);
}

/**
 * Einen Eintrag in der sichtbaren Liste verschieben und für alle sichtbaren eine feste Reihenfolge speichern.
 * (Ändert `todos`.)
 */
export function moveTodo(todos, visibleIds, id, dir) {
  const ids = [...visibleIds];
  const i = ids.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  ids.forEach((vid, k) => { const t = todos.find((x) => x.id === vid); if (t) t.order = k; });
}

/** Kleines Kennzeichen vor Terminen: 📅 Uhrzeit bzw. 🎂 bei Geburtstagen. */
export const eventChip = (t) => (t.kind !== 'event' ? ''
  : (t.important ? '<span class="chip chip--wichtig">❗ Wichtig</span> ' : '')
    + (isBirthday(t) ? '<span class="chip chip--bday">🎂 Geburtstag</span> '
      : `<span class="chip chip--event">📅 ${t.time ? esc(t.time) : 'ganztägig'}</span> `));

const colorStyle = (t) => (t.color ? ` style="--c:${t.color}"` : '');
const rowCls = (t) => `${t.color ? 'row--colored' : ''} ${t.important ? 'row--wichtig' : ''}`;
const colorName = (hex) => TRACKER_COLORS.find((c) => c.hex === hex)?.name || 'keine';

/**
 * Wiederkehrenden Termin löschen: nachfragen, ob nur dieser Tag oder die ganze Serie.
 * @returns Promise<boolean> – true, wenn etwas gelöscht wurde
 */
export async function deleteSeriesAsk(ev, day) {
  const what = isBirthday(ev) ? `Geburtstag „${ev.text}“` : `„${ev.text}“`;
  const choice = await choose(`${what} wiederholt sich. Was möchtest du löschen?`, [
    { value: 'one', label: 'Nur diesen Termin' },
    { value: 'all', label: 'Alle Termine dieser Serie', primary: true },
  ]);
  if (choice === 'one') {
    update((st) => skipOccurrence(st.todos.find((x) => x.id === ev.id), day));
    toast('Dieser Termin wurde entfernt');
  } else if (choice === 'all') {
    update((st) => { st.todos = st.todos.filter((x) => x.id !== ev.id); });
    toast('Alle Termine der Serie gelöscht');
  }
  return !!choice;
}

/* ---------- Kästen ---------- */

function energyCard(d) {
  return {
    cls: '', tapeHtml: tape('rosa'),
    title: 'Mein Energielevel',
    body: `<fieldset class="energy">
      <legend class="visually-hidden">Energie heute</legend>
      ${ENERGY.map((e) => `
        <label class="energy__opt">
          <input type="radio" name="energy" value="${e.value}" class="visually-hidden" data-key="energy-${e.value}" ${d.energy === e.value ? 'checked' : ''}>
          <span class="energy__box">${battery(e.value)}<span class="energy__pct">${e.value} %</span><span class="visually-hidden">${e.label}</span></span>
        </label>`).join('')}
    </fieldset>`,
  };
}

function waterCard(d, goal) {
  const pct = Math.min(100, Math.round((d.water / goal) * 100));
  return {
    cls: 'card--himmel', tapeHtml: tape('mint', 'left'), title: 'Trinken', icon: bottle(d.water / goal),
    sub: `${d.water.toLocaleString('de-DE')} von ${goal.toLocaleString('de-DE')} ml`,
    body: `
      <p class="big-number" aria-live="polite">
        <strong>${d.water.toLocaleString('de-DE')}</strong> von ${goal.toLocaleString('de-DE')} ml
        <span class="card__sub">· ${Math.floor(d.water / 250)} ${Math.floor(d.water / 250) === 1 ? 'Glas' : 'Gläser'}</span>
      </p>
      <div class="progress" role="progressbar" aria-label="Trinkziel" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${pct} Prozent">
        <div class="progress__bar" style="width:${pct}%" data-full="${pct >= 100}"></div>
      </div>
      ${pct >= 100 ? '<p class="yay">Tagesziel geschafft! ✦</p>' : ''}
      <div class="btn-row" style="margin-top:var(--s3)">
        <button class="btn btn--butter" type="button" data-action="water" data-ml="250" data-key="w250">+250 ml</button>
        <button class="btn btn--mint" type="button" data-action="water" data-ml="500" data-key="w500">+500 ml</button>
        <button class="btn btn--icon" type="button" data-action="water" data-ml="-250" data-key="wminus" aria-label="250 ml abziehen" ${d.water <= 0 ? 'disabled' : ''}>${line.minus()}</button>
      </div>`,
  };
}

function medsCard(s, d) {
  const slots = medSlots(s.meds);
  const taken = slots.filter((x) => d.medsTaken[x.key]).length;
  return {
    cls: 'card--flieder', tapeHtml: tape('butter'), title: 'Medikamente',
    icon: pillbox(slots.length && taken === slots.length ? 'joy' : 'happy'),
    sub: slots.length ? `<span class="chip chip--ok">${taken} genommen</span> <span class="chip chip--open">${slots.length - taken} offen</span>` : '',
    body: slots.length ? `<ul class="plain">
      ${slots.map((x) => {
        const ok = !!d.medsTaken[x.key];
        return `<li><label class="row ${ok ? 'row--done' : ''}">
          <input type="checkbox" class="check" data-action="med" data-med="${esc(x.key)}" data-key="med-${esc(x.key)}" ${ok ? 'checked' : ''}>
          <span class="row__text"><strong>${esc(x.time)}</strong> · ${esc(x.name)}</span>
          <span class="chip ${ok ? 'chip--ok' : 'chip--open'}">${ok ? 'genommen' : 'offen'}</span>
        </label></li>`;
      }).join('')}
    </ul>` : `<p>Noch keine Medikamente eingetragen.</p>
      <p style="margin-top:var(--s2)"><a class="btn btn--small" href="#einstellungen">Medikamente anlegen</a></p>`,
  };
}

function todoRow(t, day, list) {
  const pos = list.indexOf(t);
  const label = `${eventChip(t)}${esc(eventLabel(t, day))}${t.multi ? ` <span class="chip">↔ bis ${formatShort(t.endDate)} · Tag ${t.dayIndex}/${t.dayCount}</span>` : ''}${!t.done && t.kind !== 'event' && t.date < day ? ` <span class="chip">seit ${formatShort(t.date)}</span>` : ''}`;
  if (todoEdit) {
    return `<li class="row row--edit ${rowCls(t)}"${colorStyle(t)}>
      <span class="row__text">${label}</span>
      <label class="visually-hidden" for="col-${t.id}">Farbe für „${esc(t.text)}“</label>
      <select id="col-${t.id}" class="select select--mini" data-action="todo-color" data-id="${t.id}" data-key="col-${t.id}">
        <option value="">keine Farbe</option>
        ${TRACKER_COLORS.map((c) => `<option value="${c.hex}" ${t.color === c.hex ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
      <button class="btn btn--ghost btn--icon" type="button" data-action="todo-move" data-dir="-1" data-id="${t.id}" data-key="up-${t.id}" aria-label="„${esc(t.text)}“ nach oben" ${pos === 0 ? 'disabled' : ''}>${line.arrowUp()}</button>
      <button class="btn btn--ghost btn--icon" type="button" data-action="todo-move" data-dir="1" data-id="${t.id}" data-key="down-${t.id}" aria-label="„${esc(t.text)}“ nach unten" ${pos === list.length - 1 ? 'disabled' : ''}>${line.arrowDown()}</button>
    </li>`;
  }
  return `<li class="row ${t.done ? 'row--done' : ''} ${rowCls(t)}"${colorStyle(t)}>
    <label class="row__main">
      <input type="checkbox" class="check" data-action="todo-toggle" data-id="${t.id}" data-key="todo-${t.id}" ${t.done ? 'checked' : ''}>
      <span class="row__text">${label}${t.color ? `<span class="visually-hidden"> (Farbe ${colorName(t.color)})</span>` : ''}</span>
    </label>
    ${!t.done && t.kind !== 'event' ? `<button class="btn btn--ghost btn--icon" type="button" data-action="todo-tomorrow" data-id="${t.id}" data-key="todo-tm-${t.id}" aria-label="„${esc(t.text)}“ auf morgen verschieben" title="Auf morgen">${line.arrowRight()}</button>` : ''}
    <button class="btn btn--ghost btn--icon" type="button" data-action="todo-delete" data-id="${t.id}" data-key="todo-del-${t.id}" aria-label="„${esc(t.text)}“ löschen" title="Löschen">${line.trash()}</button>
  </li>`;
}

function todosCard(s, day) {
  const todos = todosFor(s.todos, day);
  const tomorrow = tomorrowFor(s.todos, day);
  const openCount = todos.filter((t) => !t.done).length;
  const feiertage = feiertageOn(feiertagRegion(s.settings), day);
  return {
    cls: '', tapeHtml: tape('himmel'), title: 'To-Dos & Termine',
    sub: todos.length ? `<span class="chip chip--ok">${todos.length - openCount} geschafft</span> <span class="chip chip--open">${openCount} offen</span>` : '',
    body: `
      ${feiertage.map((f) => `<p class="ferien-chip feiertag-chip" style="margin:0 0 var(--s2)">🎉 Heute ist Feiertag: <strong>${esc(f.name)}</strong>${f.local ? ' <span class="card__sub">(nur örtlich)</span>' : ''}</p>`).join('')}
      ${todoEdit ? '' : `<form class="inline-form" data-form="todo">
        <label for="todo-input" class="visually-hidden">Neue Aufgabe</label>
        <input id="todo-input" class="input" name="text" maxlength="200" placeholder="Neue Aufgabe …" autocomplete="off" data-key="todo-input">
        <button class="btn btn--mint btn--icon" type="submit" aria-label="Aufgabe hinzufügen" data-key="todo-add">${line.plus()}</button>
      </form>`}
      ${todos.length ? `<ul class="plain" style="margin-top:var(--s2)">${todos.map((t) => todoRow(t, day, todos)).join('')}</ul>`
        : '<p class="card__sub" style="margin-top:var(--s2)">Keine Aufgaben für heute. Genieß es! ♡</p>'}
      ${todos.length ? `<div class="btn-row" style="margin-top:var(--s2)">
        <button class="btn btn--small ${todoEdit ? 'btn--mint' : ''}" type="button" data-action="todo-edit" data-key="todo-edit" aria-pressed="${todoEdit}">${todoEdit ? '✓ Fertig' : '↕ Sortieren & Farben'}</button>
      </div>` : ''}
      ${tomorrow.length ? `
        <details class="later">
          <summary>Für morgen geplant (${tomorrow.length})</summary>
          <ul class="plain">${tomorrow.map((t) => `<li class="row ${rowCls(t)}"${colorStyle(t)}>
            <span class="row__text">${eventChip(t)}${esc(eventLabel(t, addDays(day, 1)))}</span>
            ${t.kind === 'event' ? '' : `<button class="btn btn--ghost btn--icon" type="button" data-action="todo-today" data-id="${t.id}" data-key="todo-back-${t.id}" aria-label="„${esc(t.text)}“ zurück auf heute holen" title="Zurück auf heute">${line.arrowLeft()}</button>`}
          </li>`).join('')}</ul>
        </details>` : ''}`,
  };
}

const WIN_HINTS = ['Ich bin aufgestanden …', 'Ich habe an mich gedacht …', 'Ein kleiner Erfolg …'];
export const MAX_WINS = 12;
let extraWinSlots = 0; // zusätzliche leere Felder über „+ Weiterer Erfolg“

/** Anzahl Eingabefelder: mindestens 3, sonst alle ausgefüllten + gewünschte leere. */
export function winSlots(wins, extra = 0) {
  const filled = wins.filter(Boolean).length;
  return Math.min(MAX_WINS, Math.max(3, wins.length, filled + extra));
}

function winsCard(d) {
  const n = winSlots(d.wins, extraWinSlots);
  const wins = Array.from({ length: n }, (_, i) => d.wins[i] || '');
  const count = wins.filter(Boolean).length;
  return {
    cls: 'card--butter', tapeHtml: tape('flieder', 'left'), title: 'Kleine Erfolge',
    sub: `${count} ${count === 1 ? 'Erfolg' : 'Erfolge'} heute ★`,
    body: `<ul class="plain wins">
      ${wins.map((w, i) => `<li class="win">
        <span class="win__star ${w ? 'pop' : ''}">${star(!!w)}</span>
        <label for="win-${i}" class="visually-hidden">Erfolg ${i + 1}</label>
        <input id="win-${i}" class="input" maxlength="120" data-action="win" data-index="${i}" data-key="win-${i}" value="${esc(w)}" placeholder="${WIN_HINTS[i] || 'Noch ein kleiner Erfolg …'}" autocomplete="off">
      </li>`).join('')}
    </ul>
    ${n < MAX_WINS ? `<button class="btn btn--small" type="button" data-action="win-add" data-key="win-add" style="margin-top:var(--s2)">${line.plus()} Weiterer Erfolg</button>` : ''}`,
  };
}

function focusCard(s, day) {
  const planned = s.focus.filter((f) => f.until >= day).sort((a, b) => a.from.localeCompare(b.from));
  return {
    cls: 'card--mint', tapeHtml: tape('rosa'), title: 'Darauf achte ich morgen / diese Woche',
    sub: 'Wird an den nächsten Tagen oben angezeigt.',
    body: `
      <form class="focus-form" data-form="focus">
        <label for="focus-input" class="visually-hidden">Worauf möchtest du achten?</label>
        <input id="focus-input" class="input" name="text" maxlength="160" placeholder="z. B. früher ins Bett gehen" autocomplete="off" data-key="focus-input">
        <div class="inline-form">
          <label for="focus-scope" class="visually-hidden">Zeitraum</label>
          <select id="focus-scope" class="select" name="scope" data-key="focus-scope">
            <option value="tomorrow">nur morgen</option>
            <option value="week">die nächsten 7 Tage</option>
          </select>
          <button class="btn btn--butter" type="submit" data-key="focus-add">Merken</button>
        </div>
      </form>
      ${planned.length ? `<ul class="plain" style="margin-top:var(--s2)">
        ${planned.map((f) => `<li class="row">
          <span class="row__text">${esc(f.text)} <span class="chip">${f.from === f.until ? formatShort(f.from) : `${formatShort(f.from)} – ${formatShort(f.until)}`}</span></span>
          <button class="btn btn--ghost btn--icon" type="button" data-action="focus-delete" data-id="${f.id}" data-key="focus-del-${f.id}" aria-label="Fokus „${esc(f.text)}“ löschen">${line.trash()}</button>
        </li>`).join('')}
      </ul>` : ''}`,
  };
}

function habitsCard(s, d) {
  const habits = s.trackers.map((tr, idx) => ({ tr, idx })).filter((x) => isHabit(x.tr));
  const done = habits.filter((x) => (d.tracks || []).some((e) => e.trackerId === x.tr.id)).length;
  return {
    cls: 'card--mint', tapeHtml: tape('butter', 'left'), title: 'Meine Gewohnheiten',
    sub: habits.length ? `<span class="chip chip--ok">${done} geschafft</span> <span class="chip chip--open">${habits.length - done} offen</span>` : '',
    body: habits.length ? `<ul class="plain">
      ${habits.map(({ tr, idx }) => {
        const ok = (d.tracks || []).some((e) => e.trackerId === tr.id);
        return `<li><label class="row ${ok ? 'row--done' : ''}">
          <input type="checkbox" class="check" data-action="habit" data-id="${tr.id}" data-key="habit-${tr.id}" ${ok ? 'checked' : ''}>
          <span class="row__text">${colorDot(trackerColor(tr, idx))}${esc(tr.name)}</span>
          <span class="chip ${ok ? 'chip--ok' : 'chip--open'}">${ok ? 'geschafft' : 'offen'}</span>
        </label></li>`;
      }).join('')}
    </ul>` : `<p>Noch keine Gewohnheiten. Lege unter <a href="#einstellungen">Einstellungen → Meine Tracker</a> einen Tracker mit der Skala „Gewohnheit zum Abhaken“ an, z. B. „Sport gemacht“.</p>`,
  };
}

function reflectionCard(d) {
  return {
    cls: 'card--flieder', tapeHtml: tape('mint'), title: 'Abend-Reflexion',
    sub: 'Was ich von heute in Erinnerung behalten will',
    body: `<label for="reflection" class="visually-hidden">Was ich von heute in Erinnerung behalten will</label>
      <textarea id="reflection" class="input textarea" rows="3" maxlength="600" data-action="reflection" data-key="reflection" placeholder="z. B. das Lachen in der Pause …">${esc(d.reflection || '')}</textarea>
      <p class="card__sub" style="margin-top:var(--s1)">Wird automatisch gespeichert. Nachlesen im Kalender beim Tag.</p>`,
  };
}

/** Montag der Woche von `key`. */
export const weekStart = (key) => addDays(key, -((fromKey(key).getDay() + 6) % 7));

/** Lob-Texte: Trinkziel bzw. Gewohnheit an mindestens `min` Tagen dieser Woche (Mo bis `day`) geschafft. */
export function weekPraise(state, day, min = 3) {
  const keys = [];
  for (let k = weekStart(day); k <= day; k = addDays(k, 1)) keys.push(k);
  const goal = state.settings.waterGoal || 2000;
  const out = [];
  const water = keys.filter((k) => (state.days[k]?.water || 0) >= goal).length;
  if (water >= min) out.push(`Du hast diese Woche schon an ${water} Tagen dein Trinkziel geschafft – großartig! 💧`);
  state.trackers.filter(isHabit).forEach((tr) => {
    const n = keys.filter((k) => (state.days[k]?.tracks || []).some((e) => e.trackerId === tr.id)).length;
    if (n >= min) out.push(`„${tr.name}“ schon an ${n} Tagen diese Woche – stark! ✦`);
  });
  return out;
}

function trackerCard(s, d) {
  const todayTracks = tracksOfDay(d);
  return {
    cls: 'card--rosa card--wide', tapeHtml: tape('himmel', 'left'), title: 'Wie geht es meinem Körper?', icon: trackerIcon(),
    sub: 'Migräne und andere Beschwerden festhalten.',
    body: s.trackers.some((t) => !isHabit(t)) ? `<div class="stack">
      ${s.trackers.map((tr, idx) => {
        if (isHabit(tr)) return '';
        const entries = todayTracks.filter((e) => e.trackerId === tr.id);
        const open = openTracker === tr.id;
        return `<div class="tracker">
          <div class="tracker__head">
            <span class="tracker__name">${colorDot(trackerColor(tr, idx))}${esc(tr.name)}</span>
            <button class="btn btn--small ${open ? '' : 'btn--butter'}" type="button" data-action="track-open" data-id="${tr.id}" data-key="tr-open-${tr.id}" aria-expanded="${open}">${open ? 'Abbrechen' : '+ Eintragen'}</button>
          </div>
          ${entries.length ? trackEntriesHtml(entries, s.trackers, { showName: false }) : ''}
          ${open ? trackerFormHtml(tr, `h-${tr.id}`, nowTime()) : ''}
        </div>`;
      }).join('')}
    </div>` : '<p>Noch keine Tracker angelegt – das geht unter <a href="#einstellungen">Einstellungen</a>.</p>',
  };
}

export function render(root, ctx) {
  const day = ctx.today;
  const s = getState();
  const d = peekDay(day);
  const goal = s.settings.waterGoal || 2000;
  const layout = layoutOf(s.settings);
  const focusNow = isOn(s.settings, 'focus') ? activeFocus(s.focus, day) : [];
  const missed = isOn(s.settings, 'meds') ? missedMeds(s, day, minutesNow()) : [];
  if (openTracker && !s.trackers.some((t) => t.id === openTracker)) openTracker = null;

  const builders = {
    energy: () => energyCard(d),
    water: () => waterCard(d, goal),
    meds: () => medsCard(s, d),
    todos: () => todosCard(s, day),
    wins: () => winsCard(d),
    focus: () => focusCard(s, day),
    tracker: () => trackerCard(s, d),
    habits: () => habitsCard(s, d),
    reflection: () => reflectionCard(d),
  };
  const praise = weekPraise(s, day);
  const visible = layout.order.filter((id) => !layout.hidden.has(id));

  root.innerHTML = `
    <div class="page-head">
      <h1>Heute</h1>
      <a class="btn btn--small btn--ghost" href="#einstellungen" data-key="customize" title="Reihenfolge und Kästen anpassen">${line.edit()} Anpassen</a>
    </div>
    <div class="cards">

      ${focusNow.length ? `
      <section class="card card--flieder card--wide" aria-labelledby="focus-now">
        ${tape('rosa', 'left')}
        <div class="card__head"><span class="card__icon">${sparkle()}</span><h2 id="focus-now" style="flex:1">Darauf achte ich gerade</h2></div>
        <ul class="focus-list">${focusNow.map((f) => `<li>${esc(f.text)}</li>`).join('')}</ul>
      </section>` : ''}

      ${missed.length ? `
      <div class="banner banner--alert card--wide" role="status">
        <span class="banner__icon">${pillbox('meh')}</span>
        <p class="banner__text">Noch offen: ${missed.map((x) => `${esc(x.time)} ${esc(x.name)}`).join(', ')}</p>
        <button class="btn btn--small" type="button" data-action="meds-missed-done" data-key="meds-missed-done">Alle abhaken</button>
      </div>` : ''}

      ${praise.length ? `
      <div class="banner banner--praise card--wide" role="status">
        <span class="banner__icon">${star(true)}</span>
        <p class="banner__text">${praise.map(esc).join('<br>')}</p>
      </div>` : ''}

      <div class="banner card--wide">
        <span class="banner__icon">${heartFace()}</span>
        <p class="banner__text">${quoteFor(day)}</p>
        <button class="btn btn--ghost btn--icon" type="button" data-action="quote" data-key="quote" aria-label="Neuen Mutmach-Satz zeigen">${sparkle()}</button>
      </div>

      ${visible.map((id) => foldCard({ id, collapsed: layout.collapsed.has(id), ...builders[id]() })).join('')}

      ${!visible.length ? '<p class="note card--wide">Alle Kästen sind ausgeblendet. Unter <a href="#einstellungen">Einstellungen</a> kannst du sie wieder einschalten.</p>' : ''}
    </div>`;

  /* ---------- Ereignisse ---------- */
  root.onclick = (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'fold') {
      const m = btn.dataset.module;
      update((st) => toggleIn(st.settings, 'collapsed', m, !layoutOf(st.settings).collapsed.has(m)));
      ctx.refresh();
      return;
    }
    if (action === 'quote') { quoteOffset++; ctx.refresh(); return; }
    if (action === 'win-add') {
      const cur = peekDay(day).wins;
      extraWinSlots = winSlots(cur, extraWinSlots) - cur.filter(Boolean).length + 1;
      ctx.refresh();
      const inputs = root.querySelectorAll('[data-action="win"]');
      [...inputs].find((x) => !x.value)?.focus();
      return;
    }
    if (action === 'meds-missed-done') {
      // Früher sprang der Button nur zur ersten Checkbox (auf dem Handy unsichtbar) – jetzt hakt er wirklich ab.
      const keys = missedMeds(getState(), day, minutesNow()).map((x) => x.key);
      update((st) => {
        const dd = ensureDay(st, day);
        keys.forEach((k) => { dd.medsTaken[k] = true; });
        dd.medsPlanned = medSlots(st.meds).map((x) => x.key);
      });
      toast(keys.length === 1 ? 'Abgehakt ✓' : `${keys.length} Einnahmen abgehakt ✓`);
    }
    if (action === 'water') {
      const ml = Number(btn.dataset.ml);
      update((st) => { const dd = ensureDay(st, day); dd.water = Math.max(0, dd.water + ml); });
      const after = peekDay(day).water;
      if (ml > 0 && after >= goal && after - ml < goal) toast('Trinkziel geschafft – super! 💧');
    }
    if (action === 'todo-edit') { todoEdit = !todoEdit; }
    if (action === 'todo-move') {
      const ids = todosFor(getState().todos, day).map((t) => t.id);
      update((st) => moveTodo(st.todos, ids, id, Number(btn.dataset.dir)));
    }
    if (action === 'todo-tomorrow') {
      update((st) => { const t = st.todos.find((x) => x.id === id); if (t) t.date = addDays(day, 1); });
      toast('Auf morgen verschoben');
    }
    if (action === 'todo-today') {
      update((st) => { const t = st.todos.find((x) => x.id === id); if (t) t.date = day; });
    }
    if (action === 'todo-delete') {
      const t = getState().todos.find((x) => x.id === id);
      if (t?.repeat && t.repeat !== 'none') {
        deleteSeriesAsk(t, day).then((changed) => { if (changed) ctx.refresh(); });
        return;
      } else {
        if (t?.endDate && !confirm(`„${t.text}“ geht über mehrere Tage. Den ganzen Termin löschen?`)) return;
        update((st) => { st.todos = st.todos.filter((x) => x.id !== id); });
        toast(t?.kind === 'event' ? 'Termin gelöscht' : 'Aufgabe gelöscht');
      }
    }
    if (action === 'track-open') {
      openTracker = openTracker === id ? null : id;
      ctx.refresh();
      if (openTracker) root.querySelector('[data-form="track"] input')?.focus();
      return;
    }
    if (action === 'track-delete') {
      if (!confirm('Diesen Eintrag löschen?')) return;
      update((st) => { const dd = ensureDay(st, day); dd.tracks = (dd.tracks || []).filter((e) => e.id !== id); });
      toast('Eintrag gelöscht');
    }
    if (action === 'focus-delete') {
      update((st) => { st.focus = st.focus.filter((x) => x.id !== id); });
    }
    ctx.refresh();
  };

  root.onchange = (ev) => {
    const el = ev.target;
    if (el.name === 'energy') {
      update((st) => { ensureDay(st, day).energy = Number(el.value); });
    } else if (el.dataset.action === 'med') {
      update((st) => {
        const dd = ensureDay(st, day);
        if (el.checked) dd.medsTaken[el.dataset.med] = true;
        else delete dd.medsTaken[el.dataset.med];
        dd.medsPlanned = medSlots(st.meds).map((x) => x.key); // Plan des Tages für den Wochenrückblick
      });
    } else if (el.dataset.action === 'todo-toggle') {
      update((st) => {
        const t = st.todos.find((x) => x.id === el.dataset.id);
        if (t?.kind === 'event') setEventDone(t, day, el.checked);
        else if (t) { t.done = el.checked; t.doneOn = el.checked ? day : null; }
      });
      if (el.checked) toast('Erledigt ✓ – rutscht nach unten');
    } else if (el.dataset.action === 'habit') {
      update((st) => {
        const dd = ensureDay(st, day);
        const rest = (dd.tracks || []).filter((e) => e.trackerId !== el.dataset.id);
        dd.tracks = el.checked ? [...rest, { id: uid(), trackerId: el.dataset.id, level: null, time: nowTime(), note: '' }] : rest;
      });
      if (el.checked) toast('Geschafft – super! ✦');
    } else if (el.dataset.action === 'reflection') {
      update((st) => { ensureDay(st, day).reflection = el.value.trim(); });
      if (el.value.trim()) toast('Gespeichert ♡');
      return; // kein Neuzeichnen, damit der Text-Cursor bleibt
    } else if (el.dataset.action === 'todo-color') {
      update((st) => { const t = st.todos.find((x) => x.id === el.dataset.id); if (t) t.color = el.value || null; });
    } else if (el.dataset.action === 'win') {
      const i = Number(el.dataset.index);
      const text = el.value.trim();
      update((st) => {
        const dd = ensureDay(st, day);
        const arr = [...(dd.wins || [])];
        while (arr.length <= i) arr.push('');
        arr[i] = text;
        while (arr.length > 3 && !arr[arr.length - 1]) arr.pop(); // leere Felder am Ende nicht speichern
        dd.wins = arr;
      });
      if (text) toast('Erfolg notiert ★');
    } else return;
    ctx.refresh();
  };

  // Reflexion schon beim Tippen sichern (falls die App ohne Verlassen des Felds geschlossen wird).
  root.oninput = (ev) => {
    if (ev.target.dataset.action === 'reflection') update((st) => { ensureDay(st, day).reflection = ev.target.value; });
  };

  root.onsubmit = (ev) => {
    ev.preventDefault();
    const form = ev.target;
    if (form.dataset.form === 'track') {
      const entry = readTrackerForm(form);
      update((st) => {
        const dd = ensureDay(st, day);
        dd.tracks = [...(dd.tracks || []), { id: uid(), ...entry }];
      });
      openTracker = null;
      toast('Eingetragen ♡');
      ctx.refresh();
      return;
    }
    const text = form.elements.text.value.trim();
    if (!text) { form.elements.text.focus(); return; }
    if (form.dataset.form === 'todo') {
      update((st) => { st.todos.push({ id: uid(), text, date: day, done: false, doneOn: null, color: null }); });
      ctx.refresh();
      root.querySelector('#todo-input')?.focus();
    } else if (form.dataset.form === 'focus') {
      const scope = form.elements.scope.value;
      const from = addDays(day, 1);
      const until = scope === 'week' ? addDays(day, 7) : from;
      update((st) => { st.focus.push({ id: uid(), text, scope, from, until }); });
      toast(scope === 'week' ? 'Gemerkt für die nächsten 7 Tage' : 'Gemerkt für morgen');
      ctx.refresh();
    }
  };
}
