-- Regles d'acces. Le proxy n'est qu'un confort de navigation : la securite est ici.
-- Les politiques ouvertes aux visiteurs anonymes n'appellent jamais de fonction d'aide.

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_private enable row level security;
alter table public.company_members enable row level security;
alter table public.products enable row level security;
alter table public.company_documents enable row level security;
alter table public.company_claims enable row level security;
alter table public.profile_views enable row level security;
alter table public.audit_log enable row level security;
alter table public.rfqs enable row level security;
alter table public.rfq_dispatches enable row level security;
alter table public.quotes enable row level security;
alter table public.offers enable row level security;
alter table public.offer_margins enable row level security;
alter table public.messages enable row level security;
alter table public.submissions enable row level security;
alter table public.reviews enable row level security;

-- Comptes

create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_admin on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Entreprises

create policy companies_select_public on public.companies
  for select to anon, authenticated
  using (visibility = 'published' and kind = 'producer');

create policy companies_select_member on public.companies
  for select to authenticated
  using (public.is_member_of(id));

-- Une seule entreprise par compte, sans badge ni abonnement auto-attribues.
create policy companies_insert_own on public.companies
  for insert to authenticated
  with check (
    owner_profile_id = (select auth.uid())
    and kind = public.my_role()
    and created_by_admin = false
    and verified = false
    and claim_status = 'claimed'
    and legacy_id is null
    and visibility in ('draft', 'published')
    and subscription_tier = 'starter'
    and subscription_status = 'none'
    and not exists (
      select 1 from public.company_members m where m.profile_id = (select auth.uid())
    )
  );

create policy companies_update_member on public.companies
  for update to authenticated
  using (public.is_member_of(id))
  with check (public.is_member_of(id));

create policy companies_admin on public.companies
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy company_private_select on public.company_private
  for select to authenticated
  using (public.is_member_of(company_id));

create policy company_private_update on public.company_private
  for update to authenticated
  using (public.is_member_of(company_id))
  with check (public.is_member_of(company_id));

create policy company_private_admin on public.company_private
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy company_members_select on public.company_members
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_member_of(company_id));

create policy company_members_admin on public.company_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Produits

create policy products_select_public on public.products
  for select to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.companies c
       where c.id = products.company_id
         and c.visibility = 'published'
         and c.kind = 'producer'
    )
  );

create policy products_select_member on public.products
  for select to authenticated
  using (public.is_member_of(company_id));

create policy products_insert_member on public.products
  for insert to authenticated
  with check (
    public.is_member_of(company_id)
    and source = 'producer'
    and exists (
      select 1 from public.companies c
       where c.id = products.company_id and c.kind = 'producer'
    )
  );

create policy products_update_member on public.products
  for update to authenticated
  using (public.is_member_of(company_id))
  with check (public.is_member_of(company_id));

create policy products_delete_member on public.products
  for delete to authenticated
  using (public.is_member_of(company_id));

create policy products_admin on public.products
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy company_documents_select_public on public.company_documents
  for select to anon, authenticated
  using (
    is_public
    and exists (
      select 1 from public.companies c
       where c.id = company_documents.company_id and c.visibility = 'published'
    )
  );

create policy company_documents_member on public.company_documents
  for all to authenticated
  using (public.is_member_of(company_id))
  with check (public.is_member_of(company_id));

create policy company_documents_admin on public.company_documents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Revendications : validation toujours manuelle par AFRICA NEX.

create policy company_claims_select_own on public.company_claims
  for select to authenticated
  using (profile_id = (select auth.uid()));

create policy company_claims_insert on public.company_claims
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and public.my_role() = 'producer'
    and exists (
      select 1 from public.companies c
       where c.id = company_claims.company_id
         and c.claim_status = 'unclaimed'
         and c.visibility = 'published'
    )
  );

create policy company_claims_admin on public.company_claims
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Statistiques et journal (ecrits cote serveur avec la cle secrete)

create policy profile_views_select_member on public.profile_views
  for select to authenticated
  using (public.is_member_of(company_id));

create policy profile_views_admin on public.profile_views
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy audit_log_admin_select on public.audit_log
  for select to authenticated
  using (public.is_admin());

create policy audit_log_admin_insert on public.audit_log
  for insert to authenticated
  with check (public.is_admin() and actor_profile_id = (select auth.uid()));

-- Demandes de devis : l'acheteur ne voit que ses demandes brutes

create policy rfqs_select_buyer on public.rfqs
  for select to authenticated
  using (buyer_profile_id = (select auth.uid()));

create policy rfqs_insert_buyer on public.rfqs
  for insert to authenticated
  with check (
    buyer_profile_id = (select auth.uid())
    and status = 'submitted'
    and public.my_role() = 'buyer'
    and (buyer_company_id is null or public.is_member_of(buyer_company_id))
  );

-- Modifiable ou annulable tant qu'AFRICA NEX ne l'a pas qualifiee.
create policy rfqs_update_buyer on public.rfqs
  for update to authenticated
  using (buyer_profile_id = (select auth.uid()) and status = 'submitted')
  with check (buyer_profile_id = (select auth.uid()) and status in ('submitted', 'cancelled'));

create policy rfqs_admin on public.rfqs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Le producteur ne voit que le brief anonymise qui lui est adresse

create policy rfq_dispatches_select_member on public.rfq_dispatches
  for select to authenticated
  using (public.is_member_of(company_id));

create policy rfq_dispatches_update_member on public.rfq_dispatches
  for update to authenticated
  using (public.is_member_of(company_id))
  with check (public.is_member_of(company_id));

create policy rfq_dispatches_admin on public.rfq_dispatches
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Devis du producteur : visibles par lui et par AFRICA NEX, jamais par l'acheteur
-- ni par un producteur concurrent.

create policy quotes_select_member on public.quotes
  for select to authenticated
  using (public.is_member_of(company_id));

create policy quotes_insert_member on public.quotes
  for insert to authenticated
  with check (
    public.is_member_of(company_id)
    and author_profile_id = (select auth.uid())
    and status in ('draft', 'submitted')
    and exists (
      select 1 from public.rfq_dispatches d
       where d.id = quotes.dispatch_id
         and d.company_id = quotes.company_id
         and d.status in ('sent', 'viewed')
    )
  );

create policy quotes_update_member on public.quotes
  for update to authenticated
  using (public.is_member_of(company_id) and status in ('draft', 'submitted'))
  with check (
    public.is_member_of(company_id)
    and status in ('draft', 'submitted', 'withdrawn')
    and exists (
      select 1 from public.rfq_dispatches d
       where d.id = quotes.dispatch_id and d.company_id = quotes.company_id
    )
  );

create policy quotes_admin on public.quotes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Offres AFRICA NEX : l'acheteur lit les offres publiees de ses demandes
-- et les accepte via accept_offer().

create policy offers_select_buyer on public.offers
  for select to authenticated
  using (
    status <> 'draft'
    and exists (
      select 1 from public.rfqs r
       where r.id = offers.rfq_id and r.buyer_profile_id = (select auth.uid())
    )
  );

create policy offers_admin on public.offers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy offer_margins_admin on public.offer_margins
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Messages : deux fils separes, chacun avec AFRICA NEX

create policy messages_select_buyer on public.messages
  for select to authenticated
  using (
    dispatch_id is null
    and exists (
      select 1 from public.rfqs r
       where r.id = messages.rfq_id and r.buyer_profile_id = (select auth.uid())
    )
  );

create policy messages_select_producer on public.messages
  for select to authenticated
  using (
    dispatch_id is not null
    and exists (
      select 1 from public.rfq_dispatches d
       where d.id = messages.dispatch_id and public.is_member_of(d.company_id)
    )
  );

create policy messages_insert_buyer on public.messages
  for insert to authenticated
  with check (
    sender_profile_id = (select auth.uid())
    and sender_role = 'buyer'
    and dispatch_id is null
    and read_at is null
    and exists (
      select 1 from public.rfqs r
       where r.id = messages.rfq_id
         and r.buyer_profile_id = (select auth.uid())
         and r.status not in ('closed', 'cancelled')
    )
  );

create policy messages_insert_producer on public.messages
  for insert to authenticated
  with check (
    sender_profile_id = (select auth.uid())
    and sender_role = 'producer'
    and dispatch_id is not null
    and read_at is null
    and exists (
      select 1 from public.rfq_dispatches d
       where d.id = messages.dispatch_id
         and d.rfq_id = messages.rfq_id
         and public.is_member_of(d.company_id)
    )
  );

create policy messages_admin on public.messages
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Formulaire de contact : insertion cote serveur (cle secrete), lecture admin

create policy submissions_admin on public.submissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Avis : acheteurs connectes seulement, publies apres validation

create policy reviews_select_public on public.reviews
  for select to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.companies c
       where c.id = reviews.producer_company_id and c.visibility = 'published'
    )
  );

create policy reviews_select_own on public.reviews
  for select to authenticated
  using (
    author_profile_id = (select auth.uid())
    or public.is_member_of(producer_company_id)
  );

create policy reviews_insert_buyer on public.reviews
  for insert to authenticated
  with check (
    author_profile_id = (select auth.uid())
    and status = 'pending'
    and moderated_by is null
    and moderated_at is null
    and legacy_producer_id is null
    and public.my_role() = 'buyer'
    and exists (
      select 1 from public.companies c
       where c.id = reviews.producer_company_id
         and c.visibility = 'published'
         and c.kind = 'producer'
    )
  );

create policy reviews_admin on public.reviews
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Defense en profondeur : retrait des droits inutiles aux visiteurs anonymes

revoke all on table
  public.profiles, public.company_private, public.company_members, public.company_claims,
  public.profile_views, public.audit_log, public.rfqs, public.rfq_dispatches, public.quotes,
  public.offers, public.offer_margins, public.messages, public.submissions
from anon;

revoke insert, update, delete, truncate on table
  public.companies, public.products, public.company_documents, public.reviews
from anon;

revoke execute on function
  public.is_admin(), public.my_role(), public.is_member_of(uuid), public.is_owner_of(uuid),
  public.is_privileged(), public.accept_offer(uuid)
from public, anon;

grant execute on function
  public.is_admin(), public.my_role(), public.is_member_of(uuid), public.is_owner_of(uuid),
  public.is_privileged(), public.accept_offer(uuid)
to authenticated, service_role;

grant usage on sequence public.rfq_dispatch_seq to authenticated, service_role;
