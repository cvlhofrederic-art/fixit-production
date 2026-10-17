// @vitest-environment node
// tests/lib/copro-ia-contexte.test.ts
//
// Prompt système de Fixy (espace Copropriétaire), construit côté serveur à
// partir d'un EspaceCopro — ici la démonstration (espaceDemo()), qui a la même
// forme que les données réelles du syndic. Il doit contenir ce que le portail
// affiche (lot, syndic, solde et appels de charges, demandes et leur statut en
// mots, travaux, documents, assemblées et date limite de vote, annonces), les
// consignes « ces données et rien d'autre / renvoyer vers le syndic / nommer
// l'écran », suivre la langue de l'espace, et ne jamais citer l'e-mail ni le
// téléphone du copropriétaire, l'IBAN ou les références de paiement.
// L'environnement `node` vérifie au passage que ces modules se chargent sans
// navigateur (ils sont importés par la route /api/copro-ai).

import { describe, it, expect } from 'vitest'

import { construirePromptCopro, jourParis, langueCopro } from '@/lib/copro-ia-contexte'
import { IBAN_DEMO, espaceDemo } from '@/lib/coproprietaire/demo'
import type { EspaceCopro } from '@/lib/coproprietaire/types'

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

describe('construirePromptCopro — français, espace de démonstration', () => {
  const espace = espaceDemo()
  const prompt = construirePromptCopro('fr', espace, DEMO)

  it('présente Fixy, la copropriétaire, son lot, le syndic et le jour', () => {
    expect(prompt).toContain('Tu es Fixy')
    expect(prompt).toContain('Géraldine Xavier, copropriétaire du lot n°12 à Résidence Le Prado (bâtiment D, 4e étage), à Marseille.')
    expect(prompt).toContain('Le syndic de l’immeuble est Cabinet Dupont.')
    expect(prompt).toContain('Le gestionnaire de l’immeuble est Hugo Carvalho.')
    expect(prompt).toContain('Nous sommes le lundi 12 octobre 2026.')
    expect(prompt).toContain('Ces données sont une démonstration')
    expect(prompt).toContain('- Tantièmes : 450 (4,5 % des charges communes)')
  })

  it('consignes : ces données et rien d’autre, renvoi vers le syndic, écrans du portail, prestataires, vote', () => {
    expect(prompt).toContain('Réponds toujours en français')
    expect(prompt).toContain('Réponds avec les données ci-dessous et rien d’autre')
    expect(prompt).toContain('dis que le syndic ne l’a pas publiée dans l’espace et invite à le contacter')
    for (const ecran of ['« Accueil »', '« Mes demandes »', '« Charges & paiements »', '« Documents »', '« Assemblées & votes »', '« Annonces »', '« Mes informations »']) {
      expect(prompt, ecran).toContain(ecran)
    }
    expect(prompt).toContain('Ne donne jamais les coordonnées d’un prestataire')
    expect(prompt).toContain('Le vote en ligne est une intention transmise au syndic')
    expect(prompt).toContain('Pour toute décision (travaux, paiement, contestation, vote), invite à contacter le syndic.')
    expect(prompt).toContain('phrases courtes')
  })

  it('syndic : nom, adresse, téléphone et e-mail du cabinet (c’est l’interlocuteur)', () => {
    expect(prompt).toContain('=== SYNDIC (écran « Mes informations ») ===\n- Cabinet Dupont — 45 avenue du Prado, 13008 Marseille\n- Téléphone : 04 91 00 00 00 — E-mail : contact@cabinet-dupont.fr')
  })

  it('charges : solde, appels avec période, montant, réglé, reste, échéance et statut en mots ; factures ; retards', () => {
    expect(prompt).toContain('Solde de votre compte : 855 € (somme due)')
    expect(prompt).toContain('- 2026-T4 — du 1er octobre 2026 au 31 décembre 2026 : montant 855 €, réglé 0 €, reste 855 € — À payer, échéance le 15 octobre 2026')
    expect(prompt).toContain('- 2026-T3 — du 1er juillet 2026 au 30 septembre 2026 : montant 855 €, réglé 855 €, reste 0 € — Payé, échéance le 15 juillet 2026')
    expect(prompt).toContain('- Ravalement façade — 1er appel de fonds — du 1er décembre 2026 au 28 février 2027 : montant 1 462,50 €, réglé 0 €, reste 1 462,50 € — À payer, échéance le 1er décembre 2026')
    expect(prompt).toContain('- FC-2026-0042 (émise le 8 juillet 2026, échéance le 31 juillet 2026) : 125 € TTC — Régularisation des charges 2025 — trop-perçu remboursé sur votre compte — Réglée')
    expect(prompt).toContain('Retards de paiement :\n- Aucun')
    expect(prompt).toContain('L’IBAN et la référence à indiquer ne sont pas dans ces données : ils sont affichés dans « Charges & paiements »')
  })

  it('mes demandes : type, statut en mots, prestataire, dates, derniers messages du syndic, intervention liée', () => {
    expect(prompt).toContain('- Ascenseur — Bruit anormal de l’ascenseur du bâtiment D entre le 3e et le 4e étage, surtout le matin. — parties communes, Ascenseur (bâtiment D, 4e étage) — envoyée le 29 septembre 2026, dernière mise à jour le 30 septembre 2026 — statut : Reçue par le syndic — priorité : normale')
    expect(prompt).toContain('    - 30 septembre 2026 : « Demande bien reçue : nous contactons l’ascensoriste pour une visite de contrôle. »')
    expect(prompt).toContain('— envoyée le 15 septembre 2026, dernière mise à jour le 16 septembre 2026 — statut : Terminée — priorité : urgente')
    expect(prompt).toContain('  Intervention liée : prestataire : Plomberie du Vieux-Port — Travaux terminés — passage prévu le 16 septembre 2026 — coût pour la copropriété : facturé 420 € — compte rendu : Remplacement du raccord défectueux')
    // Le message du copropriétaire lui-même n'est pas recopié : seuls ceux du syndic.
    expect(prompt).not.toContain('Merci de faire vite')
  })

  it('travaux dans l’immeuble : type, zone, prestataire, statut, dates, coût pour la copropriété', () => {
    expect(prompt).toContain('- Électricité — Éclairage du parking en panne (niveau -1) — parties communes, Parking / garage — prestataire : Élec Services Phocéens — statut : Prestataire désigné — priorité : normale — demandés le 14 octobre 2026, passage prévu le 21 octobre 2026 — coût pour la copropriété : devis 380 €')
    expect(prompt).toContain('- Peinture — Remise en peinture du hall d’entrée et de la cage d’escalier du bâtiment D — parties communes, Hall d’entrée (bâtiment D) — prestataire : Peinture & Décor Méditerranée — statut : En cours')
    expect(prompt).toContain('- Ascenseur — Visite d’entretien semestrielle et remplacement des patins de guidage de la cabine — parties communes, Ascenseur (bâtiment D) — prestataire : Ascenseurs Phocéens — statut : Travaux terminés — priorité : normale — demandés le 22 septembre 2026, passage prévu le 29 septembre 2026 — coût pour la copropriété : facturé 1 240 €')
    expect(prompt).toContain('- Plomberie (à ma demande) — Fuite sur la colonne d’eau froide')
  })

  it('documents : noms et rubriques sans contenu ; contrats et assurances', () => {
    expect(prompt).toContain('Fichiers (noms seulement : leur contenu n’est pas dans ces données) :')
    expect(prompt).toContain('- Convocation AG extraordinaire du 19 novembre 2026.pdf — Convocation, ajouté le 5 octobre 2026, 1,2 Mo')
    expect(prompt).toContain('- PV AG ordinaire du 11 juin 2026.pdf — Procès-verbal d’assemblée, ajouté le 25 juin 2026, 2,4 Mo')
    expect(prompt).toContain('- Gardiennage Sud Services — Sécurité : 1 200 € par mois, 14 400 € par an, du 1er janvier 2026 au 31 décembre 2026 — En cours')
    expect(prompt).toContain('- AXA — Assurance multirisque : police n° MRI-2026-4471, 4 800 € par an, capital 2 000 000 €, du 1er janvier 2026 au 31 décembre 2026 — En cours')
  })

  it('assemblées : prochaine AG, date limite de vote J-3, ordre du jour, résolutions, mon vote, PV résumé', () => {
    expect(prompt).toContain('Prochaine assemblée : AG Extraordinaire — Chaudière collective, jeudi 19 novembre 2026 à 18 h 00, Salle polyvalente, 182 avenue du Prado, 13008 Marseille. Vote par correspondance en ligne possible jusqu’au lundi 16 novembre 2026 (3 jours avant la séance).')
    expect(prompt).toContain('AG Extraordinaire — Chaudière collective — Assemblée générale extraordinaire, Convoquée — jeudi 19 novembre 2026 à 18 h 00 — Salle polyvalente, 182 avenue du Prado, 13008 Marseille — convocation envoyée le 5 octobre 2026')
    expect(prompt).toContain('  1. Remplacement de la chaudière collective — choix de l\'entreprise et vote des travaux')
    expect(prompt).toContain('  - n°1 Remplacement de la chaudière collective — majorité absolue (art. 25) : ')
    expect(prompt).toContain('32 000 € TTC')
    expect(prompt).toContain('Vote en cours ; votre vote : pas encore voté.')
    expect(prompt).toContain('AG Ordinaire 2026 — Assemblée générale ordinaire, Clôturée')
    expect(prompt).toContain('Adoptée (pour 6 100, contre 1 650, abstention 450 sur 10 000 tantièmes) ; votre vote : POUR (enregistré le 11 juin 2026).')
    expect(prompt).toContain('Rejetée (pour 5 500, contre 3 000, abstention 1 000 sur 10 000 tantièmes) ; votre vote : CONTRE (enregistré le 20 septembre 2025).')
    const pv = prompt.split('Procès-verbal (résumé) : ')[1]?.split('\n')[0] ?? ''
    expect(pv).toContain('Procès-verbal de l\'assemblée générale ordinaire du 11 juin 2026')
    expect(pv.length).toBeLessThanOrEqual(600)
    expect(pv.endsWith('…')).toBe(true)
  })

  it('annonces : date, priorité et catégorie en mots, titre et contenu', () => {
    expect(prompt).toContain('- 8 octobre 2026 — Urgent, Travaux et entretien — Coupure d’eau froide — mardi 20 octobre : Une coupure d’eau froide est prévue le mardi 20 octobre 2026')
    expect(prompt).toContain('- 5 octobre 2026 — Important, Assemblée, épinglée — Convocation — AG extraordinaire du 19 novembre :')
    expect(prompt).toContain('- 25 août 2026 — Information, Vie de l’immeuble, tous les immeubles du cabinet — Nouvelle gardienne :')
  })

  it('ne cite jamais l’e-mail ni le téléphone du copropriétaire, l’IBAN, les références de paiement', () => {
    expect(espace.profil.email).not.toBe('')
    expect(espace.profil.telephone).not.toBe('')
    expect(prompt).not.toContain(espace.profil.email)
    expect(prompt).not.toContain(espace.profil.telephone)
    expect(prompt).not.toContain(IBAN_DEMO)
    expect(prompt).not.toMatch(/FR76/)
    for (const appel of espace.finances.appels) {
      expect(appel.referencePaiement).not.toBe('')
      expect(prompt, appel.referencePaiement).not.toContain(appel.referencePaiement)
      expect(prompt).not.toContain(appel.iban)
    }
    // L'horodatage de chargement ne compte pas : il changerait à chaque question.
    expect(prompt).not.toContain(espace.chargeLe)
  })

  it('aucune valeur manquante dans le texte', () => {
    expect(prompt).not.toMatch(/undefined|NaN|\[object Object\]|null/)
  })

  it('déterministe : deux appels (et deux chargements) donnent la même chaîne — prompt mis en cache par Claude', () => {
    expect(construirePromptCopro('fr', espaceDemo(), DEMO)).toBe(prompt)
    expect(construirePromptCopro('fr', espaceDemo('2026-10-12T15:42:00+02:00'), new Date('2026-10-12T19:00:00Z'))).toBe(prompt)
  })

  it('ne modifie pas l’espace reçu', () => {
    const copie = JSON.stringify(espace)
    construirePromptCopro('fr', espace, DEMO)
    expect(JSON.stringify(espace)).toBe(copie)
  })
})

describe('construirePromptCopro — au fil du temps', () => {
  it('entre la date limite et la séance : vote en ligne clos', () => {
    const prompt = construirePromptCopro('fr', espaceDemo(), new Date('2026-11-18T09:00:00Z'))
    expect(prompt).toContain('Nous sommes le mercredi 18 novembre 2026.')
    expect(prompt).toContain('Prochaine assemblée : AG Extraordinaire — Chaudière collective')
    expect(prompt).toContain('Vote par correspondance en ligne clos depuis le lundi 16 novembre 2026')
    expect(prompt).not.toContain('possible jusqu’au')
  })

  it('une fois l’AG passée, plus de « prochaine assemblée »', () => {
    const prompt = construirePromptCopro('fr', espaceDemo(), new Date('2026-12-15T09:00:00Z'))
    expect(prompt).toContain('Aucune assemblée programmée dans ces données.')
    expect(prompt).not.toContain('possible jusqu’au')
  })
})

describe('construirePromptCopro — espace réel incomplet', () => {
  function espaceVide(): EspaceCopro {
    const d = espaceDemo()
    return {
      ...d,
      source: 'reel',
      profil: { ...d.profil, id: 'f1', prenom: 'Marc', nom: 'Durand', role: 'locataire', numLot: '7', batiment: '', etage: '2', tantiemes: 0, quotePart: 0, solde: 0, email: 'marc.durand@exemple.fr', telephone: '07 00 00 00 07' },
      autresLots: [],
      immeuble: { ...d.immeuble, id: null, adresse: '', ville: '', codePostal: '', nbLots: 0, anneeConstruction: null, typeImmeuble: '', gestionnaire: '', budgetAnnuel: 0, depensesAnnee: 0, reglement: null },
      syndic: { nom: '', adresse: '', ville: '', codePostal: '', telephone: '', email: '' },
      interventions: { mesDemandes: [], immeuble: [] },
      finances: { solde: 0, appels: [], factures: [], impayes: [] },
      documents: { fichiers: [], contrats: [], assurances: [] },
      assemblees: [],
      annonces: [],
    }
  }
  const prompt = construirePromptCopro('fr', espaceVide(), DEMO)

  it('décrit un locataire sans syndic connu, sans rien inventer', () => {
    expect(prompt).toContain('Tu réponds à Marc Durand, locataire du lot n°7 à Résidence Le Prado (2e étage). Le syndic n’a pas renseigné ses coordonnées dans l’espace.')
    expect(prompt).not.toContain('Ces données sont une démonstration')
    expect(prompt).toContain('- Locataire : Marc Durand')
    expect(prompt).toContain('- Lot n°7 — Résidence Le Prado, 2e étage')
    expect(prompt).not.toContain('Tantièmes')
    expect(prompt).toContain('=== SYNDIC (écran « Mes informations ») ===\n- Le syndic n’a pas renseigné ses coordonnées dans l’espace.')
    expect(prompt).toContain('Solde de votre compte : 0 € (vous êtes à jour)')
    expect(prompt).toContain('Appels de charges :\n- Aucun')
    expect(prompt).toContain('=== MES DEMANDES AU SYNDIC (écran « Mes demandes ») ===\n- Aucune')
    expect(prompt).toContain('Aucune assemblée programmée dans ces données.')
    expect(prompt).toContain('=== ANNONCES DU SYNDIC (écran « Annonces ») ===\n- Aucune')
    expect(prompt).not.toContain('marc.durand@exemple.fr')
    expect(prompt).not.toContain('07 00 00 00 07')
    expect(prompt).not.toMatch(/undefined|NaN|\[object Object\]|null/)
  })
})

describe('construirePromptCopro — portugais', () => {
  const espace = espaceDemo()
  const prompt = construirePromptCopro('pt', espace, DEMO)

  it('consignes, écrans et libellés en portugais, mêmes données', () => {
    expect(prompt).toContain('És o Fixy')
    expect(prompt).toContain('Responde sempre em português europeu')
    expect(prompt).toContain('Os dados abaixo podem estar em francês')
    expect(prompt).toContain('Hoje é segunda-feira, 12 de outubro de 2026.')
    expect(prompt).toContain('Géraldine Xavier, condómino da fração n.º 12 do condomínio Résidence Le Prado (bloco D, 4.º andar), em Marseille.')
    expect(prompt).toContain('A administração do condomínio é assegurada por Cabinet Dupont.')
    for (const ecran of ['«Início»', '«Os meus pedidos»', '«Quotas & pagamentos»', '«Documentos»', '«Assembleias & votos»', '«Avisos»', '«As minhas informações»']) {
      expect(prompt, ecran).toContain(ecran)
    }
    expect(prompt).toContain('Saldo da sua conta: 855 € (em dívida)')
    expect(prompt).toContain('- 2026-T4 — de 1 de outubro de 2026 a 31 de dezembro de 2026: montante 855 €, pago 0 €, resta 855 € — A pagar, vencimento a 15 de outubro de 2026')
    expect(prompt).toContain('estado: Recebido pelo administrador — prioridade: normal')
    expect(prompt).toContain('estado: Concluído — prioridade: urgente')
    expect(prompt).toContain('prestador: Élec Services Phocéens — estado: Prestador designado')
    expect(prompt).toContain('Próxima assembleia: AG Extraordinaire — Chaudière collective, quinta-feira, 19 de novembro de 2026 às 18:00')
    expect(prompt).toContain('Voto por correspondência em linha possível até segunda-feira, 16 de novembro de 2026 (3 dias antes da sessão)')
    expect(prompt).toContain('Votação em curso; o seu voto: ainda não votou.')
    expect(prompt).toContain('=== QUOTAS E PAGAMENTOS (ecrã «Quotas & pagamentos») ===')
    expect(prompt).not.toContain('Réponds toujours en français')
    expect(prompt).not.toMatch(/undefined|NaN/)
  })

  it('mêmes interdits qu’en français', () => {
    expect(prompt).not.toContain(espace.profil.email)
    expect(prompt).not.toContain(espace.profil.telephone)
    expect(prompt).not.toContain(IBAN_DEMO)
    for (const appel of espace.finances.appels) expect(prompt).not.toContain(appel.referencePaiement)
    expect(construirePromptCopro('pt', espaceDemo(), DEMO)).toBe(prompt)
  })
})
