-- Fiche logistique du produit : le producteur decrit son carton, la plateforme calcule la capacite
-- par conteneur (container_capacity_20ft / 40ft, en unites de vente). dimensions_cm (cahier des
-- charges) est rempli en parallele : {length, width, height, weight_kg}.

alter table public.products
  add column units_per_carton numeric(12, 2) check (units_per_carton > 0),
  add column carton_length_cm numeric(7, 1) check (carton_length_cm > 0 and carton_length_cm <= 300),
  add column carton_width_cm numeric(7, 1) check (carton_width_cm > 0 and carton_width_cm <= 300),
  add column carton_height_cm numeric(7, 1) check (carton_height_cm > 0 and carton_height_cm <= 300),
  add column carton_gross_weight_kg numeric(8, 2) check (carton_gross_weight_kg > 0 and carton_gross_weight_kg <= 2000),
  add column max_stack_layers integer check (max_stack_layers between 1 and 50),
  add column storage_condition text check (storage_condition in ('ambient', 'controlled', 'chilled', 'frozen')),
  add column palletized boolean not null default false,
  add column cartons_per_pallet integer check (cartons_per_pallet between 1 and 500);

-- La lecture de products se fait colonne par colonne (prix confidentiel, migration 11) :
-- les nouvelles colonnes doivent etre autorisees explicitement.
grant select (
  units_per_carton, carton_length_cm, carton_width_cm, carton_height_cm, carton_gross_weight_kg,
  max_stack_layers, storage_condition, palletized, cartons_per_pallet
) on public.products to anon, authenticated;
