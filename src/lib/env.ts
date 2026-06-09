/** Tiny env helpers + honest "NO DATA" handling for un-wired integrations. */

export function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : undefined;
}

export const NO_DATA = "NO DATA — needs creds";

export interface CredStatus {
  reddit: boolean;
  supabase: boolean;
  llm: boolean;
  resend: boolean;
}

export function credStatus(): CredStatus {
  return {
    reddit: !!getEnv("REDDIT_CLIENT_ID") && !!getEnv("REDDIT_CLIENT_SECRET"),
    supabase: !!getEnv("SUPABASE_URL") && !!getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    llm: !!(getEnv("GEMINI_API_KEY") || getEnv("ANTHROPIC_API_KEY")),
    resend: !!getEnv("RESEND_API_KEY"),
  };
}
