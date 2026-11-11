-- Revendication des fiches etablies par AFRICA NEX. Validation toujours manuelle par l'admin.

-- 1. Un compte qui gere deja une entreprise ne peut pas en revendiquer une autre (une entreprise par compte).
drop policy company_claims_insert on public.company_claims;
create policy company_claims_insert on public.company_claims
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and public.my_role() = 'producer'
    and not exists (
      select 1 from public.company_members m where m.profile_id = (select auth.uid())
    )
    and exists (
      select 1 from public.companies c
       where c.id = company_claims.company_id
         and c.claim_status = 'unclaimed'
         and c.visibility = 'published'
    )
  );

-- 2. Justificatif (extrait du registre de commerce) : dossier claims/<compte>/ du bucket prive.
create policy "claim evidence insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = 'claims'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "claim evidence select own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = 'claims'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "claim evidence delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = 'claims'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- 3. Decision de l'admin, en une transaction.
create function public.approve_claim(p_claim uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.company_claims;
begin
  if not public.is_admin() then
    raise exception 'only AFRICA NEX can approve a claim';
  end if;
  select * into c from public.company_claims where id = p_claim and status = 'pending' for update;
  if not found then
    raise exception 'claim_not_pending';
  end if;
  if exists (select 1 from public.company_members m where m.profile_id = c.profile_id) then
    raise exception 'claimant_has_company';
  end if;

  update public.company_claims
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_claim;
  -- Les autres demandes sur la meme fiche sont closes.
  update public.company_claims
     set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
   where company_id = c.company_id and status = 'pending';

  update public.companies
     set owner_profile_id = c.profile_id, claim_status = 'claimed'
   where id = c.company_id;
  insert into public.company_members (company_id, profile_id, role)
  values (c.company_id, c.profile_id, 'owner')
  on conflict do nothing;
  update public.company_private
     set tax_id = coalesce(tax_id, c.tax_id),
         contact_email = coalesce(contact_email, c.work_email),
         contact_phone = coalesce(contact_phone, c.phone)
   where company_id = c.company_id;

  insert into public.audit_log (actor_profile_id, action, entity, entity_id, payload)
  values (auth.uid(), 'claim.approve', 'company', c.company_id::text, jsonb_build_object('claim_id', c.id, 'profile_id', c.profile_id));
end
$$;

create function public.reject_claim(p_claim uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.company_claims;
begin
  if not public.is_admin() then
    raise exception 'only AFRICA NEX can reject a claim';
  end if;
  select * into c from public.company_claims where id = p_claim and status = 'pending' for update;
  if not found then
    raise exception 'claim_not_pending';
  end if;

  update public.company_claims
     set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_claim;
  -- La fiche redevient revendicable s'il ne reste aucune demande en attente.
  update public.companies
     set claim_status = 'unclaimed'
   where id = c.company_id
     and claim_status = 'claim_pending'
     and not exists (select 1 from public.company_claims o where o.company_id = c.company_id and o.status = 'pending');

  insert into public.audit_log (actor_profile_id, action, entity, entity_id, payload)
  values (auth.uid(), 'claim.reject', 'company', c.company_id::text, jsonb_build_object('claim_id', c.id, 'profile_id', c.profile_id));
end
$$;

revoke execute on function public.approve_claim(uuid), public.reject_claim(uuid) from public, anon;
grant execute on function public.approve_claim(uuid), public.reject_claim(uuid) to authenticated;
