import { test, expect } from './fixtures';
import { callbackPaths } from '../test/callbackPaths';

for (const path of callbackPaths) {
  test(`authorized callback captures the code from ${path} and exchanges only once`, async ({
    page,
    auth,
    baseURL,
  }) => {
    auth.returnPath = path;
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar com o Google' }).click();
    await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
    await expect(page).toHaveURL(`${baseURL}/`);
    expect(auth.exchanges).toBe(1);
    await page.reload();
    await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
    expect(auth.exchanges).toBe(1);
  });
}

for (const width of [360, 1280]) {
  test(`minimal shell is keyboard operable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Spendspacey' })).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test.describe('English browser with a legacy language preference', () => {
  test.use({ locale: 'en-US' });
  test('initial render and reload use Brazilian Portuguese', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('spendspacey.locale', 'en'));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  });
});

for (const suffix of [
  '?error=access_denied&error_description=synthetic-private-message',
  '#error=access_denied',
]) {
  test(`callback cancellation is localized and scrubbed (${suffix[0]})`, async ({ page, auth }) => {
    await page.goto(`/auth/callback${suffix}`);
    await expect(page.getByRole('alert')).toContainText('cancelado');
    await expect(page).toHaveURL('http://127.0.0.1:4173/auth/callback');
    await expect(page.getByRole('main')).not.toContainText('synthetic-private-message');
    expect(auth.exchanges).toBe(0);
    await page.getByRole('link', { name: 'Voltar' }).click();
    await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
  });
}

test('callback with a code but no PKCE verifier offers recovery without a token request', async ({
  page,
  auth,
}) => {
  await page.goto('/auth/callback?code=synthetic-code');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText(
    'Não foi possível concluir o login. Comece novamente.',
  );
  await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Voltar' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/');
  await expect(page).toHaveURL('http://127.0.0.1:4173/auth/callback');
  await expect(page.getByRole('heading', { name: 'Test Person' })).toHaveCount(0);
  await expect(page.getByText('person@example.test')).toHaveCount(0);
  expect(auth.exchanges).toBe(0);
});

test('direct callback entry and unknown routes recover to the root shell', async ({ page }) => {
  await page.goto('/auth/callback');
  await expect(page.getByRole('alert')).toContainText('indisponível ou expirou');
  await page.getByRole('link', { name: 'Voltar' }).click();
  await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
  await page.goto('/unknown-route');
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
});

test('unknown-user signup rejection shows recovery without an authenticated session', async ({
  page,
  auth,
}) => {
  auth.mode = 'signup-disabled';
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await expect(page.getByRole('alert')).toContainText('Esta conta não pode entrar');
  await expect(page.getByRole('heading', { name: 'Test Person' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeEnabled();
  await expect(page).toHaveURL('http://127.0.0.1:4173/auth/callback');
  expect(auth.exchanges).toBe(0);
});

test('failed code exchange offers a fresh login without automatic code replay', async ({
  page,
  auth,
}) => {
  auth.mode = 'exchange-failure';
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await expect(page.getByRole('alert')).toContainText('indisponível ou expirou');
  expect(auth.exchanges).toBe(1);
  auth.mode = 'success';
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  expect(auth.exchanges).toBe(2);
});

test('broken avatar keeps the authenticated identity usable', async ({ page, auth }) => {
  auth.brokenAvatar = true;
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Foto de perfil indisponível' })).toBeVisible();
  await expect(page.getByText('person@example.test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sair' })).toBeEnabled();
});

test('profile failures remain localized and retry only the current-user read', async ({
  page,
  auth,
}) => {
  auth.profileMode = 'malformed';
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('carregar seu perfil com segurança');
  await expect(page.getByText('person@example.test')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toHaveCount(0);
  expect(auth.profileReads).toBe(1);
  auth.profileMode = 'success';
  await page.getByRole('button', { name: 'Tentar carregar o perfil novamente' }).click();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  expect(auth.profileReads).toBe(2);
});

test('a missing profile never fabricates a database card', async ({ page, auth }) => {
  auth.profileMode = 'missing';
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
  await expect(page.getByText('Seu perfil no banco de dados não está disponível.')).toBeVisible();
  await expect(page.getByText('person@example.test')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toHaveCount(0);
  expect(auth.profileReads).toBe(1);
});

test('one localized current-user card stays on the root route at narrow width', async ({
  page,
  auth,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Seu perfil' })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Test Person' })).toHaveCount(1);
  await expect(page.getByText('person@example.test')).toHaveCount(1);
  expect(auth.profileReads).toBe(1);
  await page.goto('/profiles');
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Seu perfil' })).toHaveCount(1);
  await expect(page.getByRole('img', { name: 'Foto do perfil de Test Person' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('current-session sign-out is reflected in a second tab', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/');
  await second.getByRole('button', { name: 'Carteiras', exact: true }).click();
  await expect(second.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(second.getByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
  await expect(second.getByRole('region', { name: 'Seu perfil' })).toHaveCount(0);
  await expect(second.getByRole('heading', { name: 'Test Person' })).toHaveCount(0);
});

test('PKCE callback, session restoration, Brazilian Portuguese, and local sign-out', async ({
  page,
  auth,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  await expect(page.getByText('person@example.test')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Foto do perfil de Test Person' })).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  expect(auth.exchanges).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
  expect(auth.exchanges).toBe(1);
});
