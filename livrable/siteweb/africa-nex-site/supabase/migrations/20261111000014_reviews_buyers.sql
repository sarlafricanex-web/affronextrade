-- Avis des acheteurs. L'identite de l'acheteur ne doit jamais permettre au producteur de le
-- contacter en direct : l'avis publie affiche "Prenom I." et le pays, rien d'autre.

-- 1. Un seul avis par acheteur et par fiche : index reviews_one_per_author deja en place.

-- 2. Auteur rempli par la base a partir du profil et de l'entreprise acheteuse (non falsifiable).
create function public.reviews_fill_author()
returns trigger
language plpgsql
security definer
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

create trigger reviews_fill_author
  before insert on public.reviews
  for each row execute function public.reviews_fill_author();

-- 3. Les membres du producteur ne lisent que les avis publies (comme le public) : pas d'avis
--    en attente, et jamais l'identifiant du compte acheteur.
drop policy reviews_select_own on public.reviews;
create policy reviews_select_own on public.reviews
  for select to authenticated
  using (author_profile_id = (select auth.uid()));
-- author_profile_id reste lisible sur les avis publies, mais n'identifie personne :
-- les profils ne sont lisibles que par leur titulaire et par l'admin.
