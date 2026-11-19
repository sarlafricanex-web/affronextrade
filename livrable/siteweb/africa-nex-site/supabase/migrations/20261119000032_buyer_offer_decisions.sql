-- Lot 5e : l'acheteur decide de chaque offre AFRICA NEX (decisions d'Adlene du 19 novembre 2026).
--   - offre par offre : une demande multi-lignes recoit des offres complementaires (une par mode,
--     devise et incoterm). Accepter une offre n'ecarte que ses alternatives, c'est-a-dire les offres
--     publiees qui portent sur au moins une meme ligne (une offre sans lignes, composee depuis un devis,
--     porte sur toute la demande) ;
--   - refus explicite ("ne pas retenir") avec un motif facultatif ;
--   - demande de changement de devise : l'offre reste publiee avec la mention, AFRICA NEX traite la
--     demande puis publie une nouvelle offre.
-- La demande passe "acceptee" quand plus aucune offre n'attend de reponse et qu'au moins une est
-- acceptee ; si toutes sont ecartees, elle revient en consultation pour AFRICA NEX.

alter table public.offers
  add column decided_at timestamptz,
  add column decline_reason text check (char_length(decline_reason) <= 500),
  add column currency_change_to varchar(3) check (currency_change_to in ('DZD', 'EUR', 'USD')),
  add column currency_change_note text check (char_length(currency_change_note) <= 500),
  add column currency_change_at timestamptz;

-- Deux offres d'une meme demande se recouvrent si elles portent sur une meme ligne, ou si l'une
-- n'a pas de lignes (elle couvre alors toute la demande).
create function public.offers_overlap(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not exists (select 1 from public.offer_lines where offer_id = a)
      or not exists (select 1 from public.offer_lines where offer_id = b)
      or exists (
        select 1 from public.offer_lines la
          join public.offer_lines lb on lb.rfq_line_id = la.rfq_line_id
         where la.offer_id = a and lb.offer_id = b
      );
$$;

-- Statut de la demande apres une decision de l'acheteur.
create function public.rfq_settle_offers(p_rfq uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.offers where rfq_id = p_rfq and status = 'published') then
    return;
  end if;
  if exists (select 1 from public.offers where rfq_id = p_rfq and status = 'accepted') then
    update public.rfqs set status = 'accepted' where id = p_rfq and status = 'offered';
  else
    update public.rfqs set status = 'dispatched' where id = p_rfq and status = 'offered';
  end if;
end
$$;

revoke execute on function public.offers_overlap(uuid, uuid), public.rfq_settle_offers(uuid) from public, anon, authenticated;

-- Offre publiee, encore valable, d'une demande de l'acheteur connecte en attente de decision.
create function public.buyer_open_offer(p_offer uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rfq uuid;
begin
  select o.rfq_id into v_rfq
    from public.offers o
    join public.rfqs r on r.id = o.rfq_id
   where o.id = p_offer
     and o.status = 'published'
     and (o.valid_until is null or o.valid_until >= current_date)
     and r.buyer_profile_id = (select auth.uid())
     and r.status = 'offered'
     for update of o, r;
  if v_rfq is null then
    raise exception 'offer not available';
  end if;
  return v_rfq;
end
$$;

revoke execute on function public.buyer_open_offer(uuid) from public, anon, authenticated;

-- Acceptation : l'offre passe acceptee, ses alternatives sont ecartees, les offres complementaires
-- restent a decider.
create or replace function public.accept_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rfq uuid := public.buyer_open_offer(p_offer_id);
begin
  update public.offers set status = 'accepted', decided_at = now() where id = p_offer_id;
  update public.offers o set status = 'declined', decided_at = now()
   where o.rfq_id = v_rfq and o.id <> p_offer_id and o.status = 'published'
     and public.offers_overlap(o.id, p_offer_id);
  insert into public.audit_log (actor_profile_id, action, entity, entity_id, payload)
  values ((select auth.uid()), 'offer.accept', 'offer', p_offer_id::text, jsonb_build_object('rfq', v_rfq));
  perform public.rfq_settle_offers(v_rfq);
end
$$;

-- Refus explicite, motif facultatif.
create function public.decline_offer(p_offer_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rfq uuid := public.buyer_open_offer(p_offer_id);
begin
  update public.offers
     set status = 'declined', decided_at = now(), decline_reason = nullif(btrim(p_reason), '')
   where id = p_offer_id;
  insert into public.audit_log (actor_profile_id, action, entity, entity_id, payload)
  values ((select auth.uid()), 'offer.decline', 'offer', p_offer_id::text, jsonb_build_object('rfq', v_rfq));
  perform public.rfq_settle_offers(v_rfq);
end
$$;

-- Demande de changement de devise : l'offre reste publiee, AFRICA NEX traite la demande.
create function public.request_offer_currency(p_offer_id uuid, p_currency text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rfq uuid := public.buyer_open_offer(p_offer_id);
begin
  if p_currency not in ('DZD', 'EUR', 'USD')
     or p_currency = (select currency from public.offers where id = p_offer_id) then
    raise exception 'invalid currency' using errcode = '22023';
  end if;
  update public.offers
     set currency_change_to = p_currency, currency_change_note = nullif(btrim(p_note), ''), currency_change_at = now()
   where id = p_offer_id;
  insert into public.audit_log (actor_profile_id, action, entity, entity_id, payload)
  values ((select auth.uid()), 'offer.currency_request', 'offer', p_offer_id::text, jsonb_build_object('rfq', v_rfq, 'currency', p_currency));
end
$$;

revoke execute on function public.decline_offer(uuid, text), public.request_offer_currency(uuid, text, text) from public, anon;
grant execute on function public.decline_offer(uuid, text), public.request_offer_currency(uuid, text, text) to authenticated;
