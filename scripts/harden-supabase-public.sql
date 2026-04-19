-- Lock down Supabase Data API exposure for tables that are only meant to be
-- accessed through the server-side Prisma connection.

begin;

alter table if exists public.users enable row level security;
alter table if exists public.user_login_events enable row level security;
alter table if exists public.contents enable row level security;
alter table if exists public.content_images enable row level security;
alter table if exists public.content_download_links enable row level security;
alter table if exists public.content_files enable row level security;
alter table if exists public.content_download_daily enable row level security;
alter table if exists public.content_download_audience_daily enable row level security;
alter table if exists public.content_download_events enable row level security;
alter table if exists public.content_issue_reports enable row level security;
alter table if exists public.content_site_download_demos enable row level security;
alter table if exists public.content_view_daily enable row level security;
alter table if exists public.staff_uploads enable row level security;
alter table if exists public.tags enable row level security;
alter table if exists public.content_tags enable row level security;
alter table if exists public.homepage_hot_topic_slots enable row level security;

revoke all privileges on table public.users from anon, authenticated;
revoke all privileges on table public.user_login_events from anon, authenticated;
revoke all privileges on table public.contents from anon, authenticated;
revoke all privileges on table public.content_images from anon, authenticated;
revoke all privileges on table public.content_download_links from anon, authenticated;
revoke all privileges on table public.content_files from anon, authenticated;
revoke all privileges on table public.content_download_daily from anon, authenticated;
revoke all privileges on table public.content_download_audience_daily from anon, authenticated;
revoke all privileges on table public.content_download_events from anon, authenticated;
revoke all privileges on table public.content_issue_reports from anon, authenticated;
revoke all privileges on table public.content_site_download_demos from anon, authenticated;
revoke all privileges on table public.content_view_daily from anon, authenticated;
revoke all privileges on table public.staff_uploads from anon, authenticated;
revoke all privileges on table public.tags from anon, authenticated;
revoke all privileges on table public.content_tags from anon, authenticated;
revoke all privileges on table public.homepage_hot_topic_slots from anon, authenticated;

revoke all privileges on sequence public.users_id_seq from anon, authenticated;
revoke all privileges on sequence public.user_login_events_id_seq from anon, authenticated;
revoke all privileges on sequence public.contents_id_seq from anon, authenticated;
revoke all privileges on sequence public.content_images_id_seq from anon, authenticated;
revoke all privileges on sequence public.content_download_links_id_seq from anon, authenticated;
revoke all privileges on sequence public.content_files_id_seq from anon, authenticated;
revoke all privileges on sequence public.content_download_events_id_seq from anon, authenticated;
revoke all privileges on sequence public.content_issue_reports_id_seq from anon, authenticated;
revoke all privileges on sequence public.content_site_download_demos_id_seq from anon, authenticated;
revoke all privileges on sequence public.staff_uploads_id_seq from anon, authenticated;
revoke all privileges on sequence public.tags_id_seq from anon, authenticated;

commit;
