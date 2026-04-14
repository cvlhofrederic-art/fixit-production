'use client'

/**
 * PrestationsBTPSection — Fusion Bibliothèque + Lots/Prestations pour pro_societe BTP.
 *
 * Équivalent BTP de la section « Motifs » côté artisan : c'est le catalogue que
 * le client voit (prestations proposées, fourchettes de prix, unités).
 *
 * Design repris 1:1 du fichier de référence `vitfix_btp_dashboardpro_v8_prestations.html` :
 * - 3 catégories principales : Corps d'état / Matériaux / Main d'œuvre
 * - Sous-onglets par corps de métier, filtrés par la spécialité de la société
 * - Tableau : Prestation | Unité | Prix fourni HT | Prix posé HT | Actions (Modifier)
 * - Prix fixe OU fourchette (ex : 35 € – 45 € /m²) — les prix BTP sont rarement figés
 */

import { useEffect, useMemo, useState } from 'react'
import type { Artisan } from '@/lib/types'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface PrestationsBTPSectionProps {
  artisan: Artisan
  orgRole?: OrgRole
  navigateTo?: (page: string) => void
}

type PrestType = 'corps' | 'mat' | 'mo'

type PriceRange = { min: number; max: number } // min === max ⇒ prix fixe

interface Prestation {
  id: number
  name: string
  type: PrestType
  lot: string            // corps d'état (ex: 'gros_oeuvre', 'electricite', …)
  unit: string           // m², ml, u, m³, kg, rl, h, sac, forfait
  priceFourni: PriceRange | null  // prix matériau seul (null si N/A)
  pricePose: PriceRange | null    // prix posé (inclut MO)
  ref?: string           // référence produit (matériaux)
  supplier?: string      // fournisseur (matériaux)
  corps?: string         // corps d'état associé (main d'œuvre)
  marge?: number         // marge % (main d'œuvre)
}

/* ─────────────────────────── CATALOGUE DES LOTS ───────────────────────────
   Chaque lot connaît ses mots-clés de rattachement à la « specialty » de la
   société. Le composant n'affiche que les lots dont au moins un mot-clé matche
   — si aucun ne matche (entreprise généraliste), tous les lots s'affichent.  */
interface LotDef { key: string; label: string; keywords: string[] }

const LOTS: LotDef[] = [
  { key: 'gros_oeuvre', label: 'Gros Œuvre',            keywords: ['macon', 'maçon', 'gros oeuvre', 'gros-oeuvre', 'beton', 'béton', 'terrassement', 'fondation', 'demolition', 'démolition', 'batipro', 'general', 'général'] },
  { key: 'couverture',  label: 'Couverture',            keywords: ['couv', 'charpent', 'toiture', 'zingu', 'etancheite', 'étanchéité'] },
  { key: 'plomberie',   label: 'Plomberie / CVC',       keywords: ['plomb', 'canalisa', 'chauff', 'cvc', 'sanitaire', 'clim'] },
  { key: 'electricite', label: 'Électricité',           keywords: ['elec', 'élec', 'courant', 'domotique', 'vmc'] },
  { key: 'menuiseries', label: 'Menuiseries',           keywords: ['menuis', 'fenetre', 'fenêtre', 'porte', 'volet', 'serrurerie'] },
  { key: 'peinture',    label: 'Peinture / Revêtements', keywords: ['peint', 'revetem', 'revêtem', 'carrel', 'faience', 'faïence', 'sol', 'ravalement', 'facade', 'façade', 'platr', 'plâtr', 'enduit'] },
]

const UNITS = ['m²', 'ml', 'm³', 'u', 'kg', 'sac', 'rl', 'h', 'forfait', 'jour', 'semaine'] as const

/* ───────────────────────── SEED PAR DÉFAUT ─────────────────────────
   Identique au HTML de référence : mêmes prestations, mêmes prix.      */
const SEED_CORPS: Omit<Prestation, 'id'>[] = [
  // Gros Œuvre
  { name: 'Maçonnerie courante',        type: 'corps', lot: 'gros_oeuvre', unit: 'm²',  priceFourni: { min: 85, max: 85 },   pricePose: { min: 130, max: 130 } },
  { name: 'Béton armé coulé',           type: 'corps', lot: 'gros_oeuvre', unit: 'm³',  priceFourni: { min: 320, max: 320 }, pricePose: { min: 480, max: 480 } },
  { name: 'Ferraillage',                type: 'corps', lot: 'gros_oeuvre', unit: 'kg',  priceFourni: { min: 2.8, max: 2.8 }, pricePose: { min: 5.5, max: 5.5 } },
  { name: 'Coffrage traditionnel',      type: 'corps', lot: 'gros_oeuvre', unit: 'm²',  priceFourni: { min: 45, max: 45 },   pricePose: { min: 75, max: 75 } },
  { name: 'Démolition / Décapage',      type: 'corps', lot: 'gros_oeuvre', unit: 'm³',  priceFourni: { min: 55, max: 55 },   pricePose: { min: 90, max: 90 } },
  { name: 'Enduit monocouche',          type: 'corps', lot: 'gros_oeuvre', unit: 'm²',  priceFourni: { min: 12, max: 12 },   pricePose: { min: 35, max: 45 } }, // exemple fourchette
  { name: 'Cloison placo BA13',         type: 'corps', lot: 'gros_oeuvre', unit: 'm²',  priceFourni: { min: 6, max: 6 },     pricePose: { min: 28, max: 36 } },
  // Couverture
  { name: 'Tuiles mécaniques',          type: 'corps', lot: 'couverture',  unit: 'm²',  priceFourni: { min: 22, max: 22 },   pricePose: { min: 60, max: 70 } },
  { name: 'Zinguerie / Gouttières',     type: 'corps', lot: 'couverture',  unit: 'ml',  priceFourni: { min: 12, max: 12 },   pricePose: { min: 35, max: 42 } },
  { name: 'Charpente traditionnelle',   type: 'corps', lot: 'couverture',  unit: 'm²',  priceFourni: { min: 55, max: 55 },   pricePose: { min: 110, max: 130 } },
  { name: 'Étanchéité bitumineuse',     type: 'corps', lot: 'couverture',  unit: 'm²',  priceFourni: { min: 18, max: 18 },   pricePose: { min: 48, max: 55 } },
  // Plomberie / CVC
  { name: 'Réseau EU/EP PVC Ø100',      type: 'corps', lot: 'plomberie',   unit: 'ml',  priceFourni: { min: 8, max: 8 },     pricePose: { min: 38, max: 45 } },
  { name: 'Alimentation cuivre Ø16',    type: 'corps', lot: 'plomberie',   unit: 'ml',  priceFourni: { min: 9, max: 9 },     pricePose: { min: 26, max: 30 } },
  { name: 'Sanitaire complet (WC+lavabo)', type: 'corps', lot: 'plomberie', unit: 'u',  priceFourni: { min: 480, max: 480 }, pricePose: { min: 1100, max: 1300 } },
  { name: 'Tube PER Ø20',               type: 'corps', lot: 'plomberie',   unit: 'ml',  priceFourni: { min: 2.8, max: 2.8 }, pricePose: { min: 10, max: 14 } },
  { name: 'Chaudière gaz condensation', type: 'corps', lot: 'plomberie',   unit: 'u',   priceFourni: { min: 1200, max: 1200 }, pricePose: { min: 2000, max: 2400 } },
  // Électricité
  { name: 'Point lumineux complet',     type: 'corps', lot: 'electricite', unit: 'u',   priceFourni: { min: 28, max: 28 },   pricePose: { min: 85, max: 105 } },
  { name: 'Prise de courant 2P+T',      type: 'corps', lot: 'electricite', unit: 'u',   priceFourni: { min: 18, max: 18 },   pricePose: { min: 60, max: 70 } },
  { name: 'Tableau électrique 18 mod.', type: 'corps', lot: 'electricite', unit: 'u',   priceFourni: { min: 220, max: 220 }, pricePose: { min: 800, max: 900 } },
  { name: 'Câble R2V 3G2.5 — 100m',     type: 'corps', lot: 'electricite', unit: 'rl',  priceFourni: { min: 89, max: 89 },   pricePose: null },
  { name: 'VMC hygroréglable type B',   type: 'corps', lot: 'electricite', unit: 'u',   priceFourni: { min: 180, max: 180 }, pricePose: { min: 390, max: 450 } },
  // Menuiseries
  { name: 'Fenêtre PVC double vitrage', type: 'corps', lot: 'menuiseries', unit: 'u',   priceFourni: { min: 180, max: 180 }, pricePose: { min: 320, max: 380 } },
  { name: 'Porte intérieure alvéolaire', type: 'corps', lot: 'menuiseries', unit: 'u',  priceFourni: { min: 120, max: 120 }, pricePose: { min: 260, max: 300 } },
  { name: 'Porte blindée A2P',          type: 'corps', lot: 'menuiseries', unit: 'u',   priceFourni: { min: 850, max: 850 }, pricePose: { min: 1400, max: 1600 } },
  { name: 'Volet roulant électrique',   type: 'corps', lot: 'menuiseries', unit: 'u',   priceFourni: { min: 290, max: 290 }, pricePose: { min: 480, max: 560 } },
  // Peinture / Revêtements
  { name: 'Peinture acrylique mate (2 couches)', type: 'corps', lot: 'peinture', unit: 'm²', priceFourni: { min: 4, max: 4 },   pricePose: { min: 15, max: 22 } },
  { name: 'Revêtement sol souple vinyl',         type: 'corps', lot: 'peinture', unit: 'm²', priceFourni: { min: 12, max: 12 }, pricePose: { min: 32, max: 38 } },
  { name: 'Carrelage grès cérame posé',          type: 'corps', lot: 'peinture', unit: 'm²', priceFourni: { min: 25, max: 25 }, pricePose: { min: 50, max: 60 } },
  { name: 'Ravalement façade projeté',           type: 'corps', lot: 'peinture', unit: 'm²', priceFourni: { min: 8, max: 8 },   pricePose: { min: 28, max: 36 } },
  { name: 'Faïence murale posée',                type: 'corps', lot: 'peinture', unit: 'm²', priceFourni: { min: 18, max: 18 }, pricePose: { min: 42, max: 54 } },
]

const SEED_MAT: Omit<Prestation, 'id'>[] = [
  { name: 'Enduit monocouche 25 kg',         type: 'mat', lot: 'gros_oeuvre', unit: 'sac', ref: 'Weber.pral M',  supplier: 'Point P', priceFourni: { min: 15.5, max: 15.5 }, pricePose: { min: 22, max: 26 } },
  { name: 'Tube PER Ø20 — 100 m',            type: 'mat', lot: 'plomberie',   unit: 'rl',  ref: 'Comap',         supplier: 'Cedeo',   priceFourni: { min: 58, max: 58 },     pricePose: { min: 85, max: 98 } },
  { name: 'Câble R2V 3G2.5 — 100 m',         type: 'mat', lot: 'electricite', unit: 'rl',  ref: 'Nexans',        supplier: 'Rexel',   priceFourni: { min: 89, max: 89 },     pricePose: { min: 125, max: 145 } },
  { name: 'Carrelage grès cérame 60×60',     type: 'mat', lot: 'peinture',    unit: 'm²',  ref: 'Porcelanosa',   supplier: 'Point P', priceFourni: { min: 22, max: 22 },     pricePose: { min: 35, max: 42 } },
  { name: 'Laine de verre 100 mm',           type: 'mat', lot: 'gros_oeuvre', unit: 'm²',  ref: 'Isover',        supplier: 'Point P', priceFourni: { min: 6.8, max: 6.8 },   pricePose: { min: 10, max: 12 } },
  { name: 'Canalisation PVC Ø100',           type: 'mat', lot: 'plomberie',   unit: 'ml',  ref: 'Nicoll',        supplier: 'Cedeo',   priceFourni: { min: 5.2, max: 5.2 },   pricePose: { min: 8, max: 10 } },
  { name: 'Plaque BA13 standard',            type: 'mat', lot: 'gros_oeuvre', unit: 'm²',  ref: 'Placo',         supplier: 'Point P', priceFourni: { min: 4.5, max: 4.5 },   pricePose: { min: 6, max: 8 } },
  { name: 'Tuiles mécaniques terre cuite',   type: 'mat', lot: 'couverture',  unit: 'u',   ref: 'Terreal',       supplier: 'Point P', priceFourni: { min: 1.2, max: 1.2 },   pricePose: { min: 1.9, max: 2.3 } },
  { name: "Béton prêt à l'emploi C25/30",    type: 'mat', lot: 'gros_oeuvre', unit: 'm³',  ref: 'Cemex',         supplier: 'Cemex',   priceFourni: { min: 115, max: 115 },   pricePose: { min: 150, max: 170 } },
]

const SEED_MO: Omit<Prestation, 'id'>[] = [
  { name: 'Chef de chantier',                type: 'mo', lot: 'tous',        unit: 'h', priceFourni: { min: 52, max: 52 }, pricePose: { min: 70, max: 80 }, corps: 'Tous corps',    marge: 44 },
  { name: 'Maçon N3P2',                      type: 'mo', lot: 'gros_oeuvre', unit: 'h', priceFourni: { min: 38, max: 38 }, pricePose: { min: 50, max: 60 }, corps: 'Gros Œuvre',    marge: 45 },
  { name: 'Électricien N3P1',                type: 'mo', lot: 'electricite', unit: 'h', priceFourni: { min: 40, max: 40 }, pricePose: { min: 54, max: 62 }, corps: 'Électricité',   marge: 45 },
  { name: 'Plombier / Chauffagiste',         type: 'mo', lot: 'plomberie',   unit: 'h', priceFourni: { min: 42, max: 42 }, pricePose: { min: 58, max: 66 }, corps: 'Plomberie/CVC', marge: 48 },
  { name: 'Peintre en bâtiment',             type: 'mo', lot: 'peinture',    unit: 'h', priceFourni: { min: 34, max: 34 }, pricePose: { min: 44, max: 52 }, corps: 'Peinture',      marge: 41 },
  { name: 'Charpentier / Couvreur',          type: 'mo', lot: 'couverture',  unit: 'h', priceFourni: { min: 41, max: 41 }, pricePose: { min: 56, max: 64 }, corps: 'Couverture',    marge: 46 },
  { name: 'Menuisier poseur',                type: 'mo', lot: 'menuiseries', unit: 'h', priceFourni: { min: 38, max: 38 }, pricePose: { min: 52, max: 60 }, corps: 'Menuiseries',   marge: 47 },
  { name: 'Manœuvre / Aide',                 type: 'mo', lot: 'tous',        unit: 'h', priceFourni: { min: 24, max: 24 }, pricePose: { min: 32, max: 36 }, corps: 'Tous corps',    marge: 42 },
  { name: 'Heure supplémentaire (×1.25)',    type: 'mo', lot: 'tous',        unit: 'h', priceFourni: { min: 47, max: 47 }, pricePose: { min: 62, max: 72 }, corps: 'Tous corps',    marge: 45 },
]

/* ─────────────────────────── HELPERS ─────────────────────────── */
function formatPrice(v: number): string {
  // 2 décimales si < 10 sinon entier, virgule française
  const fixed = v < 10 && v % 1 !== 0 ? v.toFixed(2) : Math.round(v).toString()
  return fixed.replace('.', ',') + ' €'
}

function renderRange(range: PriceRange | null): string {
  if (!range) return '—'
  if (range.min === range.max) return formatPrice(range.min)
  return `${formatPrice(range.min)} – ${formatPrice(range.max)}`
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
  const storageKey = `fixit_prestations_btp_${artisan?.id || 'guest'}`

  const [items, setItems] = useState<Prestation[]>([])
  const [cat, setCat] = useState<PrestType>('corps')
  const [search, setSearch] = useState('')

  const availableLots = useMemo(() => detectLotsFromArtisan(artisan), [artisan])
  const [activeLot, setActiveLot] = useState<string>(() => availableLots[0]?.key || 'gros_oeuvre')

  // Si availableLots change (ex: profile update) et que l'onglet courant a disparu → reset
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
        const all = [...SEED_CORPS, ...SEED_MAT, ...SEED_MO].map((p, i) => ({ id: i + 1, ...p }))
        setItems(all)
        try { localStorage.setItem(storageKey, JSON.stringify(all)) } catch (e) { console.warn('[prestations] seed', e) }
      }
    } catch {
      setItems([...SEED_CORPS, ...SEED_MAT, ...SEED_MO].map((p, i) => ({ id: i + 1, ...p })))
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
    if (cat === 'corps') {
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
    name: '', type: 'corps', lot: availableLots[0]?.key || 'gros_oeuvre', unit: 'm²',
    priceFourni: { min: 0, max: 0 }, pricePose: { min: 0, max: 0 },
  })
  // toggles « fourchette » pour chaque colonne prix
  const [fourniRange, setFourniRange] = useState(false)
  const [poseRange, setPoseRange] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm({
      name: '', type: cat,
      lot: cat === 'corps' ? activeLot : (availableLots[0]?.key || 'gros_oeuvre'),
      unit: cat === 'mo' ? 'h' : 'm²',
      priceFourni: { min: 0, max: 0 },
      pricePose: { min: 0, max: 0 },
    })
    setFourniRange(false)
    setPoseRange(false)
    setModal(true)
  }

  function openEdit(p: Prestation) {
    setEditing(p)
    setForm({
      name: p.name, type: p.type, lot: p.lot, unit: p.unit,
      priceFourni: p.priceFourni ? { ...p.priceFourni } : { min: 0, max: 0 },
      pricePose: p.pricePose ? { ...p.pricePose } : { min: 0, max: 0 },
      ref: p.ref, supplier: p.supplier, corps: p.corps, marge: p.marge,
    })
    setFourniRange(Boolean(p.priceFourni && p.priceFourni.min !== p.priceFourni.max))
    setPoseRange(Boolean(p.pricePose && p.pricePose.min !== p.pricePose.max))
    setModal(true)
  }

  function handleSave() {
    if (!form.name.trim()) return
    // Normaliser les prix : si pas de fourchette, max = min
    const priceFourni = form.priceFourni
      ? { min: form.priceFourni.min, max: fourniRange ? form.priceFourni.max : form.priceFourni.min }
      : null
    const pricePose = form.pricePose
      ? { min: form.pricePose.min, max: poseRange ? form.pricePose.max : form.pricePose.min }
      : null

    if (editing) {
      persist(items.map((i) => i.id === editing.id ? { ...i, ...form, priceFourni, pricePose } : i))
    } else {
      const nextId = Math.max(0, ...items.map((i) => i.id)) + 1
      persist([...items, { id: nextId, ...form, priceFourni, pricePose }])
    }
    setModal(false)
  }

  function handleDelete(id: number) {
    persist(items.filter((i) => i.id !== id))
  }

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
        .prest-tbl .prix { font-weight: 700; color: #1a1a1a; white-space: nowrap; }
        .prest-tbl .prix-pose { color: #F57C00; font-weight: 700; white-space: nowrap; }
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
        <p>Catalogue corps d&apos;état, matériaux et main d&apos;œuvre — c&apos;est ce que vos clients voient</p>
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
            <button className={`prest-cat-btn${cat === 'corps' ? ' active' : ''}`} onClick={() => setCat('corps')}>🏗️ Corps d&apos;état</button>
            <button className={`prest-cat-btn${cat === 'mat' ? ' active' : ''}`} onClick={() => setCat('mat')}>🧱 Matériaux</button>
            <button className={`prest-cat-btn${cat === 'mo' ? ' active' : ''}`} onClick={() => setCat('mo')}>👷 Main d&apos;œuvre</button>
          </div>
          <button className="v5-btn v5-btn-p" onClick={openCreate}>+ Ajouter</button>
        </div>
      </div>

      {/* PANEL : CORPS D'ÉTAT (avec sous-onglets) */}
      {cat === 'corps' && (
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
                  <th>Prix fourni HT</th>
                  <th>Prix posé HT</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.25rem', color: '#BBB' }}>Aucune prestation dans ce lot.</td></tr>
                )}
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="prest-unit">{p.unit}</span></td>
                    <td className="prix">{renderRange(p.priceFourni)}</td>
                    <td className="prix-pose">{renderRange(p.pricePose)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="v5-btn v5-btn-sm" onClick={() => openEdit(p)}>Modifier</button>
                      <button className="v5-btn v5-btn-sm v5-btn-d" style={{ marginLeft: 4 }} onClick={() => handleDelete(p.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="prest-add-row" onClick={openCreate}>＋ Ajouter une prestation {availableLots.find((l) => l.key === activeLot)?.label || ''}</div>
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
                    <td className="prix">{renderRange(p.priceFourni)}</td>
                    <td className="prix-pose">{renderRange(p.pricePose)}</td>
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

      {/* PANEL : MAIN D'ŒUVRE */}
      {cat === 'mo' && (
        <div className="prest-panel">
          <div className="v5-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="prest-tbl">
              <thead>
                <tr>
                  <th>Qualification / Poste</th>
                  <th>Unité</th>
                  <th>Coût interne HT</th>
                  <th>Taux de vente HT</th>
                  <th>Marge</th>
                  <th>Corps d&apos;état</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.25rem', color: '#BBB' }}>Aucune qualification configurée.</td></tr>
                )}
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="prest-unit">{p.unit}</span></td>
                    <td className="prix">{renderRange(p.priceFourni)}</td>
                    <td className="prix-pose">{renderRange(p.pricePose)}</td>
                    <td><span className="v5-badge v5-badge-green">+{p.marge ?? 0}%</span></td>
                    <td style={{ color: '#666' }}>{p.corps || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="v5-btn v5-btn-sm" onClick={() => openEdit(p)}>Modifier</button>
                      <button className="v5-btn v5-btn-sm v5-btn-d" style={{ marginLeft: 4 }} onClick={() => handleDelete(p.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="prest-add-row" onClick={openCreate}>＋ Ajouter une qualification</div>
          </div>
        </div>
      )}

      {/* ──────── MODAL ──────── */}
      {modal && (
        <div className="prest-modal-ov" onClick={() => setModal(false)}>
          <div className="prest-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? 'Modifier la prestation' : 'Nouvelle prestation'}</h3>

            <div className="prest-fg">
              <label>Désignation *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Maçonnerie courante" />
            </div>

            <div className="prest-row-2">
              <div className="prest-fg">
                <label>Catégorie</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PrestType })}>
                  <option value="corps">Corps d&apos;état</option>
                  <option value="mat">Matériau</option>
                  <option value="mo">Main d&apos;œuvre</option>
                </select>
              </div>
              <div className="prest-fg">
                <label>{form.type === 'mo' ? 'Rattachement' : 'Corps d\u2019état / Lot'}</label>
                <select value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })}>
                  {form.type === 'mo' && <option value="tous">Tous corps</option>}
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
              {form.type === 'mat' && (
                <div className="prest-fg">
                  <label>Référence / Marque</label>
                  <input type="text" value={form.ref || ''} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="Ex: Weber.pral M" />
                </div>
              )}
              {form.type === 'mo' && (
                <div className="prest-fg">
                  <label>Marge (%)</label>
                  <input type="number" min="0" value={form.marge ?? ''} onChange={(e) => setForm({ ...form, marge: e.target.value === '' ? undefined : parseFloat(e.target.value) })} />
                </div>
              )}
              {form.type === 'corps' && <div />}
            </div>

            {form.type === 'mat' && (
              <div className="prest-fg">
                <label>Fournisseur</label>
                <input type="text" value={form.supplier || ''} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Ex: Point P, Cedeo, Rexel" />
              </div>
            )}

            {/* Prix fourni HT */}
            <div className="prest-price-block">
              <div className="prest-price-head">
                <span>{form.type === 'mat' ? 'Prix achat HT (€)' : form.type === 'mo' ? 'Coût interne HT (€)' : 'Prix fourni HT (€)'}</span>
                <label className="prest-range-toggle">
                  <input type="checkbox" checked={fourniRange} onChange={(e) => setFourniRange(e.target.checked)} />
                  Fourchette
                </label>
              </div>
              <div className="prest-row-2">
                <div className="prest-fg" style={{ margin: 0 }}>
                  <label>{fourniRange ? 'Min' : 'Prix'}</label>
                  <input type="number" step="0.01" min="0" value={form.priceFourni?.min ?? ''}
                    onChange={(e) => setForm({ ...form, priceFourni: { min: parseFloat(e.target.value) || 0, max: form.priceFourni?.max ?? 0 } })} />
                </div>
                <div className="prest-fg" style={{ margin: 0, opacity: fourniRange ? 1 : 0.35 }}>
                  <label>Max</label>
                  <input type="number" step="0.01" min="0" disabled={!fourniRange} value={form.priceFourni?.max ?? ''}
                    onChange={(e) => setForm({ ...form, priceFourni: { min: form.priceFourni?.min ?? 0, max: parseFloat(e.target.value) || 0 } })} />
                </div>
              </div>
            </div>

            {/* Prix posé HT */}
            <div className="prest-price-block">
              <div className="prest-price-head">
                <span>{form.type === 'mat' ? 'Prix vente HT (€)' : form.type === 'mo' ? 'Taux de vente HT (€)' : 'Prix posé HT (€)'}</span>
                <label className="prest-range-toggle">
                  <input type="checkbox" checked={poseRange} onChange={(e) => setPoseRange(e.target.checked)} />
                  Fourchette
                </label>
              </div>
              <div className="prest-row-2">
                <div className="prest-fg" style={{ margin: 0 }}>
                  <label>{poseRange ? 'Min' : 'Prix'}</label>
                  <input type="number" step="0.01" min="0" value={form.pricePose?.min ?? ''}
                    onChange={(e) => setForm({ ...form, pricePose: { min: parseFloat(e.target.value) || 0, max: form.pricePose?.max ?? 0 } })} />
                </div>
                <div className="prest-fg" style={{ margin: 0, opacity: poseRange ? 1 : 0.35 }}>
                  <label>Max</label>
                  <input type="number" step="0.01" min="0" disabled={!poseRange} value={form.pricePose?.max ?? ''}
                    onChange={(e) => setForm({ ...form, pricePose: { min: form.pricePose?.min ?? 0, max: parseFloat(e.target.value) || 0 } })} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                Astuce : les prix BTP varient selon chantier — activez « Fourchette » pour afficher une plage (ex : 35 € – 45 € /m²).
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
