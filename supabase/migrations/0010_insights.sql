-- Iro — Reddit Opportunity Finder
-- P10 (pro): stored audience-insight clusters (pain points / recurring asks).

create table if not exists reddit_insights (
  id uuid primary key default gen_random_uuid(),
  batch_at timestamptz not null default now(),
  theme text not null,
  summary text,
  count integer not null default 0,
  examples_json jsonb,
  created_at timestamptz not null default now()
);
create index if not exists reddit_insights_batch_idx on reddit_insights (batch_at desc);
