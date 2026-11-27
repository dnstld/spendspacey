import { test, expect } from './fixtures';
import { familyMember, owner, thirdMember } from './finance-data';

test('reviews periods and category activity using the same wallet and date range', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  const main = page.getByRole('main', { name: 'Transações' });
  await expect(main.getByText('R$ 12,00').first()).toBeVisible();
  await expect(main.getByText('R$ 100,00').first()).toBeVisible();
  const chooser = page.getByRole('button', { name: /Selecionar período/ });
  await chooser.click();
  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  await page.getByRole('button', { name: 'Categorias', exact: true }).click();
  await expect(chooser).toHaveText('Hoje');
  const modalButton = page.getByRole('button', { name: 'Ver transações de Mercado' });
  await modalButton.click();
  await expect(page.getByRole('dialog').getByText('Feira')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(modalButton).toBeFocused();
  await page.getByRole('tab', { name: 'Entradas' }).click();
  await expect(page.getByRole('heading', { name: 'Salário' })).toBeVisible();
  await page.getByRole('button', { name: 'Transações', exact: true }).click();
  await expect(chooser).toHaveText('Este mês');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('preserves a transaction draft through item autofill, a failed save, and duplicate confirmation', async ({
  page,
  auth,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  const add = page.getByRole('button', { name: 'Nova transação', exact: true });
  await add.click();
  await page.getByRole('button', { name: 'Mercado', exact: true }).click();
  await page.getByRole('button', { name: 'Ana', exact: true }).click();
  await page.getByRole('button', { name: 'Compras', exact: true }).click();
  await expect(page.getByLabel('Valor')).toHaveValue('4200');
  auth.finance.failures.transaction = true;
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText(/Seu rascunho continua aqui/)).toBeVisible();
  await expect(page.getByLabel('Valor')).toHaveValue('4200');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(auth.finance.rows[0]).toMatchObject({
    on_behalf_of: familyMember,
    amount_cents: 4200,
    category_item_id: 'groceries',
  });

  await add.click();
  await page.getByRole('button', { name: 'Mercado', exact: true }).click();
  await page.getByRole('button', { name: 'Compras', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Possível duplicidade' })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Ana', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar mesmo assim' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(auth.finance.rows.filter((row) => row.amount_cents === 4200)).toHaveLength(2);
});

test('deletes a web-created personal wallet only while the creator is its sole member', async ({
  page,
  auth,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Carteiras', exact: true }).click();
  await expect(
    page.getByRole('form', { name: 'Gerenciar Família' }).getByText('Carteira ativa'),
  ).toBeVisible();
  await expect(
    page
      .getByRole('form', { name: 'Gerenciar Família' })
      .getByRole('button', { name: 'Excluir carteira' }),
  ).toHaveCount(0);
  const inactive = page.getByRole('form', { name: 'Gerenciar Viagem' });
  await expect(inactive.getByRole('button', { name: 'Excluir carteira' })).toHaveCount(0);
  await inactive.getByLabel('Nome da carteira').fill('Viagem de férias');
  await inactive.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Gerenciar Viagem de férias' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Carteira ativa' })).toHaveText('Família');
  await page.getByRole('button', { name: 'Nova carteira' }).click();
  const creation = page.getByRole('form', { name: 'Criar carteira' });
  await expect(creation.getByRole('combobox', { name: 'Moeda' })).toHaveText('BRL');
  await creation.getByLabel('Nome da carteira').fill('Poupança');
  await creation.getByRole('button', { name: 'Criar carteira' }).click();
  await expect(page.getByRole('combobox', { name: 'Carteira ativa' })).toHaveText('Poupança');
  const preferences = page.getByRole('form', { name: 'Gerenciar Poupança' });
  await expect(preferences.getByLabel('Moeda')).toHaveAttribute('readonly', '');
  expect(auth.finance.wallets).toHaveLength(4);
  const wallet = auth.finance.wallets.find((value) => value.name === 'Poupança')!;
  const transaction = { ...auth.finance.rows[0], id: 'savings-expense', wallet_id: wallet.id };
  auth.finance.rows.push(transaction);
  await preferences.getByRole('button', { name: 'Excluir carteira' }).click();
  const confirm = page.getByRole('alertdialog').getByRole('button', { name: 'Excluir carteira' });
  wallet.memberIds.push(familyMember);
  await confirm.click();
  await expect(page.getByText('Não foi possível excluir a carteira')).toBeVisible();
  expect(auth.finance.wallets).toContain(wallet);
  expect(auth.finance.rows).toContain(transaction);

  wallet.memberIds.pop();
  await confirm.click();
  await expect(page.getByRole('combobox', { name: 'Carteira ativa' })).toHaveText('Família');
  await expect(preferences).toHaveCount(0);
  expect(auth.finance.wallets).toHaveLength(3);
  expect(auth.finance.rows).not.toContain(transaction);
});

test('keeps the signed-in workspace and blocks API writes while offline', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  await page.getByRole('button', { name: 'Mercado', exact: true }).click();
  await page.getByRole('button', { name: 'Compras', exact: true }).click();
  await context.setOffline(true);
  try {
    await expect(page.getByRole('dialog').getByText(/Você está offline/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Valor')).toHaveValue('4200');
  } finally {
    await context.setOffline(false);
  }
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('main', { name: 'Transações' })).toBeVisible();
});

test('creates a category from the income form and edits the saved transaction', async ({
  page,
  auth,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  await page.getByRole('tab', { name: 'Receita' }).click();
  await page.getByLabel('Valor').pressSequentially('2750');
  await page.getByRole('button', { name: 'Selecionar categoria' }).click();
  await page.getByRole('textbox', { name: 'Buscar categoria' }).fill('Freelance');
  await page.getByRole('button', { name: 'Nova categoria' }).click();
  await expect(page.getByLabel('Nome da categoria')).toHaveValue('Freelance');
  await page.getByRole('button', { name: 'Criar categoria' }).click();
  await expect(page.getByLabel('Valor')).toHaveValue('2750');
  await page.getByRole('button', { name: 'Adicionar descrição' }).click();
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Consultoria');
  await page.getByRole('button', { name: 'Salvar para reutilizar' }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  const row = page.getByRole('button', { name: /Freelance Consultoria/ });
  await row.click();
  await expect(page.getByRole('heading', { name: 'Editar transação' })).toBeVisible();
  await page.getByLabel('Valor').fill('3250');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(row).toContainText('32,50');
  expect(auth.finance.rows[0]).toMatchObject({ description: 'Consultoria', amount_cents: 3250 });
});

test('keeps totals and controls fixed while transaction rows scroll on phone and desktop', async ({
  page,
  auth,
}) => {
  const example = auth.finance.rows[0];
  auth.finance.rows.push(
    ...Array.from({ length: 25 }, (_, index) => ({
      ...example,
      id: `row-${index}`,
      description: `Movimento ${index}`,
    })),
  );
  await page.setViewportSize({ width: 390, height: 760 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  const totals = page.locator('dl');
  await expect(totals).toBeVisible();
  const chooser = page.getByRole('button', { name: /Selecionar período/ });
  const dock = page.getByRole('navigation', { name: 'Menu principal' });
  const before = await Promise.all([
    chooser.boundingBox(),
    totals.boundingBox(),
    dock.boundingBox(),
  ]);
  await page.locator('.finance-scroll').evaluate((node) => node.scrollTo(0, 350));
  expect(await page.locator('.finance-scroll').evaluate((node) => node.scrollTop)).toBeGreaterThan(
    0,
  );
  expect(
    await Promise.all([chooser.boundingBox(), totals.boundingBox(), dock.boundingBox()]),
  ).toEqual(before);
  await chooser.focus();
  await page.keyboard.press('Enter');
  for (const shortcut of ['Hoje', 'Este mês', 'Este ano', 'Últimos 7 dias']) {
    await expect(page.getByRole('button', { name: shortcut, exact: true })).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(chooser).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 840 });
  expect(
    (await page.getByRole('main', { name: 'Transações' }).boundingBox())!.width,
  ).toBeLessThanOrEqual(480);
});

test('renames, archives and restores a category from its own card', async ({ page, auth }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Categorias', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Mercado' }).click();
  await page.getByLabel('Nome da categoria').fill('Supermercado');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Supermercado' }).click();
  await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Supermercado' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mostrar arquivadas' }).click();
  await page.getByRole('button', { name: 'Editar Supermercado' }).click();
  await page.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Supermercado' })).toBeVisible();
  expect(
    auth.finance.categories.find((category) => category.name === 'Supermercado')?.archived_at,
  ).toBeNull();
});

test('hides a revoked wallet on focus and while reconnect checks are pending', async ({
  page,
  context,
  auth,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await expect(page.getByText('Feira', { exact: true })).toBeVisible();
  const walletPath = /\/rest\/v1\/wallet_members\?/;
  const requested = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  await page.route(walletPath, async (route) => {
    requested.resolve();
    await release.promise;
    await route.fallback();
  });
  try {
    await context.setOffline(true);
    await expect(page.getByText('Você está offline', { exact: true })).toBeVisible();
    await context.setOffline(false);
    await requested.promise;
    await expect(page.getByText('Carregando carteiras…')).toBeVisible();
    await expect(page.getByText('Feira', { exact: true })).toHaveCount(0);
    auth.finance.wallets.splice(0, 1);
  } finally {
    release.resolve();
  }
  const wallet = page.getByRole('combobox', { name: 'Carteira ativa' });
  await expect(wallet).toHaveText('Viagem');
  auth.finance.wallets.splice(0, 1);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(wallet).toHaveText('Europa');
});

test('an offline transition cancels a save waiting for its duplicate lookup', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  await page.getByRole('button', { name: 'Mercado', exact: true }).click();
  await page.getByRole('button', { name: 'Compras', exact: true }).click();
  const requested = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let writes = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/save_web_transaction')) writes++;
  });
  await page.route(/\/rest\/v1\/transactions\?.*amount_cents=/, async (route) => {
    requested.resolve();
    await release.promise;
    await route.fallback();
  });
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await requested.promise;
  try {
    await context.setOffline(true);
    await expect(page.getByRole('dialog').getByText(/Você está offline/)).toBeVisible();
  } finally {
    release.resolve();
    await context.setOffline(false);
  }
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled();
  expect(writes).toBe(0);
});

test('a changed retry after a lost response reports the saved version', async ({ page, auth }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  await page.getByRole('button', { name: 'Mercado', exact: true }).click();
  await page.getByRole('button', { name: 'Compras', exact: true }).click();
  auth.finance.failures.transactionResponse = true;
  const save = page.getByRole('button', { name: 'Salvar', exact: true });
  await save.click();
  await expect(page.getByText(/Seu rascunho continua aqui/)).toBeVisible();
  await page.getByLabel('Valor').fill('4350');
  await save.click();
  await expect(page.getByText(/Já existe uma versão salva desta transação/)).toBeVisible();
  await expect(page.getByLabel('Valor')).toHaveValue('4350');
  expect(auth.finance.rows.filter((row) => row.description === 'Compras')).toHaveLength(1);
  expect(auth.finance.rows.find((row) => row.description === 'Compras')?.amount_cents).toBe(4200);
  await page.getByRole('button', { name: 'Voltar à lista' }).click();
  await expect(page.getByRole('button', { name: /Mercado Compras/ })).toContainText('42,00');
});

test('sign-out in a second tab cancels a save waiting for its duplicate lookup', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  await page.getByRole('button', { name: 'Mercado', exact: true }).click();
  await page.getByRole('button', { name: 'Compras', exact: true }).click();
  const requested = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const processed = Promise.withResolvers<void>();
  let writes = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/save_web_transaction')) writes++;
  });
  await page.route(/\/rest\/v1\/transactions\?.*amount_cents=/, async (route) => {
    requested.resolve();
    await release.promise;
    try {
      await route.fallback();
    } finally {
      processed.resolve();
    }
  });
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await requested.promise;
  try {
    const second = await context.newPage();
    await second.goto('/');
    await second.getByRole('button', { name: 'Carteiras' }).click();
    await second.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
  } finally {
    release.resolve();
  }
  await processed.promise;
  expect(writes).toBe(0);
});

test('retains a draft through a transient membership failure and restores it on retry', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  await page.getByRole('button', { name: 'Mercado', exact: true }).click();
  await page.getByLabel('Valor').fill('4321');
  await context.setOffline(true);
  await expect(page.getByRole('dialog').getByText(/Você está offline/)).toBeVisible();
  const walletPath = /\/rest\/v1\/wallet_members\?/;
  const failAccessCheck = (route: import('@playwright/test').Route) =>
    route.fulfill({ status: 503, json: { message: 'Synthetic service outage' } });
  await page.route(walletPath, failAccessCheck);
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.unroute(walletPath, failAccessCheck);
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Valor')).toHaveValue('4321');
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled();
});

test('updates the roster in an open draft when polling detects a member change', async ({
  page,
  auth,
}) => {
  await page.clock.install();
  const wallet = auth.finance.wallets[0];
  wallet.memberIds = [owner, familyMember, thirdMember];
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: 'Nova transação', exact: true }).click();
  await page.getByRole('button', { name: 'Mercado', exact: true }).click();
  await page.getByLabel('Valor').fill('4321');
  await page.getByRole('button', { name: 'Ana', exact: true }).click();
  wallet.memberIds = [owner, thirdMember, 'replacement-member'];
  await page.clock.fastForward(31_000);
  await expect(page.getByText(/O beneficiário selecionado saiu da carteira/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ana', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Outra pessoa', exact: true })).toBeVisible();
  await expect(page.getByLabel('Valor')).toHaveValue('4321');
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Bruno', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(auth.finance.rows[0].on_behalf_of).toBe(thirdMember);
});

test('requires explicit attribution resolution before editing a historical transaction', async ({
  page,
  auth,
}) => {
  auth.finance.wallets[0].memberIds = [owner];
  const transaction = auth.finance.rows[0];
  transaction.on_behalf_of = familyMember;
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await page.getByRole('button', { name: /Mercado Feira/ }).click();
  await expect(page.getByText(/O beneficiário original saiu da carteira/)).toBeVisible();
  await page.getByLabel('Valor').fill('1500');
  const save = page.getByRole('button', { name: 'Salvar', exact: true });
  await expect(save).toBeDisabled();
  expect(transaction.on_behalf_of).toBe(familyMember);
  await page.getByRole('button', { name: 'Remover beneficiário', exact: true }).click();
  await save.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(transaction).toMatchObject({ amount_cents: 1500, on_behalf_of: null });
});
