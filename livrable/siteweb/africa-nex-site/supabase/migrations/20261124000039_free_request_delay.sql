-- Passeport (gratuit) : les demandes d'acheteurs arrivent 48 h apres les comptes payants (decision
-- d'Adlene du 24 novembre 2026). Chaque envoi a un producteur recoit une date de visibilite :
-- maintenant pour une offre payante, maintenant + free_request_delay_hours pour le Passeport.
-- Avant cette date, le producteur ne voit pas l'envoi : ni la demande, ni ses messages, ni ses
-- fichiers, et il ne peut pas y repondre (les regles d'acces passent toutes par rfq_dispatches).
-- S'il passe a une offre payante (ou commence un essai), ses envois en attente lui sont ouverts.

alter table public.rfq_dispatches add column visible_from timestamptz not null default now();
update public.rfq_dispatches set visible_from = created_at;
create index rfq_dispatches_visible_idx on public.rfq_dispatches (company_id, visible_from);

-- Offre en vigueur d'une entreprise, sans controle d'acces (usage interne des declencheurs).
create function public.plan_of(p_company uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.plan_code from public.subscriptions s
     where s.company_id = p_company and s.status = 'active' and s.current_period_end >= current_date
     order by s.current_period_end desc limit 1
  ), 'vitrine');
$$;
revoke execute on function public.plan_of(uuid) from public, anon, authenticated;

create function public.rfq_dispatches_set_visible_from()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.visible_from := now() + case
    when public.plan_of(new.company_id) = 'vitrine'
      then make_interval(hours => coalesce(public.billing_setting('free_request_delay_hours'), 0)::integer)
    else interval '0'
  end;
  return new;
end
$$;

create trigger rfq_dispatches_visible_from
  before insert on public.rfq_dispatches
  for each row execute function public.rfq_dispatches_set_visible_from();

-- Passage a une offre payante ou essai : les envois en attente sont ouverts tout de suite.
create function public.subscriptions_release_dispatches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    update public.rfq_dispatches set visible_from = now()
     where company_id = new.company_id and visible_from > now();
  end if;
  return new;
end
$$;

create trigger subscriptions_release_dispatches
  after insert or update of status on public.subscriptions
  for each row execute function public.subscriptions_release_dispatches();

-- Le producteur ne voit (et ne marque) un envoi qu'a partir de sa date de visibilite.
drop policy rfq_dispatches_select_member on public.rfq_dispatches;
create policy rfq_dispatches_select_member on public.rfq_dispatches
  for select to authenticated
  using (public.is_member_of(company_id) and visible_from <= now());

drop policy rfq_dispatches_update_member on public.rfq_dispatches;
create policy rfq_dispatches_update_member on public.rfq_dispatches
  for update to authenticated
  using (public.is_member_of(company_id) and visible_from <= now())
  with check (public.is_member_of(company_id));
