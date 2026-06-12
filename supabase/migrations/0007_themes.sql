-- Iro — Reddit Opportunity Finder
-- P7 (pro): GummySearch-style theme categorization + sentiment on each scored post.

alter table reddit_scores add column if not exists category text;
alter table reddit_scores add column if not exists sentiment text;

-- DROP + CREATE (not CREATE OR REPLACE): we're inserting category/sentiment
-- into the column list, and replace-in-place only allows appending columns.
drop view if exists reddit_triage_queue;
create view reddit_triage_queue as
  select
    p.id as post_id, p.subreddit, p.title, p.permalink, p.author,
    p.created_utc, p.num_comments, p.score as post_score, p.locked, p.removed,
    s.relevance, s.intent, s.commentability, s.mention_fit,
    s.competitor_boost, s.saturation_penalty, s.freshness_bonus,
    s.total, s.why, s.model, s.scored_at,
    s.category, s.sentiment,
    coalesce(t.status, 'new') as status, t.note, t.acted_at,
    coalesce(pc.competitor_count, 0) as competitor_count,
    pc.competitors_json,
    coalesce(sig.promo_reply_count, 0) as promo_reply_count,
    sub.self_promo_allowed
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
  left join reddit_post_signals sig on sig.post_id = p.id
  left join reddit_subreddits sub on lower(sub.name) = lower(p.subreddit);
