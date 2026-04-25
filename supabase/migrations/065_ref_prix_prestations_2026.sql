-- Migration 065 — Base prix prestations BTP 2026
-- 28 corps de métier × ~6 prestations = ~168 entries
-- Sources : moyennes marché Capeb/FFB 2026 (indicatif national)

CREATE TABLE IF NOT EXISTS ref_prix_prestations_2026 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corps_metier TEXT NOT NULL,
  prestation TEXT NOT NULL,
  unite TEXT NOT NULL,
  prix_min NUMERIC(10,2) NOT NULL,
  prix_moyen NUMERIC(10,2) NOT NULL,
  prix_max NUMERIC(10,2) NOT NULL,
  region TEXT DEFAULT 'national',
  source TEXT DEFAULT 'Capeb/FFB 2026',
  annee INTEGER DEFAULT 2026,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (corps_metier, prestation, region)
);

CREATE INDEX IF NOT EXISTS idx_ref_prix_corps_metier ON ref_prix_prestations_2026(corps_metier);
CREATE INDEX IF NOT EXISTS idx_ref_prix_prestation ON ref_prix_prestations_2026(prestation);

ALTER TABLE ref_prix_prestations_2026 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ref_prix_read" ON ref_prix_prestations_2026;
CREATE POLICY "ref_prix_read" ON ref_prix_prestations_2026
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seed initial : prestations courantes par corps de métier (prix moyens marché 2026)
INSERT INTO ref_prix_prestations_2026 (corps_metier, prestation, unite, prix_min, prix_moyen, prix_max) VALUES
-- plomberie
('plomberie', 'Pose lavabo standard', 'u', 120, 180, 280),
('plomberie', 'Pose WC suspendu', 'u', 250, 350, 500),
('plomberie', 'Remplacement chaudière gaz', 'u', 2500, 3500, 5000),
('plomberie', 'Recherche fuite', 'forfait', 200, 350, 600),
('plomberie', 'Pose robinetterie mitigeur', 'u', 70, 120, 200),
('plomberie', 'Détartrage chaudière', 'forfait', 120, 180, 280),
-- electricite
('electricite', 'Pose prise électrique', 'u', 70, 110, 180),
('electricite', 'Pose interrupteur', 'u', 60, 90, 150),
('electricite', 'Tableau électrique complet', 'u', 1500, 2500, 4000),
('electricite', 'Mise aux normes électriques', 'logement', 2500, 4000, 6500),
('electricite', 'Câblage pièce 15m²', 'pièce', 250, 400, 650),
('electricite', 'Pose VMC simple flux', 'u', 600, 900, 1400),
-- serrurerie
('serrurerie', 'Changement serrure standard', 'u', 120, 220, 380),
('serrurerie', 'Pose porte blindée A2P', 'u', 1500, 2500, 4000),
('serrurerie', 'Dépannage urgence porte claquée', 'forfait', 100, 180, 300),
('serrurerie', 'Pose cylindre haute sécurité', 'u', 80, 150, 280),
('serrurerie', 'Verrou multipoints', 'u', 250, 400, 650),
('serrurerie', 'Ouverture porte sans clé', 'forfait', 80, 150, 280),
-- chauffage
('chauffage', 'Pose pompe à chaleur air/eau', 'u', 8000, 12000, 18000),
('chauffage', 'Pose radiateur électrique', 'u', 200, 350, 550),
('chauffage', 'Désembouage circuit chauffage', 'logement', 500, 900, 1500),
('chauffage', 'Pose plancher chauffant', 'm²', 60, 90, 140),
('chauffage', 'Entretien annuel chaudière', 'forfait', 100, 150, 220),
('chauffage', 'Pose poêle à granulés', 'u', 3000, 4500, 6500),
-- peinture
('peinture', 'Peinture murs intérieurs (2 couches)', 'm²', 22, 35, 55),
('peinture', 'Peinture plafond (2 couches)', 'm²', 28, 40, 60),
('peinture', 'Peinture boiserie/plinthes', 'ml', 28, 45, 70),
('peinture', 'Pose enduit lissage', 'm²', 12, 20, 35),
('peinture', 'Décollage papier peint', 'm²', 6, 10, 18),
('peinture', 'Peinture façade extérieure', 'm²', 35, 55, 90),
-- maconnerie
('maconnerie', 'Mur en parpaing 20cm', 'm²', 60, 95, 140),
('maconnerie', 'Dalle béton armé 15cm', 'm²', 70, 110, 170),
('maconnerie', 'Linteau béton', 'u', 280, 450, 750),
('maconnerie', 'Ouverture mur porteur (avec IPN)', 'u', 1500, 2800, 5000),
('maconnerie', 'Chape liquide', 'm²', 30, 45, 70),
('maconnerie', 'Démolition cloison non porteuse', 'm²', 18, 30, 50),
-- menuiserie
('menuiserie', 'Pose porte intérieure standard', 'u', 200, 350, 550),
('menuiserie', 'Pose fenêtre PVC double vitrage', 'u', 500, 950, 1500),
('menuiserie', 'Pose escalier bois', 'u', 1800, 3000, 5000),
('menuiserie', 'Pose porte d''entrée', 'u', 800, 1500, 2800),
('menuiserie', 'Pose volets battants bois', 'paire', 350, 600, 1000),
('menuiserie', 'Pose parquet flottant', 'm²', 25, 40, 65),
-- toiture
('toiture', 'Réfection couverture tuile', 'm²', 70, 120, 180),
('toiture', 'Étanchéité toiture terrasse', 'm²', 50, 90, 140),
('toiture', 'Démoussage toiture', 'm²', 6, 10, 18),
('toiture', 'Pose gouttière zinc', 'ml', 50, 80, 130),
('toiture', 'Isolation combles soufflage', 'm²', 18, 30, 50),
('toiture', 'Réparation fuite toiture', 'forfait', 250, 450, 800),
-- climatisation
('climatisation', 'Pose climatisation split mono', 'u', 1200, 1800, 2800),
('climatisation', 'Pose multi-split 3 unités', 'u', 3000, 4500, 6500),
('climatisation', 'Entretien annuel climatisation', 'forfait', 100, 150, 220),
('climatisation', 'Recharge gaz climatisation', 'forfait', 150, 220, 350),
('climatisation', 'Désinstallation/déplacement clim', 'u', 250, 400, 650),
('climatisation', 'Pose climatisation gainable', 'u', 5000, 7500, 12000),
-- demenagement
('demenagement', 'Déménagement studio (20m³)', 'forfait', 400, 700, 1200),
('demenagement', 'Déménagement T2 (35m³)', 'forfait', 700, 1200, 2000),
('demenagement', 'Déménagement T3 (50m³)', 'forfait', 1200, 1800, 3000),
('demenagement', 'Déménagement T4+ (75m³)', 'forfait', 1800, 2800, 4500),
('demenagement', 'Garde-meubles (m³/mois)', 'm³', 15, 25, 40),
('demenagement', 'Monte-meubles', 'h', 80, 130, 220),
-- renovation
('renovation', 'Rénovation appartement complète', 'm²', 700, 1200, 2000),
('renovation', 'Rénovation salle de bain complète', 'u', 6000, 9500, 15000),
('renovation', 'Rénovation cuisine complète', 'u', 8000, 13000, 22000),
('renovation', 'Rafraîchissement appartement', 'm²', 200, 350, 550),
('renovation', 'Rénovation énergétique', 'm²', 400, 700, 1200),
('renovation', 'Coordination travaux (maîtrise œuvre)', 'mois', 1500, 2500, 4500),
-- vitrerie
('vitrerie', 'Remplacement vitre simple', 'm²', 60, 110, 200),
('vitrerie', 'Pose double vitrage', 'm²', 200, 350, 550),
('vitrerie', 'Pose miroir mural', 'm²', 80, 130, 220),
('vitrerie', 'Pose verrière intérieure', 'm²', 350, 550, 900),
('vitrerie', 'Vitrage anti-effraction', 'm²', 280, 450, 750),
('vitrerie', 'Remplacement double vitrage cassé', 'u', 250, 450, 800),
-- petits-travaux
('petits-travaux', 'Heure main d''œuvre standard', 'h', 30, 45, 65),
('petits-travaux', 'Pose étagère murale', 'u', 35, 60, 110),
('petits-travaux', 'Montage meuble en kit', 'h', 30, 50, 80),
('petits-travaux', 'Fixation TV murale', 'u', 50, 100, 180),
('petits-travaux', 'Pose tringle à rideaux', 'u', 25, 50, 90),
('petits-travaux', 'Petite réparation diverse', 'h', 35, 55, 85),
-- espaces-verts
('espaces-verts', 'Tonte gazon (à l''heure)', 'h', 25, 45, 70),
('espaces-verts', 'Élagage arbre moyen', 'u', 80, 180, 400),
('espaces-verts', 'Évacuation déchets verts', 'm³', 60, 100, 180),
('espaces-verts', 'Création pelouse semis', 'm²', 8, 15, 28),
('espaces-verts', 'Taille haie (à l''heure)', 'h', 30, 50, 80),
('espaces-verts', 'Plantation arbuste', 'u', 40, 80, 150),
-- nettoyage
('nettoyage', 'Ménage régulier domicile', 'h', 22, 32, 45),
('nettoyage', 'Grand nettoyage de printemps', 'm²', 5, 8, 14),
('nettoyage', 'Nettoyage vitres (intérieur+extérieur)', 'm²', 4, 7, 12),
('nettoyage', 'Nettoyage moquettes', 'm²', 3, 6, 12),
('nettoyage', 'Désinfection appartement', 'm²', 6, 10, 18),
('nettoyage', 'Nettoyage tomettes anciennes', 'm²', 8, 14, 25),
-- traitement-nuisibles
('traitement-nuisibles', 'Désinsectisation cafards', 'forfait', 120, 250, 450),
('traitement-nuisibles', 'Dératisation', 'forfait', 180, 350, 600),
('traitement-nuisibles', 'Traitement punaises de lit', 'logement', 350, 600, 1200),
('traitement-nuisibles', 'Traitement frelons asiatiques', 'nid', 80, 150, 300),
('traitement-nuisibles', 'Désinfection complète logement', 'm²', 6, 12, 22),
('traitement-nuisibles', 'Suivi anti-nuisibles annuel', 'visite', 100, 180, 320),
-- amenagement-exterieur
('amenagement-exterieur', 'Pose terrasse bois', 'm²', 90, 160, 250),
('amenagement-exterieur', 'Pose terrasse carrelage extérieur', 'm²', 70, 120, 200),
('amenagement-exterieur', 'Pose pavage', 'm²', 55, 95, 160),
('amenagement-exterieur', 'Pose clôture rigide', 'ml', 60, 110, 200),
('amenagement-exterieur', 'Pose portail motorisé', 'u', 1500, 2800, 5000),
('amenagement-exterieur', 'Aménagement allée gravier', 'm²', 25, 45, 80),
-- carrelage
('carrelage', 'Pose carrelage sol', 'm²', 35, 60, 100),
('carrelage', 'Pose carrelage mural salle de bain', 'm²', 40, 70, 110),
('carrelage', 'Pose faïence cuisine', 'm²', 38, 65, 100),
('carrelage', 'Joints carrelage refait', 'm²', 18, 30, 50),
('carrelage', 'Dépose ancien carrelage', 'm²', 18, 30, 50),
('carrelage', 'Pose mosaïque', 'm²', 80, 130, 220),
-- diagnostic
('diagnostic', 'DPE (Diagnostic Performance Énergétique)', 'forfait', 80, 150, 250),
('diagnostic', 'Diagnostic amiante', 'forfait', 80, 150, 280),
('diagnostic', 'Diagnostic plomb', 'forfait', 80, 150, 280),
('diagnostic', 'Diagnostic électrique', 'forfait', 70, 130, 220),
('diagnostic', 'Diagnostic gaz', 'forfait', 70, 130, 220),
('diagnostic', 'Diagnostic complet vente', 'forfait', 350, 600, 950),
-- nettoyage-travaux
('nettoyage-travaux', 'Nettoyage fin de chantier', 'm²', 6, 12, 22),
('nettoyage-travaux', 'Évacuation gravats', 'm³', 80, 150, 250),
('nettoyage-travaux', 'Dépoussiérage complet', 'm²', 4, 8, 15),
('nettoyage-travaux', 'Nettoyage façade après ravalement', 'm²', 8, 15, 28),
('nettoyage-travaux', 'Nettoyage vitres après chantier', 'm²', 5, 10, 18),
('nettoyage-travaux', 'Décapage sol post-chantier', 'm²', 8, 14, 25),
-- nettoyage-copro
('nettoyage-copro', 'Forfait mensuel cage d''escalier', 'mois', 80, 180, 350),
('nettoyage-copro', 'Forfait mensuel hall + ascenseur', 'mois', 120, 250, 500),
('nettoyage-copro', 'Sortie containers ordures', 'mois', 50, 120, 250),
('nettoyage-copro', 'Lavage vitres parties communes', 'forfait', 80, 180, 350),
('nettoyage-copro', 'Nettoyage parking souterrain', 'm²', 1, 2.5, 5),
('nettoyage-copro', 'Lustrage marbre/granito', 'm²', 8, 15, 28),
-- nettoyage-industriel
('nettoyage-industriel', 'Nettoyage bureaux (h)', 'h', 22, 32, 48),
('nettoyage-industriel', 'Nettoyage cuisine pro', 'h', 28, 42, 65),
('nettoyage-industriel', 'Nettoyage sanitaires industriels', 'h', 25, 38, 55),
('nettoyage-industriel', 'Décapage sol industriel', 'm²', 4, 8, 14),
('nettoyage-industriel', 'Forfait mensuel bureaux', 'mois', 200, 600, 1500),
('nettoyage-industriel', 'Nettoyage cryogénique machines', 'h', 80, 130, 220),
-- plaquiste
('plaquiste', 'Cloison BA13 simple', 'm²', 32, 48, 70),
('plaquiste', 'Cloison BA13 double avec isolation', 'm²', 45, 65, 95),
('plaquiste', 'Doublage thermique BA13+laine', 'm²', 38, 55, 80),
('plaquiste', 'Faux plafond standard', 'm²', 45, 70, 100),
('plaquiste', 'Faux plafond acoustique', 'm²', 65, 95, 140),
('plaquiste', 'Habillage poteau/poutre', 'ml', 40, 65, 100),
-- piscine
('piscine', 'Construction piscine 4x8m enterrée', 'u', 22000, 35000, 55000),
('piscine', 'Construction piscine coque polyester', 'u', 12000, 20000, 32000),
('piscine', 'Entretien hebdomadaire (passage)', 'visite', 60, 100, 180),
('piscine', 'Hivernage piscine', 'forfait', 200, 380, 600),
('piscine', 'Mise en service annuelle', 'forfait', 200, 380, 600),
('piscine', 'Réparation liner piscine', 'm²', 60, 110, 200),
-- ramonage
('ramonage', 'Ramonage cheminée', 'forfait', 60, 110, 180),
('ramonage', 'Ramonage poêle à granulés', 'forfait', 70, 130, 220),
('ramonage', 'Tubage cheminée', 'ml', 80, 130, 220),
('ramonage', 'Débistrage cheminée', 'forfait', 280, 480, 800),
('ramonage', 'Pose chapeau cheminée', 'u', 150, 280, 500),
('ramonage', 'Inspection caméra conduit', 'forfait', 80, 150, 280),
-- store-banne
('store-banne', 'Pose store banne 3m manuel', 'u', 600, 1100, 1800),
('store-banne', 'Pose store banne 4m motorisé', 'u', 1200, 2000, 3500),
('store-banne', 'Pose store banne 5m+ motorisé', 'u', 1800, 3000, 5500),
('store-banne', 'Réparation toile store banne', 'forfait', 150, 350, 700),
('store-banne', 'Remplacement toile (m²)', 'm²', 80, 150, 280),
('store-banne', 'Motorisation store existant', 'u', 350, 650, 1200),
-- debouchage
('debouchage', 'Débouchage évier/lavabo', 'forfait', 80, 150, 280),
('debouchage', 'Débouchage WC', 'forfait', 100, 180, 320),
('debouchage', 'Débouchage canalisation principale', 'forfait', 200, 380, 700),
('debouchage', 'Débouchage urgence 24h/7j', 'forfait', 250, 480, 850),
('debouchage', 'Hydrocurage haute pression', 'forfait', 350, 600, 1100),
('debouchage', 'Inspection caméra canalisation', 'forfait', 150, 280, 500),
-- metallerie
('metallerie', 'Pose garde-corps acier', 'ml', 200, 380, 650),
('metallerie', 'Pose portail métallique sur mesure', 'u', 1500, 2800, 5500),
('metallerie', 'Pose escalier métallique extérieur', 'u', 1800, 3500, 6500),
('metallerie', 'Pose grille de sécurité fenêtre', 'u', 250, 480, 850),
('metallerie', 'Soudure réparation', 'h', 50, 80, 130),
('metallerie', 'Marquise métallique sur mesure', 'u', 800, 1500, 2800)
ON CONFLICT (corps_metier, prestation, region) DO NOTHING;
