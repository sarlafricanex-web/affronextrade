-- Lot 6c : offre calculee automatiquement depuis la liste de prix des fournisseurs.
--
-- Une demande multi-lignes donne une offre par couple (mode d'affaire, devise) : une offre ne
-- melange jamais les deux modes et n'a jamais deux devises. Chaque offre est creee en brouillon ;
-- Adlene la valide avant publication.
--
--   offer_lines        : lignes presentees a l'acheteur (prix AFRICA NEX), lisibles comme l'offre ;
--   offer_line_margins : construction du prix ligne par ligne (fournisseur, prix fournisseur, commission,
--                        marge, remise maximale), AFRICA NEX seule, jamais publiee ;
--   offer_margins      : complete au niveau de l'offre (mode, taux de change utilise, marge negociee,
--                        fret a saisir).

-- 1. L'offre multi-lignes n'a pas de prix unitaire unique : il est porte par ses lignes.
--    Le fret est une ligne separee de l'offre (decision d'Adlene du 17 novembre 2026).
alter table public.offers alter column unit_price drop not null;
alter table public.offers add column freight_amount numeric(15, 2) check (freight_amount >= 0);

-- 2. Lignes de l'offre.
create table public.offer_lines (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  rfq_line_id uuid references public.rfq_lines (id) on delete set null,
  position smallint not null check (position between 1 and 50),
  description text not null check (char_length(description) between 1 and 300),
  reference text check (char_length(reference) <= 60),
  quantity numeric(15, 2) not null check (quantity > 0),
  unit text,
  unit_price numeric(15, 2) not null check (unit_price >= 0),
  total_amount numeric(15, 2) not null check (total_amount >= 0),
  incoterm text,
  incoterm_place text check (char_length(incoterm_place) <= 200),
  lead_time_days integer check (lead_time_days >= 0),
  availability text check (availability in ('stock', 'production')),
  created_at timestamptz not null default now(),
  unique (offer_id, position)
);

create index offer_lines_offer_idx on public.offer_lines (offer_id, position);

alter table public.offer_lines enable row level security;

-- L'acheteur lit les lignes des offres qu'il voit (offres non brouillon de ses demandes).
create policy offer_lines_select_buyer on public.offer_lines
  for select to authenticated
  using (exists (
    select 1 from public.offers o
      join public.rfqs r on r.id = o.rfq_id
     where o.id = offer_id and o.status <> 'draft' and r.buyer_profile_id = (select auth.uid())
  ));

create policy offer_lines_admin on public.offer_lines
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3. Construction du prix de chaque ligne : AFRICA NEX seule.
create table public.offer_line_margins (
  offer_line_id uuid primary key references public.offer_lines (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  export_mode text not null check (export_mode in ('self', 'africanex')),
  supplier_unit_price numeric(15, 2) not null check (supplier_unit_price > 0),
  supplier_currency varchar(3) not null check (supplier_currency in ('DZD', 'EUR', 'USD')),
  base_amount numeric(15, 2) not null check (base_amount >= 0),
  commission_rate numeric(5, 2) not null default 0 check (commission_rate between 0 and 100),
  commission_amount numeric(15, 2) not null default 0,
  insurance_rate numeric(5, 2) not null default 0 check (insurance_rate between 0 and 100),
  insurance_amount numeric(15, 2) not null default 0,
  fx_margin_rate numeric(5, 2) not null default 0 check (fx_margin_rate between 0 and 100),
  fx_margin_amount numeric(15, 2) not null default 0,
  margin_amount numeric(15, 2) not null default 0,
  max_discount_rate numeric(5, 2) check (max_discount_rate between 0 and 100),
  warnings text[] not null default '{}'
);

alter table public.offer_line_margins enable row level security;

create policy offer_line_margins_admin on public.offer_line_margins
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Niveau de l'offre. auto = offre calculee (recalculable tant qu'elle est en brouillon).
--    margin_pending : mode export AFRICA NEX, marge negociee au cas par cas, pas encore saisie ;
--    freight_pending : fret gere par AFRICA NEX, pas encore saisi. Les deux bloquent la publication.
alter table public.offer_margins
  add column auto boolean not null default false,
  add column export_mode text check (export_mode in ('self', 'africanex')),
  add column fx_rate numeric(12, 4) check (fx_rate > 0),
  add column fx_margin_rate numeric(5, 2) check (fx_margin_rate between 0 and 100),
  add column margin_rate numeric(5, 2) check (margin_rate between 0 and 1000),
  add column margin_amount numeric(15, 2) check (margin_amount >= 0),
  add column margin_pending boolean not null default false,
  add column freight_pending boolean not null default false;

-- Garde-fou en base : une offre ne se publie pas avec une marge ou un fret a saisir.
create function public.offers_check_publishable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' and exists (
    select 1 from public.offer_margins m where m.offer_id = new.id and (m.margin_pending or m.freight_pending)
  ) then
    raise exception 'offer has pending margin or freight' using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger offers_check_publishable
  before update of status on public.offers
  for each row execute function public.offers_check_publishable();

-- 5. Donnees du calcul pour une demande : chaque ligne avec son produit, son prix (confidentiel),
--    le forfait et le mode du fournisseur, et la grille de remise (celle du produit, sinon celle du
--    fournisseur). Reservee a l'admin.
create function public.offer_auto_inputs(p_rfq uuid)
returns table (
  line_id uuid, line_position smallint, line_description text, line_reference text,
  line_quantity numeric, line_unit text,
  product_id uuid, product_name text, product_status text, product_unit text,
  unit_price_ht numeric, currency text, price_basis text, price_place text, price_valid_until date,
  price_dzd_ht numeric, stock_quantity numeric, lead_time_days integer, min_order_quantity numeric,
  discount_tiers jsonb,
  company_id uuid, company_name text, subscription_tier text, export_mode text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select l.id, l.position::smallint, l.description::text, l.reference::text, l.quantity::numeric, l.unit::text,
         p.id, p.product_name::text, p.status::text, p.unit::text,
         p.unit_price_ht::numeric, p.currency::text, p.price_basis::text, p.price_place::text, p.price_valid_until::date,
         p.price_dzd_ht::numeric, p.stock_quantity::numeric, p.lead_time_days::integer, p.min_order_quantity::numeric,
         coalesce(p.discount_tiers, sp.discount_tiers),
         c.id, c.company_name::text, c.subscription_tier::text, ss.export_mode::text
    from public.rfq_lines l
    left join public.products p on p.id = l.product_id
    left join public.companies c on c.id = p.company_id
    left join public.supplier_settings ss on ss.company_id = c.id
    left join public.supplier_pricing sp on sp.company_id = c.id
   where l.rfq_id = p_rfq
   order by l.position;
end
$$;

revoke execute on function public.offer_auto_inputs(uuid) from public, anon;
grant execute on function public.offer_auto_inputs(uuid) to authenticated;

-- 6. Ecriture des offres calculees en une seule transaction : les brouillons automatiques de la
--    demande sont remplaces. Refus si une offre automatique est deja publiee ou acceptee.
--    p_offers : [{ label, currency, incoterm, valid_until, lead_time_days, total_amount,
--                  margin: {...offer_margins}, lines: [{ ...offer_lines, margin: {...offer_line_margins} }] }]
create function public.save_auto_offers(p_rfq uuid, p_offers jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_offer jsonb;
  v_line jsonb;
  v_offer_id uuid;
  v_line_id uuid;
  v_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.rfqs where id = p_rfq and status in ('qualified', 'dispatched', 'offered')) then
    raise exception 'rfq closed' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.offers o join public.offer_margins m on m.offer_id = o.id
     where o.rfq_id = p_rfq and m.auto and o.status <> 'draft'
  ) then
    raise exception 'auto offer already published' using errcode = 'P0003';
  end if;

  delete from public.offers o
   using public.offer_margins m
   where m.offer_id = o.id and o.rfq_id = p_rfq and m.auto and o.status = 'draft';

  for v_offer in select * from jsonb_array_elements(p_offers) loop
    insert into public.offers (rfq_id, label, currency, incoterm, quantity, unit_price, total_amount,
                               lead_time_days, origin_region, cagex_insured, valid_until, created_by)
    values (p_rfq, v_offer->>'label', v_offer->>'currency', v_offer->>'incoterm', null, null,
            (v_offer->>'total_amount')::numeric, (v_offer->>'lead_time_days')::integer, 'Algérie',
            coalesce((v_offer->>'cagex_insured')::boolean, false), (v_offer->>'valid_until')::date, (select auth.uid()))
    returning id into v_offer_id;

    insert into public.offer_margins (offer_id, auto, export_mode, fx_rate, fx_margin_rate, margin_rate, margin_amount,
                                      margin_pending, freight_pending, producer_currency, commission_rate,
                                      commission_amount, insurance_rate, insurance_cost)
    select v_offer_id, true, m.export_mode, m.fx_rate, m.fx_margin_rate, m.margin_rate, m.margin_amount,
           coalesce(m.margin_pending, false), coalesce(m.freight_pending, false), m.producer_currency, m.commission_rate,
           m.commission_amount, m.insurance_rate, m.insurance_cost
      from jsonb_to_record(v_offer->'margin') as m(
        export_mode text, fx_rate numeric, fx_margin_rate numeric, margin_rate numeric, margin_amount numeric,
        margin_pending boolean, freight_pending boolean, producer_currency text, commission_rate numeric,
        commission_amount numeric, insurance_rate numeric, insurance_cost numeric);

    for v_line in select * from jsonb_array_elements(v_offer->'lines') loop
      insert into public.offer_lines (offer_id, rfq_line_id, position, description, reference, quantity, unit,
                                      unit_price, total_amount, incoterm, incoterm_place, lead_time_days, availability)
      select v_offer_id, l.rfq_line_id, l.position, l.description, l.reference, l.quantity, l.unit,
             l.unit_price, l.total_amount, l.incoterm, l.incoterm_place, l.lead_time_days, l.availability
        from jsonb_to_record(v_line) as l(
          rfq_line_id uuid, position smallint, description text, reference text, quantity numeric, unit text,
          unit_price numeric, total_amount numeric, incoterm text, incoterm_place text, lead_time_days integer,
          availability text)
      returning id into v_line_id;

      insert into public.offer_line_margins (offer_line_id, product_id, company_id, export_mode, supplier_unit_price,
                                             supplier_currency, base_amount, commission_rate, commission_amount,
                                             insurance_rate, insurance_amount, fx_margin_rate, fx_margin_amount,
                                             margin_amount, max_discount_rate, warnings)
      select v_line_id, m.product_id, m.company_id, m.export_mode, m.supplier_unit_price, m.supplier_currency,
             m.base_amount, coalesce(m.commission_rate, 0), coalesce(m.commission_amount, 0),
             coalesce(m.insurance_rate, 0), coalesce(m.insurance_amount, 0),
             coalesce(m.fx_margin_rate, 0), coalesce(m.fx_margin_amount, 0), coalesce(m.margin_amount, 0),
             m.max_discount_rate, coalesce(m.warnings, '{}')
        from jsonb_to_record(v_line->'margin') as m(
          product_id uuid, company_id uuid, export_mode text, supplier_unit_price numeric, supplier_currency text,
          base_amount numeric, commission_rate numeric, commission_amount numeric, insurance_rate numeric,
          insurance_amount numeric, fx_margin_rate numeric, fx_margin_amount numeric, margin_amount numeric,
          max_discount_rate numeric, warnings text[]);
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

revoke execute on function public.save_auto_offers(uuid, jsonb) from public, anon;
grant execute on function public.save_auto_offers(uuid, jsonb) to authenticated;

revoke all on table public.offer_lines, public.offer_line_margins from anon;
