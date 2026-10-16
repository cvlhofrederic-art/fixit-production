-- 20261016_profiles_artisan_id_document_verso.sql
--
-- Verso de la pièce d'identité, déposé à l'inscription d'une société BTP
-- (POST /api/pro/register/finalize). Aucune colonne ne lui était prévue : le
-- formulaire le demandait mais il n'était jamais enregistré.
--
-- Sans danger avant ou après le déploiement du code : la route écrit le verso
-- à part, et son échec n'empêche pas l'enregistrement du Kbis et du recto.

alter table public.profiles_artisan
  add column if not exists id_document_verso_url text;

comment on column public.profiles_artisan.id_document_verso_url is
  'URL signée du verso de la pièce d''identité déposé à l''inscription (bucket artisan-documents, dossier identity-verso).';
