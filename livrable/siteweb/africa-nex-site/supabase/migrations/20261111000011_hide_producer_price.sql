-- Le prix producteur (unit_price_ht) est confidentiel : l'acheteur recoit l'offre AFRICA NEX,
-- commission incluse. La RLS filtre des lignes, pas des colonnes : on retire donc la lecture de
-- cette colonne aux roles du site, et chaque entreprise lit ses propres prix via product_prices().
--
-- ATTENTION : toute nouvelle colonne de products doit etre ajoutee a la liste ci-dessous,
-- sinon elle sera illisible depuis le site.

revoke select on public.products from anon, authenticated;
grant select (
  id, company_id, product_name, slug, category, hs_code, description_fr, description_en, description_ar,
  currency, price_basis, unit, min_order_quantity, packaging, dimensions_cm,
  container_capacity_20ft, container_capacity_40ft, stock_quantity, stock_sync_frequency,
  images, is_locked, status, source, sort_order, created_at, updated_at
) on public.products to anon, authenticated;

-- Prix des produits d'une entreprise : membres de cette entreprise et admin uniquement.
create function public.product_prices(p_company uuid)
returns table (product_id uuid, unit_price_ht numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.unit_price_ht
    from public.products p
   where p.company_id = p_company
     and (public.is_member_of(p_company) or public.is_admin());
$$;

revoke execute on function public.product_prices(uuid) from public, anon;
grant execute on function public.product_prices(uuid) to authenticated;
