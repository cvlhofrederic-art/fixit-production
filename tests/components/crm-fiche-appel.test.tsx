// CRM du secrétariat, fiche « Appel en cours » (components/crm/FicheAppel.tsx).
// Constat de la relecture du 22/11/2026 : quand le numéro passait d'un client connu à un autre numéro, la fiche du
// premier restait retenue pendant la recherche (ou après son échec) et la demande partait sur le MAUVAIS client.
// Désormais : fiche oubliée dès que le numéro change, et contact_id envoyé seulement pour la fiche du numéro saisi.
// Numéros et noms fictifs.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { FicheAppel } from '@/components/crm/FicheAppel'
import { TEXTES_CRM } from '@/lib/crm/libelles'

const h = vi.hoisted(() => ({
  api: { contactParTelephone: vi.fn(), creerDemande: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/crm/api-crm', () => ({ apiCrm: h.api, ErreurApiCrm: class extends Error {} }))
vi.mock('sonner', () => ({ toast: h.toast }))

const NUMERO_MARIA = '+351912345678'
const MARIA = { id: 'id-maria', nom: 'Maria', telephone: NUMERO_MARIA, email: null, ville: '', langue: 'pt', notes: '', created_at: '', updated_at: '' }

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

function rendre(rechercheAutreNumero: () => Promise<unknown> = () => Promise.resolve({ trouve: null })) {
  vi.useFakeTimers()
  h.api.contactParTelephone.mockImplementation((tel: string) =>
    tel === NUMERO_MARIA ? Promise.resolve({ telephone: tel, trouve: { contact: MARIA, nbDemandes: 2 } }) : rechercheAutreNumero(),
  )
  h.api.creerDemande.mockResolvedValue({ demande: { id: 'd1', numero: 1 } })
  const onCreee = vi.fn()
  render(<FicheAppel textes={TEXTES_CRM.fr} signalNouvelAppel={0} onCreee={onCreee} />)
  return { numero: screen.getByLabelText('Numéro'), onCreee }
}

async function attendreRecherche() {
  await act(async () => {
    vi.advanceTimersByTime(450)
  })
  await act(async () => {})
}

async function saisirEtCreer() {
  fireEvent.click(screen.getByRole('button', { name: 'Info' }))
  fireEvent.change(screen.getByLabelText('Sujet'), { target: { value: 'Question' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Créer la demande' }))
  })
}

describe('FicheAppel', () => {
  it('client connu : la demande part sur sa fiche', async () => {
    const { numero, onCreee } = rendre()
    fireEvent.change(numero, { target: { value: '912 345 678' } })
    await attendreRecherche()
    expect(screen.getByText('Client connu : Maria · 2 demandes')).toBeInTheDocument()
    await saisirEtCreer()
    expect(h.api.creerDemande).toHaveBeenCalledTimes(1)
    expect(h.api.creerDemande.mock.calls[0][0]).toMatchObject({ contact_id: 'id-maria', motif: 'info', canal: 'appel', titre: 'Question' })
    expect(h.api.creerDemande.mock.calls[0][0]).not.toHaveProperty('telephone')
    expect(onCreee).toHaveBeenCalledTimes(1)
  })

  it('numéro corrigé puis validé pendant la recherche : jamais la fiche de l’ancien numéro', async () => {
    const { numero } = rendre(() => new Promise(() => {}))
    fireEvent.change(numero, { target: { value: '912345678' } })
    await attendreRecherche()
    fireEvent.change(numero, { target: { value: '912345679' } })
    expect(screen.queryByText(/Client connu/)).not.toBeInTheDocument()
    await saisirEtCreer()
    const envoye = h.api.creerDemande.mock.calls[0][0]
    expect(envoye).not.toHaveProperty('contact_id')
    expect(envoye).toMatchObject({ telephone: '+351912345679' })
  })

  it('recherche du nouveau numéro en échec : message dédié, demande envoyée par numéro', async () => {
    const { numero } = rendre(() => Promise.reject(new Error('réseau')))
    fireEvent.change(numero, { target: { value: '912345678' } })
    await attendreRecherche()
    fireEvent.change(numero, { target: { value: '912345679' } })
    await attendreRecherche()
    expect(h.toast.error).toHaveBeenCalledWith(TEXTES_CRM.fr.fiche.rechercheImpossible)
    await saisirEtCreer()
    const envoye = h.api.creerDemande.mock.calls[0][0]
    expect(envoye).not.toHaveProperty('contact_id')
    expect(envoye).toMatchObject({ telephone: '+351912345679' })
  })

  it('numéro non reconnu ou motif absent : rien n’est envoyé, la raison s’affiche', async () => {
    const { numero } = rendre()
    fireEvent.change(numero, { target: { value: '12345' } })
    fireEvent.change(screen.getByLabelText('Sujet'), { target: { value: 'Question' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer la demande' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTES_CRM.fr.fiche.numeroInvalide)

    fireEvent.change(numero, { target: { value: '' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer la demande' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTES_CRM.fr.fiche.motifManquant)
    expect(h.api.creerDemande).not.toHaveBeenCalled()
    expect(h.api.contactParTelephone).not.toHaveBeenCalled()
  })
})
