// Gemeinsamer Platzhalter für Seiten, die in einem späteren Schritt gebaut werden.
import { sparkle } from '../icons.js';
import { tape } from '../ui.js';

export function pageHead(title) {
  return `
    <div class="page-head">
      <h1>${title}</h1>
      <span class="page-head__deco" aria-hidden="true">${sparkle(undefined, 'sparkle twinkle')}${sparkle('#EFA3B6', 'sparkle twinkle')}${sparkle('#9EC2EE', 'sparkle twinkle')}</span>
    </div>`;
}

export function placeholder(root, title, step, color = 'flieder') {
  root.innerHTML = `
    ${pageHead(title)}
    <section class="card card--${color}">
      ${tape('butter')}
      <h2>Kommt in Schritt ${step}</h2>
      <p class="card__sub">Diese Seite baue ich als Nächstes.</p>
    </section>`;
}
