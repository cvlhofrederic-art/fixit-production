// Statut juridique du formulaire de devis et facture BTP (lib/statut-juridique-btp.ts). Le champ est
// verrouillé, « défini à l'inscription ». Un document déjà enregistré (brouillon ou émis) garde exactement le
// sien, car le formulaire réenregistre un brouillon dès son ouverture ; un nouveau document, même tiré d'un
// ancien, prend la forme du profil.

import { describe, it, expect } from 'vitest'
import { getStatusLabel, mapLegalFormToCode } from '@/lib/devis-utils'
import {
  appliquerFormeProfil, codeStatutJuridiqueBtp, documentEmis, documentExistant, mentionIdentificationBtp, statutAvecCapitalSocial,
  statutJuridiqueInitialBtp, statutPortugais,
} from '@/lib/statut-juridique-btp'

const EI = 'Entreprise Individuelle (EI)'

describe('documentEmis', () => {
  it.each([
    ['FACT-2026-014', true],
    ['DEV-2026-003', true],
    ['AV-2026-001', true],
    ['BR-2026-007', false],
    ['br-2026-007', false],
    ['', false],
    [undefined, false],
  ])('%s → %s', (numero, attendu) => {
    expect(documentEmis(numero)).toBe(attendu)
  })
})

describe('documentExistant', () => {
  it('brouillon enregistré, document émis ou document identifié : existant', () => {
    expect(documentExistant({ savedAt: '2026-11-09T20:00:00.000Z' })).toBe(true)
    expect(documentExistant({ id: 'a1b2c3' })).toBe(true)
    expect(documentExistant({ docNumber: 'FACT-2026-014' })).toBe(true)
  })

  it('document tiré d\'un autre (sans identifiant, horodatage ni numéro légal) ou nouveau : pas existant', () => {
    expect(documentExistant({ docNumber: '', companyStatus: EI } as never)).toBe(false)
    expect(documentExistant({ docNumber: 'BR-2026-002' })).toBe(false)
    expect(documentExistant(undefined)).toBe(false)
  })

  it('duplicata BTP : nouvel identifiant marqué isDuplicate, pas encore enregistré, donc neuf', () => {
    expect(documentExistant({ id: '6f1c2a34-0000-4000-8000-0000000000d2', isDuplicate: true })).toBe(false)
  })
})

describe('appliquerFormeProfil (facture totale et acompte émis en un clic)', () => {
  it('pose la forme du profil au jour de l\'émission, à la place de celle recopiée du devis', () => {
    expect(appliquerFormeProfil({ companyStatus: EI, docType: 'facture' }, 'SAS')).toEqual({ companyStatus: 'SAS', docType: 'facture' })
  })

  it('garde la forme du devis quand le profil n\'en a pas', () => {
    const payload = { companyStatus: EI, docType: 'facture' }
    expect(appliquerFormeProfil(payload, '')).toBe(payload)
    expect(appliquerFormeProfil(payload, null)).toBe(payload)
  })
})

describe('statutJuridiqueInitialBtp', () => {
  it('prend la forme du profil pour un nouveau document', () => {
    expect(statutJuridiqueInitialBtp(undefined, 'SAS')).toBe('SAS')
    expect(statutJuridiqueInitialBtp(undefined, 'Société à responsabilité limitée')).toBe('SARL')
  })

  it('prend la forme du profil pour un document tiré d\'un autre resté en EI (avoir, duplicata)', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, id: '6f1c2a34-0000-4000-8000-0000000000d2', isDuplicate: true }, 'SAS')).toBe('SAS')
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, docNumber: '' }, 'SAS')).toBe('SAS')
    expect(statutJuridiqueInitialBtp({ companyStatus: EI }, 'SAS')).toBe('SAS')
  })

  it('ne modifie jamais un brouillon déjà enregistré', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, savedAt: '2026-11-09T20:00:00.000Z' }, 'SAS')).toBe(EI)
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, id: 'brouillon-1', docNumber: 'BR-2026-002' }, 'SAS')).toBe(EI)
  })

  it('garde la forme figée d\'un document déjà émis', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, docNumber: 'FACT-2026-014' }, 'SAS')).toBe(EI)
  })

  it('garde la forme du document quand le profil n\'en a pas', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: 'SARL', docNumber: '' }, '')).toBe('SARL')
    expect(statutJuridiqueInitialBtp({ companyStatus: 'SARL' }, null)).toBe('SARL')
  })

  it('retombe sur EI sans forme au profil ni au document, comme avant', () => {
    expect(statutJuridiqueInitialBtp(undefined, undefined)).toBe(EI)
    expect(statutJuridiqueInitialBtp({ docNumber: '' }, '  ')).toBe(EI)
  })

  it('rend « Entreprise Individuelle (EI) » pour un entrepreneur individuel', () => {
    expect(statutJuridiqueInitialBtp(undefined, 'Entrepreneur individuel')).toBe(EI)
  })
})

// Société portugaise inscrite comme société BTP (Method Soluções, 17/11/2026) : « Sociedade por Quotas (Lda.) »
// s'affichait « Entreprise Individuelle (EI) », mapLegalFormToCode ne connaissant aucune forme portugaise.
describe('formes juridiques portugaises', () => {
  const LDA = 'Sociedade por Quotas (Lda.)'
  const UNIPESSOAL = 'Sociedade Unipessoal por Quotas (Unipessoal Lda.)'
  const SA_PT = 'Sociedade Anónima (SA)'
  const ENI = 'Empresário em Nome Individual (ENI)'

  it.each([
    ['Sociedade por Quotas (Lda.)', LDA],
    ['sociedade por quotas', LDA],
    ['SOCIEDADE POR QUOTAS', LDA],
    ['LDA (Sociedade por Quotas)', LDA],
    ['Lda', LDA],
    ['Lda.', LDA],
    ['Sociedade Unipessoal por Quotas', UNIPESSOAL],
    ['Unipessoal Lda.', UNIPESSOAL],
    ['LDA Unipessoal', UNIPESSOAL],
    ['Sociedade Anónima (SA)', SA_PT],
    ['sociedade anonima', SA_PT],
    ['SA (Portugal)', SA_PT],
    ['Empresário em Nome Individual (ENI)', ENI],
    ['ENI (Empresário em Nome Individual)', ENI],
    // Autres formes de l'inscription portugaise (libellés portugais et français de lib/config/companyTypes.ts)
    ['Estabelecimento Individual de Responsabilidade Limitada', 'Estabelecimento Individual de Responsabilidade Limitada (EIRL)'],
    ['EIRL (Portugal)', 'Estabelecimento Individual de Responsabilidade Limitada (EIRL)'],
    ['Sociedade em Nome Coletivo', 'Sociedade em Nome Coletivo'],
    ['SNC (Portugal)', 'Sociedade em Nome Coletivo'],
    ['Sociedade em Comandita', 'Sociedade em Comandita'],
    ['Cooperativa', 'Cooperativa'],
    ['Coopérative (Portugal)', 'Cooperativa'],
  ])('profil « %s » : nouveau document en « %s », jamais en EI', (profil, attendu) => {
    expect(statutJuridiqueInitialBtp(undefined, profil)).toBe(attendu)
  })

  it('les formes françaises donnent exactement le libellé d\'avant', () => {
    for (const forme of ['SAS', 'SASU', 'SARL', 'EURL', 'SA', 'Société anonyme', 'Société à responsabilité limitée',
      'Société par actions simplifiée', 'Entreprise individuelle', 'Entrepreneur individuel', 'Auto-entrepreneur',
      'SNC', 'SCI', 'SARL (França)', 'SA à directoire', 'EIRL', 'Société en commandite simple', 'Société coopérative',
      'SCOP', 'Entrepreneur individuel à responsabilité limitée']) {
      expect(statutPortugais(forme)).toBe(false)
    }
    expect(statutJuridiqueInitialBtp(undefined, 'Société anonyme')).toBe('SA')
    expect(statutJuridiqueInitialBtp(undefined, 'SARL (França)')).toBe('SARL')
  })

  it('code du PDF : forme portugaise reconnue, libellés français inchangés', () => {
    expect(codeStatutJuridiqueBtp(LDA)).toBe('lda')
    expect(codeStatutJuridiqueBtp(UNIPESSOAL)).toBe('unipessoal')
    expect(codeStatutJuridiqueBtp(SA_PT)).toBe('sa')
    expect(codeStatutJuridiqueBtp(ENI)).toBe('eni')
    for (const libelle of ['Entreprise Individuelle (EI)', 'EURL', 'SARL', 'SAS', 'SASU', 'SA', 'Auto-entrepreneur', '', 'Société anonyme']) {
      expect(codeStatutJuridiqueBtp(libelle)).toBe(mapLegalFormToCode(libelle))
    }
    expect(codeStatutJuridiqueBtp(undefined)).toBe('ei')
  })

  it('capital social exigé : mêmes libellés français qu\'avant, plus les sociétés portugaises par quotas et anonymes', () => {
    for (const libelle of ['SARL', 'EURL', 'SAS', 'SASU', 'SA', LDA, UNIPESSOAL, SA_PT]) expect(statutAvecCapitalSocial(libelle)).toBe(true)
    for (const libelle of ['Entreprise Individuelle (EI)', 'Auto-entrepreneur', ENI, '', 'Société par actions simplifiée',
      'Sociedade em Nome Coletivo', 'Sociedade em Comandita', 'Cooperativa', 'Estabelecimento Individual de Responsabilidade Limitada (EIRL)']) {
      expect(statutAvecCapitalSocial(libelle)).toBe(false)
    }
  })

  it('codes PDF des autres formes portugaises : libellé connu de getStatusLabel, jamais le code brut', () => {
    expect(codeStatutJuridiqueBtp('Sociedade em Nome Coletivo')).toBe('snc_pt')
    expect(codeStatutJuridiqueBtp('Sociedade em Comandita')).toBe('comandita')
    expect(codeStatutJuridiqueBtp('Cooperativa')).toBe('cooperativa')
    expect(codeStatutJuridiqueBtp('Estabelecimento Individual de Responsabilidade Limitada (EIRL)')).toBe('eirl_pt')
    for (const code of ['snc_pt', 'comandita', 'cooperativa', 'eirl_pt', 'lda', 'unipessoal', 'eni']) {
      expect(getStatusLabel(code)).not.toBe(code)
    }
  })

  describe('mention d\'identification (bloc des mentions légales du formulaire)', () => {
    const base = { capital: '', registre: '', adresse: 'Rua Direita 10, 4990-000 Ponte de Lima' }
    it('sur /pt : société à capital, autre société, entrepreneur individuel', () => {
      expect(mentionIdentificationBtp({ ...base, statut: LDA, capital: '5 000', registre: 'Alvará IMPIC n.º 12345', langue: 'pt' }))
        .toBe(`${LDA} com capital social de 5 000 € — Alvará IMPIC n.º 12345. Sede: Rua Direita 10, 4990-000 Ponte de Lima.`)
      expect(mentionIdentificationBtp({ ...base, statut: 'SARL', adresse: '', langue: 'pt' }))
        .toBe('SARL com capital social de [capital a indicar] €. Sede: [morada a indicar].')
      expect(mentionIdentificationBtp({ ...base, statut: 'Cooperativa', langue: 'pt' })).toBe('Cooperativa. Sede: Rua Direita 10, 4990-000 Ponte de Lima.')
      for (const statut of [ENI, EI, 'Auto-entrepreneur']) {
        expect(mentionIdentificationBtp({ ...base, statut, langue: 'pt' })).toBe('Empresário em Nome Individual (ENI) — Código Comercial Português.')
      }
    })
    it('sur /fr : seulement pour une forme portugaise (les mentions françaises d\'origine restent au formulaire)', () => {
      expect(mentionIdentificationBtp({ ...base, statut: LDA, langue: 'fr' }))
        .toBe(`${LDA} au capital de [capital à renseigner] €. Siège social : Rua Direita 10, 4990-000 Ponte de Lima.`)
      expect(mentionIdentificationBtp({ ...base, statut: ENI, registre: ' ', langue: 'fr' })).toBe(`${ENI}. Siège social : Rua Direita 10, 4990-000 Ponte de Lima.`)
      for (const statut of ['SARL', 'SAS', 'SA', EI, 'Auto-entrepreneur']) expect(mentionIdentificationBtp({ ...base, statut, langue: 'fr' })).toBeNull()
    })
  })

  it('un brouillon déjà enregistré en EI le reste, même pour une société par quotas', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, savedAt: '2026-11-17T18:00:00.000Z' }, LDA)).toBe(EI)
  })

  it('facture ou acompte émis en un clic : forme portugaise du profil', () => {
    expect(appliquerFormeProfil({ companyStatus: EI, docType: 'facture' }, 'Sociedade por Quotas (Lda.)'))
      .toEqual({ companyStatus: LDA, docType: 'facture' })
  })
})
