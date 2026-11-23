// Backup (Export/Import), Teilen und dauerhafter Speicher.
import { getState, replaceAll, update, normalize } from './store.js';
import { todayKey } from './dates.js';
import { downloadFile } from './ics.js';

const APP_ID = 'daily-quests';

/** Alle Daten als JSON-Text. */
export function exportText(state = getState(), now = new Date()) {
  return JSON.stringify({ app: APP_ID, version: 1, exportedAt: now.toISOString(), data: state }, null, 2);
}

export function exportBackup() {
  const day = todayKey();
  update((s) => { s.settings.lastBackup = day; });
  downloadFile(exportText(), `daily-quests-backup-${day}.json`, 'application/json');
}

/**
 * Backup-Text prüfen und in App-Daten umwandeln (wirft einen Fehler mit verständlicher Meldung).
 */
export function parseBackup(text) {
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('Die Datei ist keine gültige Backup-Datei (kein JSON).'); }
  if (!json || json.app !== APP_ID || typeof json.data !== 'object' || json.data === null) {
    throw new Error('Das ist keine Daily-Quests-Backup-Datei.');
  }
  const d = json.data;
  const okShape = typeof d.days === 'object' && !Array.isArray(d.days)
    && Array.isArray(d.meds ?? []) && Array.isArray(d.todos ?? []) && Array.isArray(d.focus ?? [])
    && Array.isArray(d.trackers ?? []);
  if (!okShape) throw new Error('Die Backup-Datei ist beschädigt oder unvollständig.');
  return normalize(d);
}

export async function importFile(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Die Datei ist zu groß für ein Backup.');
  const data = parseBackup(await file.text());
  replaceAll(data);
  return data;
}

/** Link zur App teilen – es werden KEINE Daten geteilt. */
export async function shareApp() {
  const url = new URL('./', location.href).href;
  const payload = {
    title: 'Daily Quests',
    text: 'Meine kleine Tages-App für Trinken, Medikamente, Zyklus & kleine Erfolge. Du bekommst deine eigene, leere Version – deine Daten bleiben auf deinem Gerät.',
    url,
  };
  if (navigator.share) {
    try { await navigator.share(payload); return 'shared'; } catch (err) {
      if (err.name === 'AbortError') return 'aborted';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    window.prompt('Link zum Kopieren:', url);
    return 'prompt';
  }
}

/** Browser bitten, die Daten nicht automatisch zu löschen (z. B. bei Speichermangel). */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}
