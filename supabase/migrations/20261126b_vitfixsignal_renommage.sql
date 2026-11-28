-- ══════════════════════════════════════════════════════════════════════════════
-- Vitfix Signal (26/11/2026) — renommage du produit de signalements par QR code : ce qui reste à l'ancien nom en base.
-- Décision du 26/11/2026 (référent métier) : le produit s'appelle « Vitfix Signal » (adresses /vitfixsignal/,
-- /api/vitfixsignal/…). Les tables gardent leur nom (signalements_qr_*) : aucun nom de table, de colonne, de fonction,
-- de contrainte ni d'action du journal ne portait l'ancien nom. Deux choses seulement le portent en base :
--
-- 1. Les COMMENTAIRES de 13 tables et d'une colonne (COMMENT ON, lus dans l'éditeur de Supabase) : réécrits avec le
--    nouveau nom, au mot près ceux des fichiers de migration du dépôt (20261104, 20261111, 20261113, 20261119), que le
--    renommage a mis à jour. Aucun effet sur les données ni sur le code.
--
-- 2. Le REPÈRE DE ROUTAGE des comptes des gestionnaires, dans auth.users.raw_app_meta_data (app_metadata) : la clé
--    « aj_signalement_cabinet » devient « vitfixsignal_cabinet », avec la MÊME valeur (l'identifiant du cabinet du
--    gestionnaire). Aucune autre clé n'est touchée (role, provider, providers…), aucun autre compte non plus. Ce repère
--    ne donne aucun droit : il aiguille le gestionnaire vers l'espace de son cabinet (lib/vitfixsignal/acces-espace.ts) ;
--    chaque route relit sa fiche. Un compte qui porterait déjà la nouvelle clé la garde ; l'ancienne lui est retirée.
--
-- ORDRE : à lancer APRÈS la mise en production du code du renommage, jamais avant. Le code d'avant ne lit que
-- l'ancienne clé : lancée avant lui, la migration ferait perdre leur aiguillage aux comptes des gestionnaires jusqu'au
-- déploiement. Le code du renommage lit la nouvelle clé et, à défaut, l'ancienne (transition :
-- lib/vitfixsignal/ancien-nom.ts, bloc E) : il marche avant comme après cette migration, et le jeton d'une session
-- ouverte, qui garde l'ancienne clé jusqu'à son rafraîchissement (une heure par défaut), reste compris.
--
-- Rien d'autre : aucune table créée, modifiée ni supprimée ; aucune ligne des tables signalements_qr_* touchée ; aucune
-- fonction, aucun trigger, aucune policy, aucun droit changé. La liste des identifiants de cabinet réservés n'existe
-- que dans le code (lib/vitfixsignal/chemin-cabinet.ts) : la base ne contrôle que le format, rien à y changer.
-- La clé du verrou de transaction de signalements_qr_diffusion_creer (20261113) garde son texte : interne à la
-- fonction, jamais stockée ni affichée ; la changer demanderait de recréer la fonction entière, sans effet utile.
--
-- Contrôle sur une vraie base : tests/migrations/vitfixsignal_renommage.execution.test.ts (PGlite) ;
-- relecture du texte : tests/migrations/vitfixsignal_renommage.test.ts.
-- Retour arrière : docs/rollback-procedures.md, section « Migration 20261126b — Vitfix Signal : renommage ».
--
-- Rejouable : relancée, elle ne change rien (les commentaires sont reposés à l'identique, plus aucun compte ne porte
-- l'ancienne clé). Une seule transaction.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

set local lock_timeout = '5s';

-- ── 1. Commentaires des tables et de la colonne (texte des migrations du dépôt, nouveau nom) ──

-- 20261104_signalements_qr.sql
COMMENT ON TABLE signalements_qr_coproprietes IS 'Vitfix Signal : copropriétés dotées d''un QR code de signalement (sans lien avec les tables syndic_*).';
COMMENT ON TABLE signalements_qr IS 'Vitfix Signal : signalements déposés après scan du QR code d''une copropriété, avec les coordonnées du déclarant.';

-- 20261111_signalements_qr_gestionnaires.sql
COMMENT ON TABLE signalements_qr_cabinets IS 'Vitfix Signal : cabinets clients (nom, identifiant du chemin public, langue des pages), saisis par le super admin.';
COMMENT ON TABLE signalements_qr_domaines_autorises IS 'Vitfix Signal : domaines e-mail des gestionnaires de chaque cabinet client (un domaine, un seul cabinet).';
COMMENT ON TABLE signalements_qr_gestionnaires IS 'Vitfix Signal : gestionnaires d''un cabinet client (fiches tenues par le super admin ; aucun compte en PR 1).';
COMMENT ON TABLE signalements_qr_invitations IS 'Vitfix Signal : envois de confirmation d''adresse (et d''accès en PR 2) aux gestionnaires, une ligne par envoi.';
COMMENT ON COLUMN signalements_qr_coproprietes.cle_nom IS 'Nom normalisé (calculé côté serveur, lib/vitfixsignal/doublons.ts) pour le contrôle des doublons ; NULL pour les lignes antérieures.';
COMMENT ON TABLE signalements_qr_attributions IS 'Vitfix Signal : copropriétés attribuées à chaque gestionnaire (même cabinet, contrôlé par les fonctions).';
COMMENT ON TABLE signalements_qr_journal IS 'Vitfix Signal : traçabilité (qui a créé ou changé quoi), sans donnée personnelle ; 12 mois glissants.';
COMMENT ON TABLE signalements_qr_operations IS 'Vitfix Signal : lots de création de copropriétés (saisie ou import), pour rejouer un double clic sans effet.';

-- 20261113_signalements_qr_diffusion.sql
COMMENT ON TABLE signalements_qr_diffusions IS 'Vitfix Signal : messages d''exploitation diffusés aux déclarants d''une copropriété (auteur, périmètre, valeurs figées) ; 3 ans.';
COMMENT ON TABLE signalements_qr_diffusion_destinataires IS 'Vitfix Signal : une ligne par adresse (empreinte, jamais l''adresse) et par diffusion, avec l''état d''envoi.';
COMMENT ON TABLE signalements_qr_diffusion_oppositions IS 'Vitfix Signal : oppositions à la diffusion par copropriété et empreinte de l''adresse (preuve gardée au moins 3 ans, sans clé étrangère).';

-- 20261119_signalements_qr_bureaux.sql
COMMENT ON TABLE signalements_qr_bureaux IS 'Vitfix Signal : bureaux d''un cabinet client, créés par le super admin (V1 : nom et fermeture, aucune adresse de contact).';

-- ── 2. Repère de routage des comptes : ancienne clé → nouvelle clé, même valeur ──
-- Seuls les comptes qui portent l'ancienne clé sont touchés (« -> » rend NULL quand la clé est absente, ou quand
-- raw_app_meta_data n'est pas un objet). Nouvelle clé déjà présente : elle est gardée telle quelle, l'ancienne est
-- seulement retirée. Sinon la valeur est recopiée sans transformation (« -> » garde le type JSON).
UPDATE auth.users
   SET raw_app_meta_data = CASE
         WHEN raw_app_meta_data -> 'vitfixsignal_cabinet' IS NOT NULL
           THEN raw_app_meta_data - 'aj_signalement_cabinet'
         ELSE (raw_app_meta_data - 'aj_signalement_cabinet')
              || jsonb_build_object('vitfixsignal_cabinet', raw_app_meta_data -> 'aj_signalement_cabinet')
       END
 WHERE raw_app_meta_data -> 'aj_signalement_cabinet' IS NOT NULL;

commit;
