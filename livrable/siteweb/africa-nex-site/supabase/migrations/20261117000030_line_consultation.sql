-- Lot 6d : consultation des producteurs pour les lignes sans prix (decisions d'Adlene du 17 novembre 2026).
--   - une consultation par ligne : le brief est rattache a une ligne de la demande, le producteur
--     repond avec le formulaire de devis habituel (un prix) ;
--   - le calcul automatique prend le devis valide le moins cher ; Adlene peut en retenir un autre.

-- 1. Envoi rattache a une ligne (facultatif : sans ligne, le brief porte sur toute la demande).
alter table public.rfq_lines add constraint rfq_lines_id_rfq_id_key unique (id, rfq_id);

alter table public.rfq_dispatches add column rfq_line_id uuid;
alter table public.rfq_dispatches
  add constraint rfq_dispatches_line_fkey foreign key (rfq_line_id, rfq_id)
  references public.rfq_lines (id, rfq_id) on delete cascade;

-- Un producteur recoit au plus un brief pour toute la demande, et un brief par ligne.
alter table public.rfq_dispatches drop constraint rfq_dispatches_rfq_id_company_id_key;
create unique index rfq_dispatches_whole_idx on public.rfq_dispatches (rfq_id, company_id) where rfq_line_id is null;
create unique index rfq_dispatches_line_idx on public.rfq_dispatches (rfq_line_id, company_id) where rfq_line_id is not null;

-- 2. Devis retenu par AFRICA NEX pour une ligne (sinon le moins cher). AFRICA NEX seule.
create table public.rfq_line_choices (
  rfq_line_id uuid primary key references public.rfq_lines (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  chosen_by uuid references public.profiles (id) on delete set null,
  chosen_at timestamptz not null default now()
);

alter table public.rfq_line_choices enable row level security;

create policy rfq_line_choices_admin on public.rfq_line_choices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.rfq_line_choices from anon;

-- 3. La construction du prix garde le devis utilise.
alter table public.offer_line_margins add column quote_id uuid references public.quotes (id) on delete set null;

-- 4. Devis recus pour les lignes d'une demande, avec le forfait et le mode du producteur. Admin seulement.
create function public.offer_auto_quotes(p_rfq uuid)
returns table (
  line_id uuid, quote_id uuid, quote_status text, unit_price_ht numeric, currency text, price_basis text,
  port_of_loading text, quantity numeric, production_lead_days integer, valid_until date,
  company_id uuid, company_name text, subscription_tier text, export_mode text, chosen boolean
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
  select d.rfq_line_id, q.id, q.status::text, q.unit_price_ht::numeric, q.currency::text, q.price_basis::text,
         q.port_of_loading::text, q.quantity::numeric, q.production_lead_days::integer, q.valid_until::date,
         c.id, c.company_name::text, c.subscription_tier::text, ss.export_mode::text,
         exists (select 1 from public.rfq_line_choices ch where ch.rfq_line_id = d.rfq_line_id and ch.quote_id = q.id)
    from public.rfq_dispatches d
    join public.quotes q on q.dispatch_id = d.id
    join public.companies c on c.id = q.company_id
    left join public.supplier_settings ss on ss.company_id = c.id
   where d.rfq_id = p_rfq
     and d.rfq_line_id is not null
     and q.status in ('submitted', 'selected')
   order by d.rfq_line_id, q.unit_price_ht;
end
$$;

revoke execute on function public.offer_auto_quotes(uuid) from public, anon;
grant execute on function public.offer_auto_quotes(uuid) to authenticated;

-- 5. save_auto_offers enregistre aussi le devis utilise par chaque ligne.
create or replace function public.save_auto_offers(p_rfq uuid, p_offers jsonb)
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

      insert into public.offer_line_margins (offer_line_id, product_id, quote_id, company_id, export_mode, supplier_unit_price,
                                             supplier_currency, base_amount, commission_rate, commission_amount,
                                             insurance_rate, insurance_amount, fx_margin_rate, fx_margin_amount,
                                             margin_amount, max_discount_rate, warnings)
      select v_line_id, m.product_id, m.quote_id, m.company_id, m.export_mode, m.supplier_unit_price, m.supplier_currency,
             m.base_amount, coalesce(m.commission_rate, 0), coalesce(m.commission_amount, 0),
             coalesce(m.insurance_rate, 0), coalesce(m.insurance_amount, 0),
             coalesce(m.fx_margin_rate, 0), coalesce(m.fx_margin_amount, 0), coalesce(m.margin_amount, 0),
             m.max_discount_rate, coalesce(m.warnings, '{}')
        from jsonb_to_record(v_line->'margin') as m(
          product_id uuid, quote_id uuid, company_id uuid, export_mode text, supplier_unit_price numeric, supplier_currency text,
          base_amount numeric, commission_rate numeric, commission_amount numeric, insurance_rate numeric,
          insurance_amount numeric, fx_margin_rate numeric, fx_margin_amount numeric, margin_amount numeric,
          max_discount_rate numeric, warnings text[]);
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;
