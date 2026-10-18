// tests/components/coproprietaire/charges.test.tsx
//
// Écran « Charges & paiements » du portail copropriétaire (EcranCharges) :
// - rendu avec l'espace de démonstration : carte « Ce que vous devez » (855 € et l'échéance),
//   IBAN et référence copiables, 7 appels en cartes avec statuts en mots, 2 factures,
//   bloc « Comprendre mes charges » sans montant négatif ;
// - état vide (aucun appel) : phrase dédiée, jamais « 0 € » ;
// - retard (statut en_retard ou échéance passée) : carte rouge, relance mentionnée ;
// - PDF d'une facture : GET /api/coproprietaire/factures/{id}/pdf en Bearer puis window.open ;
//   sans jeton, encadré « démonstration » ; erreur → encadré persistant sous la facture ;
// - règle pure `prochainAppelCharges`.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import EcranCharges, { ID_CARTE_CE_QUE_VOUS_DEVEZ, prochainAppelCharges } from '@/components/coproprietaire-dashboard/ecrans/EcranCharges'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { espaceDemo, IBAN_DEMO } from '@/lib/coproprietaire/demo'
import { dateLongue, euros, remplir, textesCopro } from '@/lib/coproprietaire/textes'
import type { AppelDeCharges, EspaceCopro, FinancesCopro, ImpayeCopro } from '@/lib/coproprietaire/types'

const t = textesCopro('fr')

/** Même normalisation que Testing Library (espaces insécables des montants → espace simple). */
const n = (texte: string) => texte.replace(/\s+/g, ' ').trim()

/** Le 10 octobre 2026 : l'appel du 4e trimestre (échéance 15 octobre) n'est pas encore en retard. */
const AVANT_ECHEANCE = new Date('2026-10-10T09:00:00+02:00')
/** Le 17 octobre 2026 (date du chargement de la démo) : l'échéance du 15 octobre est passée. */
const APRES_ECHEANCE = new Date('2026-10-17T12:00:00+02:00')

function props(espace: EspaceCopro, surcharge: Partial<PropsEcran> = {}): PropsEcran {
  return {
    espace, t, langue: 'fr', jeton: null, allerA: vi.fn(), rafraichir: vi.fn(async () => {}), miseAJourLe: AVANT_ECHEANCE, ...surcharge,
  }
}

const APPEL_BASE: AppelDeCharges = {
  id: 'appel-1', exercice: '2026-T4', periodeDebut: '2026-10-01', periodeFin: '2026-12-31',
  montantTotal: 855, montantPaye: 0, resteAPayer: 855, statut: 'a_payer', echeance: '2026-10-15',
  iban: IBAN_DEMO, referencePaiement: 'PAY-2026-004-LOT12',
}
const appel = (surcharge: Partial<AppelDeCharges>): AppelDeCharges => ({ ...APPEL_BASE, ...surcharge })

function espaceAvec(finances: Partial<FinancesCopro>): EspaceCopro {
  const espace = espaceDemo()
  return { ...espace, finances: { ...espace.finances, ...finances } }
}

function carteDue(container: HTMLElement): HTMLElement {
  const carte = container.querySelector<HTMLElement>(`#${ID_CARTE_CE_QUE_VOUS_DEVEZ}`)
  if (!carte) throw new Error('carte « Ce que vous devez » absente')
  return carte
}

function reponseJson(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('EcranCharges — rendu avec la démonstration', () => {
  it('affiche ce que je dois : 855 € avant le 15 octobre 2026, IBAN et référence copiables', () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true })

    const { container } = render(<EcranCharges {...props(espaceDemo())} />)

    const carte = carteDue(container)
    expect(carte).toHaveTextContent(t.charges.ceQueVousDevez)
    expect(carte).toHaveTextContent(n(remplir(t.charges.aReglerAvant, { montant: euros(855), date: dateLongue('2026-10-15') })))
    expect(carte.className).toContain('border-[#C9A84C]') // carte or : à régler, pas en retard

    // Comment payer : virement, IBAN et référence de l'appel concerné, pas de paiement en ligne.
    expect(screen.getByText(t.charges.commentPayer)).toBeInTheDocument()
    expect(screen.getByText(t.charges.parVirement)).toBeInTheDocument()
    expect(screen.getByText(t.charges.pasDePaiementEnLigne)).toBeInTheDocument()
    expect(screen.queryByText(t.charges.ibanInconnu)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: t.charges.copierIban }))
    expect(writeText).toHaveBeenCalledWith(IBAN_DEMO)
    fireEvent.click(screen.getByRole('button', { name: t.commun.copier }))
    expect(writeText).toHaveBeenCalledWith('PAY-2026-004-LOT12')

    // Aucun vocabulaire de cabinet ni montant négatif.
    expect(container.textContent).not.toMatch(/impay/i)
    expect(container.textContent).not.toContain('a_payer')
    expect(container).not.toHaveTextContent('-855')
  })

  it('liste les 7 appels en cartes, du plus récent au plus ancien, avec des statuts en mots', () => {
    render(<EcranCharges {...props(espaceDemo())} />)

    expect(screen.getByRole('heading', { name: t.charges.vosAppels })).toBeInTheDocument()
    const titres = screen.getAllByText(/^Charges du /)
    expect(titres).toHaveLength(7)
    expect(titres[0]).toHaveTextContent(remplir(t.charges.chargesDu, { debut: dateLongue('2026-12-01'), fin: dateLongue('2027-02-28') }))
    expect(titres[6]).toHaveTextContent(remplir(t.charges.chargesDu, { debut: dateLongue('2025-10-01'), fin: dateLongue('2025-12-31') }))

    expect(screen.getAllByText(t.charges.statutsAppel.a_payer)).toHaveLength(3)
    expect(screen.getAllByText(t.charges.statutsAppel.solde)).toHaveLength(4)
    expect(screen.getByText('2026-T4')).toBeInTheDocument() // exercice brut, en petit
    expect(screen.getAllByText(t.commun.voirDetail)).toHaveLength(7)
    expect(screen.getAllByText('PAY-2026-004-LOT12').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('affiche les 2 factures du syndic avec TTC, TVA, statut, sans bouton PDF quand il n’est pas archivé', () => {
    render(<EcranCharges {...props(espaceDemo())} />)

    expect(screen.getByRole('heading', { name: t.charges.factures })).toBeInTheDocument()
    expect(screen.getByText('FC-2026-0042')).toBeInTheDocument()
    expect(screen.getByText('FC-2025-0117')).toBeInTheDocument()
    expect(screen.getByText(n(euros(125)))).toBeInTheDocument()
    expect(screen.getByText(n(euros(12)))).toBeInTheDocument()
    expect(screen.getByText(n(remplir(t.charges.dontTva, { montant: euros(2) })))).toBeInTheDocument()
    expect(screen.getAllByText(t.charges.statutsFacture.reglee)).toHaveLength(2)
    expect(screen.getByText(/trop-perçu remboursé/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.charges.ouvrirPdf })).not.toBeInTheDocument()
    expect(screen.queryByText(t.charges.retardsDePaiement)).not.toBeInTheDocument()
  })

  it('explique mes charges : tantièmes, budget et solde dû sans montant négatif', () => {
    const { container } = render(<EcranCharges {...props(espaceDemo())} />)

    expect(screen.getByText(t.charges.comprendre)).toBeInTheDocument()
    expect(screen.getByText(n(remplir(t.charges.tantiemesPhrase, { tantiemes: '450', total: n('10 000'), pourcentage: n('4,5 %') })))).toBeInTheDocument()
    expect(screen.getByText(n(remplir(t.charges.budgetPhrase, { budget: euros(45000), depenses: euros(31200) })))).toBeInTheDocument()
    expect(screen.getByText(n(remplir(t.charges.soldeDu, { montant: euros(855) })))).toBeInTheDocument()
    expect(screen.queryByText(/en votre faveur/)).not.toBeInTheDocument()
    expect(container).not.toHaveTextContent('-855')
  })
})

describe('EcranCharges — états', () => {
  it('sans appel mais une facture échue : carte « Retard de paiement » et moyens de paiement à demander au syndic', () => {
    const espace = espaceAvec({ solde: 0, appels: [], impayes: [], factures: [{ id: 'f1', numero: 'FC-2026-0001', emiseLe: '2026-06-16', echeance: '2026-07-01', montantHt: 690, tvaTaux: 0, montantTtc: 690, description: 'Appel de provisions T3 2026', statut: 'a_regler', pdfDisponible: false }] })
    const { container } = render(<EcranCharges {...props(espace)} />)

    expect(n(carteDue(container).textContent ?? '')).toContain(n(remplir(t.charges.retard, { montant: euros(690), date: '1er juillet 2026' })))
    expect(screen.getByText(t.charges.commentPayer)).toBeInTheDocument()
    expect(screen.getByText(t.charges.ibanInconnu)).toBeInTheDocument()
    expect(screen.queryByText(t.charges.aucunAppel)).not.toBeInTheDocument()
    expect(screen.queryByText(t.charges.vosAppels)).not.toBeInTheDocument()
  })

  it('sans appel ni facture, solde débiteur : carte « Solde de votre compte : 855 € (somme due) »', () => {
    const { container } = render(<EcranCharges {...props(espaceAvec({ solde: -855, appels: [], factures: [], impayes: [] }))} />)
    expect(n(carteDue(container).textContent ?? '')).toContain(n(remplir(t.charges.soldeDu, { montant: euros(855) })))
    expect(screen.getByText(t.charges.ibanInconnu)).toBeInTheDocument()
  })

  it('appels tous payés mais une facture à régler : la carte annonce la facture, l’IBAN du dernier appel reste proposé', () => {
    const espace = espaceAvec({
      solde: 0, impayes: [], appels: [appel({ id: 'a-paye', statut: 'solde', montantPaye: 855, resteAPayer: 0 })],
      factures: [{ id: 'f2', numero: 'FC-2026-0002', emiseLe: '2026-10-01', echeance: '2026-11-30', montantHt: 50, tvaTaux: 0, montantTtc: 50, description: 'Frais', statut: 'a_regler', pdfDisponible: false }],
    })
    const { container } = render(<EcranCharges {...props(espace)} />)

    expect(n(carteDue(container).textContent ?? '')).toContain(n(remplir(t.charges.aReglerAvant, { montant: euros(50), date: '30 novembre 2026' })))
    expect(screen.getByText(t.charges.commentPayer)).toBeInTheDocument()
    expect(screen.getAllByText(IBAN_DEMO).length).toBeGreaterThan(0)
    expect(screen.queryByText(t.charges.aJour)).not.toBeInTheDocument()
  })

  it('sans appel : phrase dédiée et bouton vers « Poser une question », jamais « 0 € »', () => {
    const allerA = vi.fn()
    const { container } = render(<EcranCharges {...props(espaceAvec({ solde: 0, appels: [], factures: [], impayes: [] }), { allerA })} />)

    expect(screen.getByText(t.charges.aucunAppel)).toBeInTheDocument()
    expect(container.querySelector(`#${ID_CARTE_CE_QUE_VOUS_DEVEZ}`)).toBeNull()
    expect(screen.queryByText(t.charges.commentPayer)).not.toBeInTheDocument()
    expect(screen.queryByText(t.charges.aJour)).not.toBeInTheDocument()
    expect(screen.queryByText(n(euros(0)))).not.toBeInTheDocument()
    expect(n(container.textContent ?? '')).not.toMatch(/\b0\s*€/) // « 45 000 € » du budget n'est pas « 0 € »
    expect(screen.getByText(t.charges.aucuneFacture)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: t.menu.question }))
    expect(allerA).toHaveBeenCalledWith('question')
  })

  it('tout est payé : carte verte « Vous êtes à jour », sans bloc « Comment payer »', () => {
    const soldes = espaceDemo().finances.appels.filter(a => a.statut === 'solde')
    const { container } = render(<EcranCharges {...props(espaceAvec({ appels: soldes }))} />)

    const carte = carteDue(container)
    expect(carte).toHaveTextContent(t.charges.aJour)
    expect(carte.className).toContain('border-[#7FB08A]')
    expect(screen.queryByText(t.charges.commentPayer)).not.toBeInTheDocument()
    expect(screen.getAllByText(/^Charges du /)).toHaveLength(4)
  })

  it('appel en_retard : carte rouge avec le montant, la date et la relance envoyée', () => {
    const retard: ImpayeCopro = {
      id: 'retard-1', montant: 855, nature: 'charges_courantes', depuis: '2026-07-16', nbRelances: 2, derniereRelanceLe: '2026-09-20', statut: 'ouvert',
    }
    const appels = [
      appel({ id: 'a-t3', exercice: '2026-T3', periodeDebut: '2026-07-01', periodeFin: '2026-09-30', echeance: '2026-07-15', statut: 'en_retard' }),
      appel({ id: 'a-t4', echeance: '2026-10-15', statut: 'a_payer' }),
    ]
    const { container } = render(<EcranCharges {...props(espaceAvec({ appels, impayes: [retard] }))} />)

    const carte = carteDue(container)
    expect(carte.className).toContain('border-[#D98B82]')
    expect(carte).toHaveTextContent(n(remplir(t.charges.retard, { montant: euros(855), date: dateLongue('2026-07-15') })))
    // La relance est affichée en début de ligne, donc avec une majuscule initiale.
    expect(n(carte.textContent ?? '')).toMatch(new RegExp(n(remplir(t.charges.relanceEnvoyee, { date: dateLongue('2026-09-20') })), 'i'))
    expect(screen.getByText(t.charges.statutsAppel.en_retard)).toBeInTheDocument()

    // Section « Retards de paiement » : nature en mots, montant, depuis, relances, statut — jamais « impayé ».
    expect(screen.getByRole('heading', { name: t.charges.retardsDePaiement })).toBeInTheDocument()
    expect(screen.getByText(t.charges.natures.charges_courantes)).toBeInTheDocument()
    expect(screen.getByText(t.charges.statutsImpaye.ouvert)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(n(remplir(t.charges.depuisLe, { date: dateLongue('2026-07-16') })), 'i'))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(n(remplir(t.charges.relances, { n: 2 })).replace(/[()]/g, '\\$&')))).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/impay/i)
  })

  it('échéance passée sans statut en_retard : carte rouge « Retard de paiement » (démo au 17 octobre 2026)', () => {
    const { container } = render(<EcranCharges {...props(espaceDemo(), { miseAJourLe: APRES_ECHEANCE })} />)

    const carte = carteDue(container)
    expect(carte.className).toContain('border-[#D98B82]')
    expect(carte).toHaveTextContent(n(remplir(t.charges.retard, { montant: euros(855), date: dateLongue('2026-10-15') })))
    expect(carte).not.toHaveTextContent(/relance/i) // aucun retard enregistré dans la démo : pas de relance
  })

  it('sans IBAN communiqué : encadré « ibanInconnu », la référence reste copiable', () => {
    render(<EcranCharges {...props(espaceAvec({ appels: [appel({ iban: '' })] }))} />)

    expect(screen.getByText(t.charges.ibanInconnu)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.charges.copierIban })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.commun.copier })).toBeInTheDocument()
  })

  it('locataire : aucune donnée financière affichée', () => {
    const espace = espaceDemo()
    espace.profil.role = 'locataire'
    const { container } = render(<EcranCharges {...props(espace)} />)

    expect(container.querySelector(`#${ID_CARTE_CE_QUE_VOUS_DEVEZ}`)).toBeNull()
    expect(screen.queryByText(t.charges.vosAppels)).not.toBeInTheDocument()
    expect(container).not.toHaveTextContent(n(euros(855)))
  })
})

describe('EcranCharges — PDF d’une facture', () => {
  const factureAvecPdf = () => {
    // Espace réel (source 'reel') : en démonstration, l'ouverture du PDF est simulée sans appel réseau.
    const espace = { ...espaceDemo(), source: 'reel' as const }
    espace.finances.factures = [{ ...espace.finances.factures[0], pdfDisponible: true }]
    return espace
  }

  it('avec jeton : demande l’URL signée en Bearer puis ouvre un nouvel onglet', async () => {
    const fetchMock = vi.fn(async () => reponseJson({ url: 'https://exemple.test/facture-0042.pdf' }))
    vi.stubGlobal('fetch', fetchMock)
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(<EcranCharges {...props(factureAvecPdf(), { jeton: 'jeton-test' })} />)
    fireEvent.click(screen.getByRole('button', { name: t.charges.ouvrirPdf }))

    await waitFor(() => expect(open).toHaveBeenCalledWith('https://exemple.test/facture-0042.pdf', '_blank', 'noopener'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/coproprietaire/factures/demo-fact-1/pdf',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer jeton-test' }) }),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: t.charges.ouvrirPdf })).toBeEnabled())
  })

  it('sans jeton (démonstration) : encadré d’information, aucun appel réseau', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(<EcranCharges {...props(factureAvecPdf(), { jeton: null })} />)
    fireEvent.click(screen.getByRole('button', { name: t.charges.ouvrirPdf }))

    expect(screen.getByRole('status')).toHaveTextContent(/démonstration/)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('erreur du serveur : encadré d’erreur persistant sous la facture, bouton réutilisable', async () => {
    const fetchMock = vi.fn(async () => reponseJson({ error: 'Une erreur interne est survenue' }, 500))
    vi.stubGlobal('fetch', fetchMock)
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { rerender } = render(<EcranCharges {...props(factureAvecPdf(), { jeton: 'jeton-test' })} />)
    fireEvent.click(screen.getByRole('button', { name: t.charges.ouvrirPdf }))

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(t.documents.erreurOuverture)
    expect(open).not.toHaveBeenCalled()

    // L'encadré est dans la carte de la facture et ne s'efface pas tout seul.
    expect(within(alerte.closest('section') as HTMLElement).getByText('FC-2026-0042')).toBeInTheDocument()
    await new Promise(resolve => setTimeout(resolve, 60))
    rerender(<EcranCharges {...props(factureAvecPdf(), { jeton: 'jeton-test' })} />)
    expect(screen.getByRole('alert')).toHaveTextContent(t.documents.erreurOuverture)
    expect(screen.getByRole('button', { name: t.charges.ouvrirPdf })).toBeEnabled()
  })

  it('réponse sans URL exploitable : traitée comme une erreur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reponseJson({ ok: true })))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<EcranCharges {...props(factureAvecPdf(), { jeton: 'jeton-test' })} />)
    fireEvent.click(screen.getByRole('button', { name: t.charges.ouvrirPdf }))

    expect(await screen.findByRole('alert')).toHaveTextContent(t.documents.erreurOuverture)
    expect(open).not.toHaveBeenCalled()
  })
})

describe('prochainAppelCharges', () => {
  const le15 = new Date('2026-10-15T12:00:00')

  it('rien à payer : null (liste vide, tout soldé, ou seulement des appels annulés)', () => {
    expect(prochainAppelCharges([], le15)).toBeNull()
    expect(prochainAppelCharges([appel({ resteAPayer: 0, statut: 'solde' })], le15)).toBeNull()
    expect(prochainAppelCharges([appel({ statut: 'annule', resteAPayer: 855 })], le15)).toBeNull()
  })

  it('retient l’appel non soldé à l’échéance la plus proche, quel que soit l’ordre reçu', () => {
    const resultat = prochainAppelCharges([
      appel({ id: 'dec', echeance: '2026-12-01', resteAPayer: 1462.5 }),
      appel({ id: 'nov', echeance: '2026-11-05', resteAPayer: 220 }),
      appel({ id: 'oct', echeance: '2026-10-20', resteAPayer: 855 }),
      appel({ id: 'paye', echeance: '2026-07-15', resteAPayer: 0, statut: 'solde' }),
      appel({ id: 'annule', echeance: '2026-01-15', resteAPayer: 300, statut: 'annule' }),
    ], le15)
    expect(resultat?.appel.id).toBe('oct')
    expect(resultat?.enRetard).toBe(false)
  })

  it('en retard si le statut est en_retard, même avec une échéance future', () => {
    const resultat = prochainAppelCharges([appel({ echeance: '2026-11-30', statut: 'en_retard' })], le15)
    expect(resultat?.enRetard).toBe(true)
  })

  it('en retard si l’échéance est passée ; pas le jour même ni avant', () => {
    expect(prochainAppelCharges([appel({ echeance: '2026-10-14' })], le15)?.enRetard).toBe(true)
    expect(prochainAppelCharges([appel({ echeance: '2026-10-15' })], le15)?.enRetard).toBe(false)
    expect(prochainAppelCharges([appel({ echeance: '2026-10-16' })], le15)?.enRetard).toBe(false)
  })

  it('un appel sans échéance passe après les autres et n’est jamais en retard par la date', () => {
    const resultat = prochainAppelCharges([
      appel({ id: 'sans-date', echeance: '' }),
      appel({ id: 'date', echeance: '2027-01-15' }),
    ], le15)
    expect(resultat?.appel.id).toBe('date')
    expect(prochainAppelCharges([appel({ id: 'sans-date', echeance: '' })], le15)).toEqual({ appel: appel({ id: 'sans-date', echeance: '' }), enRetard: false })
  })

  it('un appel partiellement payé compte pour son reste', () => {
    const resultat = prochainAppelCharges([appel({ statut: 'partiellement_paye', montantPaye: 400, resteAPayer: 455 })], le15)
    expect(resultat?.appel.resteAPayer).toBe(455)
  })
})
