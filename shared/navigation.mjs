export function googleDirections(place, query = {}) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', `${place.lat},${place.lng}`);
  if (query.origin) url.searchParams.set('origin', `${query.origin.lat},${query.origin.lng}`);
  // Google Maps URLs have no departure-time parameter. Confirm time in Google.
  if (query.mode !== 'either')
    url.searchParams.set('travelmode', query.mode === 'transit' ? 'transit' : 'walking');
  return url.href;
}
export function googleSearch(text = 'cafés Paris') {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', text);
  return url.href;
}
