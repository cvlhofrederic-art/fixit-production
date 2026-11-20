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
 * Catalogue vierge à la création du compte, en France comme au Portugal (demande de Frédéric du 17/11/2026) :
 * aucune prestation ni aucun matériau d'exemple n'est proposé ni enregistré, la société saisit les siens. Un
 * catalogue déjà enregistré (y compris l'ancien catalogue d'exemple d'un compte créé avant) s'affiche tel quel.
 *
 * Prix fixe OU fourchette (ex : 35 € – 45 € /m²) — les prix BTP sont rarement figés.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useLocale } from '@/lib/i18n/context'
import { surActivationClavier } from '@/lib/a11y/activation-clavier'
import { supabase } from '@/lib/supabase'
import type { Artisan } from '@/lib/types'
import {
  lireCatalogueAuServeur, lireCatalogueLocal, prendreServicePublie, rangerServicesParNom, reporterLiensServices,
  appliquerLiensServices, type LienService, type LigneServicePublie, type ServicesParNom,
} from '@/lib/btp/catalogue-prestations'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface PrestationsBTPSectionProps {
  artisan: Artisan
  orgRole?: OrgRole
  navigateTo?: (page: string) => void
}

type PrestType = 'prest' | 'mat' | 'frais'

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
  etapes?: Array<{ label: string; price?: number; unit?: string }>  // étapes d'exécution (prestations) — injectées dans les devis
  // id de la ligne correspondante dans la table `services` (null pour les
  // matériaux qui ne sont pas exposés publiquement)
  supabase_id?: string | null
  // Indique que cette ligne doit être resynchronisée après modification locale
  _dirty?: boolean
}

/* ─────────────────────────── CATALOGUE DES LOTS ───────────────────────────
   Chaque lot connaît ses mots-clés de rattachement à la « specialty » de la
   société. Le composant n'affiche que les lots dont au moins un mot-clé matche
   — si aucun ne matche (entreprise généraliste), tous les lots s'affichent.  */
interface LotDef { key: string; label: string; labelPt: string; keywords: string[] }

const LOTS: LotDef[] = [
  { key: 'gros_oeuvre', label: 'Gros Œuvre',             labelPt: 'Estrutura e alvenaria',     keywords: ['macon', 'maçon', 'gros oeuvre', 'gros-oeuvre', 'beton', 'béton', 'terrassement', 'fondation', 'demolition', 'démolition', 'batipro', 'general', 'général', 'placo', 'cloison'] },
  { key: 'couverture',  label: 'Couverture',             labelPt: 'Cobertura',                 keywords: ['couv', 'charpent', 'toiture', 'zingu', 'etancheite', 'étanchéité'] },
  { key: 'plomberie',   label: 'Plomberie / CVC',        labelPt: 'Canalização / AVAC',        keywords: ['plomb', 'canalisa', 'chauff', 'cvc', 'sanitaire', 'clim'] },
  { key: 'electricite', label: 'Électricité',            labelPt: 'Eletricidade',              keywords: ['elec', 'élec', 'courant', 'domotique', 'vmc'] },
  { key: 'menuiseries', label: 'Menuiseries',            labelPt: 'Carpintaria e caixilharia', keywords: ['menuis', 'fenetre', 'fenêtre', 'porte', 'volet', 'serrurerie'] },
  { key: 'peinture',    label: 'Peinture / Revêtements', labelPt: 'Pintura / Revestimentos',   keywords: ['peint', 'revetem', 'revêtem', 'carrel', 'faience', 'faïence', 'sol', 'ravalement', 'facade', 'façade', 'platr', 'plâtr', 'enduit', 'isolation'] },
]

const libelleLot = (lot: LotDef, isPt: boolean) => (isPt ? lot.labelPt : lot.label)

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

/** Unités enregistrées (abréviations françaises) affichées en portugais ; la valeur enregistrée ne change pas. */
const UNITES_PT: Record<string, string> = {
  pce: 'pç', ens: 'cj', lot: 'lote', sac: 'saco', rl: 'rolo', palette: 'palete', benne: 'contentor', camion: 'camião',
  jour: 'dia', semaine: 'semana', forfait: 'vg',
}
const uniteAffichee = (unite: string, isPt: boolean) => (isPt ? UNITES_PT[unite] ?? unite : unite)

/* ─────────────────────────── SYNC SUPABASE ───────────────────────────
   Les prestations (type='prest') sont exposées publiquement sur la fiche
   artisan via la table `services`. Les matériaux (type='mat') restent
   strictement locaux — jamais écrits en DB.                               */
function prestationToServicePayload(p: Omit<Prestation, 'id'>, artisanId: string) {
  const rangeTag = `[unit:${p.unit}|min:${p.price.min}|max:${p.price.max}]`
  const description = `${p.description || ''} ${rangeTag}`.trim()
  return {
    artisan_id: artisanId,
    name: p.name,
    description,
    duration_minutes: null,
    price_ht: p.price.min,
    price_ttc: p.price.max,
    active: true,
  }
}

/**
 * Services déjà publiés par ce module pour la fiche, par nom (lib/btp/catalogue-prestations.ts) ; null si la lecture
 * échoue (rien n'est alors publié).
 */
async function lireServicesPublies(artisanId: string): Promise<ServicesParNom | null> {
  try {
    const { data, error } = await supabase.from('services').select('id, name, description, duration_minutes').eq('artisan_id', artisanId)
    if (error) { console.warn('[prestations] lecture des services publiés impossible', error); return null }
    return rangerServicesParNom((data || []) as LigneServicePublie[])
  } catch (e) {
    console.warn('[prestations] lecture des services publiés impossible', e)
    return null
  }
}

async function upsertPrestationToSupabase(p: Prestation, artisanId: string): Promise<string | null> {
  if (p.type !== 'prest') return null
  const payload = prestationToServicePayload(p, artisanId)
  try {
    if (p.supabase_id) {
      const { data, error } = await supabase.from('services').update(payload).eq('id', p.supabase_id).select('id').single()
      if (error) { console.warn('[prestations] supabase update failed', error); return p.supabase_id }
      return data?.id || p.supabase_id
    } else {
      const { data, error } = await supabase.from('services').insert(payload).select('id').single()
      if (error) { console.warn('[prestations] supabase insert failed', error); return null }
      return data?.id || null
    }
  } catch (e) {
    console.warn('[prestations] supabase sync threw', e)
    return p.supabase_id || null
  }
}

/**
 * Rattrapage au chargement d'une prestation qui n'a pas d'identifiant de service : un service du même nom déjà
 * publié par ce module pour la fiche, et relié à aucun autre élément du catalogue (`pris`, complété ici), est repris
 * tel quel au lieu d'être créé une seconde fois sur la fiche publique (constat stockage-local-miroir-5) ; sinon la
 * prestation est publiée comme avant. Un service créé ailleurs n'est jamais repris.
 */
async function publierSansDoublon(p: Prestation, artisanId: string, publies: ServicesParNom, pris: Set<string>): Promise<string | null> {
  if (p.type !== 'prest') return null
  return prendreServicePublie(publies, p.name, pris) ?? upsertPrestationToSupabase(p, artisanId)
}

async function deletePrestationFromSupabase(supabaseId: string): Promise<void> {
  try {
    const { error } = await supabase.from('services').delete().eq('id', supabaseId)
    if (error) console.warn('[prestations] supabase delete failed', error)
  } catch (e) {
    console.warn('[prestations] supabase delete threw', e)
  }
}

/* ─────────────────────────── HELPERS ─────────────────────────── */
function formatPrice(v: number): string {
  const fixed = v < 10 && v % 1 !== 0 ? v.toFixed(2) : Math.round(v).toString()
  return fixed.replace('.', ',') + ' €'
}

/** Séparateur d'une fourchette : demi-cadratin en français, « a » en portugais (« 55 € a 75 € »). */
const separateurFourchette = (isPt: boolean) => (isPt ? ' a ' : ' – ')

function renderRange(range: PriceRange | null | undefined, isPt = false): string {
  if (!range) return '—'
  if (range.min === range.max) return formatPrice(range.min)
  return `${formatPrice(range.min)}${separateurFourchette(isPt)}${formatPrice(range.max)}`
}

function unitSuffix(unit: string, isPt = false): string {
  if (unit === 'forfait') return ''
  return ` / ${uniteAffichee(unit, isPt)}`
}

// Prix TTC affiché : taux normal du pays de la langue (20 % en France, 23 % d'IVA au Portugal continental).
function rangeTTC(range: PriceRange | null | undefined, isPt = false, tva = isPt ? 23 : 20): string {
  if (!range) return '—'
  const minTTC = range.min * (1 + tva / 100)
  const maxTTC = range.max * (1 + tva / 100)
  if (range.min === range.max) return formatPrice(minTTC)
  return `${formatPrice(minTTC)}${separateurFourchette(isPt)}${formatPrice(maxTTC)}`
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
  // Clé v5 : celle sous laquelle les sociétés ont déjà leur catalogue ; ne pas la changer.
  const storageKey = `fixit_prestations_btp_v5_${artisan?.id || 'guest'}`

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

  // Chargement : le catalogue enregistré pour la fiche, tel quel. `etatCatalogue` vaut « charge » quand la liste
  // affichée est le catalogue de la société (navigateur ou serveur), ou la liste vide d'une société qui n'en a nulle
  // part (catalogue vierge à la création du compte, sans exemple), et « echec » quand le serveur n'a pas pu dire ce
  // qu'il détient (une modification refusée dans cet état relance la lecture : catalogueModifiable). Tant qu'il ne vaut
  // pas « charge », rien n'est publié ni enregistré. Rien n'est écrit au chargement : ni catalogue d'exemple, ni liste
  // vide qui pourrait remplacer, par le miroir du stockage, un catalogue pas encore revenu du serveur.
  const [etatCatalogue, setEtatCatalogue] = useState<'chargement' | 'charge' | 'echec'>('chargement')
  // Nombre de relectures demandées après un échec : chacune relance le chargement ci-dessous.
  const [relectures, setRelectures] = useState(0)
  const catalogueCharge = etatCatalogue === 'charge'
  useEffect(() => {
    if (!artisan?.id) return
    let annule = false
    setEtatCatalogue('chargement')
    const local = lireCatalogueLocal<Prestation>(storageKey)
    if (local.etat === 'present') {
      setItems(local.catalogue)
      setEtatCatalogue('charge')
      return
    }
    // Rien de lisible dans ce navigateur (compte neuf, appareil neuf, données du site effacées, restauration depuis le
    // serveur pas encore arrivée ou en échec) : le serveur dit s'il détient un catalogue pour ce compte. S'il en a un,
    // il s'affiche sans rien écrire ici (constat stockage-local-miroir-5) ; s'il n'en a aucun, la liste reste vide.
    void lireCatalogueAuServeur<Prestation>(storageKey).then((serveur) => {
      if (annule) return
      if (serveur.etat === 'present') {
        setItems(serveur.catalogue)
        setEtatCatalogue('charge')
        return
      }
      if (serveur.etat === 'absent') {
        // La restauration a pu recopier le catalogue pendant la question au serveur. Sinon, catalogue vide, et rien
        // n'est écrit (une valeur illisible déjà enregistrée reste telle quelle).
        const relu = lireCatalogueLocal<Prestation>(storageKey)
        setItems(relu.etat === 'present' ? relu.catalogue : [])
        setEtatCatalogue('charge')
        return
      }
      setEtatCatalogue('echec')
      toast.error(isPt
        ? 'Catálogo de serviços indisponível: não foi possível verificar o que está guardado na sua conta. Recarregue a página; nada foi alterado.'
        : 'Catalogue de prestations indisponible : impossible de vérifier celui enregistré pour votre compte. Rechargez la page ; rien n\'a été modifié.')
    })
    return () => { annule = true }
  }, [artisan?.id, storageKey, isPt, relectures])

  /** Reporte des identifiants de services sur l'écran et dans le catalogue enregistré, relu au moment d'écrire. */
  function reporterLiens(liens: LienService[], affiche: Prestation[]) {
    setItems((prev) => appliquerLiensServices(prev, liens))
    reporterLiensServices(storageKey, liens, () => affiche)
  }

  // Backfill Supabase : synchronise les prestations du localStorage qui n'ont
  // pas encore de supabase_id. Assure la visibilité publique des prestations
  // pour les comptes sociétés/BTP (bug : catalogue en localStorage jamais exposé).
  const backfilledRef = useRef(false)
  useEffect(() => {
    if (!artisan?.id || !catalogueCharge) return
    if (backfilledRef.current) return
    if (items.length === 0) return
    const toBackfill = items.filter((p) => p.type === 'prest' && !p.supabase_id)
    if (toBackfill.length === 0) { backfilledRef.current = true; return }
    backfilledRef.current = true
    const affiche = items
    ;(async () => {
      const publies = await lireServicesPublies(artisan.id)
      if (!publies) return
      const pris = new Set(affiche.map((p) => p.supabase_id).filter((id): id is string => !!id))
      const liens: LienService[] = []
      for (const p of toBackfill) {
        const newId = await publierSansDoublon(p, artisan.id, publies, pris)
        if (newId) liens.push({ id: p.id, name: p.name, type: p.type, supabase_id: newId })
      }
      if (liens.length === 0) return
      // Le catalogue enregistré est relu au moment d'écrire (lib/btp/catalogue-prestations.ts) : la restauration
      // depuis le serveur a pu le remplacer pendant la publication.
      setItems((prev) => appliquerLiensServices(prev, liens))
      reporterLiensServices(storageKey, liens, () => affiche)
    })()
  }, [artisan?.id, items, storageKey, catalogueCharge])

  /**
   * Rien ne s'enregistre tant que le catalogue de la société n'est pas chargé : l'écran l'écraserait. Après un échec du
   * chargement, la modification refusée relance la lecture (navigateur, puis serveur) : la restauration depuis le
   * serveur a pu arriver, ou le réseau revenir, entre-temps. Elle reste refusée : la liste affichée n'est pas celle de
   * la société, la modification est à refaire une fois son catalogue affiché.
   */
  function catalogueModifiable(): boolean {
    if (catalogueCharge) return true
    if (etatCatalogue === 'echec') {
      setRelectures((n) => n + 1)
      toast.error(isPt
        ? 'Catálogo de serviços indisponível: nova tentativa de carregamento em curso; nada foi alterado. Volte a tentar quando o catálogo aparecer.'
        : 'Catalogue de prestations indisponible : nouvelle tentative de chargement en cours ; rien n\'a été modifié. Recommencez une fois le catalogue affiché.')
    } else {
      toast.error(isPt
        ? 'Catálogo ainda a carregar: aguarde um instante antes de o alterar.'
        : 'Catalogue en cours de chargement : patientez un instant avant de le modifier.')
    }
    return false
  }

  function persist(next: Prestation[]) {
    // Le rattrapage ci-dessus ne vaut que pour le catalogue trouvé au chargement : passé la première saisie, chaque
    // enregistrement publie lui-même ce qu'il change. Sans cela, la première prestation d'un catalogue parti vide
    // serait publiée deux fois (par l'enregistrement et par le rattrapage, déclenché par la liste qui change).
    backfilledRef.current = true
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
  const [localEtapes, setLocalEtapes] = useState<Array<{ label: string; price?: number; unit?: string }>>([])

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

  async function handleSave() {
    if (!form.name.trim()) return
    if (!catalogueModifiable()) return
    // Une modification ne s'applique qu'au même élément de la liste affichée maintenant (même identifiant, même nom,
    // même type, comme appliquerLiensServices), repris avec ses données à jour, identifiant de service compris : jamais
    // à un autre élément, ni au service publié d'un élément qui n'est plus affiché (liste d'une fiche précédente).
    const actuel = editing ? items.find((i) => i.id === editing.id && i.name === editing.name && i.type === editing.type) : undefined
    if (editing && !actuel) {
      toast.error(isPt
        ? 'Este elemento já não corresponde ao catálogo apresentado: nada foi alterado. Cancele e volte a abri-lo a partir da lista para o editar.'
        : 'Cet élément ne correspond plus au catalogue affiché : rien n\'a été modifié. Annulez, puis rouvrez-le depuis la liste pour le modifier.')
      return
    }
    const price = {
      min: form.price.min,
      max: priceRange ? form.price.max : form.price.min,
    }
    const priceAchat = form.type === 'mat' && form.priceAchat
      ? { min: form.priceAchat.min, max: achatRange ? form.priceAchat.max : form.priceAchat.min }
      : null

    const etapes = form.type === 'prest'
      ? localEtapes.map((e) => ({
          label: e.label.trim(),
          ...(e.price != null && e.price > 0 ? { price: e.price } : {}),
          ...(e.unit ? { unit: e.unit } : {}),
        })).filter(e => e.label)
      : undefined

    const description = form.type === 'prest' && form.description?.trim() ? form.description.trim() : undefined

    // Ferme la modale immédiatement — la sync Supabase est non-bloquante
    setModal(false)

    if (actuel) {
      const updated: Prestation = { ...actuel, ...form, price, priceAchat, etapes, description }
      const next = items.map((i) => i === actuel ? updated : i)
      persist(next)
      if (artisan?.id && updated.type === 'prest') {
        const supabase_id = await upsertPrestationToSupabase(updated, artisan.id)
        if (supabase_id && supabase_id !== updated.supabase_id) {
          reporterLiens([{ id: updated.id, name: updated.name, type: updated.type, supabase_id }], next)
        }
      }
    } else {
      const nextId = Math.max(0, ...items.map((i) => i.id)) + 1
      const created: Prestation = { id: nextId, ...form, price, priceAchat, etapes, description }
      const next = [...items, created]
      persist(next)
      if (artisan?.id && created.type === 'prest') {
        const supabase_id = await upsertPrestationToSupabase(created, artisan.id)
        if (supabase_id) {
          reporterLiens([{ id: created.id, name: created.name, type: created.type, supabase_id }], next)
        }
      }
    }
  }

  async function handleDelete(id: number) {
    if (!catalogueModifiable()) return
    const target = items.find((i) => i.id === id)
    persist(items.filter((i) => i.id !== id))
    if (target?.supabase_id) {
      await deletePrestationFromSupabase(target.supabase_id)
    }
  }

  const lotActif = availableLots.find((l) => l.key === activeLot)
  const currentLotLabel = lotActif ? libelleLot(lotActif, isPt) : ''

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
        <h1>{isPt ? 'Serviços' : 'Prestations'}</h1>
        <p>{isPt ? 'Catálogo de serviços e materiais: é o que os seus clientes veem' : 'Catalogue de prestations et matériaux — c\'est ce que vos clients voient'}</p>
      </div>

      {/* Barre haute : recherche + switch catégorie + bouton ajout */}
      <div className="prest-top">
        <div className="v5-search" style={{ margin: 0, flex: 1, minWidth: 220 }}>
          <input
            className="v5-search-in"
            placeholder={isPt ? 'Pesquisar um serviço, um material…' : 'Rechercher une prestation, un matériau…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', flexWrap: 'wrap' }}>
          <div className="prest-cat-bar">
            <button className={`prest-cat-btn${cat === 'prest' ? ' active' : ''}`} onClick={() => setCat('prest')}>🏗️ {isPt ? 'Serviços' : 'Prestations'}</button>
            <button className={`prest-cat-btn${cat === 'mat' ? ' active' : ''}`} onClick={() => setCat('mat')}>🧱 {isPt ? 'Materiais' : 'Matériaux'}</button>
            <button className={`prest-cat-btn${cat === 'frais' ? ' active' : ''}`} onClick={() => setCat('frais')}>💰 {isPt ? 'Despesas diversas' : 'Frais divers'}</button>
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
                {libelleLot(lot, isPt)}
              </button>
            ))}
          </div>

          <div className="v5-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="prest-tbl">
              <thead>
                <tr>
                  <th>{isPt ? 'Serviço' : 'Prestation'}</th>
                  <th>{isPt ? 'Unidade' : 'Unité'}</th>
                  <th>{isPt ? 'Preço s/ IVA' : 'Prix HT'}</th>
                  <th>{isPt ? 'Preço c/ IVA' : 'Prix TTC'}</th>
                  <th style={{ textAlign: 'right' }}>{isPt ? 'Ações' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.25rem', color: '#BBB' }}>{isPt ? 'Nenhum serviço neste lote.' : 'Aucune prestation dans ce lot.'}</td></tr>
                )}
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="prest-unit">{uniteAffichee(p.unit, isPt)}</span></td>
                    <td className="prix">{renderRange(p.price, isPt)}{unitSuffix(p.unit, isPt)}</td>
                    <td style={{ color: '#888', fontSize: 11 }}>{rangeTTC(p.price, isPt)}{unitSuffix(p.unit, isPt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="v5-btn v5-btn-sm" onClick={() => openEdit(p)}>{isPt ? 'Editar' : 'Modifier'}</button>
                      <button className="v5-btn v5-btn-sm v5-btn-d" style={{ marginLeft: 4 }} onClick={() => handleDelete(p.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="prest-add-row" role="button" tabIndex={0} onClick={openCreate} onKeyDown={surActivationClavier(openCreate)}>＋ {isPt ? `Adicionar um serviço (${currentLotLabel})` : `Ajouter une prestation ${currentLotLabel}`}</div>
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
                  <th>{isPt ? 'Preço de compra s/ IVA' : 'Prix achat HT'}</th>
                  <th>{isPt ? 'Preço de venda s/ IVA' : 'Prix vente HT'}</th>
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
                    <td><span className="prest-unit">{uniteAffichee(p.unit, isPt)}</span></td>
                    <td className="prix-achat">{renderRange(p.priceAchat, isPt)}</td>
                    <td className="prix">{renderRange(p.price, isPt)}</td>
                    <td>{p.supplier || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="v5-btn v5-btn-sm" onClick={() => openEdit(p)}>{isPt ? 'Editar' : 'Modifier'}</button>
                      <button className="v5-btn v5-btn-sm v5-btn-d" style={{ marginLeft: 4 }} onClick={() => handleDelete(p.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="prest-add-row" role="button" tabIndex={0} onClick={openCreate} onKeyDown={surActivationClavier(openCreate)}>＋ {isPt ? 'Adicionar um material' : 'Ajouter un matériau'}</div>
          </div>
        </div>
      )}

      {/* PANEL : FRAIS DIVERS — coûts transverses au chantier (déplacement, déchèterie, location matériel, etc.)
          Hors catalogue public : la sync vers la table `services` (consultée par le client sur la fiche publique)
          est gardée par type==='prest', donc 'frais' reste invisible côté parcours client. Mais ces frais sont
          intégrables dans un devis via la section "Frais annexes" du DevisFactureFormBTP. */}
      {cat === 'frais' && (
        <div className="prest-panel">
          <div className="v5-alert" style={{ marginBottom: 10, fontSize: 12, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6 }}>
            <span style={{ fontSize: 14 }}>🔒</span>
            <span>{isPt ? 'Catálogo interno: não aparece no perfil público que o cliente consulta. Pode ser incluído nos orçamentos como despesa anexa.' : 'Catalogue interne — n\'apparaît pas sur la fiche publique consultée par le client. Peut être inclus dans les devis comme frais annexe.'}</span>
          </div>
          <div className="v5-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="prest-tbl">
              <thead>
                <tr>
                  <th>{isPt ? 'Designação' : 'Désignation'}</th>
                  <th>{isPt ? 'Unidade' : 'Unité'}</th>
                  <th>{isPt ? 'Preço s/ IVA' : 'Prix HT'}</th>
                  <th>{isPt ? 'Preço c/ IVA' : 'Prix TTC'}</th>
                  <th style={{ textAlign: 'right' }}>{isPt ? 'Ações' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.25rem', color: '#BBB' }}>{isPt ? 'Nenhuma despesa registada.' : 'Aucun frais divers enregistré.'}</td></tr>
                )}
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="prest-unit">{uniteAffichee(p.unit, isPt)}</span></td>
                    <td className="prix">{renderRange(p.price, isPt)}{unitSuffix(p.unit, isPt)}</td>
                    <td style={{ color: '#888', fontSize: 11 }}>{rangeTTC(p.price, isPt)}{unitSuffix(p.unit, isPt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="v5-btn v5-btn-sm" onClick={() => openEdit(p)}>{isPt ? 'Editar' : 'Modifier'}</button>
                      <button className="v5-btn v5-btn-sm v5-btn-d" style={{ marginLeft: 4 }} onClick={() => handleDelete(p.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="prest-add-row" role="button" tabIndex={0} onClick={openCreate} onKeyDown={surActivationClavier(openCreate)}>＋ {isPt ? 'Adicionar uma despesa' : 'Ajouter un frais divers'}</div>
          </div>
        </div>
      )}

      {/* ──────── MODAL ──────── */}
      {modal && (
        <div className="prest-modal-ov" onClick={() => setModal(false)}>
          <div className="prest-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing
              ? (isPt ? `Editar ${form.type === 'mat' ? 'material' : form.type === 'frais' ? 'despesa' : 'serviço'}` : `Modifier ${form.type === 'mat' ? 'le matériau' : form.type === 'frais' ? 'le frais divers' : 'la prestation'}`)
              : (isPt ? `${form.type === 'mat' ? 'Nova referência de material' : form.type === 'frais' ? 'Nova despesa' : 'Novo serviço'}` : `Nouveau ${form.type === 'mat' ? 'matériau (référence)' : form.type === 'frais' ? 'frais divers' : 'prestation'}`)
            }</h3>

            <div className="prest-fg">
              <label>{isPt ? 'Designação *' : 'Désignation *'}</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={
                form.type === 'mat' ? (isPt ? 'Ex: Telhas cerâmicas' : 'Ex: Tuiles mécaniques terre cuite')
                : form.type === 'frais' ? (isPt ? 'Ex: Deslocação, Aluguer de andaime, Limpeza' : 'Ex: Déplacement, Location échafaudage, Évacuation déchèterie')
                : (isPt ? 'Ex: Laje de betão' : 'Ex: Dalle béton')
              } />
            </div>

            {form.type === 'prest' && (
              <div className="prest-fg">
                <label>{isPt ? 'Descrição do serviço' : 'Description du motif'}</label>
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
                  <option value="prest">{isPt ? 'Serviço (cliente)' : 'Prestation (client)'}</option>
                  <option value="mat">{isPt ? 'Material (interno)' : 'Matériau (interne)'}</option>
                  <option value="frais">{isPt ? 'Despesa diversa (interno)' : 'Frais divers (interne)'}</option>
                </select>
              </div>
              {form.type !== 'frais' && (
                <div className="prest-fg">
                  <label>{isPt ? 'Especialidade / Lote' : 'Corps d\'état / Lot'}</label>
                  <select value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })}>
                    {availableLots.map((l) => <option key={l.key} value={l.key}>{libelleLot(l, isPt)}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="prest-row-2">
              <div className="prest-fg">
                <label>{isPt ? 'Unidade' : 'Unité'}</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u} value={u}>{uniteAffichee(u, isPt)}</option>)}
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
                    <label>{achatRange ? (isPt ? 'Mín.' : 'Min') : (isPt ? 'Preço' : 'Prix')}</label>
                    <input type="number" step="0.01" min="0" value={form.priceAchat?.min ?? ''}
                      onChange={(e) => setForm({ ...form, priceAchat: { min: parseFloat(e.target.value) || 0, max: form.priceAchat?.max ?? 0 } })} />
                  </div>
                  <div className="prest-fg" style={{ margin: 0, opacity: achatRange ? 1 : 0.35 }}>
                    <label>{isPt ? 'Máx.' : 'Max'}</label>
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
                    onClick={() => setLocalEtapes((prev) => [...prev, { label: '', unit: form.unit }])}
                    style={{ fontSize: 10, color: '#F57C00', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  >
                    + {isPt ? 'Adicionar' : 'Ajouter'}
                  </button>
                </div>
                {localEtapes.length === 0 && (
                  <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic', padding: '4px 0' }}>
                    {isPt ? 'Nenhuma etapa. Clique em + Adicionar.' : 'Aucune étape. Cliquez + Ajouter.'}
                  </div>
                )}
                {localEtapes.map((et, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 7, marginBottom: 7 }}>
                    {/* Rectangle blanc : numéro + désignation (hauteur alignée sur le motif) */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #E0E0E0', borderRadius: 4, padding: '0 11px', minHeight: 36 }}>
                      <span style={{ color: '#999', fontSize: 12, fontWeight: 600, marginRight: 9, minWidth: 16 }}>{i + 1}.</span>
                      <input
                        type="text"
                        value={et.label}
                        placeholder={isPt ? 'Ex: Diagnóstico visual' : 'Ex: Diagnostic visuel'}
                        onChange={(e) => setLocalEtapes((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                        style={{ flex: 1, fontSize: 12.5, color: '#1a1a1a', background: 'transparent', border: 'none', outline: 'none', padding: '10px 0', width: '100%', fontFamily: 'inherit' }}
                      />
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
                    ? 'Etapas adicionadas automaticamente aos orçamentos.'
                    : 'Étapes ajoutées automatiquement aux devis.'}
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
                  <label>{priceRange ? (isPt ? 'Mín.' : 'Min') : (isPt ? 'Preço' : 'Prix')}</label>
                  <input type="number" step="0.01" min="0" value={form.price.min ?? ''}
                    onChange={(e) => setForm({ ...form, price: { min: parseFloat(e.target.value) || 0, max: form.price.max } })} />
                </div>
                <div className="prest-fg" style={{ margin: 0, opacity: priceRange ? 1 : 0.35 }}>
                  <label>{isPt ? 'Máx.' : 'Max'}</label>
                  <input type="number" step="0.01" min="0" disabled={!priceRange} value={form.price.max ?? ''}
                    onChange={(e) => setForm({ ...form, price: { min: form.price.min, max: parseFloat(e.target.value) || 0 } })} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                {isPt ? 'Dica: os preços das obras variam; ative «Intervalo» para mostrar uma amplitude (ex.: 350 € a 450 € / m²).' : 'Astuce : les prix BTP varient selon chantier — activez « Fourchette » pour afficher une plage (ex : 350 € – 450 € /m²).'}
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
