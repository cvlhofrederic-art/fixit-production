'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Field } from '@/components/administrateur-judiciaire/ui/Field'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { messageErreurOrdre } from '@/components/administrateur-judiciaire/modules/gestion/vitfix/api'
import { dateLocaleIso } from '@/lib/administrateur-judiciaire/mode'
import {
  urgenceDepuisLibelle,
  type DemandeEnvoiOrdre,
  type PrestataireVitfix,
} from '@/lib/administrateur-judiciaire/ordres-prestataire'

/** Intervention transmise : un ordre de service de l'écran, ou null pour une saisie libre. */
export interface SourceEnvoi {
  /** Numéro de l'ordre de service (« OS-2026-051 »), absent pour une saisie libre. */
  reference?: string
  copropriete: string
  objet: string
  localisation: string
  /** « Normale », « Prioritaire » ou « Urgence ». */
  urgence: string
}

export interface EnvoiPrestataireModalProps {
  open: boolean
  source: SourceEnvoi | null
  prestataires: PrestataireVitfix[]
  /** Liste des prestataires lue au moins une fois. */
  prestatairesCharges: boolean
  /** Copropriétés proposées en saisie libre. */
  coproprietes: string[]
  onClose: () => void
  /** Envoi réel ; rejette en cas d'échec (message affiché dans la fenêtre). */
  onEnvoyer: (demande: DemandeEnvoiOrdre) => Promise<void>
}

const URGENCES = ['Normale', 'Prioritaire', 'Urgence']

/**
 * Présélection seulement s'il n'y a qu'UN prestataire avec compte Vitfix : avec plusieurs comptes liés, un seul
 * clic sur « Envoyer l'ordre » ne doit pas partir chez le premier par ordre alphabétique (un vrai tiers).
 */
const premierAvecCompte = (prestataires: PrestataireVitfix[]) => {
  const avecCompte = prestataires.filter((p) => p.compte)
  return avecCompte.length === 1 ? avecCompte[0].id : ''
}

/**
 * « Envoyer au prestataire Vitfix » : choix d'un prestataire du cabinet (ceux sans compte Vitfix sont grisés),
 * date d'intervention (jour réel par défaut, jamais la date figée de la démonstration) et note. Pour une saisie
 * libre, la copropriété, l'objet, la localisation, l'urgence et la description sont demandés aussi. L'envoi est
 * réel : la fenêtre reste ouverte pendant l'envoi et affiche l'erreur éventuelle.
 */
export function EnvoiPrestataireModal({
  open,
  source,
  prestataires,
  prestatairesCharges,
  coproprietes,
  onClose,
  onEnvoyer,
}: EnvoiPrestataireModalProps) {
  const { push } = useToast()
  const [copropriete, setCopropriete] = useState('')
  const [objet, setObjet] = useState('')
  const [localisation, setLocalisation] = useState('')
  const [urgence, setUrgence] = useState('Normale')
  const [description, setDescription] = useState('')
  const [prestataireId, setPrestataireId] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [tentative, setTentative] = useState(false)
  // Garde contre le double clic : l'état React n'est pas encore à jour au second clic.
  const envoiVerrou = useRef(false)

  useEffect(() => {
    // Réinitialisation à l'ouverture uniquement, à partir de l'intervention transmise.
    if (!open) return
    setCopropriete(source?.copropriete ?? coproprietes[0] ?? '')
    setObjet(source?.objet ?? '')
    setLocalisation(source?.localisation ?? '')
    setUrgence(source?.urgence && URGENCES.includes(source.urgence) ? source.urgence : 'Normale')
    setDescription('')
    setPrestataireId(premierAvecCompte(prestataires))
    setDate(dateLocaleIso(new Date()))
    setNote('')
    setErreur(null)
    setTentative(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    // Liste arrivée après l'ouverture : premier prestataire avec compte présélectionné.
    if (open && !prestataireId) setPrestataireId(premierAvecCompte(prestataires))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prestataires])

  if (!open) return null

  const prestataire = prestataires.find((p) => p.id === prestataireId)
  const erreurs = {
    copropriete: !copropriete.trim() ? 'Copropriété requise' : null,
    objet: !objet.trim() ? 'Objet requis' : null,
    prestataire: !prestataire ? 'Choisissez un prestataire' : !prestataire.compte ? 'Pas de compte Vitfix' : null,
  }
  const invalide = Object.values(erreurs).some(Boolean)
  const aucunAvecCompte = prestatairesCharges && !prestataires.some((p) => p.compte)

  const envoyer = async () => {
    setTentative(true)
    if (invalide || envoiVerrou.current) return
    envoiVerrou.current = true
    setEnvoiEnCours(true)
    setErreur(null)
    try {
      await onEnvoyer({
        syndic_artisan_id: prestataireId,
        copropriete: copropriete.trim(),
        objet: objet.trim(),
        localisation: localisation.trim() || undefined,
        urgence: urgenceDepuisLibelle(urgence),
        description: description.trim() || undefined,
        date_intervention: date || undefined,
        note: note.trim() || undefined,
        reference_aj: source?.reference,
      })
      onClose()
    } catch (echec) {
      const message = messageErreurOrdre(echec)
      setErreur(message)
      push({ kind: 'error', title: 'Ordre non transmis', desc: message })
    } finally {
      envoiVerrou.current = false
      setEnvoiEnCours(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md" labelledBy="vitfix-envoi-t">
      <ModalHeader id="vitfix-envoi-t" icon="handshake" title="Envoyer au prestataire Vitfix" onClose={onClose} />
      <ModalBody>
        <Alert kind="gold" icon="handshake" title="Envoi réel">
          L’ordre part sur le compte Vitfix du prestataire (notification et messagerie), même en mode démonstration.
          Ses réponses, ses documents et l’avancement reviennent dans le suivi de l’ordre.
        </Alert>
        {source && (
          <div style={{ margin: '14px 0', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--cream)' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--navy-300)' }}>
              {source.reference ?? 'Ordre de service'}
              {' · '}
              {source.urgence}
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontWeight: 500, marginTop: 2 }}>{source.copropriete}</div>
            <div style={{ fontSize: 12.5, color: 'var(--navy-500)' }}>
              {source.objet}
              {source.localisation ? ` — ${source.localisation}` : ''}
            </div>
          </div>
        )}
        <div className="field-row" style={source ? undefined : { marginTop: 14 }}>
          {!source && (
            <>
              <Field label="Copropriété" name="vitfix-copropriete" required full error={tentative ? erreurs.copropriete : null}>
                <input type="text" list="vitfix-coproprietes" value={copropriete} onChange={(e) => setCopropriete(e.target.value)} />
              </Field>
              <datalist id="vitfix-coproprietes">
                {coproprietes.map((nom) => (
                  <option key={nom} value={nom} />
                ))}
              </datalist>
              <Field label="Objet" name="vitfix-objet" required full error={tentative ? erreurs.objet : null}>
                <input type="text" value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="ex. Fuite sur colonne EU" />
              </Field>
              <Field label="Localisation" name="vitfix-localisation">
                <input type="text" value={localisation} onChange={(e) => setLocalisation(e.target.value)} placeholder="ex. Lot 27, hall, cage B" />
              </Field>
              <Field label="Urgence" name="vitfix-urgence">
                <select value={urgence} onChange={(e) => setUrgence(e.target.value)}>
                  {URGENCES.map((libelle) => (
                    <option key={libelle}>{libelle}</option>
                  ))}
                </select>
              </Field>
              <Field label="Description" name="vitfix-description" full>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </>
          )}
          <Field
            label="Prestataire Vitfix"
            name="vitfix-prestataire"
            required
            full
            error={tentative ? erreurs.prestataire : null}
            hint={aucunAvecCompte ? 'Aucun prestataire du cabinet n’a de compte Vitfix.' : 'Prestataires du cabinet ; ceux sans compte Vitfix ne peuvent pas recevoir l’ordre.'}
          >
            <select value={prestataireId} onChange={(e) => setPrestataireId(e.target.value)}>
              <option value="">{prestatairesCharges ? 'Choisir un prestataire…' : 'Chargement des prestataires…'}</option>
              {prestataires.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.compte}>
                  {p.nom}
                  {p.metier ? ` — ${p.metier}` : ''}
                  {p.compte ? '' : ' (pas de compte Vitfix)'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date d’intervention" name="vitfix-date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note pour le prestataire" name="vitfix-note" full>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. Clé chez la gardienne" />
          </Field>
        </div>
        {erreur && (
          <div style={{ marginTop: 12 }}>
            <Alert kind="rust" title="Ordre non transmis">
              {erreur}
            </Alert>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="btn gold" onClick={() => void envoyer()} disabled={envoiEnCours} aria-busy={envoiEnCours}>
          {envoiEnCours ? 'Envoi…' : 'Envoyer l’ordre'}
        </button>
      </ModalFooter>
    </Modal>
  )
}
