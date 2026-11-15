-- Demande multi-lignes : en mode "unites", la quantite peut etre portee par chaque ligne
-- (table rfq_lines) plutot que par l'en-tete. Une quantite d'en-tete reste complete (quantite + unite).
alter table public.rfqs drop constraint rfqs_quantity_complete;
alter table public.rfqs add constraint rfqs_quantity_complete check (
  (quantity_mode = 'units' and ((quantity is null and unit is null) or (quantity is not null and unit is not null)))
  or (quantity_mode = 'containers' and container_size is not null and container_count is not null)
);
