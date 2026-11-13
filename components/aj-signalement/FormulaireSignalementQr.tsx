'use client'

// ── Formulaire public « AJ Signalement » ─────────────────────────────────────
//
// Même parcours que « Signaler un problème » du portail copropriétaire (FormulaireSignalement.tsx) :
// où (mon logement / parties communes + zone), quel type, description (10 caractères minimum, compteur),
// urgence ; précédé des coordonnées du déclarant, toutes obligatoires (bâtiment compris) et de sa qualité
// (propriétaire / locataire). Bouton désactivé tant que le formulaire est incomplet ; erreur de saisie sous le
// champ quitté ; erreur d'envoi persistante au-dessus du bouton, formulaire intact. Envoi par
// lib/aj-signalement/api (POST public).
// Parties communes : les signalements déjà faits au même endroit (même bâtiment, même zone) sont montrés sous la
// zone ; la personne peut dire « c'est le même problème » ou « c'est un autre problème », sans que cela bloque l'envoi.
// L'adresse proposée d'après la position (copropriété sans adresse) est lue au moment de l'envoi : rien n'attend la
// géolocalisation.
// PR 3, lot 7 (cahier § 6, HF3 ; brouillon, texte à valider par Frédéric et Hugo) : sous le bouton d'envoi, une mention
// courte (qui traite les coordonnées, pourquoi) et le lien vers la politique de confidentialité du cabinet, quand le
// serveur en donne une ; sans information, le formulaire est inchangé. Lien ouvert dans un nouvel onglet (la saisie
// reste) et sans Referer : le chemin de la page porte le jeton du QR code.

import { useId, useRef, useState, type InputHTMLAttributes } from 'react'
import { TYPES_PROBLEME, ZONES_COMMUNES, remplir, type TextesCopro } from '@/lib/coproprietaire/textes'
import type { LangueSignalementQr, QualiteDeclarantQr, SignalementSemblableQr } from '@/lib/aj-signalement/types'
import { mentionInformationQr, type InformationFormulaireQr, type TextesSignalementQr } from '@/lib/aj-signalement/textes'
import { envoyerSignalementQr, type CodeErreurQr } from '@/lib/aj-signalement/api'
import {
  CHAMPS_COORDONNEES, DESCRIPTION_MIN_QR, VALEURS_INITIALES_QR, construireSaisieQr, erreursCoordonnees, formulaireComplet,
  lieuLogementQr, messageErreurChamp, type ChampCoordonnees, type LieuQr, type UrgenceQr, type ValeursFormulaireQr,
} from '@/lib/aj-signalement/formulaire'
import { Bouton, Carte, Champ, ChoixCartes, CLASSES_SAISIE, Encadre, type OptionChoix } from '@/components/coproprietaire-dashboard/ui'
import SignalementsSemblablesQr, { type ChoixSemblableQr } from '@/components/aj-signalement/SignalementsSemblablesQr'
import { useSignalementsSemblablesQr } from '@/components/aj-signalement/useSignalementsSemblablesQr'

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
  /** Adresse proposée d'après la position (copropriété sans adresse) ; '' tant qu'il n'y en a pas. */
  adresseProposee?: string
  /** PR 3, lot 7 : information à la collecte (politique du cabinet) ; absente : rien ne s'affiche. */
  information?: InformationFormulaireQr | null
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

type ChoixFait = { endroit: string; choix: ChoixSemblableQr }

const AUCUN_CHOIX: ChoixFait = { endroit: '', choix: null }

/**
 * Choix « même problème / autre problème » encore valable : fait pour l'endroit affiché (lieu, bâtiment, zone) et,
 * pour « même problème », sur un signalement toujours dans la liste. Le choix fait ailleurs est en outre effacé dès
 * que l'endroit change (voir le composant) : il ne revient pas quand la personne revient au même endroit.
 */
function choixValable(fait: ChoixFait, endroit: string, semblables: readonly SignalementSemblableQr[]): ChoixSemblableQr {
  if (!endroit || fait.endroit !== endroit || !fait.choix) return null
  if (fait.choix.type === 'autre') return fait.choix
  const { numero } = fait.choix
  return semblables.some((s) => s.numero === numero) ? fait.choix : null
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

export default function FormulaireSignalementQr({
  jeton, langue, t, tq, adresseProposee = '', information = null, onEnvoye,
}: Readonly<PropsFormulaireSignalementQr>) {
  const idBase = useId()
  const idZone = `${idBase}-zone`
  const idType = `${idBase}-type`
  const idDescription = `${idBase}-description`

  const [valeurs, setValeurs] = useState<ValeursFormulaireQr>(VALEURS_INITIALES_QR)
  const [quittes, setQuittes] = useState<ReadonlySet<ChampCoordonnees>>(() => new Set())
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<CodeErreurQr | null>(null)
  // Deux clics avant le nouveau rendu ne doivent pas faire deux dépôts.
  const enCours = useRef(false)

  // Signalements déjà faits au même endroit ; le choix ne vaut que pour l'endroit où il a été fait.
  const { cle: endroit, semblables } = useSignalementsSemblablesQr({
    jeton, langue, communes: valeurs.lieu === 'communes', batiment: valeurs.batiment, zone: valeurs.zone,
  })
  const [choixFait, setChoixFait] = useState<ChoixFait>(AUCUN_CHOIX)
  // L'endroit a changé (lieu, bâtiment normalisé ou zone) : le choix fait ailleurs est effacé pendant le rendu
  // (état dérivé, sans effet), pour qu'il ne revienne pas quand la personne revient à l'endroit d'origine.
  if (choixFait.choix !== null && choixFait.endroit !== endroit) setChoixFait(AUCUN_CHOIX)
  const choix = choixValable(choixFait, endroit, semblables)
  const numeroLie = choix?.type === 'meme' ? choix.numero : ''

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
  const optionsQualite: OptionChoix<QualiteDeclarantQr>[] = [
    { valeur: 'proprietaire', libelle: tq.qualites.proprietaire },
    { valeur: 'locataire', libelle: tq.qualites.locataire },
  ]

  const envoyer = async () => {
    if (!complet || envoi || enCours.current) return
    enCours.current = true
    setErreur(null)
    setEnvoi(true)
    // L'adresse proposée et le choix sont ceux du moment de l'envoi : rien n'attend la géolocalisation.
    const saisie = construireSaisieQr(valeurs, jeton, langue, { adresseProposee, signalementLieNumero: numeroLie })
    const resultat = await envoyerSignalementQr(saisie)
    enCours.current = false
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
            const erreurChamp = quittes.has(champ) ? erreurs[champ] : undefined
            const aide = champ === 'batiment' ? tq.batimentAide : undefined
            return (
              <Champ
                key={champ}
                id={id}
                etiquette={tq[champ]}
                aide={aide}
                erreur={erreurChamp ? messageErreurChamp(champ, erreurChamp, tq) : undefined}
              >
                <input
                  id={id}
                  name={champ}
                  value={valeurs[champ]}
                  onChange={(e) => changer(champ, e.target.value)}
                  onBlur={() => quitter(champ)}
                  required
                  aria-invalid={erreurChamp ? true : undefined}
                  aria-describedby={erreurChamp || aide ? `${id}-aide` : undefined}
                  className={CLASSES_SAISIE}
                  {...ATTRIBUTS_CHAMP[champ]}
                />
              </Champ>
            )
          })}
        </div>
        <div className="mt-4">
          <ChoixCartes
            nom={`${idBase}-qualite`}
            legende={tq.qualite}
            options={optionsQualite}
            valeur={valeurs.qualite}
            onChange={(v) => changer('qualite', v)}
          />
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

          <SignalementsSemblablesQr
            semblables={semblables}
            choix={choix}
            onChoisir={(c) => setChoixFait({ endroit, choix: c })}
            langue={langue}
            tq={tq}
          />

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
            {information && (
              <p className="text-center text-sm text-[#4A5E78]">
                {mentionInformationQr(tq, information)}{' '}
                <a href={information.politiqueUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {tq.politiqueConfidentialite}
                </a>
              </p>
            )}
          </div>
        </div>
      </Carte>
    </div>
  )
}
