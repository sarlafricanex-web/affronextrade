-- Utilitaires

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end
$$;

-- Comptes

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'buyer' check (role in ('producer', 'buyer', 'admin')),
  full_name text check (char_length(full_name) <= 120),
  email text,
  phone text check (char_length(phone) <= 30),
  whatsapp text check (char_length(whatsapp) <= 30),
  locale text not null default 'fr' check (locale in ('fr', 'en', 'ar')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Le role vient d'une liste blanche : un navigateur ne peut jamais s'inscrire en admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, locale)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
    case when new.raw_user_meta_data ->> 'role' = 'producer' then 'producer' else 'buyer' end,
    case when new.raw_user_meta_data ->> 'locale' in ('fr', 'en', 'ar')
         then new.raw_user_meta_data ->> 'locale' else 'fr' end
  );
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Entreprises (= table "users" du cahier des charges)

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'producer' check (kind in ('producer', 'buyer')),
  company_name varchar(255) not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  legacy_id text unique,
  country varchar(50) not null default 'Algeria',
  wilaya text,
  city text,
  legal_form text,
  sector text check (sector in ('agrifood', 'industry', 'automotive', 'crafts', 'cosmetics', 'agriculture')),
  description_fr text check (char_length(description_fr) <= 2000),
  description_en text check (char_length(description_en) <= 2000),
  description_ar text check (char_length(description_ar) <= 2000),
  website text,
  founded_year smallint check (founded_year between 1800 and 2100),
  headcount text check (headcount in ('1-9', '10-49', '50-249', '250+')),
  monthly_capacity numeric(15, 2) check (monthly_capacity >= 0),
  monthly_capacity_unit text,
  export_ports text,
  logo_url text,
  cover_url text,
  brand_initials text check (char_length(brand_initials) <= 3),
  brand_color text check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  verified boolean not null default false,
  visibility text not null default 'draft' check (visibility in ('draft', 'published', 'suspended')),
  claim_status text not null default 'claimed' check (claim_status in ('unclaimed', 'claim_pending', 'claimed')),
  created_by_admin boolean not null default false,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  subscription_tier varchar(50) not null default 'starter' check (subscription_tier in ('starter', 'pro', 'enterprise')),
  subscription_currency varchar(3) not null default 'DZD' check (subscription_currency in ('DZD', 'EUR', 'USD')),
  subscription_status text not null default 'none' check (subscription_status in ('none', 'trial', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz,
  status varchar(20) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_requires_claim check (not verified or claim_status = 'claimed')
);

create index companies_directory_idx on public.companies (sector) where visibility = 'published' and kind = 'producer';
create index companies_name_trgm_idx on public.companies using gin (company_name extensions.gin_trgm_ops);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- Coordonnees et identifiants : jamais publics. La RLS filtre des lignes, pas des colonnes,
-- d'ou une table separee lisible par les seuls membres et AFRICA NEX.
create table public.company_private (
  company_id uuid primary key references public.companies (id) on delete cascade,
  tax_id varchar(100) unique,
  rc_number text,
  contact_name text,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,
  address text,
  updated_at timestamptz not null default now()
);

create trigger company_private_set_updated_at
  before update on public.company_private
  for each row execute function public.set_updated_at();

create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'manager', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (company_id, profile_id)
);

create index company_members_profile_idx on public.company_members (profile_id);

-- Produits (= table "products" du cahier des charges)

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  product_name varchar(255) not null,
  slug text,
  sort_order integer not null default 0,
  hs_code varchar(20) check (hs_code ~ '^[0-9]{4}(\.?[0-9]{2}){1,3}$'),
  description_fr text check (char_length(description_fr) <= 2000),
  description_en text check (char_length(description_en) <= 2000),
  description_ar text check (char_length(description_ar) <= 2000),
  category text,
  unit_price_ht numeric(15, 2) check (unit_price_ht >= 0),
  currency varchar(3) check (currency in ('DZD', 'EUR', 'USD')),
  price_basis text check (price_basis in ('EXW', 'FCA', 'FOB')),
  unit text,
  min_order_quantity numeric(15, 2) check (min_order_quantity >= 0),
  packaging text,
  dimensions_cm jsonb,
  container_capacity_20ft integer check (container_capacity_20ft >= 0),
  container_capacity_40ft integer check (container_capacity_40ft >= 0),
  stock_quantity numeric(15, 2) check (stock_quantity >= 0),
  stock_sync_frequency varchar(20) not null default 'monthly' check (stock_sync_frequency in ('weekly', 'monthly')),
  is_locked boolean not null default false,
  images jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  source text not null default 'producer' check (source in ('producer', 'seed', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Les champs obligatoires du cahier des charges sont exiges a la publication, pas au brouillon.
  -- Les fiches importees (source 'seed') n'ont que des noms de produits.
  constraint products_publishable check (
    status <> 'published' or source = 'seed'
    or (hs_code is not null and unit_price_ht is not null and currency is not null)
  )
);

create index products_company_idx on public.products (company_id, sort_order);
create index products_name_trgm_idx on public.products using gin (product_name extensions.gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('registration', 'certification', 'iso', 'halal', 'phytosanitary', 'other')),
  title text check (char_length(title) <= 200),
  storage_path text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index company_documents_company_idx on public.company_documents (company_id);

create table public.company_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tax_id text,
  work_email text,
  phone text,
  job_title text,
  evidence_path text,
  message text check (char_length(message) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, profile_id)
);

create table public.profile_views (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  viewer_profile_id uuid references public.profiles (id) on delete set null,
  viewer_country varchar(2),
  locale text,
  created_at timestamptz not null default now()
);

create index profile_views_company_idx on public.profile_views (company_id, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- Fonctions d'aide pour la RLS. SECURITY DEFINER evite la recursion des politiques
-- sur company_members ; search_path vide pour empecher toute substitution d'objets.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.is_member_of(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
     where m.company_id = target_company and m.profile_id = (select auth.uid())
  );
$$;

create or replace function public.is_owner_of(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
     where m.company_id = target_company
       and m.profile_id = (select auth.uid())
       and m.role = 'owner'
  );
$$;

-- Vrai pour les migrations, la cle secrete et les comptes admin.
-- Volontairement SECURITY INVOKER : current_user doit refleter l'appelant.
create or replace function public.is_privileged()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('postgres', 'service_role', 'supabase_admin') or public.is_admin();
$$;

-- Gardes : la RLS dit qui peut modifier une ligne, ces triggers disent quels champs.

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.created_at is distinct from old.created_at then
    raise exception 'protected profile fields cannot be changed';
  end if;
  if new.role is distinct from old.role then
    if old.role = 'admin' or new.role not in ('producer', 'buyer') then
      raise exception 'role cannot be changed to or from admin';
    end if;
    if old.onboarding_completed then
      raise exception 'role cannot be changed after onboarding';
    end if;
  end if;
  if old.onboarding_completed and not new.onboarding_completed then
    raise exception 'onboarding cannot be reset';
  end if;
  return new;
end
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.guard_company_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if exists (
    select 1
      from unnest(array[
        'id', 'kind', 'slug', 'legacy_id', 'verified', 'claim_status', 'created_by_admin',
        'owner_profile_id', 'subscription_tier', 'subscription_currency', 'subscription_status',
        'trial_ends_at', 'status', 'created_at'
      ]) as k
     where to_jsonb(new) -> k is distinct from to_jsonb(old) -> k
  ) then
    raise exception 'protected company fields can only be changed by AFRICA NEX';
  end if;
  if new.visibility is distinct from old.visibility
     and 'suspended' in (old.visibility, new.visibility) then
    raise exception 'a suspended company can only be changed by AFRICA NEX';
  end if;
  return new;
end
$$;

create trigger companies_guard
  before update on public.companies
  for each row execute function public.guard_company_update();

create or replace function public.guard_product_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.company_id is distinct from old.company_id
     or new.source is distinct from old.source
     or new.created_at is distinct from old.created_at then
    raise exception 'protected product fields cannot be changed';
  end if;
  return new;
end
$$;

create trigger products_guard
  before update on public.products
  for each row execute function public.guard_product_update();

-- Creation d'une entreprise : ligne privee vide et proprietaire membre d'office,
-- sinon le createur perdrait l'acces a la ligne qu'il vient d'inserer.
create or replace function public.companies_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_private (company_id) values (new.id) on conflict do nothing;
  if new.owner_profile_id is not null then
    insert into public.company_members (company_id, profile_id, role)
    values (new.id, new.owner_profile_id, 'owner')
    on conflict do nothing;
  end if;
  return new;
end
$$;

create trigger companies_after_insert
  after insert on public.companies
  for each row execute function public.companies_after_insert();

create or replace function public.company_claims_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.companies
     set claim_status = 'claim_pending'
   where id = new.company_id and claim_status = 'unclaimed';
  return new;
end
$$;

create trigger company_claims_after_insert
  after insert on public.company_claims
  for each row execute function public.company_claims_after_insert();
