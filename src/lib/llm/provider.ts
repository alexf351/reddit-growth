/**
 * LLM provider abstraction. Default Gemini (cheap for high-volume scoring),
 * Claude switchable via LLM_PROVIDER=claude. Both paths return parsed JSON plus
 * token usage. We instruct strict JSON and parse defensively so the same code
 * works across configurable models. Without a key it throws MissingLlmCredsError,
 * which callers turn into "NO DATA — needs creds".
 */
import { getEnv } from "@/lib/env";

export type LlmProvider = "gemini" | "claude";

export interface LlmUsage {
  provider: LlmProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface GenerateJSONOptions {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}

export interface GenerateResult<T> {
  data: T;
  usage: LlmUsage;
}

export class MissingLlmCredsError extends Error {
  constructor(provider: LlmProvider) {
    const key = provider === "claude" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY";
    super(`NO DATA — needs creds (LLM): set ${key} (LLM_PROVIDER=${provider})`);
    this.name = "MissingLlmCredsError";
  }
}

export function llmProvider(): LlmProvider {
  return (getEnv("LLM_PROVIDER") ?? "gemini").toLowerCase() === "claude" ? "claude" : "gemini";
}

export function hasLlmCreds(): boolean {
  return llmProvider() === "claude" ? !!getEnv("ANTHROPIC_API_KEY") : !!getEnv("GEMINI_API_KEY");
}

function modelFor(provider: LlmProvider): string {
  const override = getEnv("LLM_MODEL");
  if (override) return override;
  return provider === "claude" ? "claude-opus-4-8" : "gemini-2.0-flash";
}

function extractJSON(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("LLM did not return valid JSON");
  }
}

export async function generateJSON<T>(opts: GenerateJSONOptions): Promise<GenerateResult<T>> {
  const provider = llmProvider();
  if (!hasLlmCreds()) throw new MissingLlmCredsError(provider);

  const user = `${opts.user}\n\nReturn ONLY a single JSON object matching this schema (no prose, no code fences):\n${JSON.stringify(opts.schema)}`;
  const req = { system: opts.system, user, maxTokens: opts.maxTokens ?? 800 };

  return provider === "claude" ? claudeJSON<T>(req) : geminiJSON<T>(req);
}

interface ProviderRequest {
  system: string;
  user: string;
  maxTokens: number;
}

async function claudeJSON<T>(req: ProviderRequest): Promise<GenerateResult<T>> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: getEnv("ANTHROPIC_API_KEY")! });
  const model = modelFor("claude");

  const res = await client.messages.create({
    model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
  });

  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");

  return {
    data: extractJSON(text) as T,
    usage: {
      provider: "claude",
      model,
      promptTokens: res.usage.input_tokens,
      completionTokens: res.usage.output_tokens,
    },
  };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

async function geminiJSON<T>(req: ProviderRequest): Promise<GenerateResult<T>> {
  const model = modelFor("gemini");
  const key = getEnv("GEMINI_API_KEY")!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const body = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: "user", parts: [{ text: req.user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: req.maxTokens,
      temperature: 0.2,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${t.slice(0, 200)}`);
  }

  const json = (await res.json()) as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  return {
    data: extractJSON(text) as T,
    usage: {
      provider: "gemini",
      model,
      promptTokens: json.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}
