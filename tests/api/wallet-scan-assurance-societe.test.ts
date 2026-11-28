// @vitest-environment node
// tests/api/wallet-scan-assurance-societe.test.ts — dépôt d'une attestation d'assurance dans Conformité
// (POST /api/wallet-scan) par une société BTP (constat api-peripherie-6 de l'audit du 11/11/2026).
//
// Défaut corrigé pour une société (pro_societe) : la lecture automatique du PDF réécrivait sans prévenir l'assureur,
// le numéro de contrat, la couverture et le type d'assurance de la fiche, repris sur les devis et factures. L'assureur
// retenu était le premier nom de la liste contenu dans le texte : « MMA » est contenu dans « DOMMAGES ».
// Contrat vérifié ici : pour une société BTP, française ou inscrite au Portugal (fiche en portugais, mêmes règles depuis
// le 22/11/2026), la lecture ne remplit que les champs vides de la fiche, n'écrit le type d'assurance que pour une fiche
// sans assurance (ni type, ni assureur, ni contrat), et ne reconnaît un assureur que sur un mot entier. Pour une forme
// juridique portugaise, « France metropolitaine », défaut de la colonne insurance_coverage, compte pour vide (comme
// pour ses devis). L'artisan garde l'écriture d'avant (témoin).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | { id: string; email: string; app_metadata: Record<string, unknown> },
    fiche: {} as Ligne,
    majs: [] as Ligne[],
  }
  const from = (table: string) => {
    if (table !== 'profiles_artisan') throw new Error(`table inattendue : ${table}`)
    let colonnes = '*'
    let valeurs: Ligne | null = null
    const b: Record<string, unknown> = {}
    b.select = (c = '*') => { colonnes = c; return b }
    b.eq = () => b
    b.update = (v: Ligne) => { valeurs = v; return b }
    b.single = async () => ({
      data: colonnes === '*' ? { ...etat.fiche } : Object.fromEntries(colonnes.split(',').map((c) => c.trim()).map((c) => [c, etat.fiche[c] ?? null])),
      error: null,
    })
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      if (valeurs) { etat.majs.push({ ...valeurs }); Object.assign(etat.fiche, valeurs) }
      return Promise.resolve({ data: null, error: null }).then(ok, ko)
    }
    return b
  }
  return { etat, from }
})

vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.etat.user),
}))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.from(t) } }))

const { POST } = await import('@/app/api/wallet-scan/route')

const COMPTE = '550e8400-e29b-41d4-a716-446655440000'
const FICHE = '0b9f8c1e-5d4a-4b6f-9e7d-1a2b3c4d5e6f'

// Attestation décennale fictive : assureur SMABTP, texte qui contient « DOMMAGES-OUVRAGE »
const LIGNES_ATTESTATION = [
  "ATTESTATION D'ASSURANCE DE RESPONSABILITÉ CIVILE DÉCENNALE",
  'SMABTP atteste que SARL BATIMENT EXEMPLE est titulaire du contrat',
  'Contrat n° 0012345678 garantie décennale et assurance décennale obligatoire',
  'Garanties complémentaires : DOMMAGES-OUVRAGE',
  'Période de validité : du 01/01/2026 au 31/12/2099 France métropolitaine',
]

/** PDF minimal dont l'extracteur de la route lit le texte (opérateurs BT … Tj … ET), encodé en latin1 comme un PDF. */
function pdfBase64(lignes: string[]): string {
  const corps = lignes.map((l) => `(${l}) Tj`).join('\n')
  return Buffer.from(`%PDF-1.4\nBT\n${corps}\nET\n%%EOF`, 'latin1').toString('base64')
}

async function deposer(lignes = LIGNES_ATTESTATION) {
  const res = await POST(new NextRequest('https://vitfix.io/api/wallet-scan', {
    method: 'POST',
    headers: { Authorization: 'Bearer jeton', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64: pdfBase64(lignes), fileName: 'attestation.pdf', docKey: 'decennale', artisanId: FICHE }),
  }))
  return { status: res.status, json: await res.json() as { scan?: { docType: string; extractedData: Ligne } } }
}

function preparer(role: string, assurance: Ligne) {
  h.etat.user = { id: COMPTE, email: 'compte@exemple.fr', app_metadata: { role } }
  h.etat.fiche = { id: FICHE, user_id: COMPTE, company_name: 'BATIMENT EXEMPLE', siret: null, siren: null, language: 'fr', ...assurance }
}

const ASSURANCE_SAISIE = {
  insurance_name: 'Assureur Saisi', insurance_number: 'CONTRAT-SAISI', insurance_coverage: '', insurance_type: 'both', insurance_expiry: null,
}

beforeEach(() => {
  h.etat.majs = []
})

describe('Société BTP : l’attestation déposée ne remplace pas l’assurance saisie', () => {
  it('assureur, contrat et type saisis gardés ; seuls les champs vides sont remplis', async () => {
    preparer('pro_societe', ASSURANCE_SAISIE)

    const { status, json } = await deposer()

    expect(status).toBe(200)
    expect(json.scan?.docType).toBe('decennale')
    expect(h.etat.fiche).toMatchObject({
      insurance_name: 'Assureur Saisi',
      insurance_number: 'CONTRAT-SAISI',
      insurance_type: 'both',
      insurance_coverage: 'France métropolitaine',
      insurance_expiry: '2099-12-31',
    })
  })

  it('fiche sans assurance : remplie, assureur reconnu sur un mot entier, type de l’attestation lue', async () => {
    preparer('pro_societe', { insurance_name: null, insurance_number: null, insurance_coverage: null, insurance_type: null, insurance_expiry: null })

    const { json } = await deposer()

    expect(json.scan?.extractedData.insurerName).toBe('SMABTP')
    expect(h.etat.majs).toHaveLength(1)
    // Sans le type, le devis BTP présentait l'assureur et le contrat de la décennale comme une « RC Pro »
    expect(h.etat.majs[0]).toMatchObject({
      insurance_name: 'SMABTP',
      insurance_number: '0012345678',
      insurance_coverage: 'France métropolitaine',
      insurance_expiry: '2099-12-31',
      insurance_type: 'decennale',
    })
  })

  it('assureur et contrat saisis sans type : le type n’est pas déduit d’une autre attestation', async () => {
    preparer('pro_societe', { ...ASSURANCE_SAISIE, insurance_type: null })

    await deposer()

    expect(h.etat.majs).toHaveLength(1)
    for (const colonne of ['insurance_name', 'insurance_number', 'insurance_type']) {
      expect(h.etat.majs[0]).not.toHaveProperty(colonne)
    }
    expect(h.etat.fiche).toMatchObject({ insurance_name: 'Assureur Saisi', insurance_number: 'CONTRAT-SAISI', insurance_type: null })
  })

  // Une fiche dont la langue n'est pas posée est celle d'une société française : seul le portugais en sort
  it.each([
    ['nulle', (fiche: Ligne) => { fiche.language = null }],
    ['absente', (fiche: Ligne) => { delete fiche.language }],
  ])('fiche sans langue posée (langue %s) : assurance saisie gardée, champs vides remplis, assureur sur un mot entier', async (_cas, retirerLangue) => {
    preparer('pro_societe', ASSURANCE_SAISIE)
    retirerLangue(h.etat.fiche)

    const { json } = await deposer()

    expect(json.scan?.extractedData.insurerName).toBe('SMABTP')
    expect(h.etat.majs).toHaveLength(1)
    expect(h.etat.majs[0]).toMatchObject({ insurance_coverage: 'France métropolitaine', insurance_expiry: '2099-12-31' })
    for (const colonne of ['insurance_name', 'insurance_number', 'insurance_type']) {
      expect(h.etat.majs[0]).not.toHaveProperty(colonne)
    }
    expect(h.etat.fiche).toMatchObject({ insurance_name: 'Assureur Saisi', insurance_number: 'CONTRAT-SAISI', insurance_type: 'both' })
  })
})

describe('Artisan : écriture d’avant, inchangée (témoin)', () => {
  it('la lecture réécrit l’assurance comme avant (même défaut, signalé, hors de ce lot)', async () => {
    preparer('artisan', ASSURANCE_SAISIE)

    await deposer()

    expect(h.etat.majs[0]).toMatchObject({ insurance_name: 'MMA', insurance_number: '0012345678', insurance_type: 'decennale' })
  })
})

describe('Société inscrite au Portugal (fiche en portugais) : mêmes règles que la société française', () => {
  const FORME_PORTUGAISE = 'Sociedade por Quotas (Lda.)'

  it('même attestation : assurance saisie gardée, champs vides remplis, assureur reconnu sur un mot entier', async () => {
    preparer('pro_societe', { ...ASSURANCE_SAISIE, language: 'pt', legal_form: FORME_PORTUGAISE })

    const { json } = await deposer()

    // Avant : « MMA », contenu dans « DOMMAGES », remplaçait l'assureur saisi, avec le contrat et le type
    expect(json.scan?.extractedData.insurerName).toBe('SMABTP')
    expect(h.etat.fiche).toMatchObject({
      insurance_name: 'Assureur Saisi', insurance_number: 'CONTRAT-SAISI', insurance_type: 'both', insurance_expiry: '2099-12-31',
    })
  })

  // Certificat fictif, lu sans assureur ni date (motifs de lecture français) ; seule la couverture en est tirée.
  const CERTIFICADO = ['CERTIFICADO DE SEGURO DE RESPONSABILIDADE CIVIL', 'Apólice n.º 0099999999', 'Âmbito territorial: Portugal Continental']

  // « France metropolitaine » (sans accent) : défaut de la colonne insurance_coverage en production. La règle suit la
  // forme juridique, comme sur les devis (couvertureAssuranceBtp), pas la langue de la fiche.
  it.each([
    ['forme juridique portugaise : la couverture lue remplace ce défaut', 'pt', FORME_PORTUGAISE, 'Portugal Continental'],
    ['société française : ce défaut est gardé, comme avant', 'fr', 'SARL', 'France metropolitaine'],
    ['fiche en français, forme juridique portugaise : remplacé aussi (gardé avant)', 'fr', FORME_PORTUGAISE, 'Portugal Continental'],
    ['fiche en portugais sans forme juridique : gardé, comme sur ses devis (remplacé avant)', 'pt', null, 'France metropolitaine'],
  ])('couverture au défaut de la colonne, %s', async (_cas, langue, forme, couverture) => {
    preparer('pro_societe', { ...ASSURANCE_SAISIE, insurance_coverage: 'France metropolitaine', language: langue, legal_form: forme })

    await deposer(CERTIFICADO)

    expect(h.etat.majs).toHaveLength(1)
    expect(h.etat.fiche).toMatchObject({ insurance_coverage: couverture, insurance_name: 'Assureur Saisi', insurance_type: 'both' })
  })
})
