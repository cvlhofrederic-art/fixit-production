// tests/components/aj-signalement/consigne-secours.test.tsx
//
// R70 du dossier téléphonie (14/11/2026, brouillon : textes à valider par le référent métier, présentation par Frédéric, portugais H4) :
// une urgence déclarée par QR code n'alerte aucun secours. La page publique le dit :
//   - consigne permanente en tête du formulaire, avant les coordonnées (FR, PT) ;
//   - consigne renforcée sous le choix d'urgence, seulement quand « urgent » est choisi (absente avant le choix, avec
//     « non » et avec « gênant ») ; elle ne prend pas le focus, elle n'est jamais une alerte ni répétée par une autre
//     région vivante ; une région créée avec son texte n'étant pas lue à coup sûr, elle décrit le bouton d'envoi
//     (aria-describedby) tant que « urgent » est choisi, et lui seul : elle est lue quand la personne atteint le bouton ;
//   - même consigne renforcée sur l'écran de confirmation d'un signalement envoyé comme urgent, et là seulement.
// Textes : lib/aj-signalement/textes.ts (consigneSecours, consigneSecoursUrgente). Données fictives.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AppSignalementQr from '@/components/aj-signalement/AppSignalementQr'
import { TEXTES_SIGNALEMENT_QR } from '@/lib/aj-signalement/textes'
import { TYPES_PROBLEME, textesCopro } from '@/lib/coproprietaire/textes'
import type { LangueSignalementQr } from '@/lib/aj-signalement/types'

const JETON = '0123456789abcdef0123456789abcdef'
const REPONSE_OK = { signalement: { id: 'b1c2d3e4-0000-4000-8000-000000000000', numero: 'B1C2D3E4', creeLe: '2026-11-04T14:05:00.000Z', emailEnvoye: true } }

type Urgence = 'non' | 'genant' | 'urgent'
type Coordonnees = 'prenom' | 'nom' | 'telephone' | 'email' | 'batiment' | 'etage' | 'numLot'

beforeEach(() => {
  vi.unstubAllGlobals()
  window.scrollTo = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(REPONSE_OK), { status: 200, headers: { 'content-type': 'application/json' } })))
})

function rendre(langue: LangueSignalementQr = 'fr') {
  return render(<AppSignalementQr jeton={JETON} copropriete={{ nom: 'Résidence Exemple', adresse: '1 rue Exemple, 13001 Marseille' }} langue={langue} />)
}

const libelleUrgence = (urgence: Urgence, langue: LangueSignalementQr = 'fr'): string => {
  const d = textesCopro(langue).demandes
  if (urgence === 'urgent') return d.urgenceUrgent
  return urgence === 'genant' ? d.urgenceGenant : d.urgenceNon
}

const choisirUrgence = (urgence: Urgence, langue: LangueSignalementQr = 'fr') => {
  const radio = screen.getByLabelText(libelleUrgence(urgence, langue))
  radio.focus()
  fireEvent.click(radio)
  return radio
}

/** Coordonnées, qualité, « dans mon logement », type et description : tout sauf l'urgence. */
function remplirSaufUrgence(langue: LangueSignalementQr = 'fr') {
  const tq = TEXTES_SIGNALEMENT_QR[langue]
  const t = textesCopro(langue)
  const valeurs: Record<Coordonnees, string> = {
    prenom: 'Prénom', nom: 'Déclarant', telephone: '06 00 00 00 00', email: 'declarant@exemple.test', batiment: 'B', etage: '4', numLot: '12',
  }
  for (const champ of Object.keys(valeurs) as Coordonnees[]) {
    fireEvent.change(screen.getByLabelText(tq[champ]), { target: { value: valeurs[champ] } })
  }
  fireEvent.click(screen.getByLabelText(tq.qualites.proprietaire))
  const logement = document.querySelector<HTMLInputElement>('input[type="radio"][value="logement"]')
  if (!logement) throw new Error('choix « dans mon logement » introuvable')
  fireEvent.click(logement)
  fireEvent.change(screen.getByLabelText(t.demandes.typeProbleme), { target: { value: TYPES_PROBLEME[langue][0] } })
  fireEvent.change(screen.getByLabelText(t.demandes.decrivez), { target: { value: 'Description fictive assez longue' } })
}

async function envoyer(urgence: Urgence, langue: LangueSignalementQr = 'fr') {
  const tq = TEXTES_SIGNALEMENT_QR[langue]
  remplirSaufUrgence(langue)
  choisirUrgence(urgence, langue)
  fireEvent.click(screen.getByRole('button', { name: tq.envoyer }))
  await waitFor(() => expect(screen.getByRole('button', { name: tq.autreSignalement })).toBeInTheDocument())
}

const renforcee = (langue: LangueSignalementQr = 'fr') => screen.queryByText(TEXTES_SIGNALEMENT_QR[langue].consigneSecoursUrgente.texte)

describe('textes de la consigne d’appel aux secours (FR et PT)', () => {
  it.each(['fr', 'pt'] as const)('%s : consigne permanente et consigne renforcée non vides, avec le 112', (langue) => {
    const tq = TEXTES_SIGNALEMENT_QR[langue]
    for (const texte of [tq.consigneSecours, tq.consigneSecoursUrgente.titre, tq.consigneSecoursUrgente.texte]) {
      expect(texte.trim()).not.toBe('')
    }
    expect(tq.consigneSecours).toContain('112')
    expect(tq.consigneSecoursUrgente.texte).toContain('112')
  })

  it('FR : les numéros d’urgence français (112, 18, 15, 17) et le 114 pour les personnes sourdes ou malentendantes', () => {
    const { texte } = TEXTES_SIGNALEMENT_QR.fr.consigneSecoursUrgente
    for (const numero of ['112', '18', '15', '17', '114']) expect(texte).toMatch(new RegExp(`\\b${numero}\\b`))
    expect(texte).toContain('sourdes ou malentendantes')
  })

  it('PT : le 112 seul (aucun numéro français)', () => {
    const tq = TEXTES_SIGNALEMENT_QR.pt
    for (const texte of [tq.consigneSecours, tq.consigneSecoursUrgente.texte]) {
      expect(texte).not.toMatch(/\b(15|17|18|114)\b/)
    }
  })

  it('ne promet ni délai ni intervention ; dit que le signalement n’alerte pas les secours', () => {
    const fr = TEXTES_SIGNALEMENT_QR.fr
    const pt = TEXTES_SIGNALEMENT_QR.pt
    for (const texte of [fr.consigneSecours, fr.consigneSecoursUrgente.texte, pt.consigneSecours, pt.consigneSecoursUrgente.texte]) {
      expect(texte).not.toMatch(/\d+ ?h\b|sous \d|em \d|interviendra|intervention|intervenção/i)
    }
    expect(fr.consigneSecours).toContain('il n’alerte pas les secours')
    expect(fr.consigneSecoursUrgente.texte).toContain('n’alerte pas les secours')
    expect(pt.consigneSecours).toContain('não alerta os serviços de emergência')
    expect(pt.consigneSecoursUrgente.texte).toContain('não alerta os serviços de emergência')
  })
})

describe('formulaire public : consigne permanente', () => {
  it.each(['fr', 'pt'] as const)('%s : présente dès le premier rendu, avant les coordonnées', (langue) => {
    const tq = TEXTES_SIGNALEMENT_QR[langue]
    rendre(langue)
    const consigne = screen.getByText(tq.consigneSecours)
    const premierChamp = screen.getByLabelText(tq.prenom)
    expect(consigne.compareDocumentPosition(premierChamp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(consigne.compareDocumentPosition(screen.getByText(tq.coordonnees)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('jamais une alerte (rôle « status » de l’Encadre), le seul message d’alerte reste l’erreur d’envoi', () => {
    rendre()
    expect(screen.getByText(TEXTES_SIGNALEMENT_QR.fr.consigneSecours).closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('formulaire public : consigne renforcée sous le choix d’urgence', () => {
  it('absente avant le choix, présente avec « urgent » (titre et texte), sous le choix d’urgence', () => {
    const tq = TEXTES_SIGNALEMENT_QR.fr
    rendre()
    expect(renforcee()).toBeNull()
    expect(screen.queryByText(tq.consigneSecoursUrgente.titre)).toBeNull()
    const radio = choisirUrgence('urgent')
    expect(renforcee()).toBeInTheDocument()
    expect(screen.getByText(tq.consigneSecoursUrgente.titre)).toBeInTheDocument()
    expect(radio.compareDocumentPosition(renforcee() as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Avant le bouton d'envoi.
    expect((renforcee() as HTMLElement).compareDocumentPosition(screen.getByRole('button', { name: tq.envoyer })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each(['non', 'genant'] as const)('absente avec « %s », y compris après un passage par « urgent »', (urgence) => {
    rendre()
    choisirUrgence(urgence)
    expect(renforcee()).toBeNull()
    choisirUrgence('urgent')
    expect(renforcee()).toBeInTheDocument()
    choisirUrgence(urgence)
    expect(renforcee()).toBeNull()
  })

  it('ne vole pas le focus ; jamais une alerte ni « assertive », aucune autre région vivante ne la répète', () => {
    rendre()
    const radio = choisirUrgence('urgent')
    expect(document.activeElement).toBe(radio)
    const texte = renforcee() as HTMLElement
    const region = texte.closest('[role="status"]')
    expect(region).not.toBeNull()
    expect(texte.closest('[role="alert"], [aria-live="assertive"]')).toBeNull()
    // Aucune autre région vivante ne la répète : elle n'est pas lue deux fois.
    const regions = Array.from(document.querySelectorAll('[role="status"], [role="alert"], [aria-live]'))
    expect(regions.filter((r) => (r.textContent ?? '').includes(TEXTES_SIGNALEMENT_QR.fr.consigneSecoursUrgente.texte))).toEqual([region])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('portugais : la consigne renforcée portugaise', () => {
    const tqPt = TEXTES_SIGNALEMENT_QR.pt
    rendre('pt')
    choisirUrgence('urgent', 'pt')
    expect(screen.getByText(tqPt.consigneSecoursUrgente.titre)).toBeInTheDocument()
    expect(renforcee('pt')).toBeInTheDocument()
    expect(renforcee('fr')).toBeNull()
  })
})

// Relecture : la région « status » est créée avec son texte, donc pas annoncée à coup sûr (règle du dépôt,
// SignalementsSemblablesQr.tsx) ; la consigne renforcée décrit le bouton d'envoi tant que « urgent » est choisi.
describe('formulaire public : la consigne renforcée décrit le bouton d’envoi', () => {
  const boutonEnvoyer = (langue: LangueSignalementQr = 'fr') => screen.getByRole('button', { name: TEXTES_SIGNALEMENT_QR[langue].envoyer })

  it.each(['fr', 'pt'] as const)('%s : avec « urgent », formulaire complet, le bouton (actif) est décrit par le titre et le texte', (langue) => {
    const { titre, texte } = TEXTES_SIGNALEMENT_QR[langue].consigneSecoursUrgente
    rendre(langue)
    remplirSaufUrgence(langue)
    expect(boutonEnvoyer(langue)).not.toHaveAccessibleDescription()
    choisirUrgence('urgent', langue)
    const bouton = boutonEnvoyer(langue)
    expect(bouton).toBeEnabled()
    expect(bouton).toHaveAccessibleDescription(expect.stringContaining(titre))
    expect(bouton).toHaveAccessibleDescription(expect.stringContaining(texte))
  })

  it.each(['non', 'genant'] as const)('avec « %s » : aucune description, y compris après un passage par « urgent »', (urgence) => {
    rendre()
    remplirSaufUrgence()
    choisirUrgence(urgence)
    expect(boutonEnvoyer()).not.toHaveAccessibleDescription()
    choisirUrgence('urgent')
    expect(boutonEnvoyer()).toHaveAccessibleDescription(expect.stringContaining(TEXTES_SIGNALEMENT_QR.fr.consigneSecoursUrgente.texte))
    choisirUrgence(urgence)
    expect(boutonEnvoyer()).not.toHaveAccessibleDescription()
    expect(boutonEnvoyer()).not.toHaveAttribute('aria-describedby')
  })

  it('le bouton d’envoi est le seul élément décrit par la consigne ; elle ne vise pas un élément absent', () => {
    rendre()
    remplirSaufUrgence()
    choisirUrgence('urgent')
    const decrits = Array.from(document.querySelectorAll('[aria-describedby]'))
    const parConsigne = decrits.filter((el) => (el.getAttribute('aria-describedby') ?? '').split(/\s+/).some((id) => {
      const cible = id ? document.getElementById(id) : null
      return (cible?.textContent ?? '').includes(TEXTES_SIGNALEMENT_QR.fr.consigneSecoursUrgente.texte)
    }))
    expect(parConsigne).toEqual([boutonEnvoyer()])
  })
})

describe('écran de confirmation', () => {
  it('signalement urgent : la consigne renforcée, dans la carte de confirmation', async () => {
    const tq = TEXTES_SIGNALEMENT_QR.fr
    rendre()
    await envoyer('urgent')
    expect(screen.getByText('Numéro : B1C2D3E4')).toBeInTheDocument()
    expect(screen.getByText(tq.consigneSecoursUrgente.titre)).toBeInTheDocument()
    const texte = renforcee() as HTMLElement
    expect(texte).toBeInTheDocument()
    expect(texte.closest('section')).toBe(screen.getByText('Numéro : B1C2D3E4').closest('section'))
    expect(texte.closest('[role="alert"], [aria-live="assertive"]')).toBeNull()
  })

  it.each(['non', 'genant'] as const)('signalement « %s » : pas de consigne renforcée', async (urgence) => {
    rendre()
    await envoyer(urgence)
    expect(screen.getByText('Numéro : B1C2D3E4')).toBeInTheDocument()
    expect(renforcee()).toBeNull()
    expect(screen.queryByText(TEXTES_SIGNALEMENT_QR.fr.consigneSecoursUrgente.titre)).toBeNull()
  })

  it('« Faire un autre signalement » : formulaire vide, consigne permanente, consigne renforcée absente tant que « urgent » n’est pas choisi', async () => {
    const tq = TEXTES_SIGNALEMENT_QR.fr
    rendre()
    await envoyer('urgent')
    fireEvent.click(screen.getByRole('button', { name: tq.autreSignalement }))
    expect(screen.getByText(tq.consigneSecours)).toBeInTheDocument()
    expect(renforcee()).toBeNull()
  })

  it('portugais, signalement urgent : la consigne renforcée portugaise', async () => {
    rendre('pt')
    await envoyer('urgent', 'pt')
    expect(screen.getByText(TEXTES_SIGNALEMENT_QR.pt.consigneSecoursUrgente.titre)).toBeInTheDocument()
    expect(renforcee('pt')).toBeInTheDocument()
  })
})

// Décisions du 14/11/2026 (relecture du brouillon) : vocabulaire de la page aligné (« administrateur de la
// copropriété », comme le reste de la page ; PT « ocorrência », « administrador do condomínio ») ; textes voisins sans
// promesse (ni réception « immédiate », ni rappel certain).
describe('vocabulaire et promesses de la page publique (décisions du 14/11/2026)', () => {
  const fr = TEXTES_SIGNALEMENT_QR.fr
  const pt = TEXTES_SIGNALEMENT_QR.pt

  it('FR : les consignes nomment l’administrateur de la copropriété, jamais un « gestionnaire »', () => {
    for (const texte of [fr.consigneSecours, fr.consigneSecoursUrgente.texte]) {
      expect(texte).toContain('l’administrateur de la copropriété')
      expect(texte).not.toMatch(/gestionnaire/i)
    }
  })

  it('PT : les consignes parlent de l’« ocorrência » et de l’administrador do condomínio, comme le reste de la page', () => {
    for (const texte of [pt.consigneSecours, pt.consigneSecoursUrgente.texte]) {
      expect(texte).toContain('ocorrência')
      expect(texte).toContain('administrador do condomínio')
      expect(texte).not.toMatch(/gestor|comunicação/i)
    }
  })

  it('l’accroche ne promet pas une réception immédiate (FR et PT)', () => {
    expect(fr.accroche).not.toMatch(/immédiat/i)
    expect(pt.accroche).not.toMatch(/imediat/i)
    expect(fr.accroche).toContain('{copropriete}')
    expect(pt.accroche).toContain('{copropriete}')
  })

  it('la confirmation ne promet pas de rappel : « pourra vous recontacter » (FR et PT), comme l’accusé de réception', () => {
    expect(fr.confirmationSuite).toContain('pourra vous recontacter')
    expect(fr.confirmationSuite).not.toMatch(/recontactera/)
    expect(pt.confirmationSuite).toContain('poderá contactá-lo')
    expect(pt.confirmationSuite).not.toMatch(/contactá-lo-á/)
    for (const t of [fr.confirmationSuite, pt.confirmationSuite]) {
      expect(t).toContain('{telephone}')
      expect(t).toContain('{email}')
    }
  })
})
