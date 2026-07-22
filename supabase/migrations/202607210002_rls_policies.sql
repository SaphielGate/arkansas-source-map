alter table public.sources enable row level security;
alter table public.evidence_items enable row level security;
alter table public.source_evidence enable row level security;

-- Milestone 1 policy skeleton: authenticated users may read indexed source metadata.
create policy "Authenticated users can read sources"
on public.sources for select
to authenticated
using (true);

-- Evidence is private to its submitter. Broader editorial roles can be added in a later milestone.
create policy "Submitters can read their evidence metadata"
on public.evidence_items for select
to authenticated
using ((select auth.uid()) = submitted_by);

create policy "Submitters can add evidence metadata"
on public.evidence_items for insert
to authenticated
with check ((select auth.uid()) = submitted_by);

create policy "Submitters can read their evidence links"
on public.source_evidence for select
to authenticated
using (
  exists (
    select 1 from public.evidence_items
    where evidence_items.id = source_evidence.evidence_id
      and evidence_items.submitted_by = (select auth.uid())
  )
);

-- There are intentionally no anonymous, update, or delete policies in Milestone 1.
