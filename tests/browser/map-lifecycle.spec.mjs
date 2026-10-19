import { test, expect } from '@playwright/test';
test('changing map languages with an origin leaves no callbacks on a removed map', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>sessionStorage.setItem('cafes-search',JSON.stringify({query:{origin:{lat:48.854,lng:2.329},mode:'transit'},originLabel:'Paris'})));
  await page.goto('/en/map?ids=flore');
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#search-form button[type="submit"]')).toBeEnabled();
  await page.evaluate(()=>{ for(const lang of ['zh','fr','en'])document.querySelector(`[data-language="${lang}"]`).click(); });
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
