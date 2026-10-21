import type { Generations } from '../worker/generations';
import type { StaticFixture } from './staticGenerations';

export function barrier<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

// Retain the callback deliberately: tests also exercise callbacks already queued
// before disarm. No elapsed-time assumption establishes ordering.
export class RepairDeadline {
  callback?: () => void;
  armed = false;
  constructor(private readonly record: (event: string) => void = () => {}) {}
  schedule = (callback: () => void) => {
    this.callback = callback;
    this.armed = true;
    this.record('deadline armed');
    return () => {
      const selected = this.armed;
      this.armed = false;
      this.record(selected ? 'terminal decision frozen; deadline disarmed' : 'finalization disarm');
    };
  };
  fire() {
    if (!this.callback) throw Error('Deadline not armed');
    this.record('deadline callback');
    this.callback();
  }
}

export function blockRepair(f: StaticFixture, g: Generations) {
  const entered = barrier<Request>();
  const fetch = g.host.fetch;
  f.delayPath = '/assets/supabase-sharedxx.js';
  f.releaseDelay = undefined;
  g.host.fetch = (request) => {
    const result = fetch(request);
    if (new URL(request.url).pathname === f.delayPath) entered.resolve(request);
    return result;
  };
  return {
    entered: entered.promise,
    release: () => {
      if (!f.releaseDelay) throw Error('Request has not reached its barrier');
      f.releaseDelay();
    },
  };
}
