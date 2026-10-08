// tests/lib/syndic/prompts-fr-references-juridiques.test.ts
//
// Prompts système FR de Léa et de Fixy (cadre français, loi n° 65-557 du
// 10 juillet 1965) : références juridiques vérifiées sur Légifrance.
// - fonds de travaux : art. 14-2-1 (l'art. 14-2 porte, depuis le 1er janvier
//   2023, sur le projet de plan pluriannuel de travaux) ;
// - mise en demeure et exigibilité des provisions non échues : art. 19-2, et
//   non art. 19 (hypothèque légale) ;
// - voies judiciaires de recouvrement : injonction de payer ; procédure
//   accélérée au fond devant le président du tribunal judiciaire (art. 19-2) ;
//   référé-provision de droit commun, ouvert au syndicat si la créance n'est
//   pas sérieusement contestable (art. 835, al. 2, du code de procédure
//   civile) ; saisie en vue de la vente d'un lot, la seule voie d'exécution qui
//   exige l'autorisation de l'assemblée générale (art. 55 du décret du
//   17 mars 1967) ;
// - intérêts au taux légal dus à compter de la mise en demeure, sauf
//   stipulation contraire du règlement : art. 36 du décret du 17 mars 1967 ;
// - plan comptable : décret n° 2005-240 et arrêté du 14 mars 2005 ;
// - sigle inconnu « PCSPE » retiré ; aucune référence portugaise.

import { describe, it, expect } from 'vitest'
import { buildLeaSystemPromptFR } from '@/lib/syndic/prompts/lea/system-prompt-fr'
import { buildFixySystemPromptFR, type FixyPromptContext } from '@/lib/syndic/prompts/fixy/system-prompt-fr'

/** Référence portugaise (loi, taux, sigle ou nom du pays) dans un prompt FR. */
const REFERENCE_PORTUGAISE = /portug|\bPT\b|DL\s?268\/94|23\s?%|Código|condomínio/i

describe('Léa FR — références juridiques', () => {
  // Règlement résumé (sans texte intégral) : passe par la branche « Éléments clés ».
  const prompt = buildLeaSystemPromptFR({
    immeuble: { reglementChargesRepartition: 'tantièmes généraux', reglementMajoriteAG: 'art. 24', reglementFondsTravaux: true },
  })

  it('fonds de travaux : art. 14-2-1, jamais l’art. 14-2', () => {
    expect(prompt).toContain('- Fonds de travaux (art. 14-2-1) : Oui')
    expect(prompt).toContain('- Fonds de travaux (art. 14-2-1 loi du 10 juillet 1965)')
    expect(prompt).not.toMatch(/14-2(?!-1)/)
  })

  it('mise en demeure : art. 19-2', () => {
    expect(prompt).toContain(
      '3. Mise en demeure (art. 19-2 loi 10/07/1965 : restée infructueuse pendant 30 jours, elle rend immédiatement exigibles les provisions non encore échues)',
    )
    expect(prompt).not.toMatch(/art\.\s?19 loi/)
  })

  it('procédure judiciaire : injonction de payer, procédure accélérée au fond, référé-provision, saisie (art. 55 du décret)', () => {
    expect(prompt).toContain(
      "5. Procédure judiciaire si nécessaire : injonction de payer ; procédure accélérée au fond devant le président du tribunal judiciaire (art. 19-2 de la loi du 10 juillet 1965) ; référé-provision si la créance n'est pas sérieusement contestable (art. 835, al. 2, du code de procédure civile) ; saisie en vue de la vente d'un lot sur autorisation de l'assemblée générale (art. 55 du décret du 17 mars 1967)",
    )
    expect(prompt).toMatch(/référé-provision si la créance n'est pas sérieusement contestable/)
    expect(prompt).toContain('art. 55 du décret du 17 mars 1967')
    expect(prompt).not.toContain('PCSPE')
  })

  it('intérêts : taux légal à compter de la mise en demeure (art. 36 du décret)', () => {
    expect(prompt).toContain(
      '- Intérêts au taux légal à compter de la mise en demeure, sauf stipulation contraire du règlement de copropriété (art. 36 décret 17/03/1967)',
    )
    expect(prompt).not.toContain('si taux prévu au règlement')
  })

  it('plan comptable : décret n° 2005-240 et arrêté du 14 mars 2005, sans norme AFNOR', () => {
    expect(prompt).toContain(
      '- Plan comptable des copropriétés **français** uniquement (décret n° 2005-240 du 14 mars 2005 et arrêté du 14 mars 2005).',
    )
    expect(prompt).not.toContain('NF S 31-100')
  })

  it('aucune référence portugaise dans le prompt FR', () => {
    expect(prompt).not.toMatch(REFERENCE_PORTUGAISE)
  })
})

describe('Fixy FR — références juridiques', () => {
  const ctx: FixyPromptContext = {
    role: 'syndic',
    date: 'mercredi 7 octobre 2026',
    dateISO: '2026-10-07',
    dateMappingStr: '',
    roleConfig: { name: 'Administrateur Cabinet', emoji: '🏢', expertise: 'Administration du cabinet', pages: [], actions: [] },
  }
  const prompt = buildFixySystemPromptFR(ctx)

  it('contentieux : référé-provision et procédure accélérée au fond (art. 19-2), sans « PCSPE »', () => {
    expect(prompt).toContain(
      '- **Contentieux** : procédures impayés, mises en demeure, commandement de payer, référé-provision, injonction de payer, procédure accélérée au fond (art. 19-2 loi 65-557)',
    )
    expect(prompt).toContain('référé-provision')
    expect(prompt).not.toContain('PCSPE')
  })

  it('aucune référence portugaise dans le prompt FR', () => {
    expect(prompt).not.toMatch(REFERENCE_PORTUGAISE)
  })
})
