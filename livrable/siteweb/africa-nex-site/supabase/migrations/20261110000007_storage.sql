-- Fichiers. Chemins construits cote serveur uniquement :
--   <company_id>/<fichier>              logos, images produits, documents
--   buyer/<rfq_id>/<fichier>            pieces jointes de l'acheteur
--   dispatch/<dispatch_id>/<fichier>    pieces jointes du producteur et briefs nettoyes
-- Les buckets publics sont lisibles par URL sans politique de lecture : aucune liste publique.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('producer-logos', 'producer-logos', true, 2097152,
    array['image/png', 'image/jpeg', 'image/webp']),
  ('product-images', 'product-images', true, 5242880,
    array['image/png', 'image/jpeg', 'image/webp']),
  ('company-documents', 'company-documents', false, 10485760,
    array['application/pdf', 'image/png', 'image/jpeg']),
  ('rfq-files', 'rfq-files', false, 10485760,
    array['application/pdf', 'image/png', 'image/jpeg',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create policy "company files select" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('producer-logos', 'product-images', 'company-documents')
    and public.is_member_of(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "company files insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('producer-logos', 'product-images', 'company-documents')
    and public.is_member_of(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "company files update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('producer-logos', 'product-images', 'company-documents')
    and public.is_member_of(public.try_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id in ('producer-logos', 'product-images', 'company-documents')
    and public.is_member_of(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "company files delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('producer-logos', 'product-images', 'company-documents')
    and public.is_member_of(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "rfq buyer files select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rfq-files'
    and (storage.foldername(name))[1] = 'buyer'
    and exists (
      select 1 from public.rfqs r
       where r.id = public.try_uuid((storage.foldername(name))[2])
         and r.buyer_profile_id = (select auth.uid())
    )
  );

create policy "rfq buyer files insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rfq-files'
    and (storage.foldername(name))[1] = 'buyer'
    and exists (
      select 1 from public.rfqs r
       where r.id = public.try_uuid((storage.foldername(name))[2])
         and r.buyer_profile_id = (select auth.uid())
    )
  );

create policy "rfq dispatch files select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rfq-files'
    and (storage.foldername(name))[1] = 'dispatch'
    and exists (
      select 1 from public.rfq_dispatches d
       where d.id = public.try_uuid((storage.foldername(name))[2])
         and public.is_member_of(d.company_id)
    )
  );

create policy "rfq dispatch files insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rfq-files'
    and (storage.foldername(name))[1] = 'dispatch'
    and exists (
      select 1 from public.rfq_dispatches d
       where d.id = public.try_uuid((storage.foldername(name))[2])
         and public.is_member_of(d.company_id)
    )
  );

create policy "africanex admin files" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('producer-logos', 'product-images', 'company-documents', 'rfq-files')
    and public.is_admin()
  )
  with check (
    bucket_id in ('producer-logos', 'product-images', 'company-documents', 'rfq-files')
    and public.is_admin()
  );
