import './fuseau-paris'
import { describe, expect, it } from 'vitest'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import type { Coproprietaire, Impaye, Lot, NotificationLocale, Prestataire } from '@/lib/administrateur-judiciaire/db/schema'
import { construireContexteAgent } from '@/lib/administrateur-judiciaire/ia/contexte-agent'
import { pseudonymiserNoms } from '@/lib/administrateur-judiciaire/ia/pseudonymes'

/**
 * Pseudonymes des personnes avant l'envoi au modèle d'IA (décision du 20/11/2026) : aucun nom du contexte ne part
 * au modèle, les vrais noms reviennent dans la réponse affichée. Tous les noms sont inventés pour ce test.
 */

const CONTEXTE = {
  dateDuJour: '2026-06-04',
  coproprieteSelectionnee: "Les Jardins d'Ondine",
  coproprietes: [{ code: 'JO', nom: "Les Jardins d'Ondine", lots: 40 }],
  coproprietairesDebiteurs: [
    { nom: 'Ondine Kervaliec', lot: '12', copropriete: "Les Jardins d'Ondine", solde: -4200, statut: 'Mise en demeure' },
    { nom: 'Noé Kervaliec', lot: '14', copropriete: "Les Jardins d'Ondine", solde: -1800, statut: 'Relance' },
    { nom: 'Éloïse Darnetal-Quérec', lot: '3', copropriete: "Les Jardins d'Ondine", solde: -950, statut: 'Relance' },
    { nom: 'M. Basile Roc', lot: '7', copropriete: "Les Jardins d'Ondine", solde: -300, statut: 'Amiable' },
    { nom: 'SCI Vallombreuse', lot: '21', copropriete: "Les Jardins d'Ondine", solde: -120, statut: 'Amiable' },
    { nom: 'Ondine Kervaliec', lot: '13', copropriete: "Les Jardins d'Ondine", solde: -60, statut: 'Amiable' },
  ],
  dossiersImpayes: [{ debiteur: 'Ondine Kervaliec', montant: 4200, statut: 'Action en justice' }],
  prestataires: [
    { nom: 'Plomberie Kervaliec', metier: 'Plombier', ville: 'Roc-sur-Mer', note: 3 },
    { nom: 'Atelier Brumaire SARL', metier: 'Couvreur', ville: 'Rocheville', note: 4 },
  ],
  contrats: [{ copropriete: "Les Jardins d'Ondine", prestataire: 'Atelier Brumaire SARL', type: 'Entretien toiture' }],
  notificationsRecentes: [
    { titre: 'Relance envoyée', description: 'Relance de Mme Kervaliec (lot 12) ; appel de Mme Pelagnier au sujet du Rocher' },
  ],
}

/** Fragments de noms qui ne doivent jamais partir au modèle (« Ondine » figure aussi dans le nom de la copropriété). */
const FRAGMENTS_INTERDITS = ['kervaliec', 'darnetal', 'querec', 'eloise', 'noe ', 'basile', 'vallombreuse', 'brumaire', 'pelagnier']

/** Texte replié (minuscules, sans accents) pour chercher un nom quelle que soit sa graphie. */
const replier = (texte: string) => texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const nomsQuiFuient = (valeur: unknown): string[] => {
  const texte = replier(JSON.stringify(valeur))
  const fuites = FRAGMENTS_INTERDITS.filter((fragment) => texte.includes(fragment))
  // « Roc » seul est un nom ; « Rocher », « Rocheville » et « Roc-sur-Mer » n'en sont pas.
  if (/(?<![\p{L}-])roc(?![\p{L}-])/u.test(texte)) fuites.push('roc')
  return fuites
}

const envoyer = (message: string, historique: Array<{ role: string; content: string }> = []) =>
  pseudonymiserNoms({ contexte: CONTEXTE, historique, message }, CONTEXTE)

/** Question seule, pseudonymisée avec le contexte de référence. */
const question = (message: string) => envoyer(message).donnees.message

describe('pseudonymiserNoms — rien ne part au modèle', () => {
  it('contexte, historique et question : aucun nom de personne ni de prestataire', () => {
    const { donnees } = envoyer('Où en est Éloïse Darnetal-Quérec ? Et M. Roc, et la SCI Vallombreuse ?', [
      { role: 'user', content: 'Qui doit le plus ?' },
      { role: 'assistant', content: 'Ondine Kervaliec (lot 12) doit 4 200 € ; Atelier Brumaire SARL intervient jeudi.' },
    ])
    expect(nomsQuiFuient(donnees)).toEqual([])
    expect(donnees.contexte.coproprietairesDebiteurs.map((d) => d.nom)).toEqual([
      'Copropriétaire 1',
      'Copropriétaire 2',
      'Copropriétaire 3',
      'Copropriétaire 4',
      'Copropriétaire 5',
      'Copropriétaire 1',
    ])
    expect(donnees.contexte.dossiersImpayes[0].debiteur).toBe('Copropriétaire 1')
    expect(donnees.contexte.prestataires.map((p) => p.nom)).toEqual(['Prestataire 1', 'Prestataire 2'])
    expect(donnees.contexte.contrats[0].prestataire).toBe('Prestataire 2')
    expect(donnees.message).toBe('Où en est Copropriétaire 3 ? Et Copropriétaire 4, et la Copropriétaire 5 ?')
    expect(donnees.historique[1].content).toBe('Copropriétaire 1 (lot 12) doit 4 200 € ; Prestataire 2 intervient jeudi.')
  })

  it('les autres données restent intactes (copropriété, montants, lots, métiers, villes)', () => {
    const { contexte } = envoyer('Bonjour').donnees
    expect(contexte.coproprieteSelectionnee).toBe("Les Jardins d'Ondine")
    expect(contexte.coproprietes).toEqual(CONTEXTE.coproprietes)
    expect(contexte.coproprietairesDebiteurs[0]).toEqual({ ...CONTEXTE.coproprietairesDebiteurs[0], nom: 'Copropriétaire 1' })
    expect(contexte.prestataires[0]).toEqual({ ...CONTEXTE.prestataires[0], nom: 'Prestataire 1' })
    expect(contexte.dateDuJour).toBe('2026-06-04')
  })

  it('personne citée avec sa civilité dans une note ou la question, inconnue des listes : « Personne N »', () => {
    const { donnees, retablir } = envoyer('Faut-il rappeler M. Ystarion Velasque ?')
    expect(donnees.contexte.notificationsRecentes[0].description).toBe(
      'Relance de Copropriétaire 1 ou Copropriétaire 2 (lot 12) ; appel de Personne 1 au sujet du Rocher',
    )
    expect(donnees.message).toBe('Faut-il rappeler Personne 2 ?')
    expect(retablir('Personne 1 a appelé ; Personne 2 aussi.')).toBe('Mme Pelagnier a appelé ; M. Ystarion Velasque aussi.')
  })

  it('personne citée en fin de ligne : le mot qui ouvre la ligne suivante ne fait pas partie de son nom', () => {
    expect(question('Gérant : M. Ystarion Velasque\nClient : la copropriété')).toBe('Gérant : Personne 2\nClient : la copropriété')
  })

  it('personne citée avec une particule, « Melle », « M » sans point, « Vve » ou « MM. X et Y » : rien ne part', () => {
    // « Personne 1 » est la personne de la note du contexte (Mme Pelagnier).
    for (const [texte, attendu] of [
      ['Appeler M. de la Morvenne demain', 'Appeler Personne 2 demain'],
      ['Courrier de Mme de l’Estravel reçu', 'Courrier de Personne 2 reçu'],
      ['Rappeler M. da Corvelha puis M. dos Varelhos', 'Rappeler Personne 2 puis Personne 3'],
      ['Lot de Mme Van der Lorst', 'Lot de Personne 2'],
      ['Melle Ondrevac a appelé', 'Personne 2 a appelé'],
      ['M Ondrevac a appelé', 'Personne 2 a appelé'],
      ['Vve Ondrevac, lot 8', 'Personne 2, lot 8'],
      ['Élection de MM. Ondrevac et Ystarion Velasque, scrutateurs', 'Élection de MM. Personne 2 et Personne 3, scrutateurs'],
      // Liste qui mêle un nom des listes et une personne inconnue : aucun des deux ne part.
      ['Élection de MM. Kervaliec et Ondrevac', 'Élection de MM. Copropriétaire 1 ou Copropriétaire 2 et Personne 2'],
    ]) {
      expect(question(texte), texte).toBe(attendu)
    }
    const { donnees, retablir } = envoyer('Élection de MM. Ondrevac et Ystarion Velasque ; M. de la Morvenne absent')
    expect(retablir(donnees.message)).toBe('Élection de MM. Ondrevac et Ystarion Velasque ; M. de la Morvenne absent')
  })

  it('champ de nom du contexte : remplacé en entier, même quand sa graphie échappe à la lecture du texte', () => {
    // Nom d'un seul mot saisi en minuscules, nom réduit à une particule élidée et un mot.
    const contexte = {
      coproprietairesDebiteurs: [{ nom: 'quillevar', lot: '2' }, { nom: 'd’Arvenoc', lot: '5' }],
      dossiersImpayes: [{ debiteur: 'quillevar', montant: 300 }],
    }
    expect(pseudonymiserNoms(contexte, contexte).donnees).toEqual({
      coproprietairesDebiteurs: [{ nom: 'Copropriétaire 1', lot: '2' }, { nom: 'Copropriétaire 2', lot: '5' }],
      dossiersImpayes: [{ debiteur: 'Copropriétaire 1', montant: 300 }],
    })
  })

  it('formules de politesse et fonctions sans nom : rien n’est remplacé', () => {
    const texte = 'Madame, Monsieur, M. le Président et Mme la juge ont reçu le courrier.'
    expect(question(texte)).toBe(texte)
  })

  it('le résultat ne porte que les données et la fonction de rétablissement (table jamais sérialisable)', () => {
    const resultat = envoyer('Où en est Ondine Kervaliec ?')
    expect(Object.keys(resultat).sort()).toEqual(['donnees', 'retablir'])
    expect(nomsQuiFuient(resultat)).toEqual([])
    expect(nomsQuiFuient(String(resultat.retablir))).toEqual([])
  })

  it('contexte réel construit par construireContexteAgent : aucun nom ne part', () => {
    const copro = { id: 'c1', mandatId: 'm1', code: 'JO', nom: "Les Jardins d'Ondine", adresse: '', lots: 40 } as unknown as CoproprieteVue
    const lots = [{ id: 'l1', coproprieteId: 'c1', numero: '12' }, { id: 'l2', coproprieteId: 'c1', numero: '3' }] as unknown as Lot[]
    const coproprietaires = [
      { id: 'p1', lotId: 'l1', nom: 'Ondine Kervaliec', tel: '', mail: '', solde: -4200, statut: 'Mise en demeure' },
      { id: 'p2', lotId: 'l2', nom: 'Éloïse Darnetal-Quérec', tel: '', mail: '', solde: -950, statut: 'Relance' },
    ] as unknown as Coproprietaire[]
    const prestataires = [{ id: 'pr1', nom: 'Atelier Brumaire SARL', metier: 'Couvreur', ville: 'Rocheville' }] as unknown as Prestataire[]
    const impayes = [{ id: 'i1', coproprietaireId: 'p1', montant: 4200, statut: 'Action en justice' }] as unknown as Impaye[]
    const notifications = [
      { id: 'n1', titre: 'Relance', description: 'Relance de Ondine Kervaliec envoyée', date: new Date(2026, 5, 1), lu: false },
    ] as unknown as NotificationLocale[]
    const contexte = construireContexteAgent({
      aujourdhui: '2026-06-04', mode: 'reel', coproprieteSelectionnee: "Les Jardins d'Ondine", copros: [copro], lots,
      coproprietaires, prestataires, echeances: [], taches: [], notifications, contrats: [], impayes,
    })
    const { donnees } = pseudonymiserNoms({ contexte, message: 'Relancer Éloïse ?' }, contexte)
    expect(nomsQuiFuient(donnees)).toEqual([])
    expect(donnees.message).toBe('Relancer Copropriétaire 2 ?')
  })
})

describe('pseudonymiserNoms — réponse affichée', () => {
  it('rétablit les vrais noms (gras Markdown, minuscule, « n° »)', () => {
    const { retablir } = envoyer('Point des impayés')
    expect(retablir('**Copropriétaire 3** doit 950 € ; contacter Prestataire 2.')).toBe(
      '**Éloïse Darnetal-Quérec** doit 950 € ; contacter Atelier Brumaire SARL.',
    )
    expect(retablir('Relancer le copropriétaire 4 puis Copropriétaire n° 5.')).toBe(
      'Relancer le copropriétaire M. Basile Roc puis SCI Vallombreuse.',
    )
  })

  it('autres graphies du numéro : « numéro », « n°1 », « # », espace insécable, capitales', () => {
    const { retablir } = envoyer('Point des impayés')
    expect(retablir('Copropriétaire numéro 3, Prestataire #1, Copropriétaire 1 et COPROPRIÉTAIRE N°2.')).toBe(
      'Éloïse Darnetal-Quérec, Plomberie Kervaliec, Ondine Kervaliec et Noé Kervaliec.',
    )
  })

  it('déterminant devant le pseudonyme : le rôle reste un nom commun, suivi du vrai nom', () => {
    const { retablir } = envoyer('Point des impayés')
    expect(retablir('Le dossier du Copropriétaire 1 ; écrire à la copropriétaire 3 et au prestataire 2.')).toBe(
      'Le dossier du copropriétaire Ondine Kervaliec ; écrire à la copropriétaire Éloïse Darnetal-Quérec et au prestataire Atelier Brumaire SARL.',
    )
    expect(retablir('Les Copropriétaires 1 et 3 sont en retard.')).toBe(
      'Les copropriétaires Ondine Kervaliec et Éloïse Darnetal-Quérec sont en retard.',
    )
  })

  it('élision : « de » ou « d’ », « que » ou « qu’ » devant un pseudonyme suivent l’initiale du vrai nom', () => {
    const { retablir } = envoyer('Point des impayés')
    expect(retablir('Le lot de Copropriétaire 3, celui de Copropriétaire 4 ; bien que Copropriétaire 1 conteste.')).toBe(
      'Le lot d’Éloïse Darnetal-Quérec, celui de M. Basile Roc ; bien qu’Ondine Kervaliec conteste.',
    )
    expect(retablir('Le devis d’Prestataire 2, puis celui d’Prestataire 1. De Copropriétaire 3 : rien.')).toBe(
      'Le devis d’Atelier Brumaire SARL, puis celui de Plomberie Kervaliec. D’Éloïse Darnetal-Quérec : rien.',
    )
    // « de » à la fin d'un autre mot n'est pas une préposition.
    expect(retablir('Commande Copropriétaire 3')).toBe('Commande Éloïse Darnetal-Quérec')
  })

  it('« personne » en minuscules est un nom commun : jamais rétabli', () => {
    const { retablir } = envoyer('Point des appels')
    expect(retablir('15 € par personne 1 fois par an ; Personne 1 a rappelé.')).toBe(
      '15 € par personne 1 fois par an ; Mme Pelagnier a rappelé.',
    )
  })

  it('nombre qui compte autre chose (durée, fois, montant, ordinal, décimal) : jamais pris pour un pseudonyme', () => {
    const { retablir } = envoyer('Point des impayés')
    const texte =
      'Relancer le copropriétaire 2 jours après la mise en demeure, chaque prestataire 1 fois par an ; ' +
      'le copropriétaire 3 mois plus tard ; Copropriétaire 2e relance ; prestataire 1,5 jour ; Copropriétaire 4 % ; ' +
      'les copropriétaires 1 et 2 semaines.'
    expect(retablir(texte)).toBe(texte)
    expect(retablir('Copropriétaire 3 : 2 relances. Copropriétaire 1 annonce un virement ; le copropriétaire 2 joue le jeu.')).toBe(
      'Éloïse Darnetal-Quérec : 2 relances. Ondine Kervaliec annonce un virement ; le copropriétaire Noé Kervaliec joue le jeu.',
    )
  })

  it('liste au pluriel : chaque numéro est rétabli', () => {
    const { retablir } = envoyer('Point des impayés')
    expect(retablir('Copropriétaires 1 et 3 sont en retard.')).toBe('Ondine Kervaliec et Éloïse Darnetal-Quérec sont en retard.')
    expect(retablir('Copropriétaires 1, 2 ou 3 ?')).toBe('Ondine Kervaliec, Noé Kervaliec ou Éloïse Darnetal-Quérec ?')
  })

  it('pseudonyme absent ou inconnu de la table : laissé tel quel, aucun nom attribué au hasard', () => {
    const { retablir } = envoyer('Point des impayés')
    expect(retablir('Aucun débiteur cité.')).toBe('Aucun débiteur cité.')
    expect(retablir('Copropriétaire 9 et Prestataire 7.')).toBe('Copropriétaire 9 et Prestataire 7.')
    expect(retablir('Copropriétaire 12 doit 300 €.')).toBe('Copropriétaire 12 doit 300 €.')
    expect(retablir('Copropriétaires 1 et 9.')).toBe('Copropriétaires 1 et 9.')
    expect(retablir('Copropriétaire 1, 2 000 € restent dus.')).toBe('Ondine Kervaliec, 2 000 € restent dus.')
  })

  it('aller-retour : la réponse qui reprend la question pseudonymisée affiche la question d’origine', () => {
    const { donnees, retablir } = envoyer('Préparer une relance pour Éloïse Darnetal-Quérec et Mme Pelagnier')
    expect(retablir(donnees.message)).toBe('Préparer une relance pour Éloïse Darnetal-Quérec et Mme Pelagnier')
    const elision = envoyer('Le lot d’Ondine Kervaliec, puis qu’Éloïse Darnetal-Quérec rappelle')
    expect(elision.retablir(elision.donnees.message)).toBe('Le lot d’Ondine Kervaliec, puis qu’Éloïse Darnetal-Quérec rappelle')
  })

  it('pseudonyme déjà écrit dans la question ou l’historique : jamais attribué à une personne', () => {
    const { donnees, retablir } = envoyer('Le copropriétaire 2 du lot 9 et le Prestataire 1 ont-ils répondu ? Et Noé Kervaliec ?', [
      { role: 'assistant', content: 'Copropriétaires 4 et 5 : pas de nouvelles.' },
    ])
    expect(donnees.contexte.coproprietairesDebiteurs.map((d) => d.nom)).toEqual([
      'Copropriétaire 1',
      'Copropriétaire 3',
      'Copropriétaire 6',
      'Copropriétaire 7',
      'Copropriétaire 8',
      'Copropriétaire 1',
    ])
    expect(donnees.contexte.prestataires.map((p) => p.nom)).toEqual(['Prestataire 2', 'Prestataire 3'])
    expect(donnees.message).toBe('Le copropriétaire 2 du lot 9 et le Prestataire 1 ont-ils répondu ? Et Copropriétaire 3 ?')
    expect(retablir('Le copropriétaire 2, le Prestataire 1 et les Copropriétaires 4 et 5 : rien reçu. Copropriétaire 3 : relancé.')).toBe(
      'Le copropriétaire 2, le Prestataire 1 et les Copropriétaires 4 et 5 : rien reçu. Noé Kervaliec : relancé.',
    )
  })
})

describe('pseudonymiserNoms — cas limites', () => {
  it('homonymes : nom de famille partagé → les deux pseudonymes ; nom complet → la bonne personne', () => {
    expect(question('Combien doit Kervaliec ?')).toBe('Combien doit Copropriétaire 1 ou Copropriétaire 2 ?')
    expect(question('Et Mme Kervaliec ?')).toBe('Et Copropriétaire 1 ou Copropriétaire 2 ?')
    expect(question('Et Noé Kervaliec ?')).toBe('Et Copropriétaire 2 ?')
    // Deux fiches au même nom (deux lots) : une seule personne pour le modèle, les lots restent distincts.
    const { contexte } = envoyer('Bonjour').donnees
    expect(contexte.coproprietairesDebiteurs[5]).toMatchObject({ nom: 'Copropriétaire 1', lot: '13' })
  })

  it('prestataire qui porte le nom d’une personne : nom complet du prestataire, pas un mélange', () => {
    expect(question('Appeler Plomberie Kervaliec')).toBe('Appeler Prestataire 1')
    expect(question('Appeler plomberie kervaliec')).toBe('Appeler Prestataire 1')
  })

  it('prestataire cité sans sa forme juridique : même pseudonyme (le modèle relie la question au contexte)', () => {
    expect(question('Le devis d’Atelier Brumaire est-il signé ?')).toBe('Le devis de Prestataire 2 est-il signé ?')
    expect(question('Atelier Brumaire SARL et atelier brumaire')).toBe('Prestataire 2 et Prestataire 2')
    // Un seul mot sans la forme juridique : trop courant pour être lu comme le prestataire.
    const contexte = { prestataires: [{ nom: 'Plomberie SARL' }] }
    expect(pseudonymiserNoms('Plomberie SARL ; plomberie du hall', contexte).donnees).toBe('Prestataire 1 ; plomberie du hall')
  })

  it('noms composés et accents : toutes les graphies de la même personne', () => {
    for (const graphie of [
      'Éloïse Darnetal-Quérec',
      'eloise darnetal querec',
      'ÉLOÏSE DARNETAL-QUÉREC',
      'Darnetal-Quérec',
      'Darnetal Quérec',
      'Mme Darnetal-Quérec',
      'Darnetal',
      'Quérec',
      'Querec',
      'Éloïse',
      'E\u0301loi\u0308se Darnetal-Que\u0301rec',
    ]) {
      expect(question(`Relancer ${graphie} demain`), graphie).toBe('Relancer Copropriétaire 3 demain')
    }
    expect(question('Kervaliec Ondine, lot 12')).toBe('Copropriétaire 1, lot 12')
    // Élision devant un nom : forme pleine devant le pseudonyme (« d’Copropriétaire » ne se lit pas).
    expect(question('Le lot d’Ondine Kervaliec, puis qu’Éloïse rappelle')).toBe('Le lot de Copropriétaire 1, puis que Copropriétaire 3 rappelle')
  })

  it('nom contenu dans un autre mot : jamais remplacé', () => {
    for (const texte of ['Fissure au Rocher', 'La Brocante du hall', 'Livraison à Roc-sur-Mer', 'Les Kervaliecs du quartier', 'Rocheville']) {
      expect(question(texte), texte).toBe(texte)
    }
    expect(question('Relancer Roc et M. Roc')).toBe('Relancer Copropriétaire 4 et Copropriétaire 4')
  })

  it('mot isolé écrit en minuscules : laissé tel quel (« un roc », métier, adjectif)', () => {
    expect(question('Le mur est solide comme un roc')).toBe('Le mur est solide comme un roc')
  })

  it('plusieurs mots du nom en minuscules, ou un mot en minuscules suivi d’un mot à majuscule : remplacés ensemble', () => {
    expect(question('voir darnetal quérec demain')).toBe('voir Copropriétaire 3 demain')
    expect(question('voir darnetal Quérec demain')).toBe('voir Copropriétaire 3 demain')
    expect(question('relancer kervaliec ondine')).toBe('relancer Copropriétaire 1')
  })

  it('noms de la base avec ponctuation, particule élidée, mention « née » ou « & Fils »', () => {
    const contexte = {
      coproprietairesDebiteurs: [{ nom: 'MME LANDRIEC (née Ploumar)' }, { nom: "Maëlys d'Orvalec" }, { nom: 'Indivision Trégastel & Fils' }],
    }
    const { donnees } = pseudonymiserNoms(
      [
        'Mme Landriec, née Ploumar ; Ploumar ; LANDRIEC',
        "Le dossier d'Orvalec, celui de Maëlys d'Orvalec, puis Orvalec",
        'Trégastel & Fils ; Trégastel ; Fils de copropriétaire',
      ],
      contexte,
    )
    expect(donnees).toEqual([
      'Copropriétaire 1, née Copropriétaire 1 ; Copropriétaire 1 ; Copropriétaire 1',
      'Le dossier de Copropriétaire 2, celui de Copropriétaire 2, puis Copropriétaire 2',
      'Copropriétaire 3 & Fils ; Copropriétaire 3 ; Fils de copropriétaire',
    ])
  })

  it('mot qui figure aussi dans le nom d’une copropriété : remplacé seulement avec le nom complet ou la civilité', () => {
    expect(question("Budget des Jardins d'Ondine")).toBe("Budget des Jardins d'Ondine")
    expect(question('Ondine Kervaliec et Mme Ondine')).toBe('Copropriétaire 1 et Copropriétaire 1')
  })

  it('forme juridique : « SCI » seul n’est pas un nom', () => {
    expect(question('La SCI paie par virement')).toBe('La SCI paie par virement')
    expect(question('Vallombreuse a payé')).toBe('Copropriétaire 5 a payé')
  })

  it('caractères réservés aux jetons provisoires dans la question : retirés, sans effet', () => {
    expect(question('Bonjour \uE0000\uE001 Roc')).toBe('Bonjour 0 Copropriétaire 4')
  })

  it('contexte sans aucun nom : données inchangées et rétablissement neutre', () => {
    const { donnees, retablir } = pseudonymiserNoms({ message: 'Échéances de la semaine ?' }, { coproprietes: [] })
    expect(donnees.message).toBe('Échéances de la semaine ?')
    expect(retablir('Copropriétaire 1 doit 10 €')).toBe('Copropriétaire 1 doit 10 €')
  })
})
