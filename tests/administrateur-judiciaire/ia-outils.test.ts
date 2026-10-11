import './fuseau-paris'
import { describe, expect, it } from 'vitest'
import { fusionnerCoproMandat } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import {
  TAILLE_MAX_FICHIER_FACTURE,
  construireContextePv,
  lireMontant,
  markdownVersTexteBrut,
  montantsIncoherents,
  normaliserFactureExtraite,
  typeFichierFacture,
  verifierDataUrlFacture,
} from '@/lib/administrateur-judiciaire/ia/outils'

/** Fonctions pures des outils IA (Analyse de devis, Rédaction de PV, Saisie de factures). */

const base64 = (octets: number) => Buffer.alloc(octets).toString('base64')

/** Fichier de `octets` octets commençant par la signature réelle du format (le reste à zéro), en base64. */
const SIGNATURES: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/jpeg': [0xff, 0xd8, 0xff, 0xe0],
  'image/webp': [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
}
const fichier = (type: string, octets: number) => {
  const tampon = Buffer.alloc(octets)
  Buffer.from(SIGNATURES[type]).copy(tampon)
  return `data:${type};base64,${tampon.toString('base64')}`
}

describe('Outils IA — fichier de facture', () => {
  it('reconnaît les formats acceptés, par type MIME ou, à défaut, par extension', () => {
    expect(typeFichierFacture('image/png', 'a.png')).toBe('image/png')
    expect(typeFichierFacture('image/jpg', 'a.jpg')).toBe('image/jpeg')
    expect(typeFichierFacture('', 'Facture.PDF')).toBe('application/pdf')
    expect(typeFichierFacture('application/octet-stream', 'scan.webp')).toBe('image/webp')
    expect(typeFichierFacture('image/gif', 'a.gif')).toBeNull()
    expect(typeFichierFacture('text/plain', 'facture.pdf')).toBeNull()
    expect(typeFichierFacture('', 'facture')).toBeNull()
  })

  it('contrôle une data URL sans la décoder : type, base64 bien formé, 4 Mo au plus', () => {
    expect(verifierDataUrlFacture(fichier('application/pdf', 10))).toEqual({ ok: true, type: 'application/pdf', octets: 10 })
    expect(verifierDataUrlFacture(fichier('image/png', TAILLE_MAX_FICHIER_FACTURE))).toMatchObject({ ok: true, octets: TAILLE_MAX_FICHIER_FACTURE })
    expect(verifierDataUrlFacture(fichier('image/png', TAILLE_MAX_FICHIER_FACTURE + 1))).toEqual({ ok: false, raison: 'taille' })
    expect(verifierDataUrlFacture(fichier('image/jpeg', 32))).toMatchObject({ ok: true, type: 'image/jpeg' })
    expect(verifierDataUrlFacture(fichier('image/webp', 32))).toMatchObject({ ok: true, type: 'image/webp' })
    expect(verifierDataUrlFacture(`data:image/gif;base64,${base64(10)}`)).toEqual({ ok: false, raison: 'format' })
    expect(verifierDataUrlFacture('data:image/png;base64,abc')).toEqual({ ok: false, raison: 'format' })
    expect(verifierDataUrlFacture('data:image/png;base64,')).toEqual({ ok: false, raison: 'format' })
    expect(verifierDataUrlFacture(base64(12))).toEqual({ ok: false, raison: 'format' })
  })

  it('vérifie la signature réelle du fichier, pas seulement le type déclaré', () => {
    // PNG renommé en .jpg : refusé (Claude rejetterait l'image au type incohérent).
    const pngDeclareJpeg = fichier('image/png', 32).replace('data:image/png', 'data:image/jpeg')
    expect(verifierDataUrlFacture(pngDeclareJpeg)).toEqual({ ok: false, raison: 'format' })
    // Contenu vide ou corrompu sous un type accepté : refusé.
    expect(verifierDataUrlFacture(`data:application/pdf;base64,${base64(16)}`)).toEqual({ ok: false, raison: 'format' })
  })
})

describe('Outils IA — facture extraite', () => {
  it('convertit les montants écrits à la française ou à l’anglaise', () => {
    expect(lireMontant(1100)).toBe(1100)
    expect(lireMontant('1 234,56 €')).toBe(1234.56)
    expect(lireMontant('1.234,56')).toBe(1234.56)
    expect(lireMontant('1,234.56')).toBe(1234.56)
    expect(lireMontant('620 EUR')).toBe(620)
    expect(lireMontant('environ 600')).toBeNull()
    expect(lireMontant(null)).toBeNull()
  })

  it('garde les seuls champs attendus et refuse une lecture vide', () => {
    expect(normaliserFactureExtraite({ fournisseur: ' Otis ', montant_ttc: '480,00', autre: 'x', siret: 'null' })).toEqual({
      fournisseur: 'Otis',
      siret: null,
      numero: null,
      date: null,
      montant_ht: null,
      tva: null,
      montant_ttc: 480,
      copropriete_probable: null,
      compte_charge_suggere: null,
      libelle: null,
    })
    expect(normaliserFactureExtraite({ fournisseur: null })).toBeNull()
    expect(normaliserFactureExtraite([])).toBeNull()
    expect(normaliserFactureExtraite('texte')).toBeNull()
  })

  it('signale HT + TVA ≠ TTC au-delà de l’arrondi', () => {
    expect(montantsIncoherents({ montant_ht: 1000, tva: 100, montant_ttc: 1100 })).toBe(false)
    expect(montantsIncoherents({ montant_ht: 1000, tva: 100, montant_ttc: 1100.04 })).toBe(false)
    expect(montantsIncoherents({ montant_ht: 1000, tva: 100, montant_ttc: 1500 })).toBe(true)
    expect(montantsIncoherents({ montant_ht: 1000, tva: null, montant_ttc: 1500 })).toBe(false)
  })
})

describe('Outils IA — projet de PV', () => {
  it('Markdown → texte brut à coller : marques retirées, puces et numéros conservés', () => {
    expect(
      markdownVersTexteBrut('## Résolution 1\r\n**Majorité :** article 24\n- Pour : [À COMPLÉTER]\n* Contre : *aucun*\n1. `RG` [lien](https://exemple.fr)\n*Projet à relire.*\n_(Réponse interrompue.)_'),
    ).toBe('Résolution 1\nMajorité : article 24\n- Pour : [À COMPLÉTER]\n* Contre : aucun\n1. RG lien (https://exemple.fr)\nProjet à relire.\n(Réponse interrompue.)')
  })

  it('contexte : la copropriété choisie et son mandat (dates locales AAAA-MM-JJ), null si elle n’est pas dans la base', () => {
    const copro = fusionnerCoproMandat(
      { id: 'C2', code: 'CV', nom: 'Le Clos des Vignes', adresse: '8 av. du Château', nbLots: 48, budget: 0, depense: 0, impayes: 0, fondsTravaux: 0, createdAt: '' },
      { id: 'M2', fondement: 'art. 46 — carence', tribunal: 'TJ Nanterre', rg: '25/03517', ordonnance: new Date(2025, 6, 22), dureeMois: 12, echeance: new Date(2026, 6, 22), statut: 'En cours' },
    )
    const contexte = construireContextePv({ aujourdhui: '2026-06-04', mode: 'demo', copropriete: 'Le Clos des Vignes', copros: [copro] })
    expect(contexte).toMatchObject({
      dateDuJour: '2026-06-04',
      copropriete: {
        nom: 'Le Clos des Vignes',
        adresse: '8 av. du Château',
        lots: 48,
        mandat: { tribunal: 'TJ Nanterre', rg: '25/03517', ordonnance: '2025-07-22', finDeMission: '2026-07-22', dureeMois: 12 },
      },
    })
    expect(construireContextePv({ aujourdhui: '2026-06-04', mode: 'reel', copropriete: 'Villa inconnue', copros: [copro] }).copropriete).toBeNull()
  })
})
