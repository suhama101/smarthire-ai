CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id text primary key,
  user_id text not null,
  token text not null unique,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);