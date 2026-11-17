// tests/lib/wallet-conformite-pt.test.ts
//
// Conformidade au Portugal (lib/wallet-conformite-pt.ts) : documents portugais à la place du jeu français
// (rapport i18n PT-PT du 17/11/2026). Les faits datés (validités de 4 mois, etc.) sont vérifiés dans l'en-tête du module.

import { describe, expect, it } from 'vitest'
import { caseDocumentDejaDepose, formeJuridiquePt, getWalletDocumentsPt } from '@/lib/wallet-conformite-pt'
import type { WalletDocConfig } from '@/lib/walletConformite'

const ids = (docs: WalletDocConfig[]) => docs.map(d => d.id)
const doc = (docs: WalletDocConfig[], id: string) => {
  const trouve = docs.find(d => d.id === id)
  if (!trouve) throw new Error(`document absent : ${id}`)
  return trouve
}

describe('formeJuridiquePt — forme juridique lue dans legal_form', () => {
  it.each([
    ['Lda', 'sociedade'],
    ['Sociedade por Quotas (Lda.)', 'sociedade'],
    ['Sociedade Unipessoal por Quotas', 'sociedade'],
    ['S.A.', 'sociedade'],
    ['Sociedade Anónima (SA)', 'sociedade'],
    ['Estabelecimento Individual de Responsabilidade Limitada', 'sociedade'],
    ['SARL', 'sociedade'],
    ['Empresário em Nome Individual (ENI)', 'individual'],
    ['Trabalhador independente', 'individual'],
    ['EI', 'individual'],
    ['Auto-entrepreneur', 'individual'],
    ['Entreprise individuelle', 'individual'],
    ['', 'inconnue'],
    [null, 'inconnue'],
    [undefined, 'inconnue'],
  ] as const)('%s → %s', (forme, attendu) => {
    expect(formeJuridiquePt(forme)).toBe(attendu)
  })
})

describe('getWalletDocumentsPt — société BTP', () => {
  const { docs, fallback } = getWalletDocumentsPt({ categories: [], legalForm: null, societeBtp: true })

  it('liste portugaise complète, sans métier à renseigner', () => {
    expect(ids(docs)).toEqual([
      'kbis', 'urssaf', 'attestation_fiscale', 'seguro_acidentes_trabalho', 'alvara_impic', 'rc_pro',
      'aptidao_medica', 'plano_seguranca_saude', 'statuts_societe',
    ])
    expect(fallback).toBe(false)
  })

  it('reprend les cases françaises pour leur équivalent portugais (un document déjà déposé reste à sa place)', () => {
    expect(doc(docs, 'kbis').nom).toBe('Certidão permanente do registo comercial')
    expect(doc(docs, 'urssaf').nom).toBe('Declaração de situação contributiva (Segurança Social)')
    expect(doc(docs, 'attestation_fiscale').nom).toBe('Certidão de situação tributária regularizada (Finanças)')
    expect(doc(docs, 'rc_pro').nom).toBe('Seguro de responsabilidade civil')
    expect(doc(docs, 'statuts_societe').nom).toBe('Pacto social (estatutos)')
  })

  it('validités et obligations portugaises', () => {
    expect(doc(docs, 'urssaf').validite).toBe('4 meses')
    expect(doc(docs, 'attestation_fiscale').validite).toBe('4 meses')
    expect(doc(docs, 'kbis').obligatoire).toBe(true)
    expect(doc(docs, 'seguro_acidentes_trabalho').obligatoire).toBe(true)
    expect(doc(docs, 'alvara_impic').obligatoire).toBe(true)
    // Pas d'obligation générale d'assurance de responsabilité civile au Portugal : recommandée.
    expect(doc(docs, 'rc_pro')).toMatchObject({ obligatoire: false, recommande: true })
  })

  it('aucun texte français, aucun tiret long, aucune espace avant « : », liens officiels portugais', () => {
    for (const d of docs) {
      const textes = [d.nom, d.description, d.validite, d.obtenir.label, d.obtenir.note].join(' | ')
      expect(textes).not.toMatch(/Kbis|URSSAF|DGFiP|SIRET|mois|\ban\b|Obtenir|votre|Délivr|Attestation|Extrait|Statuts/)
      expect(textes).not.toMatch(/[—–]/)
      expect(textes).not.toMatch(/\s:/)
      const lien = d.obtenir.lien
      if (lien) expect(new URL(lien).hostname).toMatch(/(^|\.)(gov\.pt|portaldasfinancas\.gov\.pt|impic\.pt)$/)
    }
  })
})

describe('getWalletDocumentsPt — artisan', () => {
  it('plombier en nom individuel : déclaration de début d’activité obligatoire, pas de certidão permanente ni de pacte', () => {
    const { docs, fallback } = getWalletDocumentsPt({ categories: ['plomberie'], legalForm: 'ENI', societeBtp: false })
    expect(ids(docs)).toEqual([
      'inicio_atividade', 'urssaf', 'attestation_fiscale', 'seguro_acidentes_trabalho', 'alvara_impic', 'rc_pro',
      'aptidao_medica', 'plano_seguranca_saude',
    ])
    expect(doc(docs, 'inicio_atividade').obligatoire).toBe(true)
    expect(fallback).toBe(false)
  })

  it('société de nettoyage : certidão permanente obligatoire, ni IMPIC ni plan de sécurité', () => {
    const { docs } = getWalletDocumentsPt({ categories: ['nettoyage'], legalForm: 'Unipessoal Lda', societeBtp: false })
    expect(ids(docs)).toEqual(['kbis', 'urssaf', 'attestation_fiscale', 'seguro_acidentes_trabalho', 'rc_pro', 'aptidao_medica'])
    expect(doc(docs, 'kbis').obligatoire).toBe(true)
  })

  it('forme juridique inconnue : les deux preuves d’existence légale, recommandées et non obligatoires', () => {
    const { docs } = getWalletDocumentsPt({ categories: ['peinture'], legalForm: '', societeBtp: false })
    expect(doc(docs, 'kbis')).toMatchObject({ obligatoire: false, recommande: true })
    expect(doc(docs, 'inicio_atividade')).toMatchObject({ obligatoire: false, recommande: true })
  })

  it('sans métier : message « compléter le profil » (fallback) et pas de document propre au bâtiment', () => {
    const { docs, fallback } = getWalletDocumentsPt({ categories: [], legalForm: 'Lda', societeBtp: false })
    expect(fallback).toBe(true)
    expect(ids(docs)).not.toContain('alvara_impic')
  })
})

describe('caseDocumentDejaDepose — document déposé sous une case absente de la liste portugaise', () => {
  it('reste visible sous son nom de fichier, sans obligation ni lien', () => {
    expect(caseDocumentDejaDepose('decennale', 'apolice.pdf')).toMatchObject({
      id: 'decennale', nom: 'Outro documento carregado: apolice.pdf', obligatoire: false, validite: '',
    })
    expect(caseDocumentDejaDepose('qualibat', undefined).nom).toBe('Outro documento carregado: qualibat')
  })
})
