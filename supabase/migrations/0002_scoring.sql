-- Iro — Reddit Opportunity Finder
-- P2: scoring + triage + LLM usage logging, plus convenience views.

-- Per-post score (0–100) with the sub-score breakdown and one-line "why".
create table if not exists reddit_scores (
  post_id text primary key references reddit_posts(id) on delete cascade,
  relevance real not null,            -- 0..1 (LLM)
  intent real not null,               -- 0..1 (LLM)
  commentability real not null,       -- 0..1 (computed from metadata)
  mention_fit text not null check (mention_fit in ('helpful_only', 'iro_relevant')),
  mention_fit_score real not null,    -- numeric form used in the weighted base
  competitor_boost real not null default 0,
  saturation_penalty real not null default 0,
  freshness_bonus real not null default 0,
  total integer not null,             -- final 0..100
  why text,                           -- one-line LLM explanation
  model text,
  scored_at timestamptz not null default now()
);
create index if not exists reddit_scores_total_idx on reddit_scores (total desc);

-- Triage outcome per post.
create table if not exists reddit_triage (
  post_id text primary key references reddit_posts(id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'commented', 'dismissed', 'saved')),
  note text,
  acted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Central LLM cost log (every call, both providers).
create table if not exists reddit_llm_usage (
  id uuid primary key default gen_random_uuid(),
  call_type text not null,            -- score | cluster | draft | ...
  provider text,                      -- gemini | claude
  model text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists reddit_llm_usage_created_idx on reddit_llm_usage (created_at desc);

-- Posts that still need a score.
create or replace view reddit_unscored_posts as
  select p.*
  from reddit_posts p
  left join reddit_scores s on s.post_id = p.id
  where s.post_id is null;

-- Flat triage queue: scored posts joined to their triage status.
create or replace view reddit_triage_queue as
  select
    p.id as post_id, p.subreddit, p.title, p.permalink, p.author,
    p.created_utc, p.num_comments, p.score as post_score, p.locked, p.removed,
    s.relevance, s.intent, s.commentability, s.mention_fit,
    s.competitor_boost, s.saturation_penalty, s.freshness_bonus,
    s.total, s.why, s.model, s.scored_at,
    coalesce(t.status, 'new') as status, t.note, t.acted_at
  from reddit_posts p
  join reddit_scores s on s.post_id = p.id
  left join reddit_triage t on t.post_id = p.id;
