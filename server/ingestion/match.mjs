const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
function meters(a, b) {
  if (![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) return Infinity;
  const rad = Math.PI / 180,
    dlat = (b.lat - a.lat) * rad,
    dlng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}
export function linkEvent(event, places) {
  const candidates = places.filter((p) => !p.demo);
  const exact = candidates.find(
    (p) =>
      normalize(p.address) === normalize(event.address) ||
      (normalize(p.name) === normalize(event.venue) && meters(p, event) < 80)
  );
  return {
    ...event,
    placeId: exact?.id || null,
    relationship: exact ? 'at_venue' : 'unmatched',
    nearbyPlaceIds: candidates
      .filter((p) => p.id !== exact?.id && meters(p, event) < 300)
      .map((p) => p.id),
  };
}
