// Schulferien und Feiertage je Bundesland.
// 1) Fest eingebaut (js/data/ferien.js) – funktioniert immer, auch offline.
// 2) Automatisch aktualisiert: Ist ein Bundesland gewählt und „online aktualisieren“ an,
//    fragt die App höchstens einmal pro Woche die freie OpenHolidays-Datenbank
//    (openholidaysapi.org) nach den Daten DIESES Bundeslands. Dabei wird nur das
//    Bundesland übertragen – keine Einträge, keine Gesundheitsdaten.
//    Das Ergebnis wird auf dem Gerät gespeichert und ersetzt die eingebauten Daten.
import FERIEN from './data/ferien.js';

export const REGIONS = FERIEN.regions;          // { 'DE-BY': 'Bayern', … }
export const FERIEN_INFO = { source: FERIEN.source, updated: FERIEN.updated, years: FERIEN.years };

/** Bundesland für Ferien bzw. Feiertage – null, wenn ausgeschaltet oder keins gewählt. */
export const ferienRegion = (settings) => (settings.showFerien !== false && settings.schoolRegion) || null;
export const feiertagRegion = (settings) => (settings.showFeiertage !== false && settings.schoolRegion) || null;

const API = 'https://openholidaysapi.org';
const CACHE_KEY = 'daily-quests-ferien';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;   // eine Woche
const RETRY = 60 * 60 * 1000;              // nach Fehler frühestens in einer Stunde erneut

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    return c && Array.isArray(c.holidays) && Array.isArray(c.feiertage) ? c : null;
  } catch { return null; }
}
let live = readCache();
let lastTry = 0;

/** Online geladene Daten, falls sie zum Bundesland passen. */
const liveFor = (region, data) => (data === FERIEN && live && live.region === region ? live : null);
const inLive = (c, key) => { const y = Number(key.slice(0, 4)); return y >= c.from && y <= c.to; };

/** Stand der Daten für die Einstellungen. */
export function holidayInfo(region) {
  const c = liveFor(region, FERIEN);
  if (c) return { online: true, updated: c.updated, years: [c.from, c.to] };
  return { online: false, updated: FERIEN.updated, years: FERIEN.years };
}

function dedupe(list, idOf) {
  const seen = new Set();
  return list.filter((h) => { const id = idOf(h); if (seen.has(id)) return false; seen.add(id); return true; });
}

/**
 * Ferien an einem Tag für ein Bundesland (doppelte Einträge zusammengefasst).
 * @returns [{ name, from, to }]
 */
export function holidaysOn(region, key, data = FERIEN) {
  if (!region) return [];
  const c = liveFor(region, data);
  const list = c && inLive(c, key) ? c.holidays : data.holidays.filter((h) => h.r.includes(region));
  return dedupe(list.filter((h) => h.from <= key && key <= h.to), (h) => `${h.name}|${h.from}|${h.to}`)
    .map(({ name, from, to }) => ({ name, from, to }));
}

/**
 * Gesetzliche Feiertage an einem Tag für ein Bundesland.
 * local = gilt nur in einem Teil des Landes (z. B. Friedensfest nur in Augsburg).
 * @returns [{ name, date, local }]
 */
export function feiertageOn(region, key, data = FERIEN) {
  if (!region) return [];
  const c = liveFor(region, data);
  const list = c && inLive(c, key) ? c.feiertage : (data.feiertage || []).filter((h) => h.r.includes(region));
  return dedupe(list.filter((h) => h.date === key), (h) => h.name)
    .map(({ name, date, local }) => ({ name, date, local: !!local }));
}

/** Liegt der Tag außerhalb der vorhandenen Ferien-Daten? (dann Hinweis anzeigen) */
export function outsideCoverage(key, region = null) {
  const y = Number(key.slice(0, 4));
  const [from, to] = holidayInfo(region).years;
  return y < from || y > to;
}

/* ---------- Online-Aktualisierung ---------- */

const textDe = (names) => (names.find((n) => n.language === 'DE') || names[0] || {}).text || '';

async function getJson(path, signal) {
  const res = await fetch(`${API}${path}`, { headers: { accept: 'application/json' }, signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Antworten der API in das Format der App umwandeln (auch für Tests). */
export function convertApi(region, school, publicHolidays) {
  const holidays = dedupe(school, (h) => h.id)
    .map((h) => ({ from: h.startDate, to: h.endDate, name: textDe(h.name) }))
    .sort((a, b) => a.from.localeCompare(b.from));
  const feiertage = dedupe(publicHolidays, (h) => h.id)
    .map((h) => {
      const codes = (h.subdivisions || []).map((s) => s.code);
      const local = !h.nationwide && !codes.includes(region) && codes.some((c) => c.startsWith(`${region}-`));
      return { date: h.startDate, name: textDe(h.name), local };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  return { holidays, feiertage };
}

/**
 * Daten des Bundeslands neu laden, wenn sie älter als eine Woche sind (oder force).
 * Gibt true zurück, wenn neue Daten gespeichert wurden.
 */
export async function refreshHolidays(region, { force = false } = {}) {
  if (!region || !REGIONS[region] || typeof fetch !== 'function') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const now = Date.now();
  if (!force && live && live.region === region && now - live.fetchedAt < MAX_AGE) return false;
  if (!force && now - lastTry < RETRY) return false;
  lastTry = now;

  const y = new Date().getFullYear();
  // Die API erlaubt höchstens 3 Jahre pro Abfrage → zwei Zeiträume
  const ranges = [[y - 1, y + 1], [y + 2, y + 3]];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const q = (kind, [a, b]) => getJson(`/${kind}?countryIsoCode=DE&languageIsoCode=DE&subdivisionCode=${region}&validFrom=${a}-01-01&validTo=${b}-12-31`, ctrl.signal);
    const [s1, s2, p1, p2] = await Promise.all([
      q('SchoolHolidays', ranges[0]), q('SchoolHolidays', ranges[1]),
      q('PublicHolidays', ranges[0]), q('PublicHolidays', ranges[1]),
    ]);
    const { holidays, feiertage } = convertApi(region, [...s1, ...s2], [...p1, ...p2]);
    if (holidays.length < 5 || feiertage.length < 5) throw new Error('unvollständige Antwort');
    // Abgedeckt sind die Jahre, für die es wirklich Ferien gibt
    const lastYear = Math.max(...holidays.map((h) => Number(h.from.slice(0, 4))));
    live = {
      region, fetchedAt: now, updated: new Date(now).toISOString().slice(0, 10),
      from: y - 1, to: Math.max(y - 1, lastYear), holidays, feiertage,
    };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(live)); } catch { /* Speicher voll – nur für diese Sitzung */ }
    window.dispatchEvent(new Event('dq-holidays'));
    return true;
  } catch (err) {
    console.info('Ferien-Aktualisierung nicht möglich:', err.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Online geladene Daten verwerfen (zurück zu den eingebauten). */
export function clearHolidayCache() {
  live = null;
  try { localStorage.removeItem(CACHE_KEY); } catch { /* egal */ }
}
