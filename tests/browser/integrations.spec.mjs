import { test, expect } from '@playwright/test';
const fixture = {
  id: 'translation-fixture',
  title: { fr: 'Lecture partagée' },
  description: { fr: 'Pour les enfants accompagnés.' },
  dateDescription: 'Mardi à 17h',
  price: 'gratuit',
  venue: 'Bibliothèque Amélie',
  address: 'Paris',
  start: '2027-01-01T16:00:00Z',
  end: '2027-01-01T17:00:00Z',
  status: 'published',
  url: 'https://www.paris.fr/',
  sourceUrl: 'https://parisdata.opendatasoft.com/',
  fetchedAt: '2026-10-19',
};
async function snapshot(page, routePath, events = [fixture], places) {
  const catalog = await page.request.get('/api/catalog').then((r) => r.json());
  catalog.events = events;
  if (places) catalog.places = places;
  await page.route('**/api/catalog.json', (route) => route.fulfill({ json: catalog }));
  await page.route(`**${routePath}`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        '<head>',
        '<head><meta name="app-mode" content="snapshot">'
      ),
    });
  });
}
test('snapshot translates Chinese and English content, retains original and cached reload', async ({
  page,
}) => {
  const path = '/zh/events/translation-fixture';
  await snapshot(page, path);
  let calls = 0;
  await page.route('https://api.mymemory.translated.net/**', (route) => {
    calls++;
    const url = new URL(route.request().url());
    const zh = url.searchParams.get('langpair') === 'fr|zh-CN';
    const q = url.searchParams.get('q');
    const text =
      q === fixture.title.fr
        ? zh
          ? '共享阅读'
          : 'Shared reading'
        : q === fixture.description.fr
          ? zh
            ? '儿童须由成人陪同。'
            : 'Children must be accompanied.'
          : zh
            ? '周二17点'
            : 'Tuesday at 5pm';
    return route.fulfill({ json: { responseStatus: 200, responseData: { translatedText: text } } });
  });
  await page.goto(path);
  await expect(page.locator('h1')).toHaveText('共享阅读');
  await expect(page.locator('[data-event-description]')).toHaveText('儿童须由成人陪同。');
  await expect(page.locator('.article-body')).toContainText('免费入场');
  await page.getByText('查看法语原文', { exact: true }).click();
  await expect(page.locator('details p[lang="fr"]').first()).toHaveText(fixture.description.fr);
  const afterFirst = calls;
  await page.reload();
  await expect(page.locator('[data-event-description]')).toHaveText('儿童须由成人陪同。');
  expect(calls).toBe(afterFirst);
  await page.locator('[data-language="en"]').click();
  await expect(page.locator('h1')).toHaveText('Shared reading');
  await expect(page.locator('[data-event-description]')).toHaveText(
    'Children must be accompanied.'
  );
  await expect(page.locator('.article-body')).toContainText('Free admission');
});
test('snapshot displays translation quota and original instead of provider error text', async ({
  page,
}) => {
  const path = '/zh/events/translation-fixture';
  await snapshot(page, path);
  await page.route('https://api.mymemory.translated.net/**', (route) =>
    route.fulfill({
      json: {
        responseStatus: 429,
        quotaFinished: true,
        responseData: { translatedText: 'LIMIT REACHED' },
      },
    })
  );
  await page.goto(path);
  await expect(page.locator('.page-heading')).toContainText('翻译服务额度已用完');
  await expect(page.getByText('重试翻译', { exact: true })).toBeVisible();
  await page.getByText('查看法语原文', { exact: true }).click();
  await expect(page.locator('details h2')).toHaveText(fixture.title.fr);
  await expect(page.locator('main')).not.toContainText('LIMIT REACHED');
});
test('snapshot uses pedestrian routing for time filtering and draws a path', async ({ page }) => {
  const near = {
    id: 'near',
    name: 'Near café',
    kind: 'cafe',
    type: 'cafe',
    area: 'Paris',
    address: 'Paris',
    lat: 48.86,
    lng: 2.34,
    description: { fr: 'Café' },
    policies: {},
  };
  const far = { ...near, id: 'far', name: 'Far café', lat: 48.88, lng: 2.38 };
  await snapshot(page, '/zh/map', [], [near, far]);
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'cafes-search',
      JSON.stringify({
        query: { origin: { lat: 48.855, lng: 2.33 }, mode: 'walking', maxMinutes: 20 },
        originLabel: 'Paris',
      })
    )
  );
  const requests = [];
  await page.route('https://data.geopf.fr/navigation/itineraire**', (route) => {
    const url = new URL(route.request().url());
    requests.push(url.searchParams.get('profile'));
    const close = url.searchParams.get('end') === '2.34,48.86';
    return route.fulfill({
      json: {
        profile: 'pedestrian',
        duration: close ? 480 : 2400,
        timeUnit: 'second',
        distance: close ? 600 : 3000,
        distanceUnit: 'meter',
        geometry: {
          type: 'LineString',
          coordinates: [[2.33, 48.855], close ? [2.34, 48.86] : [2.38, 48.88]],
        },
      },
    });
  });
  await page.goto('/zh/map');
  await page.locator('#search-form button[type="submit"]').click();
  await expect(page.locator('.result-list [data-place-card="near"] .card-bottom')).toContainText(
    '8 分钟'
  );
  await expect(page.locator('.result-list [data-place-card="far"]')).toHaveCount(0);
  await expect(page.locator('.excluded [data-place-card="far"]')).toHaveCount(1);
  await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toHaveCount(2);
  expect(requests).toEqual(['pedestrian', 'pedestrian']);
  expect(page.url()).not.toMatch(/origin=|48\./);
});
