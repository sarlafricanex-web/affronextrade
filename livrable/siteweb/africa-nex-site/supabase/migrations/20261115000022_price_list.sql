-- Liste de prix fournisseur : reference, references croisees, construction du prix selon le forfait,
-- validite du prix, suivi du stock, delai et origine. Base des offres automatiques a venir.
--   Starter          : prix HT + incoterm (+ lieu) ; fret et assurance a la charge du fournisseur.
--   Pro / Enterprise : cout produit + cout emballage = prix FCA (calcule ici, jamais saisi a la main).

alter table public.products
  add column sku varchar(60) check (char_length(btrim(sku)) between 1 and 60),
  add column cross_refs text[] not null default '{}' check (cardinality(cross_refs) <= 20),
  add column product_cost numeric(15, 2) check (product_cost >= 0),
  add column packaging_cost numeric(15, 2) check (packaging_cost >= 0),
  add column price_place text check (char_length(price_place) <= 120),
  add column price_valid_until date,
  add column stock_updated_at timestamptz,
  add column lead_time_days integer check (lead_time_days between 0 and 365),
  add column origin_country char(2) not null default 'DZ' check (origin_country ~ '^[A-Z]{2}$');

-- Une reference fournisseur par produit et par entreprise (insensible a la casse).
create unique index products_company_sku_idx on public.products (company_id, lower(sku)) where sku is not null;

-- Un fournisseur Starter peut vendre rendu (fret et assurance compris s'il le decide).
alter table public.products drop constraint products_price_basis_check;
alter table public.products add constraint products_price_basis_check
  check (price_basis in ('EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DDP'));

-- Prix FCA = cout produit + cout emballage quand la construction est donnee ;
-- date du stock mise a jour a chaque changement de quantite.
create or replace function public.products_price_and_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.product_cost is not null then
    new.unit_price_ht := new.product_cost + coalesce(new.packaging_cost, 0);
    new.price_basis := 'FCA';
  elsif new.packaging_cost is not null then
    new.packaging_cost := null;
  end if;
  if tg_op = 'INSERT' then
    if new.stock_quantity is not null then new.stock_updated_at := now(); end if;
  elsif new.stock_quantity is distinct from old.stock_quantity then
    new.stock_updated_at := now();
  end if;
  return new;
end
$$;

create trigger products_price_and_stock
  before insert or update on public.products
  for each row execute function public.products_price_and_stock();

-- Colonnes publiques (lecture colonne par colonne, migration 11). Les couts et la validite du
-- prix restent confidentiels, comme le prix : ils passent par product_prices().
grant select (sku, cross_refs, price_place, stock_updated_at, lead_time_days, origin_country)
  on public.products to anon, authenticated;

drop function public.product_prices(uuid);
create function public.product_prices(p_company uuid)
returns table (product_id uuid, unit_price_ht numeric, product_cost numeric, packaging_cost numeric, price_valid_until date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.unit_price_ht, p.product_cost, p.packaging_cost, p.price_valid_until
    from public.products p
   where p.company_id = p_company
     and (public.is_member_of(p_company) or public.is_admin());
$$;

revoke execute on function public.product_prices(uuid) from public, anon;
grant execute on function public.product_prices(uuid) to authenticated;
