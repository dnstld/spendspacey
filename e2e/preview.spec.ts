import { test, expect } from './fixtures';

test('preview root blocks Google sign-in and uses Brazilian Portuguese', async ({ page, auth }) => {
  const authRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/auth/v1/')) authRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('indisponível neste endereço');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeDisabled();
  expect(authRequests).toEqual([]);
  expect(auth.exchanges).toBe(0);
});

test('direct preview callback scrubs parameters without exchange or replay', async ({
  page,
  auth,
  baseURL,
}) => {
  const authRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/auth/v1/')) authRequests.push(request.url());
  });
  await page.goto('/auth/callback?code=synthetic-code#error_description=synthetic-private');
  await expect(page).toHaveURL(`${baseURL}/auth/callback`);
  await expect(page.getByRole('alert')).toContainText('indisponível neste endereço');
  await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeDisabled();
  await page.goto('/');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeDisabled();
  expect(authRequests).toEqual([]);
  expect(auth.exchanges).toBe(0);
});
