-- ============================================================
-- 035 — Modèle Spécialités granulaires BTP
-- ============================================================

-- ── 1. Table master des spécialités ──────────────────────────
CREATE TABLE IF NOT EXISTS specialties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  label_fr    TEXT NOT NULL,
  label_pt    TEXT,
  code_ape    TEXT,
  applies_to  TEXT NOT NULL DEFAULT 'both',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Pivot profiles ↔ spécialités ──────────────────────────
CREATE TABLE IF NOT EXISTS profile_specialties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty_id    UUID NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  verified_source TEXT NOT NULL DEFAULT 'self_declared',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, specialty_id)
);

-- ── 3. Index pour la recherche par spécialité ────────────────
CREATE INDEX IF NOT EXISTS idx_profile_specialties_specialty
  ON profile_specialties(specialty_id);

CREATE INDEX IF NOT EXISTS idx_profile_specialties_user
  ON profile_specialties(user_id);

CREATE INDEX IF NOT EXISTS idx_profile_specialties_source
  ON profile_specialties(verified_source);

-- ── 4. RLS ───────────────────────────────────────────────────
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "specialties_public_read"
  ON specialties FOR SELECT USING (true);

CREATE POLICY "profile_specialties_public_read"
  ON profile_specialties FOR SELECT USING (true);

CREATE POLICY "profile_specialties_own_insert"
  ON profile_specialties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── 5. Seed — catalogue master des spécialités BTP ───────────
INSERT INTO specialties (slug, label_fr, label_pt, code_ape, applies_to, sort_order) VALUES
  ('gros-oeuvre',          'Gros-œuvre / Maçonnerie',           'Alvenaria / Obra bruta',           '4312A', 'both',        1),
  ('facadier',             'Façadier / Ravalement',              'Fachadas / Reboco',                 '4391A', 'both',        2),
  ('ferronnerie',          'Ferronnerie / Métallerie',           'Serralharia / Metalurgia',          '4399C', 'both',        3),
  ('charpente',            'Charpente (bois/métal)',             'Carpintaria estrutural',            '4399A', 'both',        4),
  ('couverture',           'Couverture / Zinguerie',             'Coberturas / Telhados',             '4391A', 'both',        5),
  ('etancheite',           'Étanchéité',                         'Impermeabilização',                 '4391B', 'both',        6),
  ('isolation',            'Isolation thermique / acoustique',   'Isolamento térmico / acústico',     '4329A', 'both',        7),
  ('platrerie',            'Plâtrerie / Staff',                  'Estuques / Gesso',                  '4331Z', 'both',        8),
  ('carrelage',            'Carrelage / Faïence',                'Azulejos / Pavimentos',             '4333Z', 'both',        9),
  ('peinture',             'Peinture intérieure/extérieure',     'Pintura',                           '4334Z', 'both',       10),
  ('menuiserie-bois',      'Menuiserie bois',                    'Carpintaria madeira',               '4332A', 'both',       11),
  ('menuiserie-alu-pvc',   'Menuiserie alu/PVC',                 'Caixilharia alu/PVC',              '4332A', 'both',       12),
  ('serrurerie',           'Serrurerie / Sécurité',              'Serralharia / Segurança',           '4399C', 'artisan',    13),
  ('electricite',          'Électricité',                        'Eletricidade',                      '4321A', 'both',       14),
  ('plomberie',            'Plomberie / Sanitaire',              'Canalização / Sanitários',          '4322A', 'both',       15),
  ('chauffage',            'Chauffage / Climatisation',          'Aquecimento / Climatização',        '4322B', 'both',       16),
  ('vrd',                  'VRD / Terrassement',                 'VRD / Terraplenagem',               '4312B', 'societe_btp', 17),
  ('demolition',           'Démolition',                         'Demolição',                         '4311Z', 'societe_btp', 18),
  ('paysagisme',           'Paysagisme / Espaces verts',         'Paisagismo / Espaços verdes',       '8130Z', 'both',       19),
  ('renovation-generale',  'Rénovation générale / TCE',          'Remodelação geral',                 '4120A', 'both',       20),
  ('nettoyage',            'Nettoyage industriel',               'Limpeza industrial',                '8122Z', 'both',       21),
  ('debouchage',           'Débouchage / Assainissement',        'Desentupimento / Saneamento',       '4322A', 'artisan',    22),
  ('piscine',              'Piscine / Spa',                      'Piscinas / Spa',                    '4329B', 'artisan',    23),
  ('espaces-verts',        'Espaces verts / Jardinage',          'Jardinagem',                        '8130Z', 'artisan',    24),
  ('ramonage',             'Ramonage / Entretien',               'Limpeza de chaminés',               '8122Z', 'artisan',    25),
  ('demenagement',         'Déménagement',                       'Mudanças',                          '4942Z', 'artisan',    26)
ON CONFLICT (slug) DO NOTHING;
