// Tests für die Rechenlogik. Aufruf: http://localhost:8080/tests.html
import { computeCycle, periodStarts, averageCycleLength } from './cycle.js';
import { addDays, diffDays, lastNDays, todayKey, msUntilMidnight } from './dates.js';
import { weekSummary } from './views/week.js';
import { remindersForDay, dueNow, missedMeds } from './reminders.js';
import { calendarEvents, buildIcs } from './ics.js';
import { exportText, parseBackup } from './backup.js';
import { normalize } from './store.js';
import { levelsOf, levelWord, levelText, trackerSummary, trackerColor, occursOn, eventsOfDay, setEventDone, skipOccurrence, upcomingEvents } from './trackers.js';
import { rruleOf } from './ics.js';
import { phaseOnDate, trackerCycleStats } from './cycle.js';
import { reportData, reportHtml, rangeStart } from './report.js';
import { todosFor, tomorrowFor, moveTodo, winSlots, eventChip } from './views/today.js';
import { REGIONS, holidaysOn, outsideCoverage, feiertageOn, feiertagRegion, ferienRegion, convertApi } from './holidays.js';
import FERIEN from './data/ferien.js';
import { readEventForm } from './views/calendar-part.js';
import { layoutOf, normalizeOrder, moveInList, toggleIn, isOn, moveModule } from './layout.js';
import { birthdayAge, eventLabel } from './trackers.js';
import { spanPos } from './views/calendar-part.js';

const groups = [];
let current;
function group(name) { current = { name, rows: [] }; groups.push(current); }
function check(desc, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  current.rows.push({ desc, actual, expected, ok });
}
/** Periode von `start` mit `n` Tagen als Liste */
const period = (start, n = 5) => Array.from({ length: n }, (_, i) => addDays(start, i));

/* ---------- Zyklus ---------- */
group('Zyklus: 28 Tage, Periode 5 Tage, Start 01.11.2026');
const base = { periodDays: period('2026-11-01'), cycleLength: 28, periodLength: 5 };
const at = (today, extra = {}) => computeCycle({ ...base, ...extra, today });
const pick = (r) => r && { tag: r.cycleDay, phase: r.phase };

check('01.11. → Tag 1, Menstruation', pick(at('2026-11-01')), { tag: 1, phase: 'menstruation' });
check('05.11. → Tag 5, Menstruation', pick(at('2026-11-05')), { tag: 5, phase: 'menstruation' });
check('06.11. → Tag 6, Follikelphase', pick(at('2026-11-06')), { tag: 6, phase: 'follicular' });
check('12.11. → Tag 12, Follikelphase', pick(at('2026-11-12')), { tag: 12, phase: 'follicular' });
check('13.11. → Tag 13, Eisprung (Fenster 13–15)', pick(at('2026-11-13')), { tag: 13, phase: 'ovulation' });
check('14.11. → Tag 14, Eisprung', pick(at('2026-11-14')), { tag: 14, phase: 'ovulation' });
check('15.11. → Tag 15, Eisprung', pick(at('2026-11-15')), { tag: 15, phase: 'ovulation' });
check('16.11. → Tag 16, Lutealphase', pick(at('2026-11-16')), { tag: 16, phase: 'luteal' });
check('28.11. → Tag 28, Lutealphase', pick(at('2026-11-28')), { tag: 28, phase: 'luteal' });
check('Prognose nächste Periode', at('2026-11-10').nextPeriod, '2026-11-29');
check('Tage bis zur nächsten Periode am 10.11.', at('2026-11-10').daysUntilNext, 19);
check('Geschätzter Eisprung', at('2026-11-10').ovulationDate, '2026-11-14');
check('02.12. → Tag 32, 3 Tage überfällig', [at('2026-12-02').cycleDay, at('2026-12-02').late], [32, 3]);
check('Nachgetragener 6. Periodentag zählt als Menstruation',
  pick(computeCycle({ ...base, periodDays: period('2026-11-01', 6), today: '2026-11-06' })), { tag: 6, phase: 'menstruation' });

group('Zyklus: Prognose passt sich an eigene Daten an');
const three = [...period('2026-10-01'), ...period('2026-10-31'), ...period('2026-11-30')];
check('Starts werden erkannt', periodStarts(three), ['2026-10-01', '2026-10-31', '2026-11-30']);
check('Durchschnitt aus 2 Zyklen (je 30 Tage)', averageCycleLength(periodStarts(three), 28), { length: 30, fromData: 2 });
const r30 = computeCycle({ periodDays: three, cycleLength: 28, periodLength: 5, today: '2026-12-05' });
check('05.12. → Tag 6, Follikelphase', pick(r30), { tag: 6, phase: 'follicular' });
check('Eisprung jetzt an Tag 16', r30.ovulationDay, 16);
check('Nächste Periode nach 30 Tagen', r30.nextPeriod, '2026-12-30');
check('Unplausibler Abstand (5 Tage) wird ignoriert',
  averageCycleLength(['2026-10-01', '2026-10-06', '2026-11-03'], 28), { length: 28, fromData: 1 });
check('Ohne Daten → keine Berechnung', computeCycle({ periodDays: [], today: '2026-11-23' }), null);
check('Zukünftige Einträge werden ignoriert', computeCycle({ periodDays: ['2026-12-24'], today: '2026-11-23' }), null);

group('Zyklus: Sommerzeit-Umstellung (29.03.2026)');
check('20.03. → 02.04. = Tag 14',
  pick(computeCycle({ periodDays: period('2026-03-20'), cycleLength: 28, periodLength: 5, today: '2026-04-02' })), { tag: 14, phase: 'ovulation' });

/* ---------- Datum & Tageswechsel ---------- */
group('Datum & Tageswechsel');
check('Tag nach dem 31.12.', addDays('2026-12-31', 1), '2027-01-01');
check('Schaltjahr 2028: 28.02. + 1', addDays('2028-02-28', 1), '2028-02-29');
check('Abstand über Winterzeit-Umstellung (25.10.2026)', diffDays('2026-10-24', '2026-10-26'), 2);
check('Letzte 7 Tage', lastNDays('2026-11-23', 7), ['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']);
check('23:59:30 → neuer Tag-Schlüssel kurz nach Mitternacht',
  [todayKey(new Date(2026, 10, 23, 23, 59, 30)), todayKey(new Date(2026, 10, 24, 0, 0, 1))], ['2026-11-23', '2026-11-24']);
check('Millisekunden bis Mitternacht um 23:59:30', msUntilMidnight(new Date(2026, 10, 23, 23, 59, 30)), 30000);

/* ---------- Wochenrückblick ---------- */
group('Wochenrückblick (Testdaten, nicht deine echten Daten)');
const wk = weekSummary({
  settings: { waterGoal: 2000 },
  meds: [{ id: 'a', name: 'A', times: ['08:00', '20:00'] }],
  days: {
    '2026-11-17': { water: 2000, energy: 50, medsTaken: { 'a@08:00': true, 'a@20:00': true }, medsPlanned: ['a@08:00', 'a@20:00'], wins: ['x', '', ''] },
    '2026-11-20': { water: 1000, energy: 100, medsTaken: { 'a@08:00': true }, wins: ['y', 'z', ''] },
    '2026-11-10': { water: 3000, energy: 0, medsTaken: {}, wins: ['zu alt'] },
  },
}, '2026-11-23');
check('Genau 7 Tage', wk.days.length, 7);
check('Ø Trinken nur über Tage mit Einträgen', wk.waterAvg, 1500);
check('Ziel an 1 Tag erreicht', wk.goalDays, 1);
check('Medikamente 3 von 4 = 75 %', wk.medsPct, 75);
check('Ø Energie', wk.energyAvg, 75);
check('Erfolge der Woche (älterer Tag nicht dabei)', wk.wins.map((w) => w.text), ['x', 'y', 'z']);
check('Alter Tag bleibt gespeichert und ist eine Woche vorher sichtbar',
  weekSummary({ settings: {}, meds: [], days: { '2026-11-10': { water: 3000, wins: [] } } }, '2026-11-16').waterAvg, 3000);

/* ---------- Erinnerungen ---------- */
group('Erinnerungen: Zeitplan');
const remState = (over = {}) => ({
  settings: {
    waterGoal: 2000,
    reminders: {
      water: { enabled: true, interval: 120, from: '08:00', to: '14:00' },
      meds: { enabled: true },
      evening: { enabled: true, time: '20:30' },
    },
  },
  meds: [{ id: 'a', name: 'Vitamin D', times: ['08:00'] }, { id: 'b', name: 'Eisen', times: ['20:00'] }],
  days: {},
  ...over,
});
const plan = remindersForDay(remState(), '2026-11-23');
check('Plan: Uhrzeiten in Reihenfolge', plan.map((x) => x.time), ['08:00', '08:00', '10:00', '12:00', '14:00', '20:00', '20:30']);
check('08:05 → fällig: Vitamin D + Trinken', dueNow(plan, 8 * 60 + 5).map((x) => x.type).sort(), ['med', 'water']);
check('08:20 → nichts mehr (älter als 15 Min.)', dueNow(plan, 8 * 60 + 20).length, 0);
check('Abgehaktes Medikament → keine Erinnerung',
  remindersForDay(remState({ days: { '2026-11-23': { medsTaken: { 'a@08:00': true } } } }), '2026-11-23').some((x) => x.key === 'med:a@08:00'), false);
check('Trinkziel erreicht → keine Trink-Erinnerung mehr',
  remindersForDay(remState({ days: { '2026-11-23': { water: 2000 } } }), '2026-11-23').some((x) => x.type === 'water'), false);
check('Verpasst um 12:00: Vitamin D (08:00)', missedMeds(remState(), '2026-11-23', 12 * 60).map((x) => x.name), ['Vitamin D']);
check('Alles aus → leerer Plan', remindersForDay(remState({ settings: { waterGoal: 2000, reminders: { water: { enabled: false }, meds: { enabled: false }, evening: { enabled: false } } } }), '2026-11-23'), []);

group('Kalender-Datei (.ics)');
const evs = calendarEvents(remState(), { meds: true, evening: true, water: false, hideNames: true });
check('Termine: 2 Medikamente + Abend', evs.map((e) => e.time), ['08:00', '20:00', '20:30']);
check('Namen ausgeblendet', evs[0].title, '💊 Medikament (08:00)');
check('Namen sichtbar, wenn gewünscht', calendarEvents(remState(), { meds: true, hideNames: false })[0].title, '💊 Vitamin D');
check('Trinkpausen 08–14 Uhr alle 2 Std. = 4', calendarEvents(remState(), { water: true }).length, 4);
const ics = buildIcs(evs, '2026-11-24', new Date(Date.UTC(2026, 10, 23, 10, 0, 0)));
check('Beginnt und endet korrekt', [ics.startsWith('BEGIN:VCALENDAR\r\n'), ics.endsWith('END:VCALENDAR\r\n')], [true, true]);
check('Start morgen 08:00, täglich, mit Alarm',
  ['DTSTART:20261124T080000', 'RRULE:FREQ=DAILY', 'TRIGGER:PT0M'].every((x) => ics.includes(x)), true);
check('Keine Zeile länger als 75 Byte', ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75), true);
check('Sonderzeichen werden maskiert', calendarEvents({ ...remState(), meds: [{ id: 'c', name: 'A, B; C', times: ['09:00'] }] }, { meds: true }).length === 1
  && buildIcs(calendarEvents({ ...remState(), meds: [{ id: 'c', name: 'A, B; C', times: ['09:00'] }] }, { meds: true }), '2026-11-24').includes('A\\, B\\; C'), true);

group('Backup: Export & Import (Testdaten)');
const sample = normalize({ meds: [{ id: 'a', name: 'Ä, ö & ü', times: ['08:00'] }], days: { '2026-11-23': { water: 750, energy: 75, medsTaken: {}, wins: ['★ geschafft'] } }, cycle: { periodDays: ['2026-11-10'] } });
const roundtrip = parseBackup(exportText(sample));
check('Export → Import ergibt dieselben Daten', JSON.stringify(roundtrip), JSON.stringify(sample));
const rejects = (txt) => { try { parseBackup(txt); return false; } catch { return true; } };
check('Kein JSON wird abgelehnt', rejects('hallo'), true);
check('Fremde JSON-Datei wird abgelehnt', rejects('{"foo":1}'), true);
check('Beschädigtes Backup wird abgelehnt', rejects('{"app":"daily-quests","data":{"days":[]}}'), true);
check('Älteres Backup ohne neue Felder wird ergänzt', parseBackup('{"app":"daily-quests","data":{"days":{}}}').settings.waterGoal, 2000);

group('Tracker & Termine (Testdaten)');
check('Skala 0–10 hat 11 Stufen', levelsOf('0-10').length, 11);
check('Skala 1–3 Wörter', [1, 2, 3].map((l) => levelWord('1-3', l)), ['leicht', 'mittel', 'stark']);
check('Migräne 7/10 Text', levelText('0-10', 7), '7/10 · stark');
check('Migräne 0/10 Text', levelText('0-10', 0), '0/10 · keine');
check('Ja/Nein-Tracker ohne Stufe', levelText('yesno', null), 'eingetragen');
const tState = normalize({
  days: {
    '2026-11-20': { tracks: [{ id: '1', trackerId: 'migraene', level: 4, time: '09:00' }, { id: '2', trackerId: 'migraene', level: 8, time: '18:00' }] },
    '2026-11-22': { tracks: [{ id: '3', trackerId: 'migraene', level: 2, time: '07:30' }] },
  },
});
const ts = trackerSummary(tState, lastNDays('2026-11-23', 7))[0];
check('Standard-Tracker „Migräne“ 0–10 ist da', [tState.trackers[0].name, tState.trackers[0].scale], ['Migräne', '0-10']);
check('Migräne an 2 von 7 Tagen, 3 Einträge', [ts.dayCount, ts.entryCount], [2, 3]);
check('Stärkste Stufe & Durchschnitt', [ts.maxLevel, ts.avgLevel], [8, 4.7]);
check('Pro Tag die stärkste Stufe', ts.days.map((d) => d.max), [null, null, null, 8, null, 2, null]);
const todosT = [
  { id: 'a', text: 'Aufgabe alt', date: '2026-11-20', done: false },
  { id: 'b', text: 'Zahnarzt', date: '2026-11-23', time: '15:00', kind: 'event', done: false },
  { id: 'c', text: 'Geburtstag Oma', date: '2026-11-23', time: null, kind: 'event', done: false },
  { id: 'd', text: 'Termin gestern', date: '2026-11-22', time: '10:00', kind: 'event', done: false },
  { id: 'e', text: 'Termin morgen', date: '2026-11-24', time: '08:00', kind: 'event', done: false },
];
check('Heute: Termine zuerst (ganztägig vor 15:00), dann Aufgaben',
  todosFor(todosT, '2026-11-23').map((t) => t.text), ['Geburtstag Oma', 'Zahnarzt', 'Aufgabe alt']);
check('Termin erscheint genau an seinem Tag', todosFor(todosT, '2026-11-24').map((t) => t.text), ['Termin morgen', 'Aufgabe alt']);
check('Vergangene Termine wandern nicht weiter', todosFor(todosT, '2026-11-23').some((t) => t.text === 'Termin gestern'), false);

group('Tracker: Farbe, Skala, Nachtragen');
check('Migräne hat standardmäßig Flieder', normalize({}).trackers[0].color, '#B7A6E3');
check('Älterer Tracker ohne Farbe bekommt eine aus der Liste', [trackerColor({ id: 'x' }, 0), trackerColor({ id: 'y' }, 1)], ['#B7A6E3', '#EFA3B6']);
check('Gewählte Farbe wird benutzt', trackerColor({ color: '#A9D18E' }, 0), '#A9D18E');
check('„Keine Skala“ hat keine Stufen', levelsOf('yesno'), []);
check('Nach Skalenwechsel: alte Stufe bleibt lesbar', [levelText('1-3', 7), levelText('1-5', 0)], ['Stufe 7', 'Stufe 0']);
const back = normalize({ days: { '2026-11-01': { tracks: [{ id: 'r', trackerId: 'migraene', level: 5, time: '', note: 'nachgetragen' }] } } });
check('Rückwirkender Eintrag ohne Uhrzeit zählt in der Woche', trackerSummary(back, lastNDays('2026-11-03', 7))[0].days.find((d) => d.key === '2026-11-01').max, 5);

group('Termin-Erinnerungen');
const evState = (before, extraTodos = []) => {
  const st = remState();
  st.settings.reminders = { water: { enabled: false }, meds: { enabled: false }, evening: { enabled: false }, events: { enabled: true, before } };
  st.todos = [
    { id: 'z1', text: 'Zahnarzt', date: '2026-11-23', time: '15:30', kind: 'event', done: false },
    { id: 'z2', text: 'Geburtstag', date: '2026-11-23', time: null, kind: 'event', done: false },
    { id: 'z3', text: 'Erledigt', date: '2026-11-23', time: '10:00', kind: 'event', done: true },
    { id: 'z4', text: 'Morgen', date: '2026-11-24', time: '09:00', kind: 'event', done: false },
    { id: 'z5', text: 'Aufgabe', date: '2026-11-23', done: false },
    ...extraTodos,
  ];
  return st;
};
const ep = remindersForDay(evState(30), '2026-11-23');
check('Nur Termine mit Uhrzeit, offen, heute', ep.map((x) => x.title), ['📅 Zahnarzt']);
check('30 Min. vorher → Erinnerung um 15:00', ep[0].time, '15:00');
check('Text nennt Uhrzeit und Vorlauf', ep[0].body, 'Um 15:30 – in 30 Minuten.');
check('Zur Uhrzeit (0 Min.)', [remindersForDay(evState(0), '2026-11-23')[0].time, remindersForDay(evState(0), '2026-11-23')[0].body], ['15:30', 'Jetzt: Zahnarzt (15:30)']);
check('1 Stunde vorher', remindersForDay(evState(60), '2026-11-23')[0].body, 'Um 15:30 – in 1 Stunde.');
check('15:05 fällig (bei 30 Min. Vorlauf)', dueNow(ep, 15 * 60 + 5).length, 1);
const evIcs = calendarEvents(evState(30), { events: true, hideNames: false }, '2026-11-23');
check('Kalender-Datei: kommende Termine mit Uhrzeit', evIcs.map((e) => `${e.date} ${e.time} ${e.title}`), ['2026-11-23 15:30 📅 Zahnarzt', '2026-11-24 09:00 📅 Morgen']);
check('Vergangene Termine nicht in der Datei', calendarEvents(evState(30), { events: true }, '2026-11-24').length, 1);
const evText = buildIcs(evIcs, '2026-11-24');
check('Einmaliger Termin: eigenes Datum, keine Wiederholung, Alarm 30 Min. vorher',
  [evText.includes('DTSTART:20261123T153000'), evText.includes('TRIGGER:-PT30M'), (evText.match(/RRULE/g) || []).length], [true, true, 0]);
check('Terminnamen ausblendbar', calendarEvents(evState(30), { events: true, hideNames: true }, '2026-11-23')[0].title, '📅 Termin');

group('Wiederkehrende Termine');
const physio = { id: 'p', text: 'Physio', date: '2026-11-24', time: '08:00', kind: 'event', repeat: 'weekly', until: '2026-12-22', doneDates: [], skipDates: ['2026-12-08'] };
check('Jede Woche: 24.11., 1.12., 15.12., 22.12. (8.12. ausgelassen)',
  ['2026-11-24', '2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22', '2026-12-29', '2026-11-25'].map((k) => occursOn(physio, k)),
  [true, true, false, true, true, false, false]);
check('Nicht vor dem Start', occursOn(physio, '2026-11-17'), false);
check('Alle 2 Wochen', ['2026-11-24', '2026-12-01', '2026-12-08'].map((k) => occursOn({ ...physio, repeat: 'biweekly', skipDates: [] }, k)), [true, false, true]);
check('Täglich', occursOn({ ...physio, repeat: 'daily' }, '2026-11-30'), true);
const monthly31 = { id: 'm', text: 'Miete', date: '2026-01-31', kind: 'event', repeat: 'monthly' };
check('Monatlich am 31. → im Februar am 28., im April am 30.',
  ['2026-02-28', '2026-03-31', '2026-04-30', '2026-04-29'].map((k) => occursOn(monthly31, k)), [true, true, true, false]);
const occ = eventsOfDay([physio], '2026-12-01')[0];
check('Vorkommen hat das Datum des Tages', [occ.date, occ.recurring, occ.done], ['2026-12-01', true, false]);
const p2 = structuredClone(physio); setEventDone(p2, '2026-12-01', true);
check('Abhaken gilt nur für diesen Tag', [eventsOfDay([p2], '2026-12-01')[0].done, eventsOfDay([p2], '2026-12-15')[0].done], [true, false]);
const p3 = structuredClone(physio); skipOccurrence(p3, '2026-12-15');
check('„Nur diesen Tag entfernen“', [occursOn(p3, '2026-12-15'), occursOn(p3, '2026-12-22')], [false, true]);
check('Serie erscheint bei den To-Dos', todosFor([physio], '2026-12-01').map((t) => t.text), ['Physio']);
check('Nächste 21 Tage: 1.12. und 15.12. (8.12. ausgelassen)', upcomingEvents([physio], '2026-11-25', 21).map((e) => e.date), ['2026-12-01', '2026-12-15']);
check('Kalender-Datei: Wiederholungsregel', [rruleOf(physio), rruleOf({ ...physio, repeat: 'biweekly', until: null }), rruleOf(monthly31)],
  ['FREQ=WEEKLY;UNTIL=20261222T235959', 'FREQ=WEEKLY;INTERVAL=2', 'FREQ=MONTHLY;BYMONTHDAY=-1']);
const serIcs = buildIcs(calendarEvents({ ...remState(), todos: [physio] }, { events: true }, '2026-11-23'), '2026-11-24');
check('Kalender-Datei: Serie mit RRULE und ausgelassenem Tag', [serIcs.includes('RRULE:FREQ=WEEKLY;UNTIL=20261222T235959'), serIcs.includes('EXDATE:20261208T080000')], [true, true]);
const evRem = remState(); evRem.settings.reminders = { water: { enabled: false }, meds: { enabled: false }, evening: { enabled: false }, events: { enabled: true, before: 0 } }; evRem.todos = [physio];
check('Erinnerung auch für Serien-Termine', remindersForDay(evRem, '2026-12-01').map((x) => x.time), ['08:00']);

group('Tracker im Zyklus & Bericht (Testdaten)');
const cyState = normalize({
  settings: { cycleLength: 28, periodLength: 5 },
  meds: [{ id: 'a', name: 'Ibuprofen', times: ['08:00'] }],
  cycle: { periodDays: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'] },
  days: {
    '2026-09-20': { tracks: [{ id: 'x0', trackerId: 'migraene', level: 3, time: '' }] },          // vor der 1. Periode
    '2026-10-02': { tracks: [{ id: 'x1', trackerId: 'migraene', level: 8, time: '07:00', note: 'Übelkeit' }], medsTaken: { 'a@08:00': true }, medsPlanned: ['a@08:00'] },
    '2026-10-30': { tracks: [{ id: 'x2', trackerId: 'migraene', level: 6, time: '' }], medsTaken: {}, medsPlanned: ['a@08:00'] },
    '2026-10-20': { tracks: [{ id: 'x3', trackerId: 'migraene', level: 2, time: '19:00' }] },
  },
});
check('Phase an einem früheren Tag', phaseOnDate(cyState, '2026-10-02'), { phase: 'menstruation', cycleDay: 2, cycleLength: 28 });
const cs = trackerCycleStats(cyState)[0];
check('Migräne: 4 Tage, 1 ohne Phase', [cs.total, cs.unknown], [4, 1]);
check('2× in der Menstruation (Ø 7), 1× Luteal', [cs.phases.menstruation.days, cs.phases.menstruation.avg, cs.phases.luteal.days], [2, 7, 1]);
check('Zyklustag 2 kommt zweimal vor', cs.byCycleDay[1], 2);
const rd = reportData(cyState, { from: '2026-10-01', to: '2026-10-31', trackerIds: ['migraene'] });
check('Bericht: 3 Einträge im Oktober, Ø 5,3, max 8', [rd.trackers[0].entryCount, rd.trackers[0].avgLevel, rd.trackers[0].maxLevel], [3, 5.3, 8]);
check('Bericht: Medikamente am Tag dabei', rd.trackers[0].rows[0].meds, ['Ibuprofen 08:00']);
check('Bericht: Einnahme 1 von 3 Tagen mit Einträgen = 33 %', rd.medsPct, 33);
check('Bericht: Periodenbeginn im Zeitraum', rd.periodStarts, ['2026-10-01', '2026-10-29']);
const rh = reportHtml(rd, new Date(2026, 10, 23));
check('Bericht-HTML enthält Notiz und Zyklustag', [rh.includes('Übelkeit'), rh.includes('Tag 2 · Periode')], [true, true]);
check('Zeitraum „letzte 3 Monate“', rangeStart('2026-11-23', 3), '2026-08-24');

group('To-Dos: Reihenfolge, Farben, „für morgen“');
const td = [
  { id: 'a', text: 'A', date: '2026-11-23', done: false },
  { id: 'b', text: 'B', date: '2026-11-23', done: true, doneOn: '2026-11-23' },
  { id: 'c', text: 'C', date: '2026-11-23', done: false, color: '#EFA3B6' },
  { id: 'e', text: 'Termin 9 Uhr', date: '2026-11-23', time: '09:00', kind: 'event', done: false },
  { id: 'f', text: 'Morgen-Aufgabe', date: '2026-11-24', done: false },
  { id: 'g', text: 'Morgen-Termin', date: '2026-11-24', time: '10:00', kind: 'event', done: false },
  { id: 'h', text: 'Übermorgen', date: '2026-11-25', done: false },
];
check('Erledigtes rutscht nach unten', todosFor(td, '2026-11-23').map((t) => t.id), ['e', 'a', 'c', 'b']);
const td2 = structuredClone(td);
moveTodo(td2, todosFor(td2, '2026-11-23').map((t) => t.id), 'c', -1);
check('„C“ eins nach oben', todosFor(td2, '2026-11-23').map((t) => t.id), ['e', 'c', 'a', 'b']);
moveTodo(td2, todosFor(td2, '2026-11-23').map((t) => t.id), 'e', 1);
check('Termin nach unten verschoben – Reihenfolge bleibt gespeichert', todosFor(td2, '2026-11-23').map((t) => t.id), ['c', 'e', 'a', 'b']);
check('Ganz oben geht nicht weiter nach oben', (() => { const x = structuredClone(td2); moveTodo(x, ['c', 'e', 'a', 'b'], 'c', -1); return todosFor(x, '2026-11-23').map((t) => t.id); })(), ['c', 'e', 'a', 'b']);
check('Farbe bleibt am Eintrag', todosFor(td, '2026-11-23').find((t) => t.id === 'c').color, '#EFA3B6');
check('„Für morgen geplant“: nur morgen, Termin & Aufgabe', tomorrowFor(td, '2026-11-23').map((t) => t.text).sort(), ['Morgen-Aufgabe', 'Morgen-Termin']);

group('Heute-Seite: Anordnen, Ausblenden, Einklappen');
check('Standard-Reihenfolge', layoutOf(normalize({}).settings).order, ['energy', 'water', 'meds', 'todos', 'wins', 'focus', 'tracker']);
check('Unbekanntes raus, Fehlendes hinten dran', normalizeOrder(['tracker', 'xyz', 'water']), ['tracker', 'water', 'energy', 'meds', 'todos', 'wins', 'focus']);
check('Kasten nach oben verschieben', moveInList(['a', 'b', 'c'], 'c', -1), ['a', 'c', 'b']);
const lay = normalize({}).settings;
toggleIn(lay, 'hidden', 'cycle', true); toggleIn(lay, 'collapsed', 'water', true);
check('Zyklus ausgeblendet, Trinken eingeklappt', [isOn(lay, 'cycle'), isOn(lay, 'water'), layoutOf(lay).collapsed.has('water')], [false, true, true]);
toggleIn(lay, 'hidden', 'cycle', false);
check('Zyklus wieder eingeblendet', isOn(lay, 'cycle'), true);

group('Kleine Erfolge (mehr als drei)');
check('Mindestens 3 Felder', winSlots([]), 3);
check('5 Erfolge → 5 Felder', winSlots(['a', 'b', 'c', 'd', 'e']), 5);
check('„+ Weiterer Erfolg“ gibt ein Feld mehr', winSlots(['a', 'b', 'c'], 1), 4);
check('Höchstens 12', winSlots(Array(20).fill('x')), 12);
check('Wochenrückblick zählt alle Erfolge', weekSummary({ settings: {}, meds: [], days: { '2026-11-23': { wins: ['1', '2', '3', '4', ''] } } }, '2026-11-23').wins.length, 4);

group('Mehrtägige Termine');
const urlaub = { id: 'u', text: 'Urlaub', date: '2026-11-25', endDate: '2026-11-27', time: '09:00', kind: 'event', done: false };
check('Erscheint an allen 3 Tagen, nicht davor/danach',
  ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28'].map((k) => occursOn(urlaub, k)), [false, true, true, true, false]);
const mid = eventsOfDay([urlaub], '2026-11-26')[0];
check('Tag 2 von 3, ohne Uhrzeit (Uhrzeit nur am 1. Tag)', [mid.dayIndex, mid.dayCount, mid.time, eventsOfDay([urlaub], '2026-11-25')[0].time], [2, 3, null, '09:00']);
check('Steht an jedem Tag bei den To-Dos', todosFor([urlaub], '2026-11-27').map((t) => t.text), ['Urlaub']);
const urlaubRem = remState(); urlaubRem.settings.reminders = { water: { enabled: false }, meds: { enabled: false }, evening: { enabled: false }, events: { enabled: true, before: 0 } }; urlaubRem.todos = [urlaub];
check('Erinnerung nur am ersten Tag', [remindersForDay(urlaubRem, '2026-11-25').length, remindersForDay(urlaubRem, '2026-11-26').length], [1, 0]);
const uIcs = buildIcs(calendarEvents({ ...remState(), todos: [urlaub] }, { events: true }, '2026-11-26'), '2026-11-24');
check('Kalender-Datei: von–bis, noch laufend → enthalten', [uIcs.includes('DTSTART:20261125T090000'), uIcs.includes('DTEND:20261127T235900')], [true, true]);

group('Schulferien (eingebaute Daten)');
check('16 Bundesländer', Object.keys(REGIONS).length, 16);
check('Bayern 4.11.2026: Herbstferien', holidaysOn('DE-BY', '2026-11-04').map((h) => h.name), ['Herbstferien']);
check('Bayern 9.11.2026: keine Ferien', holidaysOn('DE-BY', '2026-11-09'), []);
check('Hessen 1.4.2026: Osterferien', holidaysOn('DE-HE', '2026-04-01').map((h) => h.name), ['Osterferien']);
check('Weihnachtsferien über den Jahreswechsel (BY, 2.1.2027)', holidaysOn('DE-BY', '2027-01-02').map((h) => h.name), ['Weihnachtsferien']);
check('Ohne Bundesland nichts', holidaysOn(null, '2026-11-04'), []);
check('Keine doppelten Einträge (MV, Sommer 2026)', (() => { const l = holidaysOn('DE-MV', '2026-07-20'); return l.length === new Set(l.map((h) => h.name + h.from + h.to)).size; })(), true);
check('Hinweis außerhalb der Daten', [outsideCoverage('2026-11-01'), outsideCoverage('2031-01-01')], [false, true]);

group('Feiertage');
const ft = (r, k) => feiertageOn(r, k, FERIEN).map((f) => f.name + (f.local ? ' (örtlich)' : ''));
check('Neujahr überall (Berlin)', ft('DE-BE', '2026-01-01'), ['Neujahr']);
check('Fronleichnam 2026 in Bayern, nicht in Berlin', [ft('DE-BY', '2026-06-04'), ft('DE-BE', '2026-06-04')], [['Fronleichnam'], []]);
check('Reformationstag in Sachsen', ft('DE-SN', '2026-10-31'), ['Reformationstag']);
check('Friedensfest: nur örtlich (Augsburg)', ft('DE-BY', '2026-08-08'), ['Friedensfest (örtlich)']);
check('Normaler Tag: kein Feiertag', ft('DE-BY', '2026-11-24'), []);
check('Ohne Bundesland nichts', feiertageOn(null, '2026-01-01'), []);
check('Ausgeschaltet → kein Bundesland', [feiertagRegion({ schoolRegion: 'DE-BY', showFeiertage: false }), ferienRegion({ schoolRegion: 'DE-BY' })], [null, 'DE-BY']);
const conv = convertApi('DE-BY',
  [{ id: 'a', startDate: '2027-02-15', endDate: '2027-02-19', name: [{ language: 'DE', text: 'Frühjahrsferien' }] },
    { id: 'a', startDate: '2027-02-15', endDate: '2027-02-19', name: [{ language: 'DE', text: 'Frühjahrsferien' }] }],
  [{ id: 'x', startDate: '2027-08-08', nationwide: false, subdivisions: [{ code: 'DE-BY-AU' }], name: [{ language: 'DE', text: 'Friedensfest' }] },
    { id: 'y', startDate: '2027-01-06', nationwide: false, subdivisions: [{ code: 'DE-BY' }, { code: 'DE-BW' }], name: [{ language: 'DE', text: 'Heilige Drei Könige' }] }]);
check('Online-Daten umwandeln: doppelte weg, sortiert, örtlich erkannt',
  [conv.holidays.length, conv.feiertage.map((f) => `${f.date} ${f.name} ${f.local}`)],
  [1, ['2027-01-06 Heilige Drei Könige false', '2027-08-08 Friedensfest true']]);

group('Wichtige Termine');
const wichtig = { id: 'w', text: 'Prüfung', date: '2026-11-26', time: '08:00', kind: 'event', done: false, important: true };
check('Bleibt in den Tages-Einträgen erhalten', eventsOfDay([wichtig], '2026-11-26')[0].important, true);
check('Auch bei Serien', eventsOfDay([{ ...wichtig, repeat: 'weekly', doneDates: [], skipDates: [] }], '2026-12-03')[0].important, true);
check('Chip „Wichtig“ auf der Heute-Seite', eventChip(wichtig).includes('Wichtig'), true);
const wIcs = buildIcs(calendarEvents({ ...remState(), todos: [wichtig] }, { events: true }, '2026-11-24'), '2026-11-24');
check('Kalender-Datei: PRIORITY:1 und ❗', [wIcs.includes('PRIORITY:1'), wIcs.includes('SUMMARY:❗ Prüfung')], [true, true]);
const wf = document.createElement('form');
wf.innerHTML = '<input name="title" value="Prüfung"><input name="time" value=""><select name="repeat"><option value="none" selected></option></select><select name="color"><option value="" selected></option></select><input name="endDate" value=""><input name="until" value=""><input type="checkbox" name="important" checked>';
check('Formular liest den Haken „Wichtig“', readEventForm(wf, '2026-11-26').important, true);

group('Geburtstage');
const oma = { id: 'o', text: 'Oma Ilse', date: '1948-11-25', kind: 'event', type: 'birthday', repeat: 'yearly', doneDates: [], skipDates: [] };
check('Jedes Jahr am 25.11.', ['2026-11-25', '2027-11-25', '2026-11-24', '2026-12-25'].map((k) => occursOn(oma, k)), [true, true, false, false]);
check('Alter: wird 78', [birthdayAge(oma, '2026-11-25'), eventLabel(oma, '2026-11-25')], [78, 'Oma Ilse (wird 78)']);
check('Ohne Geburtsjahr (Datum in diesem Jahr) kein Alter', eventLabel({ ...oma, date: '2026-11-25' }, '2026-11-25'), 'Oma Ilse');
const leap = { ...oma, date: '2000-02-29' };
check('29. Februar → in Nicht-Schaltjahren am 28.', [occursOn(leap, '2027-02-28'), occursOn(leap, '2028-02-29'), occursOn(leap, '2028-02-28')], [true, true, false]);
check('Erscheint bei den To-Dos', todosFor([oma], '2026-11-25').map((t) => t.text), ['Oma Ilse']);
const bdIcs = buildIcs(calendarEvents({ ...remState(), todos: [oma] }, { birthdays: true }), '2026-11-24');
check('Kalender-Datei: ganztägig, jährlich, Erinnerung 9 Uhr', ['DTSTART;VALUE=DATE:19481125', 'RRULE:FREQ=YEARLY', 'TRIGGER:PT9H'].every((x) => bdIcs.includes(x)), true);

group('Kalender: Strich für mehrtägige Termine');
const tour = { id: 't', text: 'Kurztrip', date: '2026-11-25', endDate: '2026-11-27', kind: 'event', done: false };
check('Anfang, Mitte, Ende', ['2026-11-25', '2026-11-26', '2026-11-27'].map((k) => spanPos(eventsOfDay([tour], k)[0])), ['start', 'mid', 'end']);
check('Einzeltermin hat keinen Strich', spanPos(eventsOfDay([{ id: 'x', text: 'X', date: '2026-11-25', kind: 'event' }], '2026-11-25')[0]), null);

group('Woche-Seite anpassbar');
check('Standard: Erfolge zuerst, dann Energie', layoutOf(normalize({}).settings, 'week').order.slice(0, 2), ['wins', 'energy']);
const wl = normalize({}).settings;
moveModule(wl, 'water', -1, 'week'); toggleIn(wl, 'hidden', 'table', true, 'week');
check('Trinken nach oben, Tabelle ausgeblendet', [layoutOf(wl, 'week').order.slice(0, 3), layoutOf(wl, 'week').hidden.has('table')], [['wins', 'water', 'energy'], true]);
check('Heute-Seite bleibt davon unberührt', layoutOf(wl).order[1], 'water');

/* ---------- Ausgabe ---------- */
const fmt = (v) => (v === null ? 'null' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let pass = 0, total = 0;
document.getElementById('out').innerHTML = groups.map((g) => `
  <section class="card">
    <h2>${esc(g.name)}</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Test</th><th>Erwartet</th><th>Ergebnis</th><th></th></tr></thead>
      <tbody>${g.rows.map((r) => { total++; if (r.ok) pass++; return `
        <tr class="${r.ok ? 'ok' : 'fail'}"><td>${esc(r.desc)}</td><td><code>${esc(fmt(r.expected))}</code></td><td><code>${esc(fmt(r.actual))}</code></td><td>${r.ok ? '✓' : '✗'}</td></tr>`; }).join('')}
      </tbody>
    </table></div>
  </section>`).join('');
const sum = document.getElementById('sum');
sum.textContent = pass === total ? `Ergebnis: alle ${total} Tests bestanden ✓` : `Ergebnis: ${total - pass} von ${total} Tests fehlgeschlagen ✗`;
sum.parentElement.classList.add(pass === total ? 'card--mint' : 'card--rosa');
window.testResult = { pass, total };
