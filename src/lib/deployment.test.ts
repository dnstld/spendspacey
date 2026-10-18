import { expect, it } from 'vitest';
import { authenticationAllowed, type AuthenticationPolicy } from './deployment';

const canonical = 'https://synthetic-app.pages.dev';
const origins = [
  canonical,
  'https://deadbeef.synthetic-app.pages.dev',
  'https://unrelated.example.test',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
];
it('allows only the exact canonical origin for production, including denying loopback', () => {
  const policy: AuthenticationPolicy = { kind: 'production', origin: canonical };
  for (const origin of origins)
    expect(authenticationAllowed(origin, policy)).toBe(origin === canonical);
  for (const origin of [
    'http://synthetic-app.pages.dev',
    `${canonical}:444`,
    'https://synthetic-app.pages.dev.evil.test',
  ])
    expect(authenticationAllowed(origin, policy)).toBe(false);
});
it('keeps denied artifacts denied even at canonical and loopback origins', () => {
  for (const origin of origins)
    expect(authenticationAllowed(origin, { kind: 'denied' })).toBe(false);
});
it('uses a separate local policy with exact approved origins', () => {
  for (const origin of origins)
    expect(authenticationAllowed(origin, { kind: 'local' })).toBe(
      ['http://localhost:5173', 'http://127.0.0.1:4173'].includes(origin),
    );
  expect(authenticationAllowed('http://localhost:9999', { kind: 'local' })).toBe(false);
});
