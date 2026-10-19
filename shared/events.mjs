export function upcomingEvent(event, now = Date.now()) {
  if (event.status === 'cancelled') return null;
  const occurrences = (event.occurrences || []).filter(o => Date.parse(o.end) >= now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  if (event.occurrences?.length && !occurrences.length) return null;
  if (!event.occurrences?.length && Date.parse(event.end) < now) return null;
  const next = occurrences[0];
  return { ...event, ...(next || {}), occurrences };
}
