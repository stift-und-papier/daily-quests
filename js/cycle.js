// Zyklus-Berechnung – reine Rechenfunktionen ohne Oberfläche, damit sie testbar sind.
// WICHTIG: Das ist eine einfache Schätzung (Kalendermethode), kein medizinisches Werkzeug
// und nicht zur Verhütung geeignet.
import { addDays, diffDays } from './dates.js';

export const PHASES = {
  menstruation: { name: 'Menstruation', short: 'Periode', text: 'Gönn dir Ruhe und Wärme.' },
  follicular:   { name: 'Follikelphase', short: 'Follikel', text: 'Oft steigt die Energie langsam wieder an.' },
  ovulation:    { name: 'Eisprung', short: 'Eisprung', text: 'Rund um den geschätzten Eisprung.' },
  luteal:       { name: 'Lutealphase', short: 'Luteal', text: 'Viele brauchen jetzt etwas mehr Pausen.' },
};

/** Alle markierten Tage → Liste der Periodenstarts (erster Tag jeder zusammenhängenden Folge). */
export function periodStarts(periodDays) {
  const set = new Set(periodDays);
  return [...set].sort().filter((d) => !set.has(addDays(d, -1)));
}

/**
 * Durchschnittliche Zykluslänge aus den Abständen der letzten Starts.
 * Nur plausible Abstände (15–60 Tage) zählen, höchstens die letzten 6.
 * Gibt es keine, wird der eingestellte Wert genommen.
 */
export function averageCycleLength(starts, fallback = 28) {
  const gaps = [];
  for (let i = 1; i < starts.length; i++) {
    const g = diffDays(starts[i - 1], starts[i]);
    if (g >= 15 && g <= 60) gaps.push(g);
  }
  const recent = gaps.slice(-6);
  if (!recent.length) return { length: fallback, fromData: 0 };
  const avg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  return { length: avg, fromData: recent.length };
}

/** Tag des geschätzten Eisprungs im Zyklus (ca. 14 Tage vor der nächsten Periode). */
export function ovulationDayOf(cycleLength, periodLength) {
  return Math.max(periodLength + 2, cycleLength - 14);
}

/** Phase für einen Zyklustag. */
export function phaseForDay(cycleDay, cycleLength, periodLength, isMarkedPeriod = false) {
  const ov = ovulationDayOf(cycleLength, periodLength);
  if (cycleDay <= periodLength || isMarkedPeriod) return 'menstruation';
  if (Math.abs(cycleDay - ov) <= 1) return 'ovulation';
  if (cycleDay < ov) return 'follicular';
  return 'luteal';
}

/**
 * Hauptfunktion: aktueller Stand des Zyklus.
 * @returns null, wenn noch kein Periodenstart eingetragen ist.
 */
export function computeCycle({ periodDays = [], cycleLength = 28, periodLength = 5, today }) {
  const pastDays = periodDays.filter((d) => d <= today);
  const starts = periodStarts(pastDays);
  if (!starts.length) return null;

  const { length, fromData } = averageCycleLength(starts, cycleLength);
  const lastStart = starts[starts.length - 1];
  const cycleDay = diffDays(lastStart, today) + 1;
  const marked = new Set(periodDays).has(today);
  const phase = phaseForDay(cycleDay, length, periodLength, marked);
  const ovDay = ovulationDayOf(length, periodLength);

  const nextPeriod = addDays(lastStart, length);
  const daysUntilNext = diffDays(today, nextPeriod);
  const late = daysUntilNext < 0 ? -daysUntilNext : 0;
  const ovulationDate = addDays(lastStart, ovDay - 1);

  return {
    lastStart,
    cycleDay,
    cycleLength: length,
    lengthFromData: fromData,       // aus wie vielen eigenen Zyklen berechnet (0 = Einstellung)
    periodLength,
    phase,
    ovulationDay: ovDay,
    ovulationDate,
    nextPeriod,
    daysUntilNext: Math.max(0, daysUntilNext),
    late,                           // Tage über der Prognose
    starts,
  };
}

/** Phase und Zyklustag an einem beliebigen (vergangenen) Tag – mit den Daten, die bis dahin bekannt waren. */
export function phaseOnDate(state, key) {
  const { cycleLength, periodLength } = state.settings;
  const c = computeCycle({ periodDays: state.cycle.periodDays, cycleLength, periodLength, today: key });
  return c ? { phase: c.phase, cycleDay: c.cycleDay, cycleLength: c.cycleLength } : null;
}

/**
 * Tracker nach Zyklusphase auswerten.
 * @returns [{ tracker, total, unknown, phases: { menstruation: {days, avg}, … }, byCycleDay: [Anzahl Tage je Zyklustag 1…n] }]
 */
export function trackerCycleStats(state) {
  const keys = Object.keys(state.days).sort();
  return state.trackers.map((tracker) => {
    const phases = Object.fromEntries(Object.keys(PHASES).map((p) => [p, { days: 0, levels: [] }]));
    const byCycleDay = [];
    let total = 0, unknown = 0;
    for (const key of keys) {
      const entries = (state.days[key].tracks || []).filter((e) => e.trackerId === tracker.id);
      if (!entries.length) continue;
      total++;
      const ph = phaseOnDate(state, key);
      if (!ph) { unknown++; continue; }
      phases[ph.phase].days++;
      const levels = entries.map((e) => e.level).filter((l) => Number.isFinite(l));
      if (levels.length) phases[ph.phase].levels.push(Math.max(...levels));
      const i = Math.min(ph.cycleDay, 45) - 1;
      byCycleDay[i] = (byCycleDay[i] || 0) + 1;
    }
    for (const p of Object.values(phases)) {
      p.avg = p.levels.length ? Math.round((p.levels.reduce((a, b) => a + b, 0) / p.levels.length) * 10) / 10 : null;
      delete p.levels;
    }
    return { tracker, total, unknown, phases, byCycleDay };
  });
}

/**
 * Für den Kalender: Geschätzte Periodentage und Eisprung-Tage der nächsten Zyklen.
 * @returns { period: Set, ovulation: Set }
 */
export function predictions(state, count = 3) {
  const period = new Set();
  const ovulation = new Set();
  if (!state) return { period, ovulation };
  const { cycleLength, periodLength, ovulationDay } = state;
  // aktueller Zyklus: Eisprung, falls noch nicht vorbei
  ovulation.add(addDays(state.lastStart, ovulationDay - 1));
  let start = state.late ? addDays(state.nextPeriod, state.late) : state.nextPeriod;
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < periodLength; k++) period.add(addDays(start, k));
    ovulation.add(addDays(start, ovulationDay - 1));
    start = addDays(start, cycleLength);
  }
  return { period, ovulation };
}
