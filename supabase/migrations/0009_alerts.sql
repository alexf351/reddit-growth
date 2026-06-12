-- Iro — Reddit Opportunity Finder
-- P9 (pro): real-time alert dedup + per-subreddit daily volume for spike detection.

create table if not exists reddit_alerts_sent (
  post_id text primary key references reddit_posts(id) on delete cascade,
  sent_at timestamptz not null default now()
);

create or replace view reddit_subreddit_daily as
  select p.subreddit,
         to_char(date_trunc('day', first_seen_at), 'YYYY-MM-DD') as day,
         count(*)::int as n
  from reddit_posts p
  where first_seen_at > now() - interval '14 days'
  group by 1, 2;
