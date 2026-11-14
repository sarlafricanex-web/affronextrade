-- Lot 5d : taux d'assurance de l'offre (pourcentage du prix fournisseur), a cote du taux de commission.
alter table public.offer_margins
  add column insurance_rate numeric(5, 2) check (insurance_rate between 0 and 100);

-- Une seule offre par devis producteur : la composition depuis un devis se retrouve et se modifie.
create unique index offer_margins_source_quote_idx on public.offer_margins (source_quote_id) where source_quote_id is not null;
