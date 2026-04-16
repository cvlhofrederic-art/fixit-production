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
  etapes?: string[]      // étapes d'exécution (prestations) — injectées dans les devis
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

const UNITS = ['m²', 'ml', 'm³', 'u', 'kg', 'sac', 'rl', 'h', 'forfait', 'jour', 'semaine'] as const

/* ───────────────────────── SEED PRESTATIONS ─────────────────────────
   Aligné sur les 5 devis super admin (lib/seed-demo-localStorage.ts)
   — cohérence indispensable pour la présentation investisseurs.        */
export const SEED_PREST: Omit<Prestation, 'id'>[] = [
  // ── Gros Œuvre / Démolition ─────────────────────────────────────────────
  { name: 'Démolition cloisons + évacuation gravats', type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 2000, max: 3500 },
    etapes: ['Protection des sols et du mobilier voisin', 'Démolition mécanique des cloisons', 'Tri et évacuation des gravats en déchèterie agréée'] },
  { name: 'Terrassement + fondations',                type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 7500, max: 9500 },
    etapes: ['Terrassement à la pelle mécanique selon plan', 'Coulage des semelles béton armé', 'Mise en place chaînage et reprise en élévation'] },
  { name: 'Élévation murs parpaing',                  type: 'prest', lot: 'gros_oeuvre', unit: 'm²',     price: { min: 160, max: 200 },
    etapes: ['Implantation et traçage des murs', 'Montage des parpaings au mortier bâtard', 'Réalisation des chaînages verticaux et linteaux'] },
  { name: 'Dalle béton',                              type: 'prest', lot: 'gros_oeuvre', unit: 'm²',     price: { min: 55, max: 75 },
    etapes: ['Préparation hérisson + film polyane + treillis soudé', 'Coulage béton dosé à 350 kg/m³', 'Talochage et lissage de la surface'] },
  { name: 'Dépose sanitaires existants',              type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 1000, max: 1400 },
    etapes: ['Coupure eau et électricité de la zone', 'Dépose vasques, WC, douche et baignoire', 'Bouchonnage des arrivées et évacuations'] },
  { name: 'Placo BA13 — fourniture + pose',           type: 'prest', lot: 'gros_oeuvre', unit: 'm²',     price: { min: 40, max: 50 },
    etapes: ['Pose des rails et montants métalliques', 'Vissage des plaques BA13 sur ossature', 'Bandes, enduits et ponçage de finition'] },
  { name: 'Faux plafond acoustique',                  type: 'prest', lot: 'gros_oeuvre', unit: 'm²',     price: { min: 50, max: 60 },
    etapes: ['Pose de l\'ossature métallique suspendue', 'Mise en place de l\'isolant acoustique', 'Pose des dalles acoustiques décoratives'] },

  // ── Couverture / Charpente ──────────────────────────────────────────────
  { name: 'Charpente + couverture tuiles',            type: 'prest', lot: 'couverture',  unit: 'forfait', price: { min: 13000, max: 15000 },
    etapes: ['Pose de la charpente traditionnelle ou fermettes', 'Mise en place liteaux et écran sous-toiture', 'Pose des tuiles et accessoires de faîtage'] },
  { name: 'Zinguerie gouttières + EP',                type: 'prest', lot: 'couverture',  unit: 'forfait', price: { min: 4500, max: 5500 },
    etapes: ['Pose des crochets et chêneaux zinc', 'Mise en place des gouttières et soudures', 'Raccordement des descentes EP au réseau'] },

  // ── Plomberie / CVC ─────────────────────────────────────────────────────
  { name: 'Plomberie SDB + cuisine',                  type: 'prest', lot: 'plomberie',   unit: 'forfait', price: { min: 3800, max: 4500 },
    etapes: ['Tracé et pose des réseaux PER eau chaude/froide', 'Pose des évacuations PVC sous pente', 'Raccordement, mise en eau et test d\'étanchéité'] },
  { name: 'Plomberie complète logement',              type: 'prest', lot: 'plomberie',   unit: 'forfait', price: { min: 2500, max: 3000 },
    etapes: ['Création de la nourrice et distribution générale', 'Pose des réseaux EF/EC vers tous points de puisage', 'Pose des évacuations et essais d\'étanchéité'] },
  { name: 'Plomberie sanitaires local commercial',    type: 'prest', lot: 'plomberie',   unit: 'forfait', price: { min: 5000, max: 6000 },
    etapes: ['Étude et tracé des réseaux selon normes ERP', 'Pose des alimentations et évacuations PVC', 'Raccordement WC, lave-mains et chauffe-eau'] },
  { name: 'Douche italienne + paroi',                 type: 'prest', lot: 'plomberie',   unit: 'forfait', price: { min: 2000, max: 2400 },
    etapes: ['Création du receveur extra-plat avec pente', 'Étanchéité SPEC et pose du carrelage', 'Installation de la paroi verre et de la robinetterie'] },
  { name: 'Meuble vasque + miroir',                   type: 'prest', lot: 'plomberie',   unit: 'forfait', price: { min: 1500, max: 2000 },
    etapes: ['Repérage et pose des fixations murales', 'Installation du meuble et du plan vasque', 'Raccordement plomberie et pose du miroir'] },

  // ── Électricité ─────────────────────────────────────────────────────────
  { name: 'Mise aux normes électrique NFC 15-100',    type: 'prest', lot: 'electricite', unit: 'forfait', price: { min: 4500, max: 7500 },
    etapes: ['Diagnostic de l\'installation existante', 'Remplacement du tableau et création des circuits dédiés', 'Mise à la terre et attestation de conformité Consuel'] },
  { name: 'Électricité + plomberie extension',        type: 'prest', lot: 'electricite', unit: 'forfait', price: { min: 6000, max: 6500 },
    etapes: ['Création des circuits dédiés à l\'extension', 'Pose des réseaux PER et évacuations', 'Raccordement au tableau et mise en service'] },

  // ── Menuiseries ─────────────────────────────────────────────────────────
  { name: 'Menuiserie alu (par pièce)',               type: 'prest', lot: 'menuiseries', unit: 'u',       price: { min: 2500, max: 3200 },
    etapes: ['Prise de cotes et dépose de l\'existant', 'Pose dormant + ouvrant alu rupture pont thermique', 'Calfeutrement, réglage et joints d\'étanchéité'] },
  { name: 'Vitrine commerciale alu',                  type: 'prest', lot: 'menuiseries', unit: 'forfait', price: { min: 8000, max: 9000 },
    etapes: ['Dépose de la vitrine existante et mise en sécurité', 'Pose châssis alu RPT + vitrage feuilleté', 'Habillage tôle, joints et serrurerie'] },

  // ── Peinture / Revêtements ──────────────────────────────────────────────
  { name: 'Peinture 2 couches intérieure',            type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 25, max: 30 },
    etapes: ['Préparation des supports (rebouchage, ponçage)', 'Application d\'une sous-couche d\'accroche', 'Application des 2 couches de finition acrylique'] },
  { name: 'Peinture façade 2 couches',                type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 22, max: 28 },
    etapes: ['Nettoyage haute pression et traitement fongicide', 'Application d\'un fixateur de fond', 'Application des 2 couches pliolite ou siloxane'] },
  { name: 'Enduit monocouche façade',                 type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 38, max: 45 },
    etapes: ['Préparation du support et humidification', 'Projection mécanique de l\'enduit monocouche', 'Talochage et finition grattée ou écrasée'] },
  { name: 'Nettoyage HP façade',                      type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 10, max: 14 },
    etapes: ['Protection des huisseries et des abords', 'Nettoyage haute pression à l\'eau chaude', 'Rinçage et application d\'un traitement anti-mousses'] },
  { name: 'Carrelage sol SDB',                        type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 80, max: 100 },
    etapes: ['Préparation et ragréage du support', 'Pose du carrelage à la colle avec calepinage', 'Joints, nettoyage et silicone périphérique'] },
  { name: 'Faïence murale',                           type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 70, max: 85 },
    etapes: ['Préparation des murs et primaire d\'accrochage', 'Pose de la faïence à la colle avec croisillons', 'Jointoiement et finition silicone'] },
  { name: 'Parquet stratifié',                        type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 48, max: 55 },
    etapes: ['Pose de la sous-couche acoustique', 'Pose flottante des lames avec coupe sur mesure', 'Pose des plinthes et seuils de finition'] },
  { name: 'Isolation thermique extérieure (ITE)',     type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 110, max: 130 },
    etapes: ['Pose des rails de départ et préparation du support', 'Collage et chevillage des panneaux isolants', 'Sous-enduit armé de fibre et finition décorative'] },

  // ── Finitions / Divers ──────────────────────────────────────────────────
  { name: 'Finitions intérieures globales',           type: 'prest', lot: 'peinture',    unit: 'forfait', price: { min: 8500, max: 10500 },
    etapes: ['Reprise des enduits et ponçage général', 'Peinture des murs et plafonds', 'Pose des plinthes et accessoires de finition'] },
  { name: 'Nettoyage fin de chantier',                type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 1800, max: 2200 },
    etapes: ['Évacuation des déchets et matériels résiduels', 'Nettoyage approfondi sols, vitres et sanitaires', 'Contrôle visuel et levée des réserves'] },
  { name: 'Installation échafaudage R+4',             type: 'prest', lot: 'couverture',  unit: 'forfait', price: { min: 6000, max: 7000 },
    etapes: ['Étude des charges et plan de calepinage', 'Montage par sapiteurs habilités', 'Vérification, contreventement et garde-corps'] },
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
  // v3 : ajout des étapes cohérentes par prestation → bump pour forcer reseed
  const storageKey = `fixit_prestations_btp_v3_${artisan?.id || 'guest'}`

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
  const [localEtapes, setLocalEtapes] = useState<string[]>([])

  function openCreate() {
    setEditing(null)
    setForm({
      name: '', type: cat,
      lot: cat === 'prest' ? activeLot : (availableLots[0]?.key || 'gros_oeuvre'),
      unit: 'm²',
      price: { min: 0, max: 0 },
      priceAchat: cat === 'mat' ? { min: 0, max: 0 } : null,
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
    })
    setPriceRange(p.price.min !== p.price.max)
    setAchatRange(Boolean(p.priceAchat && p.priceAchat.min !== p.priceAchat.max))
    setLocalEtapes(p.etapes ? [...p.etapes] : [])
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
      ? localEtapes.map((s) => s.trim()).filter(Boolean)
      : undefined

    if (editing) {
      persist(items.map((i) => i.id === editing.id ? { ...i, ...form, price, priceAchat, etapes } : i))
    } else {
      const nextId = Math.max(0, ...items.map((i) => i.id)) + 1
      persist([...items, { id: nextId, ...form, price, priceAchat, etapes }])
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
        .prest-fg input, .prest-fg select { width: 100%; padding: 7px 9px; border: 1px solid #E0E0E0; border-radius: 4px; font-size: 12px; font-family: inherit; }
        .prest-fg input:focus, .prest-fg select:focus { outline: none; border-color: #FFC107; }
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
                  <th style={{ textAlign: 'right' }}>{isPt ? 'Ações' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.25rem', color: '#BBB' }}>{isPt ? 'Nenhuma prestação neste lote.' : 'Aucune prestation dans ce lot.'}</td></tr>
                )}
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="prest-unit">{p.unit}</span></td>
                    <td className="prix">{renderRange(p.price)}{unitSuffix(p.unit)}</td>
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
              <div style={{
                marginTop: 8, marginBottom: 12, padding: '8px 10px',
                background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: 0.3 }}>
                    {isPt ? 'ETAPAS' : 'ÉTAPES'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLocalEtapes((prev) => [...prev, ''])}
                    style={{ fontSize: 10, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    + {isPt ? 'Adicionar' : 'Ajouter'}
                  </button>
                </div>
                {localEtapes.length === 0 && (
                  <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>
                    {isPt ? 'Nenhuma etapa. Clique + Adicionar.' : 'Aucune étape. Cliquez + Ajouter.'}
                  </div>
                )}
                {localEtapes.map((et, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', lineHeight: 1.6 }}>
                    <span style={{ color: '#999', fontSize: 11, minWidth: 16 }}>{i + 1}.</span>
                    <input
                      type="text"
                      value={et}
                      placeholder={isPt ? 'Ex: Diagnóstico visual' : 'Ex: Diagnostic visuel'}
                      onChange={(e) => setLocalEtapes((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                      style={{ flex: 1, fontSize: 12, color: '#555', background: 'transparent', border: 'none', borderBottom: '1px solid #e5e7eb', outline: 'none', padding: '2px 0' }}
                    />
                    <button
                      type="button"
                      onClick={() => setLocalEtapes((prev) => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#ccc' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: '#999', marginTop: 6, fontStyle: 'italic' }}>
                  {isPt ? 'As etapas serão automaticamente adicionadas aos orçamentos com esta prestação.' : 'Les étapes seront automatiquement ajoutées aux devis utilisant cette prestation.'}
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
