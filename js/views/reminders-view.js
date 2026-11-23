// Erinnerungen: Berechtigung, Einstellungen, heutiger Plan und ehrliche Hinweise zu den Grenzen.
import { getState, update } from '../store.js';
import { minutesNow, addDays, formatShort } from '../dates.js';
import { calendarEvents, buildIcs, downloadFile } from '../ics.js';
import { upcomingEvents as upcomingOcc } from '../trackers.js';
import { bell, bottle, pillbox, phaseIcon } from '../icons.js';
import { cardHead, tape, esc, toast } from '../ui.js';
import { pageHead } from './placeholder.js';
import { platformInfo, requestPermission, showNotification, remindersForDay, tick, BEFORE_OPTIONS, beforeText } from '../reminders.js';import { medSlots } from './today.js';

const INTERVALS = [30, 45, 60, 90, 120, 180];
// Auswahl für die Kalender-Datei (nur für diese Sitzung)
const icsOpts = { meds: true, evening: true, water: false, events: true, birthdays: true, hideNames: true };

function statusCard(p) {
  let title, text, mood = 'happy', button = '';
  if (p.isIOS && !p.standalone) {
    mood = 'meh';
    title = 'Auf dem iPhone: erst zum Home-Bildschirm hinzufügen';
    text = 'Safari erlaubt Benachrichtigungen nur für Web-Apps auf dem Home-Bildschirm (ab iOS 16.4). Tippe in Safari auf „Teilen“ → „Zum Home-Bildschirm“ und öffne die App dann von dort.';
  } else if (!p.supported) {
    mood = 'meh';
    title = 'Dieser Browser kann keine Benachrichtigungen';
    text = 'Erinnerungen erscheinen dann nur als Hinweis in der geöffneten App.';
  } else if (p.permission === 'granted') {
    title = 'Benachrichtigungen sind erlaubt ✓';
    text = 'Erinnerungen kommen, solange die App geöffnet ist (auch im Hintergrund-Tab am PC).';
    button = '<button class="btn btn--mint" type="button" data-action="test" data-key="rm-test">Test-Benachrichtigung</button>';
  } else if (p.permission === 'denied') {
    mood = 'sad';
    title = 'Benachrichtigungen sind blockiert';
    text = 'Du hast sie abgelehnt. Erlauben kannst du sie wieder in den Website- bzw. App-Einstellungen deines Browsers (Schloss-Symbol neben der Adresse oder Einstellungen → Benachrichtigungen).';
  } else {
    title = 'Benachrichtigungen erlauben';
    text = 'Damit Erinnerungen als Mitteilung erscheinen, braucht die App einmal deine Erlaubnis.';
    button = '<button class="btn btn--butter" type="button" data-action="permission" data-key="rm-perm">Benachrichtigungen erlauben</button>';
  }
  return `
    <section class="card card--butter card--wide" aria-labelledby="rm-status">
      ${tape('rosa')}
      ${cardHead('', title, { id: 'rm-status', icon: bell(mood) })}
      <p>${text}</p>
      ${button ? `<div class="btn-row" style="margin-top:var(--s3)">${button}</div>` : ''}
    </section>`;
}

const toggle = (key, checked, label) => `
  <label class="switch-row">
    <input type="checkbox" class="check" data-action="toggle" data-type="${key}" data-key="tg-${key}" ${checked ? 'checked' : ''}>
    <span><strong>${label}</strong></span>
  </label>`;

export function render(root, ctx) {
  const s = getState();
  const r = s.settings.reminders;
  const p = platformInfo();
  const nowMin = minutesNow();
  const plan = remindersForDay(s, ctx.today);
  const upcoming = plan.filter((x) => x.at >= nowMin);
  const slots = medSlots(s.meds);
  const nextEvents = upcomingOcc(s.todos, ctx.today, 60).filter((t) => t.time && !t.done).slice(0, 3);
  const icsEventCount = calendarEvents(s, { events: true }, ctx.today).length; // Serien zählen einmal

  root.innerHTML = `
    ${pageHead('Erinnerungen')}
    <div class="cards">
      ${statusCard(p)}

      <section class="card card--himmel" aria-labelledby="rm-water">
        ${tape('mint', 'left')}
        ${cardHead(1, 'Trinken', { id: 'rm-water', icon: bottle(0.5) })}
        ${toggle('water', r.water.enabled, 'Trink-Erinnerung an')}
        <form class="stack" data-form="water" style="margin-top:var(--s2)">
          <div class="field">
            <label for="rm-int">Alle …</label>
            <select id="rm-int" class="select" name="interval" data-key="rm-int">
              ${INTERVALS.map((m) => `<option value="${m}" ${Number(r.water.interval) === m ? 'selected' : ''}>${m < 60 ? `${m} Minuten` : m === 60 ? '1 Stunde' : `${(m / 60).toLocaleString('de-DE')} Stunden`}</option>`).join('')}
            </select>
          </div>
          <div class="inline-form">
            <div class="field" style="flex:1"><label for="rm-from">von</label><input id="rm-from" class="input" type="time" name="from" value="${r.water.from}" required data-key="rm-from"></div>
            <div class="field" style="flex:1"><label for="rm-to">bis</label><input id="rm-to" class="input" type="time" name="to" value="${r.water.to}" required data-key="rm-to"></div>
          </div>
          <p class="card__sub">Wenn dein Tagesziel erreicht ist, kommen keine Trink-Erinnerungen mehr.</p>
        </form>
      </section>

      <section class="card card--flieder" aria-labelledby="rm-meds">
        ${tape('butter')}
        ${cardHead(2, 'Medikamente', { id: 'rm-meds', icon: pillbox() })}
        ${toggle('meds', r.meds.enabled, 'Zu jeder Medikamentenzeit erinnern')}
        ${slots.length
          ? `<p class="card__sub">${slots.map((x) => `${esc(x.time)} ${esc(x.name)}`).join(' · ')}</p>
             <p class="card__sub">Bereits abgehakte Einnahmen lösen keine Erinnerung aus. Die Uhrzeiten änderst du unter <a href="#einstellungen">Einstellungen</a>.</p>`
          : '<p class="card__sub">Noch keine Medikamente angelegt – das geht unter <a href="#einstellungen">Einstellungen</a>.</p>'}
      </section>

      <section class="card" aria-labelledby="rm-eve">
        ${tape('flieder', 'left')}
        ${cardHead(3, 'Abend-Reflexion', { id: 'rm-eve', icon: phaseIcon('luteal') })}
        ${toggle('evening', r.evening.enabled, 'Abends an die Reflexion erinnern')}
        <form class="field" data-form="evening" style="margin-top:var(--s2)">
          <label for="rm-eve-t">Uhrzeit</label>
          <input id="rm-eve-t" class="input input--time" type="time" name="time" value="${r.evening.time}" required data-key="rm-eve-t">
        </form>
      </section>

      <section class="card card--himmel" aria-labelledby="rm-ev">
        ${tape('rosa', 'left')}
        ${cardHead(4, 'Termine', { id: 'rm-ev', sub: 'Für Termine mit Uhrzeit aus dem <a href="#kalender">Kalender</a>.' })}
        ${toggle('events', r.events?.enabled, 'An Termine erinnern')}
        <form class="field" data-form="events" style="margin-top:var(--s2)">
          <label for="rm-ev-before">Wann?</label>
          <select id="rm-ev-before" class="select" name="before" data-key="rm-ev-before">
            ${BEFORE_OPTIONS.map((m) => `<option value="${m}" ${Number(r.events?.before) === m ? 'selected' : ''}>${m === 0 ? 'zur Uhrzeit des Termins' : `${beforeText(m)} vorher`}</option>`).join('')}
          </select>
        </form>
        <p class="card__sub" style="margin-top:var(--s2)">${nextEvents.length ? `Nächste: ${nextEvents.map((e) => `${formatShort(e.date)} ${esc(e.time)} ${esc(e.text)}`).join(' · ')}` : 'Keine kommenden Termine mit Uhrzeit.'}</p>
      </section>

      <section class="card card--rosa" aria-labelledby="rm-ics">
        ${tape('mint')}
        ${cardHead(5,'Zuverlässig: Erinnerungen im Kalender', { id: 'rm-ics', sub: 'Erzeugt eine Kalender-Datei mit täglichen Terminen und Alarm. Dein Handy-Kalender erinnert dann auch, wenn die App geschlossen ist.' })}
        <fieldset class="ics-opts">
          <legend class="visually-hidden">Was soll in den Kalender?</legend>
          ${[
            ['meds', `Medikamente (${slots.length} ${slots.length === 1 ? 'Termin' : 'Termine'} pro Tag)`],
            ['evening', `Abend-Reflexion um ${esc(r.evening.time)}`],
            ['water', `Trinkpausen (${calendarEvents(s, { water: true }).length} pro Tag, Intervall wie oben)`],
            ['events', `Termine mit Uhrzeit ab heute (${icsEventCount}, Serien als Wiederholung, Alarm wie oben eingestellt)`],
            ['birthdays', `Geburtstage (${calendarEvents(s, { birthdays: true }).length}, jedes Jahr, Erinnerung um 9 Uhr)`],
            ['hideNames', 'Namen von Medikamenten, Terminen und Geburtstagen ausblenden (empfohlen)'],
          ].map(([k, label]) => `
            <label class="switch-row"><input type="checkbox" class="check" data-ics="${k}" data-key="ics-${k}" ${icsOpts[k] ? 'checked' : ''}><span>${label}</span></label>`).join('')}
        </fieldset>
        <p class="note" style="margin:var(--s2) 0 var(--s3)">🔒 Datenschutz: Viele Kalender synchronisieren mit iCloud oder Google. Was du importierst, liegt dann auch dort. Deshalb sind die Namen standardmäßig ausgeblendet.</p>
        <button class="btn btn--butter" type="button" data-action="ics" data-key="ics-dl">Kalender-Datei herunterladen</button>
        <details class="later">
          <summary>So importierst du die Datei</summary>
          <ul class="limits">
            <li><strong>iPhone:</strong> Am besten in Safari (nicht in der Home-Bildschirm-App) auf den Button tippen → „Alle hinzufügen“ im Kalender.</li>
            <li><strong>Android:</strong> Datei in „Downloads“ antippen → mit Google Kalender öffnen → Kalender wählen → Importieren.</li>
            <li><strong>Später etwas geändert?</strong> Die alten Termine im Kalender löschen und die neue Datei importieren.</li>
          </ul>
        </details>
      </section>

      <section class="card card--mint" aria-labelledby="rm-next">
        ${tape('rosa')}
        ${cardHead('', 'Heute noch geplant', { id: 'rm-next' })}
        ${upcoming.length ? `<ul class="plain">${upcoming.slice(0, 12).map((x) => `<li class="row"><span class="row__text"><strong>${x.time}</strong> · ${esc(x.title)}</span></li>`).join('')}</ul>
          ${upcoming.length > 12 ? `<p class="card__sub">… und ${upcoming.length - 12} weitere</p>` : ''}`
          : '<p>Für heute steht keine Erinnerung mehr an.</p>'}
      </section>

      <section class="card card--wide" aria-labelledby="rm-limits">
        ${tape('himmel')}
        ${cardHead('', 'Ehrlich gesagt: Was ohne Server geht', { id: 'rm-limits' })}
        <ul class="limits">
          <li><strong>App geöffnet:</strong> Erinnerungen kommen pünktlich (am PC auch, wenn der Tab im Hintergrund ist).</li>
          <li><strong>Android:</strong> Ist die App geschlossen oder länger im Hintergrund, pausiert das Handy sie – dann kommt nichts.</li>
          <li><strong>iPhone (ab iOS 16.4):</strong> nur als App vom Home-Bildschirm und nur, solange sie geöffnet ist. iOS stoppt Web-Apps im Hintergrund sofort.</li>
          <li><strong>Beim Öffnen:</strong> Verpasste Medikamente zeigt die App oben auf „Heute“ an.</li>
          <li><strong>Zuverlässig im Hintergrund</strong> ginge nur mit einem Push-Server. Der müsste deine Erinnerungszeiten kennen – deshalb ist das bewusst nicht eingebaut.</li>
        </ul>
      </section>
    </div>`;

  root.onclick = async (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'permission') {
      const res = await requestPermission();
      toast(res === 'granted' ? 'Benachrichtigungen erlaubt ✓' : 'Benachrichtigungen nicht erlaubt');
      ctx.refresh();
    }
    if (btn.dataset.action === 'ics') {
      const events = calendarEvents(getState(), icsOpts, ctx.today);
      if (!events.length) { toast('Bitte mindestens eine Erinnerung auswählen'); return; }
      downloadFile(buildIcs(events, addDays(ctx.today, 1)), 'daily-quests-erinnerungen.ics', 'text/calendar;charset=utf-8');
      toast(`${events.length} tägliche ${events.length === 1 ? 'Termin' : 'Termine'} erstellt – ab morgen`);
    }
    if (btn.dataset.action === 'test') {
      const ok = await showNotification('✦ Daily Quests', 'So sehen deine Erinnerungen aus.', 'test');
      toast(ok ? 'Test-Benachrichtigung gesendet' : 'Konnte keine Benachrichtigung zeigen');
    }
  };

  root.onchange = (ev) => {
    const el = ev.target;
    if (el.dataset.ics) { icsOpts[el.dataset.ics] = el.checked; return; }
    if (el.dataset.action === 'toggle') {
      update((st) => { st.settings.reminders[el.dataset.type].enabled = el.checked; });
      if (el.checked && p.supported && p.permission === 'default') {
        toast('Tipp: Erlaube oben noch die Benachrichtigungen');
      }
      tick();
      ctx.refresh();
      return;
    }
    const form = el.form;
    if (!form || !el.checkValidity()) return;
    if (form.dataset.form === 'water') {
      const { interval, from, to } = form.elements;
      if (from.value >= to.value) { toast('„von“ muss vor „bis“ liegen'); return; }
      update((st) => Object.assign(st.settings.reminders.water, { interval: Number(interval.value), from: from.value, to: to.value }));
    }
    if (form.dataset.form === 'events') {
      update((st) => { st.settings.reminders.events.before = Number(el.value); });
    }
    if (form.dataset.form === 'evening') {
      update((st) => { st.settings.reminders.evening.time = el.value; });
    }
    toast('Gespeichert');
    ctx.refresh();
  };

  root.onsubmit = (ev) => ev.preventDefault();
}
