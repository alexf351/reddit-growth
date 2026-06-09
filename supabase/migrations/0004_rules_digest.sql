-- Iro — Reddit Opportunity Finder
-- P4: surface each subreddit's self-promo flag in the triage queue.
-- (reddit_subreddits already has self_promo_allowed / rules_json / rules_fetched_at
--  from 0001; this just exposes the flag on the queue view.)

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
