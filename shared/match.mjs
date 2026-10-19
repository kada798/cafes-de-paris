export const SCENARIOS = {
  work: { laptop: 'must', power: 'prefer', wifi: 'prefer' },
  friends: { conversation: 'prefer' },
  date: { terrace: 'prefer', reservation: 'prefer' },
  business: { wifi: 'prefer', reservation: 'prefer', quiet: 'prefer' },
  reading: { quiet: 'prefer' },
  custom: {},
};

export function parisParts(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const key = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    key,
    weekday: new Date(`${key}T12:00:00Z`).getUTCDay() || 7,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function intervalsFor(place, parts) {
  if (Object.hasOwn(place.exceptions || {}, parts.key)) return place.exceptions[parts.key];
  return place.hours?.[String(parts.weekday)] ?? null;
}
const toMinutes = (value) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};

export function coversStay(place, start, durationMinutes) {
  if (!place.hours && !place.exceptions) return 'unknown';
  // Sample every minute, including the final instant before departure. Handles
  // split hours, midnight, Paris DST, and exceptional closures without offsets.
  for (let n = 0; n <= durationMinutes; n++) {
    const timestamp = new Date(
      new Date(start).getTime() + n * 60000 - (n === durationMinutes ? 1 : 0)
    );
    const parts = parisParts(timestamp);
    if (!parts) return 'unknown';
    const today = intervalsFor(place, parts);
    const yesterday = parisParts(new Date(timestamp.getTime() - (parts.minute + 1) * 60000));
    const previous = intervalsFor(place, yesterday);
    const inside =
      today?.some(([a, b]) => {
        const from = toMinutes(a),
          until = toMinutes(b);
        return until > from ? parts.minute >= from && parts.minute < until : parts.minute >= from;
      }) || previous?.some(([a, b]) => toMinutes(b) < toMinutes(a) && parts.minute < toMinutes(b));
    if (!inside) {
      if (today == null) return 'unknown';
      return 'no';
    }
  }
  return 'yes';
}

export function policyMatch(place, key) {
  const value = place.policies?.[key] ?? 'unknown';
  if (value === 'yes' || value === 'inside') return 'yes';
  if (value === 'no') return 'no';
  return value === 'limited' || value === 'terrace' ? 'limited' : 'unknown';
}

export function matchPlace(place, query = {}, route = null) {
  const checks = [];
  if (place.availability?.status === 'closed')
    checks.push({ key: 'closed', state: 'no', priority: 'must' });
  let score = 0;
  for (const [key, priority] of Object.entries(query.requirements || {})) {
    if (!['must', 'prefer'].includes(priority)) continue;
    const state = policyMatch(place, key);
    checks.push({ key, state, priority });
    if (state === 'yes') score += priority === 'must' ? 3 : 1;
  }
  if (query.group > 1) {
    checks.push({
      key: 'group',
      priority: 'must',
      state: place.maxGroup == null ? 'unknown' : place.maxGroup >= query.group ? 'yes' : 'no',
    });
  }
  if (query.budget) {
    checks.push({
      key: 'budget',
      priority: 'must',
      state: place.minSpend == null ? 'unknown' : place.minSpend <= query.budget ? 'yes' : 'no',
    });
  }
  if (query.departure) {
    if (!query.origin || !route || route.status !== 'ok') {
      checks.push({ key: 'hours', state: 'unknown', priority: 'must' });
    } else {
      const arrival = new Date(
        new Date(query.departure).getTime() + (route?.durationSeconds || 0) * 1000
      );
      checks.push({
        key: 'hours',
        state: coversStay(place, arrival, query.stayMinutes || 120),
        priority: 'must',
      });
    }
    if (place.maxStayMinutes != null)
      checks.push({
        key: 'stay',
        state: query.stayMinutes > place.maxStayMinutes ? 'no' : 'yes',
        priority: 'must',
      });
  }
  if (query.origin)
    checks.push({
      key: 'route',
      priority: 'must',
      state:
        route?.status === 'ok'
          ? route.durationSeconds <= query.maxMinutes * 60
            ? 'yes'
            : 'no'
          : route?.status === 'no_route'
            ? 'no'
            : 'unknown',
    });
  const hard = checks.filter((c) => c.priority === 'must');
  const status = hard.some((c) => c.state === 'no')
    ? 'excluded'
    : hard.some((c) => c.state !== 'yes')
      ? 'check'
      : 'match';
  return { ...place, match: { status, checks, score }, route };
}

export function evaluatePlaces(places, query = {}, routes = {}) {
  const needle = (query.text || '').toLocaleLowerCase();
  return places
    .filter(
      (p) =>
        (!query.kind || p.kind === query.kind) &&
        (!query.type || (p.categoryTags || [p.type]).includes(query.type)) &&
        (!query.ids?.length || query.ids.includes(p.id)) &&
        (query.includeDemo || !p.demo) &&
        (!needle || `${p.name} ${p.address} ${p.area}`.toLocaleLowerCase().includes(needle))
    )
    .map((p) => matchPlace(p, query, routes[p.id]))
    .sort(
      (a, b) =>
        ({ match: 0, check: 1, excluded: 2 })[a.match.status] -
          { match: 0, check: 1, excluded: 2 }[b.match.status] ||
        b.match.score - a.match.score ||
        (a.route?.durationSeconds ?? Infinity) - (b.route?.durationSeconds ?? Infinity) ||
        a.name.localeCompare(b.name)
    );
}

export function currentCrowding(observation, now = Date.now()) {
  if (
    !observation ||
    !Number.isFinite(Date.parse(observation.observedAt)) ||
    !Number.isFinite(Date.parse(observation.validUntil))
  )
    return { status: 'unknown' };
  if (Date.parse(observation.observedAt) > now || Date.parse(observation.validUntil) <= now)
    return { ...observation, status: 'expired' };
  return { ...observation, status: 'current' };
}
