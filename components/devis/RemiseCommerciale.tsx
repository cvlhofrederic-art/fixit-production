'use client'

/**
 * Saisie de la remise commerciale, partagée par les formulaires devis/facture artisan
 * (DevisFactureForm) et BTP Pro (DevisFactureFormBTP). Présentationnelle : le calcul est dans
 * lib/remise-commerciale.ts et chaque formulaire garde ses propres classes de style.
 *
 *   - ChampRemiseLigne : remise d'une ligne, en % ou en € ; le bouton change d'unité en
 *     convertissant la valeur sur le montant de la ligne (150 € sur 1 000 € deviennent 15 %) ;
 *   - ChampRemiseGlobale : remise sur le total, en %, en € HT ou en € TTC. Une saisie en TTC est
 *     convertie en HT (c'est le HT qui est enregistré) et suit les lignes tant qu'on reste dans
 *     ce mode ; une remise changée hors du champ (mode « Acompte », document rechargé) fait
 *     quitter ce mode pour ne pas écraser la nouvelle valeur. Changer seulement l'unité affichée
 *     ne modifie jamais la remise enregistrée.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { DecimalInput } from '@/components/common/DecimalInput'
import { parseDecimalInput } from '@/lib/money'
import {
  appliquerRemiseGlobale, baisseTTCRemise, convertirRemise, lireRemise, remiseHTDepuisTTC,
  type LigneRemisable, type Remise, type TypeRemise,
} from '@/lib/remise-commerciale'

/** Champ vide pour 0, sinon le nombre à la française (espaces insécables remplacés). */
const formaterSaisie = (n: number): string =>
  n ? n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/\s/g, ' ') : ''

/** Empreinte d'une remise : reconnaît celle que le champ vient lui-même d'émettre. */
const cle = (remise: unknown): string => JSON.stringify(lireRemise(remise))

const STYLE_BASCULE: CSSProperties = {
  flex: 'none', minWidth: 30, height: 30, padding: '0 6px', border: '1px solid #E0E0E0', borderRadius: 4,
  background: '#FAFAFA', color: '#333', fontSize: 12, fontWeight: 700, cursor: 'pointer', lineHeight: 1,
}

export function ChampRemiseLigne({ remise, onChange, base, className, disabled }: {
  remise: unknown
  onChange: (remise: Remise | undefined) => void
  /** Montant de la ligne avant remise (quantité × prix) : conversion entre % et €. */
  base?: number
  className?: string
  disabled?: boolean
}) {
  const actuelle = lireRemise(remise)
  const [typeChoisi, setTypeChoisi] = useState<TypeRemise>(actuelle?.type ?? 'pourcentage')
  const type = actuelle?.type ?? typeChoisi
  const valeur = actuelle?.valeur ?? 0
  const autre: TypeRemise = type === 'pourcentage' ? 'montant' : 'pourcentage'
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <DecimalInput
        value={valeur}
        onChangeNumber={(n) => onChange(lireRemise({ type, valeur: n }) ?? undefined)}
        format={formaterSaisie}
        parse={(s) => parseDecimalInput(s)}
        placeholder="—"
        title={type === 'pourcentage' ? 'Remise sur la ligne, en %' : 'Remise sur la ligne, en € HT'}
        className={className}
        disabled={disabled}
        style={{ textAlign: 'right', minWidth: 0, flex: 1 }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setTypeChoisi(autre)
          if (actuelle) onChange(convertirRemise(actuelle, autre, base ?? 0) ?? undefined)
        }}
        title={type === 'pourcentage' ? 'Remise en % — cliquer pour la passer en €' : 'Remise en € — cliquer pour la passer en %'}
        aria-label={type === 'pourcentage' ? 'Remise en pourcentage, passer en euros' : 'Remise en euros, passer en pourcentage'}
        style={STYLE_BASCULE}
      >
        {type === 'pourcentage' ? '%' : '€'}
      </button>
    </div>
  )
}

type ModeGlobal = 'pourcentage' | 'ht' | 'ttc'

const modeDe = (remise: Remise | null): ModeGlobal => (remise?.type === 'montant' ? 'ht' : 'pourcentage')

/** Remise HT enregistrée pour une saisie en TTC sur ces lignes (aucune pour une saisie nulle). */
const remiseDepuisTTC = (lignes: LigneRemisable[], montantTTC: number, avecTva: boolean): Remise | undefined => {
  const ht = montantTTC ? remiseHTDepuisTTC(lignes, montantTTC, avecTva) : 0
  return ht ? { type: 'montant', valeur: ht } : undefined
}

/**
 * Remise à enregistrer pour un montant tapé en € TTC : la remise en euros en cours si elle donne déjà
 * cette baisse TTC (plusieurs montants HT peuvent la donner, la TVA étant arrondie taux par taux), sinon
 * le HT tiré de la saisie. Une remise en % est convertie : celle qui suit une saisie TTC est toujours un
 * montant, que la mise à l'échelle du mode « Acompte » modifie, et que le champ reconnaît donc.
 */
const remisePourSaisieTTC = (
  lignes: LigneRemisable[], montantTTC: number, avecTva: boolean, actuelle: Remise | null,
): Remise | undefined => {
  if (actuelle?.type === 'montant' && montantTTC
    && Math.round(baisseTTCRemise(lignes, actuelle, avecTva) * 100) === Math.round(montantTTC * 100)) {
    return actuelle
  }
  return remiseDepuisTTC(lignes, montantTTC, avecTva)
}

export function ChampRemiseGlobale({ remise, onChange, lignes, avecTva, formaterMontant, classeChamp, classeListe, disabled }: {
  remise: unknown
  onChange: (remise: Remise | undefined) => void
  /** Lignes du document (montants nets des remises de ligne) : conversions et saisie en TTC. */
  lignes: LigneRemisable[]
  /** TVA facturée (régime classique) : propose la saisie en € TTC. */
  avecTva: boolean
  formaterMontant: (montant: number) => string
  classeChamp?: string
  classeListe?: string
  disabled?: boolean
}) {
  const actuelle = lireRemise(remise)
  const [mode, setMode] = useState<ModeGlobal>(modeDe(actuelle))
  // Montant tapé en € TTC. Tant que rien n'est tapé, l'unité « € TTC » n'est qu'un affichage de la
  // remise enregistrée : elle ne la modifie jamais, même quand les lignes changent.
  const [saisieTTC, setSaisieTTC] = useState<number | null>(null)
  // Remise en vigueur quand la saisie en € TTC a commencé : retaper la valeur affichée la redonne
  // telle quelle (plusieurs montants HT donnent la même baisse TTC).
  const [remiseAvantSaisie, setRemiseAvantSaisie] = useState<Remise | null>(null)
  // Clé de la dernière remise émise par une frappe en € TTC, reconnue comme venant du champ même si
  // les lignes ont changé depuis.
  const [emiseParSaisie, setEmiseParSaisie] = useState<string | null>(null)

  // Remise changée depuis le rendu précédent (modèle React « ajuster l'état quand une prop
  // change ») : si le champ ne l'a pas produite, elle vient d'ailleurs (mode « Acompte », document
  // rechargé) et la saisie TTC est abandonnée.
  const cleRemise = cle(remise)
  const [cleVue, setCleVue] = useState(cleRemise)
  if (cleRemise !== cleVue) {
    setCleVue(cleRemise)
    if (mode === 'ttc' && saisieTTC !== null && cleRemise !== emiseParSaisie
      && cleRemise !== cle(remiseDepuisTTC(lignes, saisieTTC, avecTva))) {
      setMode(modeDe(actuelle))
      setSaisieTTC(null)
    }
  }

  // Unité affichée : « € TTC » si elle est choisie et que la TVA est facturée ; sinon celle de la
  // remise enregistrée (elle peut changer hors du champ : retour du mode « Acompte », document
  // rechargé), sinon le choix courant.
  let modeEffectif: ModeGlobal = actuelle ? modeDe(actuelle) : mode
  if (mode === 'ttc') {
    if (avecTva) modeEffectif = 'ttc'
    else if (!actuelle) modeEffectif = 'ht'
  }
  let valeur = actuelle?.valeur ?? 0
  if (modeEffectif === 'ttc') valeur = saisieTTC ?? (actuelle ? baisseTTCRemise(lignes, actuelle, avecTva) : 0)
  const emettre = onChange

  const appliquer = (v: number, m: ModeGlobal) => {
    // Saisie en HT pendant que le mode TTC attend le retour de la TVA : l'intention TTC est abandonnée.
    if (m !== mode) setMode(m)
    if (m === 'ttc') {
      const depart = saisieTTC === null ? actuelle : remiseAvantSaisie
      if (saisieTTC === null) setRemiseAvantSaisie(actuelle)
      setSaisieTTC(v)
      // La remise d'avant la saisie si elle donne cette baisse TTC, sinon la remise en cours, sinon le HT
      // tiré de la saisie.
      let suivante = remisePourSaisieTTC(lignes, v, avecTva, depart)
      if (cle(suivante) !== cle(depart)) suivante = remisePourSaisieTTC(lignes, v, avecTva, actuelle)
      if (cle(suivante) !== cle(actuelle)) {
        setEmiseParSaisie(cle(suivante))
        emettre(suivante)
      }
      return
    }
    setSaisieTTC(null)
    emettre(lireRemise({ type: m === 'pourcentage' ? 'pourcentage' : 'montant', valeur: v }) ?? undefined)
  }

  // Changement d'unité : même remise, exprimée dans la nouvelle unité ; « € TTC » n'en est qu'un
  // affichage, la remise enregistrée ne change pas.
  const changerMode = (m: ModeGlobal) => {
    setMode(m)
    setSaisieTTC(null)
    if (!actuelle || m === 'ttc') return
    const base = appliquerRemiseGlobale(lignes, null).baseRemiseHT
    const convertie = convertirRemise(actuelle, m === 'pourcentage' ? 'pourcentage' : 'montant', base)
    if (cle(convertie) !== cle(actuelle)) emettre(convertie ?? undefined)
  }

  // Montant tapé en € TTC : la remise HT suit les lignes (ajout, prix, TVA) pour garder cette baisse
  // TTC, et ne change que si elle ne la donne plus. L'effet ne touche à aucun état du champ : il
  // prévient seulement le formulaire.
  const cleLignes = JSON.stringify(lignes)
  useEffect(() => {
    if (modeEffectif !== 'ttc' || !saisieTTC) return
    const enCours = JSON.parse(cleRemise) as Remise | null
    const suivante = remisePourSaisieTTC(JSON.parse(cleLignes) as LigneRemisable[], saisieTTC, avecTva, enCours)
    if (cle(suivante) !== cleRemise) emettre(suivante)
  }, [cleRemise, cleLignes, avecTva, modeEffectif, saisieTTC, emettre])

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <DecimalInput
          value={valeur}
          onChangeNumber={(n) => appliquer(n, modeEffectif)}
          format={formaterSaisie}
          parse={(s) => parseDecimalInput(s)}
          placeholder="0"
          title="Remise commerciale sur le total"
          className={classeChamp}
          disabled={disabled}
          style={{ textAlign: 'right', minWidth: 0, flex: 1 }}
        />
        <select
          value={modeEffectif}
          disabled={disabled}
          aria-label="Unité de la remise commerciale"
          className={classeListe}
          style={{ flex: 'none', width: 'auto' }}
          onChange={(e) => changerMode(e.target.value as ModeGlobal)}
        >
          <option value="pourcentage">%</option>
          <option value="ht">{avecTva ? '€ HT' : '€'}</option>
          {avecTva && <option value="ttc">€ TTC</option>}
        </select>
      </div>
      {modeEffectif === 'ttc' && actuelle && (
        <div style={{ fontSize: 11, color: '#777', marginTop: 3 }}>
          soit {formaterMontant(Math.abs(appliquerRemiseGlobale(lignes, actuelle).remiseHT))} HT
        </div>
      )}
    </div>
  )
}
