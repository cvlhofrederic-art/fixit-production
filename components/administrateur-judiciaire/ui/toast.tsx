'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'

/** Genres de notification (classe vfx-toast--<genre>). « warn » n'a pas d'icône d'alerte (seul « warning » en a une). */
export type GenreToast = 'success' | 'info' | 'warning' | 'warn' | 'error'

/** Notification simple. duration en ms (0 = permanente) ; par défaut 4 s (success), 5 s (info), 6 s (autres). */
export interface OptionsToast {
  kind?: GenreToast
  title?: ReactNode
  desc?: ReactNode
  duration?: number
}

/** Ligne du document généré : paragraphe (chaîne), intertitre { h }, couple { k, v } ou puce { li }. */
export type LigneDocument =
  | string
  | {
      h?: ReactNode
      k?: ReactNode
      v?: ReactNode
      li?: ReactNode
    }

/** Document généré, affiché dans le visualiseur « gendoc ». */
export interface OptionsDocument {
  kind: 'doc'
  icon?: string
  title?: string
  eyebrow?: ReactNode
  docTitle?: ReactNode
  meta?: ReactNode
  lines?: readonly LigneDocument[]
}

/** Champ du formulaire « genform » : « select », « textarea » ou input texte. */
export interface ChampFormulaireToast {
  name?: string
  label?: ReactNode
  type?: string
  options?: readonly string[]
  placeholder?: string
  rows?: number
  value?: string | null
  /** Pleine largeur sauf si false. */
  full?: boolean
}

/** Valeurs du formulaire « genform », indexées par name ou, à défaut, par « f<index> ». */
export type ValeursFormulaireToast = Record<string, string>

/** Formulaire rapide « genform ». Sans onSubmit, la validation est simulée (toast « Simulation »). */
export interface OptionsFormulaire {
  kind: 'form'
  icon?: string
  title?: ReactNode
  lede?: ReactNode
  fields?: readonly ChampFormulaireToast[]
  /** « Enregistrer » par défaut. */
  submitLabel?: ReactNode
  onSubmit?: (valeurs: ValeursFormulaireToast) => unknown
  toast?: {
    title?: ReactNode
    /** Peut être une fonction du résultat d'onSubmit. */
    desc?: ReactNode | ((resultat: unknown) => ReactNode)
  }
}

export type OptionsPush = OptionsToast | OptionsDocument | OptionsFormulaire

export interface ToastApi {
  /** Ouvre un document (kind « doc »), un formulaire (kind « form ») ou affiche un toast et renvoie son id. */
  push: (options: OptionsPush) => number | undefined
  dismiss: (id: number) => void
}

interface ToastAffiche extends Omit<OptionsToast, 'kind'> {
  id: number
  kind?: string
}

export const ToastContext = createContext<ToastApi | null>(null)

/** Accès aux notifications ; hors ToastProvider (tests, vignettes), renvoie des fonctions sans effet. */
export const useToast = (): ToastApi =>
  useContext(ToastContext) || {
    push: () => undefined,
    dismiss: () => {},
  }

/**
 * Libellé du bouton de fermeture d'un toast. La maquette échappait deux fois le caractère « × » : au lieu du
 * signe, le bouton affiche littéralement sa séquence d'échappement (barre oblique inverse suivie de « u00d7 »,
 * six caractères). Conservé tel quel (fidélité du rendu).
 */
const LIBELLE_FERMETURE_TOAST = '\\u00d7'

/**
 * Fournisseur des notifications, monté à la racine : pile de toasts, visualiseur de documents générés
 * (« gendoc ») et formulaire rapide (« genform »).
 */
export function ToastProvider({ children }: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<ToastAffiche[]>([])
  const compteur = useRef(0)
  const [documentOuvert, setDocumentOuvert] = useState<OptionsDocument | null>(null)
  const [formulaire, setFormulaire] = useState<OptionsFormulaire | null>(null)
  const [valeurs, setValeurs] = useState<ValeursFormulaireToast>({})

  const dismiss = useCallback((id: number) => setToasts((liste) => liste.filter((toast) => toast.id !== id)), [])

  const afficher = useCallback(
    (options: OptionsToast) => {
      const id = ++compteur.current
      const kind = options.kind || 'info'
      const duree =
        options.duration != null ? options.duration : kind === 'success' ? 4000 : kind === 'info' ? 5000 : 6000
      // Au plus trois toasts visibles : les deux derniers sont conservés avant d'ajouter le nouveau.
      setToasts((liste) => [...liste.slice(-2), { id, kind, ...options }])
      if (duree > 0) setTimeout(() => dismiss(id), duree)
      return id
    },
    [dismiss],
  )

  const push = useCallback(
    (options: OptionsPush) => {
      if (options && options.kind === 'doc') {
        setDocumentOuvert(options)
        return
      }
      if (options && options.kind === 'form') {
        const initiales: ValeursFormulaireToast = {}
        ;(options.fields || []).forEach((champ, index) => {
          initiales[champ.name || 'f' + index] = champ.value != null ? champ.value : ''
        })
        setValeurs(initiales)
        setFormulaire(options)
        return
      }
      return afficher(options)
    },
    [afficher],
  )

  // Valeur du contexte stable : l'apparition ou l'expiration d'un toast ne fait plus re-rendre les consommateurs.
  const valeurContexte = useMemo<ToastApi>(() => ({ push, dismiss }), [push, dismiss])

  // Formulaires dont l'onSubmit est en attente : un nouveau clic sur « Enregistrer » pendant l'attente est ignoré
  // (dans la maquette, un double clic appelait onSubmit deux fois et écrivait deux fois dans la base locale).
  const soumissionsEnCours = useRef(new Set<OptionsFormulaire>())

  const soumettreFormulaire = async () => {
    if (formulaire && typeof formulaire.onSubmit === 'function') {
      const formulaireSoumis = formulaire
      if (soumissionsEnCours.current.has(formulaireSoumis)) return
      soumissionsEnCours.current.add(formulaireSoumis)
      try {
        const resultat = await formulaire.onSubmit(valeurs)
        // Ne ferme que le formulaire soumis : un autre formulaire ouvert entre-temps reste ouvert.
        setFormulaire((courant) => (courant === formulaireSoumis ? null : courant))
        const toastFormulaire = formulaire.toast || {}
        const desc = typeof toastFormulaire.desc === 'function' ? toastFormulaire.desc(resultat) : toastFormulaire.desc
        afficher({
          kind: 'success',
          title: toastFormulaire.title || 'Enregistré',
          desc,
        })
      } catch (erreur) {
        const message = erreur ? (erreur as { message?: ReactNode }).message : undefined
        afficher({
          kind: 'error',
          title: 'Erreur',
          desc: message || "L'enregistrement a échoué.",
        })
      } finally {
        soumissionsEnCours.current.delete(formulaireSoumis)
      }
      return
    }
    const toastFormulaire = (formulaire && formulaire.toast) || {}
    const titre = formulaire && formulaire.title
    setFormulaire(null)
    afficher({
      kind: 'success',
      title: toastFormulaire.title || titre || 'Simulation',
      // Une desc fonction (prévue pour onSubmit) serait transmise telle quelle, comme dans la maquette.
      desc: (toastFormulaire.desc as ReactNode) || 'Simulation — les informations ne sont pas enregistrées dans cette version.',
    })
  }

  return (
    <ToastContext.Provider value={valeurContexte}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <DocViewer documentGenere={documentOuvert} onClose={() => setDocumentOuvert(null)} afficherToast={afficher} />
      <PushFormModal
        formulaire={formulaire}
        valeurs={valeurs}
        onChangeValeur={(cle, valeur) => setValeurs((precedentes) => ({ ...precedentes, [cle]: valeur }))}
        onClose={() => setFormulaire(null)}
        onSubmit={soumettreFormulaire}
      />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }: { toasts: readonly ToastAffiche[]; onDismiss: (id: number) => void }) {
  return (
    <div className="vfx-toast-viewport" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          className={`vfx-toast vfx-toast--${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          key={toast.id}
        >
          <Icon
            name={
              toast.kind === 'success' ? 'check' : toast.kind === 'error' || toast.kind === 'warning' ? 'alert' : 'info'
            }
            aria-hidden="true"
          />
          <div className="vfx-toast__body">
            {toast.title && <div className="vfx-toast__title">{toast.title}</div>}
            {toast.desc && <div className="vfx-toast__desc">{toast.desc}</div>}
          </div>
          <button className="vfx-toast__close" onClick={() => onDismiss(toast.id)} aria-label="Fermer">
            {LIBELLE_FERMETURE_TOAST}
          </button>
        </div>
      ))}
    </div>
  )
}

/** Visualiseur de document généré. « Copier » et « Télécharger » sont simulés (toasts uniquement). */
function DocViewer({
  documentGenere,
  onClose,
  afficherToast,
}: {
  documentGenere: OptionsDocument | null
  onClose: () => void
  afficherToast: (options: OptionsToast) => number
}) {
  return (
    <Modal open={!!documentGenere} onClose={onClose} size="lg" labelledBy="gendoc-t">
      {documentGenere && (
        <>
          <ModalHeader id="gendoc-t" icon={documentGenere.icon || 'doc'} title={documentGenere.title} onClose={onClose} />
          <ModalBody>
            <div className="gendoc">
              {documentGenere.eyebrow && <div className="gendoc-eyebrow">{documentGenere.eyebrow}</div>}
              <div className="gendoc-h1">{documentGenere.docTitle || documentGenere.title}</div>
              {documentGenere.meta && <div className="gendoc-meta">{documentGenere.meta}</div>}
              <div className="gendoc-body">
                {(documentGenere.lines || []).map((ligne, index) =>
                  typeof ligne === 'string' ? (
                    <p key={index}>{ligne}</p>
                  ) : ligne.h ? (
                    <h4 className="gendoc-sec" key={index}>
                      {ligne.h}
                    </h4>
                  ) : ligne.k != null ? (
                    <div className="gendoc-kv" key={index}>
                      <span>{ligne.k}</span>
                      <b>{ligne.v}</b>
                    </div>
                  ) : ligne.li ? (
                    <div className="gendoc-li" key={index}>
                      {ligne.li}
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              className="btn ghost"
              onClick={() => {
                onClose()
                afficherToast({
                  kind: 'info',
                  title: 'Copié',
                  desc: 'Document copié dans le presse-papiers.',
                })
              }}
            >
              <Icon name="doc" />
              Copier
            </button>
            <button
              className="btn gold"
              onClick={() => {
                const titre = documentGenere && documentGenere.title
                onClose()
                afficherToast({
                  kind: 'success',
                  title: 'Simulation',
                  desc: (titre || 'Document') + " — aucun fichier n'est généré dans cette version.",
                })
              }}
            >
              <Icon name="download" />
              Télécharger
            </button>
          </ModalFooter>
        </>
      )}
    </Modal>
  )
}

/** Formulaire rapide « genform » (aucune validation ; un select sans value démarre à « »). */
function PushFormModal({
  formulaire,
  valeurs,
  onChangeValeur,
  onClose,
  onSubmit,
}: {
  formulaire: OptionsFormulaire | null
  valeurs: ValeursFormulaireToast
  onChangeValeur: (cle: string, valeur: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <Modal open={!!formulaire} onClose={onClose} size="md" labelledBy="genform-t">
      {formulaire && (
        <>
          <ModalHeader id="genform-t" icon={formulaire.icon || 'plus'} title={formulaire.title} onClose={onClose} />
          <ModalBody>
            {formulaire.lede && <p className="form-lede">{formulaire.lede}</p>}
            {(formulaire.fields || []).map((champ, index) => {
              const cle = champ.name || 'f' + index
              const modifier = (valeur: string) => onChangeValeur(cle, valeur)
              return (
                <FieldRow key={index}>
                  <Field label={champ.label} full={champ.full !== false}>
                    {champ.type === 'select' ? (
                      <select value={valeurs[cle] || ''} onChange={(evenement) => modifier(evenement.target.value)}>
                        {(champ.options || []).map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    ) : champ.type === 'textarea' ? (
                      <textarea
                        rows={champ.rows || 3}
                        value={valeurs[cle] || ''}
                        onChange={(evenement) => modifier(evenement.target.value)}
                        placeholder={champ.placeholder || ''}
                        style={{
                          width: '100%',
                          resize: 'vertical',
                        }}
                      />
                    ) : (
                      <input
                        value={valeurs[cle] || ''}
                        onChange={(evenement) => modifier(evenement.target.value)}
                        placeholder={champ.placeholder || ''}
                      />
                    )}
                  </Field>
                </FieldRow>
              )
            })}
          </ModalBody>
          <ModalFooter>
            <button className="btn ghost" onClick={onClose}>
              Annuler
            </button>
            <button className="btn gold" onClick={onSubmit}>
              <Icon name="check" />
              {formulaire.submitLabel || 'Enregistrer'}
            </button>
          </ModalFooter>
        </>
      )}
    </Modal>
  )
}
