-- Iro — Reddit Opportunity Finder
-- P1 core ingest schema. All tables prefixed `reddit_` so they coexist safely
-- in a shared Supabase project. Apply with the Supabase CLI, the SQL editor,
-- or the Supabase MCP.

create extension if not exists pgcrypto;

-- Subreddits we ingest from (seeded from config; suggestions land here in P3).
create table if not exists reddit_subreddits (
  name text primary key,
  origin text not null default 'seed' check (origin in ('seed', 'suggested', 'manual')),
  self_promo_allowed boolean,
  rules_json jsonb,
  rules_fetched_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Every post we've seen (upserted; first_seen_at preserved, last_seen_at bumped).
create table if not exists reddit_posts (
  id text primary key,               -- reddit fullname, e.g. t3_abc123
  short_id text not null,
  subreddit text not null,
  title text not null,
  selftext text not null default '',
  author text,
  permalink text not null,
  url text,
  created_utc bigint not null,
  num_comments integer not null default 0,
  score integer not null default 0,
  upvote_ratio real,
  over_18 boolean not null default false,
  locked boolean not null default false,
  removed boolean not null default false,
  source text not null check (source in ('new', 'rising', 'search')),
  search_keyword text,
  raw_json jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists reddit_posts_subreddit_idx on reddit_posts (subreddit);
create index if not exists reddit_posts_created_utc_idx on reddit_posts (created_utc desc);

-- Posts u/Kiro_ai has already engaged with (own public history + manual marks)
-- → used to dedup these out of the triage queue.
create table if not exists reddit_my_activity (
  post_id text primary key,
  source text not null default 'history' check (source in ('history', 'triage')),
  noted_at timestamptz not null default now()
);

-- Observability for scheduled runs (ingest / score / mine / digest).
create table if not exists reddit_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  counts_json jsonb,
  error text
);
create index if not exists reddit_ingest_runs_kind_idx on reddit_ingest_runs (kind, started_at desc);
