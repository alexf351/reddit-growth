/**
 * Server-side Supabase client (service role). Only ever imported from server
 * code (route handlers, lib, scripts) — never from a client component.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

export function hasSupabaseCreds(): boolean {
  return !!getEnv("SUPABASE_URL") && !!getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export class MissingSupabaseCredsError extends Error {
  constructor() {
    super("NO DATA — needs creds (Supabase): set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    this.name = "MissingSupabaseCredsError";
  }
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!hasSupabaseCreds()) throw new MissingSupabaseCredsError();
  if (!client) {
    client = createClient(getEnv("SUPABASE_URL")!, getEnv("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
