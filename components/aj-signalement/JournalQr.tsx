'use client'

// ── Vue « Journal » de l'espace AJ Signalement (super admin, SPEC § 1.8) ─────────────────────────────────────────────
//
// Date · auteur (« Administrateur » ou le nom du gestionnaire) · action en clair · copropriété · gestionnaire · NOMS des
// champs modifiés (jamais leurs valeurs : le serveur ne les garde pas). Filtres action, copropriété, gestionnaire ;
// 100 lignes par page, « Voir plus » par le curseur du serveur (passé tel quel). Conservation : 12 mois (purge côté
// serveur). La période n'est pas filtrable : la route n'a que le curseur.

import { useEffect, useId, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Bouton, Encadre, EtatVide } from '@/components/coproprietaire-dashboard/ui'
import { messageEchecQr } from '@/components/aj-signalement/messageEchecQr'
import { chargerJournalQr } from '@/lib/aj-signalement/api'
import { dateHeureParis } from '@/lib/aj-signalement/affichage'
import { LIBELLE_ACTION_JOURNAL_QR, TEXTES_GESTION_QR as G, auteurJournalQr } from '@/lib/aj-signalement/affichage-gestion'
import {
  ACTIONS_JOURNAL_QR, type ActionJournalQr, type CoproprieteQr, type EvenementJournalQr, type GestionnaireResumeQr, type SuitePageQr,
} from '@/lib/aj-signalement/types'

export interface PropsJournalQr {
  coproprietes: readonly CoproprieteQr[]
  gestionnaires: readonly GestionnaireResumeQr[] | null
}

interface Filtre {
  action: ActionJournalQr | ''
  copropriete: string
  gestionnaire: string
}

type Etat = { statut: 'chargement' } | { statut: 'erreur'; message: string } | { statut: 'pret'; evenements: EvenementJournalQr[]; suite: SuitePageQr }

const CLASSES_FILTRE = 'min-h-[44px] rounded-xl border-2 border-[#E4DDD0] bg-white px-3 text-base text-[#0D1B2E]'

const estAction = (v: string): v is ActionJournalQr => (ACTIONS_JOURNAL_QR as readonly string[]).includes(v)

export default function JournalQr({ coproprietes, gestionnaires }: Readonly<PropsJournalQr>) {
  const idBase = useId()
  const [filtre, setFiltre] = useState<Filtre>({ action: '', copropriete: '', gestionnaire: '' })
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' })
  const [essai, setEssai] = useState(0)
  const [suiteEnCours, setSuiteEnCours] = useState(false)

  useEffect(() => {
    let actif = true
    void chargerJournalQr(filtre).then((r) => {
      if (!actif) return
      setEtat(r.ok ? { statut: 'pret', evenements: r.evenements, suite: r.suite } : { statut: 'erreur', message: messageEchecQr(r.code) })
    })
    return () => { actif = false }
  }, [filtre, essai])

  const changer = (cle: keyof Filtre, valeur: string) => {
    setEtat({ statut: 'chargement' })
    setFiltre((f) => ({ ...f, [cle]: cle === 'action' ? (estAction(valeur) ? valeur : '') : valeur }))
  }

  const suivante = async () => {
    if (etat.statut !== 'pret' || !etat.suite || suiteEnCours) return
    setSuiteEnCours(true)
    const r = await chargerJournalQr({ ...filtre, ...etat.suite })
    setSuiteEnCours(false)
    if (!r.ok) {
      setEtat({ statut: 'erreur', message: messageEchecQr(r.code) })
      return
    }
    setEtat({ statut: 'pret', evenements: [...etat.evenements, ...r.evenements], suite: r.suite })
  }

  const selecteur = (cle: keyof Filtre, etiquette: string, tous: string, options: ReadonlyArray<{ valeur: string; libelle: string }>) => (
    <label className="flex flex-col gap-1 text-sm text-[#4A5E78]" htmlFor={`${idBase}-${cle}`}>
      <span>{etiquette}</span>
      <select id={`${idBase}-${cle}`} value={filtre[cle]} onChange={(e) => changer(cle, e.target.value)} className={CLASSES_FILTRE}>
        <option value="">{tous}</option>
        {options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
      </select>
    </label>
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {selecteur('action', G.journal.filtreAction, G.journal.toutesActions, ACTIONS_JOURNAL_QR.map((a) => ({ valeur: a, libelle: LIBELLE_ACTION_JOURNAL_QR[a] })))}
        {selecteur('copropriete', G.journal.filtreCopro, G.journal.toutesCopros, coproprietes.map((c) => ({ valeur: c.id, libelle: c.nom })))}
        {selecteur('gestionnaire', G.journal.filtreGestionnaire, G.journal.tousGestionnaires, (gestionnaires ?? []).map((g) => ({ valeur: g.id, libelle: g.nom ?? G.fiche.ancien })))}
      </div>

      {etat.statut === 'chargement' && <p role="status" className="py-6 text-center text-base text-[#4A5E78]">{G.chargement}</p>}
      {etat.statut === 'erreur' && (
        <div className="space-y-3">
          <Encadre ton="erreur">{etat.message}</Encadre>
          <Bouton variante="principal" icone="actualiser" onClick={() => { setEtat({ statut: 'chargement' }); setEssai((n) => n + 1) }}>{G.reessayer}</Bouton>
        </div>
      )}
      {etat.statut === 'pret' && (etat.evenements.length === 0 ? <EtatVide texte={G.journal.aucun} icone="horloge" /> : (
        <ul className="space-y-2" aria-label={G.journal.liste}>
          {etat.evenements.map((e) => (
            <li key={e.id} className="rounded-xl border border-[#E4DDD0] bg-white px-4 py-3">
              <p className="text-base font-semibold text-[#0D1B2E]">{LIBELLE_ACTION_JOURNAL_QR[e.action] ?? e.action}</p>
              <p className="text-sm text-[#4A5E78]">
                {dateHeureParis(e.creeLe)} · {auteurJournalQr(e)}{e.coproprieteNom ? ` · ${e.coproprieteNom}` : ''}{e.gestionnaireNom ? ` · ${e.gestionnaireNom}` : ''}
              </p>
              {e.champs.length > 0 && <p className="text-sm text-[#4A5E78]">{remplir(G.journal.champs, { champs: e.champs.join(', ') })}</p>}
            </li>
          ))}
        </ul>
      ))}
      {etat.statut === 'pret' && etat.suite && (
        <Bouton variante="secondaire" icone="plus" disabled={suiteEnCours} onClick={() => { void suivante() }}>{G.journal.voirPlus}</Bouton>
      )}

      <p className="text-sm text-[#4A5E78]">{G.journal.conservation}</p>
    </div>
  )
}
