import {
  esc,
  safeUrl,
  icon,
  IMG,
  placeCard,
  articleCard,
  eventCard,
  eventText,
  eventLanguage,
} from '../components/ui.mjs';
import { POLICY_KEYS } from './explore.mjs';
import { googleDirections } from '/shared/navigation.mjs';
export function detailPage(kind, id, c) {
  const { t, l, path, data, state } = c;
  if (kind === 'places') {
    const p = data.places.find((p) => p.id === id);
    if (!p) return missing(c);
    const result = state.results?.find((r) => r.id === id);
    const relatedEvents = data.events.filter(
      (e) => e.placeId === p.id || e.nearbyPlaceIds?.includes(p.id)
    );
    const destination = new URL(googleDirections(p, state.query));
    const sources = (p.sources || [])
      .map(
        (s) =>
          `<li><a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ${icon('external')}</a></li>`
      )
      .join('');
    return `<section class="wrap detail-top"><a class="text-link" href="${path('map')}" data-back-results>${icon('arrow', 'reverse')} ${t('backResults')}</a><div class="detail-title"><div><div class="eyebrow">${t(p.kind)} · ${esc(p.area)}</div><h1>${esc(p.name)}</h1><p>${esc(p.address)}</p></div><a class="button primary" href="${safeUrl(destination.href)}" target="_blank" rel="noopener noreferrer">${t('directions')} ${icon('external')}</a></div>${p.demo ? `<div class="notice demo-notice">${t('demo')} · ${esc(l(p.notes))}</div>` : ''}${p.availability?.status === 'closed' ? `<div class="notice warning">${t('closed')} · ${esc(l(p.availability.reason))}</div>` : ''}<div class="detail-hero"><img src="${safeUrl(p.image || IMG.cafe)}" alt="${t('photoCredit')}"></div><p class="photo-disclaimer">${t('illustrative')}</p></section>
    <section class="wrap detail-layout"><div><div class="prose"><h2>${t('practical')}</h2><p>${esc(l(p.description))}</p>${p.notes ? `<div class="editor-note"><strong>${t('note')}</strong><p>${esc(l(p.notes))}</p></div>` : ''}</div>
    ${result?.match.checks.length ? `<div class="detail-box"><h2>${t(result.match.status)}</h2><div class="check-grid">${result.match.checks.map((k) => `<div><span>${t(k.key === 'stay' ? 'stayRule' : k.key)}</span><strong class="state-${k.state}">${t(k.state)}</strong></div>`).join('')}</div></div>` : `<a class="button outline" href="${path('map')}?ids=${encodeURIComponent(p.id)}">${t('find')} ${icon('arrow')}</a>`}
    ${p.kind === 'cafe' ? `<div class="detail-box"><h2>${t('classificationBasis')}</h2><p>${(p.categoryTags || [p.type]).map((k) => t(k)).join(' · ')}</p>${p.classificationEvidence ? `<p><a href="${safeUrl(p.classificationEvidence.url)}" target="_blank" rel="noopener noreferrer">${esc(p.classificationEvidence.label)} ${icon('external')}</a></p>` : ''}<a class="text-link" href="${path('types')}">${t('classificationMethod')} ${icon('arrow')}</a></div>` : ''}
    <div class="detail-box"><h2>${t('policies')}</h2><div class="check-grid">${POLICY_KEYS.map(
      (key) => {
        const v = p.policies?.[key] || 'unknown';
        return `<div><span>${t(key)}</span><strong class="state-${v}">${t(v === 'terrace' ? 'terraceOnly' : v)}${p.evidence?.[key] ? ` <a href="${safeUrl(p.evidence[key].url)}" target="_blank" rel="noopener noreferrer" aria-label="${t('sources')}: ${t(key)}">${icon('external')}</a>` : ''}</strong></div>`;
      }
    ).join('')}</div></div>
    ${
      p.pricing || p.drinkOptions
        ? `<div class="detail-box"><h2>${t('pricing')}</h2>${
            p.pricing
              ? `<div class="check-grid">${[
                  ['firstHour', 'firstHour'],
                  ['nextHalfHour', 'nextHalfHour'],
                  ['day', 'dayPrice'],
                ]
                  .map(
                    ([field, label]) =>
                      `<div><span>${t(label)}</span><strong>${new Intl.NumberFormat(c.lang === 'zh' ? 'zh-CN' : c.lang, { style: 'currency', currency: p.pricing.currency || 'EUR' }).format(p.pricing[field])}</strong></div>`
                  )
                  .join('')}</div><p class="small">${esc(l(p.pricing.description))}</p>`
              : ''
          }${p.drinkOptions ? `<ul class="source-list">${p.drinkOptions.map((d) => `<li><a href="${safeUrl(d.source)}" target="_blank" rel="noopener noreferrer">${esc(l(d.name))} ${icon('external')}</a></li>`).join('')}</ul>` : ''}</div>`
        : ''
    }
    <div class="detail-box"><h2>${t('crowding')}</h2><p>${t(p.crowding?.status === 'expired' ? 'expired' : 'crowdUnknown')}</p><p class="small muted-text">${t('crowdBody')}</p><p class="small">${t('noGuarantee')}</p></div></div>
    <aside><div class="detail-box"><h2>${t('openHours')}</h2>${
      p.hours
        ? `<div class="hours-table">${Object.entries(p.hours)
            .map(
              ([day, ranges]) =>
                `<div><span>${new Intl.DateTimeFormat(c.lang === 'zh' ? 'zh-CN' : c.lang, { weekday: 'long', timeZone: 'UTC' }).format(new Date(`2026-10-${18 + Number(day)}T12:00:00Z`))}</span><span>${ranges.length ? ranges.map((r) => r.join('–')).join(', ') : '—'}</span></div>`
            )
            .join('')}</div>`
        : `<p>${t('unavailableHours')}</p>`
    }</div><div class="detail-box"><h2>${t('sources')}</h2><p class="small">${t('verified')} ${esc(p.verifiedAt || '—')}</p><ul class="source-list">${sources}</ul><a class="text-link" href="${path('about')}">${t('method')} ${icon('arrow')}</a></div></aside></section>
    <section class="section wrap"><div class="section-heading"><h2>${t('relatedStories')}</h2></div><div class="article-grid">${
      data.articles
        .filter((a) => a.placeIds?.includes(p.id))
        .map((a) => articleCard(a, c))
        .join('') ||
      `<a class="text-link" href="${path('culture')}">${t('allArticles')} ${icon('arrow')}</a>`
    }</div></section>${
      relatedEvents.length
        ? `<section class="section wrap"><h2>${t('upcoming')}</h2>${relatedEvents
            .slice(0, 5)
            .map(
              (e) =>
                `<p class="small muted-text">${t(e.placeId === p.id ? 'venueEvents' : 'nearbyEvents')}</p>${eventCard(e, c)}`
            )
            .join('')}</section>`
        : ''
    }`;
  }
  if (kind === 'articles') {
    const a = data.articles.find((a) => a.id === id);
    if (!a) return missing(c);
    return `<section class="wrap detail-top"><a class="text-link" href="${path('culture')}">${icon('arrow', 'reverse')} ${t('culture')}</a><div class="article-title"><div class="eyebrow">LE CARNET · ${c.lang.toUpperCase()}</div><h1>${esc(l(a.title))}</h1><p>${esc(l(a.excerpt))}</p></div><div class="detail-hero"><img src="${safeUrl(a.image || IMG.cafe)}" alt="${t('photoCredit')}"></div><p class="photo-disclaimer">${t('photoCredit')}</p></section><article class="prose article-body">${(l(a.body) || []).map((p) => `<p>${esc(p)}</p>`).join('')}<h2>${t('sources')}</h2><ul class="source-list">${(a.sources || []).map((s) => `<li><a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ${icon('external')}</a></li>`).join('')}</ul></article><section class="wrap section"><div class="section-heading row"><h2>${t('relatedPlaces')}</h2><a class="text-link" href="${path('map')}?ids=${encodeURIComponent(a.placeIds.join(','))}">${t('exploreThese')} ${icon('arrow')}</a></div><div class="place-grid">${data.places
      .filter((p) => a.placeIds.includes(p.id))
      .map((p) => placeCard(p, c))
      .join('')}</div></section>`;
  }
  if (kind === 'events') {
    const e = data.events.find((e) => e.id === id);
    if (!e) return missing(c);
    const format = (value) =>
      new Intl.DateTimeFormat(c.lang === 'zh' ? 'zh-CN' : c.lang, {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'Europe/Paris',
      }).format(new Date(value));
    return `<section class="page-heading wrap"><a class="text-link" href="${path('events')}">${icon('arrow', 'reverse')} ${t('events')}</a><div class="eyebrow">AGENDA · PARIS DATA</div><h1>${esc(eventText(e, 'title', c))}</h1><span class="badge muted" aria-live="polite">${eventLanguage(e, c)}</span>${e.translationStatus?.[c.lang]?.status === 'failed' ? `<button class="text-link" data-action="retry-translation" data-event="${esc(e.id)}">${t('translationRetry')}</button>` : ''}</section><section class="prose article-body"><p data-event-description>${esc(eventText(e, 'description', c))}</p>${c.lang !== 'fr' ? `<details class="detail-box"><summary>${t('showOriginal')}</summary><h2 lang="fr">${esc(e.title.fr)}</h2><p lang="fr">${esc(e.description.fr)}</p><p lang="fr">${esc(e.dateDescription)}</p><p lang="fr">${esc(e.price)}</p></details>` : ''}<div class="detail-box"><h2>${esc(e.venue)}</h2><p>${esc(e.address)}</p><p>${esc(format(e.start))}<br>${esc(format(e.end))}</p>${
      e.occurrences?.length > 1
        ? `<h3>${t('upcomingDates')}</h3><ul>${e.occurrences
            .slice(0, 12)
            .map((o) => `<li>${esc(format(o.start))}</li>`)
            .join('')}</ul>`
        : ''
    }<p class="small">${t('dateSourceNote')}</p>${c.lang === 'fr' ? `<p>${esc(e.dateDescription)}</p><p>${esc(e.price)}</p>` : e.detailsTranslations?.[c.lang] ? `<p>${esc(e.detailsTranslations[c.lang].dateDescription)}</p><p>${esc(e.detailsTranslations[c.lang].price)}</p>` : /^(gratuit|free)$/i.test(e.price?.trim() || '') ? `<p>${t('freeEntry')}</p>` : ''}${e.placeId ? `<a class="text-link" href="${path(`places/${e.placeId}`)}">${t('details')} ${icon('arrow')}</a>` : `<p class="small muted-text">${t('eventPlaceUnmatched')}</p>`}</div><a class="button primary" href="${safeUrl(e.url)}" target="_blank" rel="noopener noreferrer">${t('originalAnnouncement')} ${icon('external')}</a><h2>${t('sources')}</h2><p><a href="${safeUrl(e.sourceUrl)}" target="_blank" rel="noopener noreferrer">Paris Data</a> · ${esc(e.fetchedAt)}</p></section>`;
  }
  return missing(c);
}
export function missing(c) {
  return `<section class="empty-state wrap"><h1>${c.t('notFound')}</h1><a class="button primary" href="${c.path('')}">${c.t('home')}</a></section>`;
}
