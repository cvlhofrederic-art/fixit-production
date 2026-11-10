'use client'

// ── Tableau de bord « AJ Signalement » (vue super admin du portail copropriétaire) ───────────────────
//
// Un seul chargement (GET /api/aj-signalement/tableau), puis : indicateurs, copropriétés avec leur QR code
// (affiche PDF, QR PNG, lien, destinataires, modification, nouvelle copropriété, adresse proposée d'après la
// position d'un déclarant quand elle manque), signalements reçus (filtre par copropriété, « même problème que le
// signalement n° X », détail avec coordonnées et changement de statut). Rien n'est écrit dans le
// navigateur : les données servies restent en mémoire. Textes en français (outil de l'administrateur).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { heureCourte, remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Carte, Encadre, EtatVide, Modale, Montant } from '@/components/coproprietaire-dashboard/ui'
import CarteCoproprieteQr from '@/components/aj-signalement/CarteCoproprieteQr'
import ModaleCoproprieteQr from '@/components/aj-signalement/ModaleCoproprieteQr'
import DetailSignalementQr from '@/components/aj-signalement/DetailSignalementQr'
import type { CoproprieteQr, SignalementQr, StatutSignalementQr, TableauQr } from '@/lib/aj-signalement/types'
import { chargerTableauQr, modifierCoproprieteQr, type CodeErreurQr } from '@/lib/aj-signalement/api'
import {
  LIBELLE_STATUT_QR, TEXTES_TABLEAU_QR as T, TON_STATUT_QR, compteursTableauQr, dateHeureParis, filtrerSignalementsQr,
  lieuSignalementQr, messageErreurTableauQr, nomDeclarantQr, situationLotQr, texteSignalementLieQr,
} from '@/lib/aj-signalement/affichage'

export interface PropsTableauSignalementsQr {
  /** Jeton de session du compte (Bearer) ; null : les cookies de session suffisent. */
  jeton: string | null
}

type Etat =
  | { statut: 'chargement' }
  | { statut: 'pret'; tableau: TableauQr; miseAJourLe: Date }
  | { statut: 'erreur'; code: CodeErreurQr }

type Fenetre = { type: 'creation' } | { type: 'modification'; copropriete: CoproprieteQr } | { type: 'detail'; id: string } | null

/** Origine des liens encodés dans les QR codes : le site courant (ce que l'on voit est ce que l'on imprime). */
function origineCourante(): string {
  return typeof window === 'undefined' ? 'https://vitfix.io' : window.location.origin
}

export default function TableauSignalementsQr({ jeton }: Readonly<PropsTableauSignalementsQr>) {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' })
  const [fenetre, setFenetre] = useState<Fenetre>(null)
  const [filtreCopro, setFiltreCopro] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const resultat = await chargerTableauQr(jeton)
    if (!resultat.ok) {
      setEtat({ statut: 'erreur', code: resultat.code })
      return
    }
    setEtat({ statut: 'pret', tableau: resultat.tableau, miseAJourLe: new Date() })
  }, [jeton])

  // Chargement initial depuis le serveur : l'état n'est posé qu'à la réponse (asynchrone), pas dans le corps de l'effet.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger()
  }, [charger])

  const fermer = useCallback(() => setFenetre(null), [])

  const mettreAJourCopro = (copropriete: CoproprieteQr, texte?: string) => {
    setEtat((e) => {
      if (e.statut !== 'pret') return e
      const existante = e.tableau.coproprietes.find((c) => c.id === copropriete.id)
      // Compteurs connus conservés ; la dernière adresse proposée aussi, tant que l'adresse reste vide.
      const coproprietes = existante
        ? e.tableau.coproprietes.map((c) => (c.id === copropriete.id
          ? {
            ...copropriete, nbSignalements: c.nbSignalements, nbEnAttente: c.nbEnAttente,
            derniereAdresseProposee: copropriete.adresse.trim() ? null : c.derniereAdresseProposee,
          }
          : c))
        : [...e.tableau.coproprietes, copropriete]
      const signalements = e.tableau.signalements.map((s) => (s.coproprieteId === copropriete.id ? { ...s, coproprieteNom: copropriete.nom } : s))
      return { ...e, tableau: { coproprietes, signalements } }
    })
    setMessage(texte ?? null)
    setFenetre(null)
  }

  /** « Utiliser cette adresse » : PATCH { adresse } (route existante, super admin) ; false si refusé. */
  const utiliserAdresse = async (copropriete: CoproprieteQr, adresse: string): Promise<boolean> => {
    const resultat = await modifierCoproprieteQr(copropriete.id, { adresse }, jeton)
    if (!resultat.ok) return false
    mettreAJourCopro(resultat.copropriete, T.adresseEnregistree)
    return true
  }

  const changerStatut = (id: string, statut: StatutSignalementQr, misAJourLe: string) => {
    setEtat((e) => {
      if (e.statut !== 'pret') return e
      const signalements = e.tableau.signalements.map((s) => (s.id === id ? { ...s, statut, misAJourLe } : s))
      const coproprietes = e.tableau.coproprietes.map((c) => ({
        ...c,
        nbEnAttente: signalements.filter((s) => s.coproprieteId === c.id && s.statut === 'en_attente').length,
      }))
      return { ...e, tableau: { coproprietes, signalements } }
    })
  }

  const tableau = etat.statut === 'pret' ? etat.tableau : null
  const visibles = useMemo(() => (tableau ? filtrerSignalementsQr(tableau.signalements, filtreCopro) : []), [tableau, filtreCopro])
  const compteurs = useMemo(() => compteursTableauQr(tableau?.signalements ?? []), [tableau])
  const detail = fenetre?.type === 'detail' ? tableau?.signalements.find((s) => s.id === fenetre.id) ?? null : null

  if (etat.statut === 'chargement') {
    return (
      <div className="py-16 text-center" role="status">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#C9A84C] border-t-transparent" />
        <p className="text-base font-medium text-[#4A5E78]">{T.chargement}</p>
      </div>
    )
  }

  if (etat.statut === 'erreur') {
    return (
      <div className="space-y-4">
        <Encadre ton={etat.code === 'base_absente' ? 'avertissement' : 'erreur'}>{messageErreurTableauQr(etat.code)}</Encadre>
        <Bouton variante="principal" icone="actualiser" onClick={() => { setEtat({ statut: 'chargement' }); void charger() }}>{T.reessayer}</Bouton>
      </div>
    )
  }

  const { coproprietes } = etat.tableau
  const origine = origineCourante()

  return (
    <div className="space-y-6">
      <Carte ton="or">
        <p className="text-base text-[#1F2D3D]">{T.intro}</p>
      </Carte>

      <section aria-label={T.indicateurs} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          [T.kpis.recus, compteurs.total],
          [T.kpis.aTraiter, compteurs.aTraiter],
          [T.kpis.enCours, compteurs.enCours],
          [T.kpis.resolus, compteurs.resolus],
        ] as const).map(([libelle, valeur]) => (
          <Carte key={libelle} className="text-center">
            <Montant valeur={String(valeur)} grand />
            <p className="mt-1 text-sm text-[#4A5E78]">{libelle}</p>
          </Carte>
        ))}
      </section>

      {message && <Encadre ton="succes">{message}</Encadre>}

      <section aria-labelledby="qr-coproprietes" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="qr-coproprietes" className="text-lg font-bold text-[#0D1B2E]">{T.coproprietes}</h2>
          <Bouton variante="or" icone="plus" onClick={() => { setMessage(null); setFenetre({ type: 'creation' }) }}>{T.ajouterCopro}</Bouton>
        </div>
        {coproprietes.length === 0 ? (
          <EtatVide texte={T.aucuneCopro} icone="qr" />
        ) : (
          <div className="grid gap-4">
            {coproprietes.map((c) => (
              <CarteCoproprieteQr
                key={c.id}
                copropriete={c}
                origine={origine}
                onModifier={() => { setMessage(null); setFenetre({ type: 'modification', copropriete: c }) }}
                onUtiliserAdresse={(adresse) => { setMessage(null); return utiliserAdresse(c, adresse) }}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="qr-signalements" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="qr-signalements" className="text-lg font-bold text-[#0D1B2E]">{T.signalements}</h2>
          {coproprietes.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-[#4A5E78]">
              <span>{T.filtrerCopro}</span>
              <select value={filtreCopro} onChange={(e) => setFiltreCopro(e.target.value)} className="min-h-[44px] rounded-xl border-2 border-[#E4DDD0] bg-white px-3 text-base text-[#0D1B2E]">
                <option value="">{T.toutesCopros}</option>
                {coproprietes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </label>
          )}
        </div>
        {visibles.length === 0 ? (
          <EtatVide texte={filtreCopro ? T.aucunSignalementFiltre : T.aucunSignalement} icone="demandes" />
        ) : (
          <ul className="space-y-3">
            {visibles.map((s) => <LigneSignalement key={s.id} signalement={s} onOuvrir={() => setFenetre({ type: 'detail', id: s.id })} />)}
          </ul>
        )}
      </section>

      <p className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#4A5E78]">
        <span>{remplir(T.derniereMiseAJour, { heure: heureCourte(etat.miseAJourLe, 'fr') })}</span>
        <Bouton variante="discret" petit icone="actualiser" onClick={() => { void charger() }}>{T.mettreAJour}</Bouton>
      </p>

      {fenetre?.type === 'creation' && (
        <Modale titre={T.formulaire.creer} onFermer={fermer} labelFermer={T.fermerFenetre}>
          <ModaleCoproprieteQr copropriete={null} jeton={jeton} onFermer={fermer} onEnregistre={mettreAJourCopro} />
        </Modale>
      )}
      {fenetre?.type === 'modification' && (
        <Modale titre={T.formulaire.modifier} onFermer={fermer} labelFermer={T.fermerFenetre}>
          <ModaleCoproprieteQr copropriete={fenetre.copropriete} jeton={jeton} onFermer={fermer} onEnregistre={mettreAJourCopro} />
        </Modale>
      )}
      {detail && (
        <Modale titre={`${detail.typeIntervention} — ${detail.coproprieteNom}`} onFermer={fermer} labelFermer={T.fermerFenetre}>
          <DetailSignalementQr signalement={detail} jeton={jeton} onFermer={fermer} onStatut={changerStatut} />
        </Modale>
      )}
    </div>
  )
}

function LigneSignalement({ signalement: s, onOuvrir }: Readonly<{ signalement: SignalementQr; onOuvrir: () => void }>) {
  return (
    <li className="rounded-2xl border border-[#E4DDD0] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge ton={TON_STATUT_QR[s.statut]}>{LIBELLE_STATUT_QR[s.statut]}</Badge>
            {s.priorite === 'urgente' && <Badge ton="rouge">{T.urgent}</Badge>}
            <span className="text-base font-bold text-[#0D1B2E]">{s.typeIntervention}</span>
          </div>
          <p className="text-base text-[#1F2D3D]">{lieuSignalementQr(s)}</p>
          {s.signalementLieId && <p className="text-sm font-semibold text-[#0D1B2E]">{texteSignalementLieQr(s.signalementLieId)}</p>}
          <p className="text-sm text-[#4A5E78]">
            {nomDeclarantQr(s)} · {situationLotQr(s)} · {s.telephone}
          </p>
          <p className="text-sm text-[#4A5E78]">{s.coproprieteNom} · {dateHeureParis(s.creeLe)}</p>
        </div>
        <Bouton variante="secondaire" petit icone="chevron-droite" onClick={onOuvrir}>{T.voirDetail}</Bouton>
      </div>
    </li>
  )
}
