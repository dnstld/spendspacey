import type { SupabaseClient } from '@supabase/supabase-js';

const clientGenerations = new WeakMap<SupabaseClient, number>();

export function nextGeneration(client: SupabaseClient) {
  const generation = (clientGenerations.get(client) ?? 0) + 1;
  clientGenerations.set(client, generation);
  return generation;
}

export function isCurrentAuthGeneration(client: SupabaseClient, generation: number) {
  return clientGenerations.get(client) === generation;
}
