// Formes juridiques portugaises (lib/formes-juridiques-portugaises.ts), communes au formulaire de devis BTP et au
// formulaire artisan. Demande de Frédéric du 22/11/2026 : côté artisan aussi, une forme portugaise ne devient plus
// « Entreprise Individuelle (EI) ». Les formes françaises donnent exactement le code d'avant.
import { describe, it, expect } from 'vitest'
import { mapLegalFormToCode } from '@/lib/devis-utils'
import { codeFormeJuridique, formePortugaise } from '@/lib/formes-juridiques-portugaises'

describe('codeFormeJuridique', () => {
  // Formes portugaises reconnues, par code interne (abréviations à points comprises)
  const FORMES_PAR_CODE: Record<string, string[]> = {
    lda: ['Sociedade por Quotas (Lda.)', 'sociedade por quotas', 'L.da'],
    unipessoal: ['Unipessoal Lda.', 'Sociedade Unipessoal por Quotas'],
    sa: ['Sociedade Anónima (SA)'],
    eni: ['Empresário em Nome Individual (ENI)', 'ENI', 'E.N.I.'],
    eirl_pt: ['Estabelecimento Individual de Responsabilidade Limitada'],
    snc_pt: ['Sociedade em Nome Coletivo'],
    cooperativa: ['Cooperativa'],
  }

  it.each(Object.entries(FORMES_PAR_CODE))('code %s : formes portugaises %j', (code, formes) => {
    for (const forme of formes) expect(codeFormeJuridique(forme)).toBe(code)
  })

  it('formes françaises, vides ou inconnues : le code de mapLegalFormToCode, exactement', () => {
    const formes = ['SARL', 'SAS', 'SASU', 'EURL', 'SA', 'Société anonyme', 'Entreprise individuelle', 'Auto-entrepreneur',
      'Micro-entrepreneur', 'EIRL', 'SNC', 'Société coopérative', 'Entreprise Individuelle (EI)', 'Forme inconnue', '']
    for (const forme of formes) expect(codeFormeJuridique(forme)).toBe(mapLegalFormToCode(forme))
    expect(codeFormeJuridique(null)).toBe('ei')
    expect(codeFormeJuridique(undefined)).toBe('ei')
  })

  it('formePortugaise : rien pour une forme française', () => {
    for (const forme of ['SARL', 'EIRL', 'SNC', 'Société coopérative', 'Entreprise Individuelle (EI)']) {
      expect(formePortugaise(forme)).toBeUndefined()
    }
    expect(formePortugaise('Sociedade por Quotas (Lda.)')).toMatchObject({ code: 'lda', capital: true })
  })
})
