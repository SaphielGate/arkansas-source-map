create extension if not exists pgcrypto with schema extensions;

create table public.sources (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  url text not null unique check (url ~ '^https?://'),
  source_type text not null check (length(trim(source_type)) > 0),
  jurisdiction text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sources is
  'Research index entries. Inclusion does not verify, endorse, or establish the truth of a claim.';

create table public.evidence_items (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  storage_path text not null unique check (length(trim(storage_path)) > 0),
  captured_at timestamptz,
  notes text,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.evidence_items is
  'Metadata for privately stored research evidence requiring independent review and corroboration.';

create table public.source_evidence (
  source_id uuid not null references public.sources(id) on delete cascade,
  evidence_id uuid not null references public.evidence_items(id) on delete cascade,
  relationship_note text,
  primary key (source_id, evidence_id)
);

create index evidence_items_submitted_by_idx on public.evidence_items(submitted_by);
create index source_evidence_evidence_id_idx on public.source_evidence(evidence_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sources_set_updated_at
before update on public.sources
for each row execute function public.set_updated_at();
