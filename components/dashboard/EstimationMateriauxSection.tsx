'use client'

import { useState, useMemo, useCallback } from 'react'
import { useLocale } from '@/lib/i18n/context'
import type {
  Recipe,
  EstimationInput,
  EstimationResult,
  EstimationItem,
  Geometry,
  ChantierProfile,
  MaterialNeed,
} from '@/lib/estimation-materiaux'
import { allRecipes } from '@/lib/estimation-materiaux'
import './estimation-materiaux.css'

type Trade = Recipe['trade']

interface ProjectItem extends EstimationItem {
  uid: string
  recipeName: string
  geoSummary: string
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  artisan?: { id?: string } | null
}

const TRADE_ICONS: Record<Trade | 'all', string> = {
  all: '🧱',
  maconnerie: '🏗️',
  placo: '🔨',
  peinture: '🎨',
  carrelage: '🟦',
}

const CAT_ICONS: Record<string, string> = {
  liant: '🔘', granulat: '⚫', acier: '🔩',
  bloc: '🧱', brique: '🧱', plaque: '▫️', ossature: '🔧',
  colle: '🧪', joint: '🧴', enduit: '🪣',
  peinture: '🎨', primaire: '🖌️',
  carreau: '🟦', isolant: '🧶',
  fixation: '⚙️', accessoire: '⚙️',
  eau: '💧', etancheite: '🧴',
  outillage: '🔨', autre: '📦', adjuvant: '💧', bois: '🪵',
}

const TRADE_LABEL_FR: Record<Trade, string> = {
  maconnerie: 'Maçonnerie',
  placo: 'Placo',
  peinture: 'Peinture',
  carrelage: 'Carrelage',
}

const TRADE_LABEL_PT: Record<Trade, string> = {
  maconnerie: 'Alvenaria',
  placo: 'Pladur',
  peinture: 'Pintura',
  carrelage: 'Azulejo',
}

function emptyGeometry(): Geometry {
  return {}
}

function summarizeGeometry(geo: Geometry): string {
  const parts: string[] = []
  if (geo.length !== undefined) parts.push(`L: ${geo.length}m`)
  if (geo.width !== undefined) parts.push(`l: ${geo.width}m`)
  if (geo.height !== undefined) parts.push(`h: ${geo.height}m`)
  if (geo.thickness !== undefined) parts.push(`ép: ${Math.round(geo.thickness * 100)}cm`)
  if (geo.area !== undefined) parts.push(`surf: ${geo.area}m²`)
  if (geo.volume !== undefined) parts.push(`vol: ${geo.volume}m³`)
  if (geo.perimeter !== undefined) parts.push(`per: ${geo.perimeter}m`)
  if (geo.openings !== undefined && geo.openings > 0) parts.push(`ouv: ${geo.openings}m²`)
  if (geo.count !== undefined) parts.push(`nb: ${geo.count}`)
  if (geo.coats !== undefined) parts.push(`couches: ${geo.coats}`)
  return parts.join(' · ')
}

interface GeoFormProps {
  recipe: Recipe
  isPt: boolean
  onCancel: () => void
  onAdd: (geo: Geometry, label?: string) => void
}

function GeometryForm({ recipe, isPt, onCancel, onAdd }: GeoFormProps) {
  const [geo, setGeo] = useState<Geometry>(emptyGeometry())
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mode = recipe.geometryMode
  const materialsNeedThickness = recipe.materials.some(m => m.geometryMultiplier === 'thickness')
  const materialsNeedHeight = recipe.materials.some(m => m.geometryMultiplier === 'height')
  const materialsNeedCoats = recipe.materials.some(m => m.geometryMultiplier === 'coats')

  const update = (k: keyof Geometry, v: string) => {
    const n = v === '' ? undefined : Number(v)
    setGeo(prev => ({ ...prev, [k]: n }))
    setError(null)
  }

  const submit = () => {
    const hasLW = geo.length && geo.width
    const hasLH = geo.length && geo.height
    if (mode === 'volume' && !(geo.volume || (hasLW && geo.thickness) || (geo.area && geo.thickness))) {
      setError(isPt ? 'Informe volume, ou comprimento+largura+espessura, ou superfície+espessura.' : 'Indiquez un volume, ou longueur+largeur+épaisseur, ou surface+épaisseur.')
      return
    }
    if (mode === 'area' && !(geo.area || hasLW || hasLH)) {
      setError(isPt ? 'Informe a superfície ou comprimento×altura.' : 'Indiquez la surface ou longueur×hauteur.')
      return
    }
    if (mode === 'area_minus_openings' && !(geo.area || hasLW || hasLH)) {
      setError(isPt ? 'Informe a superfície ou comprimento×altura.' : 'Indiquez la surface ou longueur×hauteur.')
      return
    }
    if (mode === 'length' && geo.length === undefined && geo.perimeter === undefined) {
      setError(isPt ? 'Informe o comprimento ou perímetro.' : 'Indiquez la longueur ou le périmètre.')
      return
    }
    if (mode === 'count' && geo.count === undefined) {
      setError(isPt ? 'Informe a quantidade.' : 'Indiquez le nombre.')
      return
    }
    if (materialsNeedThickness && geo.thickness === undefined && mode !== 'volume') {
      setError(isPt ? 'Informe a espessura.' : 'Indiquez l\'épaisseur.')
      return
    }
    onAdd(geo, label.trim() || undefined)
  }

  return (
    <div className="em-recipe-detail">
      <div className="em-rd-header">
        <div>
          <div className="em-rd-title">{TRADE_ICONS[recipe.trade]} {recipe.name}</div>
          <div className="em-rd-desc">{recipe.description}</div>
        </div>
        <button className="em-rd-close" onClick={onCancel} aria-label="Fermer">×</button>
      </div>
      <div className="em-mat-refs" style={{ marginBottom: '.5rem' }}>
        {recipe.dtuReferences.map(d => (
          <span key={d.code} className="em-mat-ref em-ref-dtu">{d.code}</span>
        ))}
      </div>
      <div style={{ fontSize: '10px', color: '#8B7D00', marginBottom: '.4rem', fontWeight: 600 }}>
        📐 {isPt ? 'Indique a geometria:' : 'Renseignez la géométrie :'}
      </div>
      <div className="em-geo-form">
        {(mode === 'volume' || mode === 'area' || mode === 'area_minus_openings' || mode === 'length') && (
          <div className="em-geo-field">
            <label>{isPt ? 'Comprimento (m)' : 'Longueur (m)'}</label>
            <input type="number" step="0.01" value={geo.length ?? ''} onChange={e => update('length', e.target.value)} />
          </div>
        )}
        {(mode === 'volume' || mode === 'area') && (
          <div className="em-geo-field">
            <label>{isPt ? 'Largura (m)' : 'Largeur (m)'}</label>
            <input type="number" step="0.01" value={geo.width ?? ''} onChange={e => update('width', e.target.value)} />
          </div>
        )}
        {(mode === 'area' || mode === 'area_minus_openings' || materialsNeedHeight) && (
          <div className="em-geo-field">
            <label>{isPt ? 'Altura (m)' : 'Hauteur (m)'}</label>
            <input type="number" step="0.01" value={geo.height ?? ''} onChange={e => update('height', e.target.value)} />
          </div>
        )}
        {(mode === 'volume' || materialsNeedThickness) && (
          <div className="em-geo-field">
            <label>{isPt ? 'Espessura (m)' : 'Épaisseur (m)'}</label>
            <input type="number" step="0.001" value={geo.thickness ?? ''} onChange={e => update('thickness', e.target.value)} />
          </div>
        )}
        {(mode === 'area' || mode === 'area_minus_openings' || mode === 'volume') && (
          <div className="em-geo-field">
            <label>{isPt ? 'Superfície (m²)' : 'Surface (m²)'}</label>
            <input type="number" step="0.1" value={geo.area ?? ''} onChange={e => update('area', e.target.value)} />
          </div>
        )}
        {mode === 'volume' && (
          <div className="em-geo-field">
            <label>{isPt ? 'Volume (m³)' : 'Volume (m³)'}</label>
            <input type="number" step="0.01" value={geo.volume ?? ''} onChange={e => update('volume', e.target.value)} />
          </div>
        )}
        {mode === 'length' && (
          <div className="em-geo-field">
            <label>{isPt ? 'Perímetro (m)' : 'Périmètre (m)'}</label>
            <input type="number" step="0.01" value={geo.perimeter ?? ''} onChange={e => update('perimeter', e.target.value)} />
          </div>
        )}
        {mode === 'area_minus_openings' && (
          <div className="em-geo-field">
            <label>{isPt ? 'Aberturas (m²)' : 'Ouvertures (m²)'}</label>
            <input type="number" step="0.1" value={geo.openings ?? ''} onChange={e => update('openings', e.target.value)} />
          </div>
        )}
        {mode === 'count' && (
          <div className="em-geo-field">
            <label>{isPt ? 'Quantidade' : 'Nombre'}</label>
            <input type="number" step="1" value={geo.count ?? ''} onChange={e => update('count', e.target.value)} />
          </div>
        )}
        {materialsNeedCoats && (
          <div className="em-geo-field">
            <label>{isPt ? 'Demãos' : 'Couches'}</label>
            <input type="number" step="1" value={geo.coats ?? ''} onChange={e => update('coats', e.target.value)} />
          </div>
        )}
      </div>
      <div className="em-geo-form" style={{ gridTemplateColumns: '1fr', marginTop: '.4rem' }}>
        <div className="em-geo-field">
          <label>{isPt ? 'Etiqueta (opcional)' : 'Libellé (optionnel)'}</label>
          <input
            type="text"
            placeholder={isPt ? 'Ex: Fundação garagem' : 'Ex: Fondation garage'}
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <div className="em-warn-box" style={{ marginTop: '.6rem', marginBottom: 0 }}>
          <span className="em-warn-icon">⚠️</span>
          <div>{error}</div>
        </div>
      )}
      <button
        className="v5-btn v5-btn-p"
        onClick={submit}
        style={{ marginTop: '.7rem', width: '100%', justifyContent: 'center', padding: '8px 18px' }}
      >
        ✓ {isPt ? 'Adicionar ao projeto' : 'Ajouter au projet'}
      </button>
    </div>
  )
}

export default function EstimationMateriauxSection({ artisan }: Props) {
  const locale = useLocale()
  const isPt = locale === 'pt'

  const [projectName, setProjectName] = useState(isPt ? 'Nova estimativa' : 'Nouvelle estimation')
  const [activeTrade, setActiveTrade] = useState<Trade | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [items, setItems] = useState<ProjectItem[]>([])
  const [profile, setProfile] = useState<ChantierProfile>({
    difficulty: 'standard',
    size: 'moyen',
    workforceLevel: 'mixte',
    complexShapes: false,
    isPistoletPainting: false,
  })
  const [result, setResult] = useState<EstimationResult | null>(null)
  const [computing, setComputing] = useState(false)
  const [computeError, setComputeError] = useState<string | null>(null)

  const tradeCounts = useMemo(() => {
    const counts: Record<Trade, number> = { maconnerie: 0, placo: 0, peinture: 0, carrelage: 0 }
    for (const r of allRecipes) counts[r.trade]++
    return counts
  }, [])

  const filteredRecipes = useMemo(() => {
    const q = search.toLowerCase().trim()
    return allRecipes.filter(r => {
      if (activeTrade !== 'all' && r.trade !== activeTrade) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      )
    })
  }, [activeTrade, search])

  const selectedRecipe = useMemo(
    () => (selectedRecipeId ? allRecipes.find(r => r.id === selectedRecipeId) ?? null : null),
    [selectedRecipeId]
  )

  const addItem = useCallback((recipe: Recipe, geometry: Geometry, label?: string) => {
    setItems(prev => [
      ...prev,
      {
        uid: `${recipe.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        recipeId: recipe.id,
        recipeName: recipe.name,
        geometry,
        label,
        geoSummary: summarizeGeometry(geometry),
      },
    ])
    setSelectedRecipeId(null)
    setResult(null)
  }, [])

  const removeItem = useCallback((uid: string) => {
    setItems(prev => prev.filter(i => i.uid !== uid))
    setResult(null)
  }, [])

  const compute = async () => {
    if (items.length === 0) return
    setComputing(true)
    setComputeError(null)
    setResult(null)
    try {
      const payload: EstimationInput = {
        projectName,
        items: items.map(i => ({ recipeId: i.recipeId, geometry: i.geometry, label: i.label })),
        chantierProfile: profile,
      }
      const res = await fetch('/api/estimation/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || (isPt ? 'Erro ao calcular' : 'Erreur de calcul'))
      }
      const data = (await res.json()) as EstimationResult
      setResult(data)
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : String(e))
    } finally {
      setComputing(false)
    }
  }

  const copySummary = async () => {
    if (!result) return
    const text = result.humanSummary.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      alert(isPt ? 'Resumo copiado!' : 'Résumé copié !')
    } catch {
      // noop
    }
  }

  const profileActive = profile.difficulty === 'difficile'
    || profile.size === 'petit'
    || profile.workforceLevel === 'apprenti'
    || profile.complexShapes
    || profile.isPistoletPainting

  return (
    <div className="v5-fade">
      {/* Titre */}
      <div className="v5-pg-t">
        <h1>{isPt ? 'Estimativa de materiais' : 'Estimation matériaux'}</h1>
        <p>{isPt
          ? 'Quantitativos detalhados com referências DTU — cálculo independente dos preços'
          : 'Quantitatifs détaillés avec références DTU — calculs indépendants des prix'}
        </p>
      </div>

      {/* KPIs */}
      <div className="v5-kpi-g">
        <div className="v5-kpi">
          <div className="v5-kpi-l">{isPt ? 'Obras no catálogo' : 'Ouvrages au catalogue'}</div>
          <div className="v5-kpi-v">{allRecipes.length}</div>
          <div className="v5-kpi-s">{isPt ? '4 ofícios' : '4 corps d\'état'}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{isPt ? 'Obras no projeto' : 'Ouvrages du projet'}</div>
          <div className="v5-kpi-v">{items.length}</div>
          <div className="v5-kpi-s">
            {items.length === 0
              ? (isPt ? 'nenhum adicionado' : 'aucun ajouté')
              : (isPt ? 'pronto para calcular' : 'prêts à calculer')}
          </div>
        </div>
        <div className="v5-kpi hl">
          <div className="v5-kpi-l">{isPt ? 'Materiais calculados' : 'Matériaux calculés'}</div>
          <div className="v5-kpi-v">{result ? result.aggregated.length : '—'}</div>
          <div className="v5-kpi-s">{isPt ? 'com DTU e perdas' : 'avec DTU & pertes chantier'}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{isPt ? 'Ganho de tempo' : 'Gain de temps estimé'}</div>
          <div className="v5-kpi-v">~3h</div>
          <div className="v5-kpi-s">{isPt ? 'por obra vs metragem manual' : 'par chantier vs métré manuel'}</div>
        </div>
      </div>

      {/* Project bar */}
      <div className="em-project-bar">
        <span style={{ fontSize: 18 }}>📐</span>
        <input
          type="text"
          value={projectName}
          placeholder={isPt ? 'Nome do projeto…' : 'Nom du projet…'}
          onChange={e => setProjectName(e.target.value)}
        />
        <span className="em-proj-meta">{isPt ? 'Rascunho' : 'Brouillon'}</span>
      </div>

      {/* Mode toggle — IA désactivé pour l'instant (clé Anthropic non branchée) */}
      <div className="em-mode-toggle">
        <button className="active">📋 {isPt ? 'Formulário estruturado' : 'Formulaire structuré'}</button>
        <button disabled title={isPt ? 'Em breve' : 'Bientôt disponible'}>
          ✨ {isPt ? 'Descrição livre (IA)' : 'Description libre (IA)'}
        </button>
      </div>

      {/* Profil chantier */}
      <div className="em-profile-bar">
        <span className="em-pb-label">🛠️ {isPt ? 'Perfil da obra' : 'Profil chantier'}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isPt ? 'Dificuldade' : 'Difficulté'}
          <select
            value={profile.difficulty}
            onChange={e => setProfile(p => ({ ...p, difficulty: e.target.value as ChantierProfile['difficulty'] }))}
          >
            <option value="facile">{isPt ? 'Fácil' : 'Facile'}</option>
            <option value="standard">{isPt ? 'Padrão' : 'Standard'}</option>
            <option value="difficile">{isPt ? 'Difícil (+5%)' : 'Difficile (+5%)'}</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isPt ? 'Tamanho' : 'Taille'}
          <select
            value={profile.size}
            onChange={e => setProfile(p => ({ ...p, size: e.target.value as ChantierProfile['size'] }))}
          >
            <option value="petit">{isPt ? 'Pequena <10m² (+5%)' : 'Petit <10m² (+5%)'}</option>
            <option value="moyen">{isPt ? 'Média' : 'Moyen'}</option>
            <option value="grand">{isPt ? 'Grande >100m²' : 'Grand >100m²'}</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isPt ? 'Mão de obra' : 'Main d\'œuvre'}
          <select
            value={profile.workforceLevel}
            onChange={e => setProfile(p => ({ ...p, workforceLevel: e.target.value as ChantierProfile['workforceLevel'] }))}
          >
            <option value="experimente">{isPt ? 'Experiente' : 'Expérimentée'}</option>
            <option value="mixte">{isPt ? 'Mista' : 'Mixte'}</option>
            <option value="apprenti">{isPt ? 'Aprendizes (+5%)' : 'Apprentis (+5%)'}</option>
          </select>
        </label>
        <label className="em-pb-check">
          <input
            type="checkbox"
            checked={profile.complexShapes}
            onChange={e => setProfile(p => ({ ...p, complexShapes: e.target.checked }))}
          />
          {isPt ? 'Formas complexas (+3%)' : 'Formes complexes (+3%)'}
        </label>
        <label className="em-pb-check">
          <input
            type="checkbox"
            checked={profile.isPistoletPainting}
            onChange={e => setProfile(p => ({ ...p, isPistoletPainting: e.target.checked }))}
          />
          {isPt ? 'Pintura pistola (+10%)' : 'Peinture pistolet (+10%)'}
        </label>
        <span className="em-pb-summary">
          {profileActive
            ? (isPt ? '⚠ Bónus aplicados' : '⚠ Bonus pertes appliqués')
            : (isPt ? '✓ Perdas padrão' : '✓ Pertes standards')}
        </span>
      </div>

      {/* Chips corps d'état */}
      <div className="em-trade-chips">
        <button
          className={`em-trade-chip ${activeTrade === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTrade('all')}
        >
          {TRADE_ICONS.all} {isPt ? 'Todos' : 'Tous'}
          <span className="em-count">{allRecipes.length}</span>
        </button>
        {(Object.keys(TRADE_LABEL_FR) as Trade[]).map(t => (
          <button
            key={t}
            className={`em-trade-chip ${activeTrade === t ? 'active' : ''}`}
            onClick={() => setActiveTrade(t)}
          >
            {TRADE_ICONS[t]} {isPt ? TRADE_LABEL_PT[t] : TRADE_LABEL_FR[t]}
            <span className="em-count">{tradeCounts[t]}</span>
          </button>
        ))}
      </div>

      {/* 2 colonnes */}
      <div className="em-form-split">
        {/* Catalogue */}
        <div>
          <div className="em-col-t">📚 {isPt ? 'Catálogo de obras' : 'Catalogue ouvrages'}</div>
          <div className="v5-search">
            <input
              className="v5-search-in"
              placeholder={isPt ? '🔍 Pesquisar uma obra (ex: laje, parede, pintura…)' : '🔍 Rechercher un ouvrage (ex: dalle, cloison, peinture…)'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {selectedRecipe && (
            <GeometryForm
              recipe={selectedRecipe}
              isPt={isPt}
              onCancel={() => setSelectedRecipeId(null)}
              onAdd={(geo, label) => addItem(selectedRecipe, geo, label)}
            />
          )}

          <div className="em-recipe-grid">
            {filteredRecipes.length === 0 && (
              <div className="em-empty">
                <div className="em-empty-title">{isPt ? 'Nenhuma obra encontrada' : 'Aucun ouvrage trouvé'}</div>
                <div className="em-empty-desc">{isPt ? 'Tente outra pesquisa ou outro ofício.' : 'Essayez une autre recherche ou un autre corps d\'état.'}</div>
              </div>
            )}
            {filteredRecipes.map(r => (
              <div
                key={r.id}
                className="em-recipe-card"
                onClick={() => setSelectedRecipeId(r.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelectedRecipeId(r.id) }}
              >
                <div className="em-rec-trade">{TRADE_ICONS[r.trade]} {isPt ? TRADE_LABEL_PT[r.trade] : TRADE_LABEL_FR[r.trade]}</div>
                <div className="em-rec-name">{r.name}</div>
                {r.description && <div className="em-rec-desc">{r.description}</div>}
                <div className="em-rec-meta">
                  {r.dtuReferences[0] && <span className="em-rec-dtu">{r.dtuReferences[0].code}</span>}
                  <span>·</span>
                  <span>{r.baseUnit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ouvrages du projet */}
        <div>
          <div className="em-col-t">
            🗂️ {isPt ? 'Obras do projeto' : 'Ouvrages du projet'}
            <span style={{ marginLeft: 'auto', background: 'var(--v5-primary-yellow)', color: '#333', padding: '1px 7px', borderRadius: 8, fontSize: 10 }}>
              {items.length}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="em-empty">
              <div className="em-empty-title">{isPt ? 'Nenhuma obra adicionada' : 'Aucun ouvrage ajouté'}</div>
              <div className="em-empty-desc">
                {isPt
                  ? 'Clique numa obra no catálogo para começar.'
                  : 'Cliquez sur un ouvrage du catalogue pour commencer.'}
              </div>
            </div>
          ) : (
            <div className="em-items-list">
              {items.map((it, idx) => (
                <div key={it.uid} className="em-item-row">
                  <div className="em-item-num">{idx + 1}</div>
                  <div className="em-item-info">
                    <div className="em-item-name">
                      {TRADE_ICONS[allRecipes.find(r => r.id === it.recipeId)?.trade ?? 'maconnerie']}{' '}
                      {it.recipeName}{it.label ? ` — ${it.label}` : ''}
                    </div>
                    <div className="em-item-geo">
                      {it.geoSummary.split(' · ').map((p, i) => <span key={i}>{p}</span>)}
                    </div>
                  </div>
                  <div className="em-item-actions">
                    <button
                      className="em-item-btn em-del"
                      onClick={() => removeItem(it.uid)}
                      title={isPt ? 'Remover' : 'Supprimer'}
                    >🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            className="v5-btn v5-btn-p"
            onClick={compute}
            disabled={items.length === 0 || computing}
            style={{ width: '100%', marginTop: '1rem', justifyContent: 'center', padding: '9px 18px', fontSize: 13 }}
          >
            {computing
              ? (isPt ? '⏳ A calcular…' : '⏳ Calcul en cours…')
              : `🧮 ${isPt ? 'Calcular materiais' : 'Calculer les matériaux'}`}
          </button>
          {computeError && (
            <div className="em-warn-box" style={{ marginTop: '.6rem' }}>
              <span className="em-warn-icon">⚠️</span>
              <div>{computeError}</div>
            </div>
          )}
        </div>
      </div>

      {/* Résultats */}
      {result && (
        <>
          <div className="em-results-header">
            <h2>
              📦 {isPt ? 'Materiais necessários' : 'Matériaux nécessaires'}{' '}
              <span className="em-res-count">
                — {result.aggregated.length} {isPt ? 'materiais agregados em' : 'matériaux agrégés sur'}{' '}
                {result.items.length} {isPt ? 'obras' : 'ouvrages'}
              </span>
            </h2>
            <div className="v5-btn-g">
              <button className="v5-btn" onClick={copySummary}>📋 {isPt ? 'Copiar' : 'Copier'}</button>
            </div>
          </div>

          <div className="em-summary-panel">
            <h3>✨ {isPt ? 'Resumo para encomenda fornecedor / cliente' : 'Résumé pour commande fournisseur / client'}</h3>
            <div className="em-sum-lines">
              {result.humanSummary.map((line, i) => (
                <div key={i} className="em-sum-line">{line}</div>
              ))}
            </div>
            <div className="em-sum-actions">
              <button className="v5-btn v5-btn-sm" onClick={copySummary}>📋 {isPt ? 'Copiar tudo' : 'Copier tout'}</button>
            </div>
          </div>

          {(result.warnings.length > 0 || result.items.some(i => i.warnings.length > 0)) && (
            <div className="em-warn-box">
              <span className="em-warn-icon">⚠️</span>
              <div>
                <strong>{isPt ? 'Pontos de atenção:' : 'Points d\'attention :'}</strong>
                <ul style={{ margin: '.3rem 0 0 1rem', padding: 0 }}>
                  {result.warnings.map((w, i) => <li key={`g-${i}`}>{w}</li>)}
                  {result.items.flatMap(it => it.warnings.map((w, i) => (
                    <li key={`${it.recipeId}-${i}`}>{w}</li>
                  )))}
                </ul>
              </div>
            </div>
          )}

          <div className="v5-st">{isPt ? 'Detalhe por material' : 'Détail par matériau'}</div>
          {result.aggregated.map(m => (
            <MaterialCard key={`${m.id}-${m.unit}`} need={m} isPt={isPt} />
          ))}
        </>
      )}
    </div>
  )
}

function MaterialCard({ need, isPt }: { need: MaterialNeed; isPt: boolean }) {
  const iconCat = CAT_ICONS[need.category] ?? '📦'
  return (
    <div className="em-material-card">
      <div className={`em-mat-cat em-cat-${need.category}`}>{iconCat}</div>
      <div className="em-mat-body">
        <div className="em-mat-name">{need.name}</div>
        <div className="em-mat-refs">
          {need.references.map((ref, i) => {
            const cls = ref.startsWith('DTU') ? 'em-ref-dtu'
              : ref.startsWith('NF') ? 'em-ref-norm'
              : 'em-ref-manuf'
            return <span key={i} className={`em-mat-ref ${cls}`}>{ref}</span>
          })}
        </div>
        <div className="em-mat-waste">
          <span className="em-waste-pct">+{need.wasteBreakdown.totalPercent}%</span>
          <span className="em-waste-reason">
            {need.wasteBreakdown.baseWasteReason}
            {need.wasteBreakdown.profileBonusReason ? ` · ${need.wasteBreakdown.profileBonusReason}` : ''}
          </span>
        </div>
      </div>
      <div className="em-mat-qty">
        <div>
          <span className="em-mat-qty-value">{formatQty(need.quantityWithWaste, need.unit)}</span>{' '}
          <span className="em-mat-qty-unit">{need.unit}</span>
        </div>
        {need.packagingRecommendation && (
          <div className="em-mat-pack">
            {need.packagingRecommendation.unitsToOrder} × {need.packagingRecommendation.packagingLabel}
          </div>
        )}
        <div className="em-mat-theo">
          {isPt ? 'Teórico' : 'Théorique'} : {formatQty(need.theoreticalQuantity, need.unit)} {need.unit}
        </div>
      </div>
    </div>
  )
}

function formatQty(q: number, unit: string): string {
  if (unit === 'kg' && q >= 1000) return (q / 1000).toFixed(2).replace('.', ',')
  if (q >= 100) return q.toFixed(0)
  if (q >= 10) return q.toFixed(1).replace('.', ',')
  return q.toFixed(2).replace('.', ',')
}
