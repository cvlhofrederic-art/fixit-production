// tests/lib/kyc-marches-existants-invariance.test.ts
//
// Garde d'invariance : l'ajout du marché KYC pt_btp (société BTP portugaise, 22/11/2026) ne change rien au KYC des
// marchés existants, fr_artisan, fr_btp et pt_artisan (artisans, sociétés françaises).
//
// Oracle figé : poids et seuils de lib/kyc-verification.ts relevés avant ce changement (main 09bf286a) ; messages
// enregistrés en instantané sur ce même code. Toute modification du score, de la décision ou des messages d'un marché
// existant fait échouer ce fichier.

import { describe, it, expect } from 'vitest'
import { buildKycDetails, computeKycScore, decideKycStatus, type KycChecks } from '@/lib/kyc-verification'

const MARCHES_EXISTANTS = ['fr_artisan', 'fr_btp', 'pt_artisan'] as const
type MarcheExistant = (typeof MARCHES_EXISTANTS)[number]

/** Poids d'avant : format, registre, document lu, identifiant du document, dénomination (max), pièce d'identité (max). */
const POIDS_AVANT: Record<MarcheExistant, readonly number[]> = {
  fr_artisan: [10, 30, 10, 20, 15, 15],
  fr_btp: [10, 30, 10, 20, 15, 15],
  pt_artisan: [15, 20, 15, 15, 20, 15],
}

function scoreAvant(c: KycChecks, marche: MarcheExistant): number {
  if (!c.identifiantFormatValid) return 0
  const [format, registre, document, identifiant, denomination, identite] = POIDS_AVANT[marche]
  let score = format
  if (c.identifiantActiveInRegistry) score += registre
  if (c.docOcrSuccess) score += document
  if (c.identifiantMatchDocVsApi) score += identifiant
  score += Math.round((c.nameMatchDocVsApi / 100) * denomination)
  score += Math.round((c.nameMatchDocVsId / 100) * identite)
  return Math.min(100, Math.max(0, score))
}

function decisionAvant(score: number): string {
  if (score >= 80) return 'approved'
  if (score < 40) return 'rejected'
  return 'manual_review'
}

/** Les 32 combinaisons des contrôles oui / non, croisées avec des taux de correspondance pris aux bornes d'arrondi. */
function combinaisons(): KycChecks[] {
  const liste: KycChecks[] = []
  for (let n = 0; n < 32; n++) {
    const oui = n.toString(2).padStart(5, '0').split('').map((b) => b === '1')
    for (const nameMatchDocVsApi of [0, 1, 3, 33, 49, 50, 67, 99, 100]) {
      for (const nameMatchDocVsId of [0, 3, 50, 100]) {
        liste.push({
          identifiantFormatValid: oui[0],
          identifiantActiveInRegistry: oui[1],
          docOcrSuccess: oui[2],
          identifiantMatchDocVsApi: oui[3],
          addressMatchDocVsApi: oui[4],
          nameMatchDocVsApi,
          nameMatchDocVsId,
        })
      }
    }
  }
  return liste
}

describe('KYC des marchés existants : score inchangé', () => {
  it.each(MARCHES_EXISTANTS)('%s : même score qu’avant sur 1 152 combinaisons de contrôles', (marche) => {
    const jeux = combinaisons()
    expect(jeux).toHaveLength(1152)
    expect(jeux.filter((c) => computeKycScore(c, marche) !== scoreAvant(c, marche))).toEqual([])
  })
})

describe('KYC des marchés existants : décision inchangée', () => {
  it.each(MARCHES_EXISTANTS)('%s : approuvé dès 80, rejeté sous 40, revue manuelle entre les deux', (marche) => {
    const ecarts: number[] = []
    for (let score = 0; score <= 100; score++) {
      if (decideKycStatus(score, marche) !== decisionAvant(score)) ecarts.push(score)
    }
    expect(ecarts).toEqual([])
  })

  it('sans marché précisé : mêmes seuils qu’avant', () => {
    const ecarts: number[] = []
    for (let score = 0; score <= 100; score++) {
      if (decideKycStatus(score) !== decisionAvant(score)) ecarts.push(score)
    }
    expect(ecarts).toEqual([])
  })
})

describe('KYC des marchés existants : messages inchangés', () => {
  const JEUX: Record<string, KycChecks> = {
    complet: {
      identifiantFormatValid: true, identifiantActiveInRegistry: true, docOcrSuccess: true, identifiantMatchDocVsApi: true,
      nameMatchDocVsApi: 100, nameMatchDocVsId: 100, addressMatchDocVsApi: true,
    },
    partiel: {
      identifiantFormatValid: true, identifiantActiveInRegistry: false, docOcrSuccess: true, identifiantMatchDocVsApi: false,
      nameMatchDocVsApi: 67, nameMatchDocVsId: 0, addressMatchDocVsApi: false,
    },
    registreSeul: {
      identifiantFormatValid: true, identifiantActiveInRegistry: true, docOcrSuccess: false, identifiantMatchDocVsApi: false,
      nameMatchDocVsApi: 0, nameMatchDocVsId: 0, addressMatchDocVsApi: false,
    },
    formatInvalide: {
      identifiantFormatValid: false, identifiantActiveInRegistry: false, docOcrSuccess: false, identifiantMatchDocVsApi: false,
      nameMatchDocVsApi: 0, nameMatchDocVsId: 0, addressMatchDocVsApi: false,
    },
  }

  it.each(MARCHES_EXISTANTS)('%s : messages relevés sur le code d’avant', (marche) => {
    const messages = Object.fromEntries(
      Object.entries(JEUX).map(([nom, c]) => [nom, buildKycDetails(c, computeKycScore(c, marche), marche)]),
    )
    expect(messages).toEqual(MESSAGES_AVANT[marche])
  })
})

// Relevé sur main 09bf286a (lib/kyc-verification.ts avant l'ajout de pt_btp) : fr_artisan et fr_btp avaient les mêmes.
const MESSAGES_FR_AVANT: Record<string, string[]> = {
  complet: [
    'SIRET valide (format et clé de Luhn)',
    'Entreprise active dans le registre INSEE/Sirene',
    'KBIS analysé avec succès par OCR',
    'SIRET identique entre KBIS et registre',
    'Correspondance dénomination KBIS/registre : 100%',
    'Correspondance représentant KBIS/CNI : 100%',
    'Score KYC : 100/100 — approuvé',
  ],
  partiel: [
    'SIRET valide (format et clé de Luhn)',
    'Entreprise non trouvée ou radiée dans le registre INSEE/Sirene',
    'KBIS analysé avec succès par OCR',
    'SIRET extrait du KBIS ne correspond pas au registre',
    'Correspondance dénomination KBIS/registre : 67%',
    'Correspondance représentant KBIS/CNI : 0%',
    'Score KYC : 30/100 — rejeté',
  ],
  registreSeul: [
    'SIRET valide (format et clé de Luhn)',
    'Entreprise active dans le registre INSEE/Sirene',
    'OCR du KBIS partiel ou échoué — révision manuelle recommandée',
    'SIRET extrait du KBIS ne correspond pas au registre',
    'Correspondance dénomination KBIS/registre : 0%',
    'Correspondance représentant KBIS/CNI : 0%',
    'Score KYC : 40/100 — révision manuelle',
  ],
  formatInvalide: [
    'SIRET invalide (format ou clé de contrôle)',
    'Entreprise non trouvée ou radiée dans le registre INSEE/Sirene',
    'OCR du KBIS partiel ou échoué — révision manuelle recommandée',
    'SIRET extrait du KBIS ne correspond pas au registre',
    'Correspondance dénomination KBIS/registre : 0%',
    'Correspondance représentant KBIS/CNI : 0%',
    'Score KYC : 0/100 — rejeté',
  ],
}

const MESSAGES_AVANT: Record<MarcheExistant, Record<string, string[]>> = {
  fr_artisan: MESSAGES_FR_AVANT,
  fr_btp: MESSAGES_FR_AVANT,
  pt_artisan: {
    complet: [
      'NIF válido',
      'Empresa ativa no registo português',
      'Certidão Permanente analisada com sucesso por OCR',
      'NIF idêntico entre Certidão e registo',
      'Correspondência denominação Certidão/registo : 100%',
      'Correspondência gerente Certidão/CC : 100%',
      'Score KYC : 100/100 — aprovado',
    ],
    partiel: [
      'NIF válido',
      'Empresa não encontrada ou cessada no registo',
      'Certidão Permanente analisada com sucesso por OCR',
      'NIF extraído da Certidão não corresponde ao registo',
      'Correspondência denominação Certidão/registo : 67%',
      'Correspondência gerente Certidão/CC : 0%',
      'Score KYC : 43/100 — revisão manual',
    ],
    registreSeul: [
      'NIF válido',
      'Empresa ativa no registo português',
      'OCR da Certidão parcial ou falhou — revisão manual recomendada',
      'NIF extraído da Certidão não corresponde ao registo',
      'Correspondência denominação Certidão/registo : 0%',
      'Correspondência gerente Certidão/CC : 0%',
      'Score KYC : 35/100 — rejeitado',
    ],
    formatInvalide: [
      'NIF inválido (formato ou dígito de controlo)',
      'Empresa não encontrada ou cessada no registo',
      'OCR da Certidão parcial ou falhou — revisão manual recomendada',
      'NIF extraído da Certidão não corresponde ao registo',
      'Correspondência denominação Certidão/registo : 0%',
      'Correspondência gerente Certidão/CC : 0%',
      'Score KYC : 0/100 — rejeitado',
    ],
  },
}
