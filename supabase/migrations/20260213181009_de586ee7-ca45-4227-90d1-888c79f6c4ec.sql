
-- Enable useful extensions
create extension if not exists pgcrypto;
create extension if not exists citext;

-- Enums
do $$ begin
  create type public.plan_t as enum ('free','premium');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.scan_status_t as enum ('queued','running','completed','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.risk_level_t as enum ('low','medium','high','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.settlement_status_t as enum ('open','pending','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.claim_status_t as enum ('submitted','under_review','documentation_required','approved','rejected','paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.alert_type_t as enum ('breach_detected','settlement_found','deadline_alert','claim_update','payout_update','system');
exception when duplicate_object then null; end $$;

-- Timestamp helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Roles table FIRST (needed by is_admin function)
create table if not exists public.user_roles (
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','user')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Admin check helper
create or replace function public.is_admin(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user and ur.role = 'admin'
  );
$$;

-- USER PROFILES
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email citext,
  plan public.plan_t not null default 'free',
  monitoring_enabled boolean not null default false,
  scan_frequency_days int not null default 7,
  next_scan_at timestamptz,
  last_scan_at timestamptz,
  email_alerts boolean not null default true,
  deadline_alerts boolean not null default true,
  push_alerts boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_profiles_updated on public.user_profiles;
create trigger trg_user_profiles_updated
before update on public.user_profiles
for each row execute function public.set_updated_at();

-- MONITORED IDENTIFIERS
create table if not exists public.monitored_identifiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('email','phone','username')),
  value_hash text not null,
  value_last4 text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_monitored_identifiers_user on public.monitored_identifiers(user_id);
create index if not exists idx_monitored_identifiers_hash on public.monitored_identifiers(value_hash);

drop trigger if exists trg_monitored_identifiers_updated on public.monitored_identifiers;
create trigger trg_monitored_identifiers_updated
before update on public.monitored_identifiers
for each row execute function public.set_updated_at();

-- SCAN RUNS
create table if not exists public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.scan_status_t not null default 'queued',
  requested_email_hash text,
  requested_phone_hash text,
  provider text,
  databases_scanned int not null default 0,
  breaches_detected int not null default 0,
  eligible_settlements int not null default 0,
  risk_score int not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_scan_runs_user_created on public.scan_runs(user_id, created_at desc);

-- BREACH EVENTS
create table if not exists public.breach_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_run_id uuid references public.scan_runs(id) on delete set null,
  source text not null,
  breach_year int,
  risk_level public.risk_level_t not null default 'medium',
  exposed_fields text[] not null default '{}',
  record_count_estimate bigint,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_breach_events_user_created on public.breach_events(user_id, created_at desc);
create index if not exists idx_breach_events_scan on public.breach_events(scan_run_id);

-- SETTLEMENTS
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null,
  status public.settlement_status_t not null default 'open',
  breach_year int,
  payout_min numeric(12,2),
  payout_max numeric(12,2),
  deadline date,
  url text,
  description text,
  tags text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_settlements_status_deadline on public.settlements(status, deadline);
create index if not exists idx_settlements_company on public.settlements(company);

drop trigger if exists trg_settlements_updated on public.settlements;
create trigger trg_settlements_updated
before update on public.settlements
for each row execute function public.set_updated_at();

-- SETTLEMENT MATCHES
create table if not exists public.settlement_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  scan_run_id uuid references public.scan_runs(id) on delete set null,
  match_reason text,
  status public.settlement_status_t not null default 'open',
  payout_estimate numeric(12,2),
  created_at timestamptz not null default now(),
  unique (user_id, settlement_id)
);

create index if not exists idx_settlement_matches_user on public.settlement_matches(user_id);
create index if not exists idx_settlement_matches_settlement on public.settlement_matches(settlement_id);

-- CLAIMS
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  settlement_id uuid not null references public.settlements(id) on delete restrict,
  scan_run_id uuid references public.scan_runs(id) on delete set null,
  status public.claim_status_t not null default 'submitted',
  est_payout numeric(12,2),
  final_payout numeric(12,2),
  fee_percent numeric(5,2) not null default 15.00,
  flagged boolean not null default false,
  flag_reason text,
  filed_at date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_claims_user_created on public.claims(user_id, created_at desc);
create index if not exists idx_claims_status on public.claims(status);
create index if not exists idx_claims_flagged on public.claims(flagged);

drop trigger if exists trg_claims_updated on public.claims;
create trigger trg_claims_updated
before update on public.claims
for each row execute function public.set_updated_at();

-- CLAIM DOCUMENTS
create table if not exists public.claim_documents (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  file_type text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_claim_documents_claim on public.claim_documents(claim_id);

-- ALERTS
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.alert_type_t not null,
  title text not null,
  body text,
  severity public.risk_level_t not null default 'low',
  related_scan_run_id uuid references public.scan_runs(id) on delete set null,
  related_settlement_id uuid references public.settlements(id) on delete set null,
  related_claim_id uuid references public.claims(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_alerts_user_created on public.alerts(user_id, created_at desc);
create index if not exists idx_alerts_user_unread on public.alerts(user_id, is_read);

-- USER RISK SNAPSHOTS
create table if not exists public.user_risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  risk_score int not null,
  breaches_detected int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_risk_snapshots_user_created on public.user_risk_snapshots(user_id, created_at desc);

-- SUBSCRIPTIONS
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  status text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_subscriptions_updated on public.subscriptions;
create trigger trg_subscriptions_updated
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- ADMIN ACTIVITY LOGS
create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_activity_logs_created on public.admin_activity_logs(created_at desc);

-- RLS POLICIES

alter table public.user_profiles enable row level security;
create policy "Users can view own profile" on public.user_profiles for select to authenticated using (auth.uid() = user_id);
create policy "Users can update own profile" on public.user_profiles for update to authenticated using (auth.uid() = user_id);
create policy "Users can insert own profile" on public.user_profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "Admins can view all profiles" on public.user_profiles for select to authenticated using (public.is_admin(auth.uid()));

alter table public.user_roles enable row level security;
create policy "Users can view own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "Admins can manage roles" on public.user_roles for all to authenticated using (public.is_admin(auth.uid()));

alter table public.monitored_identifiers enable row level security;
create policy "Users manage own identifiers" on public.monitored_identifiers for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.scan_runs enable row level security;
create policy "Users view own scans" on public.scan_runs for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own scans" on public.scan_runs for insert to authenticated with check (auth.uid() = user_id);
create policy "Admins view all scans" on public.scan_runs for select to authenticated using (public.is_admin(auth.uid()));

alter table public.breach_events enable row level security;
create policy "Users view own breaches" on public.breach_events for select to authenticated using (auth.uid() = user_id);
create policy "Admins view all breaches" on public.breach_events for select to authenticated using (public.is_admin(auth.uid()));

alter table public.settlements enable row level security;
create policy "Anyone can view settlements" on public.settlements for select to authenticated using (true);
create policy "Admins manage settlements" on public.settlements for all to authenticated using (public.is_admin(auth.uid()));

alter table public.settlement_matches enable row level security;
create policy "Users view own matches" on public.settlement_matches for select to authenticated using (auth.uid() = user_id);
create policy "Admins view all matches" on public.settlement_matches for select to authenticated using (public.is_admin(auth.uid()));

alter table public.claims enable row level security;
create policy "Users view own claims" on public.claims for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own claims" on public.claims for insert to authenticated with check (auth.uid() = user_id);
create policy "Admins manage all claims" on public.claims for all to authenticated using (public.is_admin(auth.uid()));

alter table public.claim_documents enable row level security;
create policy "Users manage own documents" on public.claim_documents for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.alerts enable row level security;
create policy "Users view own alerts" on public.alerts for select to authenticated using (auth.uid() = user_id);
create policy "Users update own alerts" on public.alerts for update to authenticated using (auth.uid() = user_id);

alter table public.user_risk_snapshots enable row level security;
create policy "Users view own snapshots" on public.user_risk_snapshots for select to authenticated using (auth.uid() = user_id);

alter table public.subscriptions enable row level security;
create policy "Users view own subscription" on public.subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "Users update own subscription" on public.subscriptions for update to authenticated using (auth.uid() = user_id);

alter table public.admin_activity_logs enable row level security;
create policy "Admins view activity logs" on public.admin_activity_logs for select to authenticated using (public.is_admin(auth.uid()));
create policy "Admins insert activity logs" on public.admin_activity_logs for insert to authenticated with check (public.is_admin(auth.uid()));
