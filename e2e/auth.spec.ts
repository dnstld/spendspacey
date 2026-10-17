import { test, expect } from './fixtures';

for (const width of [360, 1280]) {
  test(`minimal shell is keyboard operable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Spendspacey' })).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(1);
    await expect(page.getByRole('combobox', { name: 'Language' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('combobox')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const [locale, expected] of [
  ['pt-PT', 'pt-BR'],
  ['de-DE', 'en'],
] as const) {
  test.describe(`device locale ${locale}`, () => {
    test.use({ locale });
    test('selects the supported locale without persisting detection', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('combobox')).toHaveValue(expected);
      await expect(page.locator('html')).toHaveAttribute('lang', expected);
      expect(await page.evaluate(() => localStorage.getItem('spendspacey.locale'))).toBeNull();
    });
  });
}

test('reevaluates changed device preferences on reload without an explicit selection', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('combobox')).toHaveValue('en');
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-PT'] }),
  );
  await page.reload();
  await expect(page.getByRole('combobox')).toHaveValue('pt-BR');
  expect(await page.evaluate(() => localStorage.getItem('spendspacey.locale'))).toBeNull();
});

for (const suffix of [
  '?error=access_denied&error_description=synthetic-private-message',
  '#error=access_denied',
]) {
  test(`callback cancellation is localized and scrubbed (${suffix[0]})`, async ({ page, auth }) => {
    await page.goto(`/auth/callback${suffix}`);
    await expect(page.getByRole('alert')).toContainText('cancelled');
    await expect(page).toHaveURL('http://127.0.0.1:4173/auth/callback');
    await page.getByRole('combobox').selectOption('pt-BR');
    await expect(page.getByRole('alert')).toContainText('cancelado');
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
    'We could not complete sign-in. Please start again.',
  );
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Back' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/');
  await expect(page).toHaveURL('http://127.0.0.1:4173/auth/callback');
  await expect(page.getByRole('heading', { name: 'Test Person' })).toHaveCount(0);
  await expect(page.getByText('person@example.test')).toHaveCount(0);
  expect(auth.exchanges).toBe(0);
});

test('direct callback entry and unknown routes recover to the root shell', async ({ page }) => {
  await page.goto('/auth/callback');
  await expect(page.getByRole('alert')).toContainText('unavailable or has expired');
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await page.goto('/unknown-route');
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
});

test('unknown-user signup rejection shows recovery without an authenticated session', async ({
  page,
  auth,
}) => {
  auth.mode = 'signup-disabled';
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('alert')).toContainText('This account cannot sign in');
  await expect(page.getByRole('heading', { name: 'Test Person' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
  await expect(page).toHaveURL('http://127.0.0.1:4173/auth/callback');
  expect(auth.exchanges).toBe(0);
});

test('failed code exchange offers a fresh login without automatic code replay', async ({
  page,
  auth,
}) => {
  auth.mode = 'exchange-failure';
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('alert')).toContainText('unavailable or has expired');
  expect(auth.exchanges).toBe(1);
  auth.mode = 'success';
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  expect(auth.exchanges).toBe(2);
});

test('broken avatar keeps the authenticated identity usable', async ({ page, auth }) => {
  auth.brokenAvatar = true;
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('img', { name: 'Profile photo unavailable' })).toBeVisible();
  await expect(page.getByText('person@example.test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeEnabled();
});

test('current-session sign-out is reflected in a second tab', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(second.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('PKCE callback, session restoration, preference persistence, and local sign-out', async ({
  page,
  auth,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  await expect(page.getByText('person@example.test')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Foto do perfil do Google' })).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  expect(auth.exchanges).toBe(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Test Person' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveValue('pt-BR');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
  expect(auth.exchanges).toBe(1);
});
