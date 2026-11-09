-- security_invoker : les vues appliquent la RLS de l'utilisateur, sinon elles la contourneraient.

-- Annuaire public : memes noms de champs que l'ancien tableau du composant ProducerDirectory.
create view public.producer_cards
with (security_invoker = on)
as
select
  c.id,
  c.slug,
  c.legacy_id,
  c.company_name as name,
  c.city as location,
  c.wilaya,
  c.sector,
  c.verified,
  c.claim_status,
  c.brand_initials as initials,
  c.brand_color as color,
  c.logo_url as logo,
  coalesce(
    (select array_agg(p.product_name::text order by p.sort_order, p.created_at)
       from public.products p
      where p.company_id = c.id and p.status = 'published'),
    '{}'::text[]
  ) as products,
  (select round(avg(r.rating)::numeric, 1)
     from public.reviews r
    where r.producer_company_id = c.id and r.status = 'approved') as avg_rating,
  (select count(*)::integer
     from public.reviews r
    where r.producer_company_id = c.id and r.status = 'approved') as review_count
from public.companies c
where c.visibility = 'published' and c.kind = 'producer';

-- Compatibilite avec le schema du cahier des charges, pour les futurs agents et la facturation.
create view public.cdct_users
with (security_invoker = on)
as
select
  c.id,
  c.company_name,
  c.country,
  cp.tax_id,
  cp.contact_email as email,
  c.subscription_tier,
  c.status,
  c.created_at
from public.companies c
left join public.company_private cp on cp.company_id = c.id;

create view public.cdct_products
with (security_invoker = on)
as
select
  p.id,
  p.company_id as user_id,
  p.product_name,
  p.hs_code,
  p.unit_price_ht,
  p.currency,
  p.dimensions_cm,
  p.container_capacity_20ft,
  p.container_capacity_40ft,
  p.stock_quantity,
  p.stock_sync_frequency,
  p.is_locked,
  p.updated_at
from public.products p;

revoke all on table public.cdct_users, public.cdct_products from anon;
