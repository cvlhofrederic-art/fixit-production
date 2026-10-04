import './fuseau-paris'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Modal, ModalBody, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { FormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import {
  ToastProvider,
  useToast,
  type OptionsFormulaire,
  type ToastApi,
} from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Régressions des défauts hérités de la maquette dans la modale et le fournisseur de toasts :
 * 0) focus renvoyé sur « Fermer » à chaque rendu du parent (saisie impossible au clavier) ;
 * 1) Échap fermant toutes les modales empilées et défilement de la page bloqué ensuite ;
 * 2) double clic sur « Enregistrer » soumettant deux fois le formulaire « genform ».
 */

const dialogues = () => document.querySelectorAll('[role="dialog"]')
const boutonFermer = () => document.querySelector<HTMLButtonElement>('.modal .modal-close')

/** Appui sur une touche depuis l'élément actif (l'événement remonte jusqu'à document). Renvoie false si empêché. */
const appuyer = (key: string, shiftKey = false) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey })

function DeclencheurFormulaire({ libelle = 'Ajouter', options }: { libelle?: string; options: OptionsFormulaire }) {
  const { push } = useToast()
  return (
    <button type="button" onClick={() => push(options)}>
      {libelle}
    </button>
  )
}

beforeEach(() => {
  document.body.style.overflow = ''
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Modal — focus pendant la saisie (constat 0)', () => {
  function ModaleAvecSaisie() {
    const [ouvert, setOuvert] = useState(true)
    const [objet, setObjet] = useState('')
    return (
      <Modal open={ouvert} onClose={() => setOuvert(false)} labelledBy="saisie-t">
        <ModalHeader id="saisie-t" title="Nouvel ordre de service" onClose={() => setOuvert(false)} />
        <ModalBody>
          <input aria-label="Objet" value={objet} onChange={(evenement) => setObjet(evenement.target.value)} />
        </ModalBody>
      </Modal>
    )
  }

  it('garde le focus dans le champ quand le parent (onClose en ligne) re-rend à chaque frappe', () => {
    render(<ModaleAvecSaisie />)
    // Focus initial à l'ouverture : premier élément focusable (bouton « Fermer »), inchangé.
    expect(document.activeElement).toBe(boutonFermer())
    const champ = screen.getByLabelText('Objet') as HTMLInputElement
    champ.focus()
    fireEvent.change(champ, { target: { value: 'R' } })
    expect(document.activeElement).toBe(champ)
    fireEvent.change(champ, { target: { value: 'Ré' } })
    fireEvent.change(champ, { target: { value: 'Réf' } })
    expect(champ.value).toBe('Réf')
    expect(document.activeElement).toBe(champ)
  })

  it('Échap appelle le dernier onClose reçu (valeurs saisies à jour)', () => {
    const journal: string[] = []
    function ModaleJournal() {
      const [ouvert, setOuvert] = useState(true)
      const [objet, setObjet] = useState('')
      const fermer = () => {
        journal.push(objet)
        setOuvert(false)
      }
      return (
        <Modal open={ouvert} onClose={fermer} labelledBy="journal-t">
          <ModalHeader id="journal-t" title="Titre" onClose={fermer} />
          <input aria-label="Objet" value={objet} onChange={(evenement) => setObjet(evenement.target.value)} />
        </Modal>
      )
    }
    render(<ModaleJournal />)
    fireEvent.change(screen.getByLabelText('Objet'), { target: { value: 'Fuite' } })
    appuyer('Escape')
    expect(journal).toEqual(['Fuite'])
    expect(dialogues()).toHaveLength(0)
  })

  it('formulaire « genform » : la frappe dans « Nom » ne déplace pas le focus, qui revient au déclencheur à la fermeture', () => {
    render(
      <ToastProvider>
        <DeclencheurFormulaire
          options={{
            kind: 'form',
            title: 'Nouvelle copropriété',
            fields: [
              { label: 'Nom', name: 'nom' },
              { label: 'Lots', name: 'nbLots' },
            ],
          }}
        />
      </ToastProvider>,
    )
    const declencheur = screen.getByRole('button', { name: 'Ajouter' })
    declencheur.focus()
    fireEvent.click(declencheur)
    expect(document.activeElement).toBe(boutonFermer())
    const [nom] = Array.from(document.querySelectorAll<HTMLInputElement>('.modal input'))
    nom.focus()
    fireEvent.change(nom, { target: { value: 'R' } })
    expect(nom.value).toBe('R')
    expect(document.activeElement).toBe(nom)
    fireEvent.change(nom, { target: { value: 'Résidence' } })
    expect(document.activeElement).toBe(nom)
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(dialogues()).toHaveLength(0)
    expect(document.activeElement).toBe(declencheur)
  })

  it('un toast qui apparaît puis expire pendant la saisie ne retire pas le focus du champ', () => {
    vi.useFakeTimers()
    function FauxShell() {
      const { push } = useToast()
      const [ouvert, setOuvert] = useState(false)
      return (
        <>
          <button type="button" onClick={() => push({ kind: 'success', title: 'Ordre transmis', duration: 50 })}>
            Notifier
          </button>
          <button type="button" onClick={() => setOuvert(true)}>
            Nouvel ordre
          </button>
          <FormModal
            open={ouvert}
            onClose={() => setOuvert(false)}
            title="Nouvel ordre de service"
            fields={[{ label: 'Objet', name: 'objet' }]}
          />
        </>
      )
    }
    render(
      <ToastProvider>
        <FauxShell />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Nouvel ordre' }))
    const champ = document.querySelector<HTMLInputElement>('.modal input') as HTMLInputElement
    champ.focus()
    fireEvent.click(screen.getByRole('button', { name: 'Notifier' }))
    expect(screen.getByText('Ordre transmis')).toBeTruthy()
    expect(document.activeElement).toBe(champ)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(screen.queryByText('Ordre transmis')).toBeNull()
    expect(document.activeElement).toBe(champ)
  })

  it('la valeur du contexte des toasts est stable : un toast ne fait pas re-rendre les consommateurs', () => {
    const surRendu = vi.fn<(api: ToastApi) => void>()
    function Consommateur({ signaler }: { signaler: (api: ToastApi) => void }) {
      const api = useToast()
      signaler(api)
      return (
        <button type="button" onClick={() => api.push({ kind: 'info', title: 'Information' })}>
          Notifier
        </button>
      )
    }
    render(
      <ToastProvider>
        <Consommateur signaler={surRendu} />
      </ToastProvider>,
    )
    expect(surRendu).toHaveBeenCalledTimes(1)
    const [[apiInitiale]] = surRendu.mock.calls
    fireEvent.click(screen.getByRole('button', { name: 'Notifier' }))
    expect(screen.getByText('Information')).toBeTruthy()
    expect(surRendu).toHaveBeenCalledTimes(1)
    expect(typeof apiInitiale.push).toBe('function')
    expect(typeof apiInitiale.dismiss).toBe('function')
  })

  it('piège de focus : la liste des éléments focusables est recalculée quand le contenu change', () => {
    // onClose stable : aucun rendu du parent ne relance l'installation de la modale.
    const fermer = vi.fn()
    function ModaleEvolutive() {
      const [etendue, setEtendue] = useState(false)
      return (
        <Modal open onClose={fermer} labelledBy="evol-t">
          <ModalHeader id="evol-t" title="Titre" onClose={fermer} />
          <ModalBody>
            <button type="button" onClick={() => setEtendue(true)}>
              Afficher plus
            </button>
            {etendue && <button type="button">Action ajoutée</button>}
          </ModalBody>
        </Modal>
      )
    }
    render(<ModaleEvolutive />)
    fireEvent.click(screen.getByRole('button', { name: 'Afficher plus' }))
    const ajoutee = screen.getByRole('button', { name: 'Action ajoutée' })
    ajoutee.focus()
    // Tab depuis le dernier élément (apparu après l'ouverture) : retour au premier.
    expect(appuyer('Tab')).toBe(false)
    expect(document.activeElement).toBe(boutonFermer())
    // Maj+Tab depuis le premier : vers le dernier élément actuel.
    expect(appuyer('Tab', true)).toBe(false)
    expect(document.activeElement).toBe(ajoutee)
    // Tab ailleurs qu'aux extrémités : comportement natif (non empêché).
    screen.getByRole('button', { name: 'Afficher plus' }).focus()
    expect(appuyer('Tab')).toBe(true)
    expect(fermer).not.toHaveBeenCalled()
  })
})

describe('Modal — modales empilées et défilement de la page (constat 1)', () => {
  function DeuxModales() {
    const [externe, setExterne] = useState(true)
    const [interne, setInterne] = useState(false)
    return (
      <>
        <Modal open={externe} onClose={() => setExterne(false)} size="lg" labelledBy="ext-t">
          <ModalHeader id="ext-t" title="Dossier" onClose={() => setExterne(false)} />
          <ModalBody>
            <button type="button" onClick={() => setInterne(true)}>
              Ouvrir la pièce
            </button>
            <button type="button" onClick={() => setExterne(false)}>
              Fermer le dossier
            </button>
          </ModalBody>
        </Modal>
        <Modal open={interne} onClose={() => setInterne(false)} labelledBy="int-t">
          <ModalHeader id="int-t" title="Pièce" onClose={() => setInterne(false)} />
          <ModalBody>
            <button type="button" onClick={() => setInterne(false)}>
              Fermer la pièce
            </button>
          </ModalBody>
        </Modal>
      </>
    )
  }

  it('Échap ne ferme que la modale du dessus, puis la suivante ; le défilement d’origine est restitué', () => {
    document.body.style.overflow = 'auto'
    render(<DeuxModales />)
    expect(document.body.style.overflow).toBe('hidden')
    const ouvrirPiece = screen.getByRole('button', { name: 'Ouvrir la pièce' })
    ouvrirPiece.focus()
    fireEvent.click(ouvrirPiece)
    expect(dialogues()).toHaveLength(2)

    appuyer('Escape')
    expect(dialogues()).toHaveLength(1)
    expect(screen.getByText('Dossier')).toBeTruthy()
    expect(screen.queryByText('Pièce')).toBeNull()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(ouvrirPiece)

    appuyer('Escape')
    expect(dialogues()).toHaveLength(0)
    expect(document.body.style.overflow).toBe('auto')
  })

  it('reste cohérent sous StrictMode (effets montés, démontés puis remontés)', () => {
    document.body.style.overflow = 'auto'
    render(<DeuxModales />, { reactStrictMode: true })
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la pièce' }))
    expect(dialogues()).toHaveLength(2)
    appuyer('Escape')
    expect(dialogues()).toHaveLength(1)
    expect(document.body.style.overflow).toBe('hidden')
    appuyer('Escape')
    expect(dialogues()).toHaveLength(0)
    expect(document.body.style.overflow).toBe('auto')
  })

  it('le verrouillage du défilement est compté : fermer la modale du dessous laisse la page bloquée', () => {
    render(<DeuxModales />)
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la pièce' }))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le dossier' }))
    expect(dialogues()).toHaveLength(1)
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la pièce' }))
    expect(dialogues()).toHaveLength(0)
    expect(document.body.style.overflow).toBe('')
  })

  it('document ouvert (push kind « doc ») depuis une modale de module : Échap ne ferme que le visualiseur', () => {
    function DossierAvecPiece() {
      const { push } = useToast()
      const [ouvert, setOuvert] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setOuvert(true)}>
            Ouvrir dossier
          </button>
          <Modal open={ouvert} onClose={() => setOuvert(false)} size="lg" labelledBy="doss-t">
            <ModalHeader id="doss-t" icon="folder" title="Dossier — Résidence du Parc" onClose={() => setOuvert(false)} />
            <ModalBody>
              <button type="button" onClick={() => push({ kind: 'doc', title: 'Procès-verbal', lines: ['Contenu'] })}>
                Ouvrir
              </button>
            </ModalBody>
          </Modal>
        </>
      )
    }
    render(
      <ToastProvider>
        <DossierAvecPiece />
      </ToastProvider>,
    )
    const ouvrir = screen.getByRole('button', { name: 'Ouvrir' })
    ouvrir.focus()
    fireEvent.click(ouvrir)
    expect(dialogues()).toHaveLength(2)
    expect(document.body.style.overflow).toBe('hidden')

    appuyer('Escape')
    expect(dialogues()).toHaveLength(1)
    expect(screen.getByText('Dossier — Résidence du Parc')).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(ouvrir)

    appuyer('Escape')
    expect(dialogues()).toHaveLength(0)
    expect(document.body.style.overflow).toBe('')

    // Une modale ouverte ensuite restitue bien la valeur d'origine (plus de « hidden » mémorisé).
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir dossier' }))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(boutonFermer() as HTMLButtonElement)
    expect(dialogues()).toHaveLength(0)
    expect(document.body.style.overflow).toBe('')
  })
})

describe('ToastProvider — soumission du formulaire « genform » (constat 2)', () => {
  const champs = [{ label: 'Nom', name: 'nom' }] as const

  it('un double clic sur « Enregistrer » n’appelle onSubmit qu’une fois (un seul toast)', async () => {
    let terminer: (resultat: unknown) => void = () => {}
    const onSubmit = vi.fn(
      () =>
        new Promise<unknown>((resoudre) => {
          terminer = resoudre
        }),
    )
    render(
      <ToastProvider>
        <DeclencheurFormulaire
          options={{
            kind: 'form',
            title: 'Nouvelle copropriété',
            fields: champs,
            onSubmit,
            toast: { title: 'Copropriété créée' },
          }}
        />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    fireEvent.change(document.querySelector('.modal input') as HTMLInputElement, {
      target: { value: 'Résidence' },
    })
    const enregistrer = screen.getByRole('button', { name: 'Enregistrer' })
    fireEvent.click(enregistrer)
    fireEvent.click(enregistrer)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ nom: 'Résidence' })

    await act(async () => {
      terminer({ id: 'c1' })
    })
    expect(dialogues()).toHaveLength(0)
    expect(screen.getAllByText('Copropriété créée')).toHaveLength(1)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('la fin tardive d’une soumission ne ferme pas un autre formulaire ouvert entre-temps', async () => {
    let terminerA: (resultat: unknown) => void = () => {}
    const onSubmitA = vi.fn(
      () =>
        new Promise<unknown>((resoudre) => {
          terminerA = resoudre
        }),
    )
    render(
      <ToastProvider>
        <DeclencheurFormulaire
          libelle="Ouvrir A"
          options={{ kind: 'form', title: 'Formulaire A', fields: champs, onSubmit: onSubmitA, toast: { title: 'A enregistré' } }}
        />
        <DeclencheurFormulaire libelle="Ouvrir B" options={{ kind: 'form', title: 'Formulaire B', fields: champs }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    appuyer('Escape')
    expect(dialogues()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir B' }))
    expect(screen.getByText('Formulaire B')).toBeTruthy()

    await act(async () => {
      terminerA(undefined)
    })
    expect(dialogues()).toHaveLength(1)
    expect(screen.getByText('Formulaire B')).toBeTruthy()
    expect(screen.getByText('A enregistré')).toBeTruthy()
  })

  it('la garde est propre au formulaire soumis : un autre formulaire se soumet pendant l’attente du premier', async () => {
    let terminerA: (resultat: unknown) => void = () => {}
    const onSubmitA = vi.fn(
      () =>
        new Promise<unknown>((resoudre) => {
          terminerA = resoudre
        }),
    )
    const onSubmitB = vi.fn(() => 'ok')
    render(
      <ToastProvider>
        <DeclencheurFormulaire
          libelle="Ouvrir A"
          options={{ kind: 'form', title: 'Formulaire A', fields: champs, onSubmit: onSubmitA }}
        />
        <DeclencheurFormulaire
          libelle="Ouvrir B"
          options={{ kind: 'form', title: 'Formulaire B', fields: champs, onSubmit: onSubmitB, toast: { title: 'B enregistré' } }}
        />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir B' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    })
    expect(onSubmitB).toHaveBeenCalledTimes(1)
    expect(dialogues()).toHaveLength(0)
    expect(screen.getByText('B enregistré')).toBeTruthy()
    await act(async () => {
      terminerA(undefined)
    })
    expect(onSubmitA).toHaveBeenCalledTimes(1)
  })

  it('après un échec, la garde est levée : la fenêtre reste ouverte et un nouveau clic resoumet', async () => {
    const onSubmit = vi
      .fn<(valeurs: Record<string, string>) => Promise<string>>()
      .mockRejectedValueOnce(new Error('Base indisponible'))
      .mockResolvedValueOnce('ok')
    render(
      <ToastProvider>
        <DeclencheurFormulaire
          options={{ kind: 'form', title: 'Nouvelle copropriété', fields: champs, onSubmit, toast: { title: 'Copropriété créée' } }}
        />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    })
    expect(screen.getByText('Base indisponible')).toBeTruthy()
    expect(dialogues()).toHaveLength(1)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    })
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(dialogues()).toHaveLength(0)
    expect(screen.getByText('Copropriété créée')).toBeTruthy()
  })
})
