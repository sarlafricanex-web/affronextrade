-- Capacite conteneur en chargement au sol (cartons sans palette), a cote de la capacite
-- palettisee : les deux sont calculees a partir du conditionnement en 4 niveaux.
alter table public.products
  add column container_floor_20ft integer check (container_floor_20ft >= 0),
  add column container_floor_40ft integer check (container_floor_40ft >= 0);

grant select (container_floor_20ft, container_floor_40ft) on public.products to anon, authenticated;

-- Reprise des fiches carton deja saisies (en cm) dans le conditionnement en 4 niveaux (en mm) :
-- niveau 1 = l'unite de vente, niveau 2 = le carton, niveau 4 = la palette si elle etait declaree.
update public.products
   set packaging_spec = jsonb_build_object(
         'levels', jsonb_build_array(
           jsonb_build_object('qty', 1, 'type', null, 'weight_kg', null, 'length_mm', null, 'width_mm', null, 'height_mm', null),
           jsonb_build_object('qty', units_per_carton, 'type', 'carton', 'weight_kg', carton_gross_weight_kg,
                              'length_mm', round(carton_length_cm * 10), 'width_mm', round(carton_width_cm * 10), 'height_mm', round(carton_height_cm * 10)),
           jsonb_build_object('qty', null, 'type', null, 'weight_kg', null, 'length_mm', null, 'width_mm', null, 'height_mm', null),
           jsonb_build_object('qty', case when palletized and cartons_per_pallet is not null then units_per_carton * cartons_per_pallet end,
                              'type', case when palletized then 'pallet_euro' end, 'weight_kg', null, 'length_mm', null, 'width_mm', null, 'height_mm', null)
         ),
         'label', null, 'wedging', null, 'protection', null, 'notes', null)
 where packaging_spec is null
   and units_per_carton is not null
   and carton_length_cm is not null;
