-- Cached profile data for the public FPL catalogue used by the browser market.
-- API-Football is contacted only by an admin-triggered Edge Function; browsers read this cache.
create table public.player_catalogue_profiles (
  catalogue_player_id text primary key,
  api_football_player_id text unique,
  display_name text not null,
  team_name text not null,
  position public.player_position not null,
  birth_date date,
  nationality text,
  match_status text not null check (match_status in ('matched', 'unmatched', 'ambiguous')),
  match_confidence numeric(5,2) not null default 0 check (match_confidence between 0 and 100),
  source_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index player_catalogue_profiles_updated_idx
  on public.player_catalogue_profiles (source_updated_at desc);

create trigger player_catalogue_profiles_set_updated_at
before update on public.player_catalogue_profiles
for each row execute function public.set_updated_at();

alter table public.player_catalogue_profiles enable row level security;

create policy player_catalogue_profiles_authenticated_read
on public.player_catalogue_profiles
for select to authenticated
using (true);

grant select on public.player_catalogue_profiles to authenticated;
