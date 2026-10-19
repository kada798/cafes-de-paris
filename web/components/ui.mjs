export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeUrl = value => /^https:\/\//.test(value || '') || /^\/assets\/photos\/photo-[\w-]+\.jpg$/.test(value || '') ? esc(value) : '#';
export function icon(name, cls = '') {
  const paths = {
    cup: '<path d="M4 8h13v6a6.5 6.5 0 0 1-13 0V8ZM17 9h1a3 3 0 1 1 0 6h-1M3 22h16M8 2v3m5-3v3"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    work: '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M2 20h20M9 16v4m6-4v4"/>',
    friends: '<circle cx="8" cy="7" r="3"/><circle cx="18" cy="8" r="2"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 5v2"/>',
    date: '<path d="M12 21 3.5 12.5a5.5 5.5 0 0 1 8.5-7 5.5 5.5 0 0 1 8.5 7Z"/>',
    business: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12l9 3 9-3m-9 1v4"/>',
    reading: '<path d="M12 5C8 2 3 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-3-2-7-2-10 1Zm0 0v15"/>',
    custom: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    power: '<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>',
    wifi: '<path d="M2 7a16 16 0 0 1 20 0M5 11a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0"/><circle cx="12" cy="20" r="1"/>',
    check: '<path d="m5 12 4 4L19 6"/>', external: '<path d="M14 3h7v7m0-7-12 12M10 4H4v16h16v-6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>', search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    leaf: '<path d="M20 3C6 2 2 8 5 15s16 5 15-12ZM5 20 16 8"/>', shield: '<path d="M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6ZM8 12l3 3 5-6"/>',
  };
  return `<svg class="icon ${cls}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.cup}</svg>`;
}
export const IMG = {
  hero: '/assets/photos/photo-1501339847302-ac426a4a7cbb.jpg',
  cafe: '/assets/photos/photo-1554118811-1e0d58224f24.jpg',
};
export function placeCard(p, c, compact = false) {
  const { t, l, path } = c;
  const checks = p.match?.checks || [];
  const badge = p.availability?.status === 'closed' ? `<span class="badge warning">${t('closed')}</span>`
    : checks.length ? `<span class="badge ${p.match.status === 'match' ? 'positive' : 'muted'}">${t(p.match.status)}</span>` : '';
  return `<article class="place-card ${compact ? 'compact' : ''}" data-place-card="${esc(p.id)}">
    <a class="place-image" href="${path(`places/${p.id}`)}"><img src="${safeUrl(p.image || IMG.cafe)}" alt="${esc(t('photoCredit'))}" loading="lazy"><span class="image-label">${t(p.kind)}</span><small class="image-credit">${t('photoCredit')}</small>${p.demo ? `<span class="demo-label">${t('demo')}</span>` : ''}</a>
    <div class="place-info"><div class="card-meta">${esc(p.area)} <span>·</span> ${t(p.type || p.kind)}</div><a href="${path(`places/${p.id}`)}"><h3>${esc(p.name)}</h3></a>
    ${compact ? '' : `<p>${esc(l(p.description))}</p>`}${badge}
    ${checks.length ? `<div class="check-summary">${checks.slice(0, 3).map(k => `<span class="${k.state === 'yes' ? 'ok' : 'pending'}">${k.state === 'yes' ? '✓' : k.state === 'no' ? '×' : '?'} ${t(k.key === 'stay' ? 'stayRule' : k.key)}</span>`).join('')}</div>` : ''}
    <div class="card-bottom"><span>${p.route?.status === 'ok' ? `${icon('clock')} ${Math.ceil(p.route.durationSeconds / 60)} ${t('min')}` : `${icon('pin')} ${esc(p.address.split(',')[0])}`}</span><a class="arrow-link" href="${path(`places/${p.id}`)}" aria-label="${esc(t('details'))}: ${esc(p.name)}">${icon('arrow')}</a></div></div></article>`;
}
export function articleCard(a, c) {
  return `<article class="article-card"><a href="${c.path(`articles/${a.id}`)}"><div class="article-image"><img src="${safeUrl(a.image || IMG.cafe)}" alt="${esc(c.t('photoCredit'))}" loading="lazy"></div><div class="card-meta">LE CARNET · ${c.lang.toUpperCase()}</div><h3>${esc(c.l(a.title))}</h3><p>${esc(c.l(a.excerpt))}</p><span class="text-link">${c.t('read')} ${icon('arrow')}</span></a></article>`;
}
export function eventCard(e, c) {
  const date = new Date(e.start);
  const locale = c.lang === 'zh' ? 'zh-CN' : c.lang;
  return `<article class="event-card"><div class="event-date"><strong>${new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone: 'Europe/Paris' }).format(date)}</strong><span>${new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'Europe/Paris' }).format(date)}</span></div><div><div class="card-meta">${esc(e.venue || 'Paris')}</div><h3><a href="${c.path(`events/${e.id}`)}">${esc(c.l(e.title))}</a></h3><span class="small muted-text">${c.t('originalLanguage')}</span></div><a class="arrow-link" href="${c.path(`events/${e.id}`)}" aria-label="${esc(c.t('eventDetails'))}">${icon('arrow')}</a></article>`;
}
