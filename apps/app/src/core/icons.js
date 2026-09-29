// Line icons (24×24, stroke = currentColor), in the spirit of SF Symbols. Inline SVG, no icon font.
const P = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M10 20v-6h4v6',
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  chart: 'M4 20V4M4 20h16M7.5 15l3.5-4 3 2.5L19 8',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5',
  people: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.9-3.2 3.3-5 6.5-5s5.6 1.8 6.5 5M16 11a3 3 0 1 0 0-6M17.5 14.6c2 .5 3.4 2 4 4.4',
  calendar: 'M4 6.5h16V20H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5',
  checklist: 'M4 6.5l1.8 1.8L9 5M4 13l1.8 1.8L9 11.5M4 19.5l1.8 1.8L9 18M12.5 7h7.5M12.5 13.5h7.5M12.5 20h7.5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  bell: 'M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15L6 17ZM10 21h4',
  chevron: 'M9.5 5.5 16 12l-6.5 6.5',
  back: 'M14.5 5.5 8 12l6.5 6.5',
  scale: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8.5 9.5a5 5 0 0 1 7 0L12 12',
  fork: 'M7 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M9 12v9M17 21V3c-2 1.5-3 4-3 7v3h3',
  flame: 'M12 21c3.9 0 7-2.8 7-6.6 0-3.3-2.1-5.6-4-7.4-.3 2-1.3 3.3-2.6 4C12.9 7.7 11.3 5 9 3c.2 3-2.7 5.3-3.7 7.6A7 7 0 0 0 5 14.4C5 18.2 8.1 21 12 21Z',
  steps: 'M8.5 13.5c-1.9 0-3-1.8-3-4.3S6.4 4 8.3 4s2.7 2.6 2.7 5-1 4.5-2.5 4.5ZM6.2 16.5l4.6-.7.4 2.3a2.3 2.3 0 0 1-4.6.7l-.4-2.3ZM15.5 10.5c1.9 0 3-1.8 3-4.3S17.6 1 15.7 1 13 3.6 13 6s1 4.5 2.5 4.5ZM17.8 13.5l-4.6-.7-.4 2.3a2.3 2.3 0 0 0 4.6.7l.4-2.3Z',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.5h.01M15 9.5h.01',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20ZM4.5 12.5h4l1.5-2.5 2 4.5 1.5-2h6',
  pill: 'M10.5 20.5a4.95 4.95 0 0 1-7-7l6-6a4.95 4.95 0 0 1 7 7l-6 6ZM7 10l7 7',
  drop: 'M12 21a6.5 6.5 0 0 0 6.5-6.5C18.5 9.8 12 3 12 3S5.5 9.8 5.5 14.5A6.5 6.5 0 0 0 12 21Z',
  camera: 'M4 8h3.5L9 5.5h6L16.5 8H20v11.5H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  run: 'M14 5.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM7 21l3.5-5 3 2.5V22M9.5 11l2.5-3 3.5 3 3 .5M12 8l-1.5 5 4 2.5M6.5 11.5 9.5 8',
  link: 'M10 14a4 4 0 0 0 5.7 0l3.3-3.3a4 4 0 0 0-5.7-5.7L12 6.3M14 10a4 4 0 0 0-5.7 0L5 13.3a4 4 0 0 0 5.7 5.7l1.3-1.3',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  euro: 'M17.5 6.5A6.5 6.5 0 1 0 17.5 17.5M5 10.5h8M5 13.5h8',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.4 7.4 0 0 1-2.2 1.3L14.5 21h-4l-.4-2.3a7.4 7.4 0 0 1-2.2-1.3l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.7a7.4 7.4 0 0 1 2.2-1.3L10.5 3h4l.4 2.3a7.4 7.4 0 0 1 2.2 1.3l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3Z',
  plus: 'M12 5v14M5 12h14',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2',
  pause: 'M9 5v14M15 5v14',
  message: 'M4 5h16v11H9l-5 4V5Z',
  warning: 'M12 4 2.5 20h19L12 4ZM12 10v4.5M12 17.5h.01',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4v3h-4z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 12h.01',
  lock: 'M6 11h12v9.5H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  list: 'M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01',
  check: 'M5 12.5 10 17.5 19.5 7',
  x: 'M6 6l12 12M18 6 6 18',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.5h.01',
  location: 'M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  phone: 'M6.5 3.5 9.5 3l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2 4.5 1.5-.5 3a2 2 0 0 1-2 1.5C10.5 19 5 13.5 5 5.5a2 2 0 0 1 1.5-2Z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  download: 'M12 4v12M7 11l5 5 5-5M4 16v4h16v-4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4'
};

/** <svg> element for an icon name */
export function icon(name, { size = 22, stroke = 1.9, cls = '' } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', stroke);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ico ' + cls);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', P[name] || P.info);
  svg.append(path);
  return svg;
}

/** Colored rounded square with a white icon – like iOS Settings rows */
export function tile(name, color = 'accent', size = 30) {
  const el = document.createElement('span');
  el.className = 'tile tile-' + color;
  el.style.width = el.style.height = size + 'px';
  el.append(icon(name, { size: Math.round(size * 0.62), stroke: 2.1 }));
  return el;
}

export const ICON_NAMES = Object.keys(P);
