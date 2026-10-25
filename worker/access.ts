// Classify rejected storage operations at their source; metadata validators never
// infer retryability from exception text. Structural/size/integrity failures stay invalid.
export class StorageAccessFailure extends Error {
  constructor(cause: unknown) {
    super('Storage access unavailable', { cause });
  }
}
export async function storageAccess<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (cause) {
    throw cause instanceof StorageAccessFailure ? cause : new StorageAccessFailure(cause);
  }
}
export function accessibleCaches(caches: CacheStorage): CacheStorage {
  const wrap = <T extends object>(object: T, cache = false): T =>
    new Proxy(object, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) =>
          storageAccess(async () => {
            const result = await Reflect.apply(value, target, args);
            return !cache && key === 'open' ? wrap(result as Cache, true) : result;
          });
      },
    });
  return wrap(caches);
}
