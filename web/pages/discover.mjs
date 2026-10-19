import { esc, safeUrl, icon, placeCard, articleCard, eventCard, IMG } from '../components/ui.mjs';
import { culturePage } from './library.mjs';
export function discoverPage(page, c) {
  const { t, l, path, data } = c;
  if (page === 'culture') return culturePage(c);
  if (page === 'types') {
    const taxonomy = data.taxonomy || { categories: [], sources: [] };
    return `<section class="page-heading wrap"><div class="eyebrow">TYPES DE CAFÉS</div><h1>${t('typesTitle')}</h1><p>${t('classificationIntro')}</p></section><section class="wrap"><div class="notice">${icon('shield')} ${t('typeHint')}</div><div class="taxonomy-method prose"><h2>${t('classificationMethod')}</h2><p>${t('classificationAxes')}</p><p>${t('inseeNote')}</p><ul class="source-list">${taxonomy.sources.map((s) => `<li><a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ${icon('external')}</a></li>`).join('')}</ul></div>${taxonomy.categories
      .map((category, i) => {
        const places = data.places.filter(
          (p) => !p.demo && p.kind === 'cafe' && (p.categoryTags || [p.type]).includes(category.id)
        );
        return `<section class="type-section"><div class="type-title"><span>0${i + 1}</span><h2>${esc(l(category.name))} <small>${places.length}</small></h2><a class="text-link" href="${path('map')}?type=${category.id}">${t('allPlaces')} ${icon('arrow')}</a></div><p>${esc(l(category.definition))}</p><p class="small">${t('classificationBasis')}: ${category.sourceIds
          .map((id) => taxonomy.sources.find((s) => s.id === id))
          .filter(Boolean)
          .map(
            (s) =>
              `<a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a>`
          )
          .join(' · ')}</p><div class="place-grid">${
          places
            .slice(0, 3)
            .map((p) => placeCard(p, c))
            .join('') || `<p class="muted-text">${t('noVerifiedCategory')}</p>`
        }</div></section>`;
      })
      .join('')}</section>`;
  }
  if (page === 'gallery')
    return `<section class="page-heading wrap"><div class="eyebrow">GALERIE</div><h1>${t('galleryTitle')}</h1><p>${t('galleryIntro')}</p></section><section class="wrap gallery-grid">${data.places
      .filter((p) => !p.demo)
      .map(
        (p, i) =>
          `<figure class="gallery-item ${i % 3 === 0 ? 'tall' : ''}"><a href="${path(`places/${p.id}`)}"><img src="${safeUrl(p.image || IMG.cafe)}" alt="${esc(l(p.imageCaption) || t('photoCredit'))}" loading="lazy"><figcaption><span>${esc(p.area)}</span><h2>${esc(p.name)}</h2><small>${t('photoCredit')}</small>${icon('arrow')}</figcaption></a></figure>`
      )
      .join('')}</section>`;
  if (page === 'events') {
    const params = new URLSearchParams(location.search),
      from = params.get('from') || '',
      to = params.get('to') || '';
    const events = data.events.filter(
      (e) => (!from || e.end.slice(0, 10) >= from) && (!to || e.start.slice(0, 10) <= to)
    );
    const last = data.syncRuns[0];
    return `<section class="page-heading wrap"><div class="eyebrow">AGENDA</div><h1>${t('eventsTitle')}</h1><p>${t('eventsIntro')}</p></section><section class="wrap section no-top"><form id="event-filter" class="event-filter"><label class="field">${t('from')}<input type="date" name="from" value="${esc(from)}"></label><label class="field">${t('to')}<input type="date" name="to" value="${esc(to)}"></label><button class="button primary">${t('search')}</button><a class="text-link" href="${path('events')}">${t('reset')}</a></form>${last ? `<p class="small muted-text">${t('syncStatus')} · ${esc(last.finished_at || last.started_at)} · ${t(last.status === 'success' ? 'success' : 'failed')}</p>` : ''}<div class="event-list">${events.length ? events.map((e) => eventCard(e, c)).join('') : `<div class="empty-state"><h2>${t('noEvents')}</h2><p>${t('noEventsHint')}</p></div>`}</div></section>`;
  }
  if (page === 'about')
    return `<section class="page-heading wrap"><div class="eyebrow">À PROPOS</div><h1>${t('aboutTitle')}</h1><p>${t('aboutIntro')}</p></section><section class="about-layout wrap"><div class="about-photo"><img src="${IMG.cafe}" alt="${t('photoCredit')}"><small>${t('photoCredit')}</small></div><div class="prose">${[
      ['editorial', 'aboutStory'],
      ['matchingMethod', 'aboutMethod'],
      ['dataMethod', 'aboutData'],
      ['privacy', 'aboutPrivacy'],
    ]
      .map(([title, body]) => `<h2>${t(title)}</h2><p>${t(body)}</p>`)
      .join(
        ''
      )}<h2>${t('contact')}</h2><a class="text-link" href="https://github.com/kada798/cafes-de-paris" target="_blank" rel="noopener noreferrer">${t('sourceCode')} ${icon('external')}</a></div></section>`;
  return '';
}
