'use client'

// ── Formulaire public « AJ Signalement » ─────────────────────────────────────
//
// Même parcours que « Signaler un problème » du portail copropriétaire (FormulaireSignalement.tsx) :
// où (mon logement / parties communes + zone), quel type, description (10 caractères minimum, compteur),
// urgence ; précédé des coordonnées du déclarant, toutes obligatoires sauf le bâtiment. Bouton désactivé
// tant que le formulaire est incomplet ; erreur de saisie sous le champ quitté ; erreur d'envoi persistante
// au-dessus du bouton, formulaire intact. Envoi par lib/aj-signalement/api (POST public).

import { useId, useState, type InputHTMLAttributes } from 'react'
import { TYPES_PROBLEME, ZONES_COMMUNES, remplir, type TextesCopro } from '@/lib/coproprietaire/textes'
import type { LangueSignalementQr } from '@/lib/aj-signalement/types'
import type { TextesSignalementQr } from '@/lib/aj-signalement/textes'
import { envoyerSignalementQr, type CodeErreurQr } from '@/lib/aj-signalement/api'
import {
  CHAMPS_COORDONNEES, DESCRIPTION_MIN_QR, VALEURS_INITIALES_QR, construireSaisieQr, erreursCoordonnees, formulaireComplet,
  lieuLogementQr, messageErreurChamp, type ChampCoordonnees, type ChampObligatoire, type LieuQr, type UrgenceQr, type ValeursFormulaireQr,
} from '@/lib/aj-signalement/formulaire'
import { Bouton, Carte, Champ, ChoixCartes, CLASSES_SAISIE, Encadre, type OptionChoix } from '@/components/coproprietaire-dashboard/ui'

export interface ConfirmationSignalementQr {
  id: string
  numero: string
  /** Horodatage ISO du dépôt. */
  date: string
  telephone: string
  email: string
}

export interface PropsFormulaireSignalementQr {
  jeton: string
  langue: LangueSignalementQr
  t: TextesCopro
  tq: TextesSignalementQr
  onEnvoye: (confirmation: ConfirmationSignalementQr) => void
}

/** Clavier du téléphone et remplissage automatique de chaque coordonnée. */
const ATTRIBUTS_CHAMP: Record<ChampCoordonnees, InputHTMLAttributes<HTMLInputElement>> = {
  prenom: { autoComplete: 'given-name', maxLength: 100 },
  nom: { autoComplete: 'family-name', maxLength: 100 },
  telephone: { type: 'tel', inputMode: 'tel', autoComplete: 'tel', maxLength: 30 },
  email: { type: 'email', inputMode: 'email', autoComplete: 'email', maxLength: 200 },
  batiment: { maxLength: 50 },
  etage: { inputMode: 'numeric', maxLength: 20 },
  numLot: { maxLength: 20 },
}

const LOCAL: Record<LangueSignalementQr, { autreZoneValeur: string }> = {
  fr: { autreZoneValeur: 'Autre' },
  pt: { autreZoneValeur: 'Outra' },
}

/** Message d'une erreur d'envoi ; un code sans texte dédié (session) vaut une erreur serveur. */
function messageErreurEnvoi(code: CodeErreurQr, tq: TextesSignalementQr): string {
  switch (code) {
    case 'invalide':
    case 'trop_de_demandes':
    case 'reseau':
    case 'introuvable':
    case 'base_absente':
      return tq.erreurs[code]
    default:
      return tq.erreurs.serveur
  }
}

export default function FormulaireSignalementQr({ jeton, langue, t, tq, onEnvoye }: Readonly<PropsFormulaireSignalementQr>) {
  const idBase = useId()
  const idZone = `${idBase}-zone`
  const idType = `${idBase}-type`
  const idDescription = `${idBase}-description`

  const [valeurs, setValeurs] = useState<ValeursFormulaireQr>(VALEURS_INITIALES_QR)
  const [quittes, setQuittes] = useState<ReadonlySet<ChampCoordonnees>>(() => new Set())
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<CodeErreurQr | null>(null)

  const changer = <C extends keyof ValeursFormulaireQr>(champ: C, valeur: ValeursFormulaireQr[C]) => {
    setValeurs((v) => {
      const suivant = { ...v }
      suivant[champ] = valeur
      return suivant
    })
  }
  const quitter = (champ: ChampCoordonnees) => {
    setQuittes((q) => {
      if (q.has(champ)) return q
      const suivant = new Set(q)
      suivant.add(champ)
      return suivant
    })
  }

  const erreurs = erreursCoordonnees(valeurs)
  const complet = formulaireComplet(valeurs)
  const longueur = valeurs.description.trim().length
  const manque = DESCRIPTION_MIN_QR - longueur

  const optionsLieu: OptionChoix<Exclude<LieuQr, ''>>[] = [
    { valeur: 'logement', libelle: remplir(t.demandes.dansMonLogement, { lieu: lieuLogementQr(valeurs, langue, t, tq) }) },
    { valeur: 'communes', libelle: t.demandes.dansPartiesCommunes },
  ]
  const optionsUrgence: OptionChoix<Exclude<UrgenceQr, ''>>[] = [
    { valeur: 'non', libelle: t.demandes.urgenceNon },
    { valeur: 'genant', libelle: t.demandes.urgenceGenant },
    { valeur: 'urgent', libelle: t.demandes.urgenceUrgent },
  ]

  const envoyer = async () => {
    if (!complet || envoi) return
    setErreur(null)
    setEnvoi(true)
    const saisie = construireSaisieQr(valeurs, jeton, langue)
    const resultat = await envoyerSignalementQr(saisie)
    setEnvoi(false)
    if (!resultat.ok) {
      setErreur(resultat.code)
      return
    }
    onEnvoye({
      id: resultat.id,
      numero: resultat.numero || resultat.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
      date: resultat.creeLe || new Date().toISOString(),
      telephone: saisie.telephone,
      email: saisie.email,
    })
  }

  return (
    <div className="space-y-6">
      <Carte titre={tq.coordonnees} sousTitre={tq.coordonneesAide}>
        <div className="grid gap-4 sm:grid-cols-2">
          {CHAMPS_COORDONNEES.map((champ) => {
            const id = `${idBase}-${champ}`
            const obligatoire = champ !== 'batiment'
            const erreurChamp = obligatoire && quittes.has(champ) ? erreurs[champ as ChampObligatoire] : undefined
            return (
              <Champ
                key={champ}
                id={id}
                etiquette={tq[champ]}
                erreur={erreurChamp ? messageErreurChamp(champ as ChampObligatoire, erreurChamp, tq) : undefined}
              >
                <input
                  id={id}
                  name={champ}
                  value={valeurs[champ]}
                  onChange={(e) => changer(champ, e.target.value)}
                  onBlur={() => quitter(champ)}
                  required={obligatoire}
                  aria-invalid={erreurChamp ? true : undefined}
                  aria-describedby={erreurChamp ? `${id}-aide` : undefined}
                  className={CLASSES_SAISIE}
                  {...ATTRIBUTS_CHAMP[champ]}
                />
              </Champ>
            )
          })}
        </div>
      </Carte>

      <Carte titre={tq.titre}>
        <div className="space-y-6">
          <ChoixCartes
            nom={`${idBase}-lieu`}
            legende={t.demandes.ouProbleme}
            options={optionsLieu}
            valeur={valeurs.lieu}
            onChange={(v) => { changer('lieu', v); if (v === 'logement') changer('zone', '') }}
          />

          {valeurs.lieu === 'communes' && (
            <Champ id={idZone} etiquette={t.demandes.zone}>
              <select id={idZone} value={valeurs.zone} onChange={(e) => changer('zone', e.target.value)} className={CLASSES_SAISIE}>
                <option value="">{t.demandes.choisirZone}</option>
                {ZONES_COMMUNES[langue].map((z) => <option key={z} value={z}>{z}</option>)}
                <option value={LOCAL[langue].autreZoneValeur}>{t.demandes.autreZone}</option>
              </select>
            </Champ>
          )}

          <Champ id={idType} etiquette={t.demandes.typeProbleme}>
            <select id={idType} value={valeurs.type} onChange={(e) => changer('type', e.target.value)} className={CLASSES_SAISIE}>
              <option value="">{t.demandes.choisirType}</option>
              {TYPES_PROBLEME[langue].map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>
          </Champ>

          <Champ
            id={idDescription}
            etiquette={t.demandes.decrivez}
            aide={longueur > 0 && manque > 0 ? remplir(t.demandes.descriptionEncore, { n: manque }) : t.demandes.descriptionMinimum}
          >
            <textarea
              id={idDescription}
              rows={4}
              value={valeurs.description}
              onChange={(e) => changer('description', e.target.value)}
              placeholder={t.demandes.decrivezPlaceholder}
              aria-describedby={`${idDescription}-aide`}
              maxLength={5000}
              className={`${CLASSES_SAISIE} resize-y`}
            />
          </Champ>

          <ChoixCartes
            nom={`${idBase}-urgence`}
            legende={t.demandes.urgent}
            options={optionsUrgence}
            valeur={valeurs.urgence}
            onChange={(v) => changer('urgence', v)}
          />

          {erreur && <Encadre ton="erreur">{messageErreurEnvoi(erreur, tq)}</Encadre>}

          <div className="space-y-2">
            <Bouton variante="principal" icone="envoyer" pleineLargeur disabled={!complet || envoi} onClick={() => { void envoyer() }}>
              {envoi ? tq.envoiEnCours : tq.envoyer}
            </Bouton>
            <p className="text-center text-sm text-[#4A5E78]">{tq.transmis}</p>
          </div>
        </div>
      </Carte>
    </div>
  )
}
