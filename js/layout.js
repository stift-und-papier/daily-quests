// Aufbau der Seiten „Heute“ und „Woche“: Reihenfolge, ausgeblendete und eingeklappte Kästen.
// Außerdem ganze Bereiche (z. B. Zyklus) ein- und ausschalten.

/** Kästen auf „Heute“ (Standard-Reihenfolge). */
export const MODULES = [
  { id: 'energy',  name: 'Energie' },
  { id: 'water',   name: 'Trinken' },
  { id: 'meds',    name: 'Medikamente' },
  { id: 'todos',   name: 'To-Dos & Termine' },
  { id: 'wins',    name: 'Kleine Erfolge' },
  { id: 'focus',   name: 'Fokus für die nächsten Tage' },
  { id: 'tracker', name: 'Tracker (Wie geht es meinem Körper?)' },
  { id: 'habits',  name: 'Gewohnheiten (z. B. Sport gemacht)' },
  { id: 'reflection', name: 'Abend-Reflexion' },
];

/** Kästen auf „Woche“ (Standard: Erfolge zuerst, dann Energie). */
export const WEEK_MODULES = [
  { id: 'wins',    name: 'Kleine Erfolge' },
  { id: 'energy',  name: 'Energieverlauf' },
  { id: 'water',   name: 'Trinkmenge' },
  { id: 'meds',    name: 'Medikamente' },
  { id: 'tracker', name: 'Tracker' },
  { id: 'table',   name: 'Alle Werte als Tabelle' },
];

/** Bereiche mit eigenem Reiter, die man komplett ausblenden kann. */
export const FEATURES = [
  { id: 'cycle', name: 'Zyklus', desc: 'Reiter „Zyklus“ und Zyklus-Angaben im Bericht' },
];

const PAGES = {
  today: { key: 'layout', modules: MODULES },
  week: { key: 'weekLayout', modules: WEEK_MODULES },
};

export function defaultLayout(page = 'today') {
  return { order: PAGES[page].modules.map((m) => m.id), hidden: [], collapsed: [] };
}

/** Gespeicherte Reihenfolge bereinigen: unbekannte raus, neue Kästen hinten anhängen. */
export function normalizeOrder(order = [], page = 'today') {
  const known = PAGES[page].modules.map((m) => m.id);
  const clean = order.filter((id, i) => known.includes(id) && order.indexOf(id) === i);
  return [...clean, ...known.filter((id) => !clean.includes(id))];
}

export function layoutOf(settings, page = 'today') {
  const l = settings[PAGES[page].key] || defaultLayout(page);
  return {
    order: normalizeOrder(l.order, page),
    hidden: new Set(l.hidden || []),
    collapsed: new Set(l.collapsed || []),
  };
}

/** Ist ein Kasten auf „Heute“ bzw. ein Bereich sichtbar? */
export const isOn = (settings, id) => !layoutOf(settings).hidden.has(id);

/** Element in einer Liste um eine Position verschieben (dir = -1 hoch, +1 runter). */
export function moveInList(list, id, dir) {
  const arr = [...list];
  const i = arr.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return arr;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return arr;
}

/** Ein-/Ausschalten bzw. Ein-/Ausklappen (ändert settings). key: 'hidden' | 'collapsed' */
export function toggleIn(settings, key, id, on, page = 'today') {
  const k = PAGES[page].key;
  const l = settings[k] || (settings[k] = defaultLayout(page));
  const set = new Set(l[key] || []);
  if (on) set.add(id); else set.delete(id);
  l[key] = [...set];
}

/** Reihenfolge speichern (ändert settings). */
export function moveModule(settings, id, dir, page = 'today') {
  const k = PAGES[page].key;
  const l = settings[k] || (settings[k] = defaultLayout(page));
  l.order = moveInList(layoutOf(settings, page).order, id, dir);
}

export const modulesOf = (page) => PAGES[page].modules;
