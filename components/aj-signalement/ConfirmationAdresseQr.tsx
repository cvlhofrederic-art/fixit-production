'use client'

// ── Confirmation d'adresse d'un gestionnaire (vitfix.io/<identifiant>/confirmation-adresse/#<jeton>) ─────────────
//
// SPEC § 1.7.4. La confirmation prouve la boîte, pas l'identité : la page nomme la personne et le cabinet pour qu'un
// mauvais destinataire se reconnaisse et réponde « Ce n'est pas moi ». Le jeton du lien est lu dans l'ancre, gardé en
// mémoire seulement, et l'ancre est effacée de l'adresse AVANT tout appel (historique, capture d'écran). L'ouverture ne
// fait qu'une lecture sans effet (un antivirus qui ouvre le lien ne confirme rien) ; « C'est moi » confirme ;
// « Ce n'est pas moi » demande une confirmation, puis conteste (la fiche est figée, le cabinet prévenu). Page publique,
// en français, au socle visuel de l'espace ; aucune ressource tierce.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { remplir } from '@/lib/coproprietaire/textes'
import { Bouton, Encadre } from '@/components/coproprietaire-dashboard/ui'
import { confirmerAdresseQr, contesterAdresseQr, lireLienConfirmationQr, type CodeErreurQr } from '@/lib/aj-signalement/api'
import { TEXTES_CONFIRMATION_QR as C } from '@/lib/aj-signalement/affichage-gestion'

/** Jeton signé du lien (lib/equipe) : 48 hexadécimaux, un point, 64 hexadécimaux. */
const FORMAT_JETON_LIEN_QR = /^[a-f0-9]{48}\.[a-f0-9]{64}$/

type Fin = { statut: 'fin'; ton: 'succes' | 'info' | 'erreur' | 'avertissement'; message: string }
type Etat =
  | { statut: 'lecture' }
  | { statut: 'pret'; nomCourt: string; cabinet: string; email: string; erreur: string | null }
  | Fin
  | { statut: 'reprise'; message: string }

const FIN_INVALIDE: Fin = { statut: 'fin', ton: 'erreur', message: C.invalide }

/** Lien refusé : message définitif (404, 409, 410) ; sinon null (réseau ou serveur : on peut réessayer). */
function finDepuisCode(code: CodeErreurQr): Fin | null {
  if (code === 'introuvable' || code === 'invalide') return FIN_INVALIDE
  if (code === 'deja_confirmee') return { statut: 'fin', ton: 'info', message: C.dejaConfirmee }
  if (code === 'expire') return { statut: 'fin', ton: 'avertissement', message: C.expire }
  return null
}

const messageReprise = (code: CodeErreurQr): string => (code === 'reseau' ? C.reseau : C.indisponible)

/** Jeton de l'ancre de l'adresse (lu sans l'effacer : l'effacement suit, avant tout appel). */
function jetonDeLAncre(): string | null {
  if (typeof window === 'undefined') return null
  const brut = window.location.hash.replace(/^#/, '')
  return FORMAT_JETON_LIEN_QR.test(brut) ? brut : null
}

export default function ConfirmationAdresseQr({ identifiant }: Readonly<{ identifiant: string }>) {
  const [jeton] = useState<string | null>(jetonDeLAncre)
  const [etat, setEtat] = useState<Etat>(() => (jeton ? { statut: 'lecture' } : FIN_INVALIDE))
  const [essai, setEssai] = useState(0)
  const [demandeRefus, setDemandeRefus] = useState(false)
  const [occupe, setOccupe] = useState(false)

  // Ancre effacée de l'adresse dès l'ouverture, avant l'appel ci-dessous (effets exécutés dans cet ordre).
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
  }, [])

  useEffect(() => {
    if (!jeton) return
    let actif = true
    void lireLienConfirmationQr(jeton, identifiant).then((r) => {
      if (!actif) return
      if (r.ok) {
        setEtat({ statut: 'pret', nomCourt: r.nomCourt, cabinet: r.cabinet, email: r.email, erreur: null })
        return
      }
      const fin = finDepuisCode(r.code)
      if (fin) {
        setEtat(fin)
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

  const repondre = async (reponse: 'confirmer' | 'contester') => {
    if (!jeton || occupe || etat.statut !== 'pret') return
    setOccupe(true)
    const r = reponse === 'confirmer' ? await confirmerAdresseQr(jeton, identifiant) : await contesterAdresseQr(jeton, identifiant)
    setOccupe(false)
    if (r.ok) {
      setEtat({ statut: 'fin', ton: 'succes', message: reponse === 'confirmer' ? C.confirmee : C.contestee })
      return
    }
    const fin = finDepuisCode(r.code)
    if (fin) {
      setEtat(fin)
      return
    }
    const message = messageReprise(r.code)
    toast.error(message)
    setEtat({ ...etat, erreur: message })
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#F7F4EE] px-4 py-10" lang="fr">
      <div className="w-full max-w-lg rounded-2xl border border-[#E4DDD0] bg-white p-6 shadow-sm md:p-8">
        <h1 className="font-serif text-2xl text-[#0D1B2E]">{C.titre}</h1>
        <div className="mt-5 space-y-4">
          {etat.statut === 'lecture' && <p role="status" className="text-base text-[#4A5E78]">{C.verification}</p>}

          {etat.statut === 'pret' && (
            <>
              <p className="text-base font-semibold text-[#0D1B2E]">
                {remplir(C.presentation, { nomCourt: etat.nomCourt, cabinet: etat.cabinet, email: etat.email })}
              </p>
              <p className="text-base text-[#1F2D3D]">{C.explication}</p>
              {etat.erreur && <Encadre ton="erreur">{etat.erreur}</Encadre>}
              {demandeRefus ? (
                <div className="space-y-3">
                  <Encadre ton="avertissement">{C.pasMoiAvertissement}</Encadre>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Bouton variante="danger" disabled={occupe} className="flex-1" onClick={() => { void repondre('contester') }}>{C.confirmerPasMoi}</Bouton>
                    <Bouton variante="secondaire" disabled={occupe} className="flex-1" onClick={() => setDemandeRefus(false)}>{C.annuler}</Bouton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Bouton variante="principal" icone="check" disabled={occupe} className="flex-1" onClick={() => { void repondre('confirmer') }}>{C.cestMoi}</Bouton>
                  <Bouton variante="secondaire" disabled={occupe} className="flex-1" onClick={() => setDemandeRefus(true)}>{C.pasMoi}</Bouton>
                </div>
              )}
            </>
          )}

          {etat.statut === 'fin' && <Encadre ton={etat.ton}>{etat.message}</Encadre>}

          {etat.statut === 'reprise' && (
            <>
              <Encadre ton="avertissement">{etat.message}</Encadre>
              <Bouton variante="principal" icone="actualiser" onClick={reessayer}>{C.reessayer}</Bouton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
