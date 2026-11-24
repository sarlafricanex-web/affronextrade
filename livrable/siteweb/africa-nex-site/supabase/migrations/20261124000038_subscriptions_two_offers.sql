-- Abonnements revus le 24 novembre 2026 (decisions d'Adlene, dossier « politique commercial africanex ») :
--   - Passeport (gratuit, code 'vitrine' garde), Agent Export 36 900 DZD HT par mois, Ambassadeur 59 600 ;
--     Croissance disparait ;
--   - Passeport : 10 produits, demandes d'acheteurs 48 h apres les comptes payants, pas d'import Excel,
--     de traduction, de statistiques detaillees ni de priorite dans les resultats ;
--   - Agent Export : 1 000 produits ; Ambassadeur : illimite, marketing en plus (quotas provisoires,
--     fixes apres l'essai) ;
--   - annuel paye d'avance : -10 % (remplace les 2 mois offerts) ; offre fondateurs supprimee ;
--   - essai gratuit de 60 jours, 3 producteurs au plus, ouvert par AFRICA NEX.

-- 1. Parametres
delete from public.billing_settings where key in ('annual_free_months', 'founder_discount', 'founder_slots');
insert into public.billing_settings (key, value) values
  ('annual_discount', 0.1),
  ('free_request_delay_hours', 48),
  ('trial_days', 60),
  ('trial_slots', 3)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- 2. Offres. Les codes changent en cascade (droits, abonnements) ; 'vitrine' reste le code du Passeport.
update public.plans set name = 'Passeport' where code = 'vitrine';
update public.plans set code = 'agent_export', name = 'Agent Export', monthly_price_dzd = 36900, sort_order = 2 where code = 'essentiel';
update public.plans set code = 'ambassadeur', name = 'Ambassadeur', monthly_price_dzd = 59600, sort_order = 3 where code = 'export_pro';
delete from public.plans p where p.code = 'croissance'
  and not exists (select 1 from public.subscriptions s where s.plan_code = 'croissance' or s.scheduled_plan_code = 'croissance');
update public.plans set is_active = false, sort_order = 9 where code = 'croissance';

-- 3. Nouvelles fonctions (available = false : affichees « Bientot »)
insert into public.features (key, sort_order, available) values
  ('ai_agent', 12, false),
  ('translation', 13, false),
  ('excel_import', 14, true),
  ('detailed_stats', 15, false),
  ('search_priority', 16, false)
on conflict (key) do nothing;

-- 4. Droits et quotas (null = illimite, 0 = non inclus)
insert into public.plan_features (plan_code, feature_key, limit_value, period, access_level) values
  -- Passeport : etre present et vendre
  ('vitrine', 'products', 10, 'none', null),
  ('vitrine', 'buyer_requests', null, 'none', 'delayed'),
  ('vitrine', 'human_support', 0, 'none', null),
  ('vitrine', 'ai_agent', 0, 'none', null),
  ('vitrine', 'translation', 0, 'none', null),
  ('vitrine', 'excel_import', 0, 'none', null),
  ('vitrine', 'detailed_stats', 0, 'none', 'total_only'),
  ('vitrine', 'search_priority', 0, 'none', null),
  ('vitrine', 'ai_videos', 0, 'none', null),
  ('vitrine', 'ai_campaigns', 0, 'month', null),
  ('vitrine', 'sponsored', 0, 'none', null),
  ('vitrine', 'hs_code_countries', 0, 'none', null),
  ('vitrine', 'packaging_countries', 0, 'none', null),
  ('vitrine', 'market_watch', 0, 'none', null),
  ('vitrine', 'tenders', 0, 'none', null),
  ('vitrine', 'photo_enhancement', 0, 'none', null),
  -- Agent Export : un agent IA qui travaille pour le producteur 24 h sur 24
  ('agent_export', 'products', 1000, 'none', null),
  ('agent_export', 'buyer_requests', null, 'none', 'priority'),
  ('agent_export', 'human_support', null, 'none', 'email'),
  ('agent_export', 'ai_agent', null, 'none', null),
  ('agent_export', 'translation', null, 'none', null),
  ('agent_export', 'excel_import', null, 'none', null),
  ('agent_export', 'detailed_stats', null, 'none', null),
  ('agent_export', 'search_priority', null, 'none', 'priority'),
  ('agent_export', 'ai_videos', 0, 'none', null),
  ('agent_export', 'ai_campaigns', 0, 'month', null),
  ('agent_export', 'sponsored', 0, 'none', null),
  ('agent_export', 'hs_code_countries', 0, 'none', null),
  ('agent_export', 'packaging_countries', 0, 'none', null),
  ('agent_export', 'market_watch', 0, 'none', null),
  ('agent_export', 'tenders', null, 'none', 'alerts'),
  ('agent_export', 'photo_enhancement', 0, 'none', null),
  -- Ambassadeur : Agent Export + marketing (quotas marketing provisoires, fixes apres l'essai)
  ('ambassadeur', 'products', null, 'none', null),
  ('ambassadeur', 'buyer_requests', null, 'none', 'priority_featured'),
  ('ambassadeur', 'human_support', null, 'none', 'priority'),
  ('ambassadeur', 'ai_agent', null, 'none', null),
  ('ambassadeur', 'translation', null, 'none', null),
  ('ambassadeur', 'excel_import', null, 'none', null),
  ('ambassadeur', 'detailed_stats', null, 'none', null),
  ('ambassadeur', 'search_priority', null, 'none', 'featured'),
  ('ambassadeur', 'ai_videos', 2, 'month', null),
  ('ambassadeur', 'ai_campaigns', 1, 'month', null),
  ('ambassadeur', 'sponsored', null, 'none', null),
  ('ambassadeur', 'hs_code_countries', 10, 'none', null),
  ('ambassadeur', 'packaging_countries', 3, 'none', null),
  ('ambassadeur', 'market_watch', 15, 'none', null),
  ('ambassadeur', 'tenders', null, 'none', 'alerts_full'),
  ('ambassadeur', 'photo_enhancement', null, 'none', null)
on conflict (plan_code, feature_key) do update
  set limit_value = excluded.limit_value, period = excluded.period, access_level = excluded.access_level;

-- 5. Plus d'offre fondateurs ; essai gratuit
drop function public.request_subscription(uuid, text, public.billing_cycle, boolean);
drop function public.claim_founder_slot(uuid);
drop function public.founder_slots_used();
drop function public.compute_price(text, public.billing_cycle, boolean);
alter table public.subscriptions drop column is_founder, drop column founder_testimonial_received;
alter table public.subscriptions add column is_trial boolean not null default false;
alter table public.subscriptions add constraint subscriptions_trial_free check (not is_trial or price_charged_dzd = 0);

-- Prix d'une offre selon le cycle : annuel paye d'avance = mensuel x 12 x (1 - remise).
create function public.compute_price(p_plan text, p_cycle public.billing_cycle)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_monthly integer;
begin
  select monthly_price_dzd into v_monthly from public.plans where code = p_plan and is_active;
  if v_monthly is null then
    raise exception 'unknown plan' using errcode = '22023';
  end if;
  if p_cycle = 'monthly' then
    return v_monthly;
  end if;
  return round(v_monthly * 12 * (1 - public.billing_setting('annual_discount')))::integer;
end
$$;

-- Demande d'abonnement par le fournisseur (ou AFRICA NEX pour lui) : "paiement en attente".
create function public.request_subscription(p_company uuid, p_plan text, p_cycle public.billing_cycle)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.can_read_company_billing(p_company) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = p_company and kind = 'producer') then
    raise exception 'not a supplier' using errcode = '22023';
  end if;
  if p_plan = 'vitrine' then
    raise exception 'vitrine needs no subscription' using errcode = '22023';
  end if;
  delete from public.subscriptions where company_id = p_company and status = 'pending_payment';
  insert into public.subscriptions (company_id, plan_code, billing_cycle, price_charged_dzd, created_by)
  values (p_company, p_plan, p_cycle, public.compute_price(p_plan, p_cycle), (select auth.uid()))
  returning id into v_id;
  return v_id;
end
$$;

-- Essais gratuits : producteurs ayant deja eu un essai.
create function public.trial_slots_used()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct company_id)::integer from public.subscriptions where is_trial;
$$;

-- Essai gratuit ouvert par AFRICA NEX : actif tout de suite pour trial_days jours, un seul par
-- producteur, trial_slots producteurs au plus. A la fin, retour au Passeport (pas un impaye).
create function public.start_trial(p_company uuid, p_plan text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = p_company and kind = 'producer') then
    raise exception 'not a supplier' using errcode = '22023';
  end if;
  if p_plan = 'vitrine' or not exists (select 1 from public.plans where code = p_plan and is_active) then
    raise exception 'unknown plan' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('africanex_trial_slots'));
  if exists (select 1 from public.subscriptions where company_id = p_company and is_trial) then
    raise exception 'trial already used' using errcode = 'P0016';
  end if;
  if public.trial_slots_used() >= public.billing_setting('trial_slots') then
    raise exception 'no trial slot' using errcode = 'P0012';
  end if;
  if exists (select 1 from public.subscriptions where company_id = p_company and status = 'active' and current_period_end >= current_date) then
    raise exception 'already subscribed' using errcode = 'P0017';
  end if;
  delete from public.subscriptions where company_id = p_company and status = 'pending_payment';
  insert into public.subscriptions (company_id, plan_code, billing_cycle, status, is_trial, price_charged_dzd,
                                    current_period_start, current_period_end, payment_reference, activated_at, activated_by, created_by)
  values (p_company, p_plan, 'monthly', 'active', true, 0,
          current_date, current_date + (public.billing_setting('trial_days')::integer - 1), 'ESSAI', now(), (select auth.uid()), (select auth.uid()))
  returning id into v_id;
  perform public.enforce_product_quota(p_company);
  insert into public.audit_log (actor_profile_id, action, entity, entity_id, payload)
  values ((select auth.uid()), 'subscription.trial', 'subscription', v_id::text, jsonb_build_object('company', p_company, 'plan', p_plan));
  return v_id;
end
$$;

-- Fin de periode : un essai termine ou une descente vers le Passeport clot l'abonnement ; sinon il
-- passe "impaye". Retour au Passeport et quotas de produits appliques.
create or replace function public.sync_subscriptions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  if not public.is_admin() and (select auth.uid()) is not null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform set_config('africanex.quota_sync', 'on', true);
  for v_row in
    select id, company_id, scheduled_plan_code, is_trial from public.subscriptions
     where status = 'active' and current_period_end < current_date
  loop
    update public.subscriptions
       set status = case when v_row.is_trial or v_row.scheduled_plan_code = 'vitrine' then 'cancelled'::public.sub_status else 'past_due'::public.sub_status end
     where id = v_row.id;
    -- Descente vers une offre payante : nouvelle demande au prix de l'offre inferieure.
    if not v_row.is_trial and v_row.scheduled_plan_code is not null and v_row.scheduled_plan_code <> 'vitrine' then
      insert into public.subscriptions (company_id, plan_code, billing_cycle, price_charged_dzd)
      select s.company_id, v_row.scheduled_plan_code, s.billing_cycle, public.compute_price(v_row.scheduled_plan_code, s.billing_cycle)
        from public.subscriptions s where s.id = v_row.id
      on conflict do nothing;
    end if;
    update public.products p
       set quota_hidden = sub.hide
      from (
        select pr.id, (lim.limit_value is not null and row_number() over (order by pr.updated_at desc, pr.created_at desc) > lim.limit_value) as hide
          from public.products pr
          cross join lateral (
            select pf.limit_value from public.plan_features pf where pf.plan_code = 'vitrine' and pf.feature_key = 'products'
          ) lim
         where pr.company_id = v_row.company_id and pr.status = 'published'
      ) sub
     where p.id = sub.id and p.quota_hidden is distinct from sub.hide;
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

-- Acces
revoke execute on function
  public.compute_price(text, public.billing_cycle), public.request_subscription(uuid, text, public.billing_cycle),
  public.trial_slots_used(), public.start_trial(uuid, text)
  from public, anon;
grant execute on function
  public.compute_price(text, public.billing_cycle), public.request_subscription(uuid, text, public.billing_cycle),
  public.trial_slots_used(), public.start_trial(uuid, text)
  to authenticated;
-- La page Tarifs (visiteurs) calcule les prix.
grant execute on function public.compute_price(text, public.billing_cycle) to anon;
