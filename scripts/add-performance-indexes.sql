-- Add read-performance indexes for search and content listing workloads.
-- Safe to run multiple times.

begin;

create index if not exists idx_contents_publish_status_created_at
  on public.contents (publish_status, created_at desc);

create index if not exists idx_contents_review_status_updated_at
  on public.contents (review_status, updated_at desc);

create index if not exists idx_content_tags_tag_id_content_id
  on public.content_tags (tag_id, content_id);

create index if not exists idx_user_login_events_created_at
  on public.user_login_events (created_at desc);

create index if not exists idx_user_login_events_user_id_created_at
  on public.user_login_events (user_id, created_at desc);

commit;
