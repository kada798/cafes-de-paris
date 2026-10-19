import { translator, localized, LANGS } from './locales/messages.mjs';
import { esc, icon, eventText, eventLanguage } from './components/ui.mjs';
import { homePage } from './pages/home.mjs';
import { explorePage, POLICY_KEYS } from './pages/explore.mjs';
import { discoverPage } from './pages/discover.mjs';
import { detailPage, missing } from './pages/detail.mjs';
import { SCENARIOS } from '/shared/match.mjs';
import { parisLocalInput, parseParisLocal } from '/shared/time.mjs';
import { MAP_TILE_URL, MAP_ATTRIBUTION } from './services/map-config.mjs';
import { getCatalog, searchPlaces, geocode, translateEvents } from './services/api.mjs';
import { readingDetail } from './pages/library.mjs';
import { libraryMetrics, recordReading, liked } from './services/library.mjs';
import { BASE_PATH, appPathname, localUrl } from './services/runtime.mjs';

const defaults = () => ({
  requirements: {},
  maxMinutes: 20,
  stayMinutes: 120,
  group: 1,
  mode: 'walking',
  kind: '',
  text: '',
  includeDemo: false,
});
let saved;
try {
  saved = JSON.parse(sessionStorage.getItem('cafes-search') || 'null');
} catch {
  /* optional browser storage */
}
const state = {
  query: { ...defaults(), ...saved?.query },
  scenario: saved?.scenario || 'custom',
  originLabel: saved?.originLabel || '',
  departureLocal: saved?.departureLocal || '',
  results: null,
  searching: false,
  view: 'list',
  scroll: 0,
};
let data,
  mapInstance,
  markerLayer,
  originMarker,
  currentRoute = '',
  searchSequence = 0;
const app = document.querySelector('#app');
let translationObserver,
  translationQueue = Promise.resolve();
const translating = new Set();
const readingViews = new Set();
function updateLibraryMetrics(metrics) {
  data.libraryMetrics = { ...data.libraryMetrics, ...metrics };
  document.querySelectorAll('[data-stat-id]').forEach((el) => {
    const m = data.libraryMetrics[el.dataset.statId];
    if (m) el.textContent = Number(m[el.dataset.statKind] || 0).toLocaleString(language());
  });
  document
    .querySelectorAll('[data-stats-status]')
    .forEach((el) => (el.textContent = context().t('statsNote')));
  const sort = new URLSearchParams(location.search).get('sort');
  const grid = document.querySelector('#reading-library .reading-grid');
  if (grid && ['views', 'clicks', 'likes', 'active7d'].includes(sort)) {
    [...grid.children]
      .sort(
        (a, b) =>
          Number(data.libraryMetrics[b.dataset.readingCard]?.[sort] || 0) -
          Number(data.libraryMetrics[a.dataset.readingCard]?.[sort] || 0)
      )
      .forEach((card) => grid.append(card));
  }
}
async function recordLibrary(id, kind, active) {
  const result = await recordReading(id, kind, active);
  updateLibraryMetrics(result.metrics);
}
function requestTranslation(id, lang, full = false) {
  const event = data.events.find((e) => e.id === id);
  const status = event?.translationStatus?.[lang];
  const key = `${lang}:${id}:${full}`;
  if (
    !event ||
    lang === 'fr' ||
    translating.has(key) ||
    status?.status === 'failed' ||
    (status?.status === 'ready' && (!full || status.full))
  )
    return;
  translating.add(key);
  translationQueue = translationQueue
    .catch(() => {})
    .then(async () => {
      const latest = event.translationStatus?.[lang];
      if (latest?.status === 'ready' && (!full || latest.full)) {
        translating.delete(key);
        return;
      }
      try {
        const response = await translateEvents([id], lang, { full });
        const updated = response.events.find((e) => e.id === id);
        if (!updated) throw new Error('Translation missing');
        // Merge each language independently when visitors switch languages mid-request.
        for (const field of ['title', 'description'])
          event[field] = {
            ...event[field],
            [lang]: updated[field]?.[lang] || event[field]?.[lang],
          };
        event.detailsTranslations = {
          ...event.detailsTranslations,
          [lang]: updated.detailsTranslations?.[lang],
        };
        event.translationStatus = {
          ...event.translationStatus,
          [lang]: updated.translationStatus?.[lang],
        };
      } catch {
        event.translationStatus = {
          ...event.translationStatus,
          [lang]: { status: 'failed', code: 'unavailable' },
        };
      } finally {
        translating.delete(key);
      }
      if (language() !== lang) return;
      if (appPathname().split('/')[2] === 'events' && appPathname().split('/')[3] === id) {
        const y = scrollY;
        render();
        scrollTo(0, y);
      } else {
        const c = context();
        document.querySelectorAll('[data-event-id]').forEach((card) => {
          if (card.dataset.eventId !== id) return;
          card.querySelector('[data-event-title]').textContent = eventText(event, 'title', c);
          card.querySelector('[data-event-language]').innerHTML = eventLanguage(event, c);
        });
      }
    });
}
function activateTranslations(page, id, lang) {
  translationObserver?.disconnect();
  if (lang === 'fr') return;
  if (page === 'events' && id) requestTranslation(id, lang, true);
  translationObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          requestTranslation(entry.target.dataset.eventId, lang);
          translationObserver.unobserve(entry.target);
        }
    },
    { rootMargin: '80px' }
  );
  document.querySelectorAll('[data-event-id]').forEach((card) => translationObserver.observe(card));
}

function language() {
  return LANGS.includes(appPathname().split('/')[1]) ? appPathname().split('/')[1] : 'fr';
}
function context() {
  const lang = language();
  return {
    lang,
    t: translator(lang),
    l: (value) => localized(value, lang),
    path: (page) => `${BASE_PATH}/${lang}/${page}`,
    state,
    data,
  };
}
function persist() {
  try {
    sessionStorage.setItem(
      'cafes-search',
      JSON.stringify({
        query: state.query,
        scenario: state.scenario,
        originLabel: state.originLabel,
        departureLocal: state.departureLocal,
      })
    );
  } catch {
    /* browsing without storage works */
  }
}
function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('visible'), 4500);
}
function navigate(url, restore = false) {
  if (appPathname().split('/')[2] === 'map') state.scroll = window.scrollY;
  history.pushState({}, '', url);
  render();
  if (restore) window.scrollTo({ top: state.scroll });
  else window.scrollTo({ top: 0 });
}
function readInputs() {
  const form = document.querySelector('#search-form');
  if (!form) return true;
  const fields = new FormData(form);
  const departureLocal = fields.get('departure') || '';
  const departure = departureLocal ? parseParisLocal(departureLocal) : null;
  if (departureLocal && !departure) {
    toast(context().t('badDate'));
    return false;
  }
  state.departureLocal = departureLocal;
  const label = fields.get('originLabel') || '';
  if (label !== state.originLabel) state.query.origin = null;
  state.originLabel = label;
  state.query = {
    ...state.query,
    departure,
    mode: fields.get('mode'),
    maxMinutes: Number(fields.get('maxMinutes')),
    stayMinutes: Number(fields.get('stayMinutes')),
    group: Number(fields.get('group')),
    budget: Number(fields.get('budget')) || null,
    text: fields.get('text') || '',
    kind: fields.get('kind') || '',
    includeDemo: fields.get('includeDemo') === 'on',
    requirements: Object.fromEntries(
      POLICY_KEYS.map((key) => [key, fields.get(`req-${key}`)]).filter(
        ([, value]) => value !== 'ignore'
      )
    ),
  };
  persist();
  return true;
}
async function search() {
  if (!readInputs()) return;
  if (state.query.origin && !state.query.departure) {
    state.departureLocal = parisLocalInput();
    state.query.departure = parseParisLocal(state.departureLocal);
  }
  const sequence = ++searchSequence;
  state.searching = true;
  const button = document.querySelector('#search-form button[type="submit"]');
  if (button) {
    button.disabled = true;
    button.textContent = context().t('searching');
  }
  try {
    const result = await searchPlaces(state.query);
    if (sequence !== searchSequence) return;
    state.results = result.results;
    state.query = result.query;
    persist();
  } catch {
    if (sequence === searchSequence) toast(context().t('error'));
  } finally {
    if (sequence === searchSequence) {
      state.searching = false;
      if (appPathname().split('/')[2] === 'map') {
        const top = scrollY;
        render();
        scrollTo(0, top);
      }
    }
  }
}

function render() {
  const c = context(),
    { t, path, lang } = c;
  const parts = appPathname().split('/').filter(Boolean),
    page = parts[1] || 'home',
    id = parts[2];
  const routeKey = parts.slice(1).join('/') + location.search;
  if (page === 'map' && routeKey !== currentRoute) {
    const params = new URLSearchParams(location.search);
    if (params.has('scenario')) {
      const s = params.get('scenario');
      if (SCENARIOS[s]) {
        state.scenario = s;
        state.query.requirements = { ...SCENARIOS[s] };
        state.results = null;
      }
    }
    state.query.type = params.get('type') || '';
    state.query.ids = params.get('ids')?.split(',') || [];
    currentRoute = routeKey;
  }
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
  document.title = `${t(['places', 'articles', 'events', 'reading'].includes(page) && id ? (page === 'places' ? 'details' : ['articles', 'reading'].includes(page) ? 'culture' : 'events') : page)} · Les Cafés de Paris`;
  const nav = ['home', 'culture', 'types', 'gallery', 'map', 'about'];
  const active = ['places'].includes(page)
    ? 'map'
    : ['articles', 'reading'].includes(page)
      ? 'culture'
      : page;
  const html =
    page === 'reading' && id
      ? readingDetail(id, c)
      : page === 'home'
        ? homePage(c)
        : page === 'map'
          ? explorePage(c)
          : id && ['places', 'articles', 'events'].includes(page)
            ? detailPage(page, id, c)
            : ['culture', 'types', 'gallery', 'events', 'about'].includes(page)
              ? discoverPage(page, c)
              : missing(c);
  app.innerHTML = `<header class="site-header"><div class="nav-wrap"><a href="${path('')}" class="brand"><span class="brand-mark">${icon('cup')}</span><span>Les Cafés<span class="brand-line">DE PARIS</span></span></a><nav id="main-nav" aria-label="Navigation">${nav.map((n) => `<a href="${path(n === 'home' ? '' : n)}" class="${active === n ? 'active' : ''}" ${active === n ? 'aria-current="page"' : ''}>${t(n)}</a>`).join('')}</nav><div class="header-tools"><div class="language-switch" aria-label="Language">${LANGS.map((l) => `<a href="${BASE_PATH}/${l}/${parts.slice(1).join('/')}${location.search}" lang="${l}" data-language="${l}" class="${lang === l ? 'active' : ''}" aria-label="${{ fr: 'Français', en: 'English', zh: '中文' }[l]}">${{ fr: 'FR', en: 'EN', zh: '中文' }[l]}</a>`).join('')}</div><button class="menu-button icon-button" data-action="menu" aria-label="Menu" aria-expanded="false" aria-controls="main-nav">${icon('menu')}</button></div></div></header>${data.snapshotAt ? `<div class="snapshot-note">${t('snapshotNotice')} ${new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(data.snapshotAt))}</div>` : ''}<main id="main" class="${page === 'map' ? `explore-page view-${state.view}` : ''}">${html}</main><footer class="site-footer"><div class="wrap footer-main"><a class="brand" href="${path('')}"><span class="brand-mark">${icon('cup')}</span><span>Les Cafés<span class="brand-line">DE PARIS</span></span></a><p>${t('footerLine')}</p><div><a href="${path('events')}">${t('events')}</a><a href="${path('about')}">${t('method')}</a><a href="https://github.com/kada798/cafes-de-paris" target="_blank" rel="noopener noreferrer">GitHub ${icon('external')}</a></div></div><div class="wrap footer-bottom"><span>© ${new Date().getFullYear()} Les Cafés de Paris</span><span>${t('footerMade')}</span></div></footer>`;
  if (page === 'map') {
    initMap(c);
    if (
      !state.results &&
      (Object.keys(state.query.requirements).length || state.query.type || state.query.ids?.length)
    )
      search();
  }
  activateTranslations(page, id, lang);
  if (page === 'reading' && id) {
    const button = document.querySelector('[data-action="like-reading"]');
    button?.setAttribute('aria-pressed', String(liked(id)));
    if (!readingViews.has(id)) {
      readingViews.add(id);
      recordLibrary(id, 'view').catch(() => {});
    }
  }
}

function initMap(c) {
  if (!window.L) return;
  mapInstance = L.map('map', { scrollWheelZoom: false, zoomControl: true }).setView(
    [48.857, 2.345],
    13
  );
  L.tileLayer(MAP_TILE_URL, { attribution: MAP_ATTRIBUTION, maxZoom: 19 }).addTo(mapInstance);
  markerLayer = L.layerGroup().addTo(mapInstance);
  const places = (state.results || data.places).filter(
    (p) =>
      (state.query.includeDemo || !p.demo) &&
      p.match?.status !== 'excluded' &&
      p.availability?.status !== 'closed'
  );
  const markers = [];
  for (const [i, p] of places.entries()) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const marker = L.marker([p.lat, p.lng], {
      icon: L.divIcon({
        html: `<span><b>${i + 1}</b></span>`,
        className: `venue-pin ${p.kind === 'library' ? 'library-pin' : ''}`,
        iconSize: [30, 36],
        iconAnchor: [15, 36],
      }),
    }).addTo(markerLayer);
    marker.bindPopup(
      `<strong>${esc(p.name)}</strong><br><a href="${c.path(`places/${p.id}`)}">${esc(c.t('details'))} →</a>`
    );
    marker.on('click', () => {
      document
        .querySelectorAll('[data-place-card]')
        .forEach((card) => card.classList.toggle('highlight', card.dataset.placeCard === p.id));
    });
    markers.push(marker);
    const geometry = p.route?.geometry || p.route?.knownAlternative?.geometry;
    if (geometry)
      L.geoJSON(geometry, { style: { color: '#244437', weight: 3, opacity: 0.5 } }).addTo(
        markerLayer
      );
  }
  if (state.query.origin) setOriginMarker(state.query.origin);
  if (markers.length)
    mapInstance.fitBounds(L.featureGroup(markers).getBounds().pad(0.15), { maxZoom: 14 });
  mapInstance.on('click', (event) => {
    const lat = Number(event.latlng.lat.toFixed(6)),
      lng = Number(event.latlng.lng.toFixed(6));
    setOrigin({ lat, lng }, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    toast(c.t('originSet'));
  });
  requestAnimationFrame(() => mapInstance?.invalidateSize());
}
function setOriginMarker(origin) {
  if (!mapInstance) return;
  if (originMarker) {
    try {
      mapInstance.removeLayer(originMarker);
    } catch {
      /* previous map */
    }
  }
  originMarker = L.circleMarker([origin.lat, origin.lng], {
    radius: 8,
    color: '#fff',
    fillColor: '#a95a43',
    fillOpacity: 1,
    weight: 3,
  }).addTo(mapInstance);
}
function setOrigin(origin, label) {
  readInputs();
  state.query.origin = origin;
  state.originLabel = label;
  persist();
  const input = document.querySelector('#origin');
  if (input) input.value = label;
  setOriginMarker(origin);
}

document.addEventListener('click', async (event) => {
  const outgoing = event.target.closest('[data-reading-outbound]');
  if (outgoing) recordLibrary(outgoing.dataset.readingOutbound, 'click').catch(() => {});
  const link = event.target.closest('a');
  if (
    link &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.button === 0 &&
    link.target !== '_blank' &&
    !link.hasAttribute('download')
  ) {
    const url = new URL(link.href);
    if (url.origin === location.origin && !url.hash) {
      event.preventDefault();
      readInputs();
      navigate(url.pathname + url.search, link.hasAttribute('data-back-results'));
      return;
    }
  }
  const scenario = event.target.closest('[data-scenario]');
  if (scenario) {
    readInputs();
    state.scenario = scenario.dataset.scenario;
    state.query.requirements = { ...SCENARIOS[state.scenario] };
    persist();
    state.results = null;
    const y = scrollY;
    render();
    scrollTo(0, y);
    return;
  }
  const view = event.target.closest('[data-view]');
  if (view) {
    readInputs();
    state.view = view.dataset.view;
    document.querySelector('#main').className = `explore-page view-${state.view}`;
    document
      .querySelectorAll('[data-view]')
      .forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
    requestAnimationFrame(() => mapInstance?.invalidateSize());
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'like-reading') {
    const button = event.target.closest('button'),
      id = button.dataset.reading;
    button.disabled = true;
    try {
      const active = button.getAttribute('aria-pressed') !== 'true';
      await recordLibrary(id, 'like', active);
      button.setAttribute('aria-pressed', String(active));
    } catch {
      toast(context().t('statsUnavailable'));
    } finally {
      button.disabled = false;
    }
  }
  if (action === 'retry-translation') {
    const id = event.target.closest('[data-event]').dataset.event;
    const item = data.events.find((e) => e.id === id);
    if (item?.translationStatus) delete item.translationStatus[language()];
    render();
  }
  if (action === 'menu') {
    const button = event.target.closest('button');
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', !expanded);
    document.querySelector('#main-nav').classList.toggle('open', !expanded);
  }
  if (action === 'reset') {
    ++searchSequence;
    state.query = defaults();
    state.scenario = 'custom';
    state.originLabel = '';
    state.departureLocal = '';
    state.results = null;
    state.searching = false;
    currentRoute = '';
    persist();
    history.replaceState({}, '', context().path('map'));
    render();
  }
  if (action === 'clear-type') {
    state.query.type = '';
    history.replaceState({}, '', context().path('map'));
    currentRoute = 'map';
    search();
  }
  if (action === 'locate') {
    if (!navigator.geolocation) return toast(context().t('error'));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
        setOrigin(origin, `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`);
        mapInstance?.setView([origin.lat, origin.lng], 14);
        toast(context().t('originSet'));
      },
      () => toast(context().t('error')),
      { timeout: 10000 }
    );
  }
  if (action === 'geocode') {
    const q = document.querySelector('#origin')?.value || '';
    if (q.length < 3) return toast(context().t('noAddress'));
    try {
      const { features } = await geocode(q);
      const box = document.querySelector('#address-results');
      box.innerHTML = features
        .map((f, i) => `<button type="button" data-address="${i}">${esc(f.label)}</button>`)
        .join('');
      if (!features.length) toast(context().t('noAddress'));
      box.onclick = (ev) => {
        const button = ev.target.closest('[data-address]');
        if (!button) return;
        const f = features[Number(button.dataset.address)];
        setOrigin({ lat: f.coordinates[1], lng: f.coordinates[0] }, f.label);
        box.innerHTML = '';
        mapInstance?.setView([f.coordinates[1], f.coordinates[0]], 14);
      };
    } catch {
      toast(context().t('error'));
    }
  }
});
document.addEventListener('submit', (event) => {
  if (event.target.id === 'search-form') {
    event.preventDefault();
    search();
  }
  if (event.target.id === 'event-filter') {
    event.preventDefault();
    const params = new URLSearchParams(new FormData(event.target));
    navigate(`${context().path('events')}?${params}`);
  }
  if (event.target.id === 'reading-filter') {
    event.preventDefault();
    navigate(`${context().path('culture')}?${new URLSearchParams(new FormData(event.target))}`);
  }
});
window.addEventListener('popstate', () => {
  render();
  if (appPathname().split('/')[2] === 'map') scrollTo(0, state.scroll);
});

try {
  data = await getCatalog();
  if (!LANGS.includes(appPathname().split('/')[1])) history.replaceState({}, '', localUrl('/fr/'));
  render();
  libraryMetrics()
    .then((result) => updateLibraryMetrics(result.metrics))
    .catch(() => {});
} catch (error) {
  console.error('Application startup failed:', error);
  app.innerHTML = `<div class="empty-state"><h1>Les Cafés de Paris</h1><p>Le serveur est indisponible. / Server unavailable. / 服务暂不可用。</p><button class="button primary" id="retry">Réessayer / Retry / 重试</button></div>`;
  document.querySelector('#retry').onclick = () => location.reload();
}
