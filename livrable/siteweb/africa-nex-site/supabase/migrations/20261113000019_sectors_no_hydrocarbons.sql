-- AFRICA NEX exporte hors hydrocarbures : retrait des divisions CITI B05 (charbon et lignite),
-- B06 (petrole brut et gaz naturel) et C19 (cokefaction et raffinage). Aucune ligne ne les utilisait.
alter table public.companies drop constraint if exists companies_sector_check;
alter table public.companies add constraint companies_sector_check check (sector in (
  'A01', 'A02', 'A03', 'B07', 'B08', 'B09',
  'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18', 'C20', 'C21',
  'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C28', 'C29', 'C30', 'C31', 'C32', 'C33',
  'G46'
));
