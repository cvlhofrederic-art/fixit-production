// tests/lib/kyc-certidao-permanente.test.ts — lecture du texte d'une certidão permanente (lib/kyc-certidao-permanente.ts),
// pièce d'une société BTP inscrite en portugais (marché KYC pt_btp). Le texte vient d'un modèle qui lit l'image : les
// mises en page essayées ici sont celles qu'il rend (lignes « Libellé: valeur », tableau Markdown, libellé seul puis
// valeur à la ligne). Société, numéros et code fictifs.

import { describe, it, expect } from 'vitest'
import { lireCertidaoPermanente } from '@/lib/kyc-certidao-permanente'

// NIPC fictif, de chiffre de contrôle valide (modulo 11).
const NIPC = '512345678'

const CERTIDAO_EN_LIGNES = [
  'CERTIDÃO PERMANENTE',
  'Código de acesso: 1234-5678-9012',
  'Subscrita em: 2026-05-08',
  'Válida até: 08/05/2027',
  'MATRÍCULA / NIPC: 512 345 678',
  'FIRMA: CONSTRUÇÕES EXEMPLO, UNIPESSOAL, LDA',
  'NATUREZA JURÍDICA: SOCIEDADE POR QUOTAS',
  'SEDE: Rua do Exemplo, n.º 1, 4990-000 Ponte de Lima',
  'CAPITAL: 5.000,00 Euros',
  'ÓRGÃOS SOCIAIS',
  'GERÊNCIA:',
  'Nome/Firma: RUI EXEMPLO',
  'NIF/NIPC: 123 456 789',
].join('\n')

describe('lireCertidaoPermanente — certidão rendue en lignes « Libellé: valeur »', () => {
  const lue = lireCertidaoPermanente(CERTIDAO_EN_LIGNES, NIPC)

  it('retrouve le NIPC déclaré, même groupé par trois', () => {
    expect(lue.nipc).toBe(NIPC)
    expect(lue.nipcDeclarePresent).toBe(true)
  })

  it('lit la firma de la matrícula, pas le « Nome/Firma » de la gérance', () => {
    expect(lue.firma).toBe('CONSTRUÇÕES EXEMPLO, UNIPESSOAL, LDA')
  })

  it('lit le gérant sous la rubrique « Gerência »', () => {
    expect(lue.gerente).toBe('RUI EXEMPLO')
  })

  it('lit le código de acesso et la fin de validité (JJ/MM/AAAA rendue en AAAA-MM-JJ)', () => {
    expect(lue.codigoAcesso).toBe('1234-5678-9012')
    expect(lue.validaAte).toBe('2027-05-08')
  })
})

describe('lireCertidaoPermanente — autres mises en page', () => {
  it('tableau Markdown, libellés en gras', () => {
    const texte = [
      '| **Código de acesso** | 1234-5678-9012 |',
      '| **NIPC** | 512345678 |',
      '| **Firma** | Construções Exemplo, Lda |',
      '| **Válida até** | 2027-05-08 |',
      '| **Gerente** | Rui Exemplo |',
    ].join('\n')

    expect(lireCertidaoPermanente(texte, NIPC)).toEqual({
      nipc: NIPC,
      nipcDeclarePresent: true,
      firma: 'Construções Exemplo, Lda',
      gerente: 'Rui Exemplo',
      codigoAcesso: '1234-5678-9012',
      validaAte: '2027-05-08',
    })
  })

  it('libellé seul sur sa ligne, valeur à la ligne suivante', () => {
    const lue = lireCertidaoPermanente(['Denominação', 'CONSTRUÇÕES EXEMPLO, LDA', 'NIPC', '512 345 678'].join('\n'), NIPC)

    expect(lue.firma).toBe('CONSTRUÇÕES EXEMPLO, LDA')
    expect(lue.nipcDeclarePresent).toBe(true)
  })

  it('firma suivie d’une autre rubrique sur la même ligne : la firma s’arrête avant elle', () => {
    const lue = lireCertidaoPermanente('Firma: CONSTRUÇÕES EXEMPLO, LDA Natureza Jurídica: Sociedade por Quotas', NIPC)

    expect(lue.firma).toBe('CONSTRUÇÕES EXEMPLO, LDA')
  })
})

describe('lireCertidaoPermanente — certidão d’une autre société, texte incomplet', () => {
  it('NIPC déclaré absent : le numéro lu après « NIPC » est rendu, sans correspondance', () => {
    const lue = lireCertidaoPermanente('NIPC: 509 999 997\nFirma: OUTRA EMPRESA, LDA', NIPC)

    expect(lue.nipc).toBe('509999997')
    expect(lue.nipcDeclarePresent).toBe(false)
  })

  it('le NIPC déclaré noyé dans un nombre plus long ne compte pas', () => {
    const lue = lireCertidaoPermanente('Referência: 95123456789\nTelefone: 351512345678', NIPC)

    expect(lue.nipcDeclarePresent).toBe(false)
    expect(lue.nipc).toBeNull()
  })

  it('une phrase qui contient « firma » n’est pas lue comme la firma', () => {
    expect(lireCertidaoPermanente('Firma registada na Conservatória do Registo Comercial', NIPC).firma).toBeNull()
  })

  it('date de validité impossible : non retenue', () => {
    expect(lireCertidaoPermanente('Válida até: 31/13/2027', NIPC).validaAte).toBeNull()
  })

  it('texte sans aucun champ reconnu : rien n’est inventé', () => {
    expect(lireCertidaoPermanente('Documento ilegível', NIPC)).toEqual({
      nipc: null,
      nipcDeclarePresent: false,
      firma: null,
      gerente: null,
      codigoAcesso: null,
      validaAte: null,
    })
  })
})
