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
  keywords; you approve before anything is added.
- Creds live in `.env.local` (gitignored). `.env.example` documents every var.

## Stack

Next.js (App Router) + TypeScript · Supabase (`reddit_`-prefixed tables) ·
Tailwind v4 · Vercel Cron · Reddit official API · Gemini or Claude (configurable)
· Resend digest.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in creds (start with Reddit)
npm run dev                  # http://localhost:3000 — shows integration status
```

### Reddit creds (P0)

1. Go to <https://www.reddit.com/prefs/apps> → **create app** → type **script**.
2. Copy the client id (under the app name) and secret into `.env.local`:
   `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`.
3. Test ingestion from the CLI:

   ```bash
   npm run ingest:one            # first subreddit in config/targets.ts
   npm run ingest:one -- ClaudeAI
   ```

   Without creds this prints `NO DATA — needs creds` and exits cleanly.

## Configuration

Editable lists live in `config/`:

- `targets.ts` — target subreddits, keywords, negative keywords.
- `competitors.ts` — tracked competitor accounts (seed: `u/Simplilearn`).
- `scoring.ts` — scoring weights, modifiers, and thresholds (one tunable place).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server (status dashboard). |
| `npm run build` | Production build. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run ingest:one [sub]` | P0 end-to-end ingest of one subreddit (prints to console). |

## Build phases

- **P0 — scaffold + Reddit OAuth + ingest one subreddit end-to-end.** ← current
- P1 — full ingest (subs + keyword search) + dedup + Supabase storage.
- P2 — scoring + triage inbox UI.
- P3 — competitor comment-mining (sub map, patterns, cadence) + Competitor Intel page.
- P4 — subreddit self-promo-rule flagging + Resend daily digest.
- P5 — comment-draft generation.
- P6 — scheduling + polish.
