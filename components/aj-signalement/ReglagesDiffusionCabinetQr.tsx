'use client'

// ── AJ Signalement — « Diffusion d'informations » d'un cabinet : réglages et activation (PR 3, lot 8, BROUILLON) ──────
//
// Cahier PR 3 § 7.4 (D-R8, super admin, fiche du cabinet) : adresse de contact (réponses des résidents), adresse de la
// politique de confidentialité du cabinet et case DATÉE « Cette politique décrit la diffusion (finalité, base légale,
// durée, droit d'opposition) » (droit § 4.5, HF2 : changer l'adresse oblige à refaire la déclaration), référence et date
// de signature du contrat de sous-traitance (HF1), numéros de téléphone autorisés dans les messages (H2 ; 10 au plus),
// « Activer la diffusion » / « Suspendre la diffusion » (les envois en cours s'arrêtent au lot suivant).
// Activation refusée, avec la liste de ce qui manque (dès l'écran, puis 409 cabinet_incomplet du serveur, qui reste
// juge), ou si la langue du cabinet n'est pas ouverte (H9 : le français seulement). Seuls les réglages changés partent,
// SEULS (jamais mêlés au nom ou à l'identifiant du cabinet : la route le refuse). Écran en BROUILLON (F1).

import { useEffect, useId, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Champ, CLASSES_SAISIE, Encadre } from '@/components/coproprietaire-dashboard/ui'
import { messageEchecDiffusionQr } from '@/components/aj-signalement/envoiDiffusionQr'
import {
  chargerReglagesDiffusionCabinetQr, reglerDiffusionCabinetQr, type ReglagesSaisisDiffusionQr,
} from '@/lib/aj-signalement/api'
import type { ManqueActivationDiffusionQr, ReglagesDiffusionCabinetQr } from '@/lib/aj-signalement/diffusion-formes'
import type { CabinetQr } from '@/lib/aj-signalement/types'
import {
  TEXTES_ECRAN_DIFFUSION_QR as TD, aujourdhuiParisEcranQr, dateNonFutureQr, jourLongParisQr, listeManquesActivationQr,
  telephonesDepuisSaisieQr,
} from '@/lib/aj-signalement/affichage-ecran-diffusion'

type Lecture = { etat: 'chargement' } | { etat: 'erreur'; message: string } | { etat: 'indisponible' } | { etat: 'pret'; reglages: ReglagesDiffusionCabinetQr }

/** Même langage que le CHECK de la base et le schéma de la route (lettres, chiffres, . _ % + -). */
const FORMAT_CONTACT = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/
const FORMAT_POLITIQUE = /^https:\/\/[A-Za-z0-9._~:/?#@!$&()*+,;=%-]{4,500}$/
const chiffres = (t: string): number => (t.match(/\d/g) ?? []).length
const memesListes = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])

interface Saisie {
  contact: string
  politique: string
  declarer: boolean
  contratReference: string
  contratDate: string
  telephones: string
}

const saisieDepuis = (r: ReglagesDiffusionCabinetQr): Saisie => ({
  contact: r.contactEmail ?? '', politique: r.politiqueUrl ?? '', declarer: false, contratReference: r.contratReference ?? '',
  contratDate: r.contratSigneLe ?? '', telephones: r.telephones.join(', '),
})

export default function ReglagesDiffusionCabinetQr({ cabinet, onFermer }: Readonly<{ cabinet: CabinetQr; onFermer: () => void }>) {
  const idBase = useId()
  const [lecture, setLecture] = useState<Lecture>({ etat: 'chargement' })
  const [saisie, setSaisie] = useState<Saisie>({ contact: '', politique: '', declarer: false, contratReference: '', contratDate: '', telephones: '' })
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    let actif = true
    void chargerReglagesDiffusionCabinetQr(cabinet.id).then((r) => {
      if (!actif) return
      if (!r.ok) return setLecture({ etat: 'erreur', message: messageEchecDiffusionQr(r.code, 'super_admin') })
      if (!r.reglages) return setLecture({ etat: 'indisponible' })
      setLecture({ etat: 'pret', reglages: r.reglages })
      setSaisie(saisieDepuis(r.reglages))
    })
    return () => { actif = false }
  }, [cabinet.id])

  if (lecture.etat === 'chargement') return <p role="status" className="text-base text-[#4A5E78]">{TD.chargement}</p>
  if (lecture.etat === 'erreur' || lecture.etat === 'indisponible') {
    return (
      <div className="space-y-4">
        <Encadre ton="avertissement">{lecture.etat === 'erreur' ? lecture.message : TD.reglages.indisponible}</Encadre>
        <Bouton variante="secondaire" onClick={onFermer}>{TD.boutons.fermer}</Bouton>
      </div>
    )
  }

  const r = lecture.reglages
  const t = TD.reglages
  // Déclaration déjà faite, et toujours pour la même adresse : rappelée, non modifiable ; nouvelle adresse : à refaire.
  const declaree = r.politiqueDeclareeLe !== null && saisie.politique.trim() === (r.politiqueUrl ?? '')
  const changer = (champ: keyof Saisie, valeur: string | boolean) => {
    setSaisie((s) => ({ ...s, [champ]: valeur }))
    setErreur(null)
    setSucces(null)
  }

  /** Réglages changés, contrôlés comme par la route ; un message si l'un d'eux est refusé. */
  const changements = (): { ok: true; reglages: ReglagesSaisisDiffusionQr } | { ok: false; message: string } => {
    const c: ReglagesSaisisDiffusionQr = {}
    const contact = saisie.contact.trim().toLowerCase()
    if (contact !== (r.contactEmail ?? '')) {
      if (contact.length > 254 || !FORMAT_CONTACT.test(contact)) return { ok: false, message: t.contactInvalide }
      c.diffusionContactEmail = contact
    }
    const politique = saisie.politique.trim()
    if (politique !== (r.politiqueUrl ?? '')) {
      if (politique.length < 12 || !FORMAT_POLITIQUE.test(politique)) return { ok: false, message: t.politiqueInvalide }
      c.diffusionPolitiqueUrl = politique
    }
    if (!declaree && saisie.declarer) c.politiqueDecritDiffusion = true
    const reference = saisie.contratReference.trim()
    if (reference !== (r.contratReference ?? '')) {
      if (Array.from(reference).length < 3 || Array.from(reference).length > 100) return { ok: false, message: t.contratInvalide }
      c.contratReference = reference
    }
    if (saisie.contratDate !== (r.contratSigneLe ?? '')) {
      if (!dateNonFutureQr(saisie.contratDate)) return { ok: false, message: t.dateInvalide }
      c.contratSigneLe = saisie.contratDate
    }
    const telephones = telephonesDepuisSaisieQr(saisie.telephones)
    if (!memesListes(telephones, r.telephones)) {
      if (telephones.length > 10 || telephones.some((n) => n.length > 40 || chiffres(n) < 6 || chiffres(n) > 15)) return { ok: false, message: t.telephonesInvalides }
      c.telephonesAutorises = telephones
    }
    return { ok: true, reglages: c }
  }

  /** Ce qui manquera à l'activation après l'enregistrement (même règle que la route ; le serveur reste juge). */
  const manqueApres = (): ManqueActivationDiffusionQr[] => {
    const manque: ManqueActivationDiffusionQr[] = []
    if (!saisie.contact.trim()) manque.push('contact')
    if (!saisie.politique.trim()) manque.push('politique')
    if (!declaree && !saisie.declarer) manque.push('declaration_politique')
    if (!saisie.contratReference.trim()) manque.push('contrat_reference')
    if (!saisie.contratDate) manque.push('contrat_date')
    return manque
  }

  const enregistrer = async (activation?: boolean) => {
    if (occupe) return
    setErreur(null)
    setSucces(null)
    if (activation === true) {
      const manque = manqueApres()
      if (manque.length > 0) return setErreur(remplir(t.manque, { liste: listeManquesActivationQr(manque) }))
    }
    const c = changements()
    if (!c.ok) return setErreur(c.message)
    const corps: ReglagesSaisisDiffusionQr = { ...c.reglages, ...(activation === undefined ? {} : { diffusionActivee: activation }) }
    if (Object.keys(corps).length === 0) return setSucces(t.rien)
    setOccupe(true)
    const resultat = await reglerDiffusionCabinetQr(cabinet.id, corps)
    setOccupe(false)
    if (!resultat.ok) {
      if (resultat.code === 'cabinet_incomplet') {
        return setErreur(remplir(t.manque, { liste: listeManquesActivationQr(resultat.manque && resultat.manque.length > 0 ? resultat.manque : manqueApres()) }))
      }
      if (resultat.code === 'langue_non_ouverte') return setErreur(t.langueNonOuverte)
      return setErreur(messageEchecDiffusionQr(resultat.code, 'super_admin'))
    }
    if (resultat.reglages) {
      setLecture({ etat: 'pret', reglages: resultat.reglages })
      setSaisie(saisieDepuis(resultat.reglages))
    }
    setSucces(activation === true ? t.activee : activation === false ? t.suspendue : t.enregistre)
  }

  const id = (cle: string) => `${idBase}-${cle}`
  const champ = (cle: keyof Saisie, etiquette: string, type: 'email' | 'url' | 'text' | 'date', aide?: string) => (
    <Champ id={id(cle)} etiquette={etiquette} aide={aide}>
      <input
        id={id(cle)} type={type} value={String(saisie[cle])} autoComplete="off" spellCheck={false} className={CLASSES_SAISIE}
        max={type === 'date' ? aujourdhuiParisEcranQr() : undefined} aria-describedby={aide ? `${id(cle)}-aide` : undefined}
        onChange={(e) => changer(cle, e.target.value)}
      />
    </Champ>
  )

  return (
    <form className="max-h-[70vh] space-y-4 overflow-y-auto pr-1" aria-busy={occupe} noValidate onSubmit={(e) => { e.preventDefault(); void enregistrer() }}>
      <p className="text-base text-[#1F2D3D]">{t.intro}</p>
      <div>
        {r.active && r.activeeLe
          ? <Badge ton="vert">{remplir(t.activeeLe, { date: jourLongParisQr(r.activeeLe) })}</Badge>
          : <Badge ton="gris">{t.inactive}</Badge>}
      </div>
      {!r.langueOuverte && <Encadre ton="avertissement">{t.langueNonOuverte}</Encadre>}

      {champ('contact', t.contact, 'email')}
      {champ('politique', t.politique, 'url', t.politiqueAide)}
      <div>
        <label className="flex min-h-[44px] items-start gap-3 text-base text-[#0D1B2E]">
          <input
            type="checkbox" checked={declaree || saisie.declarer} disabled={declaree}
            onChange={(e) => changer('declarer', e.target.checked)} className="mt-1 h-5 w-5 accent-[#C9A84C]"
          />
          <span>{t.declaration}</span>
        </label>
        {declaree && r.politiqueDeclareeLe && <p className="pl-8 text-sm text-[#4A5E78]">{remplir(t.declareeLe, { date: jourLongParisQr(r.politiqueDeclareeLe) })}</p>}
      </div>
      {champ('contratReference', t.contratReference, 'text')}
      {champ('contratDate', t.contratDate, 'date')}
      {champ('telephones', t.telephones, 'text', t.telephonesAide)}

      {erreur && <Encadre ton="erreur">{erreur}</Encadre>}
      {succes && <Encadre ton="succes">{succes}</Encadre>}

      <div className="flex flex-col gap-3 border-t border-[#E4DDD0] pt-4 sm:flex-row sm:flex-wrap">
        <Bouton variante="secondaire" type="submit" disabled={occupe}>{t.enregistrer}</Bouton>
        {r.active ? (
          <Bouton variante="danger" disabled={occupe} onClick={() => { void enregistrer(false) }}>{t.suspendre}</Bouton>
        ) : (
          <Bouton variante="principal" disabled={occupe || !r.langueOuverte} onClick={() => { void enregistrer(true) }}>{t.activer}</Bouton>
        )}
        <Bouton variante="discret" onClick={onFermer} disabled={occupe}>{TD.boutons.fermer}</Bouton>
      </div>
      {r.active && <p className="text-sm text-[#4A5E78]">{t.suspendreAide}</p>}
    </form>
  )
}
