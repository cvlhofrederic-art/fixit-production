// tests/components/coproprietaire/accueil.test.tsx
//
// Écran Accueil du portail copropriétaire (components/coproprietaire-dashboard/ecrans/EcranAccueil) :
// - ce qui est vu en premier avec les données de démonstration : bonjour, carte « ce que je dois »
//   (à régler / en retard selon la date du jour), signaler un problème, demandes en cours,
//   prochaine assemblée, travaux, annonces ;
// - l'état vide (espace sans appels, demandes, travaux, assemblées ni annonces) ;
// - le cas locataire (ni carte financière ni assemblée) ;
// - la fonction pure `prochainAppel` (tri par échéance, annulés ignorés, retard).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EcranAccueil, { prochainAppel } from '@/components/coproprietaire-dashboard/ecrans/EcranAccueil'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { espaceDemo } from '@/lib/coproprietaire/demo'
import { dateHeure, textesCopro } from '@/lib/coproprietaire/textes'
import type { AppelDeCharges, EspaceCopro } from '@/lib/coproprietaire/types'

const t = textesCopro('fr')

/** Espaces insécables (Intl) ramenés à des espaces simples pour comparer des phrases. */
function normaliser(texte: string | null | undefined): string {
  return (texte ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Paragraphe dont le texte complet (enfants compris) est `attendu`. */
function paragraphe(attendu: string): HTMLElement {
  return screen.getByText((_, el) => el?.tagName === 'P' && normaliser(el.textContent) === normaliser(attendu))
}

function absenceParagraphe(attendu: string): boolean {
  return screen.queryByText((_, el) => el?.tagName === 'P' && normaliser(el.textContent) === normaliser(attendu)) === null
}

function propsPour(espace: EspaceCopro, aujourdhui?: Date): PropsEcran & { aujourdhui?: Date } {
  return {
    espace,
    t,
    langue: 'fr',
    jeton: null,
    allerA: vi.fn(),
    rafraichir: vi.fn(async () => {}),
    miseAJourLe: new Date('2026-10-17T09:00:00+02:00'),
    aujourdhui,
  }
}

/** Espace de démonstration vidé de ses appels, demandes, travaux, assemblées et annonces. */
function espaceVide(): EspaceCopro {
  const e = espaceDemo()
  return {
    ...e,
    interventions: { mesDemandes: [], immeuble: [] },
    finances: { ...e.finances, solde: 0, appels: [], factures: [], impayes: [] },
    assemblees: [],
    annonces: [],
  }
}

function appel(partiel: Partial<AppelDeCharges> & { id: string }): AppelDeCharges {
  return {
    exercice: '2026-T4', periodeDebut: '2026-10-01', periodeFin: '2026-12-31',
    montantTotal: 855, montantPaye: 0, resteAPayer: 855, statut: 'a_payer', echeance: '2026-10-15',
    iban: '', referencePaiement: '',
    ...partiel,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('EcranAccueil — données de démonstration', () => {
  it('affiche en premier la salutation, le lot et la carte « À régler » avant l’échéance', () => {
    render(<EcranAccueil {...propsPour(espaceDemo(), new Date('2026-10-10T12:00:00'))} />)

    expect(paragraphe('Bonjour Géraldine')).toBeInTheDocument()
    expect(paragraphe('Résidence Le Prado · bâtiment D · lot 12')).toBeInTheDocument()
    expect(screen.getByText(t.charges.ceQueVousDevez)).toBeInTheDocument()
    expect(paragraphe('À régler : 855 € avant le 15 octobre 2026')).toBeInTheDocument()
    expect(screen.queryByText(/En retard/)).toBeNull()
    expect(screen.getByRole('button', { name: t.accueil.voirCommentPayer })).toBeInTheDocument()
  })

  it('passe la carte en « En retard » quand l’échéance est dépassée (date du jour système)', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-20T10:00:00'))
    render(<EcranAccueil {...propsPour(espaceDemo())} />)

    expect(paragraphe('En retard : 855 € depuis le 15 octobre 2026')).toBeInTheDocument()
    expect(absenceParagraphe('À régler : 855 € avant le 15 octobre 2026')).toBe(true)
  })

  it('« Voir comment payer » ouvre Charges & paiements', () => {
    const props = propsPour(espaceDemo(), new Date('2026-10-10T12:00:00'))
    render(<EcranAccueil {...props} />)
    fireEvent.click(screen.getByRole('button', { name: t.accueil.voirCommentPayer }))
    expect(props.allerA).toHaveBeenCalledWith('charges')
  })

  it('« Signaler un problème » ouvre le formulaire de demande', () => {
    const props = propsPour(espaceDemo(), new Date('2026-10-10T12:00:00'))
    render(<EcranAccueil {...props} />)
    fireEvent.click(screen.getByRole('button', { name: t.commun.signalerProbleme }))
    expect(props.allerA).toHaveBeenCalledWith('demandes', 'nouvelle')
  })

  it('liste les demandes en cours (statut en mots) avec le détail et le lien vers toutes les demandes', () => {
    const props = propsPour(espaceDemo(), new Date('2026-10-10T12:00:00'))
    render(<EcranAccueil {...props} />)

    expect(screen.getByText(`${t.accueil.demandesEnCours} (1)`)).toBeInTheDocument()
    expect(screen.getByText('Ascenseur')).toBeInTheDocument()
    expect(screen.getByText(t.demandes.statuts.en_attente)).toBeInTheDocument()
    expect(screen.getByText('Envoyée le 29 septembre 2026')).toBeInTheDocument()
    // La demande terminée (Plomberie) n'est pas une demande en cours.
    expect(screen.queryByText(t.demandes.statuts.terminee)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(t.commun.voirDetail) }))
    expect(props.allerA).toHaveBeenCalledWith('demandes', 'demo-sig-1')

    fireEvent.click(screen.getByRole('button', { name: t.accueil.voirToutesDemandes }))
    expect(props.allerA).toHaveBeenCalledWith('demandes')
  })

  it('annonce la prochaine assemblée convoquée avec les résolutions en attente de vote', () => {
    const espace = espaceDemo()
    const ag = espace.assemblees.find(a => a.statut === 'convoquee')
    expect(ag).toBeDefined()
    const props = propsPour(espace, new Date('2026-10-10T12:00:00'))
    render(<EcranAccueil {...props} />)

    expect(screen.getByText(t.accueil.prochaineAssemblee)).toBeInTheDocument()
    expect(screen.getByText(ag!.titre)).toBeInTheDocument()
    expect(screen.getByText(dateHeure(ag!.date, 'fr'))).toBeInTheDocument()
    expect(screen.getByText('3 résolution(s) sur 3 attendent votre vote')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: t.accueil.voter }))
    expect(props.allerA).toHaveBeenCalledWith('assemblees')
  })

  it('remplace « Voter » par « Voir le détail » quand le vote par correspondance est clos', () => {
    // Trois jours avant la séance du 19 novembre 2026 : limite le 16 ; le 18, c'est clos.
    render(<EcranAccueil {...propsPour(espaceDemo(), new Date('2026-11-18T12:00:00'))} />)
    expect(screen.queryByRole('button', { name: t.accueil.voter })).toBeNull()
    expect(screen.getByText(/Le vote par correspondance est clos/)).toBeInTheDocument()
  })

  it('montre les travaux en cours de l’immeuble (3 au plus) et les deux dernières annonces', () => {
    const props = propsPour(espaceDemo(), new Date('2026-10-10T12:00:00'))
    render(<EcranAccueil {...props} />)

    expect(screen.getByText(`${t.accueil.travauxEnCours} (2)`)).toBeInTheDocument()
    expect(screen.getByText('Électricité — Parking / garage')).toBeInTheDocument()
    expect(screen.getByText('Élec Services Phocéens')).toBeInTheDocument()
    expect(screen.getByText(t.demandes.statutsTravaux.acceptee)).toBeInTheDocument()
    expect(screen.getByText('Peinture — Hall d’entrée')).toBeInTheDocument()
    expect(screen.getByText(t.demandes.statutsTravaux.en_cours)).toBeInTheDocument()
    // Les missions terminées ne sont pas des travaux en cours.
    expect(screen.queryByText(/^Ascenseur — /)).toBeNull()

    expect(screen.getByText(t.accueil.dernieresAnnonces)).toBeInTheDocument()
    expect(screen.getByText('Convocation — AG extraordinaire du 19 novembre')).toBeInTheDocument()
    expect(screen.getByText(t.annonces.important)).toBeInTheDocument()
    expect(screen.getByText('Coupure d’eau froide — mardi 20 octobre')).toBeInTheDocument()
    expect(screen.getByText(t.annonces.urgent)).toBeInTheDocument()
    expect(screen.queryByText(/Ravalement de la façade : calendrier/)).toBeNull()

    const voirTout = screen.getAllByRole('button', { name: t.commun.voirTout })
    expect(voirTout).toHaveLength(2)
    fireEvent.click(voirTout[0])
    expect(props.allerA).toHaveBeenCalledWith('demandes', 'travaux')
    fireEvent.click(voirTout[1])
    expect(props.allerA).toHaveBeenCalledWith('annonces')
  })
})

describe('EcranAccueil — états particuliers', () => {
  it('état vide : aucun appel, aucune demande, aucun travaux, aucune annonce, pas d’assemblée', () => {
    render(<EcranAccueil {...propsPour(espaceVide(), new Date('2026-10-10T12:00:00'))} />)

    expect(screen.getByText(t.accueil.aucunAppel)).toBeInTheDocument()
    expect(screen.queryByText(/0 €/)).toBeNull()
    expect(screen.queryByRole('button', { name: t.accueil.voirCommentPayer })).toBeNull()
    expect(screen.getByText(`${t.accueil.demandesEnCours} (0)`)).toBeInTheDocument()
    expect(screen.getByText(t.accueil.aucuneDemande)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.accueil.voirToutesDemandes })).toBeNull()
    expect(screen.queryByText(t.accueil.prochaineAssemblee)).toBeNull()
    expect(screen.getByText(t.accueil.aucunTravaux)).toBeInTheDocument()
    expect(screen.getByText(t.accueil.aucuneAnnonce)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.commun.signalerProbleme })).toBeInTheDocument()
  })

  it('carte verte « Vous êtes à jour » quand les appels sont tous soldés', () => {
    const espace = espaceDemo()
    espace.finances.appels = espace.finances.appels.filter(a => a.resteAPayer === 0)
    render(<EcranAccueil {...propsPour(espace, new Date('2026-10-10T12:00:00'))} />)

    expect(screen.getByText(t.accueil.aJour)).toBeInTheDocument()
    expect(screen.queryByText(/À régler/)).toBeNull()
    expect(screen.getByRole('button', { name: t.accueil.voirCommentPayer })).toBeInTheDocument()
  })

  it('locataire : ni carte financière ni assemblée, mais le signalement et ses demandes', () => {
    const espace = espaceDemo()
    espace.profil = { ...espace.profil, role: 'locataire' }
    render(<EcranAccueil {...propsPour(espace, new Date('2026-10-20T12:00:00'))} />)

    expect(screen.queryByText(t.charges.ceQueVousDevez)).toBeNull()
    expect(screen.queryByText(/En retard/)).toBeNull()
    expect(screen.queryByRole('button', { name: t.accueil.voirCommentPayer })).toBeNull()
    expect(screen.queryByText(t.accueil.prochaineAssemblee)).toBeNull()
    expect(screen.queryByRole('button', { name: t.accueil.voter })).toBeNull()
    expect(screen.getByRole('button', { name: t.commun.signalerProbleme })).toBeInTheDocument()
    expect(screen.getByText(`${t.accueil.demandesEnCours} (1)`)).toBeInTheDocument()
    expect(screen.getByText(`${t.accueil.travauxEnCours} (2)`)).toBeInTheDocument()
  })
})

describe('prochainAppel', () => {
  const aujourdhui = new Date('2026-10-10T12:00:00')

  it('retourne null sans appel ou quand tout est soldé', () => {
    expect(prochainAppel([], aujourdhui)).toBeNull()
    expect(prochainAppel([appel({ id: 'a', resteAPayer: 0, statut: 'solde' })], aujourdhui)).toBeNull()
  })

  it('ignore les appels annulés même avec un reste à payer', () => {
    expect(prochainAppel([appel({ id: 'a', statut: 'annule', resteAPayer: 300 })], aujourdhui)).toBeNull()
  })

  it('choisit l’appel dont l’échéance est la plus proche, quel que soit l’ordre de la liste', () => {
    const resultat = prochainAppel(espaceDemo().finances.appels, aujourdhui)
    expect(resultat?.appel.id).toBe('demo-appel-t4')
    expect(resultat?.appel.resteAPayer).toBe(855)
    expect(resultat?.enRetard).toBe(false)

    const inverse = prochainAppel([
      appel({ id: 'tard', echeance: '2026-12-01' }),
      appel({ id: 'tot', echeance: '2026-10-15' }),
    ], aujourdhui)
    expect(inverse?.appel.id).toBe('tot')
  })

  it('place les appels sans échéance en dernier', () => {
    const resultat = prochainAppel([
      appel({ id: 'sans', echeance: '' }),
      appel({ id: 'avec', echeance: '2026-12-01' }),
    ], aujourdhui)
    expect(resultat?.appel.id).toBe('avec')

    const seul = prochainAppel([appel({ id: 'sans', echeance: '' })], aujourdhui)
    expect(seul?.appel.id).toBe('sans')
    expect(seul?.enRetard).toBe(false)
  })

  it('signale le retard quand l’échéance est passée, pas le jour même', () => {
    expect(prochainAppel([appel({ id: 'a', echeance: '2026-10-15' })], new Date('2026-10-16T00:30:00'))?.enRetard).toBe(true)
    expect(prochainAppel([appel({ id: 'a', echeance: '2026-10-15' })], new Date('2026-10-15T23:30:00'))?.enRetard).toBe(false)
  })

  it('signale le retard dès que le syndic a marqué l’appel en retard, même avant l’échéance', () => {
    const resultat = prochainAppel([appel({ id: 'a', statut: 'en_retard', echeance: '2026-12-01' })], aujourdhui)
    expect(resultat?.enRetard).toBe(true)
  })

  it('un appel payé en partie compte pour son reste à payer', () => {
    const resultat = prochainAppel([appel({ id: 'a', statut: 'partiellement_paye', montantPaye: 400, resteAPayer: 455 })], aujourdhui)
    expect(resultat?.appel.resteAPayer).toBe(455)
  })
})
