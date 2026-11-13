-- Demande de devis : quantite en unites (2 000 L) ou en conteneurs (2 x 40 pieds frigorifique).
-- En mode conteneurs, la quantite en unites est estimee a l'affichage depuis la fiche carton du produit.
alter table public.rfqs
  add column quantity_mode text not null default 'units' check (quantity_mode in ('units', 'containers')),
  add column container_size text check (container_size in ('20', '40')),
  add column container_reefer boolean not null default false,
  add column container_count integer check (container_count between 1 and 100);

alter table public.rfqs add constraint rfqs_quantity_complete check (
  (quantity_mode = 'units' and quantity is not null and unit is not null)
  or (quantity_mode = 'containers' and container_size is not null and container_count is not null)
);

-- Pays de destination en code ISO (comme companies.country).
alter table public.rfqs add constraint rfqs_destination_iso check (destination_country is null or destination_country ~ '^[A-Z]{2}$');
