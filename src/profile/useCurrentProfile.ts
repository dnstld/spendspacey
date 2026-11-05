import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ProfileReadError, readCurrentProfile, type CurrentProfile } from './currentProfile';

export const currentProfileReadDeadlineMs = 8_000;

export type CurrentProfileStatus =
  'idle' | 'loading' | 'ready' | 'missing' | 'error' | 'offline' | 'stale';

export interface CurrentProfileState {
  ownerId: string | null;
  generation: number;
  status: CurrentProfileStatus;
  profile: CurrentProfile | null;
}

interface CoordinatedFlight {
  id: symbol;
  ownerId: string;
  promise: Promise<CurrentProfile | null>;
  subscribers: number;
  cancel: () => void;
}

interface CoordinatedRead {
  promise: Promise<CurrentProfile | null>;
  release: () => void;
}

const flights = new WeakMap<SupabaseClient, Map<number, CoordinatedFlight>>();

function coordinatedRead(client: SupabaseClient, ownerId: string, generation: number) {
  let clientFlights = flights.get(client);
  if (!clientFlights) {
    clientFlights = new Map();
    flights.set(client, clientFlights);
  }
  const current = clientFlights.get(generation);
  if (current) {
    if (current.ownerId !== ownerId) {
      return {
        promise: Promise.reject(new ProfileReadError()),
        release: () => undefined,
      } satisfies CoordinatedRead;
    }
    return subscribe(current, clientFlights, generation);
  }

  const controller = new AbortController();
  let rejectFlight!: (reason: ProfileReadError) => void;
  let settled = false;
  const interrupted = new Promise<never>((_resolve, reject) => {
    rejectFlight = reject;
  });
  const flightId = Symbol();
  const expire = () => {
    if (settled) return;
    if (clientFlights.get(generation)?.id === flightId) clientFlights.delete(generation);
    controller.abort();
    rejectFlight(new ProfileReadError());
  };
  const deadline = window.setTimeout(expire, currentProfileReadDeadlineMs);
  const promise = Promise.race([
    readCurrentProfile(client, ownerId, controller.signal),
    interrupted,
  ]).finally(() => {
    settled = true;
    window.clearTimeout(deadline);
    if (clientFlights.get(generation)?.id === flightId) clientFlights.delete(generation);
  });
  const flight = {
    id: flightId,
    ownerId,
    promise,
    subscribers: 0,
    cancel: expire,
  };
  clientFlights.set(generation, flight);
  return subscribe(flight, clientFlights, generation);
}

function subscribe(
  flight: CoordinatedFlight,
  clientFlights: Map<number, CoordinatedFlight>,
  generation: number,
): CoordinatedRead {
  flight.subscribers += 1;
  let released = false;
  return {
    promise: flight.promise,
    release: () => {
      if (released) return;
      released = true;
      flight.subscribers -= 1;
      queueMicrotask(() => {
        if (flight.subscribers === 0 && clientFlights.get(generation) === flight) flight.cancel();
      });
    },
  };
}

export function useCurrentProfile({
  client,
  ownerId,
  generation,
  enabled,
}: {
  client: SupabaseClient;
  ownerId: string | null;
  generation: number;
  enabled: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CurrentProfileState>({
    ownerId: null,
    generation: 0,
    status: 'idle',
    profile: null,
  });
  if (
    (!ownerId || !enabled) &&
    (state.ownerId !== null ||
      state.generation !== generation ||
      state.status !== 'idle' ||
      state.profile !== null)
  ) {
    setState({
      ownerId: null,
      generation,
      status: 'idle',
      profile: null,
    });
  }

  useEffect(() => {
    let active = true;
    let request: CoordinatedRead | null = null;
    const applies = () => active;
    if (!ownerId || !enabled) {
      return () => {
        active = false;
      };
    }

    const updateOffline = () => {
      if (!applies()) return;
      setState((previous) => {
        const profile =
          previous.ownerId === ownerId && previous.generation === generation
            ? previous.profile
            : null;
        return {
          ownerId,
          generation,
          status: profile ? 'stale' : 'offline',
          profile,
        };
      });
    };
    const load = () => {
      if (navigator.onLine === false) {
        updateOffline();
        return;
      }
      if (request) return;
      setState((previous) => ({
        ownerId,
        generation,
        status: 'loading',
        profile:
          previous.ownerId === ownerId && previous.generation === generation
            ? previous.profile
            : null,
      }));
      const currentRequest = coordinatedRead(client, ownerId, generation);
      request = currentRequest;
      void currentRequest.promise.then(
        (profile) => {
          currentRequest.release();
          if (request === currentRequest) request = null;
          if (!applies()) return;
          setState({
            ownerId,
            generation,
            status: profile ? 'ready' : 'missing',
            profile,
          });
        },
        () => {
          currentRequest.release();
          if (request === currentRequest) request = null;
          if (!applies()) return;
          setState({
            ownerId,
            generation,
            status: navigator.onLine === false ? 'offline' : 'error',
            profile: null,
          });
        },
      );
    };
    const foreground = () => {
      if (document.visibilityState === 'visible') load();
    };

    load();
    window.addEventListener('online', load);
    window.addEventListener('offline', updateOffline);
    document.addEventListener('visibilitychange', foreground);
    return () => {
      active = false;
      request?.release();
      request = null;
      window.removeEventListener('online', load);
      window.removeEventListener('offline', updateOffline);
      document.removeEventListener('visibilitychange', foreground);
    };
  }, [attempt, client, enabled, generation, ownerId]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const matches =
    enabled && state.ownerId === ownerId && state.generation === generation && ownerId !== null;
  return {
    state: matches
      ? state
      : ({
          ownerId,
          generation,
          status: ownerId && enabled ? 'loading' : 'idle',
          profile: null,
        } satisfies CurrentProfileState),
    retry,
  };
}
