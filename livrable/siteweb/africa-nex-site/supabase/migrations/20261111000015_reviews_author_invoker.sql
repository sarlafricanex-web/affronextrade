-- Correctif : en SECURITY DEFINER, current_user vaut le proprietaire de la fonction, donc
-- is_privileged() repondait toujours oui et l'auteur saisi n'etait jamais remplace.
-- La fonction tourne desormais avec les droits de l'acheteur (qui lit son profil et son entreprise).
create or replace function public.reviews_fill_author()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
  v_country text;
begin
  if public.is_privileged() then
    return new;
  end if;
  select p.full_name into v_name from public.profiles p where p.id = new.author_profile_id;
  select c.country into v_country
    from public.company_members m
    join public.companies c on c.id = m.company_id and c.kind = 'buyer'
   where m.profile_id = new.author_profile_id
   limit 1;
  if v_country is null then
    raise exception 'buyer_profile_incomplete';
  end if;
  v_name := trim(coalesce(v_name, ''));
  new.author_name := case
    when v_name = '' then 'Acheteur'
    when position(' ' in v_name) = 0 then v_name
    else split_part(v_name, ' ', 1) || ' ' || upper(left(split_part(v_name, ' ', 2), 1)) || '.'
  end;
  new.author_company := null;
  new.author_country := v_country;
  return new;
end
$$;
