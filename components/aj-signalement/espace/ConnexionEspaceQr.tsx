'use client'

// ── Connexion professionnelle de l'espace « AJ Signalement » (/fr/aj-signalement/connexion/) ─────
//
// Demande de Hugo du 11/11/2026 : « je ne veux pas que l'on puisse taper Particulier […] il faut taper professionnel
// avec le mail et mot de passe pour se connecter ». Un seul formulaire : e-mail et mot de passe, « Mot de passe
// oublié ? ». Ni choix Particulier / Artisan / Pro, ni Google, ni « Créer un compte ». La page de connexion générale de
// VitFix (/fr/auth/login/) ne change pas, et cette page n'y mène jamais (aucun lien vers les pages communes /auth/…).
//
// - Connexion : supabase.auth.signInWithPassword (même client et même méthode que la page générale), puis
//   destinationConnexionEspaceQr (app_metadata seul) : compte admis → l'espace du contexte (ancre d'une vue comprise),
//   adresse remplacée ; compte sans accès → message neutre annoncé (role=alert) et focalisé, et la session que cette
//   page vient d'ouvrir est fermée dans ce navigateur (portée « local » : ses autres appareils gardent la leur ;
//   précédent : syndic/login).
// - Erreurs : trois messages (identifiants, trop de tentatives, connexion impossible) qui ne disent jamais si l'adresse
//   existe ; journal sans e-mail ni mot de passe. La limite des tentatives est celle de Supabase Auth (serveur).
// - Au chargement (secours sans middleware : build mobile, onglet resté ouvert) : session admise → l'espace ; session
//   sans accès → message neutre en zone d'état, sans déplacer le focus (session laissée telle quelle : ce n'est pas
//   cette page qui l'a ouverte).
// - « Mot de passe oublié ? » : étape de la page (MotDePasseOublieQr, relecture du 11/11/2026), et non plus un lien vers
//   la page commune /auth/reset-password/, qui ramenait vers la connexion générale.
// - Réutilisable : le contexte (nom affiché, adresse de l'espace) vient de la page ; l'espace de chaque cabinet
//   (vitfix.io/<client>/connexion, PR 2) passera le sien. Limite : la décision d'accès ne lit que le rôle (seul le super
//   admin entre, dans tout espace) ; la PR 2 devra lui passer le cabinet avant d'admettre un rôle gestionnaire.
// Styles de l'espace (PagePleineQr, Champ, CLASSES_SAISIE, Bouton, Encadre) : aucun nouveau système visuel.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { verifierSessionNavigateur } from '@/lib/auth/session-navigateur'
import { Bouton, CLASSES_SAISIE, Champ, Encadre, Icone } from '@/components/coproprietaire-dashboard/ui'
import PagePleineQr from '@/components/aj-signalement/espace/PagePleineQr'
import MotDePasseOublieQr, { CLASSES_LIEN_CONNEXION_QR } from '@/components/aj-signalement/espace/MotDePasseOublieQr'
import { langueDeLaPage } from '@/components/aj-signalement/espace/useAccesEspaceQr'
import { TEXTES_ESPACE_QR, destinationConnexionEspaceQr } from '@/lib/aj-signalement/acces-espace'
import {
  TEXTES_CONNEXION_QR as T, classerErreurConnexionQr, resumeErreurConnexionQr, validerSaisieConnexionQr,
  type ContexteConnexionQr, type ErreursSaisieConnexionQr,
} from '@/lib/aj-signalement/connexion-espace'

const ID_EMAIL = 'qr-connexion-email'
const ID_MOT_DE_PASSE = 'qr-connexion-mot-de-passe'

/** Attributs d'accessibilité d'un champ : en erreur, relié à son message (id « <champ>-aide » posé par Champ). */
const attributsErreur = (id: string, erreur: string | undefined) =>
  erreur ? { 'aria-invalid': true, 'aria-describedby': `${id}-aide` } : {}

/**
 * Message « sans accès » : « chargement » (session trouvée en ouvrant la page) → zone d'état, focus inchangé ;
 * « envoi » (refus juste après une connexion) → alerte et focus sur le message : une zone d'état créée avec son texte
 * n'est pas annoncée à coup sûr, et le bouton désactivé pendant l'envoi a rendu le focus à la page.
 */
type SansAccesQr = 'chargement' | 'envoi' | null

export interface PropsConnexionEspaceQr {
  /** Nom affiché et adresse de l'espace d'arrivée (sérialisable : passé par la page serveur). */
  contexte: ContexteConnexionQr
}

export default function ConnexionEspaceQr({ contexte }: Readonly<PropsConnexionEspaceQr>) {
  const [langue] = useState(langueDeLaPage)
  const espace = contexte.espace[langue]
  const [etape, setEtape] = useState<'connexion' | 'oubli'>('connexion')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [voirMotDePasse, setVoirMotDePasse] = useState(false)
  const [erreurs, setErreurs] = useState<ErreursSaisieConnexionQr>({})
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null)
  const [sansAcces, setSansAcces] = useState<SansAccesQr>(null)
  const [envoi, setEnvoi] = useState(false)
  const refEmail = useRef<HTMLInputElement>(null)
  const refMotDePasse = useRef<HTMLInputElement>(null)
  const refSansAcces = useRef<HTMLDivElement>(null)
  // Retour depuis « Mot de passe oublié » : le focus revient au champ e-mail du formulaire de connexion.
  const retourDepuisOubli = useRef(false)
  // Une connexion lancée ici prime, pour de bon, sur la vérification du chargement : une réponse tardive (d'avant une
  // session fermée après un refus) ne doit plus rien décider.
  const connexionLancee = useRef(false)
  // Pas de double envoi : le bouton désactivé ne suffit pas entre deux rendus.
  const envoiEnCours = useRef(false)

  useEffect(() => {
    let actif = true
    void verifierSessionNavigateur(supabase.auth).then((verdict) => {
      if (!actif || connexionLancee.current || verdict.statut !== 'valide') return
      const destination = destinationConnexionEspaceQr(espace, window.location.hash, verdict.user.app_metadata)
      if (destination) window.location.replace(destination)
      else setSansAcces('chargement')
    })
    return () => { actif = false }
  }, [espace])

  useEffect(() => {
    if (sansAcces === 'envoi') refSansAcces.current?.focus()
  }, [sansAcces])

  useEffect(() => {
    if (etape !== 'connexion' || !retourDepuisOubli.current) return
    retourDepuisOubli.current = false
    refEmail.current?.focus()
  }, [etape])

  const terminerEnvoi = () => {
    envoiEnCours.current = false
    setEnvoi(false)
  }

  const echouer = (erreur: unknown) => {
    console.warn('[aj-signalement] connexion impossible :', resumeErreurConnexionQr(erreur))
    setErreurGenerale(T.erreurs[classerErreurConnexionQr(erreur)])
    terminerEnvoi()
  }

  /** Compte sans accès : message neutre, mot de passe effacé, session ouverte par cette page fermée (portée locale). */
  const refuserAcces = async () => {
    setSansAcces('envoi')
    setMotDePasse('')
    let erreur: unknown = null
    try {
      erreur = (await supabase.auth.signOut({ scope: 'local' })).error
    } catch (e) {
      erreur = e
    }
    if (erreur) {
      console.warn('[aj-signalement] fermeture de la session impossible :', resumeErreurConnexionQr(erreur))
      toast.error(TEXTES_ESPACE_QR.deconnexionImpossible)
    }
  }

  const soumettre = async (evenement: FormEvent<HTMLFormElement>) => {
    evenement.preventDefault()
    if (envoiEnCours.current) return
    setErreurGenerale(null)
    const saisie = validerSaisieConnexionQr(email, motDePasse)
    if (!saisie.ok) {
      setErreurs(saisie.erreurs)
      const premier = saisie.erreurs.email ? refEmail : refMotDePasse
      premier.current?.focus()
      return
    }
    setErreurs({})
    setSansAcces(null)
    connexionLancee.current = true
    envoiEnCours.current = true
    setEnvoi(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: saisie.email, password: saisie.motDePasse })
      if (error) {
        echouer(error)
        return
      }
      const destination = destinationConnexionEspaceQr(espace, window.location.hash, data.user?.app_metadata)
      if (destination) {
        // Remplace l'entrée d'historique : « retour » ne ramène pas au formulaire. Bouton désactivé jusqu'au départ.
        window.location.replace(destination)
        return
      }
      await refuserAcces()
      terminerEnvoi()
    } catch (erreur) {
      echouer(erreur)
    }
  }

  /** « Mot de passe oublié ? » : les messages de la connexion (ancien compte, ancienne erreur) ne suivent pas. */
  const ouvrirOubli = () => {
    setErreurs({})
    setErreurGenerale(null)
    setSansAcces(null)
    setMotDePasse('')
    setEtape('oubli')
  }

  const revenirALaConnexion = () => {
    retourDepuisOubli.current = true
    setEtape('connexion')
  }

  return (
    <PagePleineQr>
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-[#C9A84C] to-[#A8842A] text-[#0D1B2E]">
        <Icone nom="qr" taille={24} />
      </div>
      <p className="mt-5 text-sm font-semibold uppercase tracking-[1.5px] text-[#6F5313]">{contexte.nom}</p>
      <h1 className="font-serif text-2xl text-[#0D1B2E] md:text-3xl">{T.titre}</h1>

      {etape === 'oubli' ? (
        <MotDePasseOublieQr email={email} onEmail={setEmail} onRetour={revenirALaConnexion} />
      ) : (
        <>
          <p className="mt-2 text-base text-[#4A5E78]">{T.aide}</p>

          {sansAcces && (
            <div ref={refSansAcces} tabIndex={-1} className="mt-6 outline-none">
              <Encadre ton="avertissement" role={sansAcces === 'envoi' ? 'alert' : 'status'}>
                <p>{T.sansAcces}</p>
                <p className="mt-1">{T.autreCompte}</p>
              </Encadre>
            </div>
          )}
          {erreurGenerale && <Encadre ton="erreur" className="mt-6">{erreurGenerale}</Encadre>}

          <form noValidate onSubmit={(evenement) => { void soumettre(evenement) }} className="mt-6 space-y-5">
            <Champ id={ID_EMAIL} etiquette={T.email} erreur={erreurs.email}>
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
                onChange={(e) => setEmail(e.target.value)}
                {...attributsErreur(ID_EMAIL, erreurs.email)}
                className={CLASSES_SAISIE}
              />
            </Champ>
            <Champ id={ID_MOT_DE_PASSE} etiquette={T.motDePasse} erreur={erreurs.motDePasse}>
              <div className="relative">
                <input
                  id={ID_MOT_DE_PASSE}
                  ref={refMotDePasse}
                  type={voirMotDePasse ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  {...attributsErreur(ID_MOT_DE_PASSE, erreurs.motDePasse)}
                  className={`${CLASSES_SAISIE} pr-14`}
                />
                <button
                  type="button"
                  onClick={() => setVoirMotDePasse((v) => !v)}
                  aria-label={voirMotDePasse ? T.masquerMotDePasse : T.afficherMotDePasse}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[#4A5E78] hover:text-[#0D1B2E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
                >
                  {voirMotDePasse ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              </div>
            </Champ>
            <div className="flex justify-end">
              <button type="button" onClick={ouvrirOubli} disabled={envoi} className={CLASSES_LIEN_CONNEXION_QR}>
                {T.motDePasseOublie}
              </button>
            </div>
            <Bouton variante="principal" type="submit" icone="utilisateur" pleineLargeur disabled={envoi}>
              {envoi ? T.connexionEnCours : T.seConnecter}
            </Bouton>
          </form>
        </>
      )}
    </PagePleineQr>
  )
}
