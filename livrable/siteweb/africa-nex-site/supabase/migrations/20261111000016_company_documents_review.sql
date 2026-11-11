-- Documents d'entreprise (registre de commerce, certifications). Un document n'est montre au
-- public qu'apres verification par AFRICA NEX : sinon n'importe qui afficherait un faux certificat.

alter table public.company_documents
  add column review_status text not null default 'pending' check (review_status in ('pending', 'accepted', 'rejected')),
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz,
  add column expires_on date,
  add column file_type text check (file_type in ('pdf', 'png', 'jpg'));

-- Public : documents marques publics ET verifies, d'une fiche en ligne.
drop policy company_documents_select_public on public.company_documents;
create policy company_documents_select_public on public.company_documents
  for select to anon, authenticated
  using (
    is_public
    and review_status = 'accepted'
    and exists (
      select 1 from public.companies c
       where c.id = company_documents.company_id and c.visibility = 'published'
    )
  );

-- Membres : lire, deposer (toujours "a verifier"), supprimer. Pas de modification : pour changer
-- un document, on le supprime et on en depose un nouveau, qui repasse en verification.
drop policy company_documents_member on public.company_documents;
create policy company_documents_member_select on public.company_documents
  for select to authenticated
  using (public.is_member_of(company_id));
create policy company_documents_member_insert on public.company_documents
  for insert to authenticated
  with check (
    public.is_member_of(company_id)
    and review_status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and storage_path like company_id::text || '/docs/%'
  );
create policy company_documents_member_delete on public.company_documents
  for delete to authenticated
  using (public.is_member_of(company_id));
