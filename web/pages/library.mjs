import { esc, safeUrl, icon, articleCard, placeCard } from '../components/ui.mjs';
import { THEMES, editorialScore, selectWeekly } from '/shared/library.mjs';
function stats(source, c) {
  const metrics = c.data.libraryMetrics?.[source.id];
  return `<div class="reading-stats" aria-label="${c.t('siteStats')}">${['views', 'clicks', 'likes', 'active7d'].map((key) => `<span>${c.t(`stat_${key}`)} <strong data-stat-id="${esc(source.id)}" data-stat-kind="${key}">${metrics ? Number(metrics[key] || 0).toLocaleString(c.lang) : '—'}</strong></span>`).join('')}</div>`;
}
export function readingCard(source, c) {
  return `<article class="reading-card" data-reading-card="${esc(source.id)}"><div class="card-meta">${esc(source.publisher)} · ${c.t(`theme_${source.theme}`)}</div><span class="badge muted">${c.t(`kind_${source.kind}`)} · ${source.language.toUpperCase()}</span><h3><a href="${c.path(`reading/${source.id}`)}">${esc(c.l(source.title))}</a></h3><p>${esc(c.l(source.summary))}</p><p class="small muted-text">${c.t('editorScore')} ${editorialScore(source)}/100 · ${c.t('checkedDate')} ${esc(source.checkedAt)}</p>${stats(source, c)}<div class="reading-actions"><a class="text-link" href="${c.path(`reading/${source.id}`)}">${c.t('selectionReason')} ${icon('arrow')}</a><a data-reading-outbound="${esc(source.id)}" href="${safeUrl(source.url)}" target="_blank" rel="noopener noreferrer">${c.t('readSource')} ${icon('external')}</a></div></article>`;
}
export function weeklySection(c, compact = false) {
  const weekly = selectWeekly(c.data.reading || [], c.data.libraryMetrics || {});
  return `<section class="wrap section weekly-section"><div class="section-heading row"><div><div class="eyebrow">LA SÉLECTION DE LA SEMAINE</div><h2>${c.t('weeklyPicks')}</h2><p>${weekly.start} — ${weekly.end} · ${c.t('parisTime')}</p></div><a class="text-link" href="${c.path('culture')}#selection-method">${c.t('selectionMethod')} ${icon('arrow')}</a></div><p class="small muted-text">${c.t('weeklyNote')}</p><div class="reading-grid">${
    weekly.sources
      .slice(0, compact ? 2 : 4)
      .map((s) => readingCard(s, c))
      .join('') || `<p>${c.t('weeklyNeedsReview')}</p>`
  }</div></section>`;
}
export function culturePage(c) {
  const { t, path, data } = c;
  const params = new URLSearchParams(location.search),
    theme = params.get('theme') || '',
    sort = params.get('sort') || 'editorial';
  const sources = (data.reading || [])
    .filter((s) => !theme || s.theme === theme)
    .sort((a, b) =>
      sort === 'editorial'
        ? editorialScore(b) - editorialScore(a)
        : Number(data.libraryMetrics?.[b.id]?.[sort] || 0) -
          Number(data.libraryMetrics?.[a.id]?.[sort] || 0)
    );
  return `<section class="page-heading wrap"><div class="eyebrow">LE CARNET</div><h1>${t('cultureTitle')}</h1><p>${t('cultureIntro')}</p><div class="hero-actions"><a class="button primary" href="#reading-library">${t('readingLibrary')}</a><a class="text-link" href="#selection-method">${t('selectionMethod')}</a></div></section>${weeklySection(c)}<section id="reading-library" class="wrap section"><div class="section-heading"><h2>${t('readingLibrary')} <span class="small">${data.reading?.length || 0} ${t('readingLinks')}</span></h2><p>${t('libraryIntro')}</p></div><form id="reading-filter" class="event-filter"><label class="field">${t('readingTheme')}<select name="theme"><option value="">${t('allThemes')}</option>${THEMES.map((k) => `<option value="${k}" ${theme === k ? 'selected' : ''}>${t(`theme_${k}`)}</option>`).join('')}</select></label><label class="field">${t('sortBy')}<select name="sort">${['editorial', 'views', 'clicks', 'likes', 'active7d'].map((k) => `<option value="${k}" ${sort === k ? 'selected' : ''}>${t(k === 'editorial' ? 'editorScore' : `stat_${k}`)}</option>`).join('')}</select></label><button class="button primary">${t('search')}</button><a class="text-link" href="${path('culture')}">${t('reset')}</a></form><p class="small muted-text" data-stats-status>${t(data.libraryMetrics ? 'statsNote' : 'statsUnavailable')}</p><div class="reading-grid">${sources.map((s) => readingCard(s, c)).join('')}</div></section><section id="selection-method" class="wrap section prose"><h2>${t('selectionMethod')}</h2><p>${t('selectionFormula')}</p><p>${t('selectionDiversity')}</p><h3>${t('siteStats')}</h3><p>${t('statsDefinitions')}</p><p>${t('externalStatsNote')}</p><p>${t('privacyMetrics')}</p></section><section class="wrap section"><div class="section-heading"><h2>${t('ourStories')}</h2><p>${t('originalStoriesNote')}</p></div><div class="article-grid">${data.articles.map((a) => articleCard(a, c)).join('')}</div></section>`;
}
export function readingDetail(id, c) {
  const source = c.data.reading?.find((s) => s.id === id);
  if (!source) return `<section class="wrap page-heading"><h1>${c.t('notFound')}</h1></section>`;
  return `<section class="page-heading wrap"><a class="text-link" href="${c.path('culture')}">${icon('arrow', 'reverse')} ${c.t('culture')}</a><div class="eyebrow">${esc(source.publisher)} · ${c.t(`theme_${source.theme}`)}</div><h1>${esc(c.l(source.title))}</h1><p>${esc(c.l(source.summary))}</p><span class="badge muted">${c.t(`kind_${source.kind}`)} · ${source.language.toUpperCase()}</span></section><article class="prose article-body" data-reading-detail="${esc(id)}"><h2>${c.t('selectionReason')}</h2><p>${esc(c.l(source.editorial.reason))}</p><p>${c.t('editorScore')} ${editorialScore(source)}/100</p><div class="detail-box"><h2>${c.t('sourceRecord')}</h2><dl><dt>${c.t('publisher')}</dt><dd>${esc(source.publisher)}</dd><dt>${c.t('originalTitle')}</dt><dd>${esc(source.sourceTitle)}</dd><dt>${c.t('publicationDate')}</dt><dd>${esc(source.publishedAt || source.updatedAt || c.t('dateUnknown'))}</dd><dt>${c.t('checkedDate')}</dt><dd>${esc(source.checkedAt)}</dd></dl><a data-reading-outbound="${esc(id)}" class="button primary" href="${safeUrl(source.url)}" target="_blank" rel="noopener noreferrer">${c.t('readSource')} ${icon('external')}</a><p class="small">${c.t('sourceSummaryNote')}</p></div><h2>${c.t('siteStats')}</h2>${stats(source, c)}<p class="small muted-text" data-stats-status>${c.t(c.data.libraryMetrics ? 'statsNote' : 'statsUnavailable')}</p><button class="button outline" data-action="like-reading" data-reading="${esc(id)}" aria-pressed="false">♡ ${c.t('foundUseful')}</button><p class="small">${c.t('externalStatsNote')}</p><a class="text-link" href="${c.path('culture')}#selection-method">${c.t('selectionMethod')} ${icon('arrow')}</a></article>${
    source.placeIds?.length
      ? `<section class="wrap section"><h2>${c.t('relatedPlaces')}</h2><div class="place-grid">${c.data.places
          .filter((p) => source.placeIds.includes(p.id))
          .map((p) => placeCard(p, c))
          .join('')}</div></section>`
      : ''
  }`;
}
