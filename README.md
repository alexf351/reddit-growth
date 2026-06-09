# Iro — Reddit Opportunity Finder

Read-only, human-in-the-loop tool that surfaces the best Reddit threads each day
where a genuinely helpful comment from **u/Kiro_ai** would fit — scored,
explained, and (optionally) drafted. **You** comment manually. It also mines
competitor accounts' public comment history to learn where demand is and which
threads to out-answer.

> Full product spec: [`REDDIT_TOOL_SPEC.md`](./REDDIT_TOOL_SPEC.md)

## Guardrails (non-negotiable)

- **Read-only Reddit.** No auto-post / comment / vote / DM anywhere in the code.
  The Reddit client is GET-only and authenticates app-only by default (a token
  that structurally cannot act as a user).
- **No fabricated data.** Any integration without creds renders
  `NO DATA — needs creds` instead of fake numbers.
- **No silent list changes.** Competitor mining only *suggests* subreddits /
  keywords; you approve in the app before anything is used.
- Creds live in `.env.local` (gitignored). `.env.example` documents every var.

## Stack

Next.js (App Router) + TypeScript · Supabase (`reddit_`-prefixed tables) ·
Tailwind v4 · Vercel Cron · Reddit official API · Gemini or Claude (configurable)
· Resend digest.

## How it works

```
ingest ─▶ score ─▶ triage inbox  (rank + filter + mark commented/saved/dismissed)
   ▲         ▲            │
   │      signals         └─▶ item page ─▶ drafts (copy, never posted)
   │     (competitor /
   │      saturation)
mine competitors ─▶ sub map · cadence · question patterns
                 ├─▶ suggestions (you approve → merged into ingest)
                 └─▶ competitor-present threads injected into the queue
rules ─▶ per-subreddit self-promo flag        digest ─▶ daily email (top N + competitor activity)
```

## Getting started

```bash
npm install
cp .env.example .env.local      # fill in creds (start with Reddit)
npm run dev                     # http://localhost:3000
```

1. **Reddit (P0):** create a **script** app at <https://www.reddit.com/prefs/apps>,
   put the id/secret in `.env.local` (`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`).
   Test: `npm run ingest:one -- ClaudeAI`.
2. **Supabase (P1):** create a project, paste `SUPABASE_URL` +
   `SUPABASE_SERVICE_ROLE_KEY`, and apply everything in `supabase/migrations/`
   (SQL editor, `supabase db push`, or the Supabase MCP).
3. **LLM (P2):** `LLM_PROVIDER=gemini` (+ `GEMINI_API_KEY`) or `claude`
   (+ `ANTHROPIC_API_KEY`). Optional `LLM_MODEL` override.
4. **Resend (P4):** `RESEND_API_KEY`, `DIGEST_FROM` (verified sender), `DIGEST_TO`.

Then run the pipeline and open the inbox:

```bash
npm run pipeline                # ingest → score → mine
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev / build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run ingest:one [sub]` | P0 single-subreddit ingest (console) |
| `npm run ingest` | Full ingest: subs + keyword search + dedup → Supabase |
| `npm run score [limit]` | Score unscored posts (relevance/intent/mention-fit) |
| `npm run mine` | Mine competitor histories → threads + suggestions |
| `npm run rules` | Refresh per-subreddit self-promo flags |
| `npm run digest` | Send the daily Resend digest |
| `npm run pipeline` | ingest → score → mine in one go |

## Configuration

Editable lists live in `config/`:

- `targets.ts` — target subreddits, keywords, negative keywords.
- `competitors.ts` — tracked competitor accounts (seed: `u/Simplilearn`).
- `scoring.ts` — weights, modifiers, thresholds (one tunable place).
- `product.ts` — what Iro is + the draft voice (edit for accurate scoring).

## Deployment (Vercel + Supabase)

1. Import the repo into Vercel; add all `.env.local` vars as project env vars
   (set `APP_URL` to the deployment URL and a random `CRON_SECRET`).
2. Apply `supabase/migrations/` to your Supabase project.
3. `vercel.json` defines the cron schedule (ingest every 4h, score every 4h,
   mine daily, rules weekly, digest daily). Vercel sends
   `Authorization: Bearer $CRON_SECRET` to the `/api/cron/*` routes.

   > **Plan note:** sub-daily crons and 60s function durations need Vercel
   > **Pro**. On **Hobby**, reduce to daily crons (and large runs may need the
   > `?limit=` bound on `/api/cron/score`). You can always run `npm run pipeline`
   > manually instead.

## Cost

Every LLM call's token usage is logged to `reddit_llm_usage`; cumulative totals
show on `/status`. Control spend via `LLM_PROVIDER` / `LLM_MODEL`, the
`/api/cron/score?limit=` bound, and the cron frequency in `vercel.json`.

## Build phases (all shipped)

P0 scaffold + Reddit OAuth · P1 ingest + storage · P2 scoring + triage inbox ·
P3 competitor mining + Competitor Intel · P4 self-promo flags + digest ·
P5 comment drafts · P6 scheduling + polish.
