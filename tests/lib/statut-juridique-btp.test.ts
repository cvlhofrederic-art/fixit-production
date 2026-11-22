// Statut juridique du formulaire de devis et facture BTP (lib/statut-juridique-btp.ts). Le champ est
// verrouillé, « défini à l'inscription ». Un document déjà enregistré (brouillon ou émis) garde exactement le
// sien, car le formulaire réenregistre un brouillon dès son ouverture ; un nouveau document, même tiré d'un
// ancien, prend la forme du profil. Exception : une société portugaise ne garde jamais une forme française.

import { describe, it, expect } from 'vitest'
import { getStatusLabel, mapLegalFormToCode } from '@/lib/devis-utils'
import {
  appliquerFormeProfil, assuranceDocumentBtp, codeStatutJuridiqueBtp, couvertureAssuranceBtp, documentEmis, documentExistant, mentionIdentificationBtp,
  mediateurDocumentBtp, statutAvecCapitalSocial, statutJuridiqueDocumentBtp, statutJuridiqueInitialBtp, statutPortugais,
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

  // Demande de Frédéric du 20/11/2026 : les orçamentos d'une société portugaise émis le 17/11 avant le correctif des
  // formes portugaises portent encore « Entreprise Individuelle (EI) » à l'ouverture.
  it('société portugaise : un document déjà enregistré en EI (brouillon ou émis) prend sa forme du profil', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, savedAt: '2026-11-17T18:00:00.000Z' }, LDA)).toBe(LDA)
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, id: 'devis-1', docNumber: 'DEV-2026-001' }, LDA)).toBe(LDA)
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, docNumber: 'DEV-2026-003' }, 'sociedade por quotas')).toBe(LDA)
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, docNumber: 'DEV-2026-003' }, 'Empresário em Nome Individual')).toBe(ENI)
    expect(statutJuridiqueInitialBtp({ companyStatus: 'SA', docNumber: 'DEV-2026-003' }, 'SA (Portugal)')).toBe(SA_PT)
  })

  it('société portugaise : un document déjà enregistré avec une forme portugaise garde la sienne', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: SA_PT, docNumber: 'DEV-2026-004' }, LDA)).toBe(SA_PT)
    expect(statutJuridiqueInitialBtp({ companyStatus: UNIPESSOAL, savedAt: '2026-11-20T08:00:00.000Z' }, LDA)).toBe(UNIPESSOAL)
  })

  describe('statutJuridiqueDocumentBtp (formulaire et téléchargement d\'un document enregistré)', () => {
    it('société française ou forme inconnue : la forme du document, exactement', () => {
      for (const forme of ['SAS', 'SARL', 'Société anonyme', 'Entrepreneur individuel', '', null, undefined]) {
        for (const statut of [EI, 'SARL', 'SAS', 'Auto-entrepreneur', '']) expect(statutJuridiqueDocumentBtp(statut, forme)).toBe(statut)
        expect(statutJuridiqueDocumentBtp(undefined, forme)).toBe('')
      }
    })

    it('société portugaise : forme française (ou absente) du document remplacée par celle du profil', () => {
      for (const statut of [EI, 'SARL', 'SAS', 'SA', 'Auto-entrepreneur', '', undefined, null]) {
        expect(statutJuridiqueDocumentBtp(statut, LDA)).toBe(LDA)
      }
      expect(codeStatutJuridiqueBtp(statutJuridiqueDocumentBtp(EI, LDA))).toBe('lda')
    })

    it('société portugaise : forme portugaise du document gardée', () => {
      expect(statutJuridiqueDocumentBtp(SA_PT, LDA)).toBe(SA_PT)
      expect(statutJuridiqueDocumentBtp(ENI, UNIPESSOAL)).toBe(ENI)
    })
  })

  describe('couvertureAssuranceBtp', () => {
    it('société portugaise : « France métropolitaine », défaut de la fiche, n\'est jamais sa couverture', () => {
      for (const couverture of ['France métropolitaine', 'France metropolitaine', 'FRANCE MÉTROPOLITAINE', ' France  métropolitaine ']) {
        expect(couvertureAssuranceBtp(couverture, LDA)).toBe('')
      }
    })

    it('société portugaise : toute autre couverture est gardée telle quelle', () => {
      for (const couverture of ['Portugal', 'Portugal continental', 'Portugal e França', 'France métropolitaine et Portugal']) {
        expect(couvertureAssuranceBtp(couverture, LDA)).toBe(couverture)
      }
      expect(couvertureAssuranceBtp(undefined, LDA)).toBe('')
      expect(couvertureAssuranceBtp(null, LDA)).toBe('')
    })

    it('société française ou sans forme : la valeur enregistrée, exactement', () => {
      for (const forme of ['SAS', 'Entrepreneur individuel', '', undefined]) {
        for (const couverture of ['France métropolitaine', 'France metropolitaine', ' France ', '']) {
          expect(couvertureAssuranceBtp(couverture, forme)).toBe(couverture)
        }
        expect(couvertureAssuranceBtp(undefined, forme)).toBe('')
      }
    })
  })

  // Demande de Frédéric du 21/11/2026 : un orçamento d'une société portugaise enregistré sans assureur se téléchargeait
  // depuis la liste sans assurance, alors que le formulaire reprend l'assureur de la fiche à l'ouverture.
  describe('assuranceDocumentBtp (téléchargement depuis la liste)', () => {
    const FICHE = {
      legal_form: LDA, insurance_name: 'Seguradora Exemplo', insurance_number: 'RC-2026-000123',
      insurance_type: 'rc_pro', insurance_coverage: 'Portugal',
    }
    const SANS_ASSURANCE = { insuranceName: '', insuranceNumber: '', insuranceType: 'rc_pro' }
    const DE_LA_FICHE = { insuranceName: 'Seguradora Exemplo', insuranceNumber: 'RC-2026-000123', insuranceType: 'rc_pro', insuranceCoverage: 'Portugal' }

    it('société portugaise, document sans nom d\'assureur : nom et numéro de la fiche, avec sa couverture', () => {
      // Un numéro de police seul n'est jamais imprimé : il cède la place à l'assureur de la fiche
      const sansNom = [{}, { insuranceName: '', insuranceNumber: '' }, { insuranceName: ' ', insuranceNumber: null, insuranceCoverage: 'France metropolitaine' }, { insuranceNumber: 'AP-0000-0001' }]
      for (const sansAssureur of sansNom) expect(assuranceDocumentBtp(sansAssureur, FICHE)).toEqual(DE_LA_FICHE)
      expect(assuranceDocumentBtp({}, { ...FICHE, insurance_name: '  Seguradora Exemplo ', insurance_number: ' RC-2026-000123 ' })).toEqual(DE_LA_FICHE)
      expect(assuranceDocumentBtp({}, { ...FICHE, insurance_number: null })).toEqual({ ...DE_LA_FICHE, insuranceNumber: '' })
    })

    it('société portugaise, document sans nom d\'assureur : type du document d\'abord, puis celui de la fiche', () => {
      expect(assuranceDocumentBtp({ insuranceType: 'decennale' }, { ...FICHE, insurance_type: 'both' }).insuranceType).toBe('decennale')
      for (const type of ['decennale', 'both']) expect(assuranceDocumentBtp({}, { ...FICHE, insurance_type: type }).insuranceType).toBe(type)
      expect(assuranceDocumentBtp({}, { ...FICHE, insurance_type: 'inconnu' }).insuranceType).toBe('rc_pro')
    })

    it('société portugaise, document avec un nom d\'assureur : le sien, numéro compris, jamais celui de la fiche', () => {
      expect(assuranceDocumentBtp({ insuranceName: 'Outra Seguradora', insuranceCoverage: 'Portugal e Espanha' }, FICHE))
        .toEqual({ ...SANS_ASSURANCE, insuranceName: 'Outra Seguradora', insuranceCoverage: 'Portugal e Espanha' })
      expect(assuranceDocumentBtp({ insuranceName: 'Outra Seguradora', insuranceNumber: 'AP-0000-0001' }, FICHE))
        .toEqual({ ...SANS_ASSURANCE, insuranceName: 'Outra Seguradora', insuranceNumber: 'AP-0000-0001', insuranceCoverage: 'Portugal' })
    })

    it('société portugaise : couverture du document, sinon de la fiche, sinon « Portugal continental »', () => {
      expect(assuranceDocumentBtp({ insuranceCoverage: 'France métropolitaine' }, { legal_form: LDA }).insuranceCoverage).toBe('Portugal continental')
      expect(assuranceDocumentBtp({}, { legal_form: LDA, insurance_coverage: 'France metropolitaine' }).insuranceCoverage).toBe('Portugal continental')
      expect(assuranceDocumentBtp({}, { legal_form: LDA, insurance_coverage: 'Portugal' }).insuranceCoverage).toBe('Portugal')
    })

    it('société portugaise sans nom d\'assureur en fiche : document tel quel, couverture portugaise', () => {
      expect(assuranceDocumentBtp({}, { legal_form: LDA, insurance_name: ' ', insurance_number: 'RC-2026-000123' }))
        .toEqual({ ...SANS_ASSURANCE, insuranceCoverage: 'Portugal continental' })
    })

    it('société française ou sans forme : le document exactement, jamais la fiche', () => {
      const duDocument = { insuranceName: 'Assureur', insuranceNumber: 'P-1', insuranceType: 'decennale' as const, insuranceCoverage: 'France metropolitaine' }
      for (const legal_form of ['SAS', 'Entrepreneur individuel', '', null, undefined]) {
        expect(assuranceDocumentBtp({}, { ...FICHE, legal_form })).toEqual({ ...SANS_ASSURANCE, insuranceCoverage: '' })
        expect(assuranceDocumentBtp(duDocument, { ...FICHE, legal_form })).toEqual(duDocument)
      }
    })
  })

  // Demande de Frédéric du 22/11/2026 : le médiateur de la consommation de la fiche, comme l'assureur
  describe('mediateurDocumentBtp (téléchargement depuis la liste)', () => {
    const FICHE_RAL = { legal_form: LDA, mediator_name: 'Centro de Arbitragem Exemplo', mediator_url: 'https://arbitragem.exemplo.pt' }
    const DE_LA_FICHE_RAL = { mediatorName: 'Centro de Arbitragem Exemplo', mediatorUrl: 'https://arbitragem.exemplo.pt' }

    it('société portugaise, document sans nom de médiateur : nom et adresse de la fiche', () => {
      for (const sansMediateur of [{}, { mediatorName: '', mediatorUrl: '' }, { mediatorName: ' ', mediatorUrl: 'https://autre.exemplo.pt' }]) {
        expect(mediateurDocumentBtp(sansMediateur, FICHE_RAL)).toEqual(DE_LA_FICHE_RAL)
      }
      expect(mediateurDocumentBtp({}, { ...FICHE_RAL, mediator_name: '  Centro de Arbitragem Exemplo ', mediator_url: null }))
        .toEqual({ ...DE_LA_FICHE_RAL, mediatorUrl: '' })
      expect(mediateurDocumentBtp({}, { ...FICHE_RAL, mediator_url: ' https://arbitragem.exemplo.pt ' })).toEqual(DE_LA_FICHE_RAL)
      // Nom de la fiche, jamais avec l'adresse restée seule dans le document
      expect(mediateurDocumentBtp({ mediatorName: '', mediatorUrl: 'https://doc.exemplo.test' }, { ...FICHE_RAL, mediator_url: null }))
        .toEqual({ ...DE_LA_FICHE_RAL, mediatorUrl: '' })
    })

    it('société portugaise, document qui nomme un médiateur : le sien, adresse comprise', () => {
      expect(mediateurDocumentBtp({ mediatorName: 'Outro Centro' }, FICHE_RAL)).toEqual({ mediatorName: 'Outro Centro', mediatorUrl: '' })
    })

    it('société portugaise sans médiateur en fiche, société française ou sans forme : le document exactement', () => {
      expect(mediateurDocumentBtp({}, { legal_form: LDA, mediator_name: ' ', mediator_url: 'https://arbitragem.exemplo.pt' }))
        .toEqual({ mediatorName: '', mediatorUrl: '' })
      for (const legal_form of ['SAS', 'Entrepreneur individuel', '', null, undefined]) {
        expect(mediateurDocumentBtp({}, { ...FICHE_RAL, legal_form })).toEqual({ mediatorName: '', mediatorUrl: '' })
        expect(mediateurDocumentBtp({ mediatorName: 'Médiateur', mediatorUrl: 'https://m.test' }, { ...FICHE_RAL, legal_form }))
          .toEqual({ mediatorName: 'Médiateur', mediatorUrl: 'https://m.test' })
        expect(mediateurDocumentBtp({ mediatorName: ' ' }, { ...FICHE_RAL, legal_form })).toEqual({ mediatorName: ' ', mediatorUrl: '' })
      }
    })
  })

  it('facture ou acompte émis en un clic : forme portugaise du profil', () => {
    expect(appliquerFormeProfil({ companyStatus: EI, docType: 'facture' }, 'Sociedade por Quotas (Lda.)'))
      .toEqual({ companyStatus: LDA, docType: 'facture' })
  })

  it('facture ou acompte en un clic d\'une société portugaise : « France métropolitaine » du devis retirée, autre couverture gardée', () => {
    expect(appliquerFormeProfil({ companyStatus: EI, insuranceCoverage: 'France metropolitaine', docType: 'facture' }, LDA))
      .toEqual({ companyStatus: LDA, insuranceCoverage: '', docType: 'facture' })
    expect(appliquerFormeProfil({ companyStatus: EI, insuranceCoverage: 'Portugal', docType: 'facture' }, LDA))
      .toEqual({ companyStatus: LDA, insuranceCoverage: 'Portugal', docType: 'facture' })
  })

  it('facture en un clic d\'une société française : couverture du devis gardée', () => {
    expect(appliquerFormeProfil({ companyStatus: EI, insuranceCoverage: 'France métropolitaine', docType: 'facture' }, 'SAS'))
      .toEqual({ companyStatus: 'SAS', insuranceCoverage: 'France métropolitaine', docType: 'facture' })
  })
})
