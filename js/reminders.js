// Erinnerungen OHNE Server.
// So funktioniert es: Solange die App geöffnet ist, prüft sie alle 30 Sekunden, ob eine
// Erinnerung fällig ist, und zeigt dann eine System-Benachrichtigung (falls erlaubt) und
// eine Meldung in der App. Ist die App geschlossen, kann ohne Server NICHTS ausgelöst werden.
import { getState } from './store.js';
import { todayKey, timeToMinutes, minutesNow, pad } from './dates.js';
import { medSlots } from './views/today.js';
import { eventsOfDay } from './trackers.js';
import { toast } from './ui.js';

const LOG_KEY = 'dailyQuests.notified';   // welche Erinnerungen heute schon kamen (nur technisch)
export const GRACE_MIN = 15;              // so lange nach der Uhrzeit wird noch benachrichtigt

const minToTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const beforeText = (min) => (min >= 60 ? `${min / 60 === 1 ? '1 Stunde' : `${(min / 60).toLocaleString('de-DE')} Stunden`}` : `${min} Minuten`);
export const BEFORE_OPTIONS = [0, 10, 15, 30, 60, 120];

/**
 * Alle Erinnerungen eines Tages (reine Rechenfunktion, testbar).
 * @returns [{ key, type, at (Minuten), time, title, body }]
 */
export function remindersForDay(state, day) {
  const r = state.settings.reminders;
  const d = state.days[day] || {};
  const list = [];

  if (r.meds.enabled) {
    for (const slot of medSlots(state.meds)) {
      if (d.medsTaken?.[slot.key]) continue; // schon genommen → keine Erinnerung
      list.push({
        key: `med:${slot.key}`, type: 'med', at: timeToMinutes(slot.time), time: slot.time,
        title: `💊 ${slot.name}`, body: `Es ist ${slot.time} – Zeit für ${slot.name}.`,
      });
    }
  }

  if (r.water.enabled) {
    const goal = state.settings.waterGoal || 2000;
    const reached = (d.water || 0) >= goal;
    const from = timeToMinutes(r.water.from), to = timeToMinutes(r.water.to);
    const step = Math.max(15, Number(r.water.interval) || 90);
    if (!reached) {
      for (let m = from; m <= to; m += step) {
        list.push({
          key: `water:${m}`, type: 'water', at: m, time: minToTime(m),
          title: '💧 Trinkpause', body: 'Zeit für ein Glas Wasser!',
        });
      }
    }
  }

  if (r.events?.enabled) {
    const before = Number(r.events.before) || 0;
    for (const ev of eventsOfDay(state.todos || [], day)) {
      if (!ev.time || ev.done) continue; // ganztägige oder abgehakte Termine: keine Erinnerung
      const at = timeToMinutes(ev.time) - before;
      if (at < 0) continue;
      list.push({
        key: `event:${ev.id}:${before}`, type: 'event', at, time: minToTime(at),
        title: `${ev.important ? '❗ Wichtig: ' : '📅 '}${ev.text}`,
        body: before ? `Um ${ev.time} – in ${beforeText(before)}.` : `Jetzt: ${ev.text} (${ev.time})`,
      });
    }
  }

  if (r.evening.enabled) {
    const m = timeToMinutes(r.evening.time);
    list.push({
      key: `evening:${m}`, type: 'evening', at: m, time: r.evening.time,
      title: '🌙 Abend-Reflexion', body: 'Wie war dein Tag? Trag deine Energie und deine kleinen Erfolge ein.',
    });
  }

  return list.sort((a, b) => a.at - b.at);
}

/** Fällige Erinnerungen: Uhrzeit erreicht und nicht länger als GRACE_MIN her. */
export function dueNow(list, nowMin) {
  return list.filter((x) => x.at <= nowMin && nowMin - x.at <= GRACE_MIN);
}

/** Verpasste Medikamente: Uhrzeit vorbei, nicht abgehakt. */
export function missedMeds(state, day, nowMin) {
  const d = state.days[day] || {};
  return medSlots(state.meds).filter((x) => !d.medsTaken?.[x.key] && timeToMinutes(x.time) + GRACE_MIN < nowMin);
}

/* ---------- Berechtigung & Anzeige ---------- */
export function platformInfo() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'Notification' in window;
  return { isIOS, standalone, supported, permission: supported ? Notification.permission : 'unsupported' };
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** System-Benachrichtigung zeigen – über den Service Worker (nötig auf Android), sonst direkt. */
export async function showNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const options = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', lang: 'de' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, options); return true; }
    new Notification(title, options);
    return true;
  } catch (err) {
    console.warn('Benachrichtigung fehlgeschlagen', err);
    return false;
  }
}

/* ---------- Taktgeber, solange die App offen ist ---------- */
function readLog(day) {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '{}');
    return log.day === day ? new Set(log.keys) : new Set();
  } catch { return new Set(); }
}
function writeLog(day, set) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify({ day, keys: [...set] })); } catch { /* egal */ }
}

export function tick(now = new Date()) {
  const state = getState();
  const day = todayKey(now);
  const nowMin = minutesNow(now);
  const sent = readLog(day);
  const due = dueNow(remindersForDay(state, day), nowMin).filter((x) => !sent.has(x.key));
  for (const r of due) {
    sent.add(r.key);
    showNotification(r.title, r.body, r.key);
    if (document.visibilityState === 'visible') toast(`${r.title}: ${r.body}`, 6000);
  }
  if (due.length) writeLog(day, sent);
  return due;
}

let timer;
export function startScheduler() {
  clearInterval(timer);
  tick();
  timer = setInterval(tick, 30 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
}
