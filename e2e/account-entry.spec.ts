import { expect, test } from '@playwright/test';

test('a manager starts with secure account access', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
  await expect(page.getByText(/demo/i)).toHaveCount(0);

  await page.getByRole('link', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});
