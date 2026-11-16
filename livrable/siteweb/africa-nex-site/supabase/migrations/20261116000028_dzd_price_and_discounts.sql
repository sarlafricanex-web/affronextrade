-- Lot 6a-bis : deux prix par produit et marge de negociation du fournisseur.
--   price_dzd_ht   : prix en dinars HT, confidentiel (AFRICA NEX seule), sert quand AFRICA NEX exporte ;
--   unit_price_ht  : prix export dans UNE devise (EUR ou USD), sert en intermediation ;
--   discount_tiers : remise maximale par paliers (3 au plus), confidentielle ; null = grille par defaut
--                    du fournisseur (table supplier_pricing). Forme : [{ "basis": "qty"|"amount",
--                    "threshold": nombre, "discount": pourcentage }].

alter table public.products
  add column price_dzd_ht numeric(15, 2) check (price_dzd_ht > 0),
  add column discount_tiers jsonb check (discount_tiers is null or (jsonb_typeof(discount_tiers) = 'array' and jsonb_array_length(discount_tiers) <= 3));

-- Prix deja saisis en dinars : ils deviennent le prix DZD (le prix export reste a completer).
update public.products set price_dzd_ht = unit_price_ht where currency = 'DZD' and unit_price_ht > 0;

-- Les nouvelles colonnes ne sont pas accordees en lecture (migration 11) : seules les entreprises
-- membres et l'admin les lisent, via product_prices().
drop function public.product_prices(uuid);
create function public.product_prices(p_company uuid)
returns table (
  product_id uuid, unit_price_ht numeric, product_cost numeric, packaging_cost numeric,
  price_valid_until date, price_dzd_ht numeric, discount_tiers jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.unit_price_ht, p.product_cost, p.packaging_cost, p.price_valid_until, p.price_dzd_ht, p.discount_tiers
    from public.products p
   where p.company_id = p_company
     and (public.is_member_of(p_company) or public.is_admin());
$$;

revoke execute on function public.product_prices(uuid) from public, anon;
grant execute on function public.product_prices(uuid) to authenticated;

-- Grille de remise par defaut du fournisseur (s'applique aux produits sans grille propre).
-- Lue et modifiee par les membres de l'entreprise et l'admin ; jamais publique.
create table public.supplier_pricing (
  company_id uuid primary key references public.companies (id) on delete cascade,
  discount_tiers jsonb not null default '[]'::jsonb check (jsonb_typeof(discount_tiers) = 'array' and jsonb_array_length(discount_tiers) <= 3),
  updated_at timestamptz not null default now()
);

alter table public.supplier_pricing enable row level security;

create policy supplier_pricing_member on public.supplier_pricing
  for all to authenticated
  using (public.is_member_of(company_id) or public.is_admin())
  with check (public.is_member_of(company_id) or public.is_admin());
