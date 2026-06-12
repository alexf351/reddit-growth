-- Iro — Reddit Opportunity Finder
-- P11 (pro): curated "audiences" — named groups of subreddits you scope the
-- inbox to (GummySearch's retention hook).

create table if not exists reddit_audiences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subreddits text[] not null default '{}',
  created_at timestamptz not null default now()
);
