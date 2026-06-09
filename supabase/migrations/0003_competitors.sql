-- Iro — Reddit Opportunity Finder
-- P3: competitor comment-mining, config suggestions, competitor-present signals.

-- Allow posts discovered via competitor mining.
alter table reddit_posts drop constraint if exists reddit_posts_source_check;
alter table reddit_posts
  add constraint reddit_posts_source_check
  check (source in ('new', 'rising', 'search', 'competitor'));

create table if not exists reddit_competitors (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  label text not null,
  origin text not null default 'seed' check (origin in ('seed', 'manual')),
  active boolean not null default true,
  last_mined_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists reddit_competitor_comments (
  id text primary key,                 -- reddit fullname t1_...
  competitor_id uuid not null references reddit_competitors(id) on delete cascade,
  body text not null default '',
  permalink text not null,
  created_utc bigint not null,
  score integer not null default 0,
  parent_post_id text not null,        -- t3_...
  parent_title text,
  parent_subreddit text,
  fetched_at timestamptz not null default now()
);
create index if not exists reddit_competitor_comments_competitor_idx
  on reddit_competitor_comments (competitor_id, created_utc desc);
create index if not exists reddit_competitor_comments_sub_idx
  on reddit_competitor_comments (parent_subreddit);

-- Which competitor(s) commented on a post → drives the competitor-present badge.
create table if not exists reddit_post_competitors (
  post_id text not null references reddit_posts(id) on delete cascade,
  competitor_id uuid not null references reddit_competitors(id) on delete cascade,
  competitor_username text not null,
  comment_id text,
  comment_permalink text,
  created_at timestamptz not null default now(),
  primary key (post_id, competitor_id)
);

-- Computed per-thread saturation (count of promo/recommendation replies).
create table if not exists reddit_post_signals (
  post_id text primary key references reddit_posts(id) on delete cascade,
  promo_reply_count integer not null default 0,
  checked_at timestamptz not null default now()
);

-- Suggested additions to the target lists — approved by a human before use.
create table if not exists reddit_suggestions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('subreddit', 'keyword')),
  value text not null,
  rationale text,
  evidence_json jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (type, value)
);

-- Rebuild the triage queue view to carry competitor-present + saturation info.
create or replace view reddit_triage_queue as
  select
    p.id as post_id, p.subreddit, p.title, p.permalink, p.author,
    p.created_utc, p.num_comments, p.score as post_score, p.locked, p.removed,
    s.relevance, s.intent, s.commentability, s.mention_fit,
    s.competitor_boost, s.saturation_penalty, s.freshness_bonus,
    s.total, s.why, s.model, s.scored_at,
    coalesce(t.status, 'new') as status, t.note, t.acted_at,
    coalesce(pc.competitor_count, 0) as competitor_count,
    pc.competitors_json,
    coalesce(sig.promo_reply_count, 0) as promo_reply_count
  from reddit_posts p
  join reddit_scores s on s.post_id = p.id
  left join reddit_triage t on t.post_id = p.id
  left join (
    select
      post_id,
      count(*) as competitor_count,
      jsonb_agg(jsonb_build_object('username', competitor_username, 'commentPermalink', comment_permalink)) as competitors_json
    from reddit_post_competitors
    group by post_id
  ) pc on pc.post_id = p.id
  left join reddit_post_signals sig on sig.post_id = p.id;
