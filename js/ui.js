// Kleine Helfer für die Oberfläche.

/** Text sicher in HTML einsetzen (verhindert, dass Eingaben als Code laufen). */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let toastTimer;
export function toast(message, ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.dataset.show = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.dataset.show = 'false'; }, ms);
}

/** Karten-Kopf im Journal-Stil: "1. Überschrift" mit optionalem Icon. */
export function cardHead(num, title, { icon = '', sub = '', id = '' } = {}) {
  return `
    <div class="card__head">
      ${icon ? `<span class="card__icon">${icon}</span>` : ''}
      <div style="flex:1">
        <h2 ${id ? `id="${id}"` : ''}>${num ? `<span class="card__num">${num}.</span> ` : ''}${title}</h2>
        ${sub ? `<p class="card__sub">${sub}</p>` : ''}
      </div>
    </div>`;
}

/**
 * Einklappbarer Kasten (Heute-Seite). Kopf bleibt sichtbar, Inhalt lässt sich zuklappen.
 * @param o { id, title, body, cls, tapeHtml, icon, sub, collapsed }
 */
export function foldCard({ id, title, body, cls = '', tapeHtml = '', icon = '', sub = '', collapsed = false }) {
  return `
    <section class="card ${cls} ${collapsed ? 'is-collapsed' : ''}" aria-labelledby="h-${id}" data-module="${id}">
      ${tapeHtml}
      <div class="card__head">
        ${icon ? `<span class="card__icon">${icon}</span>` : ''}
        <div style="flex:1;min-width:0">
          <h2 id="h-${id}">${title}</h2>
          ${sub ? `<p class="card__sub">${sub}</p>` : ''}
        </div>
        <button class="btn btn--ghost btn--icon fold" type="button" data-action="fold" data-module="${id}" data-key="fold-${id}"
          aria-expanded="${!collapsed}" aria-controls="b-${id}" aria-label="${esc(stripTags(title))} ${collapsed ? 'aufklappen' : 'einklappen'}">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>
      <div class="card__body" id="b-${id}" ${collapsed ? 'hidden' : ''}>${collapsed ? '' : body}</div>
    </section>`;
}

/**
 * Kleiner Auswahl-Dialog (barrierearm über das <dialog>-Element).
 * @param message  Frage
 * @param options  [{ value, label, primary? }]
 * @returns Promise mit dem gewählten value oder null (Abbrechen / Esc)
 */
export function choose(message, options) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'choice';
    dlg.setAttribute('aria-labelledby', 'choice-msg');
    dlg.innerHTML = `
      <p id="choice-msg" class="choice__msg">${esc(message)}</p>
      <div class="choice__btns">
        ${options.map((o, i) => `<button type="button" class="btn ${o.primary ? 'btn--rosa' : ''}" data-i="${i}">${esc(o.label)}</button>`).join('')}
        <button type="button" class="btn btn--ghost" data-i="-1">Abbrechen</button>
      </div>`;
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-i]');
      if (b) done(b.dataset.i === '-1' ? null : options[Number(b.dataset.i)].value);
    });
    dlg.addEventListener('cancel', (ev) => { ev.preventDefault(); done(null); });
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector('button')?.focus();
  });
}

const stripTags =(s) => String(s).replace(/<[^>]*>/g, '');

export const tape =(color = '', side = '') =>
  `<span class="tape ${color ? `tape--${color}` : ''} ${side ? `tape--${side}` : ''}" aria-hidden="true"></span>`;
