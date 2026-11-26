/**
 * Ancien catalogue d'exemple du module Prestations BTP : 31 prestations et 9 matériaux, en français, écrits
 * automatiquement dans le catalogue des sociétés jusqu'au 17/11/2026, puis retirés par la PR #718 (catalogue vierge à
 * la création du compte). Il a été enregistré sous deux formes :
 *  - par le module Prestations (clé `fixit_prestations_btp_v5_<fiche>`) : étapes chiffrées (prix et unité calculés) ;
 *  - par le formulaire de devis (ancienne clé `fixit_prestations_btp_v4_<fiche>`) : étapes sans prix ni unité.
 * Identifiants 1 à 40, dans l'ordre ci-dessous. Contenu repris tel quel de components/dashboard/PrestationsBTPSection.tsx
 * avant #718 (inchangé depuis le 30/04/2026).
 *
 * Gardé SEULEMENT pour reconnaître les éléments jamais modifiés et les retirer à la demande de la société (bouton
 * « Retirer l'exemple » du module, accord de Frédéric du 20/11/2026). Rien ici n'est écrit ni proposé à un compte.
 */

interface EtapeExemple { label: string; price?: number; unit?: string }

interface ElementExemple {
  name: string
  description?: string
  type: 'prest' | 'mat'
  lot: string
  unit: string
  price: { min: number; max: number }
  priceAchat?: { min: number; max: number }
  ref?: string
  supplier?: string
  etapes?: EtapeExemple[]
}

/** Élément tel qu'enregistré dans un catalogue, avec son identifiant. */
export type ElementExempleEnregistre = ElementExemple & { id: number }

const PRESTATIONS: readonly ElementExemple[] = [
  // ── Gros Œuvre / Démolition ─────────────────────────────────────────────
  { name: 'Démolition cloisons + évacuation gravats', description: 'Démolition complète des cloisons intérieures, tri sélectif et transport des gravats vers déchèterie agréée.', type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 2500, max: 4000 },
    etapes: [{ label: 'Protection des sols et du mobilier voisin' }, { label: 'Démolition mécanique des cloisons' }, { label: 'Tri et évacuation des gravats en déchèterie agréée' }] },
  { name: 'Terrassement + fondations', description: 'Travaux de terrassement mécanique selon plans, coulage des semelles et semelles filantes en béton armé.', type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 8500, max: 11000 },
    etapes: [{ label: 'Terrassement à la pelle mécanique selon plan' }, { label: 'Coulage des semelles béton armé' }, { label: 'Mise en place chaînage et reprise en élévation' }] },
  { name: 'Élévation murs parpaing', description: 'Construction de murs en parpaings de 20 cm, montés au mortier bâtard avec chaînages verticaux et linteaux béton.', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: { min: 170, max: 220 },
    etapes: [{ label: 'Implantation et traçage des murs' }, { label: 'Montage des parpaings au mortier bâtard' }, { label: 'Réalisation des chaînages verticaux et linteaux' }] },
  { name: 'Dalle béton', description: 'Réalisation d\'une dalle béton sur hérisson, film polyane et treillis soudé, dosage 350 kg/m³.', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: { min: 65, max: 85 },
    etapes: [{ label: 'Préparation hérisson + film polyane + treillis soudé' }, { label: 'Coulage béton dosé à 350 kg/m³' }, { label: 'Talochage et lissage de la surface' }] },
  { name: 'Dépose sanitaires existants', description: 'Dépose complète des sanitaires existants (vasques, WC, douche, baignoire) avec coupure des réseaux et bouchonnage.', type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 1200, max: 1800 },
    etapes: [{ label: 'Coupure eau et électricité de la zone' }, { label: 'Dépose vasques, WC, douche et baignoire' }, { label: 'Bouchonnage des arrivées et évacuations' }] },
  { name: 'Placo BA13, fourniture et pose', description: 'Fourniture et pose de plaques de plâtre BA13 sur ossature métallique, bandes calicot et enduit de finition.', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: { min: 45, max: 58 },
    etapes: [{ label: 'Pose des rails et montants métalliques' }, { label: 'Vissage des plaques BA13 sur ossature' }, { label: 'Bandes, enduits et ponçage de finition' }] },
  { name: 'Faux plafond acoustique', description: 'Pose d\'un faux plafond suspendu avec isolant acoustique et dalles décoratives, ossature métallique.', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: { min: 55, max: 70 },
    etapes: [{ label: 'Pose de l\'ossature métallique suspendue' }, { label: 'Mise en place de l\'isolant acoustique' }, { label: 'Pose des dalles acoustiques décoratives' }] },

  // ── Couverture / Charpente ──────────────────────────────────────────────
  { name: 'Charpente + couverture tuiles', description: 'Pose de la charpente traditionnelle ou fermettes industrielles, écran sous toiture et couverture en tuiles.', type: 'prest', lot: 'couverture', unit: 'm²', price: { min: 150, max: 200 },
    etapes: [{ label: 'Pose de la charpente traditionnelle ou fermettes' }, { label: 'Mise en place liteaux et écran sous toiture' }, { label: 'Pose des tuiles et accessoires de faîtage' }] },
  { name: 'Zinguerie gouttières + EP', description: 'Pose complète des gouttières zinc, chêneaux et descentes d\'eaux pluviales avec raccordement au réseau.', type: 'prest', lot: 'couverture', unit: 'ml', price: { min: 45, max: 65 },
    etapes: [{ label: 'Pose des crochets et chêneaux zinc' }, { label: 'Mise en place des gouttières et soudures' }, { label: 'Raccordement des descentes EP au réseau' }] },

  // ── Plomberie / CVC ─────────────────────────────────────────────────────
  { name: 'Plomberie SDB + cuisine', description: 'Création complète des réseaux d\'alimentation et d\'évacuation pour salle de bains et cuisine.', type: 'prest', lot: 'plomberie', unit: 'forfait', price: { min: 4200, max: 5500 },
    etapes: [{ label: 'Tracé et pose des réseaux PER eau chaude et froide' }, { label: 'Pose des évacuations PVC sous pente' }, { label: 'Raccordement, mise en eau et test d\'étanchéité' }] },
  { name: 'Plomberie complète logement', description: 'Installation plomberie intégrale du logement : nourrice, distribution, alimentation et évacuations.', type: 'prest', lot: 'plomberie', unit: 'forfait', price: { min: 3000, max: 4000 },
    etapes: [{ label: 'Création de la nourrice et distribution générale' }, { label: 'Pose des réseaux EF et EC vers tous points de puisage' }, { label: 'Pose des évacuations et essais d\'étanchéité' }] },
  { name: 'Plomberie sanitaires local commercial', description: 'Installation sanitaire conforme aux normes ERP pour local commercial : WC, lave-mains, chauffe-eau.', type: 'prest', lot: 'plomberie', unit: 'forfait', price: { min: 5500, max: 7000 },
    etapes: [{ label: 'Étude et tracé des réseaux selon normes ERP' }, { label: 'Pose des alimentations et évacuations PVC' }, { label: 'Raccordement WC, lave-mains et chauffe-eau' }] },
  { name: 'Douche italienne + paroi', description: 'Création d\'une douche à l\'italienne avec receveur extra-plat, étanchéité, carrelage et paroi vitrée.', type: 'prest', lot: 'plomberie', unit: 'u', price: { min: 2200, max: 2800 },
    etapes: [{ label: 'Création du receveur extra-plat avec pente' }, { label: 'Étanchéité SPEC et pose du carrelage' }, { label: 'Installation de la paroi verre et de la robinetterie' }] },
  { name: 'Meuble vasque + miroir', description: 'Fourniture et pose d\'un meuble vasque suspendu avec plan vasque, robinetterie et miroir éclairant.', type: 'prest', lot: 'plomberie', unit: 'u', price: { min: 900, max: 1500 },
    etapes: [{ label: 'Repérage et pose des fixations murales' }, { label: 'Installation du meuble et du plan vasque' }, { label: 'Raccordement plomberie et pose du miroir' }] },

  // ── Électricité ─────────────────────────────────────────────────────────
  { name: 'Mise aux normes électrique NFC 15-100', description: 'Mise en conformité complète de l\'installation électrique selon la norme NFC 15-100, avec attestation Consuel.', type: 'prest', lot: 'electricite', unit: 'forfait', price: { min: 5000, max: 8500 },
    etapes: [{ label: 'Diagnostic de l\'installation existante' }, { label: 'Remplacement du tableau et création des circuits dédiés' }, { label: 'Mise à la terre et attestation de conformité Consuel' }] },
  { name: 'Électricité + plomberie extension', description: 'Création des réseaux électriques et plomberie pour une extension de bâtiment, raccordement au tableau existant.', type: 'prest', lot: 'electricite', unit: 'forfait', price: { min: 6500, max: 8000 },
    etapes: [{ label: 'Création des circuits dédiés à l\'extension' }, { label: 'Pose des réseaux PER et évacuations' }, { label: 'Raccordement au tableau et mise en service' }] },

  // ── Menuiseries ─────────────────────────────────────────────────────────
  { name: 'Menuiserie alu RPT (par pièce)', description: 'Dépose de l\'existant et pose de menuiseries aluminium à rupture de pont thermique, calfeutrement et joints.', type: 'prest', lot: 'menuiseries', unit: 'u', price: { min: 1100, max: 1600 },
    etapes: [{ label: 'Prise de cotes et dépose de l\'existant' }, { label: 'Pose dormant + ouvrant alu rupture pont thermique' }, { label: 'Calfeutrement, réglage et joints d\'étanchéité' }] },
  { name: 'Vitrine commerciale alu', description: 'Dépose et remplacement de la vitrine commerciale en aluminium RPT avec vitrage feuilleté de sécurité.', type: 'prest', lot: 'menuiseries', unit: 'forfait', price: { min: 9000, max: 12000 },
    etapes: [{ label: 'Dépose de la vitrine existante et mise en sécurité' }, { label: 'Pose châssis alu RPT + vitrage feuilleté' }, { label: 'Habillage tôle, joints et serrurerie' }] },

  // ── Peinture / Revêtements ──────────────────────────────────────────────
  { name: 'Peinture 2 couches intérieure', description: 'Préparation des supports, sous-couche d\'accroche et application de 2 couches de peinture acrylique de finition.', type: 'prest', lot: 'peinture', unit: 'm²', price: { min: 28, max: 35 },
    etapes: [{ label: 'Préparation des supports (rebouchage, ponçage)' }, { label: 'Application d\'une sous-couche d\'accroche' }, { label: 'Application des 2 couches de finition acrylique' }] },
  { name: 'Peinture façade 2 couches', description: 'Nettoyage de la façade, traitement fongicide, fixateur de fond et 2 couches de peinture extérieure.', type: 'prest', lot: 'peinture', unit: 'm²', price: { min: 25, max: 32 },
    etapes: [{ label: 'Nettoyage haute pression et traitement fongicide' }, { label: 'Application d\'un fixateur de fond' }, { label: 'Application des 2 couches pliolite ou siloxane' }] },
  { name: 'Enduit monocouche façade', description: 'Projection mécanique d\'un enduit monocouche sur façade préparée, finition grattée ou écrasée.', type: 'prest', lot: 'peinture', unit: 'm²', price: { min: 42, max: 52 },
    etapes: [{ label: 'Préparation du support et humidification' }, { label: 'Projection mécanique de l\'enduit monocouche' }, { label: 'Talochage et finition grattée ou écrasée' }] },
  { name: 'Nettoyage HP façade', description: 'Nettoyage haute pression à l\'eau chaude de la façade avec traitement anti-mousses préventif.', type: 'prest', lot: 'peinture', unit: 'm²', price: { min: 12, max: 18 },
    etapes: [{ label: 'Protection des huisseries et des abords' }, { label: 'Nettoyage haute pression à l\'eau chaude' }, { label: 'Rinçage et application d\'un traitement anti-mousses' }] },
  { name: 'Carrelage sol SDB', description: 'Ragréage du support et pose de carrelage au sol de la salle de bains avec joints et silicone périphérique.', type: 'prest', lot: 'peinture', unit: 'm²', price: { min: 90, max: 115 },
    etapes: [{ label: 'Préparation et ragréage du support' }, { label: 'Pose du carrelage à la colle avec calepinage' }, { label: 'Joints, nettoyage et silicone périphérique' }] },
  { name: 'Faïence murale', description: 'Pose de faïence murale sur support préparé, primaire d\'accrochage, croisillons et jointoiement.', type: 'prest', lot: 'peinture', unit: 'm²', price: { min: 75, max: 95 },
    etapes: [{ label: 'Préparation des murs et primaire d\'accrochage' }, { label: 'Pose de la faïence à la colle avec croisillons' }, { label: 'Jointoiement et finition silicone' }] },
  { name: 'Parquet stratifié', description: 'Pose flottante de parquet stratifié sur sous-couche acoustique, découpe sur mesure, plinthes et seuils.', type: 'prest', lot: 'peinture', unit: 'm²', price: { min: 52, max: 65 },
    etapes: [{ label: 'Pose de la sous-couche acoustique' }, { label: 'Pose flottante des lames avec coupe sur mesure' }, { label: 'Pose des plinthes et seuils de finition' }] },
  { name: 'Isolation thermique extérieure (ITE)', description: 'Pose de panneaux isolants en façade, sous-enduit armé de fibre de verre et enduit décoratif de finition.', type: 'prest', lot: 'peinture', unit: 'm²', price: { min: 130, max: 160 },
    etapes: [{ label: 'Pose des rails de départ et préparation du support' }, { label: 'Collage et chevillage des panneaux isolants' }, { label: 'Sous-enduit armé de fibre et finition décorative' }] },

  // ── Finitions / Divers ──────────────────────────────────────────────────
  { name: 'Finitions intérieures globales', description: 'Reprise des enduits, peinture complète murs et plafonds, pose des plinthes et accessoires de finition.', type: 'prest', lot: 'peinture', unit: 'forfait', price: { min: 9500, max: 12000 },
    etapes: [{ label: 'Reprise des enduits et ponçage général' }, { label: 'Peinture des murs et plafonds' }, { label: 'Pose des plinthes et accessoires de finition' }] },
  { name: 'Nettoyage fin de chantier', description: 'Évacuation complète des déchets, nettoyage approfondi de toutes les surfaces et levée des réserves.', type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 2000, max: 2800 },
    etapes: [{ label: 'Évacuation des déchets et matériels résiduels' }, { label: 'Nettoyage approfondi sols, vitres et sanitaires' }, { label: 'Contrôle visuel et levée des réserves' }] },
  { name: 'Installation échafaudage R+4', description: 'Montage d\'un échafaudage de pied jusqu\'à R+4, contreventement, garde-corps et vérification réglementaire.', type: 'prest', lot: 'couverture', unit: 'forfait', price: { min: 7000, max: 8500 },
    etapes: [{ label: 'Étude des charges et plan de calepinage' }, { label: 'Montage par sapiteurs habilités' }, { label: 'Vérification, contreventement et garde-corps' }] },

  // ── Déplacement / Main d'œuvre ──────────────────────────────────────────
  { name: 'Déplacement chantier', description: 'Frais de déplacement aller/retour sur le chantier, incluant transport du matériel et outillage.', type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 45, max: 90 },
    etapes: [{ label: 'Chargement du matériel et outillage' }, { label: 'Transport aller/retour sur le chantier' }] },
  { name: 'Main d\'œuvre qualifiée', description: 'Taux horaire de main d\'œuvre pour travaux tous corps d\'état, compagnon qualifié.', type: 'prest', lot: 'gros_oeuvre', unit: 'h', price: { min: 50, max: 70 },
    etapes: [] },
]

const MATERIAUX: readonly ElementExemple[] = [
  { name: 'Enduit monocouche 25 kg',         type: 'mat', lot: 'gros_oeuvre', unit: 'sac', ref: 'Weber.pral M',  supplier: 'Point P', priceAchat: { min: 15.5, max: 15.5 }, price: { min: 22, max: 26 } },
  { name: 'Tube PER Ø20 — 100 m',            type: 'mat', lot: 'plomberie',   unit: 'rl',  ref: 'Comap',         supplier: 'Cedeo',   priceAchat: { min: 58, max: 58 },     price: { min: 85, max: 98 } },
  { name: 'Câble R2V 3G2.5 — 100 m',         type: 'mat', lot: 'electricite', unit: 'rl',  ref: 'Nexans',        supplier: 'Rexel',   priceAchat: { min: 89, max: 89 },     price: { min: 125, max: 145 } },
  { name: 'Carrelage grès cérame 60×60',     type: 'mat', lot: 'peinture',    unit: 'm²',  ref: 'Porcelanosa',   supplier: 'Point P', priceAchat: { min: 22, max: 22 },     price: { min: 35, max: 42 } },
  { name: 'Laine de verre 100 mm',           type: 'mat', lot: 'gros_oeuvre', unit: 'm²',  ref: 'Isover',        supplier: 'Point P', priceAchat: { min: 6.8, max: 6.8 },   price: { min: 10, max: 12 } },
  { name: 'Canalisation PVC Ø100',           type: 'mat', lot: 'plomberie',   unit: 'ml',  ref: 'Nicoll',        supplier: 'Cedeo',   priceAchat: { min: 5.2, max: 5.2 },   price: { min: 8, max: 10 } },
  { name: 'Plaque BA13 standard',            type: 'mat', lot: 'gros_oeuvre', unit: 'm²',  ref: 'Placo',         supplier: 'Point P', priceAchat: { min: 4.5, max: 4.5 },   price: { min: 6, max: 8 } },
  { name: 'Tuiles mécaniques terre cuite',   type: 'mat', lot: 'couverture',  unit: 'u',   ref: 'Terreal',       supplier: 'Point P', priceAchat: { min: 1.2, max: 1.2 },   price: { min: 1.9, max: 2.3 } },
  { name: "Béton prêt à l'emploi C25/30",    type: 'mat', lot: 'gros_oeuvre', unit: 'm³',  ref: 'Cemex',         supplier: 'Cemex',   priceAchat: { min: 115, max: 115 },   price: { min: 150, max: 170 } },
]

/** Part du prix médian de la prestation attribuée à chaque étape, selon le nombre d'étapes (calcul d'origine). */
const POIDS_ETAPES: Record<number, number[]> = {
  1: [1],
  2: [0.4, 0.6],
  3: [0.25, 0.5, 0.25],
  4: [0.2, 0.3, 0.3, 0.2],
  5: [0.15, 0.25, 0.3, 0.2, 0.1],
}

/** Étapes chiffrées comme le module les écrivait : prix = part du prix médian, unité = celle de la prestation. */
function etapesChiffrees(p: ElementExemple): ElementExemple {
  if (p.type !== 'prest' || !p.etapes || p.etapes.length === 0) return p
  const n = p.etapes.length
  const poids = POIDS_ETAPES[n] || Array(n).fill(1 / n)
  const median = (p.price.min + p.price.max) / 2
  const etapes = p.etapes.map((et, i) => ({
    label: et.label,
    price: et.price != null ? et.price : Math.round(median * poids[i] * 100) / 100,
    unit: et.unit || p.unit,
  }))
  return { ...p, etapes }
}

/** Les deux formes enregistrées : module (étapes chiffrées) et formulaire de devis (étapes nues). */
function formesEnregistrees(): { module: ElementExempleEnregistre[]; formulaire: ElementExempleEnregistre[] } {
  return {
    module: [...PRESTATIONS.map(etapesChiffrees), ...MATERIAUX].map((p, i) => ({ id: i + 1, ...p })),
    formulaire: [...PRESTATIONS, ...MATERIAUX].map((p, i) => ({ id: i + 1, ...p })),
  }
}

/** Valeur ramenée à une forme comparable : clés triées, valeurs indéfinies retirées, tableaux dans leur ordre. */
function canonique(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(canonique)
  if (valeur !== null && typeof valeur === 'object') {
    const objet = valeur as Record<string, unknown>
    const sortie: Record<string, unknown> = {}
    for (const cle of Object.keys(objet).sort((a, b) => a.localeCompare(b))) {
      if (objet[cle] !== undefined) sortie[cle] = canonique(objet[cle])
    }
    return sortie
  }
  return valeur
}

/** Champs qui ne disent rien du contenu : identifiant du service publié, marque de resynchronisation. */
const CHAMPS_HORS_CONTENU = new Set(['supabase_id', '_dirty'])

/** Empreinte du contenu d'un élément de catalogue (identifiant compris), sans les champs hors contenu. */
export function empreinteElement(element: unknown): string {
  if (element === null || typeof element !== 'object' || Array.isArray(element)) return JSON.stringify(canonique(element))
  const contenu = Object.fromEntries(Object.entries(element as Record<string, unknown>).filter(([cle]) => !CHAMPS_HORS_CONTENU.has(cle)))
  return JSON.stringify(canonique(contenu))
}

const EMPREINTES_EXEMPLE: ReadonlySet<string> = (() => {
  const { module, formulaire } = formesEnregistrees()
  return new Set([...module, ...formulaire].map(empreinteElement))
})()

/**
 * Vrai si l'élément est un élément de l'ancien exemple tel qu'il a été écrit, sous l'une des deux formes, et jamais
 * modifié depuis : même identifiant, mêmes valeurs. Un élément modifié (prix, nom, étape, unité…), même légèrement,
 * ou créé par la société, n'en est pas un.
 */
export function estElementExempleIntact(element: unknown): boolean {
  return EMPREINTES_EXEMPLE.has(empreinteElement(element))
}

/** Sépare un catalogue : éléments gardés (créés ou modifiés par la société) et éléments d'exemple intacts. */
export function separerExempleAncien<T>(catalogue: readonly T[]): { gardes: T[]; exemples: T[] } {
  const gardes: T[] = []
  const exemples: T[] = []
  for (const element of catalogue) (estElementExempleIntact(element) ? exemples : gardes).push(element)
  return { gardes, exemples }
}

/** Copie de l'ancien exemple sous l'une de ses deux formes enregistrées. Tests seulement : jamais écrit. */
export function exempleAncienTelQuEnregistre(forme: 'module' | 'formulaire'): ElementExempleEnregistre[] {
  return JSON.parse(JSON.stringify(formesEnregistrees()[forme])) as ElementExempleEnregistre[]
}
