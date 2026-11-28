'use client'

import { useState } from 'react'
import { Loader2, Package, Trash2 } from 'lucide-react'
import {
  CATEGORIES_DEPENSE_OBRA, CATEGORIES_MATERIAUX, montantDepense, montantHorsIva, type DepenseObra,
} from '@/lib/btp/rentabilite-obra'
import { jourLocal } from '@/lib/btp/accueil'

// ═══════════════════════════════════════════════════════════════════════════════
// DÉPENSES D'UNE OBRA — fiche d'une obra (components/dashboard/ChantiersBTPV2.tsx), 28/11/2026
// Achats de matériaux (ils remplacent l'estimation de 15 % du calcul de rentabilité) et autres dépenses directes
// (location de matériel, carburant, transport, autres). Ils s'enregistrent comme dépenses de l'obra (depenses_btp), que
// l'écran Rentabilité lit aussi.
// Le montant enregistré est TOUJOURS hors IVA : l'IVA payée au fournisseur se récupère, ce n'est pas un coût.
// Payé IVA comprise : l'écran ramène hors IVA au taux choisi, et garde le montant payé dans la note.
// ═══════════════════════════════════════════════════════════════════════════════

/** Taux d'IVA (Portugal continental) ou de TVA (France), du taux normal au taux réduit. */
const TAUX_PT = [23, 13, 6] as const
const TAUX_FR = [20, 10, 5.5] as const

type CategorieObra = typeof CATEGORIES_DEPENSE_OBRA[number]

/** Libellé d'une catégorie (aussi le libellé d'une dépense saisie sans description). */
const LIBELLES: Record<CategorieObra, { pt: string; fr: string }> = {
  materiaux: { pt: 'Materiais', fr: 'Matériaux' },
  location: { pt: 'Aluguer de equipamento', fr: 'Location de matériel' },
  carburant: { pt: 'Combustível', fr: 'Carburant' },
  transport: { pt: 'Transporte', fr: 'Transport' },
  autre: { pt: 'Outros (subempreitada, resíduos…)', fr: 'Autres (sous-traitance, déchets…)' },
}

const estMateriau = (d: DepenseObra) => (CATEGORIES_MATERIAUX as readonly string[]).includes(d.category ?? '')

function libelleCategorie(categorie: string | null | undefined, isPt: boolean): string {
  if (categorie === 'materiel') return isPt ? LIBELLES.materiaux.pt : LIBELLES.materiaux.fr
  const libelle = LIBELLES[categorie as CategorieObra]
  if (!libelle) return categorie ?? ''
  return isPt ? libelle.pt : libelle.fr
}

/** Saisie d'un montant : « 1 234,56 », « 1.234,56 », « 1234.56 » → 1234.56 ; NaN si illisible. */
export function lireMontantSaisi(saisie: string): number {
  let propre = saisie.replace(/[\s€]/g, '') // \s couvre aussi les espaces insécables (U+00A0, U+202F)
  // Virgule décimale (France, Portugal) : les points sont alors des séparateurs de milliers.
  if (propre.includes(',')) propre = propre.replace(/\./g, '').replace(',', '.')
  return /^\d+(\.\d{0,2})?$/.test(propre) ? Number(propre) : Number.NaN
}

export interface DepenseSaisie { label: string; amount: number; category: string; date: string; notes: string | null }

interface Props {
  /** Dépenses de l'obra (toutes catégories), les plus récentes d'abord. */
  depenses: readonly DepenseObra[]
  /** Enregistre une dépense ; vrai si elle est enregistrée (sinon le hook a déjà dit pourquoi). */
  onAjouter: (depense: DepenseSaisie) => Promise<boolean>
  onRetirer: (id: string) => Promise<boolean>
  isPt: boolean
  isV5: boolean
  dl: string
}

export function DepensesObraEditeur({ depenses, onAjouter, onRetirer, isPt, isV5, dl }: Props) {
  const taux = isPt ? TAUX_PT : TAUX_FR
  const pct = (t: number) => `${t.toLocaleString(dl)}${isPt ? '%' : ' %'}`
  const euros = (n: number) => `${n.toLocaleString(dl, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

  const [categorie, setCategorie] = useState<CategorieObra>('materiaux')
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  /** Taux de l'IVA comprise dans le montant saisi ; 0 : montant saisi hors IVA. */
  const [tauxSaisi, setTauxSaisi] = useState<number>(taux[0])
  const [date, setDate] = useState(() => jourLocal(new Date()))
  const [enCours, setEnCours] = useState(false)

  const paye = lireMontantSaisi(montant)
  const valide = Number.isFinite(paye) && paye > 0 && !!date
  const horsIva = valide ? montantHorsIva(paye, tauxSaisi) : 0
  const total = depenses.reduce((s, d) => s + montantDepense(d), 0)
  const totalMateriaux = depenses.filter(estMateriau).reduce((s, d) => s + montantDepense(d), 0)
  const aucunMateriau = !depenses.some(estMateriau)

  const ajouter = async () => {
    if (!valide || enCours) return
    setEnCours(true)
    const note = tauxSaisi > 0
      ? (isPt ? `Valor pago com IVA ${pct(tauxSaisi)}: ${euros(paye)}` : `Montant payé TTC (TVA ${pct(tauxSaisi)}) : ${euros(paye)}`)
      : null
    const ok = await onAjouter({
      label: libelle.trim() || libelleCategorie(categorie, isPt),
      amount: horsIva, category: categorie, date, notes: note,
    })
    setEnCours(false)
    if (ok) { setLibelle(''); setMontant('') }
  }

  const retirer = async (depense: DepenseObra) => {
    if (!depense.id) return
    const question = isPt
      ? `Eliminar a despesa "${depense.label || ''}" (${euros(montantDepense(depense))} s/ IVA)?`
      : `Supprimer la dépense « ${depense.label || ''} » (${euros(montantDepense(depense))} HT) ?`
    if (!window.confirm(question)) return
    await onRetirer(depense.id)
  }

  const champ = isV5 ? 'v5-fi' : 'v22-input'
  return (
    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
      <div id="depenses-obra-titre" className={isV5 ? 'v5-fl' : 'v22-form-label'} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Package size={12} /> {isPt ? 'Despesas da obra (s/ IVA)' : 'Dépenses du chantier (HT)'}
      </div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
        {isPt
          ? 'Materiais, aluguer, combustível, transporte… Contam na rentabilidade sem o IVA: o IVA pago ao fornecedor é recuperado, não é um custo.'
          : 'Matériaux, location, carburant, transport… Comptés dans la rentabilité hors TVA : la TVA payée au fournisseur se récupère, ce n’est pas un coût.'}
      </div>

      {depenses.length > 0 && (
        <ul aria-labelledby="depenses-obra-titre" style={{ listStyle: 'none', margin: '0 0 6px', padding: 0, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 160, overflowY: 'auto' }}>
          {depenses.map(d => (
            <li key={d.id ?? `${d.date}-${d.label}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '3px 6px', border: '1px solid #E0E0E0', borderRadius: 4 }}>
              <span style={{ color: '#999', minWidth: 40 }}>{d.date ? new Date(`${d.date}T00:00:00Z`).toLocaleDateString(dl, { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : ''}</span>
              <span style={{ flex: 1 }} title={d.notes ?? undefined}>{d.label}</span>
              <span style={{ color: '#999' }}>{libelleCategorie(d.category, isPt)}</span>
              <span style={{ fontWeight: 600 }}>{euros(montantDepense(d))}</span>
              {d.id && (
                <button type="button" className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} onClick={() => { void retirer(d) }}
                  aria-label={isPt ? `Eliminar a despesa ${d.label ?? ''}` : `Supprimer la dépense ${d.label ?? ''}`}>
                  <Trash2 size={11} />
                </button>
              )}
            </li>
          ))}
          <li style={{ fontSize: 11, fontWeight: 600, textAlign: 'right', padding: '2px 6px' }}>
            {isPt ? 'Total s/ IVA: ' : 'Total HT : '}{euros(total)}
            {totalMateriaux > 0 && totalMateriaux !== total && (isPt ? ` (materiais ${euros(totalMateriaux)})` : ` (matériaux ${euros(totalMateriaux)})`)}
          </li>
        </ul>
      )}
      {aucunMateriau && (
        <div style={{ fontSize: 11, color: '#999', padding: '2px 6px 6px' }}>
          {isPt ? 'Nenhuma compra de materiais registada: a rentabilidade usa uma estimativa de 15% do valor.' : 'Aucun achat de matériaux saisi : la rentabilité prend une estimation de 15 % du budget.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.7fr 1fr 1.3fr 1.2fr auto', gap: 6, alignItems: 'end' }}>
        <select className={isV5 ? 'v5-filter-sel' : 'v22-filter-sel'} value={categorie} onChange={e => setCategorie(e.target.value as CategorieObra)}
          aria-label={isPt ? 'Tipo de despesa' : 'Type de dépense'}>
          {CATEGORIES_DEPENSE_OBRA.map(c => <option key={c} value={c}>{libelleCategorie(c, isPt)}</option>)}
        </select>
        <input className={champ} value={libelle} onChange={e => setLibelle(e.target.value)} maxLength={120}
          aria-label={isPt ? 'Descrição da despesa' : 'Description de la dépense'} placeholder={isPt ? 'Ex.: cimento, azulejos…' : 'Ex. : ciment, carrelage…'} />
        <input className={champ} value={montant} onChange={e => setMontant(e.target.value)} inputMode="decimal"
          aria-label={isPt ? 'Valor pago (€)' : 'Montant payé (€)'} placeholder="0,00" />
        <select className={isV5 ? 'v5-filter-sel' : 'v22-filter-sel'} value={String(tauxSaisi)} onChange={e => setTauxSaisi(Number(e.target.value))}
          aria-label={isPt ? 'O valor inclui IVA?' : 'Le montant comprend-il la TVA ?'}>
          {taux.map(t => <option key={t} value={String(t)}>{isPt ? `com IVA ${pct(t)}` : `TTC, TVA ${pct(t)}`}</option>)}
          <option value="0">{isPt ? 'sem IVA' : 'HT'}</option>
        </select>
        <input type="date" className={champ} value={date} onChange={e => setDate(e.target.value)}
          aria-label={isPt ? 'Data da despesa' : 'Date de la dépense'} />
        <button type="button" className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} onClick={() => { void ajouter() }} disabled={!valide || enCours}>
          {enCours ? <Loader2 size={11} className="animate-spin" /> : '+'} {isPt ? 'Adicionar' : 'Ajouter'}
        </button>
      </div>
      <output aria-live="polite" style={{ display: 'block', fontSize: 10, color: '#2E7D32', marginTop: 3, minHeight: 13 }}>
        {valide && tauxSaisi > 0 && (isPt
          ? `Conta ${euros(horsIva)} s/ IVA (os ${euros(paye - horsIva)} de IVA não contam).`
          : `Compte ${euros(horsIva)} HT (les ${euros(paye - horsIva)} de TVA ne comptent pas).`)}
        {valide && tauxSaisi === 0 && (isPt ? `Conta ${euros(horsIva)} s/ IVA.` : `Compte ${euros(horsIva)} HT.`)}
        {montant.trim() !== '' && !Number.isFinite(paye) && (
          <span style={{ color: '#C62828' }}>{isPt ? 'Valor inválido.' : 'Montant invalide.'}</span>
        )}
      </output>
    </div>
  )
}
