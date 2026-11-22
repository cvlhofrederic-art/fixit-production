// Formes juridiques portugaises (lib/formes-juridiques-portugaises.ts), communes au formulaire de devis BTP et au
// formulaire artisan. Demande de Frédéric du 22/11/2026 : côté artisan aussi, une forme portugaise ne devient plus
// « Entreprise Individuelle (EI) ». Les formes françaises donnent exactement le code d'avant.
import { describe, it, expect } from 'vitest'
import { mapLegalFormToCode } from '@/lib/devis-utils'
import { codeFormeJuridique, formePortugaise } from '@/lib/formes-juridiques-portugaises'

describe('codeFormeJuridique', () => {
  it.each([
    ['Sociedade por Quotas (Lda.)', 'lda'],
    ['sociedade por quotas', 'lda'],
    ['Unipessoal Lda.', 'unipessoal'],
    ['Sociedade Unipessoal por Quotas', 'unipessoal'],
    ['Sociedade Anónima (SA)', 'sa'],
    ['Empresário em Nome Individual (ENI)', 'eni'],
    ['ENI', 'eni'],
    ['Estabelecimento Individual de Responsabilidade Limitada', 'eirl_pt'],
    ['Sociedade em Nome Coletivo', 'snc_pt'],
    ['Cooperativa', 'cooperativa'],
  ])('forme portugaise « %s » : %s', (forme, code) => {
    expect(codeFormeJuridique(forme)).toBe(code)
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
