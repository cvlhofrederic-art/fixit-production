import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlfredoStatusBadge } from '@/components/syndic-dashboard/agents-ia/alfredo/AlfredoStatusBadge'

describe('AlfredoStatusBadge', () => {
  it('affiche "Boîte non connectée" quand connected=false', () => {
    render(<AlfredoStatusBadge connected={false} draftsPending={0} emailsAnalysed={0} locale="fr" />)
    expect(screen.getByText(/Boîte non connectée/i)).toBeDefined()
  })

  it('affiche "Boîte connectée · 0 email en attente" quand connecté sans drafts', () => {
    render(<AlfredoStatusBadge connected={true} draftsPending={0} emailsAnalysed={42} locale="fr" />)
    expect(screen.getByText(/Boîte connectée/i)).toBeDefined()
    expect(screen.getByText(/0 email en attente/i)).toBeDefined()
  })

  it('affiche "N brouillons à valider" quand drafts > 0', () => {
    render(<AlfredoStatusBadge connected={true} draftsPending={5} emailsAnalysed={42} locale="fr" />)
    expect(screen.getByText(/5 brouillons à valider/i)).toBeDefined()
    expect(screen.getByText(/42 emails analysés/i)).toBeDefined()
  })

  it('rend en portugais quand locale=pt', () => {
    render(<AlfredoStatusBadge connected={false} draftsPending={0} emailsAnalysed={0} locale="pt" />)
    expect(screen.getByText(/Caixa não ligada/i)).toBeDefined()
  })
})
