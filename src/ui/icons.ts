/** Minimal stroke icon set (24×24, currentColor). */
const P: Record<string, string> = {
  query: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/>',
  bulldoze:
    '<path d="M3 17h11v-5H6l-3 3z"/><path d="M14 12V8h3l2 4"/><path d="M19 12v5h2"/><circle cx="6.5" cy="18.5" r="1.8"/><circle cx="12" cy="18.5" r="1.8"/><path d="M21 9l1 9"/>',
  landscape: '<path d="m3 20 6-10 4 6 3-4 5 8z"/><path d="m8.5 11 1.5 2.5"/>',
  zones:
    '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
  road: '<path d="M7 21 10 3"/><path d="m17 21-3-18"/><path d="M12 6v2M12 11v2M12 16v2"/>',
  rail: '<path d="M8 3 6 21M16 3l2 18"/><path d="M5 7h14M4.5 12h15M4 17h16"/>',
  power: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  water: '<path d="M12 2.7C9 7 6 10.5 6 14a6 6 0 0 0 12 0c0-3.5-3-7-6-11.3z"/>',
  garbage: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M5 6l1 15h12l1-15"/><path d="M10 10v7M14 10v7"/>',
  safety: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  health: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>',
  education: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/>',
  parks: '<path d="M12 22v-6"/><path d="M12 3 6 13h3l-3 4h12l-3-4h3z"/>',
  rewards: '<path d="m12 2 3 6.3 7 1-5 4.8 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.8 7-1z"/>',
  transport:
    '<rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 11h16"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/><path d="M7 21l2-4M17 21l-2-4"/>',
  budget:
    '<circle cx="9" cy="9" r="6"/><path d="M15.5 9.3A6 6 0 1 1 9.3 15.5"/><path d="M9 6v6M7.5 7.5h2.3a1.2 1.2 0 0 1 0 2.4H8.2a1.2 1.2 0 0 0 0 2.4h2.3"/>',
  ordinances:
    '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6"/><path d="M6 3a2 2 0 0 0-2 2v1h4V5a2 2 0 0 0-2-2z"/><path d="M10 8h6M10 12h6M10 16h4"/>',
  graphs: '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>',
  advisors:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 21c0-4 3-6.5 6.5-6.5s6.5 2.5 6.5 6.5"/><circle cx="17" cy="7" r="2.5"/><path d="M16 13c3 0 5.5 2 5.5 5.5"/>',
  neighbors: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  disasters: '<path d="M21 4H3M18 8H6M15 12H8M13 16H9M12 20h-1"/>',
  save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3"/><rect x="7" y="13" width="10" height="8"/>',
  load: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H7l-4 9z"/><path d="M3 19 7 10h16l-4 9z"/>',
  options:
    '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  underground: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/><path d="M12 18v3"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  highway: '<path d="M2 9h20"/><path d="M2 13h20"/><path d="M5 13v8M19 13v8"/><path d="M6 11h3M11 11h2M15 11h3"/>',
  subway:
    '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/><path d="m8 21 2-4M16 21l-2-4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5"/><path d="M12 17.5v.01"/>',
  sound: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
  raise: '<path d="m12 4-7 8h4v8h6v-8h4z"/>',
  lower: '<path d="m12 20 7-8h-4V4H9v8H5z"/>',
  level: '<path d="M3 12h18"/><path d="m7 8-4 4 4 4M17 8l4 4-4 4"/>',
  tree: '<path d="M12 22v-5"/><circle cx="12" cy="10" r="6"/>',
  dezone: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><path d="M8 8l8 8M16 8l-8 8"/>',
  pipe: '<path d="M3 9h7a2 2 0 0 1 2 2v10"/><path d="M3 15h3v6"/><path d="M16 21V11a8 8 0 0 0-8-8H3"/>',
  powerline: '<path d="M12 2v20M7 6h10M8 10h8"/><path d="M5 22l7-16 7 16"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  play: '<path d="m7 4 13 8-13 8z"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  trophy: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  fire: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7z"/>',
  tornado: '<path d="M21 4H3M18 8H6M15 12H8M13 16H9M12 20h-1"/>',
  quake: '<path d="M2 12h4l2-5 3 10 3-12 3 9 2-2h3"/>',
  meteor: '<circle cx="15" cy="15" r="5"/><path d="M3 3l8 8M7 3l5 5M3 7l5 5"/>',
  news: '<path d="M4 4h13v16H6a2 2 0 0 1-2-2z"/><path d="M17 8h3v10a2 2 0 0 1-2 2"/><path d="M8 8h5M8 12h5M8 16h5"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};

export function icon(name: string, size = 20): string {
  const body = P[name] ?? P.building;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
