export const SOURCE_URL = 'https://parisdata.opendatasoft.com/explore/dataset/que-faire-a-paris-/';
export function normalizeEvent(record, now = new Date()) {
  if (!record.id || !record.title || !record.date_start || !record.date_end) return null;
  if (!Number.isFinite(Date.parse(record.date_start)) || !Number.isFinite(Date.parse(record.date_end))) return null;
  const occurrences = String(record.occurrences || '').split(';').map(pair => {
    const [start, end] = pair.split('_'); return { start, end };
  }).filter(o => Number.isFinite(Date.parse(o.start)) && Number.isFinite(Date.parse(o.end)) && Date.parse(o.end) >= Date.parse(o.start));
  return {
    id: `paris-${record.id}`, source: 'paris-data', sourceId: String(record.id),
    title: { fr: record.title }, description: { fr: record.lead_text || '' },
    start: record.date_start, end: record.date_end, occurrences,
    dateDescription: record.date_description?.replace(/<[^>]*>/g, ' ').slice(0, 1500) || '',
    venue: record.address_name || '', address: [record.address_street, record.address_zipcode, record.address_city].filter(Boolean).join(', '),
    lat: record.lat_lon?.lat ?? null, lng: record.lat_lon?.lon ?? null,
    url: /^https:\/\//.test(record.url || '') ? record.url : SOURCE_URL,
    price: record.price_type || '', sourceUpdatedAt: record.updated_at || null,
    fetchedAt: now.toISOString(), status: record.status === 'cancelled' || record.cancelled === true ? 'cancelled' : 'published', placeId: null,
    // An event's location is not silently treated as a verified catalogue match.
    relationship: 'unmatched', sourceUrl: SOURCE_URL,
  };
}

export async function fetchParisEvents(fetcher = fetch) {
  const url = new URL('https://parisdata.opendatasoft.com/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/records');
  url.searchParams.set('limit', '50');
  url.searchParams.set('where', "date_end >= now() AND (search(title, 'café') OR search(title, 'lecture') OR search(title, 'littéraire'))");
  url.searchParams.set('order_by', 'date_start ASC');
  const response = await fetcher(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Paris Data HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.results)) throw new Error('Unexpected Paris Data response');
  return data.results.map(record => normalizeEvent(record)).filter(Boolean);
}
