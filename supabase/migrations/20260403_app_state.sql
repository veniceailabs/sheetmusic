create extension if not exists pgcrypto;

create table if not exists public.app_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.uploaded_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  original_name text not null,
  mime_type text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('sheet-music-assets', 'sheet-music-assets', false)
on conflict (id) do nothing;
