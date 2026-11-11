'use client'

// ── Page profil d'un gestionnaire (espace AJ Signalement, #gestionnaire/<uuid>) ──────────────────────────────────────
//
// Demandes de Hugo du 10/11/2026 : une page profil par gestionnaire, avec ses copropriétés en tableau de bord et sa
// page de suivi des signalements par copropriété (SPEC § 1.8). En-tête (nom modifiable, adresse, état, envois), « Sa
// page de suivi » (SuiviGestionnaireQr, ce qu'il verra en PR 2), copropriétés attribuées (origine, retrait, ajout),
// communes à tous (lecture), créations (PR 2), activité (journal de la fiche), export RGPD, départ (successions),
// réactivation et effacement (fiche désactivée seulement). Jamais de jeton d'envoi : le serveur ne les rend pas.

import { useCallback, useEffect, useId, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Carte, Champ, CLASSES_SAISIE, Encadre, Modale } from '@/components/coproprietaire-dashboard/ui'
import SuiviGestionnaireQr from '@/components/aj-signalement/SuiviGestionnaireQr'
import FenetreDepartGestionnaireQr from '@/components/aj-signalement/FenetreDepartGestionnaireQr'
import { ChoixCoproprietesQr } from '@/components/aj-signalement/ChoixMultipleQr'
import { messageEchecQr } from '@/components/aj-signalement/messageEchecQr'
import {
  attribuerCoproprietesGestionnaireQr, chargerFicheGestionnaireQr, exporterGestionnaireQr, modifierGestionnaireQr, renvoyerConfirmationQr,
} from '@/lib/aj-signalement/api'
import { dateHeureParis } from '@/lib/aj-signalement/affichage'
import {
  LIBELLE_ACTION_JOURNAL_QR, LIBELLE_ETAT_GESTIONNAIRE_QR as ETAT, LIBELLE_ORIGINE_ATTRIBUTION_QR, TEXTES_GESTION_QR as G,
  TON_ETAT_GESTIONNAIRE_QR as TON, auteurJournalQr, dateParisQr,
} from '@/lib/aj-signalement/affichage-gestion'
import { telechargerFichier } from '@/lib/aj-signalement/qr'
import type { CoproprieteQr, EnvoiGestionnaireQr, FicheGestionnaireDetailQr, GestionnaireQr } from '@/lib/aj-signalement/types'

export interface PropsFicheGestionnaireQr {
  id: string
  /** Copropriétés du tableau de l'espace (attributions à ajouter, « communes à tous », groupes du départ). */
  coproprietes: readonly CoproprieteQr[]
  /** Fiches de l'espace (successeurs au départ) ; null tant qu'elles ne sont pas chargées. */
  gestionnaires: readonly GestionnaireQr[] | null
  onRetour: () => void
  /** La fiche ou ses attributions ont changé : l'espace recharge les fiches et le tableau. */
  onModifie: () => void
}

type Etat = { statut: 'chargement' } | { statut: 'erreur'; message: string } | { statut: 'pret'; fiche: FicheGestionnaireDetailQr }
type Panneau = 'nom' | 'ajout' | 'effacer' | 'depart' | null

function texteEnvoi(e: EnvoiGestionnaireQr): string {
  const parties = [remplir(G.fiche.envoiDemande, { date: dateParisQr(e.creeLe) })]
  parties.push(e.envoyeLe ? remplir(G.fiche.envoiParti, { date: dateHeureParis(e.envoyeLe) }) : G.fiche.envoiNonParti)
  if (e.accepteLe) parties.push(remplir(G.fiche.envoiConfirme, { date: dateHeureParis(e.accepteLe) }))
  if (e.refus === 'pas_moi') parties.push(G.fiche.envoiRefuse)
  return parties.join(' · ')
}

export default function FicheGestionnaireQr({ id, coproprietes, gestionnaires, onRetour, onModifie }: Readonly<PropsFicheGestionnaireQr>) {
  const idBase = useId()
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' })
  const [essai, setEssai] = useState(0)
  const [panneau, setPanneau] = useState<Panneau>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [nouveauNom, setNouveauNom] = useState('')
  const [ajout, setAjout] = useState<string[]>([])

  const recharger = useCallback(() => setEssai((n) => n + 1), [])

  useEffect(() => {
    let actif = true
    void chargerFicheGestionnaireQr(id).then((r) => {
      if (!actif) return
      setEtat(r.ok ? { statut: 'pret', fiche: r.fiche } : { statut: 'erreur', message: messageEchecQr(r.code) })
    })
    return () => { actif = false }
  }, [id, essai])

  if (etat.statut === 'chargement') return <p role="status" className="py-10 text-center text-base text-[#4A5E78]">{G.chargement}</p>
  if (etat.statut === 'erreur') {
    return (
      <div className="space-y-4">
        <Bouton variante="discret" icone="retour" onClick={onRetour}>{G.fiche.retour}</Bouton>
        <Encadre ton="erreur">{etat.message}</Encadre>
        <Bouton variante="principal" icone="actualiser" onClick={() => { setEtat({ statut: 'chargement' }); recharger() }}>{G.reessayer}</Bouton>
      </div>
    )
  }

  const { gestionnaire: g, envois, attributions, creations, journal } = etat.fiche
  const desactive = g.etat === 'desactive'
  const efface = g.nom === null
  const attribuees = new Set(attributions.map((a) => a.coproprieteId))
  const coprosCabinet = coproprietes.filter((c) => c.cabinet?.id === g.cabinet.id)
  const communes = coprosCabinet.filter((c) => c.attribueeATous && !attribuees.has(c.id))
  const ajoutables = coprosCabinet.filter((c) => !attribuees.has(c.id))

  /** Action qui modifie la fiche : messages en cas de succès, fiche rechargée, espace prévenu. */
  const executer = async (action: () => Promise<{ ok: true; textes: string[] } | { ok: false; message: string }>) => {
    if (occupe) return
    setOccupe(true)
    setMessages([])
    setErreur(null)
    const r = await action()
    setOccupe(false)
    if (!r.ok) return setErreur(r.message)
    setPanneau(null)
    setMessages(r.textes)
    recharger()
    onModifie()
  }

  const attribuer = (ids: string[]) => executer(async () => {
    const r = await attribuerCoproprietesGestionnaireQr(g.id, ids)
    if (!r.ok) return { ok: false, message: messageEchecQr(r.code) }
    setAjout([])
    return { ok: true, textes: [G.fiche.attributionsEnregistrees, ...(r.adressesRetirees > 0 ? [remplir(G.fiche.adressesRetirees, { n: r.adressesRetirees })] : [])] }
  })

  const renommer = () => executer(async () => {
    const nom = nouveauNom.trim()
    if (!nom) return { ok: false, message: G.gestionnaires.nomRequis }
    const r = await modifierGestionnaireQr(g.id, { nom })
    return r.ok ? { ok: true, textes: [G.fiche.nomEnregistre] } : { ok: false, message: messageEchecQr(r.code) }
  })

  const reactiver = () => executer(async () => {
    const r = await modifierGestionnaireQr(g.id, { actif: true })
    return r.ok ? { ok: true, textes: [G.gestionnaires.reactive] } : { ok: false, message: messageEchecQr(r.code) }
  })

  const effacer = () => executer(async () => {
    const r = await modifierGestionnaireQr(g.id, { pseudonymiser: true })
    return r.ok ? { ok: true, textes: [G.fiche.efface] } : { ok: false, message: messageEchecQr(r.code) }
  })

  const renvoyer = () => executer(async () => {
    const r = await renvoyerConfirmationQr(g.id)
    if (!r.ok) return { ok: false, message: messageEchecQr(r.code) }
    return { ok: true, textes: [r.emailEnvoye ? remplir(G.gestionnaires.renvoye, { email: g.email ?? '' }) : G.gestionnaires.renvoiSansEmail] }
  })

  // L'export ne modifie rien : pas de rechargement.
  const exporter = async () => {
    if (occupe) return
    setOccupe(true)
    setErreur(null)
    const r = await exporterGestionnaireQr(g.id)
    setOccupe(false)
    if (!r.ok) return setErreur(messageEchecQr(r.code))
    telechargerFichier(r.nomFichier, r.fichier)
    setMessages([G.fiche.exportPret])
  }

  return (
    <div className="space-y-6">
      <Bouton variante="discret" icone="retour" onClick={onRetour}>{G.fiche.retour}</Bouton>
      {messages.length > 0 && <Encadre ton="succes">{messages.map((m) => <p key={m}>{m}</p>)}</Encadre>}
      {erreur && <Encadre ton="erreur">{erreur}</Encadre>}

      <Carte
        titre={g.nom ?? G.fiche.ancien}
        sousTitre={remplir(G.fiche.cabinet, { nom: g.cabinet.nom })}
        actions={<Badge ton={TON[g.etat]}>{ETAT[g.etat]}</Badge>}
      >
        <div className="space-y-3">
          {g.email && <p className="break-all text-base text-[#1F2D3D]">{g.email}</p>}
          <div className="flex flex-wrap gap-2">
            {g.domaineForce && <Badge ton="ambre">{G.gestionnaires.domaineForce}</Badge>}
            {g.confirmeeLe && <span className="text-sm text-[#4A5E78]">{remplir(G.gestionnaires.confirmeeLe, { date: dateParisQr(g.confirmeeLe) })}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {!efface && <Bouton variante="secondaire" petit icone="outil" disabled={occupe} onClick={() => { setNouveauNom(g.nom ?? ''); setPanneau('nom') }}>{G.fiche.modifierNom}</Bouton>}
            {(g.etat === 'confirmation_envoyee' || g.etat === 'confirmation_expiree') && (
              <Bouton variante="secondaire" petit icone="envoyer" disabled={occupe} onClick={() => { void renvoyer() }}>{G.gestionnaires.renvoyer}</Bouton>
            )}
            <Bouton variante="secondaire" petit icone="documents" disabled={occupe} onClick={() => { void exporter() }}>{G.fiche.exporter}</Bouton>
            {!desactive && <Bouton variante="danger" petit icone="deconnexion" disabled={occupe} onClick={() => setPanneau('depart')}>{G.fiche.depart}</Bouton>}
            {desactive && !efface && <Bouton variante="secondaire" petit icone="actualiser" disabled={occupe} onClick={() => { void reactiver() }}>{G.gestionnaires.reactiver}</Bouton>}
            {desactive && !efface && <Bouton variante="danger" petit disabled={occupe} onClick={() => setPanneau('effacer')}>{G.fiche.effacer}</Bouton>}
          </div>

          {panneau === 'nom' && (
            <form className="space-y-3 border-t border-[#E4DDD0] pt-3" onSubmit={(e) => { e.preventDefault(); void renommer() }}>
              <Champ id={`${idBase}-nom`} etiquette={G.fiche.nouveauNom}>
                <input id={`${idBase}-nom`} value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} maxLength={120} className={CLASSES_SAISIE} />
              </Champ>
              <div className="flex flex-wrap gap-2">
                <Bouton variante="principal" type="submit" petit disabled={occupe}>{G.enregistrer}</Bouton>
                <Bouton variante="secondaire" petit disabled={occupe} onClick={() => setPanneau(null)}>{G.annuler}</Bouton>
              </div>
            </form>
          )}
          {panneau === 'effacer' && (
            <div className="space-y-3 border-t border-[#E4DDD0] pt-3">
              <Encadre ton="avertissement">{G.fiche.effacerAvertissement}</Encadre>
              <div className="flex flex-wrap gap-2">
                <Bouton variante="danger" petit disabled={occupe} onClick={() => { void effacer() }}>{G.fiche.confirmerEffacer}</Bouton>
                <Bouton variante="secondaire" petit disabled={occupe} onClick={() => setPanneau(null)}>{G.annuler}</Bouton>
              </div>
            </div>
          )}
        </div>
      </Carte>

      <Carte titre={G.fiche.envois}>
        {envois.length === 0 ? <p className="text-sm text-[#4A5E78]">{G.fiche.aucunEnvoi}</p> : (
          <ul className="space-y-2">
            {envois.map((e) => (
              <li key={`${e.objet}-${e.creeLe}`} className="text-sm text-[#1F2D3D]">
                <span className="font-semibold">{G.fiche.objets[e.objet]}</span> — {texteEnvoi(e)}
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte titre={G.fiche.suivi} sousTitre={G.fiche.suiviAide}>
        <SuiviGestionnaireQr gestionnaireId={g.id} />
      </Carte>

      <Carte titre={remplir(G.fiche.attribuees, { n: attributions.length })}>
        <div className="space-y-4">
          {attributions.length === 0 ? <p className="text-sm text-[#4A5E78]">{G.fiche.aucuneAttribuee}</p> : (
            <ul className="space-y-2">
              {attributions.map((a) => (
                <li key={a.coproprieteId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F7F4EE] px-4 py-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-[#0D1B2E]">{a.nom}</span>
                    <p className="text-sm text-[#4A5E78]">{remplir(G.fiche.attribueeLe, { origine: LIBELLE_ORIGINE_ATTRIBUTION_QR[a.origine], date: dateParisQr(a.creeLe) })}</p>
                  </div>
                  {!desactive && (
                    <Bouton variante="discret" petit disabled={occupe} onClick={() => { void attribuer(attributions.filter((x) => x.coproprieteId !== a.coproprieteId).map((x) => x.coproprieteId)) }}>
                      {G.fiche.retirer}
                    </Bouton>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!desactive && (panneau === 'ajout' ? (
            <div className="space-y-3">
              <ChoixCoproprietesQr legende={G.fiche.choisirCopros} coproprietes={ajoutables} selection={ajout} onChange={setAjout} />
              <div className="flex flex-wrap gap-2">
                <Bouton variante="principal" petit disabled={occupe || ajout.length === 0} onClick={() => { void attribuer([...attribuees, ...ajout]) }}>{G.fiche.attribuer}</Bouton>
                <Bouton variante="secondaire" petit disabled={occupe} onClick={() => { setAjout([]); setPanneau(null) }}>{G.annuler}</Bouton>
              </div>
            </div>
          ) : (
            <Bouton variante="secondaire" petit icone="plus" disabled={occupe} onClick={() => setPanneau('ajout')}>{G.fiche.ajouterCopros}</Bouton>
          ))}
        </div>
      </Carte>

      {communes.length > 0 && (
        <Carte titre={remplir(G.fiche.communes, { n: communes.length })} sousTitre={G.fiche.communesAide}>
          <ul className="list-disc space-y-1 pl-5 text-base text-[#1F2D3D]">
            {communes.map((c) => <li key={c.id}>{c.nom}</li>)}
          </ul>
        </Carte>
      )}

      {creations.length > 0 && (
        <Carte titre={remplir(G.fiche.creations, { n: creations.length })}>
          <ul className="list-disc space-y-1 pl-5 text-base text-[#1F2D3D]">
            {creations.map((c) => <li key={c.id}>{c.nom}</li>)}
          </ul>
        </Carte>
      )}

      <Carte titre={G.fiche.activite}>
        {journal.length === 0 ? <p className="text-sm text-[#4A5E78]">{G.fiche.aucuneActivite}</p> : (
          <ul className="space-y-2">
            {journal.map((e) => (
              <li key={e.id} className="text-sm text-[#1F2D3D]">
                {dateHeureParis(e.creeLe)} · {LIBELLE_ACTION_JOURNAL_QR[e.action]} · {auteurJournalQr(e)}{e.coproprieteNom ? ` · ${e.coproprieteNom}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Carte>

      {panneau === 'depart' && (
        <Modale titre={remplir(G.depart.titre, { nom: g.nom ?? G.fiche.ancien })} onFermer={() => setPanneau(null)} labelFermer={G.fermer}>
          <FenetreDepartGestionnaireQr
            fiche={g} attributions={attributions} coproprietes={coproprietes} gestionnaires={gestionnaires ?? []}
            onFermer={() => setPanneau(null)}
            onFait={(bilan) => {
              setPanneau(null)
              setMessages([remplir(G.depart.fait, { deplacees: bilan.deplacees, sans: bilan.laisseesSansGestionnaire })])
              recharger()
              onModifie()
            }}
          />
        </Modale>
      )}
    </div>
  )
}
