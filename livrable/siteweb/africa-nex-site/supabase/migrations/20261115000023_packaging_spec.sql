-- Conditionnement en 4 niveaux (structure de l'annexe "brief conditionnement" des RFQ export) :
-- 1 unite de vente, 2 carton, 3 colis, 4 unite de transport (palette). Meme fiche pour tous les forfaits.
-- Forme : { "levels": [ { "qty", "type", "weight_kg", "length_mm", "width_mm", "height_mm" } x4 ],
--           "label", "wedging", "protection", "notes" }
alter table public.products
  add column packaging_spec jsonb check (packaging_spec is null or (jsonb_typeof(packaging_spec) = 'object' and pg_column_size(packaging_spec) <= 8000));

grant select (packaging_spec) on public.products to anon, authenticated;
