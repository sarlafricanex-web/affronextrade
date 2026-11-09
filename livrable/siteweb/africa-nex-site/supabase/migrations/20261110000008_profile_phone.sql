-- Le telephone saisi a l'inscription est conserve dans le profil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, locale, phone)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
    case when new.raw_user_meta_data ->> 'role' = 'producer' then 'producer' else 'buyer' end,
    case when new.raw_user_meta_data ->> 'locale' in ('fr', 'en', 'ar')
         then new.raw_user_meta_data ->> 'locale' else 'fr' end,
    left(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), 30)
  );
  return new;
end
$$;
