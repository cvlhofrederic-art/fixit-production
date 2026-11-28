import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEMO_COPROPRIETAIRES, type CoproprietaireDemo } from '@/components/administrateur-judiciaire/data/coproprietaires'
import { LotsCoproprietairesModule } from '@/components/administrateur-judiciaire/modules/patrimoine/LotsCoproprietairesModule'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Lots & copropriétaires : fiche du compte copropriétaire sur le modèle de la fiche client de Gestéam (identité,
 * personnes du compte, télécoms, rattachement, lots et tantièmes, notification, conseil syndical, extranet, notes),
 * avec le locataire du lot (nom, prénom, téléphone, courriel), demande de Hugo du 29/10/2026.
 */

async function monter() {
  await act(async () => {
    render(
      <ToastProvider>
        <LotsCoproprietairesModule />
      </ToastProvider>,
    )
  })
}

/** Ouvre la fiche du copropriétaire nommé, par sa ligne du registre. */
function ouvrirFiche(nom: string): HTMLElement {
  fireEvent.click(screen.getByText(nom))
  return screen.getByRole('dialog', { name: nom })
}

/** Valeur affichée sous un libellé de la fiche. */
const valeurSous = (fiche: HTMLElement, libelle: string) =>
  within(fiche).getByText(libelle).nextElementSibling?.textContent

/** Copropriétaire de démonstration vérifiant la condition (le test échoue s'il n'y en a aucun). */
function exemple(condition: (coproprietaire: CoproprietaireDemo) => boolean): CoproprietaireDemo {
  const trouve = DEMO_COPROPRIETAIRES.find(condition)
  if (!trouve) throw new Error('Aucun exemple dans la démonstration.')
  return trouve
}

describe('Lots & copropriétaires — données de la fiche', () => {
  it('chaque compte a une identité, une adresse, un numéro, des personnes, des lots et des tantièmes', () => {
    for (const { fiche } of DEMO_COPROPRIETAIRES) {
      expect(fiche.civilite.trim()).not.toBe('')
      expect(fiche.nomFamille.trim()).not.toBe('')
      expect(fiche.adresse.trim()).not.toBe('')
      expect(fiche.codePostal).toMatch(/^\d{5}$/)
      expect(fiche.numeroCompte).toMatch(/^\d{5}$/)
      expect(fiche.personnes.length).toBeGreaterThan(0)
      expect(fiche.lots.length).toBeGreaterThan(0)
      expect(fiche.cles.length).toBeGreaterThan(0)
    }
    const numeros = DEMO_COPROPRIETAIRES.map(({ fiche }) => fiche.numeroCompte)
    expect(new Set(numeros).size).toBe(numeros.length)
  })

  it('chaque locataire a un nom, un prénom, un téléphone et un courriel, et son lot est déclaré loué', () => {
    const bailleurs = DEMO_COPROPRIETAIRES.filter((coproprietaire) => coproprietaire.locataire)
    expect(bailleurs.length).toBeGreaterThan(0)
    for (const { locataire, fiche } of bailleurs) {
      if (!locataire) continue
      expect(locataire.nom.trim()).not.toBe('')
      expect(locataire.prenom.trim()).not.toBe('')
      expect(locataire.tel.trim()).not.toBe('')
      expect(locataire.mail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      expect(fiche.lots.some((lot) => lot.occupation === 'Loué')).toBe(true)
    }
    for (const { fiche } of DEMO_COPROPRIETAIRES.filter((coproprietaire) => !coproprietaire.locataire))
      expect(fiche.lots.every((lot) => lot.occupation !== 'Loué')).toBe(true)
  })
})

describe('Lots & copropriétaires — fiche du compte', () => {
  it('affiche les blocs de la fiche Gestéam', async () => {
    const coproprietaire = exemple((c) => c.locataire !== null)
    await monter()
    const fiche = ouvrirFiche(coproprietaire.nom)
    for (const bloc of [
      'Identité et adresse',
      'Personnes du compte',
      'Téléphones et courriels',
      'Compte et rattachement',
      'Lots et tantièmes',
      'Locataire du lot',
      'Notifications et diffusion',
      'Conseil syndical et extranet',
      'Notes et avertissement',
    ])
      expect(within(fiche).getByRole('region', { name: bloc })).toBeInTheDocument()
    expect(within(fiche).getByText(`Compte copropriétaire n° ${coproprietaire.fiche.numeroCompte} · ${coproprietaire.copro}`)).toBeInTheDocument()
    expect(valeurSous(fiche, 'Civilité')).toBe(coproprietaire.fiche.civilite)
    expect(valeurSous(fiche, 'Mandat')).toBe(coproprietaire.fiche.mandat)
  })

  it('le lot loué montre le nom, le prénom, le téléphone et le courriel du locataire', async () => {
    const bailleur = exemple((c) => c.locataire !== null)
    if (!bailleur.locataire) throw new Error('Exemple sans locataire.')
    await monter()
    const fiche = ouvrirFiche(bailleur.nom)
    expect(valeurSous(fiche, 'Nom du locataire')).toBe(bailleur.locataire.nom)
    expect(valeurSous(fiche, 'Prénom du locataire')).toBe(bailleur.locataire.prenom)
    expect(valeurSous(fiche, 'Téléphone du locataire')).toBe(bailleur.locataire.tel)
    expect(valeurSous(fiche, 'Courriel du locataire')).toBe(bailleur.locataire.mail)
    // Les coordonnées du copropriétaire restent les siennes, dans ses télécoms.
    const telecoms = within(fiche).getByRole('region', { name: 'Téléphones et courriels' })
    expect(within(telecoms).getByText(bailleur.tel)).toBeInTheDocument()
    expect(within(telecoms).getByText(bailleur.mail)).toBeInTheDocument()
    expect(within(telecoms).queryByText(bailleur.locataire.tel)).toBeNull()
  })

  it('un lot sans locataire le dit, sans champs vides', async () => {
    const occupant = exemple((c) => c.locataire === null)
    await monter()
    const fiche = ouvrirFiche(occupant.nom)
    expect(valeurSous(fiche, 'Locataire')).toBe('Aucun locataire déclaré')
    expect(within(fiche).queryByText('Nom du locataire')).toBeNull()
  })

  it('une indivision liste chaque indivisaire avec sa part', async () => {
    const indivision = exemple((c) => c.fiche.personnes.length > 1)
    await monter()
    const personnes = within(ouvrirFiche(indivision.nom)).getByRole('region', { name: 'Personnes du compte' })
    for (const personne of indivision.fiche.personnes) {
      const ligne = within(personnes).getByText(personne.identite).closest('tr') as HTMLElement
      expect(within(ligne).getByText(personne.relation)).toBeInTheDocument()
      expect(within(ligne).getByText(personne.part)).toBeInTheDocument()
    }
  })

  it('la voie postale demandée change la voie et l’envoi recommandé', async () => {
    const postal = exemple((c) => c.fiche.voiePostaleDemandee)
    const electronique = exemple((c) => !c.fiche.voiePostaleDemandee)
    await monter()
    let fiche = ouvrirFiche(postal.nom)
    expect(valeurSous(fiche, 'Voie de notification')).toBe('Postale (demandée)')
    expect(valeurSous(fiche, 'Envoi recommandé')).toBe('Papier (LRAR)')
    fireEvent.click(within(fiche).getAllByRole('button', { name: 'Fermer' })[0])
    fiche = ouvrirFiche(electronique.nom)
    expect(valeurSous(fiche, 'Voie de notification')).toBe('Électronique')
    expect(valeurSous(fiche, 'Envoi recommandé')).toBe('Électronique (LRE)')
  })

  it('l’avertissement s’affiche en tête de la fiche', async () => {
    const averti = exemple((c) => c.fiche.avertissement !== null)
    await monter()
    const fiche = ouvrirFiche(averti.nom)
    expect(within(fiche).getAllByText(averti.fiche.avertissement as string).length).toBe(2)
    expect(within(fiche).getByText('Avertissement')).toBeInTheDocument()
  })

  it('le conseil syndical et l’extranet sont des cases cochées ou non', async () => {
    const president = exemple((c) => c.fiche.conseilSyndical.president)
    await monter()
    const fiche = ouvrirFiche(president.nom)
    expect(within(fiche).getByLabelText('Président')).toBeChecked()
    expect(within(fiche).getByLabelText('Membre du conseil syndical')).toBeChecked()
    expect(within(fiche).getByLabelText('Extranet publié')).toHaveProperty('checked', president.fiche.extranet.publie)
  })
})

describe('Lots & copropriétaires — saisie du locataire', () => {
  it('« Modifier la fiche » ajoute puis retire le locataire', async () => {
    const occupant = exemple((c) => c.locataire === null)
    await monter()
    fireEvent.click(within(ouvrirFiche(occupant.nom)).getByRole('button', { name: /Modifier la fiche/ }))
    let formulaire = screen.getByRole('dialog', { name: `Modifier la fiche — ${occupant.nom}` })
    const saisir = (libelle: string, valeur: string) =>
      fireEvent.change(within(formulaire).getByLabelText(libelle), { target: { value: valeur } })
    saisir('Nom du locataire', 'Roux')
    saisir('Prénom du locataire', 'Léa')
    saisir('Téléphone du locataire', '06 00 00 00 01')
    saisir('Courriel du locataire', 'lea.roux@email.fr')
    fireEvent.click(within(formulaire).getByRole('button', { name: 'Enregistrer' }))

    let fiche = screen.getByRole('dialog', { name: occupant.nom })
    expect(valeurSous(fiche, 'Nom du locataire')).toBe('Roux')
    expect(valeurSous(fiche, 'Prénom du locataire')).toBe('Léa')
    expect(valeurSous(fiche, 'Téléphone du locataire')).toBe('06 00 00 00 01')
    expect(valeurSous(fiche, 'Courriel du locataire')).toBe('lea.roux@email.fr')

    fireEvent.click(within(fiche).getByRole('button', { name: /Modifier la fiche/ }))
    formulaire = screen.getByRole('dialog', { name: `Modifier la fiche — ${occupant.nom}` })
    expect(within(formulaire).getByLabelText('Nom du locataire')).toHaveValue('Roux')
    for (const libelle of ['Nom du locataire', 'Prénom du locataire', 'Téléphone du locataire', 'Courriel du locataire'])
      saisir(libelle, '')
    fireEvent.click(within(formulaire).getByRole('button', { name: 'Enregistrer' }))
    fiche = screen.getByRole('dialog', { name: occupant.nom })
    expect(valeurSous(fiche, 'Locataire')).toBe('Aucun locataire déclaré')
  })

  it('le formulaire « Ajouter un copropriétaire » propose les quatre champs du locataire', async () => {
    await monter()
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un copropriétaire' }))
    const formulaire = screen.getByRole('dialog', { name: 'Ajouter un copropriétaire' })
    expect(within(formulaire).getByLabelText('Nom du locataire')).toHaveAttribute('type', 'text')
    expect(within(formulaire).getByLabelText('Prénom du locataire')).toHaveAttribute('type', 'text')
    expect(within(formulaire).getByLabelText('Téléphone du locataire')).toHaveAttribute('type', 'tel')
    expect(within(formulaire).getByLabelText('Courriel du locataire')).toHaveAttribute('type', 'email')
  })
})
