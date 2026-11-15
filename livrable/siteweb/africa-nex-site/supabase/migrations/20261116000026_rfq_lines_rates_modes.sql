-- Lot 6 : demande multi-lignes, taux de reference et mode d'affaire des fournisseurs.

-- 1. Lignes d'une demande de devis (1 a 50). Visibles par l'acheteur de la demande et par AFRICA NEX,
--    jamais par les producteurs (ils recoivent un brief anonymise). Figees apres l'envoi.
create table public.rfq_lines (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  position smallint not null check (position between 1 and 50),
  product_id uuid references public.products (id) on delete set null,
  reference text check (char_length(reference) <= 60),
  description text not null check (char_length(description) between 1 and 300),
  quantity numeric(15, 2) check (quantity > 0),
  unit text,
  created_at timestamptz not null default now(),
  unique (rfq_id, position)
);

alter table public.rfq_lines enable row level security;

create policy rfq_lines_select_buyer on public.rfq_lines
  for select to authenticated
  using (exists (select 1 from public.rfqs r where r.id = rfq_id and r.buyer_profile_id = (select auth.uid())));

create policy rfq_lines_insert_buyer on public.rfq_lines
  for insert to authenticated
  with check (exists (
    select 1 from public.rfqs r
     where r.id = rfq_id and r.buyer_profile_id = (select auth.uid()) and r.status = 'submitted'
  ));

create policy rfq_lines_admin on public.rfq_lines
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 2. Taux de reference saisis par AFRICA NEX : 1 EUR = x DZD, 1 USD = y DZD.
--    Chaque offre gardera le taux utilise. Lecture et ecriture : admin seulement.
create table public.fx_rates (
  currency char(3) primary key check (currency in ('EUR', 'USD')),
  dzd_per_unit numeric(12, 4) not null check (dzd_per_unit > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.fx_rates enable row level security;

create policy fx_rates_admin on public.fx_rates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3. Mode d'affaire de chaque fournisseur, fixe par AFRICA NEX seul (le fournisseur ne le voit pas) :
--    'self'      : le fournisseur exporte lui-meme (intermediation, commission de la grille) ;
--    'africanex' : AFRICA NEX achete en franchise de TVA et exporte (marge negociee).
create table public.supplier_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  export_mode text not null check (export_mode in ('self', 'africanex')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.supplier_settings enable row level security;

create policy supplier_settings_admin on public.supplier_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
