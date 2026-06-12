-- Iro — Reddit Opportunity Finder
-- P5: human-reviewed comment drafts. Never auto-posted — these are suggestions
-- you edit and copy. No write path to Reddit exists anywhere in this codebase.

create table if not exists reddit_drafts (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references reddit_posts(id) on delete cascade,
  variant integer not null default 1,
  body text not null,
  mentions_iro boolean not null default false,
  model text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists reddit_drafts_post_idx on reddit_drafts (post_id, created_at desc);
