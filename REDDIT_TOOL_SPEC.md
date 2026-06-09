# Iro — Reddit Opportunity Finder (REDDIT_TOOL_SPEC.md)

## Objective

Surface the best Reddit threads each day where a genuinely helpful comment from me (u/Kiro_ai) would naturally fit, and where mentioning Iro would actually help the person rather than spam them. The tool finds, scores, explains, and drafts. I comment manually. It also mines competitor accounts to learn where the demand is and which threads to out-answer.

## Read this first (constraints)

- New standalone project. Do NOT touch the Iro-App repo or tryiro.com prod. (Fold into the analytics-dashboard repo only if I tell you to.)
- **Read-only Reddit.** NEVER auto-post, auto-comment, upvote, vote, or DM. Human-in-the-loop only: the tool drafts, I post. Auto-posting from my account means a shadowban/permaban and kills the honest-reviewer positioning that's my whole edge. Not worth it.
- One identity, my real handle (u/Kiro_ai). No sockpuppets, no vote manipulation, no mass templated replies.
- **Competitor mining uses only public comment history** (the same read-only API). Learn from what they post publicly. Never contact, reply to, or interact with competitor accounts.
- Registered Reddit app required (OAuth, "script" type). Respect API rate limits. Creds in `.env`, never committed.
- Never fabricate data. If a source isn't wired, stub the adapter and show "NO DATA — needs creds". No fake numbers.
- LLM calls cost money. Make model + frequency configurable; log token usage.

## Stack (use unless you flag a strong reason in your plan)

Next.js (App Router) + TypeScript on Vercel. Supabase for timestamped storage (new `reddit_` prefixed tables). Tailwind + shadcn/ui. Vercel Cron for scheduled pulls. Reddit official API for search, new/rising posts, and public user comment history. Relevance/intent/clustering/draft via Gemini or Claude API (configurable). Email digest via Resend (I have it).

## How it finds opportunities

- **Config file** with three lists I can edit:
  - Target subreddits — seed with: r/ChatGPT, r/OpenAI, r/ClaudeAI, r/artificial, r/ArtificialIntelligence, r/PromptEngineering, r/perplexity_ai, the Gemini sub, r/productivity, r/selfimprovement, r/careerguidance, r/learnprogramming, r/Entrepreneur, r/sidehustle, plus the question-farm subs competitors use (r/cscareerquestions, r/AskProgramming, r/techbootcamp, r/AI_Agents, r/aiagents, r/AILearningHub, r/GenAI4all, r/AIIncomeLab). (I'll prune.)
  - Keywords/topics — e.g. "how to learn AI", "get better at prompting", "ChatGPT for work", "AI skills for my job", "which AI course", "is X course worth it", "learn AI as a beginner", "best path to becoming a developer 2026", "worth learning to code in 2026".
  - Negative keywords — to cut obvious noise.
- Pull new + rising posts from the target subs AND run keyword search across Reddit. Dedup against posts already seen and posts I've already commented on.
- **Score each post 0–100** from sub-scores (weights in one tunable config):
  - **Relevance** (LLM): does the topic match what Iro actually helps with?
  - **Intent** (LLM): is this person looking for a solution / help / recommendation, vs. venting, news, or meta? High intent = high value.
  - **Commentability:** is it a question/help post where a real answer fits? Factor freshness (early = more visibility), engagement, and that it isn't locked/removed.
  - **Mention-fit:** would naming Iro genuinely help here, or should I just be helpful with no mention? Tag each item **helpful-only** vs **iro-relevant**.
  - **Competitor-present boost:** if a tracked competitor already commented on the thread, bump the score. They've validated it's worth answering and I can show up with a better reply.
  - **Saturation penalty:** if the thread already has several promo/recommendation replies, lower it. Piling on looks spammy and it's hard to stand out.
- For each post's subreddit, pull its self-promotion rules (sub rules/wiki where available) and flag whether self-promo / linking is allowed. Default assumption: strict, be helpful-first.

## Competitor comment-mining

This is the differentiator. Reverse-engineer what's already working in the niche instead of guessing.

- Track a configurable list of **competitor Reddit accounts**. Seed with **u/Simplilearn** (proven: ~5 promo comments/day across AI-learning subs). Add others I find (e.g. Coursiv's account if one exists).
- On a schedule, pull each account's **public comment history** (Reddit user endpoint). Store every comment + its parent post (sub, title, topic, age, score).
- Extract and surface:
  - **Sub map:** which subreddits each competitor comments in + frequency → a ranked picture of where the demand actually is.
  - **Question/topic patterns** (LLM clustering): the recurring post types their comments attach to (e.g. "how do I learn AI from scratch", "is course X worth it", "should I learn to code in 2026") → the exact prompts that pull a recommend-a-course answer.
  - **Cadence:** how often and how fast they comment (e.g. within hours of a post going up).
- Two outputs:
  1. **Config suggestions:** auto-suggest new subreddits + keywords for my target lists based on where competitors are active and what they farm. I approve before anything is added — no silent list changes.
  2. **Out-answer opportunities:** inject the actual threads competitors commented on into the triage queue, tagged **competitor present** + which competitor + a link to their comment, so I can show up with a better answer. Use the saturation flag to skip lost causes and prioritize where a genuinely better reply can win.

## Triage UI (inbox)

- A ranked daily queue: post title, subreddit, score + breakdown, a one-line "why this matters", link to the thread, self-promo flag, freshness, and a **competitor-present badge** (which competitor + link to their comment) where relevant.
- Per-item actions: mark **commented** / **dismissed** / **save for later**. Track the outcome.
- Filters by subreddit, score, mention-fit tag, competitor-present, and status.
- A **Competitor Intel** page: per-competitor sub map, top question patterns, posting cadence, and the pending list of suggested subs/keywords for me to approve or reject.

## Comment drafts (optional module, human-reviewed, never auto-posted)

- When I open an item, generate 1–2 draft comments that **answer the person's actual question first**, in a real human voice: lowercase-casual, no em dashes, no corporate/marketing tone.
- Iro is mentioned only on **iro-relevant** items, only where it genuinely helps, and always disclosed as my app, never a drive-by link. **Helpful-only** items get a draft with no mention at all.
- For **competitor-present** threads, the draft beats the competitor's comment on substance (actually answers the question they pattern-matched past), it doesn't just plug harder.
- Drafts are suggestions I edit. The tool copies to clipboard; it does not post anything.

## Delivery & scheduling

- Vercel Cron pulls + scores on a schedule (e.g. every few hours).
- Daily email digest via Resend with the top N opportunities + a one-line why for each + links into the triage UI. Include a short "competitor activity" section: new subs/patterns detected, new out-answer threads. (Optional Telegram push later.)

## How to proceed (do this in order)

1. **Plan first. Do not write code.** Reply with: folder structure, the Reddit API auth flow, the data model (posts, comments, competitors, scores, suggestions), the scoring config schema, the exact creds you need from me (and where each comes from), and open questions. **Stop and wait for my approval.**
2. Then build in **phases**, each runnable + committed separately, pausing after each:
   - **P0:** scaffold + Reddit OAuth + ingest one subreddit end-to-end.
   - **P1:** full ingest (subs + keyword search) + dedup + Supabase storage.
   - **P2:** scoring (relevance / intent / commentability / mention-fit) + triage inbox UI.
   - **P3:** competitor comment-mining — pull competitor histories, build sub map + question-pattern clustering + cadence, surface config suggestions, inject competitor-present opportunities with saturation flag, add the Competitor Intel page.
   - **P4:** subreddit self-promo-rule flagging + Resend daily digest.
   - **P5:** comment-draft generation.
   - **P6:** scheduling + polish.
3. Every phase: read-only Reddit, never auto-post, never fabricate data, stub missing-cred sources as "NO DATA", ask one question at a time if anything about architecture is unclear.

## Definition of done

A daily triage inbox + email digest that reliably surfaces the handful of Reddit threads worth my comment, each scored and explained, with competitor-present threads flagged so I can out-answer them, a Competitor Intel view showing where rivals are farming, and optional helpful-first drafts I edit and post myself.
