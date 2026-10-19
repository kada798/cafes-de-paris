import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('six sections, real article links, source pages and live event content', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/fr/');
  await expect(page.locator('h1')).toContainText('Paris');
  await expect(page.locator('#main-nav a')).toHaveCount(6);
  await page.getByRole('link', { name: 'Culture des cafés', exact: true }).first().click();
  await expect(page.locator('.article-card')).toHaveCount(3);
  await page.locator('.article-card a').first().click();
  await expect(page.locator('.article-body')).toBeVisible();
  await page.locator('.place-card a').first().click();
  await expect(page.locator('.detail-title h1')).toBeVisible();
  await expect(page.locator('.source-list a').first()).toHaveAttribute('href', /^https:\/\//);
  await page.goto('/en/events');
  await expect(page.locator('h1')).toHaveText('Something to look forward to.');
  const event = page.locator('.event-card h3 a').first();
  if (await event.count()) {
    await event.click();
    await expect(page.getByRole('link', { name: /Original announcement/ })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('scenario, optional demo, custom priorities and language state survive navigation', async ({
  page,
}) => {
  await page.goto('/fr/map?scenario=work');
  await expect(page.locator('select[name="req-laptop"]')).toHaveValue('must');
  await page.locator('input[name="includeDemo"]').check();
  await page.locator('select[name="req-pets"]').selectOption('prefer');
  await page.locator('#search-form button[type="submit"]').click();
  await expect(page.locator('#search-form button[type="submit"]')).toBeEnabled();
  await expect(page.locator('.results-panel .demo-label').first()).toBeVisible();
  await page.locator('[data-language="zh"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.locator('select[name="req-pets"]')).toHaveValue('prefer');
  await expect(page.locator('input[name="includeDemo"]')).toBeChecked();
  await page.locator('.result-list .place-card a').first().click();
  await expect(page.locator('.detail-title h1')).toBeVisible();
  await page.locator('[data-back-results]').click();
  await expect(page.locator('select[name="req-pets"]')).toHaveValue('prefer');
  await expect(page.locator('input[name="includeDemo"]')).toBeChecked();
});

test('unconfigured transit remains unknown; origin is not in URL', async ({ page }) => {
  await page.goto('/en/map');
  await expect(page.locator('#map')).toBeVisible();
  await page.locator('#map').click({ position: { x: 100, y: 100 } });
  await expect(page.locator('#origin')).not.toHaveValue('');
  await page.locator('#mode').selectOption('transit');
  await page.locator('#search-form button[type="submit"]').click();
  await expect(page.locator('#search-form button[type="submit"]')).toBeEnabled({ timeout: 30000 });
  expect(page.url()).not.toMatch(/48\.|origin=/);
  const capabilities = await page.request.get('/api/catalog').then((r) => r.json());
  if (!capabilities.capabilities.walking)
    await expect(page.locator('.result-list .badge.positive')).toHaveCount(0);
});

for (const [name, width, height] of [
  ['desktop', 1440, 1000],
  ['ipad', 820, 1180],
  ['mobile', 390, 844],
]) {
  test(`${name}: responsive layouts and main pages do not overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mkdir('test-results/screenshots', { recursive: true });
    for (const route of [
      '/',
      '/map',
      '/types',
      '/gallery',
      '/culture',
      '/about',
      '/events',
      '/places/flore',
    ]) {
      await page.goto(`/fr${route}`);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('#main-nav a')).toHaveCount(6);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1
      );
      expect(overflow, `${name}: ${route}`).toBe(false);
      if (route === '/' || route === '/map') {
        await page.screenshot({
          path: `test-results/screenshots/${name}-${route === '/' ? 'home' : 'map'}.png`,
          fullPage: true,
        });
      }
    }
    if (width < 721) {
      await page.goto('/zh/map');
      await page.locator('[data-view="map"]').click();
      await expect(page.locator('#map')).toBeVisible();
      await page.locator('[data-action="menu"]').click();
      await expect(page.locator('#main-nav')).toBeVisible();
    }
  });
}
