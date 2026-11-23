// Einstellungen: Trinkziel, Medikamentenliste, Animationen.
// (Export/Import und Teilen kommen in Schritt f dazu.)
import { getState, update, uid } from '../store.js';
import { timeToMinutes, formatFull, diffDays } from '../dates.js';
import { exportBackup, importFile, shareApp } from '../backup.js';
import { platformInfo } from '../reminders.js';
import { pillbox, bottle, line, trackerIcon } from '../icons.js';
import { SCALES, TRACKER_COLORS, trackerColor } from '../trackers.js';
import { colorDot } from './tracker-form.js';
import { FEATURES, layoutOf, toggleIn, moveModule, modulesOf } from '../layout.js';
import { REGIONS, holidayInfo, refreshHolidays } from '../holidays.js';

let editTracker = null; // welcher Tracker gerade bearbeitet wird

/** Nächste noch nicht benutzte Farbe für einen neuen Tracker. */
function nextColor(trackers) {
  const used = new Set(trackers.map((t, i) => trackerColor(t, i)));
  return (TRACKER_COLORS.find((c) => !used.has(c.hex)) || TRACKER_COLORS[trackers.length % TRACKER_COLORS.length]).hex;
}

/** Felder Name, Skala, Farbe (für "neu" und "bearbeiten"). */
function trackerFields(prefix, { name, scale, color }) {
  return `
    <div class="field">
      <label for="${prefix}-name">Name</label>
      <input id="${prefix}-name" class="input" name="name" maxlength="60" required autocomplete="off" placeholder="z. B. Bauchschmerzen" value="${esc(name)}" data-key="${prefix}-name">
    </div>
    <div class="field">
      <label for="${prefix}-scale">Skala</label>
      <select id="${prefix}-scale" class="select" name="scale" data-key="${prefix}-scale">
        ${Object.entries(SCALES).map(([k, v]) => `<option value="${k}" ${k === scale ? 'selected' : ''}>${v.label}</option>`).join('')}
      </select>
    </div>
    <fieldset class="swatches">
      <legend class="label">Farbe im Kalender</legend>
      <div class="swatches__grid">
        ${TRACKER_COLORS.map((c) => `<label class="swatch" title="${c.name}">
          <input type="radio" name="color" value="${c.hex}" class="visually-hidden" ${c.hex === color ? 'checked' : ''} data-key="${prefix}-c-${c.hex.slice(1)}">
          <span style="background:${c.hex}"><span class="visually-hidden">${c.name}</span></span>
        </label>`).join('')}
      </div>
    </fieldset>`;
}
import { cardHead, tape, esc, toast } from '../ui.js';
import { pageHead } from './placeholder.js';
import { medSlots } from './today.js';

function installInfo() {
  const p = platformInfo();
  if (p.standalone) return '<p>Die App ist installiert und läuft wie eine eigene App. ✓</p>';
  if (window.__installPrompt) {
    return `<p>Du kannst Daily Quests wie eine App auf diesem Gerät installieren.</p>
      <button class="btn btn--mint" type="button" data-action="install" data-key="install" style="margin-top:var(--s2)">App installieren</button>`;
  }
  if (p.isIOS) {
    return '<p><strong>iPhone/iPad:</strong> In Safari unten auf <strong>Teilen</strong> (Quadrat mit Pfeil) tippen → <strong>„Zum Home-Bildschirm“</strong> → Hinzufügen.</p>';
  }
  return '<p><strong>Android (Chrome):</strong> Menü ⋮ → <strong>„App installieren“</strong> bzw. „Zum Startbildschirm hinzufügen“.<br><strong>Computer (Chrome/Edge):</strong> Installations-Symbol rechts in der Adressleiste.</p>';
}

const sortTimes =(arr) => [...new Set(arr)].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

/** Nach Änderungen an der Liste den heutigen Medikamenten-Plan aktualisieren (falls der Tag existiert). */
function syncToday(st, day) {
  if (st.days[day]) st.days[day].medsPlanned = medSlots(st.meds).map((x) => x.key);
}

/** Liste zum Anordnen und Ein-/Ausblenden der Kästen einer Seite. */
function orderList(page, layout) {
  const mods = modulesOf(page);
  const pageName = page === 'today' ? 'Heute' : 'Woche';
  return `<ul class="plain order-list" aria-label="Kästen auf der Seite ${pageName}">
    ${layout.order.map((id, i) => {
      const m = mods.find((x) => x.id === id);
      const on = !layout.hidden.has(id);
      const k = `${page}-${id}`;
      return `<li>
        <label class="switch-row"><input type="checkbox" class="check" data-action="layout-show" data-page="${page}" data-id="${id}" data-key="ls-${k}" ${on ? 'checked' : ''}><span class="${on ? '' : 'is-off'}">${m.name}</span></label>
        <button class="btn btn--ghost btn--icon" type="button" data-action="layout-move" data-page="${page}" data-dir="-1" data-id="${id}" data-key="lu-${k}" aria-label="${m.name} (${pageName}) nach oben" ${i === 0 ? 'disabled' : ''}>${line.arrowUp()}</button>
        <button class="btn btn--ghost btn--icon" type="button" data-action="layout-move" data-page="${page}" data-dir="1" data-id="${id}" data-key="ld-${k}" aria-label="${m.name} (${pageName}) nach unten" ${i === layout.order.length - 1 ? 'disabled' : ''}>${line.arrowDown()}</button>
      </li>`;
    }).join('')}
  </ul>`;
}

export function render(root, ctx) {
  const s = getState();
  const layout = layoutOf(s.settings);

  root.innerHTML = `
    ${pageHead('Einstellungen')}
    <div class="cards">

      <section class="card card--butter card--wide" aria-labelledby="set-layout">
        ${tape('rosa', 'left')}
        ${cardHead('', 'Seiten anpassen & Bereiche', { id: 'set-layout', sub: 'Reihenfolge der Kästen mit den Pfeilen ändern. Haken weg = Kasten ausblenden. Einklappen geht direkt auf der Seite mit dem kleinen Pfeil.' })}
        <div class="layout-cols">
          <div>
            <h3>Heute</h3>
            ${orderList('today', layout)}
          </div>
          <div>
            <h3>Woche</h3>
            ${orderList('week', layoutOf(s.settings, 'week'))}
          </div>
        </div>
        <h3 style="margin-top:var(--s4)">Ganze Bereiche</h3>
        ${FEATURES.map((f) => `<label class="switch-row"><input type="checkbox" class="check" data-action="layout-show" data-id="${f.id}" data-key="ls-${f.id}" ${layout.hidden.has(f.id) ? '' : 'checked'}><span><strong>${f.name}</strong> <span class="card__sub">– ${f.desc}</span></span></label>`).join('')}
        <p class="card__sub">Ausgeblendete Bereiche behalten ihre Daten. Du kannst sie jederzeit wieder einschalten.</p>
      </section>

      <section class="card card--mint" aria-labelledby="set-ferien">
        ${tape('butter')}
        ${cardHead('', '🏖️ Ferien & Feiertage', { id: 'set-ferien', sub: 'Schulferien erscheinen gestreift, Feiertage mit grünem Ring im Kalender.' })}
        <div class="field">
          <label for="set-region">Bundesland</label>
          <select id="set-region" class="select" data-action="region" data-key="set-region">
            <option value="">keins – nichts anzeigen</option>
            ${Object.entries(REGIONS).map(([code, name]) => `<option value="${code}" ${code === s.settings.schoolRegion ? 'selected' : ''}>${esc(name)}</option>`).join('')}
          </select>
        </div>
        ${s.settings.schoolRegion ? `
          <label class="switch-row"><input type="checkbox" class="check" data-action="hol-opt" data-opt="showFerien" data-key="hol-ferien" ${s.settings.showFerien !== false ? 'checked' : ''}><span><strong>Schulferien</strong> im Kalender anzeigen</span></label>
          <label class="switch-row"><input type="checkbox" class="check" data-action="hol-opt" data-opt="showFeiertage" data-key="hol-feiertage" ${s.settings.showFeiertage !== false ? 'checked' : ''}><span><strong>Feiertage</strong> automatisch eintragen <span class="card__sub">– im Kalender und auf der Heute-Seite</span></span></label>
          <label class="switch-row"><input type="checkbox" class="check" data-action="hol-opt" data-opt="holidaysOnline" data-key="hol-online" ${s.settings.holidaysOnline !== false ? 'checked' : ''}><span><strong>Automatisch aktualisieren</strong> <span class="card__sub">– einmal pro Woche, damit neue Ferientermine erscheinen</span></span></label>
          ${(() => {
            const info = holidayInfo(s.settings.schoolRegion);
            return `<p class="card__sub" style="margin-top:var(--s2)">Daten ${info.years[0]}–${info.years[1]}, Stand ${formatFull(info.updated)}${info.online ? ' (online aktualisiert)' : ' (in der App eingebaut)'}. Quelle: OpenHolidays (offene Daten). Ohne Gewähr.</p>
              ${s.settings.holidaysOnline !== false ? `<p style="margin-top:var(--s2)"><button class="btn btn--small" type="button" data-action="hol-refresh" data-key="hol-refresh">↻ Jetzt aktualisieren</button></p>` : ''}`;
          })()}
          <p class="note" style="margin-top:var(--s2)">${s.settings.holidaysOnline !== false
            ? 'Zum Aktualisieren fragt die App bei openholidaysapi.org nach den Terminen deines Bundeslands. Übertragen wird nur das Bundesland (und wie bei jedem Internet-Aufruf deine IP-Adresse) – keine Einträge, keine Gesundheitsdaten.'
            : 'Die App nutzt nur die eingebauten Daten und ruft keinen fremden Server auf. Neue Ferientermine kommen dann erst mit einem App-Update.'}</p>` : ''}
      </section>

      <section class="card card--himmel" aria-labelledby="set-water">
        ${tape('mint')}
        ${cardHead('', 'Trinkziel', { id: 'set-water', icon: bottle(0.7) })}
        <form class="field" data-form="goal">
          <label for="goal">Tagesziel in ml</label>
          <div class="inline-form">
            <input id="goal" name="goal" class="input" type="number" inputmode="numeric" min="250" max="6000" step="50" value="${s.settings.waterGoal}" data-key="goal">
            <button class="btn btn--butter" type="submit" data-key="goal-save">Speichern</button>
          </div>
        </form>
      </section>

      <section class="card card--flieder" aria-labelledby="set-meds">
        ${tape('rosa', 'left')}
        ${cardHead('', 'Meine Medikamente', { id: 'set-meds', icon: pillbox(), sub: 'Name und Uhrzeit(en). Jede Uhrzeit wird auf „Heute“ einzeln abgehakt.' })}
        <div class="stack">
          ${s.meds.map((m) => `
            <div class="med-item">
              <div class="med-item__head">
                <span class="med-item__name">${esc(m.name)}</span>
                <button class="btn btn--ghost btn--icon" type="button" data-action="med-delete" data-id="${m.id}" data-key="md-${m.id}" aria-label="${esc(m.name)} löschen">${line.trash()}</button>
              </div>
              <div class="time-chips">
                ${m.times.map((t) => `<span class="time-chip">${esc(t)}
                  ${m.times.length > 1 ? `<button type="button" data-action="time-delete" data-id="${m.id}" data-time="${esc(t)}" data-key="td-${m.id}-${esc(t)}" aria-label="Uhrzeit ${esc(t)} bei ${esc(m.name)} entfernen">×</button>` : '<span style="width:12px"></span>'}
                </span>`).join('')}
              </div>
              <form class="inline-form" data-form="time" data-id="${m.id}">
                <label for="t-${m.id}" class="visually-hidden">Weitere Uhrzeit für ${esc(m.name)}</label>
                <input id="t-${m.id}" class="input input--time" type="time" name="time" required data-key="t-${m.id}">
                <button class="btn btn--small" type="submit" data-key="ta-${m.id}">+ Uhrzeit</button>
              </form>
            </div>`).join('')}
        </div>
        <form class="stack" data-form="med" style="margin-top:var(--s4)">
          <h3>Neues Medikament</h3>
          <div class="field">
            <label for="med-name">Name</label>
            <input id="med-name" class="input" name="name" maxlength="80" required autocomplete="off" placeholder="z. B. Vitamin D" data-key="med-name">
          </div>
          <div class="field">
            <label for="med-time">Uhrzeit</label>
            <input id="med-time" class="input input--time" name="time" type="time" value="08:00" required data-key="med-time">
          </div>
          <button class="btn btn--mint" type="submit" data-key="med-add">${line.plus()} Hinzufügen</button>
        </form>
      </section>

      <section class="card card--rosa" aria-labelledby="set-trackers">
        ${tape('himmel')}
        ${cardHead('', 'Meine Tracker', { id: 'set-trackers', icon: trackerIcon(), sub: 'Was möchtest du festhalten? Z. B. Migräne, Bauchschmerzen, Rückenschmerzen, Übelkeit, Stimmung …' })}
        ${s.trackers.length ? `<div class="stack">${s.trackers.map((t, idx) => `
          <div class="med-item">
            <div class="med-item__head">
              <span class="med-item__name">${colorDot(trackerColor(t, idx))}${esc(t.name)} <span class="chip">${SCALES[t.scale]?.label || ''}</span></span>
              <button class="btn btn--ghost btn--icon" type="button" data-action="tracker-edit" data-id="${t.id}" data-key="tre-${t.id}" aria-expanded="${editTracker === t.id}" aria-label="Tracker ${esc(t.name)} bearbeiten">${line.edit()}</button>
              <button class="btn btn--ghost btn--icon" type="button" data-action="tracker-delete" data-id="${t.id}" data-key="trd-${t.id}" aria-label="Tracker ${esc(t.name)} löschen">${line.trash()}</button>
            </div>
            ${editTracker === t.id ? `<form class="stack" data-form="tracker-edit" data-id="${t.id}">
              ${trackerFields(`e-${t.id}`, { name: t.name, scale: t.scale, color: trackerColor(t, idx) })}
              <div class="btn-row">
                <button class="btn btn--mint" type="submit" data-key="tre-save-${t.id}">Speichern</button>
                <button class="btn" type="button" data-action="tracker-edit" data-id="${t.id}" data-key="tre-cancel-${t.id}">Abbrechen</button>
              </div>
            </form>` : ''}
          </div>`).join('')}</div>` : '<p>Noch keine Tracker.</p>'}
        <form class="stack" data-form="tracker" style="margin-top:var(--s4)">
          <h3>Neuer Tracker</h3>
          ${trackerFields('new', { name: '', scale: '0-10', color: nextColor(s.trackers) })}
          <button class="btn btn--butter" type="submit" data-key="tr-add">${line.plus()} Tracker anlegen</button>
        </form>
      </section>

      <section class="card" aria-labelledby="set-motion">
        ${tape('butter')}
        ${cardHead('', 'Darstellung', { id: 'set-motion' })}
        <label class="switch-row">
          <input type="checkbox" class="check" data-action="motion" data-key="motion" ${s.settings.reduceMotion ? 'checked' : ''}>
          <span>Animationen ausschalten</span>
        </label>
        <p class="card__sub">Wenn dein Gerät „Bewegung reduzieren“ eingestellt hat, sind Animationen automatisch aus.</p>
        <div class="field" style="margin-top:var(--s3)">
          <label for="set-theme">Hell oder dunkel</label>
          <select id="set-theme" class="select" data-action="theme" data-key="set-theme">
            ${[['system', 'wie das Gerät'], ['light', 'hell'], ['dark', 'dunkel']].map(([v, l]) => `<option value="${v}" ${(s.settings.theme || 'system') === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
      </section>

      <section class="card card--butter" aria-labelledby="set-backup">
        ${tape('himmel', 'left')}
        ${cardHead('', 'Backup &amp; Gerätewechsel', { id: 'set-backup', sub: 'Speichert alle deine Daten als Datei. Damit kannst du sie sichern oder auf ein neues Gerät mitnehmen.' })}
        <p style="margin-bottom:var(--s3)">${s.settings.lastBackup ? `Letztes Backup: <strong>${formatFull(s.settings.lastBackup)}</strong>${diffDays(s.settings.lastBackup, ctx.today) > 14 ? ' – Zeit für ein neues! ♡' : ''}` : '<strong>Noch kein Backup gemacht.</strong> Am besten einmal pro Woche.'}</p>
        <div class="btn-row">
          <button class="btn btn--mint" type="button" data-action="export" data-key="bk-export">${line.download()} Backup speichern</button>
          <button class="btn btn--flieder" type="button" data-action="import-pick" data-key="bk-import">${line.upload()} Backup laden</button>
          <input id="bk-file" type="file" accept="application/json,.json" hidden data-action="import">
        </div>
        <p class="card__sub" style="margin-top:var(--s2)">Achtung: „Backup laden“ ersetzt alle Daten auf diesem Gerät.</p>
      </section>

      <section class="card card--rosa" aria-labelledby="set-share">
        ${tape('mint')}
        ${cardHead('', 'App teilen', { id: 'set-share', sub: 'Geteilt wird nur der Link. Wer ihn öffnet, bekommt eine eigene, leere App – deine Daten bleiben bei dir.' })}
        <button class="btn btn--butter" type="button" data-action="share" data-key="share">${line.share()} Link teilen</button>
      </section>

      <section class="card card--himmel" aria-labelledby="set-install">
        ${tape('rosa', 'left')}
        ${cardHead('', 'Als App installieren', { id: 'set-install' })}
        ${installInfo()}
        ${window.__persisted === undefined ? '' : `<p class="card__sub" style="margin-top:var(--s2)">Dauerhafter Speicher: ${window.__persisted === true ? 'vom Browser bestätigt ✓' : 'nicht bestätigt – der Browser darf bei Speichermangel aufräumen. Deshalb regelmäßig Backups machen.'}</p>`}
      </section>

      <p class="note card--wide">🔒 Alle Daten bleiben nur auf diesem Gerät, in diesem Browser. Es gibt kein Konto und keinen Server. Wenn du die Browserdaten löschst, sind auch deine Einträge weg – deshalb: Backups!</p>
    </div>`;

  root.onclick = async (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'layout-move') {
      update((st) => moveModule(st.settings, id, Number(btn.dataset.dir), btn.dataset.page || 'today'));
      ctx.refresh();
      return;
    }
    if (action === 'export') {
      exportBackup();
      toast('Backup gespeichert – schau in deine Downloads');
      ctx.refresh();
      return;
    }
    if (action === 'import-pick') {
      root.querySelector('#bk-file').click();
      return;
    }
    if (action === 'share') {
      const res = await shareApp();
      if (res === 'copied') toast('Link kopiert ✓');
      return;
    }
    if (action === 'hol-refresh') {
      btn.disabled = true;
      btn.textContent = 'Wird geladen …';
      const ok = await refreshHolidays(getState().settings.schoolRegion, { force: true });
      toast(ok ? 'Ferien & Feiertage aktualisiert ✓' : navigator.onLine === false ? 'Keine Internetverbindung – die gespeicherten Daten bleiben' : 'Aktualisieren hat nicht geklappt – die gespeicherten Daten bleiben');
      ctx.refresh();
      return;
    }
    if (action === 'install' && window.__installPrompt) {
      window.__installPrompt.prompt();
      await window.__installPrompt.userChoice.catch(() => null);
      window.__installPrompt = null;
      ctx.refresh();
      return;
    }
    if (action === 'med-delete') {
      const med = getState().meds.find((m) => m.id === id);
      if (!med || !confirm(`„${med.name}“ wirklich aus der Liste löschen?`)) return;
      update((st) => { st.meds = st.meds.filter((m) => m.id !== id); syncToday(st, ctx.today); });
      toast('Medikament gelöscht');
    }
    if (action === 'tracker-edit') {
      editTracker = editTracker === id ? null : id;
      ctx.refresh();
      if (editTracker) root.querySelector('[data-form="tracker-edit"] input[name="name"]')?.focus();
      return;
    }
    if (action === 'tracker-delete') {
      const tr = getState().trackers.find((t) => t.id === id);
      if (!tr || !confirm(`Tracker „${tr.name}“ löschen? Bisherige Einträge bleiben gespeichert (auch im Backup), werden aber nicht mehr angezeigt.`)) return;
      update((st) => { st.trackers = st.trackers.filter((t) => t.id !== id); });
      toast('Tracker gelöscht');
    }
    if (action === 'time-delete') {
      update((st) => {
        const m = st.meds.find((x) => x.id === id);
        if (m && m.times.length > 1) m.times = m.times.filter((t) => t !== btn.dataset.time);
        syncToday(st, ctx.today);
      });
    }
    ctx.refresh();
  };

  root.onchange = async (ev) => {
    if (ev.target.dataset.action === 'region') {
      const code = ev.target.value && REGIONS[ev.target.value] ? ev.target.value : null;
      update((st) => { st.settings.schoolRegion = code; });
      toast(code ? `Ferien & Feiertage ${REGIONS[code]} werden im Kalender angezeigt` : 'Keine Ferien & Feiertage im Kalender');
      ctx.refresh();
      if (code && getState().settings.holidaysOnline !== false) refreshHolidays(code);
      return;
    }
    if (ev.target.dataset.action === 'hol-opt') {
      const opt = ev.target.dataset.opt;
      const on = ev.target.checked;
      update((st) => { st.settings[opt] = on; });
      toast({ showFerien: on ? 'Schulferien werden angezeigt' : 'Schulferien ausgeblendet',
        showFeiertage: on ? 'Feiertage werden eingetragen' : 'Feiertage ausgeblendet',
        holidaysOnline: on ? 'Ferien & Feiertage werden automatisch aktualisiert' : 'Keine Online-Aktualisierung – nur eingebaute Daten' }[opt]);
      ctx.refresh();
      if (opt === 'holidaysOnline' && on) refreshHolidays(getState().settings.schoolRegion);
      return;
    }
    if (ev.target.dataset.action === 'layout-show') {
      const id = ev.target.dataset.id;
      const page = ev.target.dataset.page || 'today';
      update((st) => toggleIn(st.settings, 'hidden', id, !ev.target.checked, page));
      const name = (modulesOf(page).find((m) => m.id === id) || FEATURES.find((f) => f.id === id)).name;
      toast(ev.target.checked ? `${name} wird angezeigt` : `${name} ausgeblendet`);
      ctx.refresh();
      return;
    }
    if (ev.target.dataset.action === 'import') {
      const file = ev.target.files?.[0];
      ev.target.value = '';
      if (!file) return;
      if (!confirm('Backup laden? Alle Daten auf diesem Gerät werden durch das Backup ersetzt.')) return;
      try {
        await importFile(file);
        toast('Backup geladen ✓');
      } catch (err) {
        alert(err.message);
      }
      ctx.refresh();
      return;
    }
    if (ev.target.dataset.action === 'theme') {
      const v = ['light', 'dark'].includes(ev.target.value) ? ev.target.value : 'system';
      update((st) => { st.settings.theme = v; });
      ctx.refresh();
      return;
    }
    if (ev.target.dataset.action === 'motion') {
      update((st) => { st.settings.reduceMotion = ev.target.checked; });
      ctx.refresh();
    }
  };

  root.onsubmit = (ev) => {
    ev.preventDefault();
    const f = ev.target;
    if (f.dataset.form === 'goal') {
      const v = Math.round(Number(f.elements.goal.value));
      if (!v || v < 250 || v > 6000) { toast('Bitte einen Wert zwischen 250 und 6000 ml eingeben'); return; }
      update((st) => { st.settings.waterGoal = v; });
      toast('Trinkziel gespeichert');
    }
    if (f.dataset.form === 'tracker' || f.dataset.form === 'tracker-edit') {
      const name = f.elements.name.value.trim();
      const scale = f.elements.scale.value;
      const color = f.elements.color.value;
      if (!name || !SCALES[scale]) return;
      if (f.dataset.form === 'tracker') {
        update((st) => { st.trackers.push({ id: uid(), name, scale, color }); });
        toast(`Tracker „${name}“ angelegt`);
      } else {
        const old = getState().trackers.find((t) => t.id === f.dataset.id);
        if (old && old.scale !== scale && !confirm('Skala wirklich ändern? Bisherige Einträge behalten ihre alte Zahl (z. B. „Stufe 7“).')) return;
        update((st) => { Object.assign(st.trackers.find((t) => t.id === f.dataset.id), { name, scale, color }); });
        editTracker = null;
        toast('Tracker gespeichert');
      }
    }
    if (f.dataset.form === 'med') {
      const name = f.elements.name.value.trim();
      const time = f.elements.time.value;
      if (!name || !time) return;
      update((st) => { st.meds.push({ id: uid(), name, times: [time] }); syncToday(st, ctx.today); });
      toast(`${name} hinzugefügt`);
    }
    if (f.dataset.form === 'time') {
      const time = f.elements.time.value;
      if (!time) return;
      update((st) => {
        const m = st.meds.find((x) => x.id === f.dataset.id);
        if (m) m.times = sortTimes([...m.times, time]);
        syncToday(st, ctx.today);
      });
    }
    ctx.refresh();
  };
}
