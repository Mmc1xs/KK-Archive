-- Lock down Supabase Data API exposure for tables that are only meant to be
-- accessed through the server-side Prisma connection.

begin;

alter table if exists public.users enable row level security;
alter table if exists public.user_login_events enable row level security;
alter table if exists public.contents enable row level security;
alter table if exists public.content_images enable row level security;
alter table if exists public.content_download_links enable row level security;
alter table if exists public.tags enable row level security;
alter table if exists public.content_tags enable row level security;

revoke all privileges on table public.users from anon, authenticated;
revoke all privileges on table public.user_login_events from anon, authenticated;
revoke all privileges on table public.contents from anon, authenticated;
revoke all privileges on table public.content_images from anon, authenticated;
revoke all privileges on table public.content_download_links from anon, authenticated;
revoke all privileges on table public.tags from anon, authenticated;
revoke all privileges on table public.content_tags from anon, authenticated;

revoke all privileges on sequence public.users_id_seq from anon, authenticated;
revoke all privileges on sequence public.user_login_events_id_seq from anon, authenticated;
revoke all privileges on sequence public.contents_id_seq from anon, authenticated;
revoke all privileges on sequence public.content_images_id_seq from anon, authenticated;
revoke all privileges on sequence public.content_download_links_id_seq from anon, authenticated;
revoke all privileges on sequence public.tags_id_seq from anon, authenticated;

commit;
