'use client'

// ── Fenêtre « Nouvelle copropriété » / « Modifier la copropriété » d'un gestionnaire (PR 2, lot 5) ───────────────
//
// Espace d'un cabinet (vitfix.io/<identifiant>/suivi/, SPEC § 2.8). Même socle que ModaleCoproprieteQr (Champ,
// CLASSES_SAISIE, Encadre, Bouton), que l'on ne touche pas : le super admin garde sa fenêtre. Ici, seulement ce que les
// schémas stricts du gestionnaire acceptent (coproprieteGestionnaireQrSchema / modificationCoproprieteGestionnaireQrSchema) :
// Nom* · Adresse* · Code postal* · Ville* (nécessaires aux doublons) · N° d'immatriculation · Référence du cabinet ·
// Bâtiments · Destinataires supplémentaires (adresses des domaines de SON cabinet seulement). Jamais de cabinet, de
// gestionnaires, de « à tous », de QR code à remplacer ni de désactivation : le cabinet et l'attribution d'office viennent
// de sa fiche, côté serveur.
//   - création : operationId tiré à l'ouverture (un double clic ou un renvoi ne crée pas deux copropriétés) ; doublon
//     certain hors de sa portée : « existe déjà au cabinet », sans nom ; dans sa portée : « déjà dans vos copropriétés »
//     et un lien ; doublon probable : la question, puis « Oui, créer » (confirmerDoublonProbable) ;
//   - modification : champs préremplis, seuls les champs changés partent ; les adresses du cabinet masquées (adresse d'une
//     autre fiche) ne lui sont pas envoyées et le serveur les conserve ;
//   - les erreurs restent dans la fenêtre ; réseau coupé : toast en plus.

import { useId, useState } from 'react'
import { toast } from 'sonner'
import { remplir } from '@/lib/coproprietaire/textes'
import { Bouton, Champ, CLASSES_SAISIE, Encadre } from '@/components/coproprietaire-dashboard/ui'
import {
  creerCoproprieteGestionnaireQr, modifierCoproprieteGestionnaireQr, type ModificationCoproprieteGestionnaireQr,
  type SaisieCoproprieteGestionnaireQr,
} from '@/lib/aj-signalement/api'
import { TEXTES_TABLEAU_QR as T, analyserEmailsQr } from '@/lib/aj-signalement/affichage'
import { TEXTES_ESPACE_CABINET_QR as E, adressesHorsDomaineQr, messageErreurGestionnaireQr } from '@/lib/aj-signalement/affichage-gestionnaire'
import type { CoproprieteQr, DoublonRenduGestionnaireQr } from '@/lib/aj-signalement/types'

export interface PropsModaleCoproprieteGestionnaireQr {
  /** null : création. */
  copropriete: CoproprieteQr | null
  /** Domaines e-mail de SON cabinet (GET /moi) : seules adresses qu'il peut ajouter aux destinataires. */
  domaines: readonly string[]
  onFermer: () => void
  /** Copropriété créée ou modifiée, telle que le serveur la rend (minimisée), et le message de succès. */
  onEnregistre: (copropriete: CoproprieteQr, message: string) => void
  /** « Voir cette copropriété » : un doublon déjà dans ses copropriétés. */
  onOuvrir?: (id: string) => void
}

const listeBatiments = (texte: string): string[] => [...new Set(texte.split(',').map((b) => b.trim()).filter(Boolean))]
const memesListes = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])

export default function ModaleCoproprieteGestionnaireQr({
  copropriete, domaines, onFermer, onEnregistre, onOuvrir,
}: Readonly<PropsModaleCoproprieteGestionnaireQr>) {
  const idBase = useId()
  const [operationId] = useState(() => globalThis.crypto.randomUUID())
  const [nom, setNom] = useState(copropriete?.nom ?? '')
  const [adresse, setAdresse] = useState(copropriete?.adresse ?? '')
  const [codePostal, setCodePostal] = useState(copropriete?.codePostal ?? '')
  const [ville, setVille] = useState(copropriete?.ville ?? '')
  const [immatriculation, setImmatriculation] = useState(copropriete?.immatriculation ?? '')
  const [reference, setReference] = useState(copropriete?.referenceCabinet ?? '')
  const [batiments, setBatiments] = useState(copropriete?.batiments.join(', ') ?? '')
  // Saisies visibles seulement (adresses d'autres fiches masquées par le serveur, conservées par lui à l'écriture).
  const [emails, setEmails] = useState(copropriete?.emailsDestinataires.join(', ') ?? '')
  const [doublon, setDoublon] = useState<DoublonRenduGestionnaireQr | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const f = E.formulaire

  const enregistrer = async (confirmerDoublonProbable = false) => {
    if (occupe) return
    const valeurs = { nom: nom.trim(), adresse: adresse.trim(), codePostal: codePostal.trim(), ville: ville.trim() }
    if (!valeurs.nom || !valeurs.adresse || !valeurs.codePostal || !valeurs.ville) return setErreur(f.champsRequis)
    const analyse = analyserEmailsQr(emails)
    if (analyse.invalides.length > 0) return setErreur(remplir(T.formulaire.emailsInvalides, { liste: analyse.invalides.join(', ') }))
    // Adresses AJOUTÉES : domaines de son cabinet seulement (le serveur refait ce contrôle, et refuse l'adresse d'une fiche).
    const horsDomaine = adressesHorsDomaineQr(analyse.emails, copropriete?.emailsDestinataires ?? [], domaines)
    if (horsDomaine.length > 0) return setErreur(remplir(f.horsDomaine, { liste: horsDomaine.join(', ') }))
    const facultatifs = { immatriculation: immatriculation.trim(), referenceCabinet: reference.trim() }
    const listeBat = listeBatiments(batiments)

    let resultat
    if (!copropriete) {
      const saisie: SaisieCoproprieteGestionnaireQr = { operationId, ...valeurs }
      if (facultatifs.immatriculation) saisie.immatriculation = facultatifs.immatriculation
      if (facultatifs.referenceCabinet) saisie.referenceCabinet = facultatifs.referenceCabinet
      if (listeBat.length > 0) saisie.batiments = listeBat
      if (analyse.emails.length > 0) saisie.emailsDestinataires = analyse.emails
      if (confirmerDoublonProbable) saisie.confirmerDoublonProbable = true
      setErreur(null)
      setDoublon(null)
      setOccupe(true)
      resultat = await creerCoproprieteGestionnaireQr(saisie)
    } else {
      const modification: ModificationCoproprieteGestionnaireQr = {}
      for (const cle of ['nom', 'adresse', 'codePostal', 'ville'] as const) if (valeurs[cle] !== copropriete[cle]) modification[cle] = valeurs[cle]
      if (facultatifs.immatriculation !== (copropriete.immatriculation ?? '')) modification.immatriculation = facultatifs.immatriculation
      if (facultatifs.referenceCabinet !== (copropriete.referenceCabinet ?? '')) modification.referenceCabinet = facultatifs.referenceCabinet
      if (!memesListes(listeBat, copropriete.batiments)) modification.batiments = listeBat
      const anciennes = copropriete.emailsDestinataires.map((e) => e.toLowerCase())
      if (!memesListes(analyse.emails, anciennes)) modification.emailsDestinataires = analyse.emails
      // Rien de changé : rien à envoyer (le schéma refuserait un corps vide).
      if (Object.keys(modification).length === 0) return onFermer()
      if (confirmerDoublonProbable) modification.confirmerDoublonProbable = true
      setErreur(null)
      setDoublon(null)
      setOccupe(true)
      resultat = await modifierCoproprieteGestionnaireQr(copropriete.id, modification)
    }
    setOccupe(false)
    if (resultat.ok) return onEnregistre(resultat.copropriete, copropriete ? E.copropriete.modifiee : E.copropriete.creee)
    if (resultat.code === 'doublon' && resultat.doublonCabinet) return setDoublon(resultat.doublonCabinet)
    const message = messageErreurGestionnaireQr(resultat.code)
    if (resultat.code === 'reseau') toast.error(message)
    setErreur(message)
  }

  const champTexte = (cle: string, etiquette: string, valeur: string, changer: (v: string) => void, max: number, obligatoire = false) => (
    <Champ id={`${idBase}-${cle}`} etiquette={etiquette}>
      <input
        id={`${idBase}-${cle}`} value={valeur} onChange={(e) => changer(e.target.value)} maxLength={max}
        aria-required={obligatoire || undefined} className={CLASSES_SAISIE}
      />
    </Champ>
  )

  const aideEmails = domaines.length > 0 ? remplir(f.emailsAide, { domaines: domaines.join(', ') }) : f.emailsSansDomaine

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void enregistrer() }} aria-busy={occupe} noValidate>
      {champTexte('nom', f.nom, nom, setNom, 200, true)}
      {champTexte('adresse', f.adresse, adresse, setAdresse, 300, true)}
      <div className="grid gap-4 sm:grid-cols-2">
        {champTexte('cp', f.codePostal, codePostal, setCodePostal, 8, true)}
        {champTexte('ville', f.ville, ville, setVille, 100, true)}
        {champTexte('immatriculation', f.immatriculation, immatriculation, setImmatriculation, 30)}
        {champTexte('reference', f.reference, reference, setReference, 50)}
      </div>
      {champTexte('batiments', f.batiments, batiments, setBatiments, 600)}

      <Champ id={`${idBase}-emails`} etiquette={f.emails} aide={aideEmails}>
        <input
          id={`${idBase}-emails`} value={emails} onChange={(e) => setEmails(e.target.value)} inputMode="email" autoComplete="off"
          aria-describedby={`${idBase}-emails-aide`} className={CLASSES_SAISIE}
        />
      </Champ>

      {doublon && (
        <Encadre ton="avertissement">
          {doublon.certitude === 'probable' ? <p>{f.doublonProbable}</p> : (
            <p>{doublon.copropriete ? remplir(f.doublonVous, { nom: doublon.copropriete.nom }) : f.doublonCabinet}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {doublon.copropriete && onOuvrir && (
              <Bouton variante="secondaire" petit icone="chevron-droite" onClick={() => onOuvrir(doublon.copropriete?.id ?? '')}>{f.voirDoublon}</Bouton>
            )}
            {doublon.certitude === 'probable' && (
              <>
                <Bouton variante="danger" petit disabled={occupe} onClick={() => { void enregistrer(true) }}>
                  {copropriete ? f.ouiEnregistrer : f.ouiCreer}
                </Bouton>
                <Bouton variante="secondaire" petit disabled={occupe} onClick={() => setDoublon(null)}>{T.formulaire.annuler}</Bouton>
              </>
            )}
          </div>
        </Encadre>
      )}
      {erreur && <Encadre ton="erreur">{erreur}</Encadre>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Bouton variante="principal" type="submit" disabled={occupe} className="flex-1">
          {copropriete ? T.formulaire.enregistrer : T.formulaire.creerBouton}
        </Bouton>
        <Bouton variante="secondaire" onClick={onFermer} disabled={occupe} className="flex-1">{T.formulaire.annuler}</Bouton>
      </div>
    </form>
  )
}
