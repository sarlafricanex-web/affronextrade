-- La mise en ligne d'une fiche dans l'annuaire est decidee par AFRICA NEX, jamais par l'entreprise elle-meme.

drop policy companies_insert_own on public.companies;
create policy companies_insert_own on public.companies
  for insert to authenticated
  with check (
    owner_profile_id = (select auth.uid())
    and kind = public.my_role()
    and created_by_admin = false
    and verified = false
    and claim_status = 'claimed'
    and legacy_id is null
    and visibility = 'draft'
    and subscription_tier = 'starter'
    and subscription_status = 'none'
    and not exists (
      select 1 from public.company_members m where m.profile_id = (select auth.uid())
    )
  );

create or replace function public.guard_company_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if exists (
    select 1
      from unnest(array[
        'id', 'kind', 'slug', 'legacy_id', 'verified', 'claim_status', 'created_by_admin',
        'owner_profile_id', 'subscription_tier', 'subscription_currency', 'subscription_status',
        'trial_ends_at', 'status', 'visibility', 'created_at'
      ]) as k
     where to_jsonb(new) -> k is distinct from to_jsonb(old) -> k
  ) then
    raise exception 'protected company fields can only be changed by AFRICA NEX';
  end if;
  return new;
end
$$;
