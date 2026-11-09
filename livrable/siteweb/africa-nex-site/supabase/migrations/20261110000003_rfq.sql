-- Demandes de devis : tout passe par AFRICA NEX.
-- L'acheteur ne voit que ses rfqs et les offers publiees ; le producteur ne voit que
-- les rfq_dispatches (brief anonymise) qui lui sont adresses et ses propres quotes.

create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'RFQ-' || to_char(now() at time zone 'utc', 'YYYY') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  ),
  buyer_profile_id uuid not null references public.profiles (id) on delete cascade,
  buyer_company_id uuid references public.companies (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  source_company_id uuid references public.companies (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 5000),
  quantity numeric(15, 2) check (quantity > 0),
  unit text,
  incoterm text check (incoterm in ('EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP')),
  destination_country varchar(50),
  destination_port text,
  target_unit_price numeric(15, 2) check (target_unit_price >= 0),
  currency varchar(3) check (currency in ('DZD', 'EUR', 'USD')),
  needed_by date,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'submitted'
    check (status in ('submitted', 'qualified', 'dispatched', 'offered', 'accepted', 'closed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rfqs_buyer_idx on public.rfqs (buyer_profile_id, created_at desc);
create index rfqs_status_idx on public.rfqs (status, created_at desc);

create trigger rfqs_set_updated_at
  before update on public.rfqs
  for each row execute function public.set_updated_at();

create sequence public.rfq_dispatch_seq;

create table public.rfq_dispatches (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'ENV-' || to_char(now() at time zone 'utc', 'YYYY') || '-'
    || lpad(nextval('public.rfq_dispatch_seq')::text, 4, '0')
  ),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  brief_title text not null check (char_length(brief_title) between 1 and 200),
  brief_specs text check (char_length(brief_specs) <= 5000),
  quantity numeric(15, 2) check (quantity > 0),
  unit text,
  destination_country varchar(50),
  requested_incoterm text,
  needed_by date,
  respond_by date,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'sent' check (status in ('sent', 'viewed', 'quoted', 'declined', 'expired')),
  viewed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rfq_id, company_id),
  unique (id, rfq_id)
);

create index rfq_dispatches_company_idx on public.rfq_dispatches (company_id, created_at desc);

create trigger rfq_dispatches_set_updated_at
  before update on public.rfq_dispatches
  for each row execute function public.set_updated_at();

-- Le producteur ne peut changer que le statut (vu, decline) de ses envois.
create or replace function public.guard_dispatch_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if (to_jsonb(new) - 'status' - 'viewed_at' - 'updated_at')
     is distinct from (to_jsonb(old) - 'status' - 'viewed_at' - 'updated_at') then
    raise exception 'only the dispatch status can be updated';
  end if;
  if new.status is distinct from old.status
     and not (old.status in ('sent', 'viewed') and new.status in ('viewed', 'declined')) then
    raise exception 'invalid dispatch status change';
  end if;
  return new;
end
$$;

create trigger rfq_dispatches_guard
  before update on public.rfq_dispatches
  for each row execute function public.guard_dispatch_update();

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null unique references public.rfq_dispatches (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  author_profile_id uuid references public.profiles (id) on delete set null,
  unit_price_ht numeric(15, 2) not null check (unit_price_ht >= 0),
  currency varchar(3) not null check (currency in ('DZD', 'EUR', 'USD')),
  price_basis text check (price_basis in ('EXW', 'FCA', 'FOB')),
  port_of_loading text,
  quantity numeric(15, 2) check (quantity > 0),
  production_lead_days integer check (production_lead_days >= 0),
  available_at_port_on date,
  payment_terms text check (char_length(payment_terms) <= 500),
  valid_until date,
  notes text check (char_length(notes) <= 5000),
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'selected', 'not_selected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_company_idx on public.quotes (company_id, created_at desc);

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

create or replace function public.quotes_sync_dispatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'submitted' then
    update public.rfq_dispatches
       set status = 'quoted'
     where id = new.dispatch_id and status in ('sent', 'viewed');
  end if;
  return new;
end
$$;

create trigger quotes_sync_dispatch
  after insert or update of status on public.quotes
  for each row execute function public.quotes_sync_dispatch();

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  label text not null default 'A' check (char_length(label) <= 20),
  unit_price numeric(15, 2) not null check (unit_price >= 0),
  currency varchar(3) not null check (currency in ('DZD', 'EUR', 'USD')),
  incoterm text check (incoterm in ('EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP')),
  incoterm_place text,
  quantity numeric(15, 2) check (quantity > 0),
  total_amount numeric(15, 2) check (total_amount >= 0),
  lead_time_days integer check (lead_time_days >= 0),
  origin_region text,
  packaging text,
  certifications text,
  payment_terms text check (char_length(payment_terms) <= 500),
  cagex_insured boolean not null default false,
  valid_until date,
  notes text check (char_length(notes) <= 5000),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'accepted', 'declined', 'expired')),
  created_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rfq_id, label)
);

create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

-- Marge interne d'AFRICA NEX : jamais visible de l'acheteur ni du producteur.
create table public.offer_margins (
  offer_id uuid primary key references public.offers (id) on delete cascade,
  source_quote_id uuid references public.quotes (id) on delete set null,
  producer_unit_price numeric(15, 2),
  producer_currency varchar(3) check (producer_currency in ('DZD', 'EUR', 'USD')),
  freight_cost numeric(15, 2),
  insurance_cost numeric(15, 2),
  commission_rate numeric(5, 2) check (commission_rate between 0 and 100),
  commission_amount numeric(15, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger offer_margins_set_updated_at
  before update on public.offer_margins
  for each row execute function public.set_updated_at();

-- Deux fils seulement : acheteur avec AFRICA NEX (dispatch_id nul),
-- producteur avec AFRICA NEX (dispatch_id renseigne). Jamais acheteur avec producteur.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  dispatch_id uuid,
  sender_profile_id uuid not null references public.profiles (id) on delete cascade,
  sender_role text not null check (sender_role in ('buyer', 'producer', 'admin')),
  body text not null check (char_length(body) between 1 and 5000),
  attachments jsonb not null default '[]'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (dispatch_id, rfq_id) references public.rfq_dispatches (id, rfq_id) on delete cascade
);

create index messages_rfq_idx on public.messages (rfq_id, created_at);
create index messages_dispatch_idx on public.messages (dispatch_id, created_at) where dispatch_id is not null;

-- Acceptation atomique d'une offre par son acheteur : l'offre passe acceptee,
-- les autres offres publiees de la meme demande sont declinees.
create or replace function public.accept_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rfq_id uuid;
begin
  select o.rfq_id
    into v_rfq_id
    from public.offers o
    join public.rfqs r on r.id = o.rfq_id
   where o.id = p_offer_id
     and o.status = 'published'
     and (o.valid_until is null or o.valid_until >= current_date)
     and r.buyer_profile_id = (select auth.uid())
     and r.status = 'offered'
     for update of o, r;

  if v_rfq_id is null then
    raise exception 'offer not available';
  end if;

  update public.offers set status = 'accepted' where id = p_offer_id;
  update public.offers set status = 'declined'
   where rfq_id = v_rfq_id and id <> p_offer_id and status = 'published';
  update public.rfqs set status = 'accepted' where id = v_rfq_id;
end
$$;
