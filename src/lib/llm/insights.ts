/**
 * Cluster recent high-signal posts (pain points + solution/advice requests)
 * into named themes with counts and representative threads — the "what does
 * this audience keep asking for" research deliverable.
 */
import { product } from "@config/product";
import { generateJSON, type LlmUsage } from "./provider";

export interface InsightInput {
  title: string;
  permalink: string;
  category: string | null;
}

export interface InsightTheme {
  theme: string;
  summary: string;
  count: number;
  examples: { title: string; permalink: string }[];
}

interface RawThemes {
  themes: { theme: string; summary: string; example_numbers: number[] }[];
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    themes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          theme: { type: "string", description: "short label for the recurring need/pain" },
          summary: { type: "string", description: "one or two sentences on what people want and why" },
          example_numbers: { type: "array", items: { type: "integer" }, description: "the list numbers of posts in this theme" },
        },
        required: ["theme", "summary", "example_numbers"],
      },
    },
  },
  required: ["themes"],
};

export async function clusterInsights(
  posts: InsightInput[],
): Promise<{ themes: InsightTheme[]; usage: LlmUsage }> {
  const sample = posts.slice(0, 150);
  const numbered = sample.map((p, i) => `${i + 1}. [${p.category ?? "?"}] ${p.title}`).join("\n");

  const system =
    `You do audience research for ${product.name}. ${product.description} ` +
    `You cluster Reddit posts into the recurring pains and requests the audience keeps raising.`;
  const user =
    `Here are recent high-signal posts (pain / solution / advice):\n${numbered}\n\n` +
    `Cluster them into up to 10 recurring themes. For each theme give a short label, a 1-2 sentence ` +
    `summary of what people want and why it matters, and example_numbers (the list numbers above that belong to it). ` +
    `Prefer specific, actionable themes over vague ones.`;

  const { data, usage } = await generateJSON<RawThemes>({ system, user, schema, maxTokens: 1200 });

  const themes: InsightTheme[] = (data.themes ?? [])
    .map((t) => {
      const examples = (t.example_numbers ?? [])
        .map((n) => sample[n - 1])
        .filter((p): p is InsightInput => Boolean(p))
        .slice(0, 5)
        .map((p) => ({ title: p.title, permalink: p.permalink }));
      return { theme: t.theme, summary: t.summary, count: t.example_numbers?.length ?? examples.length, examples };
    })
    .filter((t) => t.theme && t.examples.length > 0)
    .sort((a, b) => b.count - a.count);

  return { themes, usage };
}
