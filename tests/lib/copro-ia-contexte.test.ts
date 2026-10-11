// @vitest-environment node
// tests/lib/copro-ia-contexte.test.ts
//
// Prompt système de Fixy (espace Copropriétaire), construit côté serveur à
// partir des données de démonstration : il doit contenir ce que l'écran
// affiche (profil, solde, échéances, AG, documents, annonces, interventions),
// les consignes « ne rien inventer / renvoyer vers le syndic », et suivre la
// langue de l'espace (français par défaut, portugais pour `pt`).
// L'environnement `node` vérifie au passage que ces modules se chargent sans
// navigateur (ils sont importés par la route /api/copro-ai).

import { describe, it, expect } from 'vitest'

import { construirePromptCopro, jourParis, langueCopro } from '@/lib/copro-ia-contexte'
import { ECHEANCES_DEMO, PAIEMENTS_DEMO } from '@/lib/copro-demo-data'

// Lundi 12 octobre 2026, 10h à Paris : jour de la démo.
const DEMO = new Date('2026-10-12T08:00:00Z')

describe('langueCopro', () => {
  it('portugais pour pt, français sinon', () => {
    expect(langueCopro('pt')).toBe('pt')
    expect(langueCopro('pt-PT')).toBe('pt')
    expect(langueCopro('fr')).toBe('fr')
    expect(langueCopro('en')).toBe('fr')
    expect(langueCopro(undefined)).toBe('fr')
    expect(langueCopro(null)).toBe('fr')
  })
})

describe('jourParis', () => {
  it('donne le jour de Paris, pas celui d’UTC', () => {
    // 22h30 UTC le 11/10 = 0h30 le 12/10 à Paris (heure d'été).
    expect(jourParis(new Date('2026-10-11T22:30:00Z'))).toBe('2026-10-12')
    expect(jourParis(DEMO)).toBe('2026-10-12')
  })
})

describe('construirePromptCopro — français', () => {
  const prompt = construirePromptCopro('fr', DEMO)

  it('présente Fixy, la copropriétaire, son lot et le jour', () => {
    expect(prompt).toContain('Tu es Fixy')
    expect(prompt).toContain('Géraldine Xavier')
    // Immeuble du cabinet de démo Syndic v54 (seed Marseille) : un signalement y arrive sans ambiguïté.
    expect(prompt).toContain('lot n°12 à la Résidence Le Prado (bâtiment D, 4e étage), à Marseille.')
    expect(prompt).not.toContain('Paris.')
    expect(prompt).toContain('Le syndic de l\'immeuble est le Cabinet Dupont')
    expect(prompt).toContain('Nous sommes le lundi 12 octobre 2026.')
    expect(prompt).toContain('Tantièmes : 450 / 10 000, soit une quote-part de 4,5 % des charges communes')
  })

  it('impose de s’en tenir aux données et de renvoyer vers le syndic', () => {
    expect(prompt).toContain('Réponds toujours en français')
    expect(prompt).toContain('appuie-toi uniquement sur les données ci-dessous')
    expect(prompt).toContain('N\'invente rien')
    expect(prompt).toContain('propose de contacter le syndic, le Cabinet Dupont')
  })

  it('situation financière : solde, paiements à régler et mois en cours', () => {
    expect(prompt).toContain('Solde à régler : 2 537,50 € (3 paiement(s) en attente)')
    expect(prompt).toContain('- Charges T4 2026 : 855,00 € — à régler, échéance le 15/10/2026 (réf. PAY-2026-004)')
    expect(prompt).toContain('- Fonds de travaux art. 14-2-1 : 220,00 € — à régler, échéance le 05/11/2026 (réf. FDT-2026-001)')
    expect(prompt).toContain('- Ravalement façade — 1er appel de fonds (quote-part) : 1 462,50 € — à régler, échéance le 01/12/2026')
    expect(prompt).toContain('- Charges T3 2026 : 855,00 € — réglé le 10/07/2026 (réf. PAY-2026-003)')
    expect(prompt).toContain('-125,00 € (remboursement en votre faveur)')
    expect(prompt).toContain('Charges courantes : appel trimestriel de 855,00 € (soit 285,00 € par mois).')
    expect(prompt).toContain('Mois en cours (octobre 2026) : 285,00 € — à payer')
  })

  it('échéances à venir, avec le jour de la semaine', () => {
    expect(prompt).toContain('- jeudi 15 octobre 2026 — Charges T4 2026 : 855,00 € — Appel de charges trimestriel (urgent)')
    expect(prompt).toContain('- mardi 20 octobre 2026 — Coupure eau froide : 9h-12h — Remplacement vanne local technique (urgent)')
    expect(prompt).toContain('- mardi 1er décembre 2026 — Ravalement façade — 1er appel de fonds : 1 462,50 € — Quote-part travaux')
    expect(prompt).not.toContain('ÉCHÉANCES PASSÉES')
  })

  it('AG : la prochaine, ses résolutions ouvertes, et les résultats des AG passées', () => {
    expect(prompt).toContain('Prochaine AG : AG Extraordinaire — Chaudière collective, jeudi 19 novembre 2026 à 18h00.')
    expect(prompt).toContain('  - Remplacement de la chaudière collective — majorité absolue (art. 25) : ')
    expect(prompt).toContain('32 000 € TTC')
    expect(prompt).toContain('État : vote ouvert ; votre vote : pas encore voté.')
    expect(prompt).toContain('AG Ordinaire 2026 (AG ordinaire, passée)')
    expect(prompt).toContain('État : adoptée (pour 6 100, contre 1 650, abstention 450 tantièmes) ; votre vote : pour.')
    expect(prompt).toContain('État : rejetée (pour 5 500, contre 3 000, abstention 1 000 tantièmes) ; votre vote : contre.')
  })

  it('documents, annonces, interventions et historique', () => {
    expect(prompt).toContain('- Convocation AG Extraordinaire du 19 novembre 2026 — autre, 2026, mis en ligne le 05/10/2026, 1.2 Mo — pas encore consulté')
    expect(prompt).toContain('- Appel de charges T4 2026 — appel de charges, 2026, document personnel')
    expect(prompt).toContain('URGENT — Coupure eau froide — 20 octobre (Cabinet Dupont) : ')
    expect(prompt).toContain('- Plomberie : Fuite robinet salle de bain — Mohamed Ait — Plomberie Express (06 89 34 56 12) — rendez-vous le 12/10/2026 à 14h00 — artisan en route, avancement 35 %')
    expect(prompt).toContain('note donnée : 5/5 (« Travail très propre, artisan ponctuel »)')
    expect(prompt).toContain('- 10/07/2026 — Charges T3 2026 réglées : Paiement de 855,00 € reçu (855,00 €)')
  })

  it('aucune valeur manquante dans le texte', () => {
    expect(prompt).not.toMatch(/undefined|NaN|\[object Object\]/)
  })

  it('identique d’un appel à l’autre le même jour (prompt mis en cache par Claude)', () => {
    expect(construirePromptCopro('fr', new Date('2026-10-12T19:00:00Z'))).toBe(prompt)
  })

  it('ne modifie pas l’ordre des données partagées avec l’écran', () => {
    const avant = ECHEANCES_DEMO.map(e => e.id).join()
    const paiementsAvant = PAIEMENTS_DEMO.map(p => p.id).join()
    construirePromptCopro('fr', DEMO)
    expect(ECHEANCES_DEMO.map(e => e.id).join()).toBe(avant)
    expect(PAIEMENTS_DEMO.map(p => p.id).join()).toBe(paiementsAvant)
  })
})

describe('construirePromptCopro — après la démo', () => {
  it('range les échéances dépassées à part et ne parle plus du mois d’octobre', () => {
    const prompt = construirePromptCopro('fr', new Date('2026-11-10T09:00:00Z'))
    expect(prompt).toContain('Nous sommes le mardi 10 novembre 2026.')
    const passees = prompt.split('=== ÉCHÉANCES PASSÉES ===')[1]?.split('===')[0] ?? ''
    expect(passees).toContain('Coupure eau froide')
    expect(passees).not.toContain('AG Extraordinaire — Chaudière')
    expect(prompt).not.toContain('Mois en cours')
  })

  it('une fois l’AG passée, plus de « prochaine AG »', () => {
    const prompt = construirePromptCopro('fr', new Date('2026-12-15T09:00:00Z'))
    expect(prompt).toContain('Aucune AG à venir dans ces données.')
  })
})

describe('construirePromptCopro — portugais', () => {
  const prompt = construirePromptCopro('pt', DEMO)

  it('consignes et intitulés en portugais, mêmes données', () => {
    expect(prompt).toContain('És o Fixy')
    expect(prompt).toContain('Responde sempre em português europeu')
    expect(prompt).toContain('Os dados abaixo estão em francês')
    expect(prompt).toContain('Hoje é segunda-feira, 12 de outubro de 2026.')
    expect(prompt).toContain('Géraldine Xavier, titular da fração n.º 12')
    expect(prompt).toContain('do condomínio Résidence Le Prado (bloco D, 4.º piso), em Marselha.')
    expect(prompt).toContain('Saldo por pagar: ')
    expect(prompt).toContain('2537,50 €')
    expect(prompt).toContain('Próxima assembleia: AG Extraordinaire — Chaudière collective, quinta-feira, 19 de novembro de 2026 às 18h00.')
    expect(prompt).toContain('Estado: votação aberta; o seu voto: ainda não votou.')
    expect(prompt).toContain('Tantièmes (equivalente francês da permilagem): 450 / 10 000')
    expect(prompt).toContain('=== SITUAÇÃO FINANCEIRA ===')
    expect(prompt).not.toContain('Réponds toujours en français')
    expect(prompt).not.toMatch(/undefined|NaN/)
  })
})
