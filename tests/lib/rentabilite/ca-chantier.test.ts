// CA facturé par chantier (lib/rentabilite/ca-chantier.ts).
//
// Ce calcul était INERTE depuis la création de l'écran Rentabilité, le 28/03/2026 : il interrogeait `d.type` quand
// la mise en forme du tableau de bord ne pose que `docType`, et `d.status === 'signé'` accentué, qui n'est aucun
// des statuts écrits. Le CA de chaque chantier ne venait que des situations de travaux et du budget saisi, et
// aucun test ne couvrait ce calcul — c'est pourquoi le défaut a tenu huit mois.
//
// Le cas qui compte le plus ici est « deux chantiers pour un même client » : c'est lui qui a fait retirer une
// première version de ce correctif, où la même facture était imputée en entier à chacun des deux chantiers.
import { describe, it, expect } from 'vitest'
import { caParChantier, type DocumentDeChantier } from '@/lib/rentabilite/ca-chantier'

const CH_A = { id: 'ch-a', client: 'SCI Les Tilleuls' }
const CH_B = { id: 'ch-b', client: 'SCI Les Tilleuls' }
const CH_AUTRE = { id: 'ch-c', client: 'EURL Martin' }

/** Une ligne de la forme que `computeDocumentTotalHT` sait lire (celle du formulaire et du PDF). */
const ligne = (description: string, totalHT: number) => ({
  id: 1, description, qty: 1, unit: 'f', priceHT: totalHT, tvaRate: 20, totalHT,
})

function doc(parts: Partial<DocumentDeChantier> & { lines?: unknown[]; totalHT?: number }): DocumentDeChantier {
  return { clientName: 'SCI Les Tilleuls', docType: 'facture', docNumber: 'FACT-2026-001', status: 'paid', ...parts } as DocumentDeChantier
}

const ca = (docs: DocumentDeChantier[], chantiers: Array<{ id: string; client?: string }>) =>
  caParChantier(docs, chantiers)

describe('caParChantier — une facture n\'est imputée qu\'à un seul chantier, ou à aucun', () => {
  it('client qui n\'a qu\'un chantier : la facture lui est imputée par son nom', () => {
    const r = ca([doc({ lines: [ligne('Ravalement', 8000)] })], [CH_A, CH_AUTRE])
    expect(r.parChantier.get('ch-a')).toBe(8000)
    expect(r.clientsAmbigus.size).toBe(0)
  })

  it('DEUX chantiers pour le même client : la facture n\'est imputée à AUCUN, et le client est signalé', () => {
    // LE cas décisif. Imputer par le nom donnerait 20 000 € sur ch-a ET 20 000 € sur ch-b, donc 40 000 € dans
    // l'indicateur global qui somme les chantiers — et une quote-part de charges fixes faussée pour les deux.
    const r = ca([doc({ lines: [ligne('Ravalement', 20000)] })], [CH_A, CH_B])
    expect(r.parChantier.get('ch-a')).toBeUndefined()
    expect(r.parChantier.get('ch-b')).toBeUndefined()
    expect([...r.clientsAmbigus]).toEqual(['sci les tilleuls'])
  })

  it('rattachée explicitement : imputée à ce chantier, même si le client en a deux', () => {
    const r = ca([doc({ chantierId: 'ch-b', lines: [ligne('Ravalement', 20000)] })], [CH_A, CH_B])
    expect(r.parChantier.get('ch-b')).toBe(20000)
    expect(r.parChantier.get('ch-a')).toBeUndefined()
    expect(r.clientsAmbigus.size).toBe(0)
  })

  it('rattachée à un chantier absent de la liste : imputée nulle part', () => {
    const r = ca([doc({ chantierId: 'ch-disparu', lines: [ligne('Ravalement', 5000)] })], [CH_A])
    expect(r.parChantier.size).toBe(0)
  })

  it('un chantierId vide ou fait d\'espaces retombe sur le nom du client', () => {
    for (const vide of ['', '   ', null]) {
      const r = ca([doc({ chantierId: vide, lines: [ligne('Dalle', 900)] })], [CH_A])
      expect(r.parChantier.get('ch-a')).toBe(900)
    }
  })

  it('plusieurs factures du même chantier s\'additionnent', () => {
    const r = ca([
      doc({ lines: [ligne('Acompte', 3000)] }),
      doc({ docNumber: 'FACT-2026-002', lines: [ligne('Solde', 5000)] }),
    ], [CH_A])
    expect(r.parChantier.get('ch-a')).toBe(8000)
  })

  it('le nom du client se compare sans casse ni espaces de bord', () => {
    const r = ca([doc({ clientName: '  sci LES tilleuls ', lines: [ligne('Dalle', 1500)] })], [CH_A])
    expect(r.parChantier.get('ch-a')).toBe(1500)
  })

  it('un chantier sans client ne ramasse pas les factures sans nom de client', () => {
    const r = ca([doc({ clientName: '', lines: [ligne('Dalle', 1000)] })], [{ id: 'ch-x' }])
    expect(r.parChantier.size).toBe(0)
  })

  it('aucun chantier : rien à imputer, et aucune erreur', () => {
    expect(ca([doc({ lines: [ligne('Dalle', 1000)] })], []).parChantier.size).toBe(0)
    expect(caParChantier(undefined, undefined).parChantier.size).toBe(0)
    expect(caParChantier(undefined, [CH_A]).parChantier.size).toBe(0)
  })
})

describe('caParChantier — ce qui entre dans le CA, et ce qui n\'y entre pas', () => {
  it('une facture porte le champ docType, que l\'ancien prédicat ne lisait pas — le défaut d\'origine', () => {
    const r = ca([doc({ lines: [ligne('Ravalement', 4000)] })], [CH_A])
    expect(r.parChantier.get('ch-a')).toBe(4000)
  })

  it('un document plus ancien, qui porte `type` au lieu de `docType`, compte aussi', () => {
    const ancien = { clientName: 'SCI Les Tilleuls', type: 'facture', docNumber: 'FACT-2026-009', status: 'pending', lines: [ligne('Toiture', 500)] }
    expect(ca([ancien as DocumentDeChantier], [CH_A]).parChantier.get('ch-a')).toBe(500)
  })

  it('un DEVIS, même signé, n\'entre pas dans un CA facturé', () => {
    // Choix de fond : l'écran annonce « X € CA » et « X € faturados ». Un devis signé de 50 000 € sans facture
    // dirait au gérant qu'il a facturé ce qu'il n'a pas facturé, et la carte « Ce chantier t'a rapporté… »
    // calculerait un bénéfice sur de l'argent qui n'est pas dû. Le montant prévu a sa place : le budget.
    const devis = doc({ docType: 'devis', docNumber: 'DEV-2026-001', status: 'signed', lines: [ligne('Ravalement', 50000)] })
    expect(ca([devis], [CH_A]).parChantier.size).toBe(0)
  })

  it('un avoir se soustrait : il porte `docType: facture` et des lignes négatives', () => {
    // Depuis le 05/06/2026 un avoir n'est pas `docType: 'avoir'` mais une facture avec `factureSubType: 'avoir'`,
    // choix délibéré (`docType: 'avoir'` cassait la synchronisation). Il entre donc par la branche facture.
    const avoir = doc({ docNumber: 'AV-2026-001', lines: [ligne('Annulation partielle', -3000)] })
    const r = ca([doc({ lines: [ligne('Ravalement', 8000)] }), avoir], [CH_A])
    expect(r.parChantier.get('ch-a')).toBe(5000)
  })

  it('une facture annulée et son avoir sortent ENSEMBLE, sans laisser de montant négatif', () => {
    // Même régression que dans Statistiques : l'avoir orphelin aurait rendu un CA de chantier NÉGATIF.
    const annulee = doc({ status: 'cancelled', lines: [ligne('Ravalement', 8000)] })
    const avoir = doc({
      docNumber: 'AV-2026-001', parentInvoiceNumber: 'FACT-2026-001', lines: [ligne('Annulation', -8000)],
    } as never)
    const r = ca([annulee, avoir], [CH_A])
    expect(r.parChantier.get('ch-a')).toBeUndefined()
  })

  it('un brouillon n\'entre dans aucun chiffre', () => {
    for (const statut of ['', 'brouillon', 'draft']) {
      const brouillon = doc({ status: statut, lines: [ligne('À finir', 9000)] })
      expect(ca([brouillon], [CH_A]).parChantier.size).toBe(0)
    }
  })

  it('un numéro provisoire « BR-… » est un brouillon, quel que soit son statut', () => {
    // « Marquer envoyée » passe un brouillon de facture à « envoye » sans tirer de numéro légal.
    const provisoire = doc({ docNumber: 'BR-17', status: 'envoye', lines: [ligne('Dalle', 4000)] })
    expect(ca([provisoire], [CH_A]).parChantier.size).toBe(0)
  })

  it('un document annulé ne compte pas, dans l\'une ou l\'autre écriture du statut', () => {
    for (const statut of ['annule', 'cancelled']) {
      const annule = doc({ status: statut, lines: [ligne('Annulé', 7000)] })
      expect(ca([annule], [CH_A]).parChantier.size).toBe(0)
    }
  })

  it('le statut « signé » accentué n\'est reconnu nulle part — il n\'a jamais été écrit', () => {
    // L'autre moitié du défaut d'origine : le prédicat ne cherchait que cette valeur-là.
    const fantome = doc({ docType: 'devis', status: 'signé', lines: [ligne('Chimère', 6000)] })
    expect(ca([fantome], [CH_A]).parChantier.size).toBe(0)
  })

  it('une facture émise mais non encore payée compte : le CA facturé n\'est pas le CA encaissé', () => {
    const emise = doc({ status: 'pending', lines: [ligne('Situation 1', 6000)] })
    expect(ca([emise], [CH_A]).parChantier.get('ch-a')).toBe(6000)
  })

  it('un montant porté par `totalHT` sans lignes compte, depuis le repli de docRevenueHT', () => {
    // Forme sommaire de `fetchDocumentsFromSupabase` quand la colonne `raw_data` est absente : elle rend
    // `totalHT` sans conserver `total_ht_cents`, et ce document pesait 0 € bien qu'il porte son total.
    const sommaire = doc({ totalHT: 4200 })
    expect(ca([sommaire], [CH_A]).parChantier.get('ch-a')).toBe(4200)
  })
})
