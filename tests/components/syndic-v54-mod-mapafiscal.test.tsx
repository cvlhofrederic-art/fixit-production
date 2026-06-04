import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModMapaFiscal from '@/components/syndic-dashboard/v54/modules/ModMapaFiscal'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Contrato, FaturaCopro } from '@/lib/syndic/v54/api'

/** Étape d (batch d35) — ModMapaFiscal byte-exact + Phase 3 : rapport calculé depuis contratos/faturas. */

afterEach(cleanup)

const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [], contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] }, impayes: [], recouvrements: [], faturas: [],
})

const contrato = (over: Partial<Contrato>): Contrato => ({
  id: 'ct1', immeuble: 'Aurora', fornecedor: 'LimpoPro', categoria: 'limpezas', custoMensal: 500, custoAnual: 6000,
  dataInicio: '2026-01-01', dataFim: '2026-12-31', statut: 'ativo', notes: '',
  ...over,
})
const fatura = (over: Partial<FaturaCopro>): FaturaCopro => ({
  id: 'f1', coproprioId: '', immeubleId: '', numeroFatura: 'FT-1', emiseLe: '2026-02-01', echeance: '',
  montantHt: 1000, tvaTaux: 23, montantTtc: 1230, description: '', statut: 'a_regler', pdfUrl: '',
  ...over,
})

describe('ModMapaFiscal', () => {
  it('rend le titre, l\'alerte Max Expert et le tableau des catégories', () => {
    render(<ModMapaFiscal />)
    expect(screen.getByRole('heading', { name: 'Mapa Fiscal Anual', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Categorias fiscais — auto Max Expert')).toBeInTheDocument()
    expect(screen.getByText('Manutenção elevadores')).toBeInTheDocument()
    expect(screen.getByText('Outras despesas')).toBeInTheDocument()
  })

  it('Phase 3 : calcule les lignes depuis les contrats réels (catégories sans contrat masquées)', () => {
    const d: SyndicData = { ...base(), contratos: [contrato({ categoria: 'limpezas', custoAnual: 6000 })], faturas: [fatura({ montantTtc: 1230 })] }
    render(<SyndicDataContext.Provider value={d}><ModMapaFiscal /></SyndicDataContext.Provider>)
    expect(screen.getByText('Limpezas')).toBeInTheDocument()
    // Catégorie sans contrat réel → masquée (≠ preview byte-exact qui les montre toutes).
    expect(screen.queryByText('Manutenção elevadores')).toBeNull()
    cleanup()
  })
})
