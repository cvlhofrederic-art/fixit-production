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
 *     quitter ce mode pour ne pas écraser la nouvelle valeur.
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
  const [saisieTTC, setSaisieTTC] = useState(0)

  // Remise changée depuis le rendu précédent (modèle React « ajuster l'état quand une prop
  // change ») : si ce n'est pas la valeur que la saisie TTC produit sur les lignes actuelles, elle
  // vient d'ailleurs (mode « Acompte », document rechargé) et le mode TTC est abandonné.
  const cleRemise = cle(remise)
  const [cleVue, setCleVue] = useState(cleRemise)
  if (cleRemise !== cleVue) {
    setCleVue(cleRemise)
    if (mode === 'ttc' && cleRemise !== cle(remiseDepuisTTC(lignes, saisieTTC, avecTva))) {
      setMode(modeDe(actuelle))
      setSaisieTTC(0)
    }
  }

  // Unité affichée : celle de la saisie TTC en cours, sinon celle de la remise enregistrée (elle peut
  // changer hors du champ : retour du mode « Acompte », document rechargé), sinon le choix courant.
  let modeEffectif: ModeGlobal = actuelle ? modeDe(actuelle) : mode
  if (mode === 'ttc') modeEffectif = avecTva ? 'ttc' : 'ht'
  const valeur = modeEffectif === 'ttc' ? saisieTTC : (actuelle?.valeur ?? 0)
  const valeurEnregistree = actuelle?.type === 'montant' ? actuelle.valeur : null
  const emettre = onChange

  const appliquer = (v: number, m: ModeGlobal) => {
    // Saisie en HT pendant que le mode TTC attend le retour de la TVA : l'intention TTC est abandonnée.
    if (m !== mode) setMode(m)
    if (m === 'ttc') {
      setSaisieTTC(v)
      emettre(remiseDepuisTTC(lignes, v, avecTva))
      return
    }
    setSaisieTTC(0)
    emettre(lireRemise({ type: m === 'pourcentage' ? 'pourcentage' : 'montant', valeur: v }) ?? undefined)
  }

  // Changement d'unité : même remise, exprimée dans la nouvelle unité.
  const changerMode = (m: ModeGlobal) => {
    setMode(m)
    if (!actuelle) { setSaisieTTC(0); return }
    if (m === 'ttc') {
      setSaisieTTC(baisseTTCRemise(lignes, actuelle, avecTva))
      return
    }
    setSaisieTTC(0)
    const base = appliquerRemiseGlobale(lignes, null).baseRemiseHT
    const convertie = convertirRemise(actuelle, m === 'pourcentage' ? 'pourcentage' : 'montant', base)
    if (cle(convertie) !== cle(actuelle)) emettre(convertie ?? undefined)
  }

  // Saisie en TTC : la remise HT suit les lignes (ajout, prix, TVA) tant que ce mode est actif.
  // L'effet ne touche à aucun état du champ : il prévient seulement le formulaire.
  const cleLignes = JSON.stringify(lignes)
  useEffect(() => {
    if (modeEffectif !== 'ttc' || !saisieTTC) return
    const suivante = remiseDepuisTTC(JSON.parse(cleLignes) as LigneRemisable[], saisieTTC, avecTva)
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
      {modeEffectif === 'ttc' && valeurEnregistree !== null && (
        <div style={{ fontSize: 11, color: '#777', marginTop: 3 }}>soit {formaterMontant(valeurEnregistree)} HT</div>
      )}
    </div>
  )
}
