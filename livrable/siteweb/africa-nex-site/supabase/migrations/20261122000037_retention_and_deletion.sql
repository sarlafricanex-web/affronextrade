-- Audit legal, correction 3 (validee par Adlene le 22 novembre 2026) : les durees de conservation
-- annoncees dans la politique de confidentialite sont appliquees par la base, et chaque utilisateur
-- peut demander la suppression de son compte depuis son espace (traitee par AFRICA NEX sous un mois).

-- 1. Demandes de suppression de compte
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  email text not null,
  role text not null,
  reason text check (char_length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles (id) on delete set null
);

create unique index account_deletion_one_pending
  on public.account_deletion_requests (profile_id) where status = 'pending';

alter table public.account_deletion_requests enable row level security;

create policy account_deletion_select on public.account_deletion_requests
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

create policy account_deletion_admin_update on public.account_deletion_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Demande (une seule en attente par compte ; un compte AFRICA NEX ne se supprime pas ainsi).
create function public.request_account_deletion(p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_id uuid;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if v_profile.role = 'admin' then raise exception 'admin account' using errcode = '42501'; end if;
  select id into v_id from public.account_deletion_requests where profile_id = v_profile.id and status = 'pending';
  if v_id is not null then return v_id; end if;
  insert into public.account_deletion_requests (profile_id, email, role, reason)
  values (v_profile.id, coalesce(v_profile.email, ''), v_profile.role, nullif(btrim(coalesce(p_reason, '')), ''))
  returning id into v_id;
  return v_id;
end
$$;

-- Annulation par l'utilisateur tant que la demande n'est pas traitee.
create function public.cancel_account_deletion()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.account_deletion_requests
     set status = 'cancelled', processed_at = now()
   where profile_id = auth.uid() and status = 'pending';
$$;

revoke execute on function public.request_account_deletion(text) from public, anon;
revoke execute on function public.cancel_account_deletion() from public, anon;
grant execute on function public.request_account_deletion(text) to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;

-- 2. Purge des donnees arrivees au terme de leur duree de conservation (politique de
--    confidentialite, section 5). Renvoie le nombre de lignes supprimees par categorie.
create function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submissions int;
  v_emails int;
  v_views int;
  v_rfqs int;
  v_requests int;
begin
  delete from public.submissions where created_at < now() - interval '12 months';
  get diagnostics v_submissions = row_count;
  delete from public.email_notifications where created_at < now() - interval '12 months';
  get diagnostics v_emails = row_count;
  delete from public.profile_views where created_at < now() - interval '13 months';
  get diagnostics v_views = row_count;
  -- Demandes closes ou annulees depuis 5 ans : offres, devis, lignes et messages suivent (cascade).
  delete from public.rfqs where status in ('closed', 'cancelled') and updated_at < now() - interval '5 years';
  get diagnostics v_rfqs = row_count;
  delete from public.account_deletion_requests where status <> 'pending' and processed_at < now() - interval '12 months';
  get diagnostics v_requests = row_count;
  return jsonb_build_object('submissions', v_submissions, 'emails', v_emails, 'views', v_views, 'rfqs', v_rfqs, 'deletion_requests', v_requests);
end
$$;

revoke execute on function public.purge_expired_data() from public, anon, authenticated;

-- 3. Purge chaque nuit (2 h 30, heure du serveur) avec pg_cron quand il est disponible (Supabase) ;
--    ignore sur une base de test qui ne l'a pas.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $cron$select cron.schedule('purge-expired-data', '30 2 * * *', 'select public.purge_expired_data()')$cron$;
  end if;
end
$$;
