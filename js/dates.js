// Datums-Hilfen. Ein Tag wird als Text "JJJJ-MM-TT" in LOKALER Zeit gespeichert,
// damit der Tageswechsel genau um Mitternacht deiner Zeitzone passiert.

export const pad = (n) => String(n).padStart(2, '0');

export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now = new Date()) {
  return toKey(now);
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** Anzahl Tage von a bis b (b − a). Rundung gleicht Sommer-/Winterzeit aus. */
export function diffDays(a, b) {
  return Math.round((fromKey(b) - fromKey(a)) / 86400000);
}

/** Die letzten n Tage bis einschließlich `key`, älteste zuerst. */
export function lastNDays(key, n) {
  return Array.from({ length: n }, (_, i) => addDays(key, i - (n - 1)));
}

export function msUntilMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next - now;
}

/** "08:30" → Minuten seit Mitternacht */
export function timeToMinutes(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesNow(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes();
}

const fmtLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
const fmtWeekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const fmtFull = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatLong = (key) => fmtLong.format(fromKey(key));        // "Montag, 23. November"
export const formatShort = (key) => fmtShort.format(fromKey(key));      // "23. Nov."
export const formatWeekday = (key) => fmtWeekday.format(fromKey(key)).replace('.', ''); // "Mo"
export const formatFull = (key) => fmtFull.format(fromKey(key));        // "23.11.2026"
