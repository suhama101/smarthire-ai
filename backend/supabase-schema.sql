-- SmartHire AI Supabase schema
-- Run this in the Supabase SQL Editor for your project.

create table if not exists public.users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  full_name text not null,
  role text not null default 'candidate',
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users(email);

create table if not exists public.analyses (
  id text primary key,
  user_id text not null,
  resume_data jsonb not null,
  raw_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.job_matches (
  id text primary key,
  analysis_id text not null references public.analyses(id) on delete cascade,
  user_id text not null,
  job_title text not null,
  company_name text not null,
  job_description text not null,
  match_result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists analyses_user_id_idx on public.analyses(user_id);
create index if not exists job_matches_user_id_idx on public.job_matches(user_id);
create index if not exists job_matches_analysis_id_idx on public.job_matches(analysis_id);
