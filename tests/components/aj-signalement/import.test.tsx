// tests/components/aj-signalement/import.test.tsx
//
// Assistant d'import des copropriétés (espace AJ Signalement, vue Copropriétés, super admin ; SPEC § 1.9, demande de
// Hugo du 10/11/2026). PR brouillon pour Frédéric : composants et styles de l'espace.
//   - cabinet client obligatoire (choisi d'office s'il est seul ; aucun cabinet → renvoi vers la vue Cabinets) ;
//   - fichier lu sur l'appareil (jamais envoyé), modèle Excel ou CSV à télécharger ;
//   - correspondance des colonnes proposée d'après les en-têtes, 5 premières valeurs en regard ;
//   - lignes en erreur de format jamais envoyées ; vérification à blanc au serveur (mode « verifier ») ;
//   - aperçu : états, messages, filtres ; doublon existant : ignorer, compléter, « ce n'est pas un doublon » ;
//   - gestionnaires sans fiche : création une par une (P1-R9), puis nouvelle vérification ; hors domaines : case par
//     adresse ; destinataires hors domaines : confirmation avant l'import ;
//   - création (mode « creer ») ; 409 a_reverifier : aperçu mis à jour ; résultat : affiches en lot, export CSV.
// Réseau simulé (fetch) ; données fictives (@exemple.test, « Villa Exemple », cabinet-exemple).

import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { remplir } from '@/lib/coproprietaire/textes'
import { TEXTES_IMPORT_QR as I } from '@/lib/aj-signalement/import/textes'
import { TEXTES_TABLEAU_QR as T } from '@/lib/aj-signalement/affichage'
import type { CabinetQr, DiagnosticLigneImportQr, VerificationImportQr } from '@/lib/aj-signalement/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/aj-signalement/qr', async (original) => ({
  ...(await original<typeof import('@/lib/aj-signalement/qr')>()),
  affichesPdfQr: vi.fn(async (_liste: unknown, avancement?: (fait: number, total: number) => void) => { avancement?.(1, 1); return new Blob(['%PDF']) }),
  telechargerFichier: vi.fn(),
}))

const qr = await import('@/lib/aj-signalement/qr')
const { default: AssistantImportQr } = await import('@/components/aj-signalement/AssistantImportQr')
const { default: TableauSignalementsQr } = await import('@/components/aj-signalement/TableauSignalementsQr')

const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const K2 = 'a0000000-0000-4000-8000-0000000000a2'
const E1 = 'c0000000-0000-4000-8000-000000000001'
const NOUVELLE = 'c0000000-0000-4000-8000-000000000101'
const JETON = 'b'.repeat(32)
/** Copropriété créée telle que la route la rend (nom, adresse, code postal et ville lus en base). */
const CREEE = { numeroLigne: 2, id: NOUVELLE, jeton: JETON, nom: 'Villa Exemple', adresse: '', codePostal: '13002', ville: 'Marseille' }

const cabinet = (id: string, nom: string, identifiant: string): CabinetQr => ({
  id, nom, identifiant, langue: 'fr', domaines: ['exemple.test'], identifiantFige: false, nbCoproprietes: 0, nbGestionnaires: 0,
})
const CABINET = cabinet(K1, 'Cabinet Exemple', 'cabinet-exemple')

const CSV = [
  'Nom de la copropriété;Code postal;Ville;Gestionnaire(s);Destinataires supplémentaires;Téléphone du président',
  'Villa Exemple;13002;Marseille;marie.exemple@exemple.test;;0600000000',
  'Mas Exemple;130;Marseille;;;',
  'Le Parc;13008;Marseille;;;',
].join('\r\n')

const diag = (numeroLigne: number, sur: Partial<DiagnosticLigneImportQr> = {}): DiagnosticLigneImportQr => ({
  numeroLigne, nom: `Ligne ${numeroLigne}`, etat: 'a_creer', action: 'creer', messages: [], doublon: null, gestionnaires: [], emailsDestinataires: [], emailsHorsDomaine: [], ...sur,
})
const verification = (sur: Partial<VerificationImportQr> = {}): VerificationImportQr => ({
  diagnostics: [
    diag(2, { nom: 'Villa Exemple', gestionnaires: [{ id: 'g1', nom: 'Marie Exemple' }] }),
    diag(4, {
      nom: 'Le Parc', etat: 'existe_deja', action: 'ignorer',
      messages: [{ niveau: 'avertissement', champ: null, texte: 'Existe déjà : « Résidence Le Parc » (Marseille), même nom et même code postal' }],
      doublon: { certitude: 'certain', critere: 'nom_code_postal', forcable: true, copropriete: { id: E1, nom: 'Résidence Le Parc', ville: 'Marseille' } },
    }),
  ],
  gestionnairesInconnus: [],
  horsDomaine: false,
  ...sur,
})

type Appel = { url: string; methode: string; corps: Record<string, unknown> | null }
let appels: Appel[] = []
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })
function simulerFetch(routeur: (appel: Appel) => Response) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null }
    appels.push(appel)
    return routeur(appel)
  }))
}
const appelsImport = (mode?: string) => appels.filter((a) => a.url.endsWith('/coproprietes/import') && (!mode || a.corps?.mode === mode))

const onImporte = vi.fn()
const onFermer = vi.fn()
const rendre = (cabinets: CabinetQr[] | null = [CABINET]) =>
  render(<AssistantImportQr cabinets={cabinets} origine="https://vitfix.io" onFermer={onFermer} onImporte={onImporte} />)

async function choisirFichier(contenu: string = CSV, nom = 'coproprietes.csv') {
  const fichier = new File([contenu], nom, { type: 'text/csv' })
  fireEvent.change(screen.getByLabelText(I.fichier), { target: { files: [fichier] } })
  await screen.findByText(I.correspondance)
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  simulerFetch((a) => {
    if (a.corps?.mode === 'verifier') return json(verification())
    if (a.corps?.mode === 'creer') return json({ creees: [CREEE], completees: [], ignorees: 1, rejeu: false })
    return json({ error: 'introuvable' }, 404)
  })
})
afterEach(() => vi.unstubAllGlobals())

// ── Relecture 1 : un operationId par lot ; affiches et export d'après ce que le serveur a créé ──────────────────

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const cellule = (ref: string, texte: string) => `<c r="${ref}" t="inlineStr"><is><t>${texte}</t></is></c>`

/** Classeur de deux feuilles (« Lot A », « Lot B ») d'une copropriété chacune, construit ici. */
async function classeurDeuxFeuilles(): Promise<Uint8Array> {
  const { strToU8, zipSync } = await import('fflate')
  const feuilles = [['Lot A', 'Villa Exemple', '13002'], ['Lot B', 'Mas Exemple', '13004']]
  const fichiers: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>${
      feuilles.map(([nom], i) => `<sheet name="${nom}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${
      feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  }
  feuilles.forEach(([, nom, cp], i) => {
    fichiers[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}"><sheetData>`
      + `<row r="1">${cellule('A1', 'Nom de la copropriété')}${cellule('B1', 'Code postal')}</row>`
      + `<row r="2">${cellule('A2', nom)}${cellule('B2', cp)}</row></sheetData></worksheet>`
  })
  return zipSync(Object.fromEntries(Object.entries(fichiers).map(([n, t]) => [n, strToU8(t)])))
}

/** Vérification puis import d'une seule ligne à créer (aucune erreur), jusqu'au résultat ou au message. */
async function verifierPuisImporter(attendu: string) {
  fireEvent.click(screen.getByRole('button', { name: I.verifier }))
  await screen.findByText(I.apercu)
  fireEvent.click(screen.getByRole('button', { name: remplir(I.importer, { n: 1, m: 0 }) }))
  await screen.findByText(attendu)
}

describe('relecture 1 : un operationId par lot, affiches d’après le serveur', () => {
  const unSeul = () => simulerFetch((a) => {
    if (a.corps?.mode === 'verifier') return json(verification({ diagnostics: [diag(2)] }))
    return json({ creees: [CREEE], completees: [], ignorees: 0, rejeu: false })
  })
  const resultatUn = remplir(I.resultat, { creees: 1, completees: 0, ignorees: 0 })

  it('autre feuille après un import : nouvel operationId (l’import de la feuille 1 ne se rejoue pas sur la feuille 2)', async () => {
    unSeul()
    rendre()
    fireEvent.change(screen.getByLabelText(I.fichier), { target: { files: [new File([new Uint8Array(await classeurDeuxFeuilles())], 'deux.xlsx')] } })
    await screen.findByText(I.correspondance)
    await verifierPuisImporter(resultatUn)
    fireEvent.change(screen.getByLabelText(I.feuille), { target: { value: 'Lot B' } })
    await waitFor(() => expect(screen.queryByText(resultatUn)).toBeNull())
    await verifierPuisImporter(resultatUn)
    const [premier, second] = appelsImport('creer')
    expect((second.corps?.lignes as Array<{ nom: string }>)[0].nom).toBe('Mas Exemple')
    expect(second.corps?.operationId).not.toBe(premier.corps?.operationId)
  })

  it('autre cabinet après un import : résultat effacé, nouvel operationId', async () => {
    unSeul()
    rendre([CABINET, cabinet(K2, 'Autre Cabinet Exemple', 'autre-exemple')])
    fireEvent.change(screen.getByLabelText(I.cabinet), { target: { value: K1 } })
    await choisirFichier('Nom de la copropriété;Code postal\r\nVilla Exemple;13002')
    await verifierPuisImporter(resultatUn)
    fireEvent.change(screen.getByLabelText(I.cabinet), { target: { value: K2 } })
    expect(screen.queryByText(resultatUn)).toBeNull()
    await verifierPuisImporter(resultatUn)
    const [premier, second] = appelsImport('creer')
    expect(second.corps?.cabinetId).toBe(K2)
    expect(second.corps?.operationId).not.toBe(premier.corps?.operationId)
  })

  it('409 a_reverifier : la création suivante part avec un nouvel operationId', async () => {
    let creations = 0
    simulerFetch((a) => {
      if (a.corps?.mode === 'verifier') return json(verification({ diagnostics: [diag(2)] }))
      creations += 1
      return creations === 1 ? json({ ...verification({ diagnostics: [diag(2)] }), error: 'a_reverifier' }, 409) : json({ creees: [CREEE], completees: [], ignorees: 0, rejeu: false })
    })
    rendre()
    await choisirFichier('Nom de la copropriété;Code postal\r\nVilla Exemple;13002')
    await verifierPuisImporter(I.aReverifier)
    fireEvent.click(screen.getByRole('button', { name: remplir(I.importer, { n: 1, m: 0 }) }))
    await screen.findByText(resultatUn)
    const [premier, second] = appelsImport('creer')
    expect(second.corps?.operationId).not.toBe(premier.corps?.operationId)
  })

  it('affiches et export : nom et adresse RENDUS par le serveur (même au rejeu), jamais les saisies de l’écran', async () => {
    simulerFetch((a) => {
      if (a.corps?.mode === 'verifier') return json(verification({ diagnostics: [diag(2)] }))
      return json({ creees: [{ ...CREEE, nom: 'Résidence du Serveur', adresse: '3 rue Exemple', codePostal: '13009' }], completees: [], ignorees: 0, rejeu: true })
    })
    rendre()
    await choisirFichier('Nom de la copropriété;Code postal\r\nVilla Exemple;13002')
    await verifierPuisImporter(resultatUn)
    fireEvent.click(screen.getByRole('button', { name: I.affiches }))
    await waitFor(() => expect(qr.affichesPdfQr).toHaveBeenCalled())
    expect(vi.mocked(qr.affichesPdfQr).mock.calls[0][0]).toEqual([
      { nom: 'Résidence du Serveur', adresse: '3 rue Exemple, 13009 Marseille', url: `https://vitfix.io/cabinet-exemple/signalement/${JETON}/` },
    ])
    fireEvent.click(screen.getByRole('button', { name: I.export }))
    const appel = vi.mocked(qr.telechargerFichier).mock.calls.find(([nom]) => nom === 'coproprietes-importees.csv')
    const texte = await (appel?.[1] as Blob).text()
    expect(texte).toContain('Résidence du Serveur')
    expect(texte).not.toContain('Villa Exemple')
  })
})

describe('cabinet client obligatoire', () => {
  it('aucun cabinet : renvoi vers la vue Cabinets, pas de champ fichier', () => {
    rendre([])
    expect(screen.getByText(I.aucunCabinet)).toBeInTheDocument()
    expect(screen.queryByLabelText(I.fichier)).toBeNull()
  })

  it('plusieurs cabinets : le fichier attend le choix du cabinet', () => {
    rendre([CABINET, cabinet(K2, 'Autre Cabinet Exemple', 'autre-exemple')])
    expect(screen.getByLabelText(I.fichier)).toBeDisabled()
    fireEvent.change(screen.getByLabelText(I.cabinet), { target: { value: K2 } })
    expect(screen.getByLabelText(I.fichier)).not.toBeDisabled()
  })
})

describe('modèle à télécharger', () => {
  it('Excel : généré sur l’appareil (modèle-import-coproprietes.xlsx) ; CSV : UTF-8 avec BOM', async () => {
    rendre()
    fireEvent.click(screen.getByRole('button', { name: I.modeleXlsx }))
    await waitFor(() => expect(qr.telechargerFichier).toHaveBeenCalledWith('modele-import-coproprietes.xlsx', expect.any(Blob)))
    fireEvent.click(screen.getByRole('button', { name: I.modeleCsv }))
    await waitFor(() => expect(qr.telechargerFichier).toHaveBeenCalledWith('modele-import-coproprietes.csv', expect.any(Blob)))
    expect(appels).toEqual([])
  })
})

describe('lecture et correspondance', () => {
  it('colonnes proposées d’après les en-têtes ; colonne inconnue ignorée ; exemples affichés ; fichier jamais envoyé', async () => {
    rendre()
    await choisirFichier()
    expect(screen.getByLabelText(I.champs.nom)).toHaveValue('0')
    expect(screen.getByLabelText(I.champs.codePostal)).toHaveValue('1')
    expect(screen.getByLabelText(I.champs.adresse)).toHaveValue('')
    expect(screen.getByText(remplir(I.exemples, { valeurs: 'Villa Exemple · Mas Exemple · Le Parc' }))).toBeInTheDocument()
    expect(appels).toEqual([])
  })

  it('classeur .xlsx (le modèle) : lu sur l’appareil, feuille proposée, les 9 colonnes reliées d’office', async () => {
    const { octetsModeleXlsxQr } = await import('@/lib/aj-signalement/import/modele-xlsx')
    const octets = new Uint8Array(await octetsModeleXlsxQr())
    rendre()
    fireEvent.change(screen.getByLabelText(I.fichier), { target: { files: [new File([octets], 'modele.xlsx')] } })
    await screen.findByText(I.correspondance)
    expect(screen.getByLabelText(I.feuille)).toHaveValue('Copropriétés')
    expect(screen.getByLabelText(I.champs.nom)).toHaveValue('0')
    expect(screen.getByLabelText(I.champs.emailsDestinataires)).toHaveValue('8')
    expect(appels).toEqual([])
  })

  it('ancien format .xls : refusé avec la consigne', async () => {
    rendre()
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    fireEvent.change(screen.getByLabelText(I.fichier), { target: { files: [new File([ole], 'ancien.xls')] } })
    expect(await screen.findByText(I.erreursLecture.format_ancien)).toBeInTheDocument()
  })
})

describe('vérification, aperçu, création', () => {
  it('lignes en erreur de format jamais envoyées ; « verifier » avec le cabinet ; aperçu ; « creer » ; résultat', async () => {
    rendre()
    await choisirFichier()
    fireEvent.click(screen.getByRole('button', { name: I.verifier }))
    await screen.findByText(I.apercu)
    const [verif] = appelsImport('verifier')
    expect(verif.corps).toMatchObject({ mode: 'verifier', cabinetId: K1, operationId: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    const lignes = verif.corps?.lignes as Array<Record<string, unknown>>
    expect(lignes.map((l) => l.numeroLigne)).toEqual([2, 4])
    expect(lignes[0]).toMatchObject({ nom: 'Villa Exemple', codePostal: '13002', gestionnaires: ['marie.exemple@exemple.test'] })
    // La colonne non reliée (téléphone) n'est jamais envoyée.
    expect(JSON.stringify(verif.corps)).not.toContain('0600000000')

    expect(screen.getByText('Code postal « 130 » : 5 chiffres attendus')).toBeInTheDocument()
    expect(screen.getAllByText(I.etats.existe_deja).length).toBeGreaterThan(0)
    expect(screen.getByText(remplir(I.resume, { creer: 1, completer: 0, ignorer: 1, erreurs: 1 }))).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: remplir(I.importer, { n: 1, m: 1 }) }))
    await screen.findByText(remplir(I.resultat, { creees: 1, completees: 0, ignorees: 1 }))
    const [creation] = appelsImport('creer')
    expect(creation.corps).toMatchObject({ mode: 'creer', cabinetId: K1, operationId: verif.corps?.operationId, confirmerHorsDomaine: false })
    expect((creation.corps?.lignes as unknown[]).length).toBe(2)
    expect(onImporte).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: I.export }))
    expect(qr.telechargerFichier).toHaveBeenCalledWith('coproprietes-importees.csv', expect.any(Blob))
    fireEvent.click(screen.getByRole('button', { name: I.affiches }))
    await waitFor(() => expect(qr.affichesPdfQr).toHaveBeenCalled())
    expect(vi.mocked(qr.affichesPdfQr).mock.calls[0][0]).toEqual([
      { nom: 'Villa Exemple', adresse: '13002 Marseille', url: `https://vitfix.io/cabinet-exemple/signalement/${JETON}/` },
    ])
    await waitFor(() => expect(qr.telechargerFichier).toHaveBeenCalledWith('affiches-qr-cabinet-exemple.pdf', expect.any(Blob)))
  })

  it('doublon existant : « Compléter la fiche existante » ou « Ce n’est pas un doublon » envoyés avec la ligne', async () => {
    rendre()
    await choisirFichier()
    fireEvent.click(screen.getByRole('button', { name: I.verifier }))
    await screen.findByText(I.apercu)
    const carte = screen.getByRole('group', { name: remplir(I.ligne, { n: 4 }) })
    fireEvent.click(within(carte).getByLabelText(I.choixCompleter))
    expect(screen.getByText(remplir(I.resume, { creer: 1, completer: 1, ignorer: 0, erreurs: 1 }))).toBeInTheDocument()
    fireEvent.click(within(carte).getByLabelText(I.choixPasDoublon))
    fireEvent.click(screen.getByRole('button', { name: remplir(I.importer, { n: 2, m: 1 }) }))
    await waitFor(() => expect(appelsImport('creer')).toHaveLength(1))
    const ligne4 = (appelsImport('creer')[0].corps?.lignes as Array<Record<string, unknown>>).find((l) => l.numeroLigne === 4)
    expect(ligne4).toMatchObject({ forcerDoublon: true, actionSiExiste: 'ignorer' })
  })

  it('filtre « Erreurs seulement »', async () => {
    rendre()
    await choisirFichier()
    fireEvent.click(screen.getByRole('button', { name: I.verifier }))
    await screen.findByText(I.apercu)
    fireEvent.change(screen.getByLabelText(I.filtre), { target: { value: 'erreurs' } })
    expect(screen.getByRole('group', { name: remplir(I.ligne, { n: 3 }) })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: remplir(I.ligne, { n: 2 }) })).toBeNull()
  })

  it('409 a_reverifier à la création : aperçu remplacé par les diagnostics à jour, message', async () => {
    simulerFetch((a) => {
      if (a.corps?.mode === 'verifier') return json(verification())
      return json({ ...verification({ diagnostics: [diag(2, { etat: 'erreur', action: 'aucune', messages: [{ niveau: 'erreur', champ: 'gestionnaires', texte: 'Gestionnaire « marie.exemple@exemple.test » : fiche désactivée' }] }), diag(4)] }), error: 'a_reverifier' }, 409)
    })
    rendre()
    await choisirFichier()
    fireEvent.click(screen.getByRole('button', { name: I.verifier }))
    await screen.findByText(I.apercu)
    fireEvent.click(screen.getByRole('button', { name: remplir(I.importer, { n: 1, m: 1 }) }))
    expect(await screen.findByText(I.aReverifier)).toBeInTheDocument()
    expect(screen.getByText('Gestionnaire « marie.exemple@exemple.test » : fiche désactivée')).toBeInTheDocument()
    expect(onImporte).not.toHaveBeenCalled()
  })

  it('destinataires hors des domaines du cabinet : import bloqué jusqu’à la confirmation, envoyée avec la création', async () => {
    simulerFetch((a) => {
      if (a.corps?.mode === 'verifier') return json(verification({ horsDomaine: true, diagnostics: [diag(2, { emailsHorsDomaine: ['cs@externe.test'], emailsDestinataires: ['cs@externe.test'] }), verification().diagnostics[1]] }))
      return json({ creees: [CREEE], completees: [], ignorees: 0, rejeu: false })
    })
    rendre()
    await choisirFichier()
    fireEvent.click(screen.getByRole('button', { name: I.verifier }))
    await screen.findByText(I.apercu)
    const bouton = screen.getByRole('button', { name: remplir(I.importer, { n: 1, m: 1 }) })
    expect(bouton).toBeDisabled()
    fireEvent.click(screen.getByLabelText(I.confirmerHorsDomaine))
    expect(bouton).not.toBeDisabled()
    fireEvent.click(bouton)
    await waitFor(() => expect(appelsImport('creer')[0]?.corps).toMatchObject({ confirmerHorsDomaine: true }))
  })
})

describe('gestionnaires sans fiche', () => {
  it('fiches créées une par une (domaine du cabinet ; hors domaine seulement si coché), puis nouvelle vérification', async () => {
    let verifications = 0
    simulerFetch((a) => {
      if (a.url.endsWith('/gestionnaires')) return json({ gestionnaire: { id: 'g9', nom: a.corps?.nom }, emailEnvoye: true, coproprietesAvecAdresseSaisie: [] }, 201)
      verifications += 1
      return json(verification(verifications === 1 ? {
        gestionnairesInconnus: [
          { email: 'nina.exemple@exemple.test', nomPropose: 'Nina Exemple', dansDomaines: true, lignes: [2] },
          { email: 'max.exemple@ailleurs.test', nomPropose: 'Max Exemple', dansDomaines: false, lignes: [2] },
        ],
      } : {}))
    })
    rendre()
    await choisirFichier()
    fireEvent.click(screen.getByRole('button', { name: I.verifier }))
    await screen.findByText(remplir(I.inconnus, { n: 2 }))
    fireEvent.change(screen.getByLabelText(remplir(I.nomInconnu, { email: 'nina.exemple@exemple.test' })), { target: { value: 'Nina Exemple-Martin' } })
    fireEvent.click(screen.getByRole('button', { name: I.creerFiches }))
    await screen.findByText(remplir(I.fichesCreees, { n: 1 }))
    const creations = appels.filter((a) => a.url.endsWith('/gestionnaires'))
    expect(creations.map((a) => a.corps)).toEqual([{ nom: 'Nina Exemple-Martin', email: 'nina.exemple@exemple.test', cabinetId: K1, coproprieteIds: [], forcerDomaine: false }])
    expect(appelsImport('verifier')).toHaveLength(2)

    // Seconde passe : adresse hors domaine cochée une par une → forcerDomaine.
    verifications = 0
    fireEvent.click(screen.getByRole('button', { name: I.verifier }))
    await screen.findByText(remplir(I.inconnus, { n: 2 }))
    fireEvent.click(screen.getByLabelText(remplir(I.forcerFiche, { email: 'max.exemple@ailleurs.test' })))
    fireEvent.click(screen.getByRole('button', { name: I.creerFiches }))
    await screen.findByText(remplir(I.fichesCreees, { n: 2 }))
    expect(appels.filter((a) => a.url.endsWith('/gestionnaires')).slice(1).map((a) => [a.corps?.email, a.corps?.forcerDomaine])).toEqual([
      ['nina.exemple@exemple.test', false], ['max.exemple@ailleurs.test', true],
    ])
  })
})

describe('dans la vue Copropriétés de l’espace', () => {
  it('« Importer un fichier » ouvre l’assistant (espace seulement, avec les cabinets)', async () => {
    simulerFetch(() => json({ tableau: { coproprietes: [], signalements: [] } }))
    const { unmount } = render(<TableauSignalementsQr jeton={null} vue="coproprietes" gestion={{ cabinets: [CABINET], gestionnaires: [] }} />)
    fireEvent.click(await screen.findByRole('button', { name: I.bouton }))
    expect(screen.getByRole('dialog', { name: I.titre })).toBeInTheDocument()
    unmount()
    render(<TableauSignalementsQr jeton={null} vue="coproprietes" />)
    await screen.findByRole('button', { name: T.ajouterCopro })
    expect(screen.queryByRole('button', { name: I.bouton })).toBeNull()
  })
})
