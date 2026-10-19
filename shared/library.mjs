export const THEMES = ['heritage', 'specialty', 'citylife', 'practical', 'industry'];
export function parisWeek(now = new Date()) {
  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const monday = new Date(`${date}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}
export function editorialScore(source) {
  const e = source.editorial || {};
  return Math.round(
    (Number(e.relevance || 0) * 40 +
      Number(e.authority || 0) * 35 +
      Number(e.usefulness || 0) * 25) /
      5
  );
}
export function selectWeekly(sources, metrics = {}, now = new Date()) {
  const week = parisWeek(now);
  const candidates = sources.filter(
    (s) =>
      s.kind !== 'directory' &&
      Date.parse(s.checkedAt) <= now.getTime() &&
      now.getTime() - Date.parse(s.checkedAt) <= 90 * 86400000
  );
  const sorted = candidates
    .map((s) => ({ ...s, editorialScore: editorialScore(s), metrics: metrics[s.id] || null }))
    .sort((a, b) => b.editorialScore - a.editorialScore || a.id.localeCompare(b.id));
  // Rotate within a comparable quality band; keep each week's selection stable.
  const high = sorted.filter((s) => s.editorialScore >= 75);
  const pool = high;
  const index = Math.floor(Date.parse(week.start) / (7 * 86400000));
  const rotated = pool.length
    ? pool.slice(index % pool.length).concat(pool.slice(0, index % pool.length))
    : [];
  const selected = [],
    themes = new Set(),
    publishers = new Map();
  for (const diverse of [true, false])
    for (const s of rotated) {
      if (selected.length >= 4) break;
      if (
        selected.some((x) => x.id === s.id) ||
        (publishers.get(s.publisher) || 0) >= 2 ||
        (diverse && themes.has(s.theme))
      )
        continue;
      selected.push(s);
      themes.add(s.theme);
      publishers.set(s.publisher, (publishers.get(s.publisher) || 0) + 1);
    }
  return { ...week, sources: selected };
}
