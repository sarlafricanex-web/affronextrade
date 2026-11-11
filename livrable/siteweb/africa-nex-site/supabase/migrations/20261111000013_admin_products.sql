-- Les fiches etablies par AFRICA NEX (import initial ou console admin) n'ont souvent que des noms
-- de produits : elles peuvent etre publiees sans code SH ni prix, comme l'import initial.
alter table public.products drop constraint products_publishable;
alter table public.products add constraint products_publishable check (
  status <> 'published' or source in ('seed', 'admin')
  or (hs_code is not null and unit_price_ht is not null and currency is not null)
);
