-- Iro — Reddit Opportunity Finder
-- P8 (pro): analytics views for the dashboard. All computed from existing
-- timestamps/columns — no new data collection required.

create or replace view reddit_dashboard_categories as
  select coalesce(category, 'uncategorized') as category,
         count(*)::int as n,
         coalesce(round(avg(total)), 0)::int as avg_total
  from reddit_scores
  group by 1
  order by n desc;

create or replace view reddit_dashboard_sentiment as
  select coalesce(sentiment, 'neutral') as sentiment, count(*)::int as n
  from reddit_scores
  group by 1;

create or replace view reddit_dashboard_subreddits as
  select p.subreddit,
         count(*)::int as n,
         coalesce(round(avg(s.total)), 0)::int as avg_total,
         max(s.total)::int as max_total
  from reddit_posts p
  join reddit_scores s on s.post_id = p.id
  group by p.subreddit
  order by n desc;

create or replace view reddit_dashboard_funnel as
  select coalesce(t.status, 'new') as status, count(*)::int as n
  from reddit_scores s
  left join reddit_triage t on t.post_id = s.post_id
  group by 1;

create or replace view reddit_daily_volume as
  select to_char(date_trunc('day', first_seen_at), 'YYYY-MM-DD') as day,
         count(*)::int as n
  from reddit_posts
  where first_seen_at > now() - interval '30 days'
  group by 1
  order by 1;
