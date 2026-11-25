import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { deferred } from '../../test/authMock';
import { useResource } from './use-resource';

it('ignores a late result after switching wallets, even when the transport delivers after abort', async () => {
  const old = deferred<string>();
  const next = deferred<string>();
  const { result, rerender } = renderHook(({ key, read }) => useResource(key, true, read), {
    initialProps: { key: 'old-wallet', read: () => old.promise },
  });

  rerender({ key: 'next-wallet', read: () => next.promise });
  expect(result.current.data).toBeUndefined();
  await act(() => next.resolve('Next wallet'));
  await waitFor(() => expect(result.current.data).toBe('Next wallet'));
  await act(() => old.resolve('Old wallet'));
  expect(result.current.data).toBe('Next wallet');
});
