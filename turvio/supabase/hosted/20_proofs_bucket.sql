-- =============================================================================
-- Hosted Supabase only. Private bucket for proof-of-delivery files (photos,
-- signatures). public = false: no public URLs. No storage.objects policies are
-- created, so anon/authenticated users cannot read or write it through the
-- Storage API; only the TURVIO API (service key, after its own access check)
-- does. Limits match apps/api/src/storage.ts (MAX_PROOF_BYTES, TYPE_BY_EXT).
-- Idempotent; never changes an existing bucket's contents.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/svg+xml'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
