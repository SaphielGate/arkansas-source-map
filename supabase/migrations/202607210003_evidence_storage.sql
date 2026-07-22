insert into storage.buckets (id, name, public, file_size_limit)
values ('evidence', 'evidence', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

-- Store files under a user-id prefix: <auth.uid()>/<generated-filename>.
create policy "Users can read their own evidence files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'evidence'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can upload their own evidence files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'evidence'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Update and delete policies are intentionally omitted pending an editorial retention policy.
