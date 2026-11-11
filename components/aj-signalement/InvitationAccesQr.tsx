'use client'

// ── Ouverture de l'accès d'un gestionnaire (vitfix.io/<identifiant>/invitation/#<jeton>, PR 2) ─────────────────────
//
// Demandes de Hugo du 10 et du 11/11/2026 (SPEC § 2.3.2) : chaque gestionnaire a un compte VitFix professionnel ; il le
// crée ici, depuis le lien reçu par e-mail, en choisissant son mot de passe. Même socle que la confirmation d'adresse
// (ConfirmationAdresseQr) : le jeton du lien est lu dans l'ancre, gardé en mémoire seulement, et l'ancre est effacée de
// l'adresse AVANT tout appel ; l'ouverture ne fait qu'une lecture sans effet (un antivirus qui ouvre le lien n'ouvre
// rien). Deux champs de mot de passe (règle de « mot de passe oublié » : motDePasseConforme) et la case « politique de
// confidentialité », contrôlés AVANT tout envoi ; « Ce n'est pas moi » demande une confirmation, puis conteste (aucun
// compte créé, le cabinet est prévenu). Succès : « Accès ouvert. Connectez-vous. » et le lien vers la connexion du
// cabinet ; aucune session n'est ouverte ici. Page publique, en français, styles de l'espace ; aucune ressource tierce.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { remplir } from '@/lib/coproprietaire/textes'
import { motDePasseConforme } from '@/lib/auth/lien-email'
import { Bouton, CLASSES_SAISIE, Champ, Encadre } from '@/components/coproprietaire-dashboard/ui'
import { accepterAccesQr, contesterAccesQr, lireLienAccesQr, type CodeErreurQr } from '@/lib/aj-signalement/api'
import { TEXTES_INVITATION_ACCES_QR as T } from '@/lib/aj-signalement/affichage-gestion'

/** Jeton signé du lien (lib/equipe) : 48 hexadécimaux, un point, 64 hexadécimaux. */
const FORMAT_JETON_LIEN_QR = /^[a-f0-9]{48}\.[a-f0-9]{64}$/

const ID_MOT_DE_PASSE = 'qr-invitation-mot-de-passe'
const ID_CONFIRMATION = 'qr-invitation-confirmation'
const ID_POLITIQUE = 'qr-invitation-politique'

type Fin = { statut: 'fin'; ton: 'succes' | 'info' | 'erreur' | 'avertissement'; message: string; connexion: boolean }
type Etat =
  | { statut: 'lecture' }
  | { statut: 'pret'; nomCourt: string; cabinet: string; email: string }
  | Fin
  | { statut: 'reprise'; message: string }

interface ErreursSaisie { motDePasse?: string; confirmation?: string; politique?: string }

const fin = (ton: Fin['ton'], message: string, connexion = false): Fin => ({ statut: 'fin', ton, message, connexion })
const FIN_INVALIDE = fin('erreur', T.invalide)

/** Lien refusé : message définitif (404, 409, 410) ; sinon null (réseau, serveur, saisie : on peut réessayer). */
function finDepuisCode(code: CodeErreurQr): Fin | null {
  if (code === 'introuvable') return FIN_INVALIDE
  if (code === 'expire') return fin('avertissement', T.expire)
  if (code === 'deja_ouvert') return fin('info', T.dejaOuvert, true)
  if (code === 'compte_autre_espace') return fin('avertissement', T.autreEspace)
  return null
}

const messageReprise = (code: CodeErreurQr): string => (code === 'reseau' ? T.reseau : T.indisponible)

/** Jeton de l'ancre de l'adresse (lu sans l'effacer : l'effacement suit, avant tout appel). Navigateur seulement. */
function jetonDeLAncre(): string | null {
  const brut = window.location.hash.replace(/^#/, '')
  return FORMAT_JETON_LIEN_QR.test(brut) ? brut : null
}

/** Attributs d'accessibilité d'un champ en erreur (message posé par Champ sous l'id « <champ>-aide »). */
const attributsErreur = (id: string, erreur: string | undefined) => (erreur ? { 'aria-invalid': true, 'aria-describedby': `${id}-aide` } : {})

export default function InvitationAccesQr({ identifiant }: Readonly<{ identifiant: string }>) {
  // undefined : ancre pas encore lue (rendu du serveur et hydratation identiques : « Vérification du lien… »).
  const [jeton, setJeton] = useState<string | null | undefined>(undefined)
  const lu = useRef<string | null | undefined>(undefined)
  const [etatLecture, setEtat] = useState<Etat>({ statut: 'lecture' })
  const etat: Etat = jeton === null ? FIN_INVALIDE : etatLecture
  const [essai, setEssai] = useState(0)
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [politique, setPolitique] = useState(false)
  const [voir, setVoir] = useState(false)
  const [erreurs, setErreurs] = useState<ErreursSaisie>({})
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null)
  const [demandeRefus, setDemandeRefus] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const refMotDePasse = useRef<HTMLInputElement>(null)
  const refConfirmation = useRef<HTMLInputElement>(null)
  const refPolitique = useRef<HTMLInputElement>(null)

  // Au montage : jeton lu dans l'ancre UNE fois (React.StrictMode rejoue cet effet après l'effacement), ancre effacée
  // de l'adresse, puis lecture par l'effet suivant (aucun appel avant l'effacement).
  useEffect(() => {
    lu.current ??= jetonDeLAncre()
    if (window.location.hash) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    setJeton(lu.current)
  }, [])

  useEffect(() => {
    if (!jeton) return
    let actif = true
    void lireLienAccesQr(jeton, identifiant).then((r) => {
      if (!actif) return
      if (r.ok) {
        setEtat({ statut: 'pret', nomCourt: r.nomCourt, cabinet: r.cabinet, email: r.email })
        return
      }
      const arret = r.code === 'invalide' ? FIN_INVALIDE : finDepuisCode(r.code)
      if (arret) {
        setEtat(arret)
        return
      }
      const message = messageReprise(r.code)
      toast.error(message)
      setEtat({ statut: 'reprise', message })
    })
    return () => { actif = false }
  }, [jeton, identifiant, essai])

  const reessayer = () => {
    setEtat({ statut: 'lecture' })
    setEssai((n) => n + 1)
  }

  /** Fin de la page : les mots de passe saisis sont effacés de la mémoire du formulaire. */
  const terminer = (f: Fin) => {
    setMotDePasse('')
    setConfirmation('')
    setEtat(f)
  }

  /** Échec après lequel on peut réessayer : mot de passe refusé par le serveur, trop d'essais, réseau ou service. */
  const echecReprenable = (code: CodeErreurQr) => {
    if (code === 'invalide') {
      setErreurGenerale(T.erreurs.refuse)
    } else if (code === 'trop_de_demandes') {
      setErreurGenerale(T.erreurs.tropDeDemandes)
    } else {
      const message = messageReprise(code)
      toast.error(message)
      setErreurGenerale(message)
    }
  }

  /** Champ à reprendre en premier (focus). */
  const premierChampEnErreur = (saisie: ErreursSaisie) => {
    if (saisie.motDePasse) return refMotDePasse
    if (saisie.confirmation) return refConfirmation
    return refPolitique
  }

  const ouvrir = async (evenement: FormEvent<HTMLFormElement>) => {
    evenement.preventDefault()
    if (!jeton || occupe || etat.statut !== 'pret') return
    setErreurGenerale(null)
    const saisie: ErreursSaisie = {}
    if (!motDePasseConforme(motDePasse)) saisie.motDePasse = T.erreurs.regle
    else if (motDePasse !== confirmation) saisie.confirmation = T.erreurs.differents
    if (!politique) saisie.politique = T.erreurs.politique
    setErreurs(saisie)
    if (saisie.motDePasse || saisie.confirmation || saisie.politique) {
      premierChampEnErreur(saisie).current?.focus()
      return
    }
    setOccupe(true)
    const r = await accepterAccesQr(jeton, identifiant, motDePasse)
    setOccupe(false)
    if (r.ok) {
      terminer(r.liaisonIncomplete ? fin('avertissement', T.liaisonIncomplete) : fin('succes', T.ouvert, true))
      return
    }
    const arret = finDepuisCode(r.code)
    if (arret) terminer(arret)
    else echecReprenable(r.code)
  }

  const contester = async () => {
    if (!jeton || occupe || etat.statut !== 'pret') return
    setOccupe(true)
    const r = await contesterAccesQr(jeton, identifiant)
    setOccupe(false)
    if (r.ok) {
      terminer(fin('succes', T.contestee))
      return
    }
    const arret = finDepuisCode(r.code)
    if (arret) terminer(arret)
    else echecReprenable(r.code)
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#F7F4EE] px-4 py-10" lang="fr">
      <div className="w-full max-w-lg rounded-2xl border border-[#E4DDD0] bg-white p-6 shadow-sm md:p-8">
        <h1 className="font-serif text-2xl text-[#0D1B2E]">{T.titre}</h1>
        <div className="mt-5 space-y-4">
          {etat.statut === 'lecture' && <p role="status" className="text-base text-[#4A5E78]">{T.verification}</p>}

          {etat.statut === 'pret' && (
            <>
              <p className="text-base font-semibold text-[#0D1B2E]">
                {remplir(T.presentation, { nomCourt: etat.nomCourt, cabinet: etat.cabinet, email: etat.email })}
              </p>
              <p className="text-base text-[#1F2D3D]">{T.explication}</p>
              {erreurGenerale && <Encadre ton="erreur" role="alert">{erreurGenerale}</Encadre>}
              {demandeRefus ? (
                <div className="space-y-3">
                  <Encadre ton="avertissement">{T.pasMoiAvertissement}</Encadre>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Bouton variante="danger" disabled={occupe} className="flex-1" onClick={() => { void contester() }}>{T.confirmerPasMoi}</Bouton>
                    <Bouton variante="secondaire" disabled={occupe} className="flex-1" onClick={() => setDemandeRefus(false)}>{T.annuler}</Bouton>
                  </div>
                </div>
              ) : (
                <form noValidate onSubmit={(evenement) => { void ouvrir(evenement) }} className="space-y-5">
                  <Champ id={ID_MOT_DE_PASSE} etiquette={T.motDePasse} aide={T.regle} erreur={erreurs.motDePasse}>
                    <div className="relative">
                      <input
                        id={ID_MOT_DE_PASSE}
                        ref={refMotDePasse}
                        type={voir ? 'text' : 'password'}
                        name="password"
                        autoComplete="new-password"
                        required
                        value={motDePasse}
                        onChange={(e) => setMotDePasse(e.target.value)}
                        {...attributsErreur(ID_MOT_DE_PASSE, erreurs.motDePasse)}
                        className={`${CLASSES_SAISIE} pr-14`}
                      />
                      <button
                        type="button"
                        onClick={() => setVoir((v) => !v)}
                        aria-label={voir ? T.masquer : T.afficher}
                        className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[#4A5E78] hover:text-[#0D1B2E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
                      >
                        {voir ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                      </button>
                    </div>
                  </Champ>
                  <Champ id={ID_CONFIRMATION} etiquette={T.confirmation} erreur={erreurs.confirmation}>
                    <input
                      id={ID_CONFIRMATION}
                      ref={refConfirmation}
                      type={voir ? 'text' : 'password'}
                      name="password-confirmation"
                      autoComplete="new-password"
                      required
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      {...attributsErreur(ID_CONFIRMATION, erreurs.confirmation)}
                      className={CLASSES_SAISIE}
                    />
                  </Champ>
                  <div>
                    <label className="flex min-h-[44px] items-center gap-3 text-base text-[#0D1B2E]">
                      <input
                        id={ID_POLITIQUE}
                        ref={refPolitique}
                        type="checkbox"
                        checked={politique}
                        onChange={(e) => setPolitique(e.target.checked)}
                        {...attributsErreur(ID_POLITIQUE, erreurs.politique)}
                        className="h-5 w-5 accent-[#C9A84C]"
                      />
                      <span>
                        {T.politique}{' '}
                        <a href="/fr/confidentialite/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-[#6F5313]">
                          {T.politiqueLien}
                        </a>
                      </span>
                    </label>
                    {erreurs.politique && <p id={`${ID_POLITIQUE}-aide`} role="status" className="mt-1.5 text-sm text-[#8F2419]">{erreurs.politique}</p>}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Bouton variante="principal" type="submit" icone="check" disabled={occupe} className="flex-1">
                      {occupe ? T.ouvertureEnCours : T.ouvrir}
                    </Bouton>
                    <Bouton variante="secondaire" disabled={occupe} className="flex-1" onClick={() => setDemandeRefus(true)}>{T.pasMoi}</Bouton>
                  </div>
                </form>
              )}
            </>
          )}

          {etat.statut === 'fin' && (
            <>
              <Encadre ton={etat.ton}>{etat.message}</Encadre>
              {etat.connexion && <Bouton variante="principal" icone="utilisateur" href={`/${identifiant}/connexion/`}>{T.seConnecter}</Bouton>}
            </>
          )}

          {etat.statut === 'reprise' && (
            <>
              <Encadre ton="avertissement">{etat.message}</Encadre>
              <Bouton variante="principal" icone="actualiser" onClick={reessayer}>{T.reessayer}</Bouton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
