'use client'

// ── AJ Signalement — historique des messages diffusés sur une copropriété (PR 3, lot 8, BROUILLON) ───────────────────
//
// Cahier PR 3 § 7.3 et § 5.5 : liste paginée (20, curseur du serveur passé tel quel, D-R5) — date et heure de Paris,
// objet, périmètre, auteur (« Administrateur », « Un gestionnaire » ; vue d'un gestionnaire : « Vous », « Un
// collègue », « Le cabinet », jamais un nom), état (« Envoyé à 23 », « 21 envoyés, 2 refusés », « Envoi interrompu :
// 300 en attente » et « Reprendre l'envoi »). Ouvrir une ligne : texte complet et nombres par état (D-R6). Aucune
// adresse. Reprise (D-R4) : plus d'une heure après l'écriture, l'heure est montrée et l'auteur confirme que le contenu
// est toujours exact ; la reprise s'enchaîne ensuite tant que des messages attendent ; la liste est relue à la fin.
// Écran en BROUILLON, soumis à Frédéric (F1).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Bouton, Encadre, Ligne } from '@/components/coproprietaire-dashboard/ui'
import {
  chargerDiffusionQr, chargerDiffusionsQr, reprendreDiffusionQr, type EtatEnvoiDiffusionQr, type MoisDiffusionQr,
} from '@/lib/aj-signalement/api'
import type { DetailDiffusionQr, ResumeDiffusionQr } from '@/lib/aj-signalement/diffusion-formes'
import { dateHeureParis } from '@/lib/aj-signalement/affichage'
import {
  TEXTES_ECRAN_DIFFUSION_QR as TD, auteurDiffusionTexteQr, etatDiffusionHistoriqueQr, jourLongParisQr, nomModeleDiffusionQr,
  rappelMoisDiffusionQr, type CoproprieteEcranDiffusionQr, type GardeDiffusionQr, type ProfilDiffusionQr,
} from '@/lib/aj-signalement/affichage-ecran-diffusion'
import { lignesIssueEnvoiDiffusionQr, messageEchecDiffusionQr, poursuivreEnvoiDiffusionQr } from '@/components/aj-signalement/envoiDiffusionQr'

type Liste =
  | { etat: 'chargement' }
  | { etat: 'erreur'; message: string }
  | { etat: 'pret'; diffusions: ResumeDiffusionQr[]; ceMois: MoisDiffusionQr; suivant: string | null }

type Detail = { etat: 'chargement' } | { etat: 'erreur'; message: string } | { etat: 'pret'; diffusion: DetailDiffusionQr }

type Reprise =
  | { id: string; etape: 'appel' }
  | { id: string; etape: 'confirmer'; creeLe: string }
  | { id: string; etape: 'envoi'; envoyes: number; total: number }
  | { id: string; etape: 'fin'; lignes: string[]; termine: boolean }

export interface PropsHistoriqueDiffusionsQr {
  copropriete: CoproprieteEcranDiffusionQr
  profil: ProfilDiffusionQr
  delaiRepriseMs: number
  onGarde: (garde: GardeDiffusionQr) => void
}

export default function HistoriqueDiffusionsQr({ copropriete, profil, delaiRepriseMs, onGarde }: Readonly<PropsHistoriqueDiffusionsQr>) {
  const [liste, setListe] = useState<Liste>({ etat: 'chargement' })
  const [suiteEnCours, setSuiteEnCours] = useState(false)
  const [details, setDetails] = useState<Record<string, Detail>>({})
  const [reprise, setReprise] = useState<Reprise | null>(null)
  const monte = useRef(true)

  useEffect(() => {
    monte.current = true
    return () => { monte.current = false }
  }, [])

  const charger = useCallback(async () => {
    const r = await chargerDiffusionsQr(copropriete.id)
    if (!monte.current) return
    setListe(r.ok ? { etat: 'pret', diffusions: r.diffusions, ceMois: r.ceMois, suivant: r.suivant } : { etat: 'erreur', message: messageEchecDiffusionQr(r.code, profil) })
  }, [copropriete.id, profil])

  // L'état n'est posé qu'à la réponse (asynchrone).
  useEffect(() => {
    void charger()
  }, [charger])

  const garde: GardeDiffusionQr = reprise && (reprise.etape === 'appel' || reprise.etape === 'envoi') ? 'envoi' : 'libre'
  // Avant l'affichage, comme dans FormulaireDiffusionQr : un clic qui suit l'état affiché n'est jamais perdu.
  useLayoutEffect(() => { onGarde(garde) }, [garde, onGarde])

  const voirPlus = async () => {
    if (liste.etat !== 'pret' || !liste.suivant || suiteEnCours) return
    setSuiteEnCours(true)
    const r = await chargerDiffusionsQr(copropriete.id, { avant: liste.suivant })
    if (!monte.current) return
    setSuiteEnCours(false)
    if (!r.ok) return setListe({ etat: 'erreur', message: messageEchecDiffusionQr(r.code, profil) })
    setListe({ etat: 'pret', diffusions: [...liste.diffusions, ...r.diffusions], ceMois: liste.ceMois, suivant: r.suivant })
  }

  const basculerDetail = async (id: string) => {
    if (details[id]) {
      setDetails(({ [id]: _ferme, ...reste }) => reste)
      return
    }
    setDetails((d) => ({ ...d, [id]: { etat: 'chargement' } }))
    const r = await chargerDiffusionQr(id)
    if (!monte.current) return
    setDetails((d) => (d[id] ? { ...d, [id]: r.ok ? { etat: 'pret', diffusion: r.diffusion } : { etat: 'erreur', message: messageEchecDiffusionQr(r.code, profil) } } : d))
  }

  /** Suite d'une reprise acceptée : enchaînement, bilan, liste relue. */
  const poursuivre = async (id: string, depart: EtatEnvoiDiffusionQr, total: number, confirmeContenuAJour: boolean) => {
    setReprise({ id, etape: 'envoi', envoyes: depart.envoyes, total })
    const issue = await poursuivreEnvoiDiffusionQr({
      diffusionId: id, depart, confirmeContenuAJour, delaiMs: delaiRepriseMs, actif: () => monte.current,
      onProgres: (etat) => setReprise((r) => (r && r.id === id && r.etape === 'envoi' ? { ...r, envoyes: etat.envoyes } : r)),
    })
    if (!monte.current) return
    setReprise({ id, etape: 'fin', lignes: lignesIssueEnvoiDiffusionQr(issue, profil), termine: issue.type === 'termine' })
    void charger()
  }

  /** Premier appel de la reprise ; plus d'une heure après l'écriture : l'auteur confirme le contenu. */
  const reprendre = async (d: ResumeDiffusionQr, confirme = false) => {
    if (reprise && (reprise.etape === 'appel' || reprise.etape === 'envoi')) return
    setReprise({ id: d.id, etape: 'appel' })
    const r = await reprendreDiffusionQr(d.id, confirme ? { confirmeContenuAJour: true } : {})
    if (!monte.current) return
    if (!r.ok) {
      if (r.code === 'a_confirmer' && !confirme) return setReprise({ id: d.id, etape: 'confirmer', creeLe: r.creeLe ?? d.creeLe })
      setReprise({ id: d.id, etape: 'fin', lignes: [messageEchecDiffusionQr(r.code, profil)], termine: false })
      void charger()
      return
    }
    await poursuivre(d.id, r, d.nombres.destinataires, confirme)
  }

  if (liste.etat === 'chargement') return <p role="status" className="text-base text-[#4A5E78]">{TD.chargement}</p>
  if (liste.etat === 'erreur') return <Encadre ton="erreur">{liste.message}</Encadre>

  return (
    <div className="space-y-4">
      <p className="text-base text-[#1F2D3D]">{rappelMoisDiffusionQr(liste.ceMois)}</p>
      {liste.diffusions.length === 0 ? <p className="text-base text-[#4A5E78]">{TD.historique.aucun}</p> : (
        <ul className="space-y-3">
          {liste.diffusions.map((d) => (
            <LigneHistoriqueQr
              key={d.id} diffusion={d} profil={profil} detail={details[d.id]} reprise={reprise?.id === d.id ? reprise : null}
              repriseOccupee={reprise !== null && (reprise.etape === 'appel' || reprise.etape === 'envoi')}
              onDetail={() => { void basculerDetail(d.id) }} onReprendre={() => { void reprendre(d) }}
              onConfirmer={() => { void reprendre(d, true) }} onAnnulerReprise={() => setReprise(null)}
            />
          ))}
        </ul>
      )}
      {liste.suivant && (
        <Bouton variante="discret" petit icone="plus" disabled={suiteEnCours} onClick={() => { void voirPlus() }}>{TD.historique.voirPlus}</Bouton>
      )}
    </div>
  )
}

interface PropsLigneHistoriqueQr {
  diffusion: ResumeDiffusionQr
  profil: ProfilDiffusionQr
  detail: Detail | undefined
  reprise: Reprise | null
  repriseOccupee: boolean
  onDetail: () => void
  onReprendre: () => void
  onConfirmer: () => void
  onAnnulerReprise: () => void
}

function LigneHistoriqueQr({
  diffusion: d, profil, detail, reprise, repriseOccupee, onDetail, onReprendre, onConfirmer, onAnnulerReprise,
}: Readonly<PropsLigneHistoriqueQr>) {
  const h = TD.historique
  const ouvert = detail !== undefined
  // Reprise : « Reprendre l'envoi » se désactive puis peut disparaître ; le focus va à la question, à la zone d'état puis
  // au bilan, toujours dans la fenêtre (relecture 3, cahier § 7.6 « Tab piégé »).
  const zoneReprise = useRef<HTMLElement | null>(null)
  const etapeReprise = reprise?.etape ?? null
  useEffect(() => {
    if (etapeReprise !== null) zoneReprise.current?.focus()
  }, [etapeReprise])
  const poserZone = (el: HTMLElement | null) => { zoneReprise.current = el }
  return (
    <li className="rounded-2xl border border-[#E4DDD0] bg-white px-5 py-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-base font-bold text-[#0D1B2E]">{d.objet}</p>
        <p className="text-sm text-[#4A5E78]">
          {remplir(h.ligne, { date: dateHeureParis(d.creeLe), auteur: auteurDiffusionTexteQr(d.auteur), perimetre: d.libellePerimetre })}
        </p>
        <p className="text-sm font-semibold text-[#1F2D3D]">{etatDiffusionHistoriqueQr(d.nombres)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Bouton variante="secondaire" petit icone={ouvert ? 'chevron-bas' : 'chevron-droite'} aria-expanded={ouvert} onClick={onDetail}>
          {ouvert ? h.masquerDetail : h.voirDetail}
        </Bouton>
        {d.nombres.attente > 0 && (
          <Bouton variante="or" petit icone="envoyer" disabled={repriseOccupee} onClick={onReprendre}>{h.reprendre}</Bouton>
        )}
      </div>

      {reprise?.etape === 'confirmer' && (
        <div ref={poserZone} tabIndex={-1} className="mt-3 outline-none">
          <Encadre ton="avertissement">
            <p>{remplir(h.aConfirmer, { date: dateHeureParis(reprise.creeLe) })}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Bouton variante="principal" petit onClick={onConfirmer}>{h.confirmerReprise}</Bouton>
              <Bouton variante="secondaire" petit onClick={onAnnulerReprise}>{TD.boutons.annuler}</Bouton>
            </div>
          </Encadre>
        </div>
      )}
      {(reprise?.etape === 'appel' || reprise?.etape === 'envoi') && (
        <p ref={poserZone} tabIndex={-1} role="status" aria-live="polite" aria-busy="true" className="mt-3 rounded-xl bg-[#F7F4EE] px-4 py-3 text-base font-semibold text-[#0D1B2E] outline-none">
          {reprise.etape === 'envoi' ? remplir(TD.envoi.progression, { envoyes: reprise.envoyes, total: reprise.total }) : TD.envoi.enCours}
        </p>
      )}
      {reprise?.etape === 'fin' && (
        <div ref={poserZone} tabIndex={-1} className="mt-3 outline-none">
          <Encadre ton={reprise.termine ? 'succes' : 'avertissement'} role="status">
            {reprise.lignes.map((l) => <p key={l}>{l}</p>)}
          </Encadre>
        </div>
      )}

      {detail?.etat === 'chargement' && <p role="status" className="mt-3 text-sm text-[#4A5E78]">{TD.chargement}</p>}
      {detail?.etat === 'erreur' && <Encadre ton="erreur" className="mt-3">{detail.message}</Encadre>}
      {detail?.etat === 'pret' && <DetailDiffusionEcranQr diffusion={detail.diffusion} profil={profil} />}
    </li>
  )
}

function DetailDiffusionEcranQr({ diffusion: x, profil }: Readonly<{ diffusion: DetailDiffusionQr; profil: ProfilDiffusionQr }>) {
  const dd = TD.historique.detail
  const n = x.nombres
  return (
    <section aria-label={TD.historique.detailTitre} className="mt-3 space-y-3 border-t border-[#E4DDD0] pt-3">
      <div>
        <p className="mb-1 text-sm font-semibold text-[#4A5E78]">{dd.texte}</p>
        <p className="whitespace-pre-wrap rounded-xl bg-[#F7F4EE] px-4 py-3 text-base text-[#0D1B2E]">{x.texte}</p>
      </div>
      <dl>
        <Ligne etiquette={dd.modele}>{nomModeleDiffusionQr(x.modele)}</Ligne>
        <Ligne etiquette={dd.prevus}>{x.nbDestinataires}</Ligne>
        <Ligne etiquette={dd.exclus}>{x.nbExclusOpposition}</Ligne>
        <Ligne etiquette={dd.envoyes}>{n.envoyes}</Ligne>
        <Ligne etiquette={dd.refuses}>{n.refuses}</Ligne>
        <Ligne etiquette={dd.attente}>{n.attente}</Ligne>
        <Ligne etiquette={dd.annules}>{remplir(dd.annulesDetail, { n: n.annules, opposes: n.opposes, perimes: n.perimes })}</Ligne>
        <Ligne etiquette={dd.incertains}>{n.incertains}</Ligne>
        <Ligne etiquette={dd.copie}>{x.copieCabinetLe ? dateHeureParis(x.copieCabinetLe) : dd.copieNon}</Ligne>
        {profil === 'super_admin' && x.instruction && (
          <Ligne etiquette={dd.instruction}>{remplir(dd.instructionValeur, { reference: x.instruction.reference, date: jourLongParisQr(x.instruction.recueLe) })}</Ligne>
        )}
      </dl>
    </section>
  )
}
