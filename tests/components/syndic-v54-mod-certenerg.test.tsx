import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import ModCertEnerg from '@/components/syndic-dashboard/v54/modules/ModCertEnerg'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { CertEnergetico } from '@/lib/syndic/v54/api'

/** Étape d (batch d41) — ModCertEnerg : rendu byte-exact + ouverture du modal (stateful).
 *  Phase 3 slice 13 — certificats SCE réels + écriture POST. */

afterEach(cleanup)

const cert = (over: Partial<CertEnergetico>): CertEnergetico => ({
  id: 'ce1', numero: 'SCE-2026-001', edificio: 'Edifício Aurora', perito: 'Eng. Costa',
  classe: 'B', dataEmissao: '2026-01-15', dataValidade: '2036-01-15', notas: '',
  ...over,
})

describe('ModCertEnerg', () => {
  it('rend l\'état vide, l\'alerte SCE et les KPIs', () => {
    render(<ModCertEnerg />)
    expect(screen.getByRole('heading', { name: 'Certificação Energética', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Sistema de Certificação Energética (SCE) — DL 101-D/2020')).toBeInTheDocument()
    expect(screen.getByText('Nenhum certificado registado')).toBeInTheDocument()
    expect(screen.getByText('Certificados')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Adicionar certificado »', () => {
    render(<ModCertEnerg />)
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar certificado/ })[0])
    expect(screen.getByText('Adicionar certificado energético')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nº certificado/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Edifício/)).toBeInTheDocument()
  })

  it('Phase 3 : affiche les certificats réels quand authentifié', () => {
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [],
      certificados: [cert({ numero: 'SCE-REAL-77' })],
    }
    render(<SyndicDataContext.Provider value={d}><ModCertEnerg /></SyndicDataContext.Provider>)
    expect(screen.getByText('SCE-REAL-77')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum certificado registado')).toBeNull()
  })

  it('Phase 3 écriture : « + Adicionar certificado » → POST /api/syndic/cert-energ + refresh', async () => {
    const refresh = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ certificado: {} }), { status: 200 }))
    const d: SyndicData = {
      authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [],
      certificados: [], token: 'tok-ce', refresh,
    }
    render(<SyndicDataContext.Provider value={d}><ModCertEnerg /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar certificado/ })[0])
    fireEvent.change(screen.getByPlaceholderText('SCE-2026-…'), { target: { value: 'SCE-2026-999' } })
    fireEvent.change(screen.getByPlaceholderText(/Residência Os Pinheiros/), { target: { value: 'Edifício Teste SCE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registar' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/cert-energ', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse((fetchSpy.mock.calls.find(c => c[0] === '/api/syndic/cert-energ')![1] as RequestInit).body as string)
    expect(body).toMatchObject({ numero: 'SCE-2026-999', edificio: 'Edifício Teste SCE' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    vi.restoreAllMocks()
  })
})
