'use client'

// ── « Sa page de suivi » : les copropriétés d'un gestionnaire et leurs signalements ──────────────────────────────────
//
// Demande de Hugo du 10/11/2026 : « chaque gestionnaire doit avoir sa page de suivi des signalements par copropriété ».
// En PR 1, le super admin la voit sur la page profil : ses copropriétés (attributions et « à tous » de son cabinet,
// GET tableau?gestionnaire=<id>) avec leurs compteurs, puis, au clic, leurs signalements (GET
// coproprietes/[id]/signalements, par pages, curseur du serveur passé tel quel) et le changement de statut (statut changé
// entre-temps, 409 conflit_statut : liste rechargée, fiche gardée ouverte). Vue du SUPER ADMIN seulement : le
// gestionnaire connecté suit ses copropriétés dans l'espace de son cabinet (vitfix.io/<identifiant>/suivi/, même
// présentation que l'espace global : TableauSignalementsQr, réponse minimisée). Rien n'est gardé dans le navigateur.
// PR 3, lot 8 (cahier § 7.1, BROUILLON pour Frédéric) : le détail porte aussi « Informer les déclarants de ce
// signalement » et l'opposition à la demande écrite (le super admin a le droit « diffuser » partout).
// Relecture 3 : la fenêtre de diffusion n'est plus rendue ici. Cette page vit dans la page profil, démontée à chaque
// changement de vue de l'espace : elle emportait la fenêtre (saisie perdue sans question, envoi abandonné). « Informer »
// la demande à l'espace (onInformer), qui la porte et la protège au changement de vue (§ 7.1) ; sans onInformer, le
// bouton n'est pas proposé.

import { useCallback, useEffect, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Encadre, EtatVide, Modale } from '@/components/coproprietaire-dashboard/ui'
import DetailSignalementQr from '@/components/aj-signalement/DetailSignalementQr'
import { messageEchecQr } from '@/components/aj-signalement/messageEchecQr'
import type { CoproprieteEcranDiffusionQr } from '@/lib/aj-signalement/affichage-ecran-diffusion'
import { chargerSignalementsCoproprieteQr, chargerTableauQr } from '@/lib/aj-signalement/api'
import {
  LIBELLE_STATUT_QR, TEXTES_TABLEAU_QR as T, TON_STATUT_QR, dateHeureParis, lieuSignalementQr,
} from '@/lib/aj-signalement/affichage'
import { TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import type { CoproprieteQr, SignalementQr, StatutSignalementQr, SuitePageQr } from '@/lib/aj-signalement/types'

type Etat = { statut: 'chargement' } | { statut: 'erreur'; message: string } | { statut: 'pret'; coproprietes: CoproprieteQr[] }

/** « Informer les déclarants de ce signalement » demandé depuis le suivi : la fenêtre est portée par l'espace. */
export interface DemandeDiffusionSuiviQr {
  copropriete: CoproprieteEcranDiffusionQr
  signalementId: string
}

export interface PropsSuiviGestionnaireQr {
  gestionnaireId: string
  /** Ouvre la fenêtre de diffusion (portée « signalement ») au niveau de l'espace ; absent : bouton non proposé. */
  onInformer?: (demande: DemandeDiffusionSuiviQr) => void
}

export default function SuiviGestionnaireQr({ gestionnaireId, onInformer }: Readonly<PropsSuiviGestionnaireQr>) {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' })
  const [essai, setEssai] = useState(0)

  useEffect(() => {
    let actif = true
    void chargerTableauQr(null, fetch, { gestionnaire: gestionnaireId }).then((r) => {
      if (!actif) return
      setEtat(r.ok ? { statut: 'pret', coproprietes: r.tableau.coproprietes } : { statut: 'erreur', message: messageEchecQr(r.code) })
    })
    return () => { actif = false }
  }, [gestionnaireId, essai])

  if (etat.statut === 'chargement') return <p role="status" className="text-base text-[#4A5E78]">{G.chargement}</p>
  if (etat.statut === 'erreur') {
    return (
      <div className="space-y-3">
        <Encadre ton="erreur">{etat.message}</Encadre>
        <Bouton variante="secondaire" petit icone="actualiser" onClick={() => { setEtat({ statut: 'chargement' }); setEssai((n) => n + 1) }}>{G.reessayer}</Bouton>
      </div>
    )
  }
  if (etat.coproprietes.length === 0) return <EtatVide texte={G.suivi.aucune} icone="immeuble" />
  return (
    <ul className="space-y-3">
      {etat.coproprietes.map((c) => <CoproprieteSuivieQr key={c.id} copropriete={c} onInformer={onInformer} />)}
    </ul>
  )
}

type Liste = { statut: 'ferme' } | { statut: 'chargement' } | { statut: 'erreur'; message: string } | { statut: 'pret'; signalements: SignalementQr[]; suite: SuitePageQr }

function CoproprieteSuivieQr({ copropriete: c, onInformer }: Readonly<{ copropriete: CoproprieteQr; onInformer?: PropsSuiviGestionnaireQr['onInformer'] }>) {
  const [liste, setListe] = useState<Liste>({ statut: 'ferme' })
  const [filtre, setFiltre] = useState<'ouverts' | 'tous'>('ouverts')
  const [suiteEnCours, setSuiteEnCours] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)

  const charger = useCallback(async (statut: 'ouverts' | 'tous') => {
    setListe({ statut: 'chargement' })
    const r = await chargerSignalementsCoproprieteQr(c.id, { statut })
    setListe(r.ok ? { statut: 'pret', signalements: r.signalements, suite: r.suite } : { statut: 'erreur', message: messageEchecQr(r.code) })
  }, [c.id])

  /** Après un 409 conflit_statut : la liste du filtre courant relue sans la refermer (la fiche ouverte garde son message). */
  const recharger = async () => {
    const r = await chargerSignalementsCoproprieteQr(c.id, { statut: filtre })
    setListe(r.ok ? { statut: 'pret', signalements: r.signalements, suite: r.suite } : { statut: 'erreur', message: messageEchecQr(r.code) })
  }

  const suivante = async () => {
    if (liste.statut !== 'pret' || !liste.suite || suiteEnCours) return
    setSuiteEnCours(true)
    const r = await chargerSignalementsCoproprieteQr(c.id, { statut: filtre, ...liste.suite })
    setSuiteEnCours(false)
    if (!r.ok) {
      setListe({ statut: 'erreur', message: messageEchecQr(r.code) })
      return
    }
    setListe({ statut: 'pret', signalements: [...liste.signalements, ...r.signalements], suite: r.suite })
  }

  const changerFiltre = (statut: 'ouverts' | 'tous') => {
    setFiltre(statut)
    void charger(statut)
  }

  const surStatut = (id: string, statut: StatutSignalementQr, misAJourLe: string) => {
    setListe((l) => (l.statut === 'pret' ? { ...l, signalements: l.signalements.map((s) => (s.id === id ? { ...s, statut, misAJourLe } : s)) } : l))
  }

  const ouvert = liste.statut !== 'ferme'
  const signalementDetail = liste.statut === 'pret' ? liste.signalements.find((s) => s.id === detail) ?? null : null

  return (
    <li className="rounded-2xl border border-[#E4DDD0] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-[#0D1B2E]">{c.nom}</h3>
            {c.attribueeATous && <Badge ton="or">{G.suivi.aTous}</Badge>}
          </div>
          {(c.codePostal || c.ville) && <p className="text-sm text-[#4A5E78]">{`${c.codePostal} ${c.ville}`.trim()}</p>}
          <p className="text-sm text-[#1F2D3D]">{remplir(G.suivi.compteurs, { ouverts: c.ouverts, urgents: c.urgentsOuverts, attente: c.attente48h })}</p>
          {c.dernier && <p className="text-sm text-[#4A5E78]">{remplir(G.suivi.dernier, { date: dateHeureParis(c.dernier) })}</p>}
        </div>
        <Bouton
          variante="secondaire" petit icone={ouvert ? 'chevron-bas' : 'chevron-droite'} aria-expanded={ouvert}
          onClick={() => (ouvert ? setListe({ statut: 'ferme' }) : void charger(filtre))}
        >
          {ouvert ? G.suivi.masquer : G.suivi.voir}
        </Bouton>
      </div>

      {ouvert && (
        <div className="mt-4 space-y-3 border-t border-[#E4DDD0] pt-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label={G.suivi.filtre}>
            {(['ouverts', 'tous'] as const).map((s) => (
              <Bouton key={s} variante={filtre === s ? 'principal' : 'secondaire'} petit aria-pressed={filtre === s} onClick={() => changerFiltre(s)}>
                {s === 'ouverts' ? G.suivi.ouverts : G.suivi.tous}
              </Bouton>
            ))}
          </div>
          {liste.statut === 'chargement' && <p role="status" className="text-sm text-[#4A5E78]">{G.chargement}</p>}
          {liste.statut === 'erreur' && <Encadre ton="erreur">{liste.message}</Encadre>}
          {liste.statut === 'pret' && (liste.signalements.length === 0 ? <p className="text-sm text-[#4A5E78]">{G.suivi.aucunSignalement}</p> : (
            <ul className="space-y-2">
              {liste.signalements.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F7F4EE] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge ton={TON_STATUT_QR[s.statut]}>{LIBELLE_STATUT_QR[s.statut]}</Badge>
                      {s.priorite === 'urgente' && <Badge ton="rouge">{T.urgent}</Badge>}
                    </div>
                    <p className="mt-1 text-base text-[#0D1B2E]">{s.typeIntervention} — {lieuSignalementQr(s)}</p>
                    <p className="text-sm text-[#4A5E78]">{dateHeureParis(s.creeLe)}</p>
                  </div>
                  <Bouton variante="discret" petit icone="chevron-droite" onClick={() => setDetail(s.id)}>{G.suivi.voirDetail}</Bouton>
                </li>
              ))}
            </ul>
          ))}
          {liste.statut === 'pret' && liste.suite && (
            <Bouton variante="discret" petit icone="plus" disabled={suiteEnCours} onClick={() => { void suivante() }}>{G.suivi.voirPlus}</Bouton>
          )}
        </div>
      )}

      {signalementDetail && (
        <Modale titre={`${signalementDetail.typeIntervention} — ${signalementDetail.coproprieteNom}`} onFermer={() => setDetail(null)} labelFermer={T.fermerFenetre}>
          <DetailSignalementQr
            signalement={signalementDetail} jeton={null} onFermer={() => setDetail(null)} onStatut={surStatut} onConflit={() => { void recharger() }}
            onInformer={onInformer ? () => {
              setDetail(null)
              onInformer({ copropriete: { id: c.id, nom: c.nom, cabinetNom: c.cabinet?.nom ?? null }, signalementId: signalementDetail.id })
            } : undefined}
            oppositionDiffusion
          />
        </Modale>
      )}
    </li>
  )
}
