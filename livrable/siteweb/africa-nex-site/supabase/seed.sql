-- Les 16 fiches de l'ancien annuaire (tableau PRODUCERS de ProducerDirectory.tsx).
-- legacy_id conserve l'ancien identifiant : les avis Neon s'y rattachent au lancement.
-- Fiches non revendiquees, sans badge : aucune de ces entreprises ne s'est inscrite.

insert into public.companies
  (legacy_id, slug, company_name, kind, country, city, sector,
   brand_initials, brand_color, logo_url,
   verified, visibility, claim_status, created_by_admin)
values
  ('1',  'ifri',               'Ifri',               'producer', 'DZ', 'Ighzer Amokrane, Bejaia',    'agrifood',    'IF', '#0891b2', '/images/logos/ifri.png',    false, 'published', 'unclaimed', true),
  ('2',  'cevital',            'Cevital',            'producer', 'DZ', 'Bejaia',                     'agrifood',    'CV', '#059669', '/images/logos/cevital.png', false, 'published', 'unclaimed', true),
  ('3',  'sim',                'SIM',                'producer', 'DZ', 'Blida',                      'industry',    'SM', '#7c3aed', null,                        false, 'published', 'unclaimed', true),
  ('4',  'condor-electronics', 'Condor Electronics', 'producer', 'DZ', 'Bordj Bou Arreridj',         'industry',    'CE', '#dc2626', '/images/logos/condor.png',  false, 'published', 'unclaimed', true),
  ('5',  'lalla-khedidja',     'Lalla Khedidja',     'producer', 'DZ', 'Tizi Ouzou',                 'agrifood',    'LK', '#2563eb', null,                        false, 'published', 'unclaimed', true),
  ('6',  'agrodiv',            'Agrodiv',            'producer', 'DZ', 'Guelma',                     'agrifood',    'AG', '#ea580c', null,                        false, 'published', 'unclaimed', true),
  ('7',  'toudja-olive-oil',   'Toudja Olive Oil',   'producer', 'DZ', 'Bejaia',                     'agrifood',    'TO', '#65a30d', null,                        false, 'published', 'unclaimed', true),
  ('8',  'biscuiterie-bimo',   'Biscuiterie Bimo',   'producer', 'DZ', 'Blida',                      'agrifood',    'BB', '#b45309', null,                        false, 'published', 'unclaimed', true),
  ('9',  'henkel-algerie',     'Henkel Algerie',     'producer', 'DZ', 'Alger',                      'cosmetics',   'HA', '#be185d', null,                        false, 'published', 'unclaimed', true),
  ('10', 'ceramique-saida',    'Ceramique Saida',    'producer', 'DZ', 'Saida',                      'crafts',      'CS', '#9333ea', null,                        false, 'published', 'unclaimed', true),
  ('11', 'fertial',            'Fertial',            'producer', 'DZ', 'Annaba',                     'agriculture', 'FT', '#0d9488', null,                        false, 'published', 'unclaimed', true),
  ('12', 'hodna-lait',         'Hodna Lait',         'producer', 'DZ', 'M''sila',                    'agrifood',    'HL', '#4f46e5', null,                        false, 'published', 'unclaimed', true),
  ('13', 'motrio-algerie',     'MOTRIO Algerie',     'producer', 'DZ', 'Alger',                      'automotive',  'MO', '#dc2626', '/images/logos/motrio.png',  false, 'published', 'unclaimed', true),
  ('14', 'iris-tyres',         'IRIS Tyres',         'producer', 'DZ', 'Setif',                      'automotive',  'IT', '#ea580c', null,                        false, 'published', 'unclaimed', true),
  ('15', 'fb-radiateur',       'FB Radiateur',       'producer', 'DZ', 'Ain M''lila, Oum El Bouaghi', 'automotive', 'FB', '#1d4ed8', null,                        false, 'published', 'unclaimed', true),
  ('16', 'cirta-automotive',   'Cirta Automotive',   'producer', 'DZ', 'Constantine',                'automotive',  'CA', '#0f766e', null,                        false, 'published', 'unclaimed', true)
on conflict (legacy_id) do nothing;

insert into public.products (company_id, product_name, sort_order, status, source)
select c.id, p.name, p.position, 'published', 'seed'
  from public.companies c
  join (values
    ('1', 1, 'Eau minerale'), ('1', 2, 'Boissons gazeuses'), ('1', 3, 'Jus de fruits'),
    ('2', 1, 'Huile de table'), ('2', 2, 'Sucre'), ('2', 3, 'Margarine'),
    ('3', 1, 'Electromenager'), ('3', 2, 'Climatiseurs'), ('3', 3, 'Chauffe-eau'),
    ('4', 1, 'Smartphones'), ('4', 2, 'TV'), ('4', 3, 'Panneaux solaires'),
    ('5', 1, 'Eau minerale naturelle'),
    ('6', 1, 'Concentre de tomate'), ('6', 2, 'Pates'), ('6', 3, 'Couscous'), ('6', 4, 'Harissa'),
    ('7', 1, 'Huile d''olive extra vierge'), ('7', 2, 'Olives de table'),
    ('8', 1, 'Biscuits'), ('8', 2, 'Gaufrettes'), ('8', 3, 'Chocolat'),
    ('9', 1, 'Produits de soin'), ('9', 2, 'Detergents'),
    ('10', 1, 'Carrelage'), ('10', 2, 'Ceramique artisanale'), ('10', 3, 'Faience'),
    ('11', 1, 'Engrais phosphates'), ('11', 2, 'Engrais azotes'), ('11', 3, 'Ammoniac'),
    ('12', 1, 'Lait UHT'), ('12', 2, 'Yaourts'), ('12', 3, 'Fromage'),
    ('13', 1, 'Filtres'), ('13', 2, 'Plaquettes de frein'), ('13', 3, 'Batteries'), ('13', 4, 'Radiateurs'), ('13', 5, 'Kits distribution'),
    ('14', 1, 'Pneumatiques tourisme'), ('14', 2, 'Pneumatiques utilitaires'), ('14', 3, 'Pneumatiques semi-lourds'),
    ('15', 1, 'Radiateurs automobile'), ('15', 2, 'Systemes de refroidissement'),
    ('16', 1, 'Pieces detachees'), ('16', 2, 'Sous-ensembles'), ('16', 3, 'Composants mecaniques')
  ) as p (legacy_id, position, name) on p.legacy_id = c.legacy_id
 where not exists (
   select 1 from public.products x
    where x.company_id = c.id and x.source = 'seed' and x.product_name = p.name
 );
