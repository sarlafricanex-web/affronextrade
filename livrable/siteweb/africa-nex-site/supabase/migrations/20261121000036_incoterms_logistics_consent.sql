-- Session 2 des abonnements (decisions d'Adlene du 21 novembre 2026) :
--   - tous les incoterms (les 11 d'Incoterms 2020) partout : prix fournisseur, devis, demande, offre ;
--   - plus de prix construit en FCA (cout produit + emballage) : le fournisseur donne UN prix, dans
--     l'incoterm de son choix ;
--   - la logistique est un service choisi par l'acheteur (rfqs.logistics, migration 35), plus le forfait ;
--   - l'export par AFRICA NEX exige l'accord prealable du fournisseur.

-- 1. Les 11 incoterms
alter table public.products drop constraint products_price_basis_check;
alter table public.products add constraint products_price_basis_check
  check (price_basis in ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'));
alter table public.quotes drop constraint quotes_price_basis_check;
alter table public.quotes add constraint quotes_price_basis_check
  check (price_basis in ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'));
alter table public.rfqs drop constraint rfqs_incoterm_check;
alter table public.rfqs add constraint rfqs_incoterm_check
  check (incoterm in ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'));
alter table public.offers drop constraint offers_incoterm_check;
alter table public.offers add constraint offers_incoterm_check
  check (incoterm in ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'));

-- 2. Plus de calcul du prix FCA : seule la date du stock est tenue a jour.
--    (Les couts deja saisis restent en base, sans effet.)
create or replace function public.products_price_and_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.stock_quantity is not null then new.stock_updated_at := now(); end if;
  elsif new.stock_quantity is distinct from old.stock_quantity then
    new.stock_updated_at := now();
  end if;
  return new;
end
$$;

-- 3. Accord du fournisseur pour l'export par AFRICA NEX : date d'accord tenue par la base ;
--    un retrait d'accord ramene le fournisseur en intermediation.
create function public.companies_export_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.africanex_export_consent_at := case when new.africanex_export_consent then now() end;
  elsif new.africanex_export_consent and not old.africanex_export_consent then
    new.africanex_export_consent_at := now();
  elsif new.africanex_export_consent then
    new.africanex_export_consent_at := old.africanex_export_consent_at; -- date non modifiable a la main
  else
    new.africanex_export_consent_at := null;
    if old.africanex_export_consent then
      update public.supplier_settings set export_mode = 'self' where company_id = new.id and export_mode = 'africanex';
    end if;
  end if;
  return new;
end
$$;

create trigger companies_export_consent
  before insert or update of africanex_export_consent, africanex_export_consent_at on public.companies
  for each row execute function public.companies_export_consent();

-- Le mode "export par AFRICA NEX" n'est possible qu'avec l'accord du fournisseur.
create function public.supplier_settings_check_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.export_mode = 'africanex'
     and (tg_op = 'INSERT' or old.export_mode is distinct from 'africanex')
     and not coalesce((select c.africanex_export_consent from public.companies c where c.id = new.company_id), false) then
    raise exception 'export consent required' using errcode = 'P0016';
  end if;
  return new;
end
$$;

create trigger supplier_settings_check_consent
  before insert or update of export_mode on public.supplier_settings
  for each row execute function public.supplier_settings_check_consent();
