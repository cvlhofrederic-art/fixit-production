'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useLocale } from '@/lib/i18n/context'
import type {
  Recipe,
  EstimationInput,
  EstimationResult,
  Geometry,
  ChantierProfile,
  MaterialNeed,
} from '@/lib/estimation-materiaux'
import { getRecipesByCountry, searchRecipes } from '@/lib/estimation-materiaux'
import './estimation-materiaux.css'

type Trade = Recipe['trade']
type Mode = 'form' | 'ia'

interface ProjectItem {
  uid: string
  recipeId: string
  recipeName: string
  recipeTrade: Trade
  geometry: Geometry
  label?: string
  dimsLabel: string
}

interface Props {
  artisan?: { id?: string } | null
  /**
   * Si true, affiche le sélecteur de corps de métier dans le mode IA.
   * Réservé au super-admin — les entreprises standards sont calibrées sur
   * leur(s) corps de métier attribué(s) côté profile (cf. props `allowedTrades`).
   */
  isAdminOverride?: boolean
  /**
   * Corps de métier autorisés pour cette entreprise. Si non renseigné ou vide :
   * tout le catalogue est accessible (défaut super-admin / test).
   * Si renseigné : l'IA est cantonnée à ces trades (anti-abus).
   */
  allowedTrades?: Trade[]
}

const TRADE_ICON: Record<Trade, string> = {
  maconnerie: '🏗️',
  placo: '🔨',
  peinture: '🎨',
  carrelage: '🟦',
  charpente: '🪵',
  couverture: '🏠',
  zinguerie: '💧',
  etancheite: '🧴',
  isolation: '🧶',
  facade: '🧱',
  menuiserie_ext: '🪟',
  menuiserie_int: '🚪',
  revetement_sol: '◻️',
  revetement_mural: '🎨',
  plomberie: '🚰',
  chauffage: '🔥',
  ventilation: '💨',
  climatisation: '❄️',
  electricite: '⚡',
  electricite_cfa: '📡',
  vrd: '🚧',
  assainissement: '🚽',
  cloture: '🔐',
  terrasse_ext: '🌳',
  jardin: '🌿',
  piscine: '🏊',
}

const TRADE_LABEL_FR: Record<Trade, string> = {
  maconnerie: 'Maçonnerie',
  placo: 'Placo',
  peinture: 'Peinture',
  carrelage: 'Carrelage',
  charpente: 'Charpente bois',
  couverture: 'Couverture',
  zinguerie: 'Zinguerie',
  etancheite: 'Étanchéité',
  isolation: 'Isolation thermique',
  facade: 'Façade / bardage',
  menuiserie_ext: 'Menuiseries extérieures',
  menuiserie_int: 'Menuiseries intérieures',
  revetement_sol: 'Revêtements de sol',
  revetement_mural: 'Revêtements muraux',
  plomberie: 'Plomberie sanitaire',
  chauffage: 'Chauffage',
  ventilation: 'Ventilation VMC',
  climatisation: 'Climatisation',
  electricite: 'Électricité',
  electricite_cfa: 'Courants faibles',
  vrd: 'Terrassement / VRD',
  assainissement: 'Assainissement',
  cloture: 'Clôtures & portails',
  terrasse_ext: 'Terrasses extérieures',
  jardin: 'Espaces verts',
  piscine: 'Piscine & spa',
}

const TRADE_LABEL_PT: Record<Trade, string> = {
  maconnerie: 'Alvenaria',
  placo: 'Pladur',
  peinture: 'Pintura',
  carrelage: 'Azulejo',
  charpente: 'Carpintaria de estrutura',
  couverture: 'Cobertura',
  zinguerie: 'Zincaria',
  etancheite: 'Impermeabilização',
  isolation: 'Isolamento térmico',
  facade: 'Fachada / revestimento',
  menuiserie_ext: 'Caixilharias exteriores',
  menuiserie_int: 'Carpintaria interior',
  revetement_sol: 'Revestimentos de piso',
  revetement_mural: 'Revestimentos de parede',
  plomberie: 'Canalização',
  chauffage: 'Aquecimento',
  ventilation: 'Ventilação VMC',
  climatisation: 'Ar condicionado',
  electricite: 'Eletricidade',
  electricite_cfa: 'Correntes fracas',
  vrd: 'Terraplanagem / Redes',
  assainissement: 'Saneamento',
  cloture: 'Vedações e portões',
  terrasse_ext: 'Terraços exteriores',
  jardin: 'Jardim',
  piscine: 'Piscina e spa',
}

function fr(n: number, decimals = 2): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals === 0 ? 0 : 0, maximumFractionDigits: decimals })
}

function formatQty(q: number, unit: string): string {
  if (unit === 'kg' && q >= 1000) return `${fr(q, 0)} kg`
  if (unit === 'm3' && q < 10) return fr(q, 2).replace('.', ',')
  if (q >= 100) return fr(q, 0)
  if (q >= 10) return fr(q, 1)
  return fr(q, 2)
}

function buildDimsLabel(recipe: Recipe, geo: Geometry): string {
  switch (recipe.geometryMode) {
    case 'volume': {
      if (geo.length && geo.width && geo.thickness !== undefined)
        return `${fr(geo.length, 1)} × ${fr(geo.width, 1)} m · épaisseur ${fr(geo.thickness * 100, 0)} cm`
      if (geo.area && geo.thickness !== undefined)
        return `${fr(geo.area, 1)} m² · épaisseur ${fr(geo.thickness * 100, 0)} cm`
      if (geo.volume !== undefined) return `${fr(geo.volume, 2)} m³`
      return ''
    }
    case 'area':
      if (geo.area !== undefined) return `${fr(geo.area, 1)} m²`
      if (geo.length && geo.width) return `${fr(geo.length, 1)} × ${fr(geo.width, 1)} m`
      return ''
    case 'area_minus_openings': {
      const parts: string[] = []
      if (geo.length && geo.height) parts.push(`${fr(geo.length, 1)} × ${fr(geo.height, 1)} m`)
      else if (geo.area) parts.push(`${fr(geo.area, 1)} m²`)
      if (geo.openings && geo.openings > 0) parts.push(`ouvertures ${fr(geo.openings, 1)} m²`)
      return parts.join(' · ')
    }
    case 'length':
      return `${fr(geo.length ?? geo.perimeter ?? 0, 1)} ml`
    case 'count':
      return `${geo.count ?? 0} u`
  }
}

function firstDTU(refs: string[]): string {
  return refs.find(r => r.startsWith('DTU')) || refs.find(r => r.startsWith('NF')) || refs[0] || '—'
}

/* ═══════════════════════════════════════════════════════════
   Panneau de paramétrage (ouvrage sélectionné)
   ═══════════════════════════════════════════════════════════ */
interface ParamPanelProps {
  recipe: Recipe
  editing: ProjectItem | null
  isPt: boolean
  onCancel: () => void
  onSave: (geo: Geometry, label?: string) => void
}

function ParamPanel({ recipe, editing, isPt, onCancel, onSave }: ParamPanelProps) {
  const mode = recipe.geometryMode
  const needsThickness = recipe.materials.some(m => m.geometryMultiplier === 'thickness')
  const needsHeight = recipe.materials.some(m => m.geometryMultiplier === 'height')
  const needsCoats = recipe.materials.some(m => m.geometryMultiplier === 'coats')

  // Dimensions stockées en tant que strings côté UI (saisie libre),
  // converties en nombres au moment de la sauvegarde.
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [thicknessCm, setThicknessCm] = useState('') // CM en UI, M dans geometry
  const [area, setArea] = useState('')
  const [volume, setVolume] = useState('')
  const [perimeter, setPerimeter] = useState('')
  const [openings, setOpenings] = useState('')
  const [count, setCount] = useState('')
  const [coats, setCoats] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Pré-remplit depuis un item en édition
  useEffect(() => {
    if (!editing) {
      setLength(''); setWidth(''); setHeight(''); setThicknessCm('')
      setArea(''); setVolume(''); setPerimeter(''); setOpenings('')
      setCount(''); setCoats(''); setLabel(''); setError(null)
      return
    }
    const g = editing.geometry
    setLength(g.length !== undefined ? String(g.length) : '')
    setWidth(g.width !== undefined ? String(g.width) : '')
    setHeight(g.height !== undefined ? String(g.height) : '')
    setThicknessCm(g.thickness !== undefined ? String(Math.round(g.thickness * 100)) : '')
    setArea(g.area !== undefined ? String(g.area) : '')
    setVolume(g.volume !== undefined ? String(g.volume) : '')
    setPerimeter(g.perimeter !== undefined ? String(g.perimeter) : '')
    setOpenings(g.openings !== undefined ? String(g.openings) : '')
    setCount(g.count !== undefined ? String(g.count) : '')
    setCoats(g.coats !== undefined ? String(g.coats) : '')
    setLabel(editing.label || '')
    setError(null)
  }, [editing])

  const num = (s: string) => (s === '' ? undefined : Number(s))

  // Récap live selon le mode : liste de paires [label, valeur]
  const summary = useMemo((): Array<[string, string]> | null => {
    if (mode === 'volume') {
      const L = parseFloat(length) || 0
      const l = parseFloat(width) || 0
      const e = (parseFloat(thicknessCm) || 0) / 100
      const S = L * l
      const V = S * e
      if (S <= 0) return null
      return [
        [isPt ? 'Superfície' : 'Surface', `${fr(S, 2)} m²`],
        ['Volume', `${fr(V, 2)} m³`],
      ]
    }
    if (mode === 'area') {
      const a = parseFloat(area) || (parseFloat(length) * parseFloat(width)) || 0
      if (a <= 0) return null
      return [[isPt ? 'Superfície' : 'Surface', `${fr(a, 2)} m²`]]
    }
    if (mode === 'area_minus_openings') {
      const L = parseFloat(length) || 0
      const h = parseFloat(height) || 0
      const o = parseFloat(openings) || 0
      const gross = L * h
      if (gross <= 0) return null
      const net = Math.max(0, gross - o)
      return [
        [isPt ? 'Bruta' : 'Brute', `${fr(gross, 2)} m²`],
        [isPt ? 'Líquida' : 'Nette', `${fr(net, 2)} m²`],
      ]
    }
    if (mode === 'length') {
      const L = parseFloat(length) || parseFloat(perimeter) || 0
      if (L <= 0) return null
      return [[isPt ? 'Comprimento' : 'Longueur', `${fr(L, 2)} m`]]
    }
    if (mode === 'count') {
      const c = parseInt(count) || 0
      if (c <= 0) return null
      return [[isPt ? 'Quantidade' : 'Quantité', `${c} u`]]
    }
    return null
  }, [mode, length, width, thicknessCm, area, height, openings, perimeter, count, isPt])

  const submit = () => {
    const geo: Geometry = {}
    const errors: string[] = []

    if (mode === 'volume') {
      const L = num(length), W = num(width)
      const ecm = num(thicknessCm), A = num(area), V = num(volume)
      if (V !== undefined) geo.volume = V
      if (L !== undefined) geo.length = L
      if (W !== undefined) geo.width = W
      if (A !== undefined) geo.area = A
      if (ecm !== undefined) geo.thickness = ecm / 100
      if (geo.volume === undefined && !(geo.length && geo.width && geo.thickness) && !(geo.area && geo.thickness)) {
        errors.push(isPt ? 'Indique comprimento+largura+espessura ou superfície+espessura ou volume.' : 'Indique longueur+largeur+épaisseur, surface+épaisseur, ou volume.')
      }
    } else if (mode === 'area') {
      const A = num(area), L = num(length), W = num(width)
      if (A !== undefined) geo.area = A
      else if (L && W) { geo.length = L; geo.width = W }
      else errors.push(isPt ? 'Indique a superfície.' : 'Indique la surface.')
    } else if (mode === 'area_minus_openings') {
      const L = num(length), H = num(height), A = num(area), O = num(openings)
      if (A !== undefined) geo.area = A
      else if (L && H) { geo.length = L; geo.height = H }
      else errors.push(isPt ? 'Indique comprimento×altura ou superfície.' : 'Indique longueur×hauteur ou surface.')
      if (O !== undefined) geo.openings = O
    } else if (mode === 'length') {
      const L = num(length), P = num(perimeter)
      if (L !== undefined) geo.length = L
      else if (P !== undefined) geo.perimeter = P
      else errors.push(isPt ? 'Indique o comprimento.' : 'Indique la longueur.')
    } else if (mode === 'count') {
      const c = num(count)
      if (c !== undefined) geo.count = c
      else errors.push(isPt ? 'Indique a quantidade.' : 'Indique la quantité.')
    }

    if (needsThickness && mode !== 'volume' && geo.thickness === undefined) {
      const ecm = num(thicknessCm)
      if (ecm !== undefined) geo.thickness = ecm / 100
    }
    if (needsHeight && geo.height === undefined) {
      const H = num(height)
      if (H !== undefined) geo.height = H
    }
    if (needsCoats) {
      const c = num(coats)
      if (c !== undefined) geo.coats = c
    }

    if (errors.length) { setError(errors.join(' ')); return }
    onSave(geo, label.trim() || undefined)
  }

  const thicknessHint = (() => {
    const c = recipe.constraints
    if (!c) return null
    if (c.minThickness === undefined && c.maxThickness === undefined) return null
    const minCm = c.minThickness !== undefined ? c.minThickness * 100 : null
    const maxCm = c.maxThickness !== undefined ? c.maxThickness * 100 : null
    const dtu = recipe.dtuReferences[0]?.code
    if (minCm !== null && maxCm !== null) return `${isPt ? 'entre' : 'entre'} ${fr(minCm, 0)} ${isPt ? 'e' : 'et'} ${fr(maxCm, 0)} cm${dtu ? ` (${dtu})` : ''}`
    if (minCm !== null) return `min ${fr(minCm, 0)} cm${dtu ? ` (${dtu})` : ''}`
    if (maxCm !== null) return `max ${fr(maxCm, 0)} cm${dtu ? ` (${dtu})` : ''}`
    return null
  })()

  return (
    <div className="param-panel show">
      <div className="param-header">
        <div className="param-title-wrap">
          <div className="param-title">{TRADE_ICON[recipe.trade]} {recipe.name}</div>
          {recipe.description && <div className="param-desc">{recipe.description}</div>}
        </div>
        <button type="button" className="param-close" onClick={onCancel} aria-label="Fermer">×</button>
      </div>

      <div className="param-label-field">
        <label>{isPt ? 'Etiqueta (opcional)' : 'Libellé (optionnel)'}</label>
        <input
          type="text"
          placeholder={isPt ? 'Ex: Laje fundação, Extensão…' : 'Ex : Dalle garage, Fondation extension…'}
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
      </div>

      <div className="param-grid">
        {(mode === 'volume' || mode === 'area_minus_openings' || mode === 'length') && (
          <div className="param-field">
            <label>{isPt ? 'Comprimento' : 'Longueur'}</label>
            <div className="param-input-wrap">
              <input type="number" step="0.1" value={length} onChange={e => setLength(e.target.value)} />
              <span className="param-unit">m</span>
            </div>
          </div>
        )}
        {mode === 'volume' && (
          <div className="param-field">
            <label>{isPt ? 'Largura' : 'Largeur'}</label>
            <div className="param-input-wrap">
              <input type="number" step="0.1" value={width} onChange={e => setWidth(e.target.value)} />
              <span className="param-unit">m</span>
            </div>
          </div>
        )}
        {(mode === 'area_minus_openings' || needsHeight) && (
          <div className="param-field">
            <label>{isPt ? 'Altura' : 'Hauteur'}</label>
            <div className="param-input-wrap">
              <input type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)} />
              <span className="param-unit">m</span>
            </div>
          </div>
        )}
        {(mode === 'volume' || needsThickness) && (
          <div className="param-field">
            <label>{isPt ? 'Espessura' : 'Épaisseur'}</label>
            <div className="param-input-wrap">
              <input type="number" step="1" value={thicknessCm} onChange={e => setThicknessCm(e.target.value)} />
              <span className="param-unit">cm</span>
            </div>
            {thicknessHint && <div className="hint">{thicknessHint}</div>}
          </div>
        )}
        {mode === 'area' && (
          <div className="param-field">
            <label>{isPt ? 'Superfície' : 'Surface'}</label>
            <div className="param-input-wrap">
              <input type="number" step="0.1" value={area} onChange={e => setArea(e.target.value)} />
              <span className="param-unit">m²</span>
            </div>
          </div>
        )}
        {mode === 'area_minus_openings' && (
          <div className="param-field">
            <label>{isPt ? 'Aberturas' : 'Ouvertures'}</label>
            <div className="param-input-wrap">
              <input type="number" step="0.1" value={openings} onChange={e => setOpenings(e.target.value)} />
              <span className="param-unit">m²</span>
            </div>
          </div>
        )}
        {mode === 'count' && (
          <div className="param-field">
            <label>{isPt ? 'Quantidade' : 'Nombre'}</label>
            <div className="param-input-wrap">
              <input type="number" step="1" value={count} onChange={e => setCount(e.target.value)} />
              <span className="param-unit">u</span>
            </div>
          </div>
        )}
        {needsCoats && (
          <div className="param-field">
            <label>{isPt ? 'Demãos' : 'Couches'}</label>
            <div className="param-input-wrap">
              <input type="number" step="1" value={coats} onChange={e => setCoats(e.target.value)} />
              <span className="param-unit">u</span>
            </div>
          </div>
        )}
      </div>

      {summary && (
        <div className="param-summary">
          <span>📐</span>
          <div>
            {summary.map(([label, value], i) => (
              <span key={label}>
                {i > 0 && ' · '}
                {label} : <strong>{value}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="param-summary" style={{ borderColor: '#FFB74D', background: '#FFF3E0', color: '#E65100' }}>
          <span>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      <div className="param-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          {isPt ? 'Cancelar' : 'Annuler'}
        </button>
        <button type="button" className="btn-add" onClick={submit}>
          {editing
            ? (isPt ? 'Guardar alterações' : 'Enregistrer les modifications')
            : `+ ${isPt ? 'Adicionar à obra' : 'Ajouter au chantier'}`}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Ligne de matériau (résultat, avec détail dépliable)
   ═══════════════════════════════════════════════════════════ */
function MatLine({ need, isPt }: { need: MaterialNeed; isPt: boolean }) {
  const [open, setOpen] = useState(false)
  const dtu = firstDTU(need.references)
  const packagingLabel = need.packagingRecommendation
    ? `${need.packagingRecommendation.unitsToOrder} ${need.packagingRecommendation.packagingLabel}`
    : null

  return (
    <div>
      <div className={`mat-line ${need.optional ? 'optional' : ''}`}>
        <div className="mat-line-left">
          <div className="mat-line-name">
            {need.name}
            {need.optional && (
              <span className="opt-badge" title={isPt ? 'Opcional' : 'Optionnel'}>
                {isPt ? 'OPTION' : 'OPTION'}
              </span>
            )}
          </div>
          <div className="mat-line-ref">
            <span className="dtu-tag">{dtu}</span>
            +{fr(need.wasteBreakdown.totalPercent, 1)}% {isPt ? 'perdas' : 'pertes'}
          </div>
          {need.optional && need.condition && (
            <span className="opt-condition">💡 {need.condition}</span>
          )}
        </div>
        <div className="mat-line-right">
          <div className="mat-line-qty">{formatQty(need.quantityWithWaste, need.unit)} {need.unit}</div>
          {packagingLabel && <div className="mat-line-pack">{packagingLabel}</div>}
        </div>
        <button
          type="button"
          className={`mat-line-toggle ${open ? 'open' : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-label={isPt ? 'Detalhe' : 'Détail'}
        >⌄</button>
      </div>
      <div className={`mat-detail ${open ? 'show' : ''}`}>
        <div className="detail-row">
          <span className="detail-label">{isPt ? 'Teórico' : 'Théorique'}</span>{' '}
          {formatQty(need.theoreticalQuantity, need.unit)} {need.unit} ({isPt ? 'sem perdas' : 'sans pertes'})
        </div>
        <div className="detail-row">
          <span className="detail-label">{isPt ? 'Perdas' : 'Pertes'}</span>{' '}
          +{fr(need.wasteBreakdown.baseWastePercent, 1)}% — {need.wasteBreakdown.baseWasteReason}
          {need.wasteBreakdown.profileBonusPercent > 0 && (
            <> · {need.wasteBreakdown.profileBonusReason}</>
          )}
        </div>
        <div className="detail-row">
          <span className="detail-label">{isPt ? 'Referências' : 'Références'}</span>{' '}
          {need.references.join(' · ')}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Panneau de résultats groupés par phase
   ═══════════════════════════════════════════════════════════ */
const PHASE_META_FR: Record<string, { icon: string; label: string }> = {
  preparation: { icon: '🧱', label: 'Préparation (amont)' },
  principal: { icon: '📦', label: 'Ouvrage principal' },
  accessoires: { icon: '⚙️', label: 'Accessoires d\'exécution' },
  finitions: { icon: '✨', label: 'Finitions' },
  options: { icon: '➕', label: 'Options conditionnelles' },
}
const PHASE_META_PT: Record<string, { icon: string; label: string }> = {
  preparation: { icon: '🧱', label: 'Preparação (a montante)' },
  principal: { icon: '📦', label: 'Obra principal' },
  accessoires: { icon: '⚙️', label: 'Acessórios de execução' },
  finitions: { icon: '✨', label: 'Acabamentos' },
  options: { icon: '➕', label: 'Opções condicionais' },
}

/**
 * Règles heuristiques "cohérence du devis" :
 * pour un recipeId, suggère des ouvrages complémentaires typiquement attendus.
 * Déclenche uniquement si AUCUN des complementRecipeIds n'est présent dans le devis.
 */
const COHERENCE_RULES: Array<{
  triggerRecipeId: string
  complementRecipeIds: string[]
  messageFr: string
  messagePt: string
}> = [
  {
    triggerRecipeId: 'mur-parpaing-20',
    complementRecipeIds: ['semelle-filante-ba'],
    messageFr: 'Mur parpaing extérieur sans fondation — semelle filante BA attendue',
    messagePt: 'Parede em bloco exterior sem fundação — sapata corrida em BA esperada',
  },
  {
    triggerRecipeId: 'mur-parpaing-20',
    complementRecipeIds: ['enduit-ext-monocouche', 'enduit-ext-multicouche'],
    messageFr: 'Mur parpaing sans enduit extérieur — finition façade à prévoir',
    messagePt: 'Parede em bloco sem reboco exterior — acabamento de fachada a prever',
  },
  {
    triggerRecipeId: 'couv-tuile-tc-emboitement',
    complementRecipeIds: ['charpente-traditionnelle', 'charpente-fermettes', 'mob-murs'],
    messageFr: 'Couverture tuile sans charpente — structure porteuse manquante',
    messagePt: 'Cobertura em telha sem estrutura — estrutura portante em falta',
  },
  {
    triggerRecipeId: 'couv-tuile-beton',
    complementRecipeIds: ['charpente-traditionnelle', 'charpente-fermettes', 'mob-murs'],
    messageFr: 'Couverture tuile béton sans charpente — structure porteuse manquante',
    messagePt: 'Cobertura em telha de betão sem estrutura — estrutura portante em falta',
  },
  {
    triggerRecipeId: 'couv-ardoise-naturelle',
    complementRecipeIds: ['charpente-traditionnelle', 'charpente-fermettes'],
    messageFr: 'Couverture ardoise sans charpente — structure porteuse manquante',
    messagePt: 'Cobertura em ardósia sem estrutura — estrutura portante em falta',
  },
  {
    triggerRecipeId: 'pac-air-eau',
    complementRecipeIds: ['plancher-chauffant-hydraulique', 'radiateur-acier-panneau', 'radiateur-eau-chaude'],
    messageFr: 'PAC air/eau sans émetteurs — radiateurs ou plancher chauffant attendus',
    messagePt: 'Bomba de calor ar/água sem emissores — radiadores ou piso radiante esperados',
  },
  {
    triggerRecipeId: 'piscine-coque-polyester',
    complementRecipeIds: ['terrasse-bois-plots', 'terrasse-carrelage-ext', 'terrasse-composite-wpc'],
    messageFr: 'Piscine sans plage périphérique — terrasse 1-2 m à prévoir séparément',
    messagePt: 'Piscina sem pavimento periférico — terraço 1-2 m a prever separadamente',
  },
  {
    triggerRecipeId: 'piscine-beton-banche',
    complementRecipeIds: ['terrasse-bois-plots', 'terrasse-carrelage-ext', 'terrasse-composite-wpc'],
    messageFr: 'Piscine sans plage périphérique — terrasse 1-2 m à prévoir séparément',
    messagePt: 'Piscina sem pavimento periférico — terraço 1-2 m a prever separadamente',
  },
]

function deriveCoherenceAlerts(result: EstimationResult, isPt: boolean): string[] {
  const presentIds = new Set(result.items.map(i => i.recipeId))
  const alerts: string[] = []
  for (const rule of COHERENCE_RULES) {
    if (!presentIds.has(rule.triggerRecipeId)) continue
    const hasComplement = rule.complementRecipeIds.some(id => presentIds.has(id))
    if (!hasComplement) alerts.push(isPt ? rule.messagePt : rule.messageFr)
  }
  return alerts
}

interface ResultsPanelProps {
  result: EstimationResult
  isPt: boolean
  copied: boolean
  onCopy: () => void
  onSoon: () => void
  onOrder: () => void
}

function ResultsPanel({ result, isPt, copied, onCopy, onSoon, onOrder }: ResultsPanelProps) {
  const coherenceAlerts = useMemo(() => deriveCoherenceAlerts(result, isPt), [result, isPt])
  const itemWarnings = useMemo(
    () => result.items.flatMap(it => it.warnings.map(w => `${it.label || it.recipeName} — ${w}`)),
    [result.items]
  )

  // Regroupe aggregated en 5 buckets : preparation / principal / accessoires / finitions / options
  const groups = useMemo(() => {
    const g = {
      preparation: [] as typeof result.aggregated,
      principal: [] as typeof result.aggregated,
      accessoires: [] as typeof result.aggregated,
      finitions: [] as typeof result.aggregated,
      options: [] as typeof result.aggregated,
    }
    for (const m of result.aggregated) {
      if (m.optional) g.options.push(m)
      else g[m.phase].push(m)
    }
    return g
  }, [result.aggregated])

  const meta = isPt ? PHASE_META_PT : PHASE_META_FR

  const renderSection = (key: keyof typeof groups) => {
    const arr = groups[key]
    if (arr.length === 0) return null
    return (
      <div key={key} className="phase-section">
        <div className={`phase-header phase-${key}`}>
          <span className="phase-icon">{meta[key].icon}</span>
          <span>{meta[key].label}</span>
          <span className="phase-count">{arr.length}</span>
        </div>
        <div className="mat-list">
          {arr.map(m => (
            <MatLine
              key={`${m.id}-${m.unit}-${m.phase}-${m.optional ? 'opt' : 'req'}`}
              need={m}
              isPt={isPt}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="results-section show">
      <div className="v5-card">
        <div className="result-headline">
          <h2>📦 {isPt ? 'Materiais necessários' : 'Matériaux nécessaires'}</h2>
          <div className="res-label">
            {result.aggregated.length} {isPt ? 'materiais calculados para' : 'matériaux calculés pour'}{' '}
            {result.items.length} {isPt ? 'obras' : 'ouvrages'}
            {groups.options.length > 0 && (
              <> · <strong>{groups.options.length} {isPt ? 'opção(ões)' : 'option(s)'}</strong></>
            )}
          </div>
        </div>

        {renderSection('preparation')}
        {renderSection('principal')}
        {renderSection('accessoires')}
        {renderSection('finitions')}
        {renderSection('options')}

        {(coherenceAlerts.length > 0 || itemWarnings.length > 0 || result.warnings.length > 0) && (
          <div className="coherence-box">
            <h3>⚠️ {isPt ? 'Coerência do orçamento' : 'Cohérence du devis'}</h3>
            {coherenceAlerts.length > 0 && (
              <>
                <div className="coherence-subtitle">
                  {isPt ? 'Obras complementares em falta' : 'Ouvrages complémentaires manquants'}
                </div>
                <ul>
                  {coherenceAlerts.map((a, i) => <li key={`c-${i}`}>{a}</li>)}
                </ul>
              </>
            )}
            {itemWarnings.length > 0 && (
              <>
                <div className="coherence-subtitle">
                  {isPt ? 'Avisos de cálculo' : 'Avertissements de calcul'}
                </div>
                <ul>
                  {itemWarnings.map((w, i) => <li key={`w-${i}`}>{w}</li>)}
                </ul>
              </>
            )}
            {result.warnings.length > 0 && (
              <>
                <div className="coherence-subtitle">
                  {isPt ? 'Avisos gerais' : 'Avertissements globaux'}
                </div>
                <ul>
                  {result.warnings.map((w, i) => <li key={`g-${i}`}>{w}</li>)}
                </ul>
              </>
            )}
          </div>
        )}

        {result.hypothesesACommuniquer && result.hypothesesACommuniquer.length > 0 && (
          <div className="hypotheses-box">
            <h3>💡 {isPt ? 'Hipóteses do estimador' : 'Hypothèses de l\'estimateur'}</h3>
            <ul>
              {result.hypothesesACommuniquer.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>
        )}

        <div className="final-actions">
          <button type="button" className="v5-btn" onClick={onCopy}>
            📋 {copied ? (isPt ? '✓ Copiado!' : '✓ Copié !') : (isPt ? 'Copiar a lista' : 'Copier la liste')}
          </button>
          <button type="button" className="v5-btn" onClick={onSoon}>📄 {isPt ? 'Exportar PDF' : 'Export PDF'}</button>
          <button type="button" className="v5-btn" onClick={onSoon}>📧 {isPt ? 'Enviar' : 'Envoyer'}</button>
          <button type="button" className="v5-btn v5-btn-p btn-spacer" onClick={onOrder}>🛒 {isPt ? 'Encomendar' : 'Commander'}</button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SECTION PRINCIPALE
   ═══════════════════════════════════════════════════════════ */
export default function EstimationMateriauxSection({
  artisan: _artisan,
  isAdminOverride = false,
  allowedTrades,
}: Props) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const country: 'FR' | 'PT' = isPt ? 'PT' : 'FR'

  // Isolation stricte : l'UI n'expose QUE les recettes du pays de l'utilisateur.
  // Aucune recette FR ne peut remonter pour un artisan PT et inversement.
  const countryRecipes = useMemo(() => getRecipesByCountry(country), [country])

  // Mode + état projet
  const [mode, setMode] = useState<Mode>('form')
  const [projectName, setProjectName] = useState('')
  const [items, setItems] = useState<ProjectItem[]>([])

  // Recherche + panneau
  const [query, setQuery] = useState('')
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<ProjectItem | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Profil
  const [difficulty, setDifficulty] = useState<ChantierProfile['difficulty']>('standard')
  const [size, setSize] = useState<ChantierProfile['size']>('moyen')
  const [workforce, setWorkforce] = useState<ChantierProfile['workforceLevel']>('mixte')

  // Résultats
  const [computing, setComputing] = useState(false)
  const [result, setResult] = useState<EstimationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Mode IA
  const [iaText, setIaText] = useState('')
  const [iaAssumptions, setIaAssumptions] = useState<string[]>([])
  const [iaQuestions, setIaQuestions] = useState<string[]>([])
  const [iaAnalyzing, setIaAnalyzing] = useState(false)

  // Périmètre métier effectif pour l'IA.
  // - Super-admin : sélection libre parmi les 26 trades (default = tous)
  // - Autres : restreint à `allowedTrades` passé en props (company-calibrated)
  const [selectedTrades, setSelectedTrades] = useState<Trade[]>([])
  const effectiveTrades = useMemo<Trade[] | undefined>(() => {
    if (isAdminOverride) return selectedTrades.length > 0 ? selectedTrades : undefined
    if (allowedTrades && allowedTrades.length > 0) return allowedTrades
    return undefined
  }, [isAdminOverride, selectedTrades, allowedTrades])

  // Feedback bouton copier
  const [copied, setCopied] = useState(false)

  const searchResults = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    return searchRecipes(q, country).slice(0, 8)
  }, [query, country])

  const selectedRecipe = useMemo(
    () => (selectedRecipeId ? countryRecipes.find(r => r.id === selectedRecipeId) ?? null : null),
    [selectedRecipeId, countryRecipes]
  )

  const openParam = useCallback((recipeId: string, editing: ProjectItem | null = null) => {
    setSelectedRecipeId(recipeId)
    setEditingItem(editing)
    setQuery('')
  }, [])

  const closeParam = useCallback(() => {
    setSelectedRecipeId(null)
    setEditingItem(null)
  }, [])

  const saveItem = useCallback((geo: Geometry, label?: string) => {
    if (!selectedRecipe) return
    const dimsLabel = buildDimsLabel(selectedRecipe, geo)
    if (editingItem) {
      setItems(prev => prev.map(it => it.uid === editingItem.uid
        ? { ...it, geometry: geo, label, dimsLabel }
        : it
      ))
    } else {
      const uid = `${selectedRecipe.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setItems(prev => [...prev, {
        uid,
        recipeId: selectedRecipe.id,
        recipeName: selectedRecipe.name,
        recipeTrade: selectedRecipe.trade,
        geometry: geo,
        label,
        dimsLabel,
      }])
    }
    setResult(null)
    closeParam()
  }, [selectedRecipe, editingItem, closeParam])

  const removeItem = (uid: string) => {
    setItems(prev => prev.filter(i => i.uid !== uid))
    setResult(null)
  }

  const editItem = (it: ProjectItem) => openParam(it.recipeId, it)

  const compute = async () => {
    if (items.length === 0) return
    setComputing(true)
    setError(null)
    setResult(null)
    try {
      const payload: EstimationInput = {
        projectName: projectName.trim() || undefined,
        items: items.map(i => ({ recipeId: i.recipeId, geometry: i.geometry, label: i.label })),
        chantierProfile: { difficulty, size, workforceLevel: workforce, complexShapes: false, isPistoletPainting: false },
      }
      const res = await fetch('/api/estimation/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, country }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || (isPt ? 'Erro ao calcular' : 'Erreur de calcul'))
      }
      setResult(await res.json() as EstimationResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setComputing(false)
    }
  }

  const analyzeWithIA = async () => {
    const text = iaText.trim()
    if (!text) return
    setIaAnalyzing(true)
    setError(null)
    setResult(null)
    setIaAssumptions([])
    setIaQuestions([])
    try {
      const res = await fetch('/api/estimation/ai-extract-and-compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: text,
          projectName: projectName.trim() || undefined,
          profileFallback: { difficulty, size, workforceLevel: workforce, complexShapes: false, isPistoletPainting: false },
          country,
          trades: effectiveTrades,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || (isPt ? 'Erro da IA' : 'Erreur IA'))
      }
      const data = await res.json() as {
        extraction: { items: Array<{ recipeId: string; geometry: Geometry; label?: string }>; assumptions: string[]; questions: string[] }
        result: EstimationResult
      }
      // Remplir items à partir de l'extraction (filtre strict par pays :
      // si l'IA retourne un recipeId hors scope pays, on l'ignore).
      const extractedItems: ProjectItem[] = []
      for (const it of data.extraction.items) {
        const recipe = countryRecipes.find(r => r.id === it.recipeId)
        if (!recipe) continue
        extractedItems.push({
          uid: `${recipe.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          recipeId: recipe.id,
          recipeName: recipe.name,
          recipeTrade: recipe.trade,
          geometry: it.geometry,
          label: it.label,
          dimsLabel: buildDimsLabel(recipe, it.geometry),
        })
      }
      setItems(extractedItems)
      setIaAssumptions(data.extraction.assumptions || [])
      setIaQuestions(data.extraction.questions || [])
      setResult(data.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIaAnalyzing(false)
    }
  }

  const copyList = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.humanSummary.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* noop */ }
  }

  const soonAlert = () => {
    alert(isPt ? 'Em breve' : 'Bientôt disponible')
  }

  const goToMateriaux = () => {
    alert(isPt ? 'Em breve — redirecionamento para Materiais & Aprovisionamento' : 'Bientôt — redirection vers Matériaux & Appro')
  }

  return (
    <div className="v5-fade">
      <div className="estim-wrap">
        {/* Titre */}
        <div className="v5-pg-t">
          <h1>{isPt ? 'Estimativa de materiais' : 'Estimation matériaux'}</h1>
          <p>{isPt ? 'Quantitativos detalhados com referências DTU' : 'Quantitatifs détaillés avec références DTU'}</p>
        </div>

        {/* Barre projet */}
        <div className="project-bar">
          <span className="proj-icon">📐</span>
          <input
            type="text"
            placeholder={isPt ? 'Nomear o projeto…' : 'Nommer le projet…'}
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
          />
          <span className="proj-meta">{isPt ? 'Rascunho' : 'Brouillon'}</span>
          <button type="button" className="v5-btn" onClick={soonAlert}>{isPt ? 'Carregar' : 'Charger'}</button>
          <button type="button" className="v5-btn v5-btn-p" onClick={soonAlert}>{isPt ? 'Guardar' : 'Enregistrer'}</button>
        </div>

        {/* Toggle mode */}
        <div className="mode-toggle">
          <button type="button" className={mode === 'form' ? 'active' : ''} onClick={() => setMode('form')}>
            {isPt ? 'Formulário' : 'Formulaire'}
          </button>
          <button type="button" className={mode === 'ia' ? 'active' : ''} onClick={() => setMode('ia')}>
            {isPt ? 'Descrição livre' : 'Description libre'}
          </button>
        </div>

        {/* MODE FORMULAIRE */}
        {mode === 'form' && (
          <>
            <div className="v5-card">
              <div className="v5-st">{isPt ? 'Obras da empreitada' : 'Ouvrages du chantier'}</div>

              {/* Recherche */}
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={isPt
                    ? 'Pesquisar uma obra (laje, parede, azulejo…)'
                    : 'Rechercher un ouvrage (dalle béton, cloison, carrelage…)'}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>

              {/* Dropdown résultats */}
              <div className={`search-results ${searchResults.length > 0 ? 'show' : ''}`}>
                {searchResults.map(r => (
                  <div
                    key={r.id}
                    className="search-result"
                    onClick={() => openParam(r.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') openParam(r.id) }}
                  >
                    <span className="sr-icon">{TRADE_ICON[r.trade]}</span>
                    <div className="sr-body">
                      <div className="sr-name">{r.name}</div>
                      <div className="sr-trade">
                        {isPt ? TRADE_LABEL_PT[r.trade] : TRADE_LABEL_FR[r.trade]}
                        {r.description ? ` — ${r.description.slice(0, 60)}${r.description.length > 60 ? '…' : ''}` : ''}
                      </div>
                    </div>
                    <span className="sr-dtu">{r.dtuReferences[0]?.code || '—'}</span>
                  </div>
                ))}
              </div>

              {/* Panneau paramétrage */}
              {selectedRecipe && (
                <ParamPanel
                  recipe={selectedRecipe}
                  editing={editingItem}
                  isPt={isPt}
                  onCancel={closeParam}
                  onSave={saveItem}
                />
              )}

              {/* Liste ouvrages */}
              <div className="items">
                {items.map(it => (
                  <div key={it.uid} className="item">
                    <span className="item-icon">{TRADE_ICON[it.recipeTrade]}</span>
                    <div className="item-text">
                      <div className="item-title">{it.label || it.recipeName}</div>
                      <div className="item-dims">{it.dimsLabel}</div>
                    </div>
                    <button type="button" className="item-edit" onClick={() => editItem(it)} title={isPt ? 'Modificar' : 'Modifier'}>✎</button>
                    <button type="button" className="item-remove" onClick={() => removeItem(it.uid)} aria-label={isPt ? 'Remover' : 'Supprimer'}>×</button>
                  </div>
                ))}
              </div>

              {/* Réglages avancés */}
              <details className="advanced">
                <summary>{isPt ? 'Definições avançadas' : 'Réglages avancés'}</summary>
                <div className="advanced-content">
                  <div className="advanced-row">
                    <span>{isPt ? 'Dificuldade da obra' : 'Difficulté du chantier'}</span>
                    <select value={difficulty} onChange={e => setDifficulty(e.target.value as ChantierProfile['difficulty'])}>
                      <option value="facile">{isPt ? 'Fácil' : 'Facile'}</option>
                      <option value="standard">{isPt ? 'Padrão' : 'Standard'}</option>
                      <option value="difficile">{isPt ? 'Difícil (+5%)' : 'Difficile (+5%)'}</option>
                    </select>
                  </div>
                  <div className="advanced-row">
                    <span>{isPt ? 'Tamanho' : 'Taille'}</span>
                    <select value={size} onChange={e => setSize(e.target.value as ChantierProfile['size'])}>
                      <option value="petit">{isPt ? 'Pequena (+5%)' : 'Petit (+5%)'}</option>
                      <option value="moyen">{isPt ? 'Média' : 'Moyen'}</option>
                      <option value="grand">{isPt ? 'Grande' : 'Grand'}</option>
                    </select>
                  </div>
                  <div className="advanced-row">
                    <span>{isPt ? 'Equipa' : 'Équipe'}</span>
                    <select value={workforce} onChange={e => setWorkforce(e.target.value as ChantierProfile['workforceLevel'])}>
                      <option value="experimente">{isPt ? 'Experiente' : 'Expérimentée'}</option>
                      <option value="mixte">{isPt ? 'Mista' : 'Mixte'}</option>
                      <option value="apprenti">{isPt ? 'Aprendizes (+5%)' : 'Apprentis (+5%)'}</option>
                    </select>
                  </div>
                </div>
              </details>
            </div>

            <button
              type="button"
              className="btn-compute"
              onClick={compute}
              disabled={items.length === 0 || computing}
            >
              {computing
                ? (isPt ? 'A calcular…' : 'Calcul en cours…')
                : (isPt ? 'Calcular os materiais' : 'Calculer les matériaux')}
            </button>
          </>
        )}

        {/* MODE IA */}
        {mode === 'ia' && (
          <>
            <div className="v5-card">
              <div className="v5-st">{isPt ? 'Descreva a sua obra' : 'Décrivez votre chantier'}</div>

              {/* Sélecteur de corps de métier — super-admin uniquement */}
              {isAdminOverride && (
                <div className="ia-trade-selector">
                  <div className="ia-trade-label">
                    🛠️ {isPt ? 'Âmbito — corpos de métier (admin)' : 'Périmètre — corps de métier (admin)'}
                    <span className="ia-trade-hint">
                      {selectedTrades.length === 0
                        ? (isPt ? 'Tudo o catálogo' : 'Tout le catalogue')
                        : `${selectedTrades.length} / 26`}
                    </span>
                  </div>
                  <div className="ia-trade-chips">
                    {(Object.keys(TRADE_LABEL_FR) as Trade[]).map(t => {
                      const active = selectedTrades.includes(t)
                      const label = isPt ? TRADE_LABEL_PT[t] : TRADE_LABEL_FR[t]
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`ia-trade-chip ${active ? 'active' : ''}`}
                          onClick={() => setSelectedTrades(prev =>
                            prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                          )}
                        >
                          {TRADE_ICON[t]} {label}
                        </button>
                      )
                    })}
                    {selectedTrades.length > 0 && (
                      <button
                        type="button"
                        className="ia-trade-chip ia-trade-clear"
                        onClick={() => setSelectedTrades([])}
                      >
                        ✕ {isPt ? 'Limpar' : 'Tout effacer'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Indicateur périmètre entreprise (non-admin) */}
              {!isAdminOverride && allowedTrades && allowedTrades.length > 0 && (
                <div className="ia-trade-locked">
                  🔒 {isPt ? 'IA calibrada para' : 'IA calibrée pour'} :{' '}
                  {allowedTrades.map(t => isPt ? TRADE_LABEL_PT[t] : TRADE_LABEL_FR[t]).join(' · ')}
                </div>
              )}

              <div className="ia-zone">
                <textarea
                  placeholder={isPt
                    ? 'Ex : Preciso de fazer uma laje de betão de 8m × 5m com 12 cm para uma garagem, depois levantar uma parede em tijolo de 20m sobre 2,5m de altura com uma porta. Seguidamente azulejo 45×45 em 40 m².'
                    : 'Ex : Je dois faire une dalle béton de 8m × 5m en 12 cm pour un garage, puis monter un mur en parpaing de 20m sur 2,5m de haut avec une porte. Ensuite carrelage 45×45 sur 40 m².'}
                  value={iaText}
                  onChange={e => setIaText(e.target.value)}
                />
              </div>

              {iaAssumptions.length > 0 && (
                <div className="ia-assumptions">
                  <strong>{isPt ? 'Hipóteses da IA' : 'Hypothèses de l\'IA'}</strong>
                  {iaAssumptions.map((a, i) => <div key={i}>• {a}</div>)}
                </div>
              )}
              {iaQuestions.length > 0 && (
                <div className="ia-questions">
                  <strong>❓ {isPt ? 'A IA tem perguntas' : 'L\'IA a des questions'}</strong>
                  {iaQuestions.map((q, i) => <div key={i}>• {q}</div>)}
                </div>
              )}

              {items.length > 0 && (
                <div className="items">
                  {items.map(it => (
                    <div key={it.uid} className="item">
                      <span className="item-icon">{TRADE_ICON[it.recipeTrade]}</span>
                      <div className="item-text">
                        <div className="item-title">{it.label || it.recipeName}</div>
                        <div className="item-dims">{it.dimsLabel}</div>
                      </div>
                      <button type="button" className="item-edit" onClick={() => editItem(it)} title={isPt ? 'Modificar' : 'Modifier'}>✎</button>
                      <button type="button" className="item-remove" onClick={() => removeItem(it.uid)} aria-label={isPt ? 'Remover' : 'Supprimer'}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn-compute"
              onClick={analyzeWithIA}
              disabled={iaText.trim().length === 0 || iaAnalyzing}
            >
              {iaAnalyzing
                ? (isPt ? 'IA a analisar…' : 'IA en cours d\'analyse…')
                : (isPt ? 'Analisar e calcular' : 'Analyser et calculer')}
            </button>
          </>
        )}

        {error && (
          <div className="ia-questions" style={{ marginTop: '.75rem', background: '#FFEBEE', borderColor: '#E53935', color: '#C62828' }}>
            <strong>⚠️ {isPt ? 'Erro' : 'Erreur'}</strong>
            <div>{error}</div>
          </div>
        )}

        {selectedRecipe && mode === 'ia' && (
          <ParamPanel
            recipe={selectedRecipe}
            editing={editingItem}
            isPt={isPt}
            onCancel={closeParam}
            onSave={saveItem}
          />
        )}

        {/* RÉSULTATS */}
        {result && (
          <ResultsPanel
            result={result}
            isPt={isPt}
            copied={copied}
            onCopy={copyList}
            onSoon={soonAlert}
            onOrder={goToMateriaux}
          />
        )}
      </div>
    </div>
  )
}
