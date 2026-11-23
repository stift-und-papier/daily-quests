// Start der App: Navigation, Seitenwechsel und Tageswechsel um Mitternacht.
import { getState, subscribe } from './store.js';
import { todayKey, formatLong, msUntilMidnight } from './dates.js';
import { nav, mascot } from './icons.js';
import { toast } from './ui.js';
import { startScheduler } from './reminders.js';
import { requestPersistence } from './backup.js';
import { refreshHolidays } from './holidays.js';

import { isOn } from './layout.js';

import * as today from './views/today.js';
import * as calendar from './views/calendar-view.js';
import * as week from './views/week.js';
import * as cycle from './views/cycle-view.js';
import * as reminders from './views/reminders-view.js';
import * as settings from './views/settings.js';

// label: Text in der Leiste (&shy; = Trennstelle, damit lange Wörter bei 6 Reitern umbrechen dürfen)
const ROUTES = [
  { id: 'heute',         title: 'Heute',         label: 'Heute',              view: today },
  { id: 'kalender',      title: 'Kalender',      label: 'Kalen&shy;der',      view: calendar },
  { id: 'woche',         title: 'Woche',         label: 'Woche',              view: week },
  { id: 'zyklus',        title: 'Zyklus',        label: 'Zyklus',             view: cycle, feature: 'cycle' },
  { id: 'erinnerungen',  title: 'Erinnerungen',  label: 'Erinne&shy;rungen',  view: reminders },
  { id: 'einstellungen', title: 'Einstellungen', label: 'Einstel&shy;lungen', view: settings },
];

const main = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
let currentDay = todayKey();
let currentRoute = null;

/** Sichtbare Reiter (ausgeblendete Bereiche wie Zyklus fallen weg). */
const visibleRoutes = () => ROUTES.filter((r) => !r.feature || isOn(getState().settings, r.feature));

function routeFromHash() {
  const id = location.hash.replace('#', '');
  return visibleRoutes().find((r) => r.id === id) || ROUTES[0];
}

let tabbarSig = '';
function buildTabbar() {
  const routes = visibleRoutes();
  const sig = routes.map((r) => r.id).join();
  if (sig === tabbarSig) return; // nur neu bauen, wenn sich die Reiter geändert haben
  tabbarSig = sig;
  tabbar.innerHTML = `<ul class="tabbar__list" style="--n:${routes.length}">${routes.map((r) => `
    <li><a class="tabbar__link" href="#${r.id}" data-route="${r.id}">
      <span class="tabbar__icon">${nav[r.id]()}</span><span class="tabbar__label">${r.label}</span>
    </a></li>`).join('')}</ul>`;
}

const darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

function applySettings() {
  const { reduceMotion, theme } = getState().settings;
  document.documentElement.classList.toggle('reduce-motion', !!reduceMotion);
  const dark = theme === 'dark' || (theme !== 'light' && !!darkQuery?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#2A2230' : '#FFF8F0');
  buildTabbar();
}
darkQuery?.addEventListener?.('change', applySettings);

/**
 * Seite neu zeichnen. Der Tastatur-Fokus bleibt auf dem Element mit gleichem data-key,
 * damit man nach einem Klick nicht "verloren" ist.
 */
function render({ focusMain = false } = {}) {
  const route = routeFromHash();
  const routeChanged = route !== currentRoute;
  currentRoute = route;
  currentDay = todayKey();

  const activeKey = document.activeElement?.dataset?.key;
  const scrollY = window.scrollY;

  document.getElementById('today-label').textContent = formatLong(currentDay);
  document.title = `${route.title} · Daily Quests`;
  tabbar.querySelectorAll('[data-route]').forEach((a) => {
    if (a.dataset.route === route.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  // Ereignis-Handler der vorherigen Seite entfernen, jede Seite setzt ihre eigenen.
  main.onclick = main.onchange = main.onsubmit = main.oninput = main.onkeydown = null;
  route.view.render(main, { today: currentDay, refresh: () => render() });

  if (routeChanged) {
    window.scrollTo(0, 0);
    if (focusMain) main.focus({ preventScroll: true });
  } else {
    window.scrollTo(0, scrollY);
    if (activeKey) main.querySelector(`[data-key="${CSS.escape(activeKey)}"]`)?.focus({ preventScroll: true });
  }
}

/* ---------- Tageswechsel ---------- */
let midnightTimer;
function scheduleMidnight() {
  clearTimeout(midnightTimer);
  midnightTimer = setTimeout(() => {
    checkNewDay();
    scheduleMidnight();
  }, msUntilMidnight() + 1000);
}
function checkNewDay() {
  if (todayKey() !== currentDay) {
    render();
    toast('Ein neuer Tag beginnt ✦');
  }
}
// Handys pausieren Timer im Hintergrund. Deshalb beim Zurückkehren noch einmal prüfen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { checkNewDay(); scheduleMidnight(); }
});
window.addEventListener('focus', checkNewDay);

/* ---------- Start ---------- */
document.getElementById('header-deco').innerHTML = mascot();
buildTabbar();
applySettings();
subscribe(applySettings);
window.addEventListener('hashchange', () => render({ focusMain: true }));
render();
scheduleMidnight();

// Service Worker (Offline + Benachrichtigungen)
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service Worker nicht registriert', err));
  // Neue Version installiert → einmal neu laden, damit alle Dateien zusammenpassen
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
}

// "App installieren"-Angebot von Chrome/Edge merken (für den Button in den Einstellungen)
window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  window.__installPrompt = ev;
  if (routeFromHash().id === 'einstellungen') render();
});
window.addEventListener('appinstalled', () => { window.__installPrompt = null; toast('App installiert ✓'); });

// Browser bitten, die Daten dauerhaft aufzubewahren
requestPersistence().then((v) => {
  window.__persisted = v;
  if (routeFromHash().id === 'einstellungen') render();
});

startScheduler();

// Ferien & Feiertage des Bundeslands höchstens einmal pro Woche online auffrischen
function maybeRefreshHolidays() {
  const st = getState().settings;
  if (st.schoolRegion && st.holidaysOnline !== false) refreshHolidays(st.schoolRegion);
}
// neu zeichnen – aber nicht mitten in einer Eingabe
window.addEventListener('dq-holidays', () => { if (!document.activeElement?.matches('input, textarea, select')) render(); });
window.addEventListener('online', maybeRefreshHolidays);
maybeRefreshHolidays();

// Für Tests in der Browser-Konsole
window.dailyQuests = { render };
