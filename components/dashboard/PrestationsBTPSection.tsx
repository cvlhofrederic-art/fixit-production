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
import type { Artisan } from '@/lib/types'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface PrestationsBTPSectionProps {
  artisan: Artisan
  orgRole?: OrgRole
  navigateTo?: (page: string) => void
}

type PrestType = 'prest' | 'mat'

type PriceRange = { min: number; max: number } // min === max ⇒ prix fixe

interface Prestation {
  id: number
  name: string
  type: PrestType
  lot: string            // corps d'état (ex: 'gros_oeuvre', 'electricite', …)
  unit: string           // m², ml, u, m³, kg, rl, h, sac, forfait
  price: PriceRange      // prix vendu au client (prestation) ou prix de vente (matériau)
  priceAchat?: PriceRange | null // matériaux : prix d'achat interne
  ref?: string           // référence produit (matériaux)
  supplier?: string      // fournisseur (matériaux)
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
const SEED_PREST: Omit<Prestation, 'id'>[] = [
  // ── Gros Œuvre / Démolition ─────────────────────────────────────────────
  { name: 'Démolition cloisons + évacuation gravats', type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 2000, max: 3500 } },
  { name: 'Terrassement + fondations',                type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 7500, max: 9500 } },
  { name: 'Élévation murs parpaing',                  type: 'prest', lot: 'gros_oeuvre', unit: 'm²',     price: { min: 160, max: 200 } },
  { name: 'Dalle béton',                              type: 'prest', lot: 'gros_oeuvre', unit: 'm²',     price: { min: 55, max: 75 } },
  { name: 'Dépose sanitaires existants',              type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 1000, max: 1400 } },
  { name: 'Placo BA13 — fourniture + pose',           type: 'prest', lot: 'gros_oeuvre', unit: 'm²',     price: { min: 40, max: 50 } },
  { name: 'Faux plafond acoustique',                  type: 'prest', lot: 'gros_oeuvre', unit: 'm²',     price: { min: 50, max: 60 } },

  // ── Couverture / Charpente ──────────────────────────────────────────────
  { name: 'Charpente + couverture tuiles',            type: 'prest', lot: 'couverture',  unit: 'forfait', price: { min: 13000, max: 15000 } },
  { name: 'Zinguerie gouttières + EP',                type: 'prest', lot: 'couverture',  unit: 'forfait', price: { min: 4500, max: 5500 } },

  // ── Plomberie / CVC ─────────────────────────────────────────────────────
  { name: 'Plomberie SDB + cuisine',                  type: 'prest', lot: 'plomberie',   unit: 'forfait', price: { min: 3800, max: 4500 } },
  { name: 'Plomberie complète logement',              type: 'prest', lot: 'plomberie',   unit: 'forfait', price: { min: 2500, max: 3000 } },
  { name: 'Plomberie sanitaires local commercial',    type: 'prest', lot: 'plomberie',   unit: 'forfait', price: { min: 5000, max: 6000 } },
  { name: 'Douche italienne + paroi',                 type: 'prest', lot: 'plomberie',   unit: 'forfait', price: { min: 2000, max: 2400 } },
  { name: 'Meuble vasque + miroir',                   type: 'prest', lot: 'plomberie',   unit: 'forfait', price: { min: 1500, max: 2000 } },

  // ── Électricité ─────────────────────────────────────────────────────────
  { name: 'Mise aux normes électrique NFC 15-100',    type: 'prest', lot: 'electricite', unit: 'forfait', price: { min: 4500, max: 7500 } },
  { name: 'Électricité + plomberie extension',        type: 'prest', lot: 'electricite', unit: 'forfait', price: { min: 6000, max: 6500 } },

  // ── Menuiseries ─────────────────────────────────────────────────────────
  { name: 'Menuiserie alu (par pièce)',               type: 'prest', lot: 'menuiseries', unit: 'u',       price: { min: 2500, max: 3200 } },
  { name: 'Vitrine commerciale alu',                  type: 'prest', lot: 'menuiseries', unit: 'forfait', price: { min: 8000, max: 9000 } },

  // ── Peinture / Revêtements ──────────────────────────────────────────────
  { name: 'Peinture 2 couches intérieure',            type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 25, max: 30 } },
  { name: 'Peinture façade 2 couches',                type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 22, max: 28 } },
  { name: 'Enduit monocouche façade',                 type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 38, max: 45 } },
  { name: 'Nettoyage HP façade',                      type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 10, max: 14 } },
  { name: 'Carrelage sol SDB',                        type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 80, max: 100 } },
  { name: 'Faïence murale',                           type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 70, max: 85 } },
  { name: 'Parquet stratifié',                        type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 48, max: 55 } },
  { name: 'Isolation thermique extérieure (ITE)',     type: 'prest', lot: 'peinture',    unit: 'm²',     price: { min: 110, max: 130 } },

  // ── Finitions / Divers ──────────────────────────────────────────────────
  { name: 'Finitions intérieures globales',           type: 'prest', lot: 'peinture',    unit: 'forfait', price: { min: 8500, max: 10500 } },
  { name: 'Nettoyage fin de chantier',                type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 1800, max: 2200 } },
  { name: 'Installation échafaudage R+4',             type: 'prest', lot: 'couverture',  unit: 'forfait', price: { min: 6000, max: 7000 } },
]

/* ───────────────────────── SEED MATÉRIAUX ─────────────────────────
   Gestion interne des matières / fournisseurs (prix achat → vente).   */
const SEED_MAT: Omit<Prestation, 'id'>[] = [
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
  // v2 : fusion corps + MO + seed cohérent devis démo → bump pour forcer reseed
  const storageKey = `fixit_prestations_btp_v2_${artisan?.id || 'guest'}`

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

    if (editing) {
      persist(items.map((i) => i.id === editing.id ? { ...i, ...form, price, priceAchat } : i))
    } else {
      const nextId = Math.max(0, ...items.map((i) => i.id)) + 1
      persist([...items, { id: nextId, ...form, price, priceAchat }])
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
        <h1>Prestations</h1>
        <p>Catalogue de prestations et matériaux — c&apos;est ce que vos clients voient</p>
      </div>

      {/* Barre haute : recherche + switch catégorie + bouton ajout */}
      <div className="prest-top">
        <div className="v5-search" style={{ margin: 0, flex: 1, minWidth: 220 }}>
          <input
            className="v5-search-in"
            placeholder="Rechercher une prestation, un matériau…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', flexWrap: 'wrap' }}>
          <div className="prest-cat-bar">
            <button className={`prest-cat-btn${cat === 'prest' ? ' active' : ''}`} onClick={() => setCat('prest')}>🏗️ Prestations</button>
            <button className={`prest-cat-btn${cat === 'mat' ? ' active' : ''}`} onClick={() => setCat('mat')}>🧱 Matériaux</button>
          </div>
          <button className="v5-btn v5-btn-p" onClick={openCreate}>+ Ajouter</button>
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
                  <th>Prestation</th>
                  <th>Unité</th>
                  <th>Prix HT</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.25rem', color: '#BBB' }}>Aucune prestation dans ce lot.</td></tr>
                )}
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="prest-unit">{p.unit}</span></td>
                    <td className="prix">{renderRange(p.price)}{unitSuffix(p.unit)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="v5-btn v5-btn-sm" onClick={() => openEdit(p)}>Modifier</button>
                      <button className="v5-btn v5-btn-sm v5-btn-d" style={{ marginLeft: 4 }} onClick={() => handleDelete(p.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="prest-add-row" onClick={openCreate}>＋ Ajouter une prestation {currentLotLabel}</div>
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
                  <th>Désignation matériau</th>
                  <th>Réf. / Marque</th>
                  <th>Unité</th>
                  <th>Prix achat HT</th>
                  <th>Prix vente HT</th>
                  <th>Fournisseur</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.25rem', color: '#BBB' }}>Aucun matériau référencé.</td></tr>
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
                      <button className="v5-btn v5-btn-sm" onClick={() => openEdit(p)}>Modifier</button>
                      <button className="v5-btn v5-btn-sm v5-btn-d" style={{ marginLeft: 4 }} onClick={() => handleDelete(p.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="prest-add-row" onClick={openCreate}>＋ Ajouter un matériau</div>
          </div>
        </div>
      )}

      {/* ──────── MODAL ──────── */}
      {modal && (
        <div className="prest-modal-ov" onClick={() => setModal(false)}>
          <div className="prest-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? `Modifier ${form.type === 'mat' ? 'le matériau' : 'la prestation'}` : `Nouvelle ${form.type === 'mat' ? 'référence matériau' : 'prestation'}`}</h3>

            <div className="prest-fg">
              <label>Désignation *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.type === 'mat' ? 'Ex: Tuiles mécaniques terre cuite' : 'Ex: Dalle béton'} />
            </div>

            <div className="prest-row-2">
              <div className="prest-fg">
                <label>Catégorie</label>
                <select value={form.type} onChange={(e) => {
                  const newType = e.target.value as PrestType
                  setForm({
                    ...form,
                    type: newType,
                    priceAchat: newType === 'mat' ? (form.priceAchat || { min: 0, max: 0 }) : null,
                  })
                }}>
                  <option value="prest">Prestation (client)</option>
                  <option value="mat">Matériau (interne)</option>
                </select>
              </div>
              <div className="prest-fg">
                <label>Corps d&apos;état / Lot</label>
                <select value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })}>
                  {availableLots.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
              </div>
            </div>

            <div className="prest-row-2">
              <div className="prest-fg">
                <label>Unité</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              {form.type === 'mat' ? (
                <div className="prest-fg">
                  <label>Référence / Marque</label>
                  <input type="text" value={form.ref || ''} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="Ex: Weber.pral M" />
                </div>
              ) : (
                <div />
              )}
            </div>

            {form.type === 'mat' && (
              <div className="prest-fg">
                <label>Fournisseur</label>
                <input type="text" value={form.supplier || ''} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Ex: Point P, Cedeo, Rexel" />
              </div>
            )}

            {/* Prix achat (matériaux uniquement) */}
            {form.type === 'mat' && (
              <div className="prest-price-block">
                <div className="prest-price-head">
                  <span>Prix achat HT (€)</span>
                  <label className="prest-range-toggle">
                    <input type="checkbox" checked={achatRange} onChange={(e) => setAchatRange(e.target.checked)} />
                    Fourchette
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

            {/* Prix vendu au client */}
            <div className="prest-price-block">
              <div className="prest-price-head">
                <span>{form.type === 'mat' ? 'Prix vente HT (€)' : 'Prix HT vendu au client (€)'}</span>
                <label className="prest-range-toggle">
                  <input type="checkbox" checked={priceRange} onChange={(e) => setPriceRange(e.target.checked)} />
                  Fourchette
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
                Astuce : les prix BTP varient selon chantier — activez « Fourchette » pour afficher une plage (ex : 350 € – 450 € /m²).
              </div>
            </div>

            <div className="prest-footer">
              <button className="v5-btn" onClick={() => setModal(false)}>Annuler</button>
              <button className="v5-btn v5-btn-p" onClick={handleSave} disabled={!form.name.trim()}>
                {editing ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
