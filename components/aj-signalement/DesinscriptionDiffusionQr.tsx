'use client'

// ── Désinscription des messages de diffusion (vitfix.io/<identifiant>/desinscription/#<jeton>) ───────────────────
//
// Cahier PR 3 § 7.5, § 7.6, § 8.1 ; note juridique § 5.1 à § 5.5 ; décision H5 de Hugo. Écran NOUVEAU, brouillon soumis
// à Frédéric (F1). Page publique, sans session, servie SANS la coquille de VitFix (app/(sans-coquille)/, F3).
//
// Le jeton est lu dans le fragment UNE fois, gardé en mémoire, et le fragment est effacé de l'adresse AVANT tout appel
// (historique, capture d'écran, Referer). L'ouverture ne fait qu'une lecture sans effet (un antivirus qui ouvre le lien
// ne désinscrit personne) ; l'effet est au clic. Chaque bouton d'opposition est précédé des deux phrases du droit § 5.4
// (ce qu'on quitte, ce qu'on garde) ; ni « êtes-vous sûr ? », ni question, ni e-mail de confirmation (J19, J20).
// « Recevoir à nouveau » seulement quand le serveur le permet (le lien de la page qui a servi, dans les 24 h) ; jeton un
// clic (adresse de l'en-tête ouverte dans un navigateur) : mode réduit, ni adresse masquée ni retour en arrière. Lien
// expiré : repli par la saisie de l'adresse (réponse toujours la même). Aucune date affichée. Langue de la diffusion.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bouton, CLASSES_SAISIE, Champ, Encadre } from '@/components/coproprietaire-dashboard/ui'
import {
  lireLienDesinscriptionQr, opposerDesinscriptionQr, opposerParAdresseDesinscriptionQr, reprendreDesinscriptionQr,
  type CodeDesinscriptionQr, type LectureDesinscriptionQr,
} from '@/lib/aj-signalement/api-desinscription'
import {
  TEXTES_DESINSCRIPTION_QR, remplirDesinscriptionQr as remplir, type TextesDesinscriptionQr,
} from '@/lib/aj-signalement/textes-desinscription'
import type { LangueSignalementQr } from '@/lib/aj-signalement/types'

/** Jeton signé du lien (lib/aj-signalement/diffusion-lien.ts) : 32 hexadécimaux, un point, 64 hexadécimaux. */
const FORMAT_JETON = /^[a-f0-9]{32}\.[a-f0-9]{64}$/
/** Contrôle d'aide seulement (le serveur valide) : une partie locale, un « @ », un domaine avec un point. */
const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Politique recopiée dans un href : https seulement (jamais une adresse javascript:). */
const POLITIQUE_SURE = /^https:\/\/[A-Za-z0-9._~:/?#@!$&()*+,;=%-]+$/
const ID_CHAMP_EMAIL = 'desinscription-email'

type InfoValide = Extract<LectureDesinscriptionQr, { etat: 'valide' }>
type InfoExpire = Extract<LectureDesinscriptionQr, { etat: 'expire' }>

type Vue =
  | { vue: 'lecture' }
  | { vue: 'reprise'; code: CodeDesinscriptionQr }
  | { vue: 'inconnu'; contact: string | null }
  | { vue: 'ancien'; cabinet: string | null; contact: string | null; politiqueUrl: string | null }
  | { vue: 'valide'; info: InfoValide; resultat: 'aucun' | 'oppose' | 'repris'; erreur: CodeDesinscriptionQr | null }
  | { vue: 'expire'; info: InfoExpire; envoye: boolean; erreur: CodeDesinscriptionQr | null }

/** Cabinet du chemin, lu par la page (serveur) : langue par défaut et contact de la page « non valable ». */
export interface CabinetDuCheminDesinscriptionQr {
  langue: LangueSignalementQr
  contact: string | null
}

/** Jeton du fragment de l'adresse (lu sans l'effacer : l'effacement suit, avant tout appel). Navigateur seulement. */
function jetonDuFragment(): string | null {
  const brut = window.location.hash.replace(/^#/, '')
  return FORMAT_JETON.test(brut) ? brut : null
}

/** Message d'un échec (jamais un détail du serveur). */
function messageErreur(code: CodeDesinscriptionQr, T: TextesDesinscriptionQr): string {
  if (code === 'limite') return T.limite
  if (code === 'reseau') return T.reseau
  if (code === 'non_levable') return T.nonLevable
  return T.indisponible
}

const politiqueSure = (url: string | null, cabinet: string | null): { url: string; cabinet: string } | null =>
  (url && cabinet && POLITIQUE_SURE.test(url) ? { url, cabinet } : null)

export default function DesinscriptionDiffusionQr({
  identifiant, cabinet,
}: Readonly<{ identifiant: string | null; cabinet: CabinetDuCheminDesinscriptionQr | null }>) {
  // undefined : fragment pas encore lu. Le rendu du serveur (le fragment ne lui parvient jamais) et la première passe du
  // navigateur (hydratation) montrent donc le même « Vérification du lien… ». null : fragment absent ou hors format.
  const [jeton, setJeton] = useState<string | null | undefined>(undefined)
  const lu = useRef<string | null | undefined>(undefined)
  const [etatLu, setEtat] = useState<Vue>({ vue: 'lecture' })
  const [langue, setLangue] = useState<LangueSignalementQr>(cabinet?.langue ?? 'fr')
  const [essai, setEssai] = useState(0)
  const [occupe, setOccupe] = useState(false)
  const [email, setEmail] = useState('')
  const [emailFaux, setEmailFaux] = useState(false)
  const [focus, setFocus] = useState(0)
  const refResultat = useRef<HTMLDivElement>(null)
  const T = TEXTES_DESINSCRIPTION_QR[langue]
  const contactChemin = cabinet?.contact ?? null
  let etat: Vue = etatLu
  if (identifiant === null) etat = { vue: 'inconnu', contact: null }
  else if (jeton === null) etat = { vue: 'inconnu', contact: contactChemin }

  // Au montage : jeton lu dans le fragment UNE fois (gardé en référence : React.StrictMode rejoue cet effet après
  // l'effacement), fragment effacé de l'adresse, puis lecture par l'effet suivant (aucun appel avant l'effacement).
  useEffect(() => {
    lu.current ??= jetonDuFragment()
    if (window.location.hash) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    setJeton(lu.current)
  }, [])

  // Langue déclarée du document et titre de l'onglet : ceux de la diffusion dès qu'ils sont connus (la mise en page
  // racine et les métadonnées de la page sont en français).
  useEffect(() => {
    document.documentElement.lang = langue
    document.title = TEXTES_DESINSCRIPTION_QR[langue].titre
  }, [langue])

  useEffect(() => {
    if (!jeton || identifiant === null) return
    let actif = true
    void lireLienDesinscriptionQr(jeton, identifiant).then((r) => {
      if (!actif) return
      if (!r.ok) {
        setEtat(r.code === 'lien_invalide' || r.code === 'invalide' ? { vue: 'inconnu', contact: contactChemin } : { vue: 'reprise', code: r.code })
        return
      }
      const l = r.lecture
      setLangue(l.langue)
      if (l.etat === 'valide') setEtat({ vue: 'valide', info: l, resultat: 'aucun', erreur: null })
      else if (l.etat === 'expire') setEtat({ vue: 'expire', info: l, envoye: false, erreur: null })
      else if (l.etat === 'ancien') setEtat({ vue: 'ancien', cabinet: l.cabinet, contact: l.contactCabinet, politiqueUrl: l.politiqueUrl })
      else setEtat({ vue: 'inconnu', contact: l.contactCabinet })
    })
    return () => { actif = false }
  }, [jeton, identifiant, essai, contactChemin])

  // Focus déplacé sur le message de résultat après chaque clic (§ 7.6).
  useEffect(() => {
    if (focus > 0) refResultat.current?.focus()
  }, [focus])

  const reessayer = () => {
    setEtat({ vue: 'lecture' })
    setEssai((n) => n + 1)
  }

  /** Repli par l'adresse, depuis la page d'un lien devenu expiré au clic (410). */
  const versRepli = (info: InfoValide) => setEtat({
    vue: 'expire',
    info: { etat: 'expire', type: info.type, langue: info.langue, cabinet: info.cabinet, copropriete: info.copropriete, politiqueUrl: info.politiqueUrl },
    envoye: false,
    erreur: null,
  })

  const opposer = async () => {
    if (!jeton || identifiant === null || occupe || etat.vue !== 'valide') return
    const courant = etat
    setOccupe(true)
    const r = await opposerDesinscriptionQr(jeton, identifiant)
    setOccupe(false)
    if (r.ok) {
      setEtat({ vue: 'valide', info: { ...courant.info, oppose: true, levable: courant.info.type === 'page' && r.levable }, resultat: 'oppose', erreur: null })
      setFocus((n) => n + 1)
      return
    }
    if (r.code === 'lien_expire') return versRepli(courant.info)
    if (r.code === 'lien_invalide') return setEtat({ vue: 'inconnu', contact: contactChemin })
    setEtat({ ...courant, erreur: r.code })
  }

  const reprendre = async () => {
    if (!jeton || identifiant === null || occupe || etat.vue !== 'valide' || etat.info.type !== 'page') return
    const courant = etat
    setOccupe(true)
    const r = await reprendreDesinscriptionQr(jeton, identifiant)
    setOccupe(false)
    if (r.ok) {
      setEtat({ vue: 'valide', info: { ...courant.info, oppose: false, levable: false }, resultat: 'repris', erreur: null })
      setFocus((n) => n + 1)
      return
    }
    if (r.code === 'lien_expire') return versRepli(courant.info)
    if (r.code === 'lien_invalide') return setEtat({ vue: 'inconnu', contact: contactChemin })
    if (r.code === 'non_levable') return setEtat({ ...courant, info: { ...courant.info, levable: false }, resultat: 'aucun', erreur: 'non_levable' })
    setEtat({ ...courant, erreur: r.code })
  }

  const envoyerAdresse = async () => {
    if (!jeton || identifiant === null || occupe || etat.vue !== 'expire') return
    const saisie = email.trim()
    if (!FORMAT_EMAIL.test(saisie)) {
      setEmailFaux(true)
      return
    }
    setEmailFaux(false)
    const courant = etat
    setOccupe(true)
    const r = await opposerParAdresseDesinscriptionQr(jeton, identifiant, saisie)
    setOccupe(false)
    if (r.ok) {
      setEtat({ ...courant, envoye: true, erreur: null })
      setFocus((n) => n + 1)
      return
    }
    if (r.code === 'invalide') {
      setEmailFaux(true)
      return
    }
    setEtat({ ...courant, erreur: r.code })
  }

  const phrases = (
    <>
      <p className="text-base text-[#1F2D3D]">{T.quitter}</p>
      <p className="text-base text-[#1F2D3D]">{T.garder}</p>
    </>
  )
  const boutonReprendre = (
    <Bouton variante="secondaire" disabled={occupe} pleineLargeur onClick={() => { void reprendre() }}>{T.boutonReprendre}</Bouton>
  )

  let contenu: ReactNode = null
  let politique: { url: string; cabinet: string } | null = null
  switch (etat.vue) {
    case 'lecture':
      contenu = <p role="status" className="text-base text-[#4A5E78]">{T.verification}</p>
      break
    case 'reprise':
      contenu = (
        <>
          <Encadre ton="avertissement" role="alert">{messageErreur(etat.code, T)}</Encadre>
          <Bouton variante="principal" icone="actualiser" onClick={reessayer}>{T.reessayer}</Bouton>
        </>
      )
      break
    case 'inconnu':
      contenu = <p className="text-base text-[#1F2D3D]">{etat.contact ? remplir(T.inconnu, { contact: etat.contact }) : T.inconnuSansContact}</p>
      break
    case 'ancien':
      politique = politiqueSure(etat.politiqueUrl, etat.cabinet)
      contenu = (
        <p className="text-base text-[#1F2D3D]">
          {etat.contact && etat.cabinet ? remplir(T.ancien, { cabinet: etat.cabinet, contact: etat.contact }) : T.ancienSansContact}
        </p>
      )
      break
    case 'valide': {
      const { info, resultat } = etat
      politique = politiqueSure(info.politiqueUrl, info.cabinet)
      const masque = info.type === 'page' ? info.emailMasque : null
      const presentation = masque
        ? remplir(T.presentation, { copropriete: info.copropriete, cabinet: info.cabinet, email: masque })
        : remplir(T.presentationSansEmail, { copropriete: info.copropriete, cabinet: info.cabinet })
      const levable = info.type === 'page' && info.levable
      let suite: ReactNode
      if (resultat === 'oppose') {
        suite = (
          <>
            <div ref={refResultat} tabIndex={-1} className="space-y-3 outline-none">
              <Encadre ton="succes">{T.opposeFait}</Encadre>
              <p className="text-base text-[#1F2D3D]">{T.garder}</p>
            </div>
            {levable && boutonReprendre}
          </>
        )
      } else if (info.oppose) {
        suite = (
          <>
            <p className="text-base text-[#1F2D3D]">{T.dejaOppose}</p>
            {levable && boutonReprendre}
          </>
        )
      } else {
        suite = (
          <>
            {resultat === 'repris' && (
              <div ref={refResultat} tabIndex={-1} className="outline-none">
                <Encadre ton="succes">{T.reprisFait}</Encadre>
              </div>
            )}
            {phrases}
            <Bouton variante="principal" disabled={occupe} pleineLargeur onClick={() => { void opposer() }}>{T.boutonOpposer}</Bouton>
          </>
        )
      }
      contenu = (
        <>
          <p className="text-base font-semibold text-[#0D1B2E]">{presentation}</p>
          {suite}
          {etat.erreur && <Encadre ton="erreur">{messageErreur(etat.erreur, T)}</Encadre>}
        </>
      )
      break
    }
    case 'expire': {
      const { info } = etat
      politique = politiqueSure(info.politiqueUrl, info.cabinet)
      contenu = (
        <>
          <p className="text-base text-[#1F2D3D]">{remplir(T.expireIntro, { copropriete: info.copropriete })}</p>
          {etat.envoye ? (
            <div ref={refResultat} tabIndex={-1} className="outline-none">
              <Encadre ton="succes">{T.expireFait}</Encadre>
            </div>
          ) : (
            <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); void envoyerAdresse() }}>
              {phrases}
              <Champ id={ID_CHAMP_EMAIL} etiquette={T.champEmail} erreur={emailFaux ? T.emailInvalide : undefined}>
                <input
                  id={ID_CHAMP_EMAIL}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={emailFaux}
                  aria-describedby={emailFaux ? `${ID_CHAMP_EMAIL}-aide` : undefined}
                  className={CLASSES_SAISIE}
                />
              </Champ>
              <Bouton type="submit" variante="principal" disabled={occupe} pleineLargeur>{T.boutonOpposer}</Bouton>
            </form>
          )}
          {etat.erreur && <Encadre ton="erreur">{messageErreur(etat.erreur, T)}</Encadre>}
        </>
      )
      break
    }
  }

  return (
    <main lang={langue} className="flex min-h-screen items-start justify-center bg-[#F7F4EE] px-4 py-10 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-[#E4DDD0] bg-white p-6 shadow-sm md:p-8">
        <h1 className="font-serif text-2xl text-[#0D1B2E]">{T.titre}</h1>
        <div className="mt-5 space-y-4">{contenu}</div>
        {politique && (
          <p className="mt-8 border-t border-[#E4DDD0] pt-4 text-sm text-[#4A5E78]">
            <a href={politique.url} rel="noreferrer" className="text-[#1F3A5F] underline underline-offset-2">
              {remplir(T.politique, { cabinet: politique.cabinet })}
            </a>
          </p>
        )}
      </div>
    </main>
  )
}
