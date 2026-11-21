-- Emails de notification (20 novembre 2026). Journal de chaque email : destinataire, sujet, statut.
-- Ecrit par le serveur avec la cle secrete (module src/lib/notify), lu par AFRICA NEX seule.
--   sent       : envoye par Resend au destinataire ;
--   redirected : envoye a l'adresse de test (developpement), destinataire d'origine garde ici ;
--   logged     : mode journal (developpement) : rien n'est parti ;
--   skipped    : destinataire sans email ou compte de test (@example.com) ;
--   failed     : erreur de Resend (detail dans error).
create table public.email_notifications (
  id bigint generated always as identity primary key,
  kind text not null check (char_length(kind) <= 60),
  rfq_id uuid references public.rfqs (id) on delete cascade, -- le journal suit la demande
  recipient_profile_id uuid references public.profiles (id) on delete set null,
  recipient_email text,
  locale text not null default 'fr' check (locale in ('fr', 'en', 'ar')),
  subject text not null check (char_length(subject) <= 300),
  status text not null check (status in ('sent', 'redirected', 'logged', 'skipped', 'failed')),
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now()
);

create index email_notifications_rfq_idx on public.email_notifications (rfq_id, created_at);
create index email_notifications_created_idx on public.email_notifications (created_at desc);

alter table public.email_notifications enable row level security;

create policy email_notifications_admin_select on public.email_notifications
  for select to authenticated
  using (public.is_admin());

revoke all on table public.email_notifications from anon;
