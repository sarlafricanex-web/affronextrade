-- Abonnements fournisseurs (decisions d'Adlene des 20 et 21 novembre 2026) : Vitrine gratuite et
-- 3 forfaits payants, offre fondateurs, quotas par forfait. Aucun prix ni quota code en dur : tout
-- vient des tables ci-dessous, modifiables par AFRICA NEX seule.
--   - prix en DZD HT ; annuel paye d'avance = mensuel x (12 - mois offerts) ;
--   - remise fondateur sur l'annuel paye d'avance seulement, 1re annee, places limitees ;
--   - pas de paiement en ligne : demande "paiement en attente", AFRICA NEX valide le paiement recu ;
--   - montee de forfait immediate, descente en fin de periode payee ;
--   - fin d'abonnement ou impaye : retour en Vitrine ; les produits au-dela du quota sont masques,
--     jamais supprimes ;
--   - la logistique (fret) n'est PAS dans les forfaits : c'est un service choisi par l'acheteur.
-- Fournisseur = entreprise de type producteur (table companies).

-- 1. Parametres modifiables par AFRICA NEX
create table public.billing_settings (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  value numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.billing_settings (key, value) values
  ('annual_free_months', 2),
  ('founder_discount', 0.5),
  ('founder_slots', 30);

-- 2. Forfaits
create table public.plans (
  code text primary key check (code ~ '^[a-z_]{2,30}$'),
  name text not null check (char_length(name) between 1 and 40),
  monthly_price_dzd integer not null check (monthly_price_dzd >= 0),
  sort_order smallint not null,
  is_active boolean not null default true
);
insert into public.plans (code, name, monthly_price_dzd, sort_order) values
  ('vitrine', 'Vitrine', 0, 1),
  ('essentiel', 'Essentiel', 15000, 2),
  ('croissance', 'Croissance', 40000, 3),
  ('export_pro', 'Export Pro', 90000, 4);

-- 3. Fonctions (services) : available = false -> affiche "Bientot" (service pas encore construit).
create table public.features (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  sort_order smallint not null,
  available boolean not null default false
);
insert into public.features (key, sort_order, available) values
  ('products', 1, true),
  ('buyer_requests', 2, true),
  ('human_support', 3, true),
  ('ai_videos', 4, false),
  ('ai_campaigns', 5, false),
  ('sponsored', 6, false),
  ('hs_code_countries', 7, false),
  ('packaging_countries', 8, false),
  ('market_watch', 9, false),
  ('tenders', 10, false),
  ('photo_enhancement', 11, false);

-- 4. Droits et quotas par forfait. limit_value : null = illimite, 0 = non inclus.
create type public.quota_period as enum ('none', 'once', 'month', 'quarter');
create table public.plan_features (
  plan_code text not null references public.plans (code) on update cascade on delete cascade,
  feature_key text not null references public.features (key) on update cascade on delete cascade,
  limit_value integer check (limit_value is null or limit_value >= 0),
  period public.quota_period not null default 'none',
  access_level text check (char_length(access_level) <= 40),
  primary key (plan_code, feature_key)
);
insert into public.plan_features (plan_code, feature_key, limit_value, period, access_level) values
  -- produits publies (stock, sans periode)
  ('vitrine', 'products', 10, 'none', null),
  ('essentiel', 'products', 50, 'none', null),
  ('croissance', 'products', 200, 'none', null),
  ('export_pro', 'products', null, 'none', null),
  -- demandes d'acheteurs
  ('vitrine', 'buyer_requests', null, 'none', 'standard'),
  ('essentiel', 'buyer_requests', null, 'none', 'standard'),
  ('croissance', 'buyer_requests', null, 'none', 'priority'),
  ('export_pro', 'buyer_requests', null, 'none', 'priority_featured'),
  -- accompagnement humain
  ('vitrine', 'human_support', 0, 'none', null),
  ('essentiel', 'human_support', null, 'none', 'email'),
  ('croissance', 'human_support', null, 'none', 'priority'),
  ('export_pro', 'human_support', null, 'none', 'dedicated'),
  -- videos IA : Vitrine une fois (demo), Essentiel par trimestre, les autres par mois
  ('vitrine', 'ai_videos', 1, 'once', 'demo'),
  ('essentiel', 'ai_videos', 1, 'quarter', null),
  ('croissance', 'ai_videos', 2, 'month', null),
  ('export_pro', 'ai_videos', 4, 'month', null),
  -- campagnes Meta / Instagram
  ('vitrine', 'ai_campaigns', 0, 'month', null),
  ('essentiel', 'ai_campaigns', 0, 'month', null),
  ('croissance', 'ai_campaigns', 1, 'month', null),
  ('export_pro', 'ai_campaigns', 4, 'month', null),
  -- videos et leads sponsorises
  ('vitrine', 'sponsored', 0, 'none', null),
  ('essentiel', 'sponsored', 0, 'none', 'paid_option'),
  ('croissance', 'sponsored', null, 'none', null),
  ('export_pro', 'sponsored', null, 'none', null),
  -- pays destinataires (codes SH)
  ('vitrine', 'hs_code_countries', 1, 'none', null),
  ('essentiel', 'hs_code_countries', 3, 'none', null),
  ('croissance', 'hs_code_countries', 10, 'none', null),
  ('export_pro', 'hs_code_countries', null, 'none', null),
  -- normes d'emballage par pays
  ('vitrine', 'packaging_countries', 0, 'none', 'preview'),
  ('essentiel', 'packaging_countries', 1, 'none', null),
  ('croissance', 'packaging_countries', 3, 'none', null),
  ('export_pro', 'packaging_countries', null, 'none', 'ai_design'),
  -- veille des 25 marches africains
  ('vitrine', 'market_watch', 0, 'none', 'preview_macro'),
  ('essentiel', 'market_watch', 5, 'none', null),
  ('croissance', 'market_watch', 15, 'none', null),
  ('export_pro', 'market_watch', 25, 'none', 'macro_micro'),
  -- appels d'offres africains
  ('vitrine', 'tenders', 0, 'none', null),
  ('essentiel', 'tenders', 0, 'none', null),
  ('croissance', 'tenders', null, 'none', 'alerts'),
  ('export_pro', 'tenders', null, 'none', 'alerts_full'),
  -- amelioration des photos
  ('vitrine', 'photo_enhancement', 0, 'none', null),
  ('essentiel', 'photo_enhancement', 0, 'none', null),
  ('croissance', 'photo_enhancement', 0, 'none', null),
  ('export_pro', 'photo_enhancement', null, 'none', null);

-- 5. Abonnements. Pas de ligne = Vitrine. Un seul abonnement actif et une seule demande en attente
--    par fournisseur. Le prix est fige a la souscription.
create type public.billing_cycle as enum ('monthly', 'annual_prepaid');
create type public.sub_status as enum ('pending_payment', 'active', 'past_due', 'cancelled');
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  plan_code text not null references public.plans (code) on update cascade,
  billing_cycle public.billing_cycle not null default 'monthly',
  status public.sub_status not null default 'pending_payment',
  is_founder boolean not null default false,
  founder_testimonial_received boolean not null default false,
  price_charged_dzd integer not null check (price_charged_dzd >= 0),
  current_period_start date,
  current_period_end date,
  scheduled_plan_code text references public.plans (code) on update cascade,
  payment_reference text check (char_length(payment_reference) <= 120),
  activated_at timestamptz,
  activated_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (plan_code <> 'vitrine'),
  check (not is_founder or billing_cycle = 'annual_prepaid'),
  check (current_period_end is null or current_period_end >= current_period_start)
);
create unique index subscriptions_one_active on public.subscriptions (company_id) where status = 'active';
create unique index subscriptions_one_pending on public.subscriptions (company_id) where status = 'pending_payment';
create index subscriptions_company_idx on public.subscriptions (company_id, created_at desc);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- 6. Consommation des quotas a periode (videos, campagnes...). Les produits se comptent directement.
create table public.usage_counters (
  company_id uuid not null references public.companies (id) on delete cascade,
  feature_key text not null references public.features (key) on update cascade on delete cascade,
  period_start date not null,
  used integer not null default 0 check (used >= 0),
  primary key (company_id, feature_key, period_start)
);

-- 7. Produits masques par le quota (distinct du statut choisi par le fournisseur, jamais supprimes).
alter table public.products add column quota_hidden boolean not null default false;

drop policy products_select_public on public.products;
create policy products_select_public on public.products
  for select to anon, authenticated
  using (
    status = 'published'
    and not quota_hidden
    and exists (
      select 1 from public.companies c
       where c.id = products.company_id
         and c.visibility = 'published'
         and c.kind = 'producer'
    )
  );

-- 8. Preparation de la session 2 : accord du fournisseur pour l'export par AFRICA NEX, et choix
--    logistique de l'acheteur sur sa demande.
alter table public.companies
  add column africanex_export_consent boolean not null default false,
  add column africanex_export_consent_at timestamptz;
alter table public.rfqs
  add column logistics text check (logistics in ('buyer', 'africanex'));

-- ---------------------------------------------------------------------------------------------
-- Fonctions
-- ---------------------------------------------------------------------------------------------

-- Lecture autorisee : AFRICA NEX ou une personne de l'entreprise.
create function public.can_read_company_billing(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or public.is_member_of(p_company);
$$;

create function public.billing_setting(p_key text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.billing_settings where key = p_key;
$$;

-- Forfait en vigueur : l'abonnement actif dont la periode n'est pas terminee, sinon Vitrine.
create function public.current_plan(p_company uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan text;
begin
  if not public.can_read_company_billing(p_company) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select s.plan_code into v_plan
    from public.subscriptions s
   where s.company_id = p_company and s.status = 'active' and s.current_period_end >= current_date
   order by s.current_period_end desc
   limit 1;
  return coalesce(v_plan, 'vitrine');
end
$$;

-- Debut de la periode en cours d'un quota.
create function public.quota_period_start(p_period public.quota_period)
returns date
language sql
stable
set search_path = ''
as $$
  select case p_period
    when 'month' then date_trunc('month', current_date)::date
    when 'quarter' then date_trunc('quarter', current_date)::date
    else date '1970-01-01'
  end;
$$;

-- Etat d'un quota : autorise ? limite, consomme, reste (null = illimite).
create function public.can_use(p_company uuid, p_feature text)
returns table (allowed boolean, plan_code text, limit_value integer, used integer, remaining integer, available boolean, access_level text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan text := public.current_plan(p_company);
  v_feature public.plan_features%rowtype;
  v_available boolean;
  v_used integer := 0;
begin
  select * into v_feature from public.plan_features pf where pf.plan_code = v_plan and pf.feature_key = p_feature;
  select f.available into v_available from public.features f where f.key = p_feature;
  if v_available is null then
    raise exception 'unknown feature' using errcode = '22023';
  end if;
  if p_feature = 'products' then
    select count(*)::integer into v_used from public.products p
     where p.company_id = p_company and p.status = 'published' and not p.quota_hidden;
  elsif v_feature.feature_key is not null then
    select coalesce(sum(u.used), 0)::integer into v_used from public.usage_counters u
     where u.company_id = p_company and u.feature_key = p_feature
       and u.period_start = public.quota_period_start(v_feature.period);
  end if;
  return query select
    coalesce(v_available, false) and v_feature.feature_key is not null and (v_feature.limit_value is null or v_used < v_feature.limit_value),
    v_plan,
    v_feature.limit_value,
    v_used,
    case when v_feature.limit_value is null then null else greatest(v_feature.limit_value - v_used, 0) end,
    v_available,
    v_feature.access_level;
end
$$;

-- Consommation atomique d'un quota a periode ; refusee si le quota est atteint.
create function public.consume(p_company uuid, p_feature text, p_amount integer default 1)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text := public.current_plan(p_company);
  v_feature public.plan_features%rowtype;
  v_start date;
  v_used integer;
begin
  if p_amount is null or p_amount < 1 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;
  if p_feature = 'products' then
    raise exception 'products quota is not consumable' using errcode = '22023';
  end if;
  if not exists (select 1 from public.features f where f.key = p_feature and f.available) then
    raise exception 'feature not available' using errcode = 'P0010';
  end if;
  select * into v_feature from public.plan_features pf where pf.plan_code = v_plan and pf.feature_key = p_feature;
  if v_feature.feature_key is null or v_feature.limit_value = 0 then
    raise exception 'quota exceeded' using errcode = 'P0011';
  end if;
  v_start := public.quota_period_start(v_feature.period);
  insert into public.usage_counters as u (company_id, feature_key, period_start, used)
  values (p_company, p_feature, v_start, p_amount)
  on conflict (company_id, feature_key, period_start) do update
    set used = u.used + excluded.used
    where v_feature.limit_value is null or u.used + excluded.used <= v_feature.limit_value
  returning u.used into v_used;
  if v_used is null or (v_feature.limit_value is not null and v_used > v_feature.limit_value) then
    raise exception 'quota exceeded' using errcode = 'P0011';
  end if;
  return v_used;
end
$$;

-- Prix d'un forfait selon le cycle ; remise fondateur sur l'annuel paye d'avance seulement.
create function public.compute_price(p_plan text, p_cycle public.billing_cycle, p_founder boolean default false)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_monthly integer;
  v_price numeric;
begin
  select monthly_price_dzd into v_monthly from public.plans where code = p_plan and is_active;
  if v_monthly is null then
    raise exception 'unknown plan' using errcode = '22023';
  end if;
  if p_founder and p_cycle <> 'annual_prepaid' then
    raise exception 'founder discount requires annual prepaid' using errcode = '22023';
  end if;
  if p_cycle = 'monthly' then
    return v_monthly;
  end if;
  v_price := v_monthly * (12 - public.billing_setting('annual_free_months'));
  if p_founder then
    v_price := v_price * (1 - public.billing_setting('founder_discount'));
  end if;
  return round(v_price)::integer;
end
$$;

-- Places fondateurs utilisees : demandes en cours et abonnements actives au moins une fois.
create function public.founder_slots_used()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct company_id)::integer from public.subscriptions
   where is_founder and (status <> 'cancelled' or activated_at is not null);
$$;

-- Attribution d'une place fondateur (premier arrive, verrou de transaction).
create function public.claim_founder_slot(p_company uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_read_company_billing(p_company) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('africanex_founder_slots'));
  if exists (select 1 from public.subscriptions where company_id = p_company and is_founder and (status <> 'cancelled' or activated_at is not null)) then
    return true;
  end if;
  return public.founder_slots_used() < public.billing_setting('founder_slots');
end
$$;

-- Demande d'abonnement par le fournisseur (ou AFRICA NEX pour lui) : "paiement en attente".
-- Remplace une demande en attente precedente. Une place fondateur est reservee si demandee.
create function public.request_subscription(p_company uuid, p_plan text, p_cycle public.billing_cycle, p_founder boolean default false)
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
  if p_founder and not public.claim_founder_slot(p_company) then
    raise exception 'no founder slot' using errcode = 'P0012';
  end if;
  insert into public.subscriptions (company_id, plan_code, billing_cycle, is_founder, price_charged_dzd, created_by)
  values (p_company, p_plan, p_cycle, p_founder, public.compute_price(p_plan, p_cycle, p_founder), (select auth.uid()))
  returning id into v_id;
  return v_id;
end
$$;

-- Produits au-dela du quota : masques (les plus recemment modifies restent visibles), jamais
-- supprimes ; demasques dans la limite du forfait quand il augmente.
create function public.enforce_product_quota(p_company uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_hidden integer;
begin
  if not public.can_read_company_billing(p_company) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select pf.limit_value into v_limit from public.plan_features pf
   where pf.plan_code = public.current_plan(p_company) and pf.feature_key = 'products';
  -- Reajustement d'ensemble : le garde-fou de publication ne s'applique pas ligne par ligne ici.
  perform set_config('africanex.quota_sync', 'on', true);
  with ranked as (
    select p.id, row_number() over (order by p.updated_at desc, p.created_at desc) as rn
      from public.products p
     where p.company_id = p_company and p.status = 'published'
  )
  update public.products p
     set quota_hidden = (v_limit is not null and r.rn > v_limit)
    from ranked r
   where p.id = r.id and p.quota_hidden is distinct from (v_limit is not null and r.rn > v_limit);
  select count(*)::integer into v_hidden from public.products where company_id = p_company and quota_hidden;
  return v_hidden;
end
$$;

-- Validation d'un paiement par AFRICA NEX : l'abonnement demarre aujourd'hui (montee immediate),
-- l'ancien abonnement actif est clos, les produits sont remis dans la limite du nouveau quota.
create function public.activate_subscription(p_subscription uuid, p_payment_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_sub from public.subscriptions where id = p_subscription for update;
  if v_sub.id is null or v_sub.status not in ('pending_payment', 'past_due') then
    raise exception 'subscription not payable' using errcode = 'P0013';
  end if;
  update public.subscriptions set status = 'cancelled'
   where company_id = v_sub.company_id and status = 'active' and id <> v_sub.id;
  update public.subscriptions
     set status = 'active',
         current_period_start = current_date,
         current_period_end = (current_date + case when v_sub.billing_cycle = 'monthly' then interval '1 month' else interval '12 months' end - interval '1 day')::date,
         payment_reference = nullif(btrim(p_payment_reference), ''),
         activated_at = coalesce(activated_at, now()),
         activated_by = (select auth.uid())
   where id = v_sub.id;
  perform public.enforce_product_quota(v_sub.company_id);
  insert into public.audit_log (actor_profile_id, action, entity, entity_id, payload)
  values ((select auth.uid()), 'subscription.activate', 'subscription', v_sub.id::text,
          jsonb_build_object('company', v_sub.company_id, 'plan', v_sub.plan_code, 'cycle', v_sub.billing_cycle, 'price', v_sub.price_charged_dzd));
end
$$;

-- Descente de forfait : programmee pour la fin de la periode payee (vers un forfait inferieur ou
-- la Vitrine). null annule la descente programmee.
create function public.schedule_downgrade(p_company uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text := public.current_plan(p_company);
begin
  if p_plan is not null and (select sort_order from public.plans where code = p_plan) >= (select sort_order from public.plans where code = v_current) then
    raise exception 'not a downgrade' using errcode = '22023';
  end if;
  update public.subscriptions set scheduled_plan_code = p_plan
   where company_id = p_company and status = 'active';
  if not found then
    raise exception 'no active subscription' using errcode = 'P0014';
  end if;
end
$$;

-- Fin de periode : un abonnement actif echu passe "impaye" (retour en Vitrine) ; une descente
-- programmee vers la Vitrine le clot. Puis les quotas de produits sont appliques. AFRICA NEX ou la
-- tache planifiee ; renvoie le nombre d'abonnements traites.
create function public.sync_subscriptions()
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
    select id, company_id, scheduled_plan_code from public.subscriptions
     where status = 'active' and current_period_end < current_date
  loop
    update public.subscriptions
       set status = case when v_row.scheduled_plan_code = 'vitrine' then 'cancelled'::public.sub_status else 'past_due'::public.sub_status end
     where id = v_row.id;
    -- Descente vers un forfait payant : nouvelle demande au prix du forfait inferieur.
    if v_row.scheduled_plan_code is not null and v_row.scheduled_plan_code <> 'vitrine' then
      insert into public.subscriptions (company_id, plan_code, billing_cycle, price_charged_dzd)
      select s.company_id, v_row.scheduled_plan_code, s.billing_cycle, public.compute_price(v_row.scheduled_plan_code, s.billing_cycle, false)
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

-- Garde-fou : on ne publie pas (ni ne demasque) un produit au-dela du quota du forfait.
-- AFRICA NEX n'est pas soumise au quota (fiches qu'elle cree pour des producteurs non inscrits).
create function public.products_check_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if new.status <> 'published' or new.quota_hidden or public.is_admin()
     or current_setting('africanex.quota_sync', true) = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' and not old.quota_hidden then
    return new;
  end if;
  select pf.limit_value into v_limit from public.plan_features pf
   where pf.feature_key = 'products'
     and pf.plan_code = coalesce(
       (select s.plan_code from public.subscriptions s
         where s.company_id = new.company_id and s.status = 'active' and s.current_period_end >= current_date
         order by s.current_period_end desc limit 1),
       'vitrine');
  if v_limit is null then
    return new;
  end if;
  select count(*)::integer into v_count from public.products
   where company_id = new.company_id and status = 'published' and not quota_hidden and id <> new.id;
  if v_count >= v_limit then
    raise exception 'product quota reached' using errcode = 'P0015';
  end if;
  return new;
end
$$;

create trigger products_check_quota
  before insert or update of status, quota_hidden on public.products
  for each row execute function public.products_check_quota();

-- ---------------------------------------------------------------------------------------------
-- Acces
-- ---------------------------------------------------------------------------------------------
alter table public.billing_settings enable row level security;
alter table public.plans enable row level security;
alter table public.features enable row level security;
alter table public.plan_features enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_counters enable row level security;

-- Forfaits, quotas et parametres : lisibles par tous (page Tarifs), modifiables par AFRICA NEX seule.
create policy billing_settings_read on public.billing_settings for select to anon, authenticated using (true);
create policy billing_settings_admin on public.billing_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy plans_read on public.plans for select to anon, authenticated using (true);
create policy plans_admin on public.plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy features_read on public.features for select to anon, authenticated using (true);
create policy features_admin on public.features for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy plan_features_read on public.plan_features for select to anon, authenticated using (true);
create policy plan_features_admin on public.plan_features for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Abonnements et compteurs : le fournisseur lit les siens ; seules les fonctions ci-dessus ecrivent
-- (et AFRICA NEX).
create policy subscriptions_member_read on public.subscriptions for select to authenticated using (public.is_member_of(company_id));
create policy subscriptions_admin on public.subscriptions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy usage_counters_member_read on public.usage_counters for select to authenticated using (public.is_member_of(company_id));
create policy usage_counters_admin_read on public.usage_counters for select to authenticated using (public.is_admin());

revoke all on table public.subscriptions, public.usage_counters from anon;
revoke execute on function public.can_read_company_billing(uuid), public.billing_setting(text) from public, anon, authenticated;
revoke execute on function
  public.current_plan(uuid), public.can_use(uuid, text), public.consume(uuid, text, integer),
  public.compute_price(text, public.billing_cycle, boolean), public.founder_slots_used(),
  public.claim_founder_slot(uuid), public.request_subscription(uuid, text, public.billing_cycle, boolean),
  public.enforce_product_quota(uuid), public.activate_subscription(uuid, text),
  public.schedule_downgrade(uuid, text), public.sync_subscriptions()
  from public, anon;
grant execute on function
  public.current_plan(uuid), public.can_use(uuid, text), public.consume(uuid, text, integer),
  public.compute_price(text, public.billing_cycle, boolean), public.founder_slots_used(),
  public.claim_founder_slot(uuid), public.request_subscription(uuid, text, public.billing_cycle, boolean),
  public.enforce_product_quota(uuid), public.activate_subscription(uuid, text),
  public.schedule_downgrade(uuid, text), public.sync_subscriptions()
  to authenticated;
-- La page Tarifs (visiteurs) calcule les prix et le nombre de places fondateurs restantes.
grant execute on function public.compute_price(text, public.billing_cycle, boolean), public.founder_slots_used() to anon;
