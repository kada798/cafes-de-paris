import { test, expect } from '@playwright/test';
test('weekly reading, source records, professional categories and Google transit links', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
  await page.goto('/zh/culture');
  await expect(page.locator('.weekly-section .reading-card')).toHaveCount(4);
  await expect(page.locator('#reading-library .reading-card')).toHaveCount(15);
  await page.locator('#reading-filter select[name="theme"]').selectOption('heritage');
  await page.locator('#reading-filter button').click();
  await expect(page.locator('#reading-library .reading-card')).toHaveCount(3);
  await page.locator('#reading-library .reading-card h3 a').first().click();
  await expect(page.locator('[data-reading-detail]')).toContainText('来源档案');
  await expect(page.locator('[data-reading-outbound]')).toHaveAttribute('href', /^https:\/\//);
  await page.goto('/zh/types');
  await expect(page.locator('.taxonomy-method')).toContainText('SCA');
  await expect(page.locator('.type-section').first()).toContainText('21');
  await page.goto('/zh/map');
  await page.locator('#mode').selectOption('transit');
  await page.locator('#search-form button[type="submit"]').click();
  await expect(page.locator('#search-form button[type="submit"]')).toBeEnabled();
  await expect(page.locator('.google-directions').first()).toHaveAttribute(
    'href',
    /travelmode=transit/
  );
});
