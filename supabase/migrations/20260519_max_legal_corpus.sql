-- ══════════════════════════════════════════════════════════════════════════════
-- Migration — Corpus juridique Max (Plan H — RAG legal corpus)
-- Date: 2026-05-19
-- ══════════════════════════════════════════════════════════════════════════════
-- Deux tables isolées par locale (FR / PT) — Max FR ne lit JAMAIS la table PT,
-- et inversement. Recherche full-text via tsvector (pas pgvector — corpus petit,
-- pas de coûts d'embeddings).
--
-- Lecture publique pour utilisateurs authentifiés (texte de loi, pas de PII).
-- Aucune policy d'écriture → seul le service_role peut insérer/updater via
-- les scripts de seed/ingestion.

-- ── Table FR (Loi 10/07/1965, décrets, ALUR, ELAN, etc.) ─────────────────────
CREATE TABLE IF NOT EXISTS syndic_legal_corpus_fr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,                         -- "Loi 10/07/1965", "Décret 17/03/1967", "Loi ALUR"
  article text NOT NULL,                        -- "Art. 25", "Art. 14-2", "Art. 9"
  title text NOT NULL,                          -- label court humain
  content text NOT NULL,                        -- corps de l'article (max ~2000 chars)
  theme text,                                   -- "AG", "charges", "travaux", "impayés", "fonds-travaux"
  language text NOT NULL DEFAULT 'fr' CHECK (language = 'fr'),
  created_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('french', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(theme, ''))
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_legal_corpus_fr_search ON syndic_legal_corpus_fr USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_legal_corpus_fr_theme ON syndic_legal_corpus_fr (language, theme);
CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_corpus_fr_ref ON syndic_legal_corpus_fr (source, article);

-- ── Table PT (Código Civil, Lei 8/2022, DL 268/94, etc.) ─────────────────────
CREATE TABLE IF NOT EXISTS syndic_legal_corpus_pt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,                         -- "Código Civil", "Lei 8/2022", "DL 268/94"
  article text NOT NULL,                        -- "Art. 1424.º", "Art. 6.º", "Art. 4.º"
  title text NOT NULL,
  content text NOT NULL,
  theme text,
  language text NOT NULL DEFAULT 'pt' CHECK (language = 'pt'),
  created_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(theme, ''))
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_legal_corpus_pt_search ON syndic_legal_corpus_pt USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_legal_corpus_pt_theme ON syndic_legal_corpus_pt (language, theme);
CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_corpus_pt_ref ON syndic_legal_corpus_pt (source, article);

-- ── RLS — lecture pour utilisateurs authentifiés, écriture service_role uniquement ─
ALTER TABLE syndic_legal_corpus_fr ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_legal_corpus_pt ENABLE ROW LEVEL SECURITY;

CREATE POLICY legal_corpus_fr_read ON syndic_legal_corpus_fr
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY legal_corpus_pt_read ON syndic_legal_corpus_pt
  FOR SELECT
  TO authenticated
  USING (true);

-- Aucune policy INSERT/UPDATE/DELETE → seul service_role peut écrire.

-- ── Seed initial (8 entrées : 4 FR + 4 PT) ───────────────────────────────────
INSERT INTO syndic_legal_corpus_fr (source, article, title, content, theme) VALUES
  (
    'Loi 10/07/1965',
    'Art. 17',
    'Désignation et révocation du syndic',
    'Le syndic, professionnel ou non, est désigné par l''assemblée générale à la majorité de l''article 25 (majorité absolue des voix de tous les copropriétaires). Son mandat ne peut excéder trois ans, renouvelable. Il peut être révoqué dans les mêmes conditions de majorité. À défaut de désignation, le président du tribunal judiciaire peut, sur requête, désigner un administrateur provisoire.',
    'syndic'
  ),
  (
    'Loi 10/07/1965',
    'Art. 19',
    'Recouvrement des charges et privilège immobilier spécial',
    'Le syndicat des copropriétaires dispose d''un privilège immobilier spécial pour le paiement des charges et travaux. Après mise en demeure restée infructueuse plus de 30 jours, le syndic peut engager le recouvrement par toute voie de droit. Une provision sur charges devient exigible dès le premier jour du trimestre concerné. Les frais nécessaires au recouvrement (mise en demeure, lettre AR, commandement) sont imputables au copropriétaire défaillant.',
    'impayés'
  ),
  (
    'Loi 10/07/1965',
    'Art. 14-2',
    'Fonds de travaux obligatoire (loi ALUR)',
    'Dans les immeubles à destination totale ou partielle d''habitation, le syndicat constitue un fonds de travaux destiné à faire face aux dépenses de travaux futurs. La cotisation annuelle au fonds ne peut être inférieure à 5 % du budget prévisionnel. Le fonds est alimenté par une cotisation versée par chaque copropriétaire selon sa quote-part de charges générales. Les sommes versées sont attachées aux lots et ne sont pas remboursables en cas de vente.',
    'fonds-travaux'
  ),
  (
    'Décret 17/03/1967',
    'Art. 9',
    'Convocation de l''assemblée générale — délai et forme',
    'La convocation à l''assemblée générale est notifiée par lettre recommandée avec avis de réception, ou par voie électronique avec l''accord exprès du copropriétaire, au moins 21 jours avant la date de l''assemblée. Elle contient l''ordre du jour, lequel est arrêté par le syndic. Les documents nécessaires à la prise de décision (devis, projets, contrats) sont annexés ou tenus à la disposition des copropriétaires.',
    'AG'
  )
ON CONFLICT (source, article) DO NOTHING;

INSERT INTO syndic_legal_corpus_pt (source, article, title, content, theme) VALUES
  (
    'Código Civil',
    'Art. 1424.º',
    'Despesas comuns do condomínio',
    'As despesas necessárias à conservação e fruição das partes comuns do edifício, bem como ao pagamento de serviços de interesse comum, são pagas pelos condóminos na proporção do valor das suas frações, salvo disposição em contrário do título constitutivo ou da assembleia. As despesas relativas a partes que sirvam exclusivamente alguns condóminos são suportadas apenas por estes, na proporção do respetivo uso.',
    'despesas'
  ),
  (
    'Código Civil',
    'Art. 1430.º',
    'Assembleia de condóminos — competência e maiorias',
    'A administração das partes comuns do edifício compete à assembleia dos condóminos e a um administrador. As deliberações são tomadas, em regra, por maioria dos votos representativos do capital investido, salvo se a lei ou o título constitutivo exigir maioria qualificada. As inovações que envolvam alteração estrutural exigem aprovação por dois terços do capital investido.',
    'AG'
  ),
  (
    'Lei 8/2022',
    'Art. 6.º',
    'Funções e responsabilidades do administrador de condomínio',
    'Compete ao administrador convocar as assembleias, executar as suas deliberações, cobrar as quotas, pagar as despesas comuns, prestar contas anuais, contratar e fiscalizar os serviços necessários à conservação do edifício, e representar o condomínio em juízo e fora dele. O mandato é de um ano, renovável. O administrador responde civilmente perante os condóminos pelos prejuízos causados por dolo ou negligência grave.',
    'administrador'
  ),
  (
    'DL 268/94',
    'Art. 4.º',
    'Fundo comum de reserva — obrigatoriedade e percentagem mínima',
    'É obrigatória a constituição de um fundo comum de reserva destinado a custear despesas de conservação do edifício. Cada condómino contribui mensalmente para o fundo com pelo menos 10 % da sua quotização ordinária para as despesas correntes. O fundo é gerido pelo administrador em conta bancária autónoma e só pode ser utilizado mediante deliberação da assembleia.',
    'fundo-reserva'
  )
ON CONFLICT (source, article) DO NOTHING;
