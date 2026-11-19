-- Lot 6e : saisie par AFRICA NEX sur une offre calculee (decisions d'Adlene des 14 au 19 novembre 2026).
--   - intermediation : commission de la grille, modifiable offre par offre ;
--   - export par AFRICA NEX : marge negociee au cas par cas, en % ou en montant, secrete ;
--   - fret : ligne separee de l'offre, ajoutee au total ;
--   - conditions presentees a l'acheteur : lieu de l'incoterm, validite, paiement, precisions.
-- Le prix de chaque ligne est recalcule par le serveur (meme fonction que l'apercu) et enregistre ici
-- en une seule transaction. Seule une offre calculee en brouillon, sur une demande ouverte, se modifie.
-- La publication reste bloquee en base tant que marge ou fret sont a saisir (lot 6c).

create function public.save_offer_pricing(p_offer uuid, p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rfq uuid;
  v_status text;
  v_line jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select o.rfq_id, o.status into v_rfq, v_status
    from public.offers o
    join public.offer_margins m on m.offer_id = o.id and m.auto
   where o.id = p_offer
     for update of o;
  if v_rfq is null then
    raise exception 'not an auto offer' using errcode = 'P0004';
  end if;
  if v_status <> 'draft' then
    raise exception 'offer not draft' using errcode = 'P0005';
  end if;
  if not exists (select 1 from public.rfqs where id = v_rfq and status in ('qualified', 'dispatched', 'offered')) then
    raise exception 'rfq closed' using errcode = 'P0002';
  end if;

  -- Toutes les lignes de l'offre, et seulement elles.
  if (select count(*) from public.offer_lines where offer_id = p_offer) <> jsonb_array_length(p->'lines')
     or exists (
       select 1 from jsonb_array_elements(p->'lines') e
        where not exists (select 1 from public.offer_lines l where l.id = (e->>'id')::uuid and l.offer_id = p_offer)
     ) then
    raise exception 'line mismatch' using errcode = 'P0006';
  end if;

  for v_line in select * from jsonb_array_elements(p->'lines') loop
    update public.offer_lines
       set unit_price = (v_line->>'unit_price')::numeric,
           total_amount = (v_line->>'total_amount')::numeric
     where id = (v_line->>'id')::uuid;
    update public.offer_line_margins
       set commission_rate = coalesce((v_line->>'commission_rate')::numeric, 0),
           commission_amount = coalesce((v_line->>'commission_amount')::numeric, 0),
           fx_margin_amount = coalesce((v_line->>'fx_margin_amount')::numeric, 0),
           margin_amount = coalesce((v_line->>'margin_amount')::numeric, 0)
     where offer_line_id = (v_line->>'id')::uuid;
  end loop;

  update public.offers
     set total_amount = (p->>'total_amount')::numeric,
         freight_amount = (p->>'freight_amount')::numeric,
         incoterm_place = nullif(p->>'incoterm_place', ''),
         valid_until = (p->>'valid_until')::date,
         payment_terms = nullif(p->>'payment_terms', ''),
         notes = nullif(p->>'notes', '')
   where id = p_offer;

  update public.offer_margins
     set commission_rate = (p->>'commission_rate')::numeric,
         commission_amount = (p->>'commission_amount')::numeric,
         margin_rate = (p->>'margin_rate')::numeric,
         margin_amount = (p->>'margin_amount')::numeric,
         margin_pending = coalesce((p->>'margin_pending')::boolean, false),
         freight_cost = (p->>'freight_cost')::numeric,
         freight_pending = coalesce((p->>'freight_pending')::boolean, false)
   where offer_id = p_offer;
end
$$;

revoke execute on function public.save_offer_pricing(uuid, jsonb) from public, anon;
grant execute on function public.save_offer_pricing(uuid, jsonb) to authenticated;
