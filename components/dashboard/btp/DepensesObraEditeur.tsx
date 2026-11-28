'use client'

import { useState } from 'react'
import { Loader2, Package, Trash2 } from 'lucide-react'
import {
  CATEGORIES_DEPENSE_OBRA, estMateriau, montantDepense, montantHorsIva, type DepenseObra,
} from '@/lib/btp/rentabilite-obra'
import { jourLocal } from '@/lib/btp/accueil'

// ═══════════════════════════════════════════════════════════════════════════════
// DÉPENSES D'UNE OBRA — fiche d'une obra (components/dashboard/ChantiersBTPV2.tsx), 28/11/2026
// Achats de matériaux (ils remplacent l'estimation de 15 % du calcul de rentabilité) et autres dépenses directes
// (location de matériel, carburant, transport, autres). Ils s'enregistrent comme dépenses de l'obra (depenses_btp), que
// l'écran Rentabilité lit aussi.
// Le montant enregistré est le COÛT RÉEL hors IVA récupérable : l'IVA déductible se récupère, ce n'est pas un coût ;
// une IVA non déductible (carburant d'un véhicule léger, location d'une voiture particulière…) en est un. Payé IVA
// comprise : l'écran retire la part déductible au taux choisi, et garde le montant payé dans la note.
// Déductibilité partielle (relecture adverse du 28/11/2026) : Portugal, CIVA art. 21.º n.º 1 b) — gazole des
// véhicules légers déductible à 50 % ; France, CGI art. 298-4 — carburant des véhicules de tourisme récupérable à 80 %.
// ═══════════════════════════════════════════════════════════════════════════════

/** Façon dont le montant saisi comprend l'IVA : taux, et part de cette IVA qui se récupère (1 = toute, 0 = rien). */
interface ModeIva { cle: string; taux: number; deductible: number; pt: string; fr: string }

/** Portugal continental (IVA) et France (TVA), du cas courant aux cas particuliers. */
const MODES_PT: readonly ModeIva[] = [
  { cle: '23', taux: 23, deductible: 1, pt: 'com IVA 23%', fr: '' },
  { cle: '13', taux: 13, deductible: 1, pt: 'com IVA 13%', fr: '' },
  { cle: '6', taux: 6, deductible: 1, pt: 'com IVA 6%', fr: '' },
  { cle: '23-50', taux: 23, deductible: 0.5, pt: 'com IVA 23%, dedutível a 50% (gasóleo de ligeiros)', fr: '' },
  { cle: 'nd', taux: 0, deductible: 0, pt: 'com IVA não dedutível (conta o total)', fr: '' },
  { cle: '0', taux: 0, deductible: 0, pt: 'sem IVA', fr: '' },
]
const MODES_FR: readonly ModeIva[] = [
  { cle: '20', taux: 20, deductible: 1, pt: '', fr: 'TTC, TVA 20 %' },
  { cle: '10', taux: 10, deductible: 1, pt: '', fr: 'TTC, TVA 10 %' },
  { cle: '5.5', taux: 5.5, deductible: 1, pt: '', fr: 'TTC, TVA 5,5 %' },
  { cle: '20-80', taux: 20, deductible: 0.8, pt: '', fr: 'TTC, TVA 20 % récupérable à 80 % (carburant d’un véhicule de tourisme)' },
  { cle: 'nd', taux: 0, deductible: 0, pt: '', fr: 'TTC, TVA non récupérable (compte le total)' },
  { cle: '0', taux: 0, deductible: 0, pt: '', fr: 'HT' },
]

/** Coût réel hors IVA récupérable d'un montant payé : 123 € à 23 % → 100 € ; à 23 % dédutible à 50 % → 111,50 €. */
export function coutHorsIvaRecuperable(paye: number, mode: Pick<ModeIva, 'taux' | 'deductible'>): number {
  const horsIva = montantHorsIva(paye, mode.taux)
  return Math.round((paye - (paye - horsIva) * mode.deductible) * 100) / 100
}

type CategorieObra = typeof CATEGORIES_DEPENSE_OBRA[number]

/** Libellé d'une catégorie (aussi le libellé d'une dépense saisie sans description) et exemple de description. */
const LIBELLES: Record<CategorieObra, { pt: string; fr: string; exemplePt: string; exempleFr: string }> = {
  materiaux: { pt: 'Materiais', fr: 'Matériaux', exemplePt: 'Ex.: cimento, azulejos…', exempleFr: 'Ex. : ciment, carrelage…' },
  location: { pt: 'Aluguer de equipamento', fr: 'Location de matériel', exemplePt: 'Ex.: mini-escavadora, andaime…', exempleFr: 'Ex. : mini-pelle, échafaudage…' },
  carburant: { pt: 'Combustível', fr: 'Carburant', exemplePt: 'Ex.: gasóleo da carrinha…', exempleFr: 'Ex. : gazole de la camionnette…' },
  transport: { pt: 'Transporte', fr: 'Transport', exemplePt: 'Ex.: entrega de material…', exempleFr: 'Ex. : livraison de matériaux…' },
  autre: { pt: 'Outros', fr: 'Autres', exemplePt: 'Ex.: subempreitada, resíduos…', exempleFr: 'Ex. : sous-traitance, déchets…' },
}

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
  const modes = isPt ? MODES_PT : MODES_FR
  const euros = (n: number) => `${n.toLocaleString(dl, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

  const [categorie, setCategorie] = useState<CategorieObra>('materiaux')
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  /** Façon dont le montant saisi comprend l'IVA (taux et part déductible). */
  const [cleMode, setCleMode] = useState<string>(modes[0].cle)
  const mode = modes.find(m => m.cle === cleMode) ?? modes[0]
  const [date, setDate] = useState(() => jourLocal(new Date()))
  const [enCours, setEnCours] = useState(false)

  const paye = lireMontantSaisi(montant)
  const valide = Number.isFinite(paye) && paye > 0 && !!date
  const horsIva = valide ? coutHorsIvaRecuperable(paye, mode) : 0
  const total = depenses.reduce((s, d) => s + montantDepense(d), 0)
  const totalMateriaux = depenses.filter(estMateriau).reduce((s, d) => s + montantDepense(d), 0)
  const aucunMateriau = !depenses.some(estMateriau)

  const ajouter = async () => {
    if (!valide || enCours) return
    setEnCours(true)
    const note = mode.cle === '0' ? null : (isPt ? `Valor pago (${mode.pt}): ${euros(paye)}` : `Montant payé (${mode.fr}) : ${euros(paye)}`)
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
          ? 'Materiais, aluguer, combustível, transporte… Contam na rentabilidade sem o IVA dedutível: o IVA que se recupera não é um custo. Se o IVA não for dedutível (ou só em parte), escolha a opção certa.'
          : 'Matériaux, location, carburant, transport… Comptés dans la rentabilité hors TVA récupérable : la TVA qui se récupère n’est pas un coût. Si elle ne l’est pas (ou en partie), choisissez l’option qui convient.'}
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
          aria-label={isPt ? 'Descrição da despesa' : 'Description de la dépense'} placeholder={isPt ? LIBELLES[categorie].exemplePt : LIBELLES[categorie].exempleFr} />
        <input className={champ} value={montant} onChange={e => setMontant(e.target.value)} inputMode="decimal"
          aria-label={isPt ? 'Valor pago (€)' : 'Montant payé (€)'} placeholder="0,00" />
        <select className={isV5 ? 'v5-filter-sel' : 'v22-filter-sel'} value={cleMode} onChange={e => setCleMode(e.target.value)}
          aria-label={isPt ? 'O valor inclui IVA?' : 'Le montant comprend-il la TVA ?'}>
          {modes.map(m => <option key={m.cle} value={m.cle}>{isPt ? m.pt : m.fr}</option>)}
        </select>
        <input type="date" className={champ} value={date} onChange={e => setDate(e.target.value)}
          aria-label={isPt ? 'Data da despesa' : 'Date de la dépense'} />
        <button type="button" className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} onClick={() => { void ajouter() }} disabled={!valide || enCours}>
          {enCours ? <Loader2 size={11} className="animate-spin" /> : '+'} {isPt ? 'Adicionar' : 'Ajouter'}
        </button>
      </div>
      <output aria-live="polite" style={{ display: 'block', fontSize: 10, color: '#2E7D32', marginTop: 3, minHeight: 13 }}>
        {valide && paye > horsIva && (isPt
          ? `Conta ${euros(horsIva)} (os ${euros(paye - horsIva)} de IVA recuperável não contam).`
          : `Compte ${euros(horsIva)} HT (les ${euros(paye - horsIva)} de TVA récupérable ne comptent pas).`)}
        {valide && paye === horsIva && (isPt ? `Conta ${euros(horsIva)}.` : `Compte ${euros(horsIva)}.`)}
        {montant.trim() !== '' && !Number.isFinite(paye) && (
          <span style={{ color: '#C62828' }}>{isPt ? 'Valor inválido.' : 'Montant invalide.'}</span>
        )}
      </output>
    </div>
  )
}
