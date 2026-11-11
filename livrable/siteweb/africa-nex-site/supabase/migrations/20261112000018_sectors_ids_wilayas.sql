-- Secteurs d'activite selon la CITI Rev.4 (divisions), identifiants NIS et article d'imposition,
-- et decoupage en 69 wilayas (loi n° 26-06 du 5 avril 2026, JO n° 25 ; numeros du decret, JO n° 40).

-- 1. Secteurs : anciennes valeurs -> divisions CITI. Les 16 fiches historiques recoivent leur division exacte.
alter table public.companies drop constraint if exists companies_sector_check;

update public.companies set sector = v.sector
from (values
  ('1', 'C11'), ('2', 'C10'), ('3', 'C27'), ('4', 'C26'), ('5', 'C11'), ('6', 'C10'), ('7', 'C10'), ('8', 'C10'),
  ('9', 'C20'), ('10', 'C23'), ('11', 'C20'), ('12', 'C10'), ('13', 'C29'), ('14', 'C22'), ('15', 'C29'), ('16', 'C29')
) as v(legacy_id, sector)
where companies.legacy_id = v.legacy_id;

update public.companies set sector = case sector
  when 'agrifood' then 'C10' when 'agriculture' then 'A01' when 'industry' then 'C28'
  when 'automotive' then 'C29' when 'cosmetics' then 'C20' when 'crafts' then 'C32' else sector end
where sector in ('agrifood', 'agriculture', 'industry', 'automotive', 'cosmetics', 'crafts');

alter table public.companies add constraint companies_sector_check check (sector in ('A01', 'A02', 'A03', 'B05', 'B06', 'B07', 'B08', 'B09', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18', 'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C28', 'C29', 'C30', 'C31', 'C32', 'C33', 'G46'));

-- Centres d'interet des acheteurs : meme correspondance, sans doublon.
update public.companies set interests = array(
  select distinct case i when 'agrifood' then 'C10' when 'agriculture' then 'A01' when 'industry' then 'C28'
    when 'automotive' then 'C29' when 'cosmetics' then 'C20' when 'crafts' then 'C32' else i end
  from unnest(interests) as i)
where interests && array['agrifood', 'agriculture', 'industry', 'automotive', 'cosmetics', 'crafts'];

update public.products p set category = c.sector
from public.companies c
where p.company_id = c.id and p.category in ('agrifood', 'agriculture', 'industry', 'automotive', 'cosmetics', 'crafts');

-- 2. Identifiants : NIS (15 chiffres, ONS) et numero d'article d'imposition (11 chiffres).
alter table public.company_private
  add column nis varchar(15) check (nis ~ '^[0-9]{15}$'),
  add column tax_article varchar(11) check (tax_article ~ '^[0-9]{11}$');

-- 3. Wilayas 59 a 69 : les fiches dont la commune a change de wilaya suivent leur commune.
update public.companies set wilaya = '59' where wilaya = '03' and trim(regexp_replace(lower(translate(city, 'ÀÂÄÉÈÊËÎÏÔÖÛÜÇàâäéèêëîïôöûüç''’-', 'AAAEEEEIIOOUUCaaaeeeeiioouuc   ')), '\s+', ' ', 'g')) in ('aflou', 'gueltat sidi saad', 'ain sidi ali', 'el beidha', 'brida', 'el ghicha', 'hadj mechri', 'sebgag', 'taouiala', 'oued morra', 'oued m zi', 'sidi bouzid');
update public.companies set wilaya = '60' where wilaya = '05' and trim(regexp_replace(lower(translate(city, 'ÀÂÄÉÈÊËÎÏÔÖÛÜÇàâäéèêëîïôöûüç''’-', 'AAAEEEEIIOOUUCaaaeeeeiioouuc   ')), '\s+', ' ', 'g')) in ('barika', 'bitam', 'azil abedelkader', 'tilatou', 'seggana', 'djezzar', 'm doukal', 'ouled ammar');
update public.companies set wilaya = '61' where wilaya = '07' and trim(regexp_replace(lower(translate(city, 'ÀÂÄÉÈÊËÎÏÔÖÛÜÇàâäéèêëîïôöûüç''’-', 'AAAEEEEIIOOUUCaaaeeeeiioouuc   ')), '\s+', ' ', 'g')) in ('el kantara', 'ain zaatout', 'branis', 'el outaya', 'djemorah');
update public.companies set wilaya = '62' where wilaya = '12' and trim(regexp_replace(lower(translate(city, 'ÀÂÄÉÈÊËÎÏÔÖÛÜÇàâäéèêëîïôöûüç''’-', 'AAAEEEEIIOOUUCaaaeeeeiioouuc   ')), '\s+', ' ', 'g')) in ('bir el ater', 'negrine', 'el ogla el malha', 'ferkane');
update public.companies set wilaya = '63' where wilaya = '13' and trim(regexp_replace(lower(translate(city, 'ÀÂÄÉÈÊËÎÏÔÖÛÜÇàâäéèêëîïôöûüç''’-', 'AAAEEEEIIOOUUCaaaeeeeiioouuc   ')), '\s+', ' ', 'g')) in ('el aricha', 'el gor', 'sidi djillali', 'bouihi');
update public.companies set wilaya = '64' where wilaya = '14' and trim(regexp_replace(lower(translate(city, 'ÀÂÄÉÈÊËÎÏÔÖÛÜÇàâäéèêëîïôöûüç''’-', 'AAAEEEEIIOOUUCaaaeeeeiioouuc   ')), '\s+', ' ', 'g')) in ('ksar chellala', 'zmalet el emir abdelkade', 'rechaiga', 'hamadia', 'serghine', 'bougara');
update public.companies set wilaya = '65' where wilaya = '17' and trim(regexp_replace(lower(translate(city, 'ÀÂÄÉÈÊËÎÏÔÖÛÜÇàâäéèêëîïôöûüç''’-', 'AAAEEEEIIOOUUCaaaeeeeiioouuc   ')), '\s+', ' ', 'g')) in ('ain oussera', 'birine', 'bouira lahdab', 'el khemis', 'sidi laadjel', 'had sahary', 'guernini', 'benhar', 'hassi fedoul', 'ain fekka');
update public.companies set wilaya = '66' where wilaya = '17' and trim(regexp_replace(lower(translate(city, 'ÀÂÄÉÈÊËÎÏÔÖÛÜÇàâäéèêëîïôöûüç''’-', 'AAAEEEEIIOOUUCaaaeeeeiioouuc   ')), '\s+', ' ', 'g')) in ('messaad', 'sed rahal', 'faidh el botma', 'guettara', 'selmana', 'oum laadham', 'deldoul', 'amourah');
update public.companies set wilaya = '67' where wilaya = '26' and trim(regexp_replace(lower(translate(city, 'ÀÂÄÉÈÊËÎÏÔÖÛÜÇàâäéèêëîïôöûüç''’-', 'AAAEEEEIIOOUUCaaaeeeeiioouuc   ')), '\s+', ' ', 'g')) in ('ksar el boukhari', 'ouled emaaraf', 'ain boucif', 'derrag', 'bouaiche', 'kef lakhdar', 'chelalet el adhaoura', 'ouled hellal', 'tafraout', 'boghar', 'sidi demed', 'aziz', 'chabounia', 'cheniguel', 'ain ouksir', 'oum el djellil', 'm fatha', 'boughzoul', 'el ouinet', 'ouled antar', 'saneg');
update public.companies set wilaya = '68' where wilaya = '28' and trim(regexp_replace(lower(translate(city, 'ÀÂÄÉÈÊËÎÏÔÖÛÜÇàâäéèêëîïôöûüç''’-', 'AAAEEEEIIOOUUCaaaeeeeiioouuc   ')), '\s+', ' ', 'g')) in ('bou saada', 'khoubana', 'm cif', 'ouled sidi brahim', 'sidi ameur', 'tamsa', 'ben srour', 'ouled slimane', 'el houamed', 'el hamel', 'zarzour', 'mohamed boudiaf', 'benzouh', 'bir foda', 'ain fares', 'sidi m hamed', 'menaa', 'ain el melh', 'medjedel', 'slim', 'ain rich', 'oulteme', 'djebel messaad');
update public.companies set wilaya = '69' where wilaya = '32' and trim(regexp_replace(lower(translate(city, 'ÀÂÄÉÈÊËÎÏÔÖÛÜÇàâäéèêëîïôöûüç''’-', 'AAAEEEEIIOOUUCaaaeeeeiioouuc   ')), '\s+', ' ', 'g')) in ('labiodh sidi cheikh', 'ain el orak', 'arbaouat', 'boussemghoun', 'chellala', 'el bnoud', 'el mehara');
