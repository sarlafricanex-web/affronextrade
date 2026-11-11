-- Profil acheteur : type d'acheteur et secteurs recherches, pays en code ISO (comme le formulaire de contact).

update public.companies set country = 'DZ' where country = 'Algeria';
alter table public.companies alter column country set default 'DZ';
alter table public.companies add constraint companies_country_iso check (country ~ '^[A-Z]{2}$');

alter table public.companies
  add column buyer_type text
    check (buyer_type in ('importer', 'distributor', 'wholesaler', 'retailer', 'industrial', 'other')),
  add column interests text[] not null default '{}'
    check (cardinality(interests) <= 12);
