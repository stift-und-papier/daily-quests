// Speicher der App. Alles liegt NUR im localStorage dieses Browsers auf diesem Gerät.
// Es gibt keinen Server und keine Übertragung ins Internet.

const KEY = 'dailyQuests.v1';
const listeners = new Set();

export function defaults() {
  return {
    version: 1,
    settings: {
      waterGoal: 2000,          // ml pro Tag
      cycleLength: 28,          // Tage
      periodLength: 5,          // Tage
      reduceMotion: false,      // Animationen in der App abschalten
      theme: 'system',          // 'system' | 'light' | 'dark'
      lastBackup: null,         // Datum des letzten Exports
      weekLayout: {             // Woche-Seite: Reihenfolge, ausgeblendet, eingeklappt
        order: ['wins', 'energy', 'water', 'meds', 'tracker', 'table'],
        hidden: [],
        collapsed: [],
      },
      schoolRegion: null,      // Bundesland für Schulferien/Feiertage im Kalender, z. B. 'DE-BY'
      showFerien: true,        // Schulferien des Bundeslands anzeigen
      showFeiertage: true,     // Feiertage des Bundeslands anzeigen
      holidaysOnline: true,    // Ferien/Feiertage einmal pro Woche online aktualisieren
      layout: {                 // Heute-Seite: Reihenfolge, ausgeblendet (auch 'cycle'), eingeklappt
        order: ['energy', 'water', 'meds', 'todos', 'wins', 'focus', 'tracker', 'habits', 'reflection'],
        hidden: [],
        collapsed: [],
      },
      reminders: {
        water:   { enabled: false, interval: 90, from: '08:00', to: '21:00' },
        meds:    { enabled: false },
        evening: { enabled: false, time: '20:30' },
        events:  { enabled: false, before: 30 },   // Termine, Minuten vorher
      },
    },
    meds: [],                   // [{ id, name, times: ['08:00'] }]
    trackers: [                 // eigene Tracker, z. B. Migräne mit Stufe
      { id: 'migraene', name: 'Migräne', scale: '0-10', color: '#B7A6E3' },
    ],
    days: {},                   // { 'JJJJ-MM-TT': { water, medsTaken, energy, wins, tracks, reflection } }
    todos: [],                  // [{ id, text, date, done, kind: 'todo'|'event', time }]
    focus: [],                  // [{ id, text, scope: 'tomorrow'|'week', from, until }]
    cycle: { periodDays: [] },  // ['JJJJ-MM-TT', …] – jeder eingetragene Periodentag
  };
}

export function emptyDay() {
  return { water: 0, medsTaken: {}, energy: null, wins: [], tracks: [], reflection: '' };
}

/** Fehlende Felder mit Standardwerten auffüllen (z. B. nach einem Update oder Import). */
function mergeDeep(base, extra) {
  if (Array.isArray(base)) return Array.isArray(extra) ? extra : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
      for (const k of Object.keys(extra)) {
        out[k] = k in base ? mergeDeep(base[k], extra[k]) : extra[k];
      }
    }
    return out;
  }
  return extra === undefined ? base : extra;
}

export function normalize(data) {
  return mergeDeep(defaults(), data || {});
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : defaults();
  } catch (err) {
    console.warn('Daten konnten nicht gelesen werden', err);
    return defaults();
  }
}

let state = load();
export let lastSaveError = null;

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    lastSaveError = null;
  } catch (err) {
    lastSaveError = err;
    console.error('Speichern fehlgeschlagen', err);
  }
}

export function getState() {
  return state;
}

/** Daten ändern: update(s => { s.todos.push(...) }) – speichert automatisch. */
export function update(fn) {
  fn(state);
  save();
  listeners.forEach((l) => l(state));
}

/** Alle Daten ersetzen (für den Import). */
export function replaceAll(data) {
  state = normalize(data);
  save();
  listeners.forEach((l) => l(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Tag lesen, ohne ihn anzulegen. */
export function peekDay(key) {
  return { ...emptyDay(), ...(state.days[key] || {}) };
}

/** Tag holen und bei Bedarf anlegen – nur innerhalb von update() benutzen. */
export function ensureDay(s, key) {
  if (!s.days[key]) s.days[key] = emptyDay();
  return s.days[key];
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const STORAGE_KEY = KEY;
