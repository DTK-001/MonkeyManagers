import { expect, test } from '@playwright/test';

test('a manager can explore the complete demo journey', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Build your club/i })).toBeVisible();
  await page.getByTestId('enter-demo').click();
  await expect(page.getByRole('heading', { name: /Good evening, Alex/i })).toBeVisible();
  await expect(page.getByText('Demo league', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Market', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Player market' })).toBeVisible();
  await page.getByRole('button', { name: 'Buy', exact: true }).first().click();
  const purchaseDialog = page.getByRole('dialog');
  await expect(purchaseDialog.getByText('Confirm signing')).toBeVisible();
  await purchaseDialog.getByRole('button', { name: 'Confirm purchase' }).click();
  await expect(page.getByRole('status')).toContainText('is yours');

  await page.getByRole('link', { name: 'Squad', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your squad' })).toBeVisible();
  await expect(page.getByText('Formation is valid')).toBeVisible();
  await page.getByRole('button', { name: 'Save Round 9 lineup' }).click();
  await expect(page.getByRole('status')).toContainText('Lineup saved');

  await page.getByRole('link', { name: 'Cups', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Competitions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Overall season table' })).toBeVisible();
  await expect(page.getByText('548.70', { exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'Crown Premier Division' }).click();
  await expect(page.getByRole('tab', { name: 'Leaderboard' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByText('Your club')).toBeVisible();

  await page.getByRole('link', { name: 'League', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Friday Night Football' })).toBeVisible();
  const leagueTable = page
    .getByRole('heading', { name: 'The table' })
    .locator('xpath=ancestor::section[1]');
  await expect(leagueTable).toBeVisible();
  await expect(leagueTable.getByText('Holloway Ravens', { exact: true })).toBeVisible();
});
