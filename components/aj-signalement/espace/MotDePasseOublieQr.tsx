'use client'

// ── « Mot de passe oublié » de la connexion professionnelle « AJ Signalement » ──────────────────
//
// Relecture du 11/11/2026 : le lien vers la page commune /fr/auth/reset-password/ ramenait le professionnel sur la page
// de connexion générale de VitFix par deux boutons (« Retour à la connexion », et celui du message « Email envoyé »),
// avec le choix Particulier / Artisan / Pro et Google, ce que Hugo refuse. Le lien se demande donc ici, dans la page de
// connexion de l'espace, par la route existante POST /api/auth/reset-password (3 demandes par 5 minutes et par IP, même
// e-mail de Supabase, même lien), sans toucher aux pages communes.
// - Message « envoyé » neutre : le même que l'adresse ait un compte ou non. Le message d'erreur du serveur n'est jamais
//   montré ; journal : statut seulement, jamais l'e-mail.
// - Focus : le titre de l'étape à l'ouverture, le message une fois le lien demandé (le formulaire disparaît), le champ
//   en erreur sinon. « Retour à la connexion professionnelle » ramène au formulaire de connexion.
// - Le lien de l'e-mail ouvre la page commune /auth/update-password/ ; depuis la PR 2 (lot 6), un gestionnaire en
//   revient vers la connexion de SON cabinet (connexionApresMotDePasseQr) ; tout autre compte, vers la connexion
//   générale, comme avant.
// Styles de l'espace (Champ, CLASSES_SAISIE, Bouton, Encadre) : aucun nouveau système visuel.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bouton, CLASSES_SAISIE, Champ, Encadre } from '@/components/coproprietaire-dashboard/ui'
import {
  ROUTE_LIEN_MOT_DE_PASSE_QR, TEXTES_CONNEXION_QR, classerReponseLienMotDePasseQr, resumeErreurConnexionQr,
  validerEmailConnexionQr, type ResultatLienMotDePasseQr,
} from '@/lib/aj-signalement/connexion-espace'

const T = TEXTES_CONNEXION_QR.oubli
const ID_TITRE = 'qr-oubli-titre'
const ID_EMAIL = 'qr-oubli-email'

/** Classes du lien-bouton de la page de connexion (« Mot de passe oublié ? », retour) : texte souligné, 44 px. */
export const CLASSES_LIEN_CONNEXION_QR =
  'inline-flex min-h-[44px] items-center text-sm font-semibold text-[#0D1B2E] underline underline-offset-4 hover:text-[#6F5313] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C] disabled:cursor-not-allowed disabled:opacity-50'

/** Demande du lien ; une exception (réseau coupé) vaut « indisponible ». */
async function demanderLien(email: string): Promise<ResultatLienMotDePasseQr> {
  try {
    const reponse = await fetch(ROUTE_LIEN_MOT_DE_PASSE_QR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!reponse.ok) console.warn('[aj-signalement] lien de mot de passe refusé :', reponse.status)
    return classerReponseLienMotDePasseQr(reponse.status)
  } catch (erreur) {
    console.warn('[aj-signalement] lien de mot de passe impossible :', resumeErreurConnexionQr(erreur))
    return 'indisponible'
  }
}

export interface PropsMotDePasseOublieQr {
  /** E-mail partagé avec le formulaire de connexion (repris dans un sens comme dans l'autre). */
  email: string
  onEmail: (email: string) => void
  onRetour: () => void
}

export default function MotDePasseOublieQr({ email, onEmail, onRetour }: Readonly<PropsMotDePasseOublieQr>) {
  const [erreurEmail, setErreurEmail] = useState<string | undefined>(undefined)
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null)
  const [envoye, setEnvoye] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  // Pas de double envoi : le bouton désactivé ne suffit pas entre deux rendus.
  const envoiEnCours = useRef(false)
  const refTitre = useRef<HTMLHeadingElement>(null)
  const refEmail = useRef<HTMLInputElement>(null)
  const refEnvoye = useRef<HTMLDivElement>(null)

  // Ouverture de l'étape : le lecteur d'écran annonce son titre.
  useEffect(() => { refTitre.current?.focus() }, [])
  // Lien demandé : le formulaire (et son bouton, qui avait le focus) disparaît ; le message est lu en entier.
  useEffect(() => { if (envoye) refEnvoye.current?.focus() }, [envoye])

  const refuserEmail = (message: string) => {
    setErreurEmail(message)
    refEmail.current?.focus()
  }

  const soumettre = async (evenement: FormEvent<HTMLFormElement>) => {
    evenement.preventDefault()
    if (envoiEnCours.current) return
    setErreurGenerale(null)
    const saisie = validerEmailConnexionQr(email)
    if (!saisie.ok) {
      refuserEmail(saisie.erreur)
      return
    }
    setErreurEmail(undefined)
    envoiEnCours.current = true
    setEnvoi(true)
    const resultat = await demanderLien(saisie.email)
    envoiEnCours.current = false
    setEnvoi(false)
    if (resultat === 'envoye') setEnvoye(true)
    else if (resultat === 'email') refuserEmail(TEXTES_CONNEXION_QR.erreurs.emailInvalide)
    else setErreurGenerale(T.erreurs[resultat])
  }

  return (
    <section aria-labelledby={ID_TITRE} className="mt-6">
      <h2 id={ID_TITRE} ref={refTitre} tabIndex={-1} className="font-serif text-xl text-[#0D1B2E] outline-none">{T.titre}</h2>
      {envoye ? (
        <div ref={refEnvoye} tabIndex={-1} className="mt-4 outline-none">
          <Encadre ton="succes">{T.envoye}</Encadre>
        </div>
      ) : (
        <>
          <p className="mt-2 text-base text-[#4A5E78]">{T.aide}</p>
          {erreurGenerale && <Encadre ton="erreur" className="mt-4">{erreurGenerale}</Encadre>}
          <form noValidate onSubmit={(evenement) => { void soumettre(evenement) }} className="mt-4 space-y-5">
            <Champ id={ID_EMAIL} etiquette={TEXTES_CONNEXION_QR.email} erreur={erreurEmail}>
              <input
                id={ID_EMAIL}
                ref={refEmail}
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => onEmail(e.target.value)}
                {...(erreurEmail ? { 'aria-invalid': true, 'aria-describedby': `${ID_EMAIL}-aide` } : {})}
                className={CLASSES_SAISIE}
              />
            </Champ>
            <Bouton variante="principal" type="submit" icone="envoyer" pleineLargeur disabled={envoi}>
              {envoi ? T.envoiEnCours : T.envoyer}
            </Bouton>
          </form>
        </>
      )}
      <div className="mt-5 flex justify-center">
        <button type="button" onClick={onRetour} className={CLASSES_LIEN_CONNEXION_QR}>{T.retour}</button>
      </div>
    </section>
  )
}
