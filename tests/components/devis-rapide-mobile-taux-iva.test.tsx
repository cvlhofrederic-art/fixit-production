// Devis rapide de l'appli mobile pro (components/pro-mobile/pages/MobileDocumentsSection.tsx), constat du 20/11/2026 :
// le formulaire s'ouvrait à 20 % sur /pt. Il s'ouvre au taux normal du pays : 23 % au Portugal, 20 % en France.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('@/lib/supabase', async () => (await import('../helpers/mocks-formulaires-devis')).supabaseNavigateur())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())

import MobileDocumentsSection from '@/components/pro-mobile/pages/MobileDocumentsSection'

function ouvrirDevisRapide(locale: 'fr' | 'pt') {
  const setDevisForm = vi.fn()
  const setShowDevisModal = vi.fn()
  render(
    <MobileDocumentsSection
      artisan={{ id: 'art-mobile-iva' }} bookings={[]} services={[]} serviceRanges={{}} completedBookings={[]}
      complianceDocs={[]} locale={locale} dateFmtLocale={locale === 'pt' ? 'pt-PT' : 'fr-FR'} t={(cle) => cle}
      isModuleEnabled={(module) => module === 'devis_rapide'}
      setMotifModal={vi.fn()} setShowDevisModal={setShowDevisModal} setShowComplianceModal={vi.fn()}
      deleteComplianceDoc={vi.fn()} copyComplianceProfile={vi.fn()} complianceCopied={false}
      setDevisForm={setDevisForm} setDevisGenere={vi.fn()} setOcrResult={vi.fn()} setComplianceForm={vi.fn()}
      ocrInputRef={{ current: null }} expiringCount={0}
    />,
  )
  return { setDevisForm, setShowDevisModal }
}

afterEach(() => cleanup())

describe('devis rapide de l\'appli : taux à l\'ouverture', () => {
  it('sur /pt : 23 %', () => {
    const { setDevisForm, setShowDevisModal } = ouvrirDevisRapide('pt')
    for (const bouton of [screen.getByText('+ Créer'), screen.getByText('📝 Nouveau devis')]) fireEvent.click(bouton)
    expect(setShowDevisModal).toHaveBeenCalledWith(true)
    expect(setDevisForm.mock.calls.map(([formulaire]) => formulaire.tva)).toEqual(['23', '23'])
  })

  it('en France : 20 % (inchangé)', () => {
    const { setDevisForm } = ouvrirDevisRapide('fr')
    fireEvent.click(screen.getByText('+ Créer'))
    expect(setDevisForm).toHaveBeenCalledWith(expect.objectContaining({ tva: '20', validite: '30' }))
  })
})
