import { runInNewContext } from 'node:vm';
import { describe, it, expect, vi } from 'vitest';
import { recoveryScript } from '../../worker/recovery';

async function page(
  locale: string | null,
  repair: string,
  options: { languages?: string[]; denied?: boolean; binding?: boolean; badReply?: boolean } = {},
) {
  const elements = new Map<
    string,
    { textContent: string; disabled: boolean; value: string; listeners: Map<string, () => void> }
  >();
  for (const id of [
    'title',
    'intro',
    'status',
    'hint',
    'repair',
    'cancel',
    'check',
    'reload',
    'language',
  ])
    elements.set(id, { textContent: '', disabled: false, value: '', listeners: new Map() });
  const requests: Record<string, unknown>[] = [];
  const reads: string[] = [];
  const writes: string[] = [];
  const timers = new Map<number, () => void>();
  let sequence = 0;
  const document = {
    title: '',
    documentElement: { lang: '' },
    getElementById: (id: string) => {
      const e = elements.get(id)!;
      return Object.assign(e, {
        addEventListener: (event: string, fn: () => void) => e.listeners.set(event, fn),
      });
    },
  };
  const worker = {
    postMessage: (
      message: Record<string, unknown>,
      ports: { postMessage: (v: unknown) => void }[],
    ) => {
      requests.push(message);
      ports[0].postMessage({
        protocol: 3,
        operation: message.operation,
        request: options.badReply ? 'forged' : message.request,
        status: {
          authority: options.binding === false ? 'none' : 'recovery',
          worker: 'a'.repeat(64),
          epoch: '12345678-1234-1234-1234-123456789012',
          binding: options.binding === false ? null : 'b'.repeat(64),
          generation: null,
          prepared: false,
          ready: false,
          pending: repair === 'complete',
          repair,
        },
      });
    },
  };
  class Channel {
    port1: { onmessage: ((e: { data: unknown }) => void) | null; close: () => void } = {
      onmessage: null,
      close: () => {},
    };
    port2 = { postMessage: (data: unknown) => this.port1.onmessage?.({ data }) };
  }
  const reload = vi.fn(),
    network = vi.fn(() => {
      throw Error('Recovery must never fetch/import/Auth');
    });
  runInNewContext(recoveryScript, {
    document,
    navigator: {
      onLine: repair !== 'offline',
      languages: options.languages ?? ['en-US'],
      language: 'en-US',
      serviceWorker: { controller: worker },
    },
    localStorage: {
      getItem: (key: string) => {
        reads.push(key);
        if (options.denied) throw Error('Denied');
        return locale;
      },
      setItem: (key: string) => {
        writes.push(key);
        if (options.denied) throw Error('Denied');
      },
    },
    crypto,
    Intl,
    MessageChannel: Channel,
    setTimeout: (fn: () => void) => {
      timers.set(++sequence, fn);
      return sequence;
    },
    clearTimeout: (id: number) => timers.delete(id),
    location: { reload },
    window: { addEventListener: () => {} },
    fetch: network,
    importScripts: network,
  });
  await new Promise((r) => setTimeout(r, 0));
  return { document, elements, requests, reads, writes, reload, network, timers };
}
describe('embedded recovery fixed localization and message rendering', () => {
  for (const locale of ['en', 'pt-BR'])
    it.each([
      ['idle', 'Choose Repair online', 'Escolha Reparar com conexão'],
      ['offline', 'You appear to be offline', 'Você parece estar sem conexão'],
      ['busy', 'Repair is running', 'O reparo está em andamento'],
      ['failed', 'Repair failed', 'O reparo falhou'],
      ['timed-out', 'deadline', 'atingiu o prazo'],
      ['cancelled', 'Repair was cancelled', 'O reparo foi cancelado'],
      ['unknown', 'unknown or interrupted', 'desconhecido ou foi interrompido'],
      ['spent', 'previous attempt is spent', 'tentativa anterior foi utilizada'],
      ['complete', 'Reload or reopen Spendspacey', 'Recarregue ou reabra o Spendspacey'],
      ['unavailable', 'Repair is unavailable', 'reparo está indisponível'],
    ])(
      `renders %s explicitly in ${locale} without network or automatic repair`,
      async (status, en, pt) => {
        const p = await page(locale, status);
        expect(p.document.documentElement.lang).toBe(locale);
        expect(p.elements.get('status')!.textContent).toContain(locale === 'en' ? en : pt);
        expect(p.requests.map((r) => r.operation)).toEqual(['HELLO', 'CONFIRM']);
        expect(p.reads).toEqual(['spendspacey.locale']);
        expect(p.network).not.toHaveBeenCalled();
        expect(p.reload).not.toHaveBeenCalled();
        expect(p.elements.get('repair')!.disabled).toBe(
          ['busy', 'complete', 'unavailable'].includes(status),
        );
      },
    );
  it.each([
    [null, ['en-US', 'pt-BR'], 'en'],
    [null, ['pt-PT', 'en-US'], 'pt-BR'],
    ['unsupported', ['de-DE'], 'en'],
    ['<script>', ['invalid_tag', 'pt-BR'], 'pt-BR'],
    ['en', ['pt-BR'], 'en'],
    ['pt-BR', ['en-US'], 'pt-BR'],
  ])('preserves locale validation/detection order: %s %s', async (saved, languages, expected) => {
    const p = await page(saved, 'idle', { languages });
    expect(p.document.documentElement.lang).toBe(expected);
    expect(p.elements.get('intro')!.textContent).not.toContain('<script>');
  });
  it('handles denied locale storage and keeps language selection in memory', async () => {
    const p = await page(null, 'idle', { denied: true, languages: ['pt-BR'] });
    expect(p.document.documentElement.lang).toBe('pt-BR');
    const select = p.elements.get('language')!;
    select.value = 'en';
    select.listeners.get('change')!();
    expect(p.document.documentElement.lang).toBe('en');
    expect(p.writes).toEqual(['spendspacey.locale']);
  });
  it('guidance without verified binding has no repair/confirmation authority', async () => {
    const p = await page('en', 'idle', { binding: false });
    expect(p.elements.get('status')!.textContent).toContain('no verified document binding');
    expect(p.elements.get('repair')!.disabled).toBe(true);
    p.elements.get('repair')!.listeners.get('click')!();
    expect(p.requests.map((r) => r.operation)).toEqual(['HELLO']);
  });
  it('forged reply request IDs cannot unlock repair or supply rendered messages', async () => {
    const p = await page('en', 'idle', { badReply: true });
    expect(p.elements.get('repair')!.disabled).toBe(true);
    expect(p.requests).toHaveLength(1);
    expect(p.elements.get('status')!.textContent).not.toContain('forged');
  });
  it('only a deliberate click sends a new repair request; reconnect/status never does', async () => {
    const p = await page('en', 'failed');
    p.elements.get('check')!.listeners.get('click')!();
    await new Promise((r) => setTimeout(r, 0));
    expect(p.requests.some((r) => r.operation === 'REPAIR')).toBe(false);
    p.elements.get('repair')!.listeners.get('click')!();
    await new Promise((r) => setTimeout(r, 0));
    const repair = p.requests.filter((r) => r.operation === 'REPAIR');
    expect(repair).toHaveLength(1);
    expect(repair[0].binding).toBe('b'.repeat(64));
    expect(p.network).not.toHaveBeenCalled();
  });
});

it('metadata unavailability returns explicit recovery guidance and no confirmation or repair authority', async () => {
  const p = await page('en', 'unavailable', { binding: false });
  expect(p.elements.get('status')!.textContent).toContain('cannot safely access its saved state');
  expect(p.elements.get('repair')!.disabled).toBe(true);
  expect(p.requests.map((r) => r.operation)).toEqual(['HELLO']);
});
