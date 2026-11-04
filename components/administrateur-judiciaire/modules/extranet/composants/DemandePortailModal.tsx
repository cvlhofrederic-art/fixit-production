'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { maintenantLiaison } from '@/lib/liaison-copro-aj/horloge'
import {
  ajouterMessage,
  changerStatutDemande,
  marquerDemandeVue,
  type DemandeLiaison,
  type StatutDemandeLiaison,
} from '@/lib/liaison-copro-aj/stockage'
import { dateHeure, LIBELLE_STATUT_PORTAIL, objetDemande, STATUT_DOLEANCE } from '@/lib/liaison-copro-aj/vues-aj'

/** Nom du cabinet signant les réponses (celui des écrans de l'AJ). */
const NOM_CABINET = 'Cabinet Delaunay'

const PRIORITES: Record<DemandeLiaison['priorite'], string> = { urgente: 'Urgente', normale: 'Normale', planifiee: 'Planifiée' }

const teinteStatut = (statut: StatutDemandeLiaison): 'sage' | 'amber' | 'rust' => {
  const doleance = STATUT_DOLEANCE[statut]
  if (doleance === 'Résolue') return 'sage'
  return doleance === 'En cours' ? 'amber' : 'rust'
}

const LIBELLE_CHAMP = {
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: 'var(--navy-300)',
  fontWeight: 600,
  marginBottom: 3,
}

/**
 * Demande reçue du portail copropriétaire (liaison du navigateur) : fiche, fil des échanges, réponse au copropriétaire
 * et statut. Tout ce que le cabinet écrit ici revient aussitôt sur le portail (« Mes demandes »).
 */
export function DemandePortailModal({ demande, onClose }: Readonly<{ demande: DemandeLiaison | null; onClose: () => void }>) {
  const { push } = useToast()
  const [reponse, setReponse] = useState('')
  const ouverte = demande !== null
  const id = demande?.id ?? null

  // Ouvrir la demande vaut lecture : la pastille « Nouveau » et la notification de la cloche disparaissent.
  useEffect(() => {
    if (id) marquerDemandeVue(id)
  }, [id, demande?.messages.length])

  const changerStatut = (statut: StatutDemandeLiaison, titre: string) => {
    if (!demande) return
    changerStatutDemande(demande.id, statut, maintenantLiaison())
    push({ kind: 'success', title: titre, desc: `${demande.nomCoproprietaire} le voit sur son portail.` })
  }

  const envoyer = () => {
    const texte = reponse.trim()
    if (!demande || !texte) return
    const message = ajouterMessage(demande.id, { auteur: 'administrateur', nom: NOM_CABINET, texte }, maintenantLiaison())
    if (!message) {
      push({ kind: 'error', title: 'Réponse non envoyée', desc: 'La demande n’existe plus (échanges de démonstration effacés).' })
      return
    }
    setReponse('')
    push({ kind: 'success', title: 'Réponse envoyée', desc: `Visible par ${demande.nomCoproprietaire} sur son portail.` })
  }

  return (
    <Modal open={ouverte} onClose={onClose} size="lg" labelledBy="demande-portail-titre">
      {demande && (
        <>
          <ModalHeader id="demande-portail-titre" icon="chat" title={objetDemande(demande)} onClose={onClose} />
          <ModalBody>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <Pill kind="gold" noDot>Portail copropriétaire</Pill>
              <Pill kind={teinteStatut(demande.statut)} noDot>{LIBELLE_STATUT_PORTAIL[demande.statut]}</Pill>
              {demande.priorite === 'urgente' && <Pill kind="rust" noDot>Urgente</Pill>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
              {[
                ['Copropriétaire', demande.nomCoproprietaire],
                ['Lot', demande.lot],
                ['Copropriété', demande.nomCopro],
                ['Lieu', demande.partieCommune ? `Parties communes${demande.zone ? ` — ${demande.zone}` : ''}` : 'Logement'],
                ['Priorité', PRIORITES[demande.priorite]],
                ['Déposée le', dateHeure(demande.creeLe)],
              ].map(([libelle, valeur]) => (
                <div key={libelle}>
                  <div style={LIBELLE_CHAMP}>{libelle}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--navy-700)' }}>{valeur}</div>
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={LIBELLE_CHAMP}>Description</div>
                <div style={{ fontSize: 13.5, color: 'var(--navy-700)', whiteSpace: 'pre-wrap' }}>{demande.description}</div>
              </div>
            </div>

            <h3 style={{ fontSize: 13, fontWeight: 700, margin: '20px 0 8px' }}>Échanges avec le copropriétaire</h3>
            {demande.messages.length === 0 ? (
              <p className="muted" style={{ fontSize: 12.5 }}>Aucun échange pour le moment.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                {demande.messages.map((message) => (
                  <li
                    key={message.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: message.auteur === 'administrateur' ? 'var(--navy-50, #eef2f7)' : 'var(--gold-50, #fbf6e9)',
                    }}
                  >
                    <div style={{ fontSize: 11.5, color: 'var(--navy-500)', marginBottom: 2 }}>
                      <b>{message.auteur === 'administrateur' ? `${message.nom} (cabinet)` : message.nom}</b> · {dateHeure(message.date)}
                    </div>
                    <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{message.texte}</div>
                  </li>
                ))}
              </ul>
            )}

            <label htmlFor="demande-portail-reponse" style={{ ...LIBELLE_CHAMP, display: 'block', marginTop: 16 }}>
              Répondre au copropriétaire
            </label>
            <textarea
              id="demande-portail-reponse"
              rows={3}
              value={reponse}
              onChange={(evenement) => setReponse(evenement.target.value)}
              placeholder="ex. Le plombier passe demain matin entre 9 h et 11 h."
              maxLength={2000}
              style={{ width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.55, fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn gold sm" onClick={envoyer} disabled={!reponse.trim()}>
                Envoyer au copropriétaire
              </button>
            </div>
          </ModalBody>
          <ModalFooter>
            {(demande.statut === 'en_attente' || demande.statut === 'acceptee') && (
              <button type="button" className="btn" onClick={() => changerStatut('en_cours', 'Demande prise en charge')}>
                Prendre en charge
              </button>
            )}
            {demande.statut !== 'terminee' && demande.statut !== 'annulee' && (
              <button type="button" className="btn" onClick={() => changerStatut('terminee', 'Demande résolue')}>
                Marquer résolue
              </button>
            )}
            {(demande.statut === 'terminee' || demande.statut === 'annulee') && (
              <button type="button" className="btn" onClick={() => changerStatut('en_cours', 'Demande rouverte')}>
                Rouvrir
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              Fermer
            </button>
          </ModalFooter>
        </>
      )}
    </Modal>
  )
}
