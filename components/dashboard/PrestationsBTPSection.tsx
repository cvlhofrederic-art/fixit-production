'use client'

/**
 * PrestationsBTPSection — Catalogue de prestations + matériaux pour pro_societe BTP.
 *
 * Équivalent BTP de la section « Motifs » côté artisan : c'est le catalogue que
 * le client voit (prestations proposées, fourchettes de prix, unités).
 *
 * Deux catégories :
 * - Prestations (ce que le client voit) : ex « Dalle béton 55–75 € /m² »
 *   → fusion de l'ancien Corps d'état + Main d'œuvre. La main d'œuvre n'est pas
 *     un poste distinct : elle est incluse dans le prix vendu au client.
 * - Matériaux (gestion interne) : prix d'achat/vente par référence + fournisseur.
 *
 * Les prestations seed sont alignées sur les 5 devis du compte super admin
 * (seed-demo-localStorage.ts) pour présentation investisseurs cohérente.
 *
 * Prix fixe OU fourchette (ex : 35 € – 45 € /m²) — les prix BTP sont rarement figés.
 */

import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import type { Artisan } from '@/lib/types'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface PrestationsBTPSectionProps {
  artisan: Artisan
  orgRole?: OrgRole
  navigateTo?: (page: string) => void
}

type PrestType = 'prest' | 'mat'

type PriceRange = { min: number; max: number } // min === max ⇒ prix fixe

export interface Prestation {
  id: number
  name: string
  description?: string   // description libre du motif (injectée dans lineDetail du devis)
  type: PrestType
  lot: string            // corps d'état (ex: 'gros_oeuvre', 'electricite', …)
  unit: string           // m², ml, u, m³, kg, rl, h, sac, forfait
  price: PriceRange      // prix vendu au client (prestation) ou prix de vente (matériau)
  priceAchat?: PriceRange | null // matériaux : prix d'achat interne
  ref?: string           // référence produit (matériaux)
  supplier?: string      // fournisseur (matériaux)
  etapes?: Array<{ label: string; price?: number }>  // étapes d'exécution (prestations) — injectées dans les devis
}

/* ─────────────────────────── CATALOGUE DES LOTS ───────────────────────────
   Chaque lot connaît ses mots-clés de rattachement à la « specialty » de la
   société. Le composant n'affiche que les lots dont au moins un mot-clé matche
   — si aucun ne matche (entreprise généraliste), tous les lots s'affichent.  */
interface LotDef { key: string; label: string; keywords: string[] }

const LOTS: LotDef[] = [
  { key: 'gros_oeuvre', label: 'Gros Œuvre',             keywords: ['macon', 'maçon', 'gros oeuvre', 'gros-oeuvre', 'beton', 'béton', 'terrassement', 'fondation', 'demolition', 'démolition', 'batipro', 'general', 'général', 'placo', 'cloison'] },
  { key: 'couverture',  label: 'Couverture',             keywords: ['couv', 'charpent', 'toiture', 'zingu', 'etancheite', 'étanchéité'] },
  { key: 'plomberie',   label: 'Plomberie / CVC',        keywords: ['plomb', 'canalisa', 'chauff', 'cvc', 'sanitaire', 'clim'] },
  { key: 'electricite', label: 'Électricité',            keywords: ['elec', 'élec', 'courant', 'domotique', 'vmc'] },
  { key: 'menuiseries', label: 'Menuiseries',            keywords: ['menuis', 'fenetre', 'fenêtre', 'porte', 'volet', 'serrurerie'] },
  { key: 'peinture',    label: 'Peinture / Revêtements', keywords: ['peint', 'revetem', 'revêtem', 'carrel', 'faience', 'faïence', 'sol', 'ravalement', 'facade', 'façade', 'platr', 'plâtr', 'enduit', 'isolation'] },
]

// Unités BTP courantes — ordre pensé pour le chantier (surface → longueur → volume → comptage → poids → conditionnement → temps → facturation)
const UNITS = [
  // Géométrie
  'm²', 'ml', 'm', 'm³',
  // Comptage
  'u', 'pce', 'ens', 'lot', 'pt',
  // Poids / volume liquide
  'kg', 't', 'L',
  // Conditionnement chantier
  'sac', 'rl', 'palette', 'benne', 'camion',
  // Temps
  'h', 'jour', 'semaine',
  // Facturation
  'forfait',
] as const

/* ───────────────────────── SEED PRESTATIONS ─────────────────────────
   Aligné sur les 5 devis super admin (lib/seed-demo-localStorage.ts)
   — cohérence indispensable pour la présentation investisseurs.        */
export const SEED_PREST: Omit<Prestation, 'id'>[] = [
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

/* ───────────────────────── SEED MATÉRIAUX ─────────────────────────
   Gestion interne des matières / fournisseurs (prix achat → vente).   */
export const SEED_MAT: Omit<Prestation, 'id'>[] = [
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

/* ─────────────────────────── HELPERS ─────────────────────────── */
function formatPrice(v: number): string {
  const fixed = v < 10 && v % 1 !== 0 ? v.toFixed(2) : Math.round(v).toString()
  return fixed.replace('.', ',') + ' €'
}

function renderRange(range: PriceRange | null | undefined): string {
  if (!range) return '—'
  if (range.min === range.max) return formatPrice(range.min)
  return `${formatPrice(range.min)} – ${formatPrice(range.max)}`
}

function unitSuffix(unit: string): string {
  if (unit === 'forfait') return ''
  return ` / ${unit}`
}

function rangeTTC(range: PriceRange | null | undefined, tva = 20): string {
  if (!range) return '—'
  const minTTC = range.min * (1 + tva / 100)
  const maxTTC = range.max * (1 + tva / 100)
  if (range.min === range.max) return formatPrice(minTTC)
  return `${formatPrice(minTTC)} – ${formatPrice(maxTTC)}`
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function detectLotsFromArtisan(artisan: Artisan): LotDef[] {
  const haystack = normalize([
    artisan.category || '',
    artisan.company_name || '',
    artisan.bio || '',
    ...(artisan.specialties || []),
  ].join(' '))
  if (!haystack.trim()) return LOTS
  const matched = LOTS.filter((lot) =>
    lot.keywords.some((kw) => haystack.includes(normalize(kw)))
  )
  return matched.length > 0 ? matched : LOTS
}

/* ─────────────────────────── COMPOSANT ─────────────────────────── */
export default function PrestationsBTPSection({ artisan }: PrestationsBTPSectionProps) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  // v4 : étapes {label,price?} + prix 2026 SARL + unités corrigées + colonne TTC
  const storageKey = `fixit_prestations_btp_v4_${artisan?.id || 'guest'}`

  const [items, setItems] = useState<Prestation[]>([])
  const [cat, setCat] = useState<PrestType>('prest')
  const [search, setSearch] = useState('')

  const availableLots = useMemo(() => detectLotsFromArtisan(artisan), [artisan])
  const [activeLot, setActiveLot] = useState<string>(() => availableLots[0]?.key || 'gros_oeuvre')

  useEffect(() => {
    if (!availableLots.some((l) => l.key === activeLot)) {
      setActiveLot(availableLots[0]?.key || 'gros_oeuvre')
    }
  }, [availableLots, activeLot])

  // Chargement / seed
  useEffect(() => {
    if (!artisan?.id) return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        setItems(JSON.parse(saved))
      } else {
        const all = [...SEED_PREST, ...SEED_MAT].map((p, i) => ({ id: i + 1, ...p }))
        setItems(all)
        try { localStorage.setItem(storageKey, JSON.stringify(all)) } catch (e) { console.warn('[prestations] seed', e) }
      }
    } catch {
      setItems([...SEED_PREST, ...SEED_MAT].map((p, i) => ({ id: i + 1, ...p })))
    }
  }, [artisan?.id, storageKey])

  function persist(next: Prestation[]) {
    setItems(next)
    if (artisan?.id) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch (e) { console.warn('[prestations] persist', e) }
    }
  }

  // Filtre combiné catégorie + lot + search
  const visible = useMemo(() => {
    let list = items.filter((i) => i.type === cat)
    if (cat === 'prest') {
      list = list.filter((i) => i.lot === activeLot)
    }
    if (search.trim()) {
      const q = normalize(search)
      list = list.filter((i) => normalize(i.name).includes(q) || (i.ref && normalize(i.ref).includes(q)) || (i.supplier && normalize(i.supplier).includes(q)))
    }
    return list
  }, [items, cat, activeLot, search])

  // Modal édition / création
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Prestation | null>(null)
  const [form, setForm] = useState<Omit<Prestation, 'id'>>({
    name: '', type: 'prest', lot: availableLots[0]?.key || 'gros_oeuvre', unit: 'm²',
    price: { min: 0, max: 0 },
  })
  const [priceRange, setPriceRange] = useState(false)
  const [achatRange, setAchatRange] = useState(false)
  const [localEtapes, setLocalEtapes] = useState<Array<{ label: string; price?: number }>>([])

  function openCreate() {
    setEditing(null)
    setForm({
      name: '', type: cat,
      lot: cat === 'prest' ? activeLot : (availableLots[0]?.key || 'gros_oeuvre'),
      unit: 'm²',
      price: { min: 0, max: 0 },
      priceAchat: cat === 'mat' ? { min: 0, max: 0 } : null,
      description: '',
    })
    setPriceRange(false)
    setAchatRange(false)
    setLocalEtapes([])
    setModal(true)
  }

  function openEdit(p: Prestation) {
    setEditing(p)
    setForm({
      name: p.name, type: p.type, lot: p.lot, unit: p.unit,
      price: { ...p.price },
      priceAchat: p.priceAchat ? { ...p.priceAchat } : null,
      ref: p.ref, supplier: p.supplier,
      description: p.description || '',
    })
    setPriceRange(p.price.min !== p.price.max)
    setAchatRange(Boolean(p.priceAchat && p.priceAchat.min !== p.priceAchat.max))
    // Backward compat: old localStorage may have string[] étapes
    setLocalEtapes(p.etapes ? p.etapes.map(e => typeof e === 'string' ? { label: e } : e) : [])
    setModal(true)
  }

  function handleSave() {
    if (!form.name.trim()) return
    const price = {
      min: form.price.min,
      max: priceRange ? form.price.max : form.price.min,
    }
    const priceAchat = form.type === 'mat' && form.priceAchat
      ? { min: form.priceAchat.min, max: achatRange ? form.priceAchat.max : form.priceAchat.min }
      : null

    const etapes = form.type === 'prest'
      ? localEtapes.map((e) => ({ label: e.label.trim(), ...(e.price != null && e.price > 0 ? { price: e.price } : {}) })).filter(e => e.label)
      : undefined

    const description = form.type === 'prest' && form.description?.trim() ? form.description.trim() : undefined

    if (editing) {
      persist(items.map((i) => i.id === editing.id ? { ...i, ...form, price, priceAchat, etapes, description } : i))
    } else {
      const nextId = Math.max(0, ...items.map((i) => i.id)) + 1
      persist([...items, { id: nextId, ...form, price, priceAchat, etapes, description }])
    }
    setModal(false)
  }

  function handleDelete(id: number) {
    persist(items.filter((i) => i.id !== id))
  }

  const currentLotLabel = availableLots.find((l) => l.key === activeLot)?.label || ''

  /* ───────────── RENDU ───────────── */
  return (
    <div className="v5-fade">
      {/* Styles locaux (classes spécifiques à cette page) */}
      <style jsx>{`
        .prest-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: .5rem; }
        .prest-cat-bar { display: flex; gap: 0; border: 1px solid #E0E0E0; border-radius: 5px; overflow: hidden; background: #fff; }
        .prest-cat-btn { padding: 5px 14px; font-size: 11px; font-weight: 600; cursor: pointer; border: none; background: none; color: #888; font-family: inherit; border-right: 1px solid #E0E0E0; transition: all .15s; letter-spacing: .2px; }
        .prest-cat-btn:last-child { border-right: none; }
        .prest-cat-btn.active { background: #1a1a1a; color: #fff; }
        .prest-cat-btn:hover:not(.active) { background: #F5F5F5; color: #444; }
        .prest-panel { animation: fadeIn .25s; }
        .prest-lot-tabs { display: flex; gap: 0; margin-bottom: .85rem; border-bottom: 2px solid #E8E8E8; flex-wrap: wrap; }
        .prest-lot-tab { padding: 6px 13px; font-size: 11px; font-weight: 500; cursor: pointer; border: none; background: none; color: #999; font-family: inherit; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all .15s; }
        .prest-lot-tab.active { color: #FFA000; border-bottom-color: #FFC107; font-weight: 600; }
        .prest-lot-tab:hover:not(.active) { color: #555; }
        .prest-tbl { width: 100%; border-collapse: collapse; }
        .prest-tbl thead th { text-align: left; padding: .45rem .6rem; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #999; letter-spacing: .3px; border-bottom: 2px solid #E8E8E8; background: #FAFAFA; }
        .prest-tbl td { padding: .45rem .6rem; border-bottom: 1px solid #F0F0F0; color: #444; vertical-align: middle; font-size: 12px; }
        .prest-tbl tr:hover td { background: #FAFAFA; }
        .prest-tbl td:first-child { font-weight: 500; color: #1a1a1a; }
        .prest-tbl .prix { font-weight: 700; color: #F57C00; white-space: nowrap; }
        .prest-tbl .prix-achat { font-weight: 600; color: #1a1a1a; white-space: nowrap; }
        .prest-add-row { display: flex; align-items: center; gap: 6px; padding: .5rem .6rem; border-top: 1px solid #F0F0F0; font-size: 11px; color: #BBB; cursor: pointer; transition: color .15s; background: #fff; }
        .prest-add-row:hover { color: #FFA000; }
        .prest-unit { display: inline-block; background: #F5F5F5; border-radius: 3px; padding: 1px 6px; font-size: 10px; font-weight: 600; color: #888; letter-spacing: .2px; }
        .prest-modal-ov { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .prest-modal { background: #fff; border-radius: 8px; width: 92%; max-width: 560px; max-height: 85vh; overflow-y: auto; padding: 1.5rem; }
        .prest-modal h3 { font-size: 15px; font-weight: 600; margin-bottom: 1rem; }
        .prest-fg { margin-bottom: .85rem; }
        .prest-fg label { display: block; font-size: 11px; font-weight: 600; color: #555; margin-bottom: 4px; }
        .prest-fg input, .prest-fg select, .prest-fg textarea { width: 100%; padding: 7px 9px; border: 1px solid #E0E0E0; border-radius: 4px; font-size: 12px; font-family: inherit; box-sizing: border-box; }
        .prest-fg textarea { resize: vertical; min-height: 56px; line-height: 1.45; color: #1a1a1a; }
        .prest-fg input:focus, .prest-fg select:focus, .prest-fg textarea:focus { outline: none; border-color: #FFC107; }
        /* Masquer les flèches spinner des inputs number */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
        .prest-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: .65rem; }
        .prest-range-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #666; cursor: pointer; margin-left: 8px; }
        .prest-price-block { border: 1px solid #E8E8E8; border-radius: 6px; padding: .65rem .75rem; margin-bottom: .75rem; background: #FAFAFA; }
        .prest-price-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .5rem; font-size: 11px; font-weight: 600; color: #555; }
        .prest-footer { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; padding-top: .85rem; border-top: 1px solid #F0F0F0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Titre */}
      <div className="v5-pg-t">
        <h1>{isPt ? 'Prestações' : 'Prestations'}</h1>
        <p>{isPt ? 'Catálogo de prestações e materiais — o que os seus clientes veem' : 'Catalogue de prestations et matériaux — c\'est ce que vos clients voient'}</p>
      </div>

      {/* Barre haute : recherche + switch catégorie + bouton ajout */}
      <div className="prest-top">
        <div className="v5-search" style={{ margin: 0, flex: 1, minWidth: 220 }}>
          <input
            className="v5-search-in"
            placeholder={isPt ? 'Pesquisar uma prestação, um material…' : 'Rechercher une prestation, un matériau…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', flexWrap: 'wrap' }}>
          <div className="prest-cat-bar">
            <button className={`prest-cat-btn${cat === 'prest' ? ' active' : ''}`} onClick={() => setCat('prest')}>🏗️ {isPt ? 'Prestações' : 'Prestations'}</button>
            <button className={`prest-cat-btn${cat === 'mat' ? ' active' : ''}`} onClick={() => setCat('mat')}>🧱 {isPt ? 'Materiais' : 'Matériaux'}</button>
          </div>
          <button className="v5-btn v5-btn-p" onClick={openCreate}>+ {isPt ? 'Adicionar' : 'Ajouter'}</button>
        </div>
      </div>

      {/* PANEL : PRESTATIONS (avec sous-onglets par corps d'état) */}
      {cat === 'prest' && (
        <div className="prest-panel">
          <div className="prest-lot-tabs">
            {availableLots.map((lot) => (
              <button
                key={lot.key}
                className={`prest-lot-tab${activeLot === lot.key ? ' active' : ''}`}
                onClick={() => setActiveLot(lot.key)}
              >
                {lot.label}
              </button>
            ))}
          </div>

          <div className="v5-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="prest-tbl">
              <thead>
                <tr>
                  <th>{isPt ? 'Prestação' : 'Prestation'}</th>
                  <th>{isPt ? 'Unidade' : 'Unité'}</th>
                  <th>{isPt ? 'Preço s/ IVA' : 'Prix HT'}</th>
                  <th>{isPt ? 'Preço c/ IVA' : 'Prix TTC'}</th>
                  <th style={{ textAlign: 'right' }}>{isPt ? 'Ações' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.25rem', color: '#BBB' }}>{isPt ? 'Nenhuma prestação neste lote.' : 'Aucune prestation dans ce lot.'}</td></tr>
                )}
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="prest-unit">{p.unit}</span></td>
                    <td className="prix">{renderRange(p.price)}{unitSuffix(p.unit)}</td>
                    <td style={{ color: '#888', fontSize: 11 }}>{rangeTTC(p.price)}{unitSuffix(p.unit)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="v5-btn v5-btn-sm" onClick={() => openEdit(p)}>{isPt ? 'Editar' : 'Modifier'}</button>
                      <button className="v5-btn v5-btn-sm v5-btn-d" style={{ marginLeft: 4 }} onClick={() => handleDelete(p.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="prest-add-row" onClick={openCreate}>＋ {isPt ? `Adicionar uma prestação ${currentLotLabel}` : `Ajouter une prestation ${currentLotLabel}`}</div>
          </div>
        </div>
      )}

      {/* PANEL : MATÉRIAUX */}
      {cat === 'mat' && (
        <div className="prest-panel">
          <div className="v5-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="prest-tbl">
              <thead>
                <tr>
                  <th>{isPt ? 'Designação do material' : 'Désignation matériau'}</th>
                  <th>{isPt ? 'Ref. / Marca' : 'Réf. / Marque'}</th>
                  <th>{isPt ? 'Unidade' : 'Unité'}</th>
                  <th>{isPt ? 'Preço compra s/ IVA' : 'Prix achat HT'}</th>
                  <th>{isPt ? 'Preço venda s/ IVA' : 'Prix vente HT'}</th>
                  <th>{isPt ? 'Fornecedor' : 'Fournisseur'}</th>
                  <th style={{ textAlign: 'right' }}>{isPt ? 'Ações' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.25rem', color: '#BBB' }}>{isPt ? 'Nenhum material referenciado.' : 'Aucun matériau référencé.'}</td></tr>
                )}
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td style={{ color: '#888', fontSize: 11 }}>{p.ref || '—'}</td>
                    <td><span className="prest-unit">{p.unit}</span></td>
                    <td className="prix-achat">{renderRange(p.priceAchat)}</td>
                    <td className="prix">{renderRange(p.price)}</td>
                    <td>{p.supplier || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="v5-btn v5-btn-sm" onClick={() => openEdit(p)}>{isPt ? 'Editar' : 'Modifier'}</button>
                      <button className="v5-btn v5-btn-sm v5-btn-d" style={{ marginLeft: 4 }} onClick={() => handleDelete(p.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="prest-add-row" onClick={openCreate}>＋ {isPt ? 'Adicionar um material' : 'Ajouter un matériau'}</div>
          </div>
        </div>
      )}

      {/* ──────── MODAL ──────── */}
      {modal && (
        <div className="prest-modal-ov" onClick={() => setModal(false)}>
          <div className="prest-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing
              ? (isPt ? `Editar ${form.type === 'mat' ? 'material' : 'prestação'}` : `Modifier ${form.type === 'mat' ? 'le matériau' : 'la prestation'}`)
              : (isPt ? `${form.type === 'mat' ? 'Nova referência de material' : 'Nova prestação'}` : `Nouvelle ${form.type === 'mat' ? 'référence matériau' : 'prestation'}`)
            }</h3>

            <div className="prest-fg">
              <label>{isPt ? 'Designação *' : 'Désignation *'}</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.type === 'mat' ? (isPt ? 'Ex: Telhas cerâmicas' : 'Ex: Tuiles mécaniques terre cuite') : (isPt ? 'Ex: Laje de betão' : 'Ex: Dalle béton')} />
            </div>

            {form.type === 'prest' && (
              <div className="prest-fg">
                <label>{isPt ? 'Descrição do motivo' : 'Description du motif'}</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={isPt ? 'Ex: Preparação do suporte, aplicação de 2 camadas...' : 'Ex: Préparation du support, application de 2 couches...'}
                  rows={2}
                />
              </div>
            )}

            <div className="prest-row-2">
              <div className="prest-fg">
                <label>{isPt ? 'Categoria' : 'Catégorie'}</label>
                <select value={form.type} onChange={(e) => {
                  const newType = e.target.value as PrestType
                  setForm({
                    ...form,
                    type: newType,
                    priceAchat: newType === 'mat' ? (form.priceAchat || { min: 0, max: 0 }) : null,
                  })
                }}>
                  <option value="prest">{isPt ? 'Prestação (cliente)' : 'Prestation (client)'}</option>
                  <option value="mat">{isPt ? 'Material (interno)' : 'Matériau (interne)'}</option>
                </select>
              </div>
              <div className="prest-fg">
                <label>{isPt ? 'Especialidade / Lote' : 'Corps d\'état / Lot'}</label>
                <select value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })}>
                  {availableLots.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
              </div>
            </div>

            <div className="prest-row-2">
              <div className="prest-fg">
                <label>{isPt ? 'Unidade' : 'Unité'}</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              {form.type === 'mat' ? (
                <div className="prest-fg">
                  <label>{isPt ? 'Referência / Marca' : 'Référence / Marque'}</label>
                  <input type="text" value={form.ref || ''} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="Ex: Weber.pral M" />
                </div>
              ) : (
                <div />
              )}
            </div>

            {form.type === 'mat' && (
              <div className="prest-fg">
                <label>{isPt ? 'Fornecedor' : 'Fournisseur'}</label>
                <input type="text" value={form.supplier || ''} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder={isPt ? 'Ex: Leroy Merlin, Saint-Gobain' : 'Ex: Point P, Cedeo, Rexel'} />
              </div>
            )}

            {/* Prix achat (matériaux uniquement) */}
            {form.type === 'mat' && (
              <div className="prest-price-block">
                <div className="prest-price-head">
                  <span>{isPt ? 'Preço de compra s/ IVA (€)' : 'Prix achat HT (€)'}</span>
                  <label className="prest-range-toggle">
                    <input type="checkbox" checked={achatRange} onChange={(e) => setAchatRange(e.target.checked)} />
                    {isPt ? 'Intervalo' : 'Fourchette'}
                  </label>
                </div>
                <div className="prest-row-2">
                  <div className="prest-fg" style={{ margin: 0 }}>
                    <label>{achatRange ? 'Min' : 'Prix'}</label>
                    <input type="number" step="0.01" min="0" value={form.priceAchat?.min ?? ''}
                      onChange={(e) => setForm({ ...form, priceAchat: { min: parseFloat(e.target.value) || 0, max: form.priceAchat?.max ?? 0 } })} />
                  </div>
                  <div className="prest-fg" style={{ margin: 0, opacity: achatRange ? 1 : 0.35 }}>
                    <label>Max</label>
                    <input type="number" step="0.01" min="0" disabled={!achatRange} value={form.priceAchat?.max ?? ''}
                      onChange={(e) => setForm({ ...form, priceAchat: { min: form.priceAchat?.min ?? 0, max: parseFloat(e.target.value) || 0 } })} />
                  </div>
                </div>
              </div>
            )}

            {/* Étapes — uniquement pour les prestations (injectées dans les devis) */}
            {form.type === 'prest' && (
              <div className="prest-fg">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ margin: 0 }}>{isPt ? 'Etapas' : 'Étapes'}</label>
                  <button
                    type="button"
                    onClick={() => setLocalEtapes((prev) => [...prev, { label: '' }])}
                    style={{ fontSize: 10, color: '#F57C00', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  >
                    + {isPt ? 'Adicionar' : 'Ajouter'}
                  </button>
                </div>
                {localEtapes.length === 0 && (
                  <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic', padding: '4px 0' }}>
                    {isPt ? 'Nenhuma etapa. Clique + Adicionar.' : 'Aucune étape. Cliquez + Ajouter.'}
                  </div>
                )}
                {localEtapes.map((et, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 6, marginBottom: 6 }}>
                    {/* Rectangle blanc : numéro + désignation (même style que Désignation) */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #E0E0E0', borderRadius: 4, padding: '0 9px' }}>
                      <span style={{ color: '#999', fontSize: 11, fontWeight: 600, marginRight: 8, minWidth: 14 }}>{i + 1}.</span>
                      <input
                        type="text"
                        value={et.label}
                        placeholder={isPt ? 'Ex: Diagnóstico visual' : 'Ex: Diagnostic visuel'}
                        onChange={(e) => setLocalEtapes((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                        style={{ flex: 1, fontSize: 12, color: '#1a1a1a', background: 'transparent', border: 'none', outline: 'none', padding: '8px 0', width: '100%', fontFamily: 'inherit' }}
                      />
                    </div>
                    {/* Petit carré prix */}
                    <div title={isPt ? 'Preço opcional por etapa' : 'Prix optionnel par étape'}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#fff', border: '1px solid #E0E0E0', borderRadius: 4, padding: '0 8px', width: 108 }}>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={et.price ?? ''}
                        placeholder="0"
                        onChange={(e) => setLocalEtapes((prev) => prev.map((x, j) => (j === i ? { ...x, price: e.target.value ? parseFloat(e.target.value) : undefined } : x)))}
                        style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#E65100', background: 'transparent', border: 'none', outline: 'none', padding: '8px 0', textAlign: 'right', width: '100%', fontFamily: 'inherit' }}
                      />
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: 0.3 }}>€ HT</span>
                    </div>
                    <button
                      type="button"
                      aria-label={isPt ? 'Remover etapa' : 'Supprimer étape'}
                      onClick={() => setLocalEtapes((prev) => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#c00', padding: '0 4px' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: '#888', marginTop: 4, fontStyle: 'italic', lineHeight: 1.45 }}>
                  {isPt
                    ? 'Etapas adicionadas automaticamente aos orçamentos. Preço por etapa opcional — deixe em branco para não detalhar.'
                    : 'Étapes ajoutées automatiquement aux devis. Prix par étape optionnel. Laissez vide pour ne pas détailler.'}
                </div>
              </div>
            )}

            {/* Prix vendu au client */}
            <div className="prest-price-block">
              <div className="prest-price-head">
                <span>{form.type === 'mat' ? (isPt ? 'Preço de venda s/ IVA (€)' : 'Prix vente HT (€)') : (isPt ? 'Preço s/ IVA ao cliente (€)' : 'Prix HT vendu au client (€)')}</span>
                <label className="prest-range-toggle">
                  <input type="checkbox" checked={priceRange} onChange={(e) => setPriceRange(e.target.checked)} />
                  {isPt ? 'Intervalo' : 'Fourchette'}
                </label>
              </div>
              <div className="prest-row-2">
                <div className="prest-fg" style={{ margin: 0 }}>
                  <label>{priceRange ? 'Min' : 'Prix'}</label>
                  <input type="number" step="0.01" min="0" value={form.price.min ?? ''}
                    onChange={(e) => setForm({ ...form, price: { min: parseFloat(e.target.value) || 0, max: form.price.max } })} />
                </div>
                <div className="prest-fg" style={{ margin: 0, opacity: priceRange ? 1 : 0.35 }}>
                  <label>Max</label>
                  <input type="number" step="0.01" min="0" disabled={!priceRange} value={form.price.max ?? ''}
                    onChange={(e) => setForm({ ...form, price: { min: form.price.min, max: parseFloat(e.target.value) || 0 } })} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                {isPt ? 'Dica: os preços em obras variam — ative «Intervalo» para mostrar uma amplitude (ex: 350 € – 450 € /m²).' : 'Astuce : les prix BTP varient selon chantier — activez « Fourchette » pour afficher une plage (ex : 350 € – 450 € /m²).'}
              </div>
            </div>

            <div className="prest-footer">
              <button className="v5-btn" onClick={() => setModal(false)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v5-btn v5-btn-p" onClick={handleSave} disabled={!form.name.trim()}>
                {editing ? (isPt ? 'Guardar' : 'Enregistrer') : (isPt ? 'Criar' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
