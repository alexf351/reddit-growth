-- Iro — Reddit Opportunity Finder
-- P6: lightweight observability totals for the status page.

create or replace view reddit_llm_usage_totals as
  select
    coalesce(sum(prompt_tokens), 0) as prompt_tokens,
    coalesce(sum(completion_tokens), 0) as completion_tokens,
    count(*) as calls
  from reddit_llm_usage;
