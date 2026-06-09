/** LLM clustering of competitor-attached post titles into recurring patterns. */
import { product } from "@config/product";
import { generateJSON, type LlmUsage } from "./provider";

export interface QuestionPattern {
  label: string;
  keyword: string;
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    patterns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string", description: "short human label for the pattern" },
          keyword: { type: "string", description: "a 3-6 word search phrase to find similar threads" },
        },
        required: ["label", "keyword"],
      },
    },
  },
  required: ["patterns"],
};

export async function clusterQuestionPatterns(
  titles: string[],
): Promise<{ patterns: QuestionPattern[]; usage: LlmUsage }> {
  const sample = titles.slice(0, 120);
  const system =
    `You analyze Reddit post titles that competitors of ${product.name} attach ` +
    `recommend-a-resource comments to. Identify the recurring question/topic patterns ` +
    `that pull a "recommend a course/tool" answer.`;
  const user =
    `Post titles competitors commented on:\n` +
    sample.map((t, i) => `${i + 1}. ${t}`).join("\n") +
    `\n\nCluster these into up to 10 recurring patterns. For each, give a short label and a ` +
    `concise search keyword phrase (3-6 words) I could add to my keyword list to find similar threads.`;

  const { data, usage } = await generateJSON<{ patterns: QuestionPattern[] }>({
    system,
    user,
    schema,
    maxTokens: 800,
  });
  return { patterns: (data.patterns ?? []).slice(0, 10), usage };
}
