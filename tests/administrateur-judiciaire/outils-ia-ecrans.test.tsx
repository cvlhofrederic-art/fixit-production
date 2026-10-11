import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { RedactionPvModule } from '@/components/administrateur-judiciaire/modules/outils-ia/RedactionPvModule'
import { SaisieFacturesModule } from '@/components/administrateur-judiciaire/modules/outils-ia/SaisieFacturesModule'
import { AnalyseDevisFacturesModule } from '@/components/administrateur-judiciaire/modules/technique/AnalyseDevisFacturesModule'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { AUJOURDHUI_ISO, CLE_STOCKAGE_MODE, dateLocaleIso } from '@/lib/administrateur-judiciaire/mode'

/**
 * Écrans IA de la succursale branchés sur Claude (via /api/administrateur-judiciaire/outils) :
 * - Analyse de devis & factures : le texte collé part à l'IA, l'analyse s'affiche en Markdown sous le formulaire ;
 * - Rédaction de PV : projet rédigé pour la copropriété et les résolutions choisies, « Copier » copie vraiment ;
 * - Saisie de factures : le fichier choisi est lu par l'IA, le formulaire d'import est pré-rempli, la facture
 *   rejoint la liste.
 * Échec de l'IA : toast, aucun résultat fictif. La route est simulée (fetch) ; aucun appel réseau.
 */

async function monter(ecran: 'analyse' | 'pv' | 'saisie') {
  await act(async () => {
    render(
      <ToastProvider>
        {ecran === 'analyse' ? <AnalyseDevisFacturesModule /> : ecran === 'pv' ? <RedactionPvModule /> : <SaisieFacturesModule />}
      </ToastProvider>,
    )
  })
}

const corpsDe = (appel: unknown[]) => JSON.parse(String((appel[1] as RequestInit).body))

/** Réponse de la route retenue jusqu'à l'appel de `repondre` (pour observer l'attente). */
function routeEnAttente() {
  let repondre: (reponse: Response) => void = () => undefined
  const appel = vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>((resoudre) => (repondre = resoudre)))
  vi.stubGlobal('fetch', appel)
  return { appel, repondre: (reponse: Response) => act(async () => repondre(reponse)) }
}

describe('Écrans IA — Claude', () => {
  beforeEach(async () => {
    localStorage.removeItem(CLE_STOCKAGE_MODE)
    await viderBaseLocale()
    await initialiserBaseDemo()
    useDonneesStore.setState({ loading: false })
    await useDonneesStore.getState().loadAll()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  describe('Analyse de devis & factures', () => {
    const DEVIS = 'DEVIS Toitures Nord — réfection couverture 120 m² × 95 € HT, TVA 20 %'

    it('champ vide : toast d’invite, aucun appel', async () => {
      const appel = vi.fn()
      vi.stubGlobal('fetch', appel)
      await monter('analyse')
      fireEvent.click(screen.getByRole('button', { name: /Analyser/ }))
      expect(await screen.findByText('Aucun document à analyser')).toBeInTheDocument()
      expect(appel).not.toHaveBeenCalled()
    })

    it('envoie le texte collé, montre l’attente, puis affiche l’analyse en Markdown sous le formulaire', async () => {
      const { appel, repondre } = routeEnAttente()
      await monter('analyse')
      fireEvent.change(screen.getByLabelText('Contenu du devis ou de la facture'), { target: { value: `  ${DEVIS}  ` } })
      fireEvent.click(screen.getByRole('button', { name: /Analyser/ }))

      expect(screen.getByRole('status')).toHaveTextContent('Analyse du document en cours…')
      expect(screen.getByRole('button', { name: /Analyser/ })).toBeDisabled()
      // Date réelle du poste (pas la date figée de la démonstration) : un devis collé est daté d'aujourd'hui.
      expect(corpsDe(appel.mock.calls[0])).toEqual({ tache: 'analyse-devis', texte: DEVIS, dateDuJour: dateLocaleIso(new Date()) })
      expect(appel.mock.calls[0][0]).toBe('/api/administrateur-judiciaire/outils')

      await repondre(Response.json({ text: '## Verdict\n**À renégocier** : forfait échafaudage non détaillé.' }))
      const resultat = screen.getByRole('region', { name: "Résultat de l'analyse" })
      expect(within(resultat).getByRole('heading', { name: 'Verdict' })).toBeInTheDocument()
      expect(within(resultat).getByText('À renégocier').tagName).toBe('STRONG')
      expect(resultat.textContent).not.toContain('**')
      expect(screen.queryByRole('status')).toBeNull()
      expect(screen.getByRole('button', { name: /Analyser/ })).toBeEnabled()
      expect(screen.queryByText('Simulation')).toBeNull()
    })

    it('IA indisponible : toast d’erreur, aucun résultat affiché', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'ia_indisponible' }, { status: 502 })))
      await monter('analyse')
      fireEvent.change(screen.getByLabelText('Contenu du devis ou de la facture'), { target: { value: DEVIS } })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Analyser/ }))
      })
      expect(await screen.findByText('Analyse impossible')).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: "Résultat de l'analyse" })).toBeNull()
    })
  })

  describe('Rédaction de procès-verbaux', () => {
    const PV = '## Procès-verbal de l’assemblée générale\n\n**Copropriété :** Le Clos des Vignes\n\n- Présents : [À COMPLÉTER]'
    const closDesVignes = DEMO_COPROPRIETES.find((copro) => copro.nom === 'Le Clos des Vignes')!

    it('génère le PV de la copropriété choisie, avec les résolutions cochées dans l’ordre et le mandat de la base', async () => {
      const { appel, repondre } = routeEnAttente()
      await monter('pv')
      fireEvent.change(screen.getByLabelText('Copropriété'), { target: { value: 'Le Clos des Vignes' } })
      fireEvent.click(screen.getByRole('button', { name: /Quitus au syndic/ }))
      fireEvent.click(screen.getByRole('button', { name: /Générer le PV/ }))

      expect(screen.getByRole('status')).toHaveTextContent('Rédaction du projet de PV en cours…')
      expect(screen.getByRole('button', { name: /Générer le PV/ })).toBeDisabled()
      const corps = corpsDe(appel.mock.calls[0])
      expect(corps.tache).toBe('redaction-pv')
      expect(corps.copropriete).toBe('Le Clos des Vignes')
      expect(corps.resolutions).toEqual(['Approbation des comptes 2025', 'Vote des travaux de toiture', 'Quitus au syndic'])
      expect(corps.dateDuJour).toBe(AUJOURDHUI_ISO)
      expect(corps.contexte.copropriete.nom).toBe('Le Clos des Vignes')
      expect(corps.contexte.copropriete.mandat.tribunal).toBe(closDesVignes.tribunal)
      expect(corps.contexte.copropriete.mandat.rg).toBe(closDesVignes.rg)
      expect(JSON.stringify(corps)).not.toContain('Résidence Le Méridien')

      await repondre(Response.json({ text: PV }))
      const projet = screen.getByRole('region', { name: "Projet de PV rédigé par l'IA" })
      expect(within(projet).getByRole('heading', { name: 'Procès-verbal de l’assemblée générale' })).toBeInTheDocument()
      expect(within(projet).getByText('Présents : [À COMPLÉTER]')).toBeInTheDocument()
      expect(screen.getByText('Projet de PV rédigé')).toBeInTheDocument()
      // Aucun document figé (ancienne simulation « Résidence Le Méridien · séance du 8 juillet 2026 »).
      expect(screen.queryByText(/séance du 8 juillet/)).toBeNull()

      // Une autre sélection rend la trame : le projet affiché correspond toujours aux paramètres.
      fireEvent.click(screen.getByRole('button', { name: /Élection du conseil syndical/ }))
      expect(screen.queryByRole('region', { name: "Projet de PV rédigé par l'IA" })).toBeNull()
      expect(screen.getByText(/4\. Élection du conseil syndical — vote : \[À COMPLÉTER\]/)).toBeInTheDocument()
    })

    it('« Copier » copie le projet rédigé (texte brut, sans marques Markdown) dans le presse-papiers et le confirme', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Response.json({ text: PV })))
      const writeText = vi.fn(async (_texte: string) => undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      await monter('pv')
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Générer le PV/ }))
      })
      await screen.findByRole('region', { name: "Projet de PV rédigé par l'IA" })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Copier/ }))
      })
      expect(writeText).toHaveBeenCalledWith(
        'Procès-verbal de l’assemblée générale\n\nCopropriété : Le Clos des Vignes\n\n- Présents : [À COMPLÉTER]',
      )
      expect(screen.getByText('Copié')).toBeInTheDocument()
      expect(screen.getByText('Projet de PV copié dans le presse-papiers.')).toBeInTheDocument()
    })

    it('presse-papiers refusé : toast d’erreur ; sans projet, « Copier » porte sur la trame affichée', async () => {
      const writeText = vi.fn(async (_texte: string) => {
        throw new DOMException('refus', 'NotAllowedError')
      })
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      await monter('pv')
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Copier/ }))
      })
      expect(writeText.mock.calls[0][0]).toContain("PROCÈS-VERBAL D'ASSEMBLÉE GÉNÉRALE")
      expect(writeText.mock.calls[0][0]).toContain('Résidence Le Méridien')
      expect(screen.getByText('Copie impossible')).toBeInTheDocument()
    })

    it('IA indisponible : toast d’erreur, la trame reste affichée', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'ia_indisponible' }, { status: 502 })))
      await monter('pv')
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Générer le PV/ }))
      })
      expect(await screen.findByText('Rédaction impossible')).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: "Projet de PV rédigé par l'IA" })).toBeNull()
      expect(screen.getByText(/RÉSOLUTIONS SOUMISES AU VOTE/)).toBeInTheDocument()
    })
  })

  describe('Saisie de factures', () => {
    const champFichier = () => screen.getByLabelText('Facture fournisseur à importer (PDF, PNG, JPEG ou WebP)') as HTMLInputElement
    const choisir = (fichier: File) =>
      act(async () => {
        fireEvent.change(champFichier(), { target: { files: [fichier] } })
      })
    const totalFactures = () => screen.getByText('Total factures').previousElementSibling?.textContent

    const FACTURE = {
      fournisseur: 'Plomberie Centrale',
      siret: '12345678900012',
      numero: 'FAC-2026-077',
      date: '2026-05-28',
      montant_ht: 1000,
      tva: 100,
      montant_ttc: 1100,
      copropriete_probable: 'Le Clos des Vignes',
      compte_charge_suggere: '615 — Entretien et petites réparations',
      libelle: 'Remplacement colonne EF',
    }

    it('lit le fichier avec l’IA, pré-remplit le formulaire d’import, puis ajoute la facture à la liste', async () => {
      const { appel, repondre } = routeEnAttente()
      await monter('saisie')
      expect(totalFactures()).toBe('4')
      await choisir(new File(['contenu-png'], 'facture-plomberie.png', { type: 'image/png' }))

      expect(screen.getByRole('button', { name: /Lecture de la facture…/ })).toBeDisabled()
      // Lecture du fichier (FileReader) avant l'appel de la route.
      await waitFor(() => expect(appel).toHaveBeenCalled())
      const corps = corpsDe(appel.mock.calls[0])
      expect(corps.tache).toBe('saisie-facture')
      expect(corps.nomFichier).toBe('facture-plomberie.png')
      expect(corps.fichier).toBe(`data:image/png;base64,${btoa('contenu-png')}`)
      expect(corps.coproprietes.map((copro: { nom: string }) => copro.nom)).toContain('Le Clos des Vignes')

      await repondre(Response.json({ facture: FACTURE, modele: 'claude-sonnet-5-5' }))
      const formulaire = screen.getByRole('dialog')
      expect(within(formulaire).getByText(/facture-plomberie\.png/)).toBeInTheDocument()
      expect(within(formulaire).getByLabelText('Fournisseur')).toHaveValue('Plomberie Centrale')
      expect(within(formulaire).getByLabelText('N° facture')).toHaveValue('FAC-2026-077')
      expect(within(formulaire).getByLabelText('Date')).toHaveValue('28/05/2026')
      expect(within(formulaire).getByLabelText('Montant TTC (€)')).toHaveValue('1100,00')
      expect(within(formulaire).getByLabelText('Copropriété')).toHaveValue('Le Clos des Vignes')
      expect(within(formulaire).getByLabelText('Compte de charge suggéré')).toHaveValue('615 — Entretien et petites réparations')

      await act(async () => {
        fireEvent.click(within(formulaire).getByRole('button', { name: /Importer/ }))
      })
      expect(screen.getByText('Facture importée')).toBeInTheDocument()
      const ligne = screen.getByText('FAC-2026-077').closest('tr') as HTMLElement
      expect(within(ligne).getByText('Plomberie Centrale')).toBeInTheDocument()
      expect(within(ligne).getByText('à valider')).toBeInTheDocument()
      expect(totalFactures()).toBe('5')
      expect(screen.getByRole('button', { name: /Importer des factures/ })).toBeEnabled()
    })

    it('montants incohérents : la facture importée est classée en anomalie', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Response.json({ facture: { ...FACTURE, montant_ttc: 1500 } })))
      await monter('saisie')
      await choisir(new File(['%PDF-1.7'], 'facture.pdf', { type: 'application/pdf' }))
      const formulaire = await screen.findByRole('dialog')
      expect(within(formulaire).getByText(/HT \+ TVA ne correspond pas au TTC/)).toBeInTheDocument()
      await act(async () => {
        fireEvent.click(within(formulaire).getByRole('button', { name: /Importer/ }))
      })
      const ligne = screen.getByText('FAC-2026-077').closest('tr') as HTMLElement
      expect(within(ligne).getByText('anomalie')).toBeInTheDocument()
    })

    it('fichier trop volumineux ou format non pris en charge : toast, aucun appel', async () => {
      const appel = vi.fn()
      vi.stubGlobal('fetch', appel)
      await monter('saisie')
      const lourd = new File(['x'], 'scan.jpg', { type: 'image/jpeg' })
      Object.defineProperty(lourd, 'size', { value: 4 * 1024 * 1024 + 1 })
      await choisir(lourd)
      expect(screen.getByText('Fichier trop volumineux')).toBeInTheDocument()
      await choisir(new File(['GIF89a'], 'facture.gif', { type: 'image/gif' }))
      expect(screen.getByText('Format non pris en charge')).toBeInTheDocument()
      expect(appel).not.toHaveBeenCalled()
    })

    it('IA indisponible : toast d’erreur, aucune facture ajoutée', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'ia_indisponible' }, { status: 502 })))
      await monter('saisie')
      await choisir(new File(['contenu'], 'facture.webp', { type: 'image/webp' }))
      expect(await screen.findByText('Lecture impossible')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(totalFactures()).toBe('4')
    })
  })
})
