// Kalender-Datei (.ics) mit täglich wiederholten Terminen und Alarm.
// Die Datei wird nur auf deinem Gerät erzeugt. Erst wenn DU sie in eine Kalender-App
// importierst, landet sie dort – und ggf. in deren Cloud (iCloud, Google).
import { medSlots } from './views/today.js';
import { timeToMinutes, pad } from './dates.js';

/** Sonderzeichen nach iCalendar-Regeln maskieren. */
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Zeilen länger als 75 Byte umbrechen (iCalendar-Vorgabe), ohne Emojis/Umlaute zu zerteilen. */
const enc = new TextEncoder();
export function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of Array.from(line)) {
    const b = enc.encode(ch).length;
    if (bytes + b > 74) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

const compactDate = (key) => key.replace(/-/g, '');
const hhmmss = (t) => { const m = timeToMinutes(t); return `${pad(Math.floor(m / 60))}${pad(m % 60)}00`; };
const minToTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/**
 * Termine sammeln (reine Funktion, testbar).
 * options: { meds, evening, water, events, hideNames }
 * Tägliche Erinnerungen haben nur `time`; einmalige Termine zusätzlich `date` (und ggf. `before`).
 */
export function calendarEvents(state, options, fromDay = '0000-00-00') {
  const ev = [];
  const r = state.settings.reminders;
  if (options.meds) {
    for (const s of medSlots(state.meds)) {
      ev.push({
        uid: `dq-med-${s.key.replace(/[^a-zA-Z0-9]/g, '')}`,
        time: s.time,
        title: options.hideNames ? `💊 Medikament (${s.time})` : `💊 ${s.name}`,
        desc: 'Erinnerung aus Daily Quests. Abhaken in der App.',
      });
    }
  }
  if (options.evening) {
    ev.push({ uid: 'dq-evening', time: r.evening.time, title: '🌙 Abend-Reflexion', desc: 'Wie war dein Tag? Energie und kleine Erfolge eintragen.' });
  }
  if (options.events) {
    const before = Number(r.events?.before) || 0;
    const series = (t) => t.repeat && t.repeat !== 'none';
    (state.todos || [])
      .filter((t) => t.kind === 'event' && t.time
        && (series(t) ? (!t.until || t.until >= fromDay) : (!t.done && (t.endDate || t.date) >= fromDay)))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .forEach((t) => ev.push({
        uid: `dq-ev-${String(t.id).replace(/[^a-zA-Z0-9]/g, '')}`,
        date: t.date,
        endDate: !series(t) && t.endDate > t.date ? t.endDate : null,
        time: t.time,
        before,
        rrule: series(t) ? rruleOf(t) : null,
        exdates: series(t) ? (t.skipDates || []).map((d) => `${compactDate(d)}T${hhmmss(t.time)}`) : [],
        title: options.hideNames ? '📅 Termin' : `${t.important ? '❗ ' : '📅 '}${t.text}`,
        desc: t.important ? 'Wichtiger Termin aus Daily Quests.' : 'Termin aus Daily Quests.',
        important: !!t.important,
      }));
  }
  if (options.birthdays) {
    // Geburtstage: ganztägig, jedes Jahr, Erinnerung um 9 Uhr am Tag
    (state.todos || []).filter((t) => t.kind === 'event' && t.type === 'birthday').forEach((t) => ev.push({
      uid: `dq-bd-${String(t.id).replace(/[^a-zA-Z0-9]/g, '')}`,
      date: t.date,
      allDay: true,
      rrule: 'FREQ=YEARLY',
      exdates: [],
      title: options.hideNames ? '🎂 Geburtstag' : `🎂 ${t.text} hat Geburtstag`,
      desc: 'Geburtstag aus Daily Quests.',
    }));
  }
  if (options.water) {
    const from = timeToMinutes(r.water.from), to = timeToMinutes(r.water.to);
    const step = Math.max(15, Number(r.water.interval) || 90);
    for (let m = from; m <= to; m += step) {
      ev.push({ uid: `dq-water-${m}`, time: minToTime(m), title: '💧 Trinkpause', desc: 'Zeit für ein Glas Wasser!' });
    }
  }
  return ev;
}

/** Wiederholungsregel einer Termin-Serie im iCalendar-Format. */
export function rruleOf(t) {
  const base = {
    daily: 'FREQ=DAILY',
    weekly: 'FREQ=WEEKLY',
    biweekly: 'FREQ=WEEKLY;INTERVAL=2',
    // Start am 31. → in kürzeren Monaten am letzten Tag (wie in der App)
    monthly: Number(t.date.slice(8, 10)) === 31 ? 'FREQ=MONTHLY;BYMONTHDAY=-1' : 'FREQ=MONTHLY',
    yearly: 'FREQ=YEARLY',
  }[t.repeat];
  return t.until ? `${base};UNTIL=${compactDate(t.until)}T235959` : base;
}

/** Komplette .ics-Datei als Text. Termine starten an `startDay` und wiederholen sich täglich. */
export function buildIcs(events, startDay, stamp = new Date()) {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Daily Quests//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Daily Quests',
  ];
  for (const e of events) {
    const once = !!e.date; // einmaliger Termin statt täglicher Erinnerung
    const start = e.allDay ? compactDate(e.date) : `${compactDate(once ? e.date : startDay)}T${hhmmss(e.time)}`; // "schwebende" Ortszeit
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@daily-quests`,
      `DTSTAMP:${dtstamp}`,
      e.allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
      e.allDay ? 'DURATION:P1D' : e.endDate ? `DTEND:${compactDate(e.endDate)}T235900` : once ? 'DURATION:PT1H' : 'DURATION:PT5M',
      ...(once ? (e.rrule ? [`RRULE:${e.rrule}`] : []) : ['RRULE:FREQ=DAILY']),
      ...(e.exdates || []).map((x) => `EXDATE:${x}`),
      `SUMMARY:${icsText(e.title)}`,
      `DESCRIPTION:${icsText(e.desc)}`,
      ...(e.important ? ['PRIORITY:1'] : []),
      once && !e.allDay ? 'TRANSP:OPAQUE' : 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsText(e.title)}`,
      e.allDay ? 'TRIGGER:PT9H' : e.before ? `TRIGGER:-PT${e.before}M` : 'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Datei im Browser herunterladen. */
export function downloadFile(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
