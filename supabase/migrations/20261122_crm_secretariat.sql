-- ══════════════════════════════════════════════════════════════════════════════
-- CRM du secrétariat Vitfix (22/11/2026) — V1 : contacts, demandes (tickets), journal.
--
-- Usage interne : la secrétaire reçoit les appels et messages du WhatsApp pro, crée une demande par appel
-- (motif, priorité, statut, rappel) et en garde l'historique. Écran : /admin/crm (rôle « secretariat » ou super admin).
--
-- Trois tables indépendantes du reste de Vitfix (aucune clé vers profiles_*, syndic_*, bookings) :
--   crm_contacts    : une fiche par client, retrouvée par son numéro (format international +351…, +33…) ;
--   crm_demandes    : une demande = un ticket (motif, canal, priorité, statut, rappel, date de résolution) ;
--   crm_evenements  : historique d'une demande (création, changement de statut, note, appel, message).
--                     wa_message_id (identifiant WhatsApp, unique) est prévu pour la liaison automatique des
--                     messages WhatsApp : rien ne l'écrit dans cette V1.
--
-- Accès : clé service uniquement (routes app/api/crm/*, qui contrôlent le rôle) ; RLS activée sans politique et droits
-- retirés aux clés anon et authenticated : rien n'est lisible ni modifiable depuis le navigateur.
-- Rejouable : IF NOT EXISTS partout, aucun DROP. Aucune donnée créée.
--
-- À appliquer en production par Frédéric (Supabase > SQL Editor > Run).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Contacts ──
CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL DEFAULT '' CHECK (char_length(nom) <= 120),
  telephone TEXT CHECK (telephone IS NULL OR telephone ~ '^\+[1-9][0-9]{7,14}$'),
  email TEXT CHECK (email IS NULL OR char_length(email) <= 254),
  ville TEXT NOT NULL DEFAULT '' CHECK (char_length(ville) <= 120),
  langue TEXT NOT NULL DEFAULT 'pt' CHECK (langue IN ('fr', 'pt')),
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
  cree_par UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un numéro = une fiche (les contacts sans numéro, appel masqué par exemple, restent possibles).
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_telephone_unique ON public.crm_contacts (telephone) WHERE telephone IS NOT NULL;

-- ── 2. Demandes ──
CREATE TABLE IF NOT EXISTS public.crm_demandes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGINT GENERATED ALWAYS AS IDENTITY,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE RESTRICT,
  titre TEXT NOT NULL CHECK (char_length(titre) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  motif TEXT NOT NULL CHECK (motif IN ('devis', 'urgence', 'rdv', 'sav', 'info', 'reclamation', 'autre')),
  canal TEXT NOT NULL CHECK (canal IN ('appel', 'appel_manque', 'whatsapp', 'telephone', 'email', 'autre')),
  priorite TEXT NOT NULL DEFAULT 'normale' CHECK (priorite IN ('normale', 'urgente')),
  statut TEXT NOT NULL DEFAULT 'nouvelle' CHECK (statut IN ('nouvelle', 'en_cours', 'en_attente', 'resolue')),
  rappel_le TIMESTAMPTZ,
  resolue_le TIMESTAMPTZ,
  cree_par UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_demandes_numero_unique ON public.crm_demandes (numero);
CREATE INDEX IF NOT EXISTS crm_demandes_statut_idx ON public.crm_demandes (statut, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_demandes_contact_idx ON public.crm_demandes (contact_id);

-- ── 3. Historique ──
CREATE TABLE IF NOT EXISTS public.crm_evenements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id UUID REFERENCES public.crm_demandes(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('creation', 'statut', 'note', 'appel', 'message_entrant', 'message_sortant')),
  contenu TEXT NOT NULL DEFAULT '' CHECK (char_length(contenu) <= 4000),
  auteur UUID,
  auteur_nom TEXT NOT NULL DEFAULT '' CHECK (char_length(auteur_nom) <= 120),
  wa_message_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (demande_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS crm_evenements_demande_idx ON public.crm_evenements (demande_id, created_at);

-- ── 4. Accès : serveur seul ──
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_demandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_evenements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.crm_contacts FROM anon, authenticated;
REVOKE ALL ON TABLE public.crm_demandes FROM anon, authenticated;
REVOKE ALL ON TABLE public.crm_evenements FROM anon, authenticated;

-- Droits de la clé service écrits ici plutôt que tirés des droits par défaut du schéma.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_contacts, public.crm_demandes, public.crm_evenements TO service_role;

-- Séquence du numéro de demande : même fermeture (nom lu par pg_get_serial_sequence, jamais supposé).
DO $$
DECLARE
  sequence_numero TEXT := pg_get_serial_sequence('public.crm_demandes', 'numero');
BEGIN
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon, authenticated', sequence_numero);
  EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role', sequence_numero);
END $$;
