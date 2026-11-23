// Eigene Tracker (z. B. Migräne mit Stufe) und Termine – reine Rechenfunktionen, testbar.
import { timeToMinutes, diffDays, fromKey, addDays } from './dates.js';

export const SCALES = {
  '0-10':  { label: 'Stufe 0–10', min: 0, max: 10 },
  '1-5':   { label: 'Stufe 1–5', min: 1, max: 5 },
  '1-3':   { label: 'leicht / mittel / stark', min: 1, max: 3 },
  'yesno': { label: 'keine Skala (nur „war da“)', min: null, max: null },
};

/** Farben für Tracker im Kalender (kräftigere Pastelltöne, gut erkennbar mit dunkler Kontur). */
export const TRACKER_COLORS = [
  { hex: '#B7A6E3', name: 'Flieder' },
  { hex: '#EFA3B6', name: 'Rosa' },
  { hex: '#F6BE95', name: 'Pfirsich' },
  { hex: '#F5D77A', name: 'Gelb' },
  { hex: '#86CBB8', name: 'Mint' },
  { hex: '#A9D18E', name: 'Grün' },
  { hex: '#9EC2EE', name: 'Himmelblau' },
  { hex: '#C9A98F', name: 'Haselnuss' },
];

/** Farbe eines Trackers – ältere Tracker ohne Farbe bekommen eine aus der Liste. */
export function trackerColor(tracker, index = 0) {
  return tracker?.color || TRACKER_COLORS[index % TRACKER_COLORS.length].hex;
}

/** Stufe passt zur Skala? (Nach einem Skalenwechsel können alte Einträge außerhalb liegen.) */
function inScale(scale, level) {
  const s = SCALES[scale];
  return !!s && s.min !== null && Number.isFinite(level) && level >= s.min && level <= s.max;
}

/** Alle wählbaren Stufen einer Skala. */
export function levelsOf(scale) {
  const s = SCALES[scale];
  if (!s || s.min === null) return [];
  return Array.from({ length: s.max - s.min + 1 }, (_, i) => s.min + i);
}

/** Verständlicher Text für eine Stufe. */
export function levelWord(scale, level) {
  if (!inScale(scale, level)) return '';
  if (scale === '1-3') return ['leicht', 'mittel', 'stark'][level - 1] || '';
  const s = SCALES[scale];
  const r = (level - s.min) / (s.max - s.min); // 0 … 1
  if (scale === '0-10' && level === 0) return 'keine';
  if (r <= 0.34) return 'leicht';
  if (r <= 0.67) return 'mittel';
  if (r < 1) return 'stark';
  return 'sehr stark';
}

export function levelText(scale, level) {
  if (level === null || level === undefined) return 'eingetragen';
  if (!inScale(scale, level)) return `Stufe ${level}`; // z. B. nach einem Skalenwechsel
  const s = SCALES[scale];
  const word = levelWord(scale, level);
  return scale === '1-3' ? word : `${level}/${s.max}${word ? ` · ${word}` : ''}`;
}

/** Stärke 0 … 1 für die Farbe. */
export function intensity(scale, level) {
  const s = SCALES[scale];
  if (!s || s.min === null || level === null || level === undefined) return 0.5;
  return Math.max(0, Math.min(1, (level - s.min) / (s.max - s.min)));
}

/** Farbe für eine Stufe: Mint (wenig) → Butter → Pfirsich → Rosa (stark). */
const STOPS = [[0xBF, 0xE3, 0xD9], [0xFC, 0xEF, 0xC2], [0xF6, 0xBE, 0x95], [0xEF, 0xA3, 0xB6]];
export function levelColor(scale, level) {
  const t = Math.max(0, Math.min(1, intensity(scale, level))) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(t));
  const f = t - i;
  const c = STOPS[i].map((v, k) => Math.round(v + (STOPS[i + 1][k] - v) * f));
  return `rgb(${c.join(',')})`;
}

/** Einträge eines Tages, nach Uhrzeit sortiert. */
export function tracksOfDay(day) {
  return [...(day?.tracks || [])].sort((a, b) => timeToMinutes(a.time || '00:00') - timeToMinutes(b.time || '00:00'));
}

/**
 * Wochen-Zusammenfassung pro Tracker.
 * @returns [{ tracker, days: [{key, max, count}], dayCount, entryCount, maxLevel, avgLevel }]
 */
export function trackerSummary(state, keys) {
  return state.trackers.map((tracker) => {
    const days = keys.map((key) => {
      const entries = (state.days[key]?.tracks || []).filter((t) => t.trackerId === tracker.id);
      const levels = entries.map((e) => e.level).filter((l) => l !== null && l !== undefined);
      return { key, count: entries.length, max: levels.length ? Math.max(...levels) : null };
    });
    const all = keys.flatMap((k) => (state.days[k]?.tracks || []).filter((t) => t.trackerId === tracker.id));
    const levels = all.map((e) => e.level).filter((l) => l !== null && l !== undefined);
    return {
      tracker,
      days,
      dayCount: days.filter((d) => d.count).length,
      entryCount: all.length,
      maxLevel: levels.length ? Math.max(...levels) : null,
      avgLevel: levels.length ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10 : null,
    };
  });
}

/* ---------- Termine (auch wiederkehrend) ---------- */

export const REPEATS = {
  none: 'einmalig',
  daily: 'täglich',
  weekly: 'jede Woche',
  biweekly: 'alle 2 Wochen',
  monthly: 'jeden Monat',
  yearly: 'jedes Jahr',
};

/** Geburtstag? (Termin-Art „birthday“, wiederholt sich jährlich) */
export const isBirthday = (ev) => ev?.type === 'birthday';

/** Alter, das an `key` erreicht wird (nur wenn das Geburtsjahr vor diesem Jahr liegt). */
export function birthdayAge(ev, key) {
  const age = Number(key.slice(0, 4)) - Number(ev.date.slice(0, 4));
  return age > 0 ? age : null;
}

/** Anzeigetext eines Termins (Geburtstage mit Alter). */
export function eventLabel(ev, key) {
  if (!isBirthday(ev)) return ev.text;
  const age = birthdayAge(ev, key);
  return `${ev.text}${age ? ` (wird ${age})` : ''}`;
}

const isSeries = (ev) => !!ev.repeat && ev.repeat !== 'none';

/** Findet der Termin `ev` am Tag `key` statt? */
export function occursOn(ev, key) {
  if (key < ev.date) return false;
  if (!isSeries(ev)) return key === ev.date || (!!ev.endDate && key <= ev.endDate); // mehrtägig: von date bis endDate
  if (ev.until && key > ev.until) return false;
  if ((ev.skipDates || []).includes(key)) return false;
  const diff = diffDays(ev.date, key);
  switch (ev.repeat) {
    case 'daily': return true;
    case 'weekly': return diff % 7 === 0;
    case 'biweekly': return diff % 14 === 0;
    case 'yearly': {
      // gleicher Tag im Jahr; 29. Februar → in Nicht-Schaltjahren am 28.
      const a = fromKey(ev.date), b = fromKey(key);
      if (a.getMonth() !== b.getMonth()) return false;
      const last = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
      return b.getDate() === Math.min(a.getDate(), last);
    }
    case 'monthly': {
      // gleicher Tag im Monat; am 31. → in kürzeren Monaten am letzten Tag
      const a = fromKey(ev.date), b = fromKey(key);
      const last = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
      return b.getDate() === Math.min(a.getDate(), last);
    }
    default: return false;
  }
}

/**
 * Termine eines Tages, nach Uhrzeit (ganztägige zuerst).
 * Bei Serien wird ein „Vorkommen“ für diesen Tag erzeugt: date = Tag, done = an diesem Tag abgehakt.
 */
export function eventsOfDay(todos, key) {
  return todos
    .filter((t) => t.kind === 'event' && occursOn(t, key))
    .map((t) => {
      if (isSeries(t)) return { ...t, date: key, startDate: t.date, recurring: true, done: (t.doneDates || []).includes(key) };
      if (t.endDate && t.endDate > t.date) {
        // mehrtägig: Uhrzeit nur am ersten Tag, danach ganztägig
        return {
          ...t, date: key, startDate: t.date, multi: true,
          dayIndex: diffDays(t.date, key) + 1, dayCount: diffDays(t.date, t.endDate) + 1,
          time: key === t.date ? t.time : null,
        };
      }
      return t;
    })
    .sort((a, b) => (a.time ? timeToMinutes(a.time) : -1) - (b.time ? timeToMinutes(b.time) : -1));
}

/** Termin abhaken – bei Serien nur für diesen einen Tag. (Ändert das übergebene Objekt.) */
export function setEventDone(ev, key, done) {
  if (isSeries(ev)) {
    const set = new Set(ev.doneDates || []);
    if (done) set.add(key); else set.delete(key);
    ev.doneDates = [...set].sort();
  } else {
    ev.done = done;
    ev.doneOn = done ? key : null;
  }
}

/** Nur das Vorkommen an `key` entfernen (Serie bleibt). */
export function skipOccurrence(ev, key) {
  ev.skipDates = [...new Set([...(ev.skipDates || []), key])].sort();
}

/** Alle Termin-Vorkommen von `from` an für `days` Tage, chronologisch. */
export function upcomingEvents(todos, from, days = 30) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const key = addDays(from, i);
    out.push(...eventsOfDay(todos, key));
  }
  return out;
}
