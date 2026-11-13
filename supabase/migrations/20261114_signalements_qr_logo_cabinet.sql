-- ══════════════════════════════════════════════════════════════════════════════
-- AJ Signalement (14/11/2026) — logo d'un cabinet client.
--
-- Demande de Hugo du 13/11/2026 : « pouvoir ajouter le logo au cabinet et aux PDF ». Le logo est une DONNÉE du cabinet,
-- envoyée et retirée par le super admin dans l'espace (fiche du cabinet), JAMAIS un fichier du dépôt (dépôt public :
-- aucun logo ni nom de client ici). Il paraît sur les affiches PDF, dans l'espace du cabinet, sur la page publique de
-- signalement et dans l'accusé de réception envoyé au déclarant ; ni dans les e-mails de signalement envoyés aux
-- gestionnaires (partis en lot : aucune pièce jointe possible), ni dans les messages de diffusion, ni sur la page de
-- désinscription.
--
-- Contenu : 5 colonnes sur signalements_qr_cabinets (image, largeur, hauteur, version, date de mise à jour) ; une
-- contrainte qui revérifie la FORME de l'image (PNG seulement, 200 Kio et 800 × 400 px au plus, dimensions des colonnes =
-- celles lues dans l'en-tête, version = 16 premiers caractères du SHA-256 de l'image ; tout ou rien) ; une fonction
-- d'envoi ou de retrait, en une transaction avec son journal.
-- Seul format stocké : PNG. Le navigateur convertit SVG, PNG, JPEG et WebP en PNG par un canvas (un SVG chargé comme
-- image n'exécute aucun script), la route revérifie l'image, la base aussi : aucun SVG n'est jamais stocké ni servi.
-- Relecture de conformité du 13/11/2026 — un seul contrat de forme : la contrainte appelle signalements_qr_png_forme_valide,
-- qui parcourt les morceaux comme le serveur (analyserPngQr, lib/aj-signalement/logo.ts) : signature ; IHDR d'abord
-- (profondeur 8, RVB ou RVBA, sans entrelacement) ; puis seulement des accessoires sans texte, de longueur fixe, une fois
-- chacun (sRGB, gAMA, cHRM, sBIT, pHYs, bKGD, tRNS en RVB) ; puis les IDAT, à la suite ; IEND vide en dernier et rien
-- après. Ce que la base ne sait pas calculer reste au SERVEUR : les CRC des morceaux et le contenu zlib des IDAT (flux
-- conforme, taille exacte des pixels, rien après lui). La route les vérifie avant d'écrire, et chaque lecture (route
-- publique, accusé de réception) revérifie l'image entière : une image écrite hors de la route (éditeur SQL) qui n'aurait
-- que la forme juste n'est jamais servie ni envoyée ; les pages, qui ne lisent que les métadonnées, l'annonceraient et
-- son image serait absente (404) — seul écart restant entre la base et le serveur.
-- Stockage en colonne bytea plutôt qu'en bucket Storage : une image bornée à 200 Kio par cabinet (quelques dizaines
-- de lignes), lue par la clé service comme le reste de la fiche ; aucun bucket, aucune politique de stockage, aucune
-- URL signée à gérer, et la règle de l'image est vérifiée par la base elle-même (contrainte CHECK).
-- Version : empreinte du contenu, mise dans l'adresse de lecture publique (cache public immuable, aucune donnée
-- personnelle) ; la même image renvoyée ne change rien (ni écriture, ni journal).
-- Journal : action EXISTANTE cabinet.modifie (le logo est un champ du cabinet), champs {logo}, détails
-- { logo: envoye | retire, largeur, hauteur, octets } (énumération et nombres seulement). La liste fermée des actions
-- (signalements_qr_journal_action_valeurs) n'est donc pas touchée : la 20261113, qui la remplace, s'applique avant ou
-- après celle-ci sans conflit (son garde-fou journal_action_perdue ne trouve aucune action inconnue).
-- Erreurs levées par la fonction : P0001 (a_reverifier : cabinet introuvable, code public 409 des routes), 22023
-- (paramètre invalide) ; image refusée par la contrainte : 23514. Jamais renvoyées telles quelles au navigateur.
-- Droits : RLS déjà activée sans politique sur la table (20261111) ; droits de la table retirés de nouveau à anon et
-- authenticated (redit pour les colonnes nouvelles) ; EXECUTE des deux fonctions à service_role seul (la contrainte
-- appelle la fonction de forme : le rôle qui écrit la ligne doit pouvoir l'exécuter ; postgres, superutilisateur, aussi).
--
-- Additive et rejouable (modèle 20261113) : ADD COLUMN IF NOT EXISTS, contrainte nommée créée seulement si absente de
-- pg_constraint, en NOT VALID puis VALIDATE, CREATE OR REPLACE FUNCTION ; aucune écriture de données ; aucun DROP.
-- À appliquer par Frédéric (Supabase > SQL Editor) APRÈS 20261111_signalements_qr_gestionnaires.sql (cabinets, journal ;
-- appliquée, comme la 20261112), avant ou après la 20261113 : aucune dépendance entre elles. D'ici là, les routes se
-- replient (42703, PGRST204, PGRST202) : aucun logo (pages, affiches et e-mails comme avant), envoi et retrait
-- 503 base_absente.
-- Règles exécutées sur un vrai PostgreSQL : tests/migrations/signalements_qr_logo_cabinet.execution.test.ts (PGlite).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Logo du cabinet ──
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS logo_png BYTEA;
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS logo_largeur INTEGER;
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS logo_hauteur INTEGER;
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS logo_version TEXT;
ALTER TABLE signalements_qr_cabinets ADD COLUMN IF NOT EXISTS logo_maj_le TIMESTAMPTZ;

COMMENT ON COLUMN signalements_qr_cabinets.logo_png IS 'Logo du cabinet : PNG seulement (converti par le navigateur, revérifié par la route et par la contrainte), 200 Kio et 800 × 400 px au plus ; NULL : aucun logo.';
COMMENT ON COLUMN signalements_qr_cabinets.logo_largeur IS 'Largeur du logo en pixels (celle de l''en-tête IHDR de l''image).';
COMMENT ON COLUMN signalements_qr_cabinets.logo_hauteur IS 'Hauteur du logo en pixels (celle de l''en-tête IHDR de l''image).';
COMMENT ON COLUMN signalements_qr_cabinets.logo_version IS 'Version du logo : 16 premiers caractères hexadécimaux du SHA-256 de l''image (adresse de lecture publique, cache immuable).';
COMMENT ON COLUMN signalements_qr_cabinets.logo_maj_le IS 'Date du dernier envoi du logo.';

-- Forme d'un PNG telle que le serveur l'exige (analyserPngQr), CRC et contenu zlib à part : vrai ou faux, ne lève
-- jamais. Positions comptées depuis 0 (get_byte) : un morceau à v_pos a sa longueur en v_pos … v_pos + 3 (gros-boutiste),
-- son type en v_pos + 4 … v_pos + 7, ses données à partir de v_pos + 8, puis 4 octets de CRC.
CREATE OR REPLACE FUNCTION signalements_qr_png_forme_valide(p_png bytea) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_total    integer := coalesce(octet_length(p_png), 0);
  v_pos      integer := 8;
  v_longueur bigint;
  v_type     text;
  v_octet    integer;
  v_couleur  integer;
  v_attendue integer;
  -- 0 : IHDR attendu ; 1 : accessoires ; 2 : IDAT ; 3 : IEND lu (plus rien ensuite).
  v_etape    integer := 0;
  v_vus      text[] := '{}';
BEGIN
  IF v_total < 45 OR substring(p_png FROM 1 FOR 8) <> '\x89504e470d0a1a0a'::bytea THEN
    RETURN false;
  END IF;
  WHILE v_pos < v_total LOOP
    IF v_etape = 3 OR v_total - v_pos < 12 THEN
      RETURN false;
    END IF;
    v_longueur := (get_byte(p_png, v_pos)::bigint << 24) | (get_byte(p_png, v_pos + 1) << 16)
                  | (get_byte(p_png, v_pos + 2) << 8) | get_byte(p_png, v_pos + 3);
    IF v_longueur > v_total - v_pos - 12 THEN
      RETURN false;
    END IF;
    -- Type : quatre lettres ASCII.
    v_type := '';
    FOR k IN 4 .. 7 LOOP
      v_octet := get_byte(p_png, v_pos + k);
      IF NOT (v_octet BETWEEN 65 AND 90 OR v_octet BETWEEN 97 AND 122) THEN
        RETURN false;
      END IF;
      v_type := v_type || chr(v_octet);
    END LOOP;

    IF v_etape = 0 THEN
      -- IHDR de 13 octets : profondeur 8, RVB (2) ou RVBA (6), compression, filtre et entrelacement 0.
      IF v_type <> 'IHDR' OR v_longueur <> 13 OR get_byte(p_png, v_pos + 16) <> 8 OR get_byte(p_png, v_pos + 17) NOT IN (2, 6)
         OR get_byte(p_png, v_pos + 18) <> 0 OR get_byte(p_png, v_pos + 19) <> 0 OR get_byte(p_png, v_pos + 20) <> 0 THEN
        RETURN false;
      END IF;
      v_couleur := get_byte(p_png, v_pos + 17);
      v_etape := 1;
    ELSIF v_type = 'IDAT' THEN
      -- Les IDAT se suivent : aucun après un autre morceau qui les aurait interrompus.
      IF v_etape = 1 THEN
        v_etape := 2;
      END IF;
    ELSIF v_type = 'IEND' THEN
      IF v_etape <> 2 OR v_longueur <> 0 THEN
        RETURN false;
      END IF;
      v_etape := 3;
    ELSE
      -- Accessoire : avant le premier IDAT, une fois au plus, de la longueur fixée pour le type de couleur ; tout autre
      -- type (texte, métadonnées, iCCP, PLTE, animation, second IHDR, inconnu) : refusé.
      v_attendue := CASE v_type
        WHEN 'sRGB' THEN 1 WHEN 'gAMA' THEN 4 WHEN 'cHRM' THEN 32 WHEN 'pHYs' THEN 9 WHEN 'bKGD' THEN 6
        WHEN 'sBIT' THEN CASE v_couleur WHEN 2 THEN 3 ELSE 4 END
        WHEN 'tRNS' THEN CASE v_couleur WHEN 2 THEN 6 END
      END;
      IF v_etape <> 1 OR v_attendue IS NULL OR v_longueur <> v_attendue OR v_type = ANY (v_vus) THEN
        RETURN false;
      END IF;
      v_vus := v_vus || v_type;
    END IF;
    v_pos := v_pos + 12 + v_longueur::integer;
  END LOOP;
  RETURN v_etape = 3;
END $fn$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_cabinets_logo_png_valide'
                 AND conrelid = 'signalements_qr_cabinets'::regclass) THEN
    -- Tout ou rien. Octets 0 à 15 : signature PNG, longueur (13) et type (« IHDR ») du premier morceau ; 16 à 23 :
    -- largeur et hauteur (entiers non signés, gros-boutistes) ; 12 derniers : morceau IEND (longueur 0, type, CRC fixe),
    -- donc rien après la fin de l'image. 45 octets au moins : signature, IHDR et IEND. Puis la suite des morceaux
    -- (signalements_qr_png_forme_valide).
    ALTER TABLE signalements_qr_cabinets ADD CONSTRAINT signalements_qr_cabinets_logo_png_valide CHECK (
      (logo_png IS NULL AND logo_largeur IS NULL AND logo_hauteur IS NULL AND logo_version IS NULL AND logo_maj_le IS NULL)
      OR (logo_png IS NOT NULL AND logo_largeur IS NOT NULL AND logo_hauteur IS NOT NULL AND logo_version IS NOT NULL
          AND logo_maj_le IS NOT NULL
          AND octet_length(logo_png) BETWEEN 45 AND 204800
          AND substring(logo_png FROM 1 FOR 16) = '\x89504e470d0a1a0a0000000d49484452'::bytea
          AND substring(logo_png FROM octet_length(logo_png) - 11 FOR 12) = '\x0000000049454e44ae426082'::bytea
          AND logo_largeur BETWEEN 1 AND 800 AND logo_hauteur BETWEEN 1 AND 400
          AND logo_largeur = ((get_byte(logo_png, 16)::bigint << 24) | (get_byte(logo_png, 17) << 16)
                              | (get_byte(logo_png, 18) << 8) | get_byte(logo_png, 19))
          AND logo_hauteur = ((get_byte(logo_png, 20)::bigint << 24) | (get_byte(logo_png, 21) << 16)
                              | (get_byte(logo_png, 22) << 8) | get_byte(logo_png, 23))
          AND logo_version = left(encode(sha256(logo_png), 'hex'), 16)
          AND signalements_qr_png_forme_valide(logo_png))) NOT VALID;
  END IF;
END $$;
ALTER TABLE signalements_qr_cabinets VALIDATE CONSTRAINT signalements_qr_cabinets_logo_png_valide;

-- ── 2. Envoi ou retrait du logo (route du super admin), en une transaction avec son journal ──
-- p_png NULL : retrait (p_largeur et p_hauteur NULL aussi). Même image que celle en place, ou retrait sans logo : rien
-- n'est écrit ni journalisé (modifie = false). La contrainte revérifie l'image (23514).
CREATE OR REPLACE FUNCTION signalements_qr_regler_logo_cabinet(
  p_cabinet uuid, p_png bytea, p_largeur integer, p_hauteur integer, p_acteur uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_avant   text;
  v_version text;
BEGIN
  IF p_cabinet IS NULL OR p_acteur IS NULL
     OR (p_png IS NULL) <> (p_largeur IS NULL) OR (p_png IS NULL) <> (p_hauteur IS NULL) THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  SELECT k.logo_version INTO v_avant FROM signalements_qr_cabinets k WHERE k.id = p_cabinet FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;

  IF p_png IS NULL THEN
    IF v_avant IS NULL THEN
      RETURN jsonb_build_object('version', NULL, 'modifie', false);
    END IF;
    UPDATE signalements_qr_cabinets
       SET logo_png = NULL, logo_largeur = NULL, logo_hauteur = NULL, logo_version = NULL, logo_maj_le = NULL
     WHERE id = p_cabinet;
    INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, champs, details)
    VALUES (p_cabinet, p_acteur, 'super_admin', 'cabinet.modifie', ARRAY['logo'], jsonb_build_object('logo', 'retire'));
    RETURN jsonb_build_object('version', NULL, 'modifie', true);
  END IF;

  v_version := left(encode(sha256(p_png), 'hex'), 16);
  IF v_version IS NOT DISTINCT FROM v_avant THEN
    RETURN jsonb_build_object('version', v_version, 'modifie', false);
  END IF;
  UPDATE signalements_qr_cabinets
     SET logo_png = p_png, logo_largeur = p_largeur, logo_hauteur = p_hauteur, logo_version = v_version, logo_maj_le = now()
   WHERE id = p_cabinet;                           -- 23514 (contrainte) si l'image n'est pas un PNG conforme
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, champs, details)
  VALUES (p_cabinet, p_acteur, 'super_admin', 'cabinet.modifie', ARRAY['logo'],
          jsonb_build_object('logo', 'envoye', 'largeur', p_largeur, 'hauteur', p_hauteur, 'octets', octet_length(p_png)));
  RETURN jsonb_build_object('version', v_version, 'modifie', true);
END $fn$;

-- ── 3. Droits : EXECUTE réservé à service_role (signatures complètes) ; table redite sans droit pour anon et authenticated ──
REVOKE EXECUTE ON FUNCTION signalements_qr_png_forme_valide(bytea) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_png_forme_valide(bytea) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_regler_logo_cabinet(uuid, bytea, integer, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_regler_logo_cabinet(uuid, bytea, integer, integer, uuid) TO service_role;
REVOKE ALL ON signalements_qr_cabinets FROM anon, authenticated;

-- PostgREST relit le schéma : colonnes et fonction utilisables sans redémarrage.
NOTIFY pgrst, 'reload schema';
