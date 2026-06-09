/**
 * Draft comment generation. Answers the person's actual question first, in a
 * real human voice. Iro is mentioned only on iro-relevant items and always
 * disclosed as my app; helpful-only items never mention it. For competitor
 * threads the draft beats the competitor's comment on substance.
 *
 * Output only — these are suggestions to edit and copy. Nothing is posted.
 */
import { product } from "@config/product";
import { generateJSON, type LlmUsage } from "./provider";

export interface GeneratedDraft {
  body: string;
  mentionsIro: boolean;
}

interface RawDraft {
  body: string;
  mentions_iro: boolean;
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    drafts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          body: { type: "string" },
          mentions_iro: { type: "boolean" },
        },
        required: ["body", "mentions_iro"],
      },
    },
  },
  required: ["drafts"],
};

export interface DraftRequest {
  title: string;
  body: string;
  subreddit: string;
  mentionFit: "helpful_only" | "iro_relevant";
  competitorComments: string[];
}

export async function generateDrafts(
  req: DraftRequest,
): Promise<{ drafts: GeneratedDraft[]; usage: LlmUsage }> {
  const allowIro = req.mentionFit === "iro_relevant";

  const system =
    `You write Reddit comment drafts for u/${product.handle}. ` +
    `Voice: ${product.voice} ` +
    `Hard rules: answer the person's actual question first and genuinely well; lowercase-casual; ` +
    `no em dashes; no corporate or marketing tone; never a drive-by link. ` +
    (allowIro
      ? `You MAY mention ${product.name} in at most ONE draft, only where it genuinely helps, and you MUST disclose it's my own app (e.g. "i built" / "my app"). Context: ${product.description}`
      : `Do NOT mention ${product.name} in any draft.`);

  const comp =
    req.competitorComments.length > 0
      ? `\n\nA competitor already commented on this thread:\n` +
        req.competitorComments
          .slice(0, 3)
          .map((c) => `"""${c.slice(0, 600)}"""`)
          .join("\n") +
        `\nWrite a reply that beats this on substance — actually answer the question they pattern-matched past. Do not just plug harder.`
      : "";

  const user =
    `Subreddit: r/${req.subreddit}\nPost title: ${req.title}\nPost body: ${req.body || "(none)"}${comp}\n\n` +
    `Write ${allowIro ? 2 : 1} draft comment(s). ` +
    (allowIro
      ? `Make one draft purely helpful with no mention. In the other you may helpfully mention ${product.name} (set mentions_iro true for that one only).`
      : `Set mentions_iro false for every draft.`);

  const { data, usage } = await generateJSON<{ drafts: RawDraft[] }>({
    system,
    user,
    schema,
    maxTokens: 900,
  });

  let drafts: GeneratedDraft[] = (data.drafts ?? []).slice(0, 2).map((d) => ({
    body: String(d.body ?? "").trim(),
    mentionsIro: Boolean(d.mentions_iro) && allowIro,
  }));
  if (!allowIro) drafts = drafts.map((d) => ({ ...d, mentionsIro: false }));
  drafts = drafts.filter((d) => d.body.length > 0);

  return { drafts, usage };
}
