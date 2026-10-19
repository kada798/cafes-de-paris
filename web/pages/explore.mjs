import { icon, esc, placeCard } from '../components/ui.mjs';
export const POLICY_KEYS = [
  'laptop',
  'power',
  'wifi',
  'pets',
  'decaf',
  'caffeineFree',
  'reservation',
  'quiet',
  'conversation',
  'terrace',
];
export function explorePage(c) {
  const { t, state } = c,
    q = state.query;
  const results = state.results || c.data.places.filter((p) => !p.demo);
  const candidates = results.filter(
    (p) => p.match?.status !== 'excluded' && p.availability?.status !== 'closed'
  );
  const excluded = results.filter(
    (p) => p.match?.status === 'excluded' || p.availability?.status === 'closed'
  );
  return `<section class="page-heading wrap"><div class="eyebrow">CARTE · PARIS</div><h1>${t('mapTitle')}</h1><p>${t('mapIntro')}</p></section>
    <div class="wrap"><div class="scenario-tabs" aria-label="${t('occasionTitle')}">${['custom', 'work', 'friends', 'date', 'business', 'reading'].map((s) => `<button class="scenario-tab ${state.scenario === s ? 'active' : ''}" data-scenario="${s}" aria-pressed="${state.scenario === s}">${icon(s)} ${t(s)}</button>`).join('')}</div>
    <form id="search-form" class="search-panel"><div class="search-top"><div class="field origin-field"><label for="origin">${t('origin')}</label><div class="input-action"><input id="origin" name="originLabel" placeholder="${t('originPlaceholder')}" value="${esc(state.originLabel || '')}" autocomplete="off"><button class="icon-button" type="button" data-action="geocode" aria-label="${t('searchAddress')}">${icon('search')}</button><button class="icon-button" type="button" data-action="locate" aria-label="${t('locate')}">${icon('pin')}</button></div><div id="address-results" class="address-results"></div></div>
    <div class="field"><label for="mode">${t('travel')}</label><select id="mode" name="mode">${['walking', 'transit', 'either'].map((v) => `<option value="${v}" ${q.mode === v ? 'selected' : ''}>${t(v)}</option>`).join('')}</select></div>
    <div class="field"><label for="maxMinutes">${t('limit')}</label><select id="maxMinutes" name="maxMinutes">${[10, 15, 20, 30, 45, 60].map((v) => `<option value="${v}" ${q.maxMinutes === v ? 'selected' : ''}>${v} ${t('min')}</option>`).join('')}</select></div>
    <div class="field"><label for="departure">${t('departure')}</label><input type="datetime-local" id="departure" name="departure" value="${esc(state.departureLocal || '')}"></div>
    <div class="field"><label for="stayMinutes">${t('stay')}</label><select id="stayMinutes" name="stayMinutes">${[30, 60, 120, 180, 240].map((v) => `<option value="${v}" ${q.stayMinutes === v ? 'selected' : ''}>${v} ${t('min')}</option>`).join('')}</select></div></div>
    <div class="search-bottom"><span class="small">${icon('pin')} ${t('originHint')}</span><button class="button primary" type="submit">${state.searching ? t('searching') : t('search')} ${icon('search')}</button></div></form>
    ${!c.data.capabilities.walking || !c.data.capabilities.transit ? `<div class="notice">${icon('shield')}<span>${t('routeUnavailable')}</span></div>` : ''}
    <div class="explore-layout"><aside class="filters-panel"><div class="filter-heading"><h2>${t('filters')}</h2><button class="text-button" data-action="reset">${t('reset')}</button></div>
    <label class="field"><span>${t('search')}</span><input form="search-form" name="text" value="${esc(q.text || '')}" placeholder="${t('cafe')} / ${t('library')}"></label>
    <label class="field"><span>${t('kind')}</span><select form="search-form" name="kind">${['', 'cafe', 'library', 'workspace'].map((v) => `<option value="${v}" ${q.kind === v ? 'selected' : ''}>${t(v || 'allKinds')}</option>`).join('')}</select></label>
    ${q.type ? `<div class="active-type">${t(q.type)}<button class="icon-button" data-action="clear-type" aria-label="${t('clearType')}">${icon('close')}</button></div>` : ''}
    <label class="field"><span>${t('people')}</span><input form="search-form" name="group" type="number" min="1" max="20" value="${q.group || 1}"></label>
    <label class="field"><span>${t('budget')}</span><input form="search-form" name="budget" type="number" min="1" max="200" value="${q.budget || ''}" placeholder="—"></label>
    <div class="policy-filters">${POLICY_KEYS.map((key) => `<label class="policy-row"><span>${t(key)}</span><select form="search-form" name="req-${key}" aria-label="${t(key)}">${['ignore', 'must', 'prefer'].map((v) => `<option value="${v}" ${(q.requirements[key] || 'ignore') === v ? 'selected' : ''}>${t(v)}</option>`).join('')}</select></label>`).join('')}</div>
    <label class="demo-control"><input form="search-form" type="checkbox" name="includeDemo" ${q.includeDemo ? 'checked' : ''}><span>${t('demoToggle')}</span></label><button class="button primary filter-submit" type="submit" form="search-form">${t('search')} ${icon('arrow')}</button></aside>
    <section class="results-panel"><div class="results-heading"><div><strong>${candidates.length}</strong> ${t('results')}</div><div class="view-toggle"><button data-view="list" class="${state.view === 'list' ? 'active' : ''}">${t('listView')}</button><button data-view="map" class="${state.view === 'map' ? 'active' : ''}">${t('mapView')}</button></div></div><div class="small result-note">${state.query.origin ? t('unknownStay') : t('noOrigin')}</div><div class="result-list">${candidates.length ? candidates.map((p) => placeCard(p, c, true)).join('') : `<div class="empty-state"><h3>${t('noResults')}</h3><p>${t('noResultsBody')}</p><button class="button outline" data-action="reset">${t('reset')}</button></div>`}</div>${excluded.length ? `<details class="excluded"><summary>${t('excluded')} (${excluded.length})</summary>${excluded.map((p) => placeCard(p, c, true)).join('')}</details>` : ''}</section>
    <div class="map-column"><div id="map" aria-label="${t('map')}" class="leaflet-map"></div><span class="map-caption">${t('mapOffline')}</span></div></div></div>`;
}
