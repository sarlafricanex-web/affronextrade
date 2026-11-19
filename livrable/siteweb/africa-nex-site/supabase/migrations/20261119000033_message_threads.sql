-- Lot 5f : fil de messages (maquettes 14 et 16). Deux fils seulement, jamais acheteur avec producteur
-- (table et regles d'acces posees en semaine 1) :
--   - l'acheteur avec AFRICA NEX : messages de la demande sans envoi (dispatch_id nul) ;
--   - chaque producteur avec AFRICA NEX : messages rattaches a son envoi (dispatch_id).
-- Notifications dans l'espace (decision d'Adlene du 13 novembre) : un message est "non lu" tant que
-- son destinataire n'a pas ouvert le fil. Seul le destinataire le marque lu, par cette fonction.

create index messages_unread_idx on public.messages (rfq_id, dispatch_id) where read_at is null;

-- Ouverture d'un fil : les messages recus (envoyes par l'autre partie) passent lus.
--   admin      : messages de l'acheteur (p_dispatch nul) ou du producteur de l'envoi ;
--   acheteur   : messages d'AFRICA NEX sur sa demande ;
--   producteur : messages d'AFRICA NEX sur un envoi a son entreprise.
create function public.mark_messages_read(p_rfq uuid, p_dispatch uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if public.is_admin() then
    update public.messages set read_at = now()
     where rfq_id = p_rfq and dispatch_id is not distinct from p_dispatch
       and sender_role <> 'admin' and read_at is null;
  elsif p_dispatch is null and exists (
    select 1 from public.rfqs where id = p_rfq and buyer_profile_id = (select auth.uid())
  ) then
    update public.messages set read_at = now()
     where rfq_id = p_rfq and dispatch_id is null and sender_role = 'admin' and read_at is null;
  elsif p_dispatch is not null and exists (
    select 1 from public.rfq_dispatches d where d.id = p_dispatch and d.rfq_id = p_rfq and public.is_member_of(d.company_id)
  ) then
    update public.messages set read_at = now()
     where rfq_id = p_rfq and dispatch_id = p_dispatch and sender_role = 'admin' and read_at is null;
  else
    return 0;
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke execute on function public.mark_messages_read(uuid, uuid) from public, anon;
grant execute on function public.mark_messages_read(uuid, uuid) to authenticated;
