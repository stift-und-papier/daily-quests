// Alle Illustrationen als selbst gezeichnete Inline-SVGs.
// Jede Funktion liefert einen SVG-Text. Dekorative Bilder sind für Screenreader versteckt.

const INK = '#4A3B36';
const C = {
  rosa: '#F8D7DF', mint: '#BFE3D9', butter: '#FCEFC2', flieder: '#DCD3F2', himmel: '#D6E6FA', creme: '#FFF8F0',
  rosaD: '#EFA3B6', mintD: '#86CBB8', butterD: '#F5D77A', fliederD: '#B7A6E3', himmelD: '#9EC2EE', orangeD: '#F6BE95',
  card: '#FFFDF9',
};
let uidCounter = 0;
const nextId = (p) => `${p}${++uidCounter}`;

const svg = (body, { size = 64, label = '', cls = '' } = {}) =>
  `<svg viewBox="0 0 ${size} ${size}" class="${cls}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"'} xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

/* ---------- kleines Gesicht ---------- */
function face(cx, cy, mood = 'happy', scale = 1) {
  const s = scale;
  const ex = 6 * s, ey = cy - 2 * s;
  let eyes = `<circle cx="${cx - ex}" cy="${ey}" r="${2 * s}" fill="${INK}"/><circle cx="${cx + ex}" cy="${ey}" r="${2 * s}" fill="${INK}"/>`;
  let mouth;
  switch (mood) {
    case 'sad':
      mouth = `<path d="M${cx - 5 * s} ${cy + 6 * s} Q${cx} ${cy + 1 * s} ${cx + 5 * s} ${cy + 6 * s}" fill="none" stroke="${INK}" stroke-width="${2 * s}" stroke-linecap="round"/>`;
      eyes += `<path d="M${cx - ex - 2.5 * s} ${ey - 4 * s} L${cx - ex + 2 * s} ${ey - 3 * s}M${cx + ex + 2.5 * s} ${ey - 4 * s} L${cx + ex - 2 * s} ${ey - 3 * s}" stroke="${INK}" stroke-width="${1.6 * s}" stroke-linecap="round"/>`;
      break;
    case 'meh':
      mouth = `<path d="M${cx - 4 * s} ${cy + 5 * s} Q${cx} ${cy + 2.5 * s} ${cx + 4 * s} ${cy + 5 * s}" fill="none" stroke="${INK}" stroke-width="${2 * s}" stroke-linecap="round"/>`;
      break;
    case 'neutral':
      mouth = `<path d="M${cx - 4 * s} ${cy + 4 * s} L${cx + 4 * s} ${cy + 4 * s}" stroke="${INK}" stroke-width="${2 * s}" stroke-linecap="round"/>`;
      break;
    case 'joy':
      eyes = `<path d="M${cx - ex - 3 * s} ${ey + 1 * s} Q${cx - ex} ${ey - 3.5 * s} ${cx - ex + 3 * s} ${ey + 1 * s}M${cx + ex - 3 * s} ${ey + 1 * s} Q${cx + ex} ${ey - 3.5 * s} ${cx + ex + 3 * s} ${ey + 1 * s}" fill="none" stroke="${INK}" stroke-width="${2 * s}" stroke-linecap="round"/>`;
      mouth = `<path d="M${cx - 5 * s} ${cy + 2 * s} Q${cx} ${cy + 10 * s} ${cx + 5 * s} ${cy + 2 * s} Z" fill="${INK}"/>`;
      break;
    case 'sleepy':
      eyes = `<path d="M${cx - ex - 2.5 * s} ${ey} Q${cx - ex} ${ey + 2.5 * s} ${cx - ex + 2.5 * s} ${ey}M${cx + ex - 2.5 * s} ${ey} Q${cx + ex} ${ey + 2.5 * s} ${cx + ex + 2.5 * s} ${ey}" fill="none" stroke="${INK}" stroke-width="${1.8 * s}" stroke-linecap="round"/>`;
      mouth = `<path d="M${cx - 3 * s} ${cy + 4 * s} Q${cx} ${cy + 6.5 * s} ${cx + 3 * s} ${cy + 4 * s}" fill="none" stroke="${INK}" stroke-width="${1.8 * s}" stroke-linecap="round"/>`;
      break;
    default: // happy
      mouth = `<path d="M${cx - 4.5 * s} ${cy + 2.5 * s} Q${cx} ${cy + 7.5 * s} ${cx + 4.5 * s} ${cy + 2.5 * s}" fill="none" stroke="${INK}" stroke-width="${2 * s}" stroke-linecap="round"/>`;
  }
  const blush = `<ellipse cx="${cx - 10 * s}" cy="${cy + 3 * s}" rx="${3 * s}" ry="${2 * s}" fill="${C.rosaD}" opacity=".85"/><ellipse cx="${cx + 10 * s}" cy="${cy + 3 * s}" rx="${3 * s}" ry="${2 * s}" fill="${C.rosaD}" opacity=".85"/>`;
  return blush + eyes + mouth;
}

/* ---------- Deko ---------- */
export const sparkle = (color = C.butterD, cls = 'sparkle') =>
  svg(`<path d="M12 2C12.8 8 16 11.2 22 12C16 12.8 12.8 16 12 22C11.2 16 8 12.8 2 12C8 11.2 11.2 8 12 2Z" fill="${color}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`, { size: 24, cls });

export const heart = (color = C.rosaD, cls = '') =>
  svg(`<path d="M12 21s-7.5-4.6-9.4-9.3A5.1 5.1 0 0 1 12 6.4a5.1 5.1 0 0 1 9.4 5.3C19.5 16.4 12 21 12 21z" fill="${color}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`, { size: 24, cls });

export function heartFace() {
  return svg(`<path d="M32 56S10 43 5.5 29.5A13.5 13.5 0 0 1 32 17a13.5 13.5 0 0 1 26.5 12.5C54 43 32 56 32 56z" fill="${C.rosaD}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>${face(32, 33, 'happy', 0.9)}`);
}

/* App-Maskottchen im Kopf: kleiner Stern mit Gesicht */
export function mascot() {
  return svg(`
    <path d="M32 5 L40 22 L58 24.5 L44.8 37 L48.4 55 L32 46 L15.6 55 L19.2 37 L6 24.5 L24 22 Z" fill="${C.butterD}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    ${face(32, 33, 'happy', 0.8)}
    <path d="M55 6 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z" fill="${C.rosaD}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`);
}

/* ---------- Navigation (Linien-Icons in Textfarbe) ---------- */
const navSvg = (body) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const nav = {
  heute: () => navSvg('<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
  kalender: () => navSvg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14.5h.01M12 14.5h.01M16 14.5h.01"/>'),
  woche: () => navSvg('<path d="M4 20V10M10 20V5M16 20v-7M21 20H3"/>'),
  zyklus: () => navSvg('<path d="M19.5 14.5A8 8 0 1 1 10 4.5a6.5 6.5 0 0 0 9.5 10z"/>'),
  erinnerungen: () => navSvg('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  einstellungen: () => navSvg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
};

/* ---------- Wasserflasche mit Gesicht (fill: 0–1) ---------- */
export function bottle(fill = 0.5, { label = '' } = {}) {
  const id = nextId('bt');
  const f = Math.max(0, Math.min(1, fill));
  const top = 20, bottom = 58, h = (bottom - top) * f;
  const mood = f >= 1 ? 'joy' : f >= 0.5 ? 'happy' : f > 0 ? 'neutral' : 'sleepy';
  return svg(`
    <defs><clipPath id="${id}"><rect x="15" y="17" width="34" height="43" rx="11"/></clipPath></defs>
    <rect x="25" y="4" width="14" height="8" rx="3" fill="${C.himmelD}" stroke="${INK}" stroke-width="2.5"/>
    <rect x="22" y="11" width="20" height="7" rx="3" fill="${C.card}" stroke="${INK}" stroke-width="2.5"/>
    <rect x="15" y="17" width="34" height="43" rx="11" fill="${C.card}"/>
    <g clip-path="url(#${id})">
      <rect x="10" y="${bottom - h}" width="44" height="${h + 4}" fill="${C.himmelD}"/>
      <path d="M10 ${bottom - h} q6 -3 11 0 t11 0 t11 0 t11 0" fill="${C.himmel}" opacity=".9"/>
    </g>
    <rect x="15" y="17" width="34" height="43" rx="11" fill="none" stroke="${INK}" stroke-width="2.5"/>
    <path d="M20 26v10" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
    ${face(32, 40, mood, 0.75)}`, { label });
}

/* ---------- Pillendose mit Gesicht ---------- */
export function pillbox(mood = 'happy') {
  return svg(`
    <g transform="rotate(-25 50 14)">
      <rect x="40" y="8" width="20" height="10" rx="5" fill="${C.card}" stroke="${INK}" stroke-width="2"/>
      <path d="M50 8v10" stroke="${INK}" stroke-width="2"/>
      <path d="M50 8h5a5 5 0 0 1 0 10h-5z" fill="${C.rosaD}" stroke="${INK}" stroke-width="2"/>
    </g>
    <rect x="7" y="27" width="46" height="31" rx="9" fill="${C.flieder}" stroke="${INK}" stroke-width="2.5"/>
    <rect x="5" y="20" width="50" height="11" rx="5" fill="${C.fliederD}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M22 20v11M38 20v11" stroke="${INK}" stroke-width="2"/>
    ${face(30, 42, mood, 0.8)}`);
}

/* ---------- Energie-Batterie mit Gesicht (level 0, 25, 50, 75, 100) ---------- */
const BATTERY = {
  0:   { color: C.rosaD,   mood: 'sad' },
  25:  { color: C.orangeD, mood: 'meh' },
  50:  { color: C.butterD, mood: 'neutral' },
  75:  { color: '#B5DB9A', mood: 'happy' },
  100: { color: C.mintD,   mood: 'joy' },
};
export function battery(level = 50) {
  const id = nextId('bat');
  const { color, mood } = BATTERY[level] || BATTERY[50];
  const top = 13, bottom = 60;
  const h = level === 0 ? 4 : (bottom - top) * (level / 100);
  const glitter = level === 100
    ? `<path d="M55 8 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z" fill="${C.butterD}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
       <path d="M8 4 l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1z" fill="${C.butterD}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`
    : '';
  return svg(`
    <defs><clipPath id="${id}"><rect x="15" y="11" width="34" height="50" rx="9"/></clipPath></defs>
    <rect x="25" y="5" width="14" height="7" rx="2.5" fill="${C.card}" stroke="${INK}" stroke-width="2.5"/>
    <rect x="15" y="11" width="34" height="50" rx="9" fill="${C.card}"/>
    <g clip-path="url(#${id})"><rect x="10" y="${bottom + 1 - h}" width="44" height="${h + 4}" fill="${color}"/></g>
    <rect x="15" y="11" width="34" height="50" rx="9" fill="none" stroke="${INK}" stroke-width="2.5"/>
    ${face(32, 34, mood, 0.75)}${glitter}`);
}

/* ---------- Stern für Erfolge ---------- */
export function star(filled = true) {
  return svg(`
    <path d="M32 6 L39.6 22.6 L57.7 24.6 L44.2 36.9 L48 54.8 L32 45.6 L16 54.8 L19.8 36.9 L6.3 24.6 L24.4 22.6 Z"
      fill="${filled ? C.butterD : C.card}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" ${filled ? '' : 'stroke-dasharray="4 4"'}/>
    ${filled ? face(32, 33, 'happy', 0.65) : ''}`);
}

/* ---------- Zyklusphasen: Mond & Blumen mit Gesicht ---------- */
export function phaseIcon(phase) {
  switch (phase) {
    case 'menstruation': // Sichelmond, gemütlich
      return svg(`
        <path d="M38 6A27 27 0 1 0 58 44A21 21 0 0 1 38 6Z" fill="${C.rosaD}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
        ${face(24, 38, 'sleepy', 0.75)}
        <path d="M50 14h5l-5 6h5" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`);
    case 'follicular': // Knospe
      return svg(`
        <path d="M32 58V34" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M32 48c-8 0-13-5-14-11 7 0 13 4 14 11zM32 44c7 0 12-4 13-10-7 0-12 4-13 10z" fill="${C.mintD}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M32 36c-10 0-14-9-12-20 4 3 8 3 12-4 4 7 8 7 12 4 2 11-2 20-12 20z" fill="${C.mint}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
        ${face(32, 24, 'happy', 0.6)}`);
    case 'ovulation': // Blume in voller Blüte
      return svg(`
        ${[0, 60, 120, 180, 240, 300].map((a) => {
          const r = (a * Math.PI) / 180;
          return `<circle cx="${32 + 17 * Math.cos(r)}" cy="${32 + 17 * Math.sin(r)}" r="10" fill="${C.rosa}" stroke="${INK}" stroke-width="2.2"/>`;
        }).join('')}
        <circle cx="32" cy="32" r="14" fill="${C.butterD}" stroke="${INK}" stroke-width="2.5"/>
        ${face(32, 32, 'joy', 0.6)}`);
    default: // Lutealphase: runder Mond mit Kratern
      return svg(`
        <circle cx="32" cy="34" r="24" fill="${C.flieder}" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="46" cy="22" r="3.5" fill="${C.fliederD}"/><circle cx="16" cy="44" r="3" fill="${C.fliederD}"/><circle cx="44" cy="48" r="2.5" fill="${C.fliederD}"/>
        ${face(30, 34, 'happy', 0.75)}
        <path d="M56 6 l1.3 3 3 1.3 -3 1.3 -1.3 3 -1.3 -3 -3 -1.3 3 -1.3z" fill="${C.butterD}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`);
  }
}

/* ---------- Tracker: Wölkchen mit Pflaster ---------- */
export function trackerIcon() {
  return svg(`
    <path d="M17 50a11 11 0 0 1-1-22 15 15 0 0 1 29-4 12 12 0 0 1 3 26z" fill="${C.himmel}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <g transform="rotate(-30 43 22)"><rect x="34" y="18" width="18" height="8" rx="4" fill="${C.butter}" stroke="${INK}" stroke-width="2"/>
      <rect x="40" y="18" width="6" height="8" fill="${C.butterD}" stroke="${INK}" stroke-width="1.5"/></g>
    ${face(30, 38, 'meh', 0.75)}
    <path d="M52 52 l1.3 3 3 1.3 -3 1.3 -1.3 3 -1.3 -3 -3 -1.3 3 -1.3z" fill="${C.rosaD}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`);
}

/* ---------- Geburtstagstorte ---------- */
export function cake({ size = 64, label = '' } = {}) {
  return svg(`
    <path d="M32 6c3 4 3 7 0 9-3-2-3-5 0-9z" fill="${C.butterD}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="29.5" y="15" width="5" height="11" rx="2" fill="${C.himmelD}" stroke="${INK}" stroke-width="2"/>
    <rect x="12" y="26" width="40" height="13" rx="5" fill="${C.rosa}" stroke="${INK}" stroke-width="2.5"/>
    <rect x="7" y="38" width="50" height="18" rx="6" fill="${C.rosaD}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M7 45q6 5 12 0t13 0 13 0 12 0" fill="none" stroke="${C.card}" stroke-width="3" stroke-linecap="round"/>
    ${face(32, 31, 'happy', 0.5)}`, { size, label });
}

/* ---------- Glöckchen mit Gesicht ---------- */
export function bell(mood = 'happy') {
  return svg(`
    <circle cx="32" cy="8" r="4" fill="${C.butterD}" stroke="${INK}" stroke-width="2.2"/>
    <path d="M14 46V31a18 18 0 0 1 36 0v15l5 6H9z" fill="${C.butter}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M26 54a6 6 0 0 0 12 0" fill="${C.butterD}" stroke="${INK}" stroke-width="2.5"/>
    ${face(32, 34, mood, 0.75)}
    <path d="M6 20q-3 6 0 12M58 20q3 6 0 12" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`);
}

/* ---------- Liniensymbole für Buttons ---------- */
const lineSvg = (body) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const line = {
  plus: () => lineSvg('<path d="M12 5v14M5 12h14"/>'),
  trash: () => lineSvg('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
  arrowRight: () => lineSvg('<path d="M5 12h13M13 6l6 6-6 6"/>'),
  arrowLeft: () => lineSvg('<path d="M19 12H6M11 6l-6 6 6 6"/>'),
  arrowUp: () => lineSvg('<path d="M12 19V6M6 11l6-6 6 6"/>'),
  arrowDown: () => lineSvg('<path d="M12 5v13M6 13l6 6 6-6"/>'),
  edit: () => lineSvg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  share: () => lineSvg('<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>'),
  download: () => lineSvg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  upload: () => lineSvg('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>'),
  minus: () => lineSvg('<path d="M5 12h14"/>'),
};

export { C as colors, face };
