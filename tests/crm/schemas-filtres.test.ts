// CRM du secrétariat : validation des saisies (lib/crm/schemas.ts) et liste de l'écran (lib/crm/filtres.ts).
// Données fictives.

import { describe, expect, it } from 'vitest'
import {
  creerDemandeSchema,
  modifierContactSchema,
  modifierDemandeSchema,
  noteSchema,
  prioriteParDefaut,
  titreParDefaut,
} from '@/lib/crm/schemas'
import { compterParStatut, filtrerDemandes } from '@/lib/crm/filtres'
import type { DemandeCrm } from '@/lib/crm/types'

describe('creerDemandeSchema', () => {
  const base = { motif: 'devis', canal: 'appel', description: 'Nettoyage de toiture' } as const

  it('normalise le numéro et garde la saisie', () => {
    const r = creerDemandeSchema.parse({ ...base, telephone: '912 345 678', nom: '  Ana  ' })
    expect(r.telephone).toBe('+351912345678')
    expect(r.nom).toBe('Ana')
  })

  it('numéro vide → absent ; numéro non reconnu → refusé', () => {
    expect(creerDemandeSchema.parse({ ...base, telephone: '' }).telephone).toBeNull()
    const refus = creerDemandeSchema.safeParse({ ...base, telephone: '12345' })
    expect(refus.success).toBe(false)
  })

  it('sujet ou description obligatoire', () => {
    expect(creerDemandeSchema.safeParse({ motif: 'info', canal: 'whatsapp' }).success).toBe(false)
    expect(creerDemandeSchema.safeParse({ motif: 'info', canal: 'whatsapp', titre: '   ', description: '  ' }).success).toBe(false)
    expect(creerDemandeSchema.safeParse({ motif: 'info', canal: 'whatsapp', titre: 'Question facture' }).success).toBe(true)
  })

  it('refuse un motif, un canal ou un champ inconnus, et un rappel sans fuseau', () => {
    expect(creerDemandeSchema.safeParse({ ...base, motif: 'vente' }).success).toBe(false)
    expect(creerDemandeSchema.safeParse({ ...base, canal: 'sms' }).success).toBe(false)
    expect(creerDemandeSchema.safeParse({ ...base, statut: 'resolue' }).success).toBe(false)
    expect(creerDemandeSchema.safeParse({ ...base, rappel_le: '2026-11-23T10:00' }).success).toBe(false)
    expect(creerDemandeSchema.safeParse({ ...base, rappel_le: '2026-11-23T10:00:00.000Z' }).success).toBe(true)
    expect(creerDemandeSchema.safeParse({ ...base, contact_id: 'pas-un-uuid' }).success).toBe(false)
  })

  it('borne les longueurs comme la base', () => {
    expect(creerDemandeSchema.safeParse({ ...base, titre: 'x'.repeat(161) }).success).toBe(false)
    expect(creerDemandeSchema.safeParse({ ...base, description: 'x'.repeat(4001) }).success).toBe(false)
  })
})

describe('titre et priorité par défaut', () => {
  it('titre = sujet, sinon première ligne de la description (80 caractères au plus)', () => {
    expect(titreParDefaut('Fuite', 'peu importe')).toBe('Fuite')
    expect(titreParDefaut('', 'Fuite sous évier\nDepuis ce matin')).toBe('Fuite sous évier')
    const long = titreParDefaut(undefined, 'a'.repeat(200))
    expect(long).toHaveLength(80)
    expect(long.endsWith('…')).toBe(true)
  })

  it('ne coupe jamais un emoji en deux (description collée depuis WhatsApp)', () => {
    const titre = titreParDefaut(undefined, `${'a'.repeat(78)}😀😀😀`)
    expect(Array.from(titre)).toHaveLength(80)
    expect(titre).toBe(`${'a'.repeat(78)}😀…`)
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(titre)).toBe(false)
  })

  it('urgence → urgente, sauf priorité choisie', () => {
    expect(prioriteParDefaut('urgence', undefined)).toBe('urgente')
    expect(prioriteParDefaut('urgence', 'normale')).toBe('normale')
    expect(prioriteParDefaut('devis', undefined)).toBe('normale')
  })
})

describe('modifications', () => {
  it('une modification vide est refusée', () => {
    expect(modifierDemandeSchema.safeParse({}).success).toBe(false)
    expect(modifierContactSchema.safeParse({}).success).toBe(false)
  })

  it('rappel effaçable (null), statut contrôlé, titre non vide', () => {
    expect(modifierDemandeSchema.parse({ rappel_le: null })).toEqual({ rappel_le: null })
    expect(modifierDemandeSchema.safeParse({ statut: 'fermee' }).success).toBe(false)
    expect(modifierDemandeSchema.safeParse({ titre: '  ' }).success).toBe(false)
  })

  it('e-mail vide → effacé, e-mail invalide → refusé, e-mail rangé en minuscules', () => {
    expect(modifierContactSchema.parse({ email: '' }).email).toBeNull()
    expect(modifierContactSchema.safeParse({ email: 'pas un email' }).success).toBe(false)
    expect(modifierContactSchema.parse({ email: 'Ana@Exemple.TEST' }).email).toBe('ana@exemple.test')
  })

  it('note : texte non vide', () => {
    expect(noteSchema.safeParse({ contenu: '   ' }).success).toBe(false)
    expect(noteSchema.parse({ contenu: ' Rappelé, absent ' }).contenu).toBe('Rappelé, absent')
  })
})

function demande(partiel: Partial<DemandeCrm> & Pick<DemandeCrm, 'id'>): DemandeCrm {
  return {
    numero: 1,
    contact_id: null,
    titre: 'Demande',
    description: '',
    motif: 'info',
    canal: 'appel',
    priorite: 'normale',
    statut: 'nouvelle',
    rappel_le: null,
    resolue_le: null,
    created_at: '2026-11-22T10:00:00Z',
    updated_at: '2026-11-22T10:00:00Z',
    contact: null,
    ...partiel,
  }
}

describe('filtrerDemandes et compterParStatut', () => {
  const demandes = [
    demande({ id: 'a', titre: 'Devis nettoyage de toiture', created_at: '2026-11-22T09:00:00Z' }),
    demande({ id: 'b', titre: 'Fuite', priorite: 'urgente', created_at: '2026-11-22T08:00:00Z', contact: { id: 'c1', nom: 'José Ribeiro', telephone: '+351912345678' } }),
    demande({ id: 'c', titre: 'Question facture', statut: 'resolue', numero: 42, created_at: '2026-11-22T11:00:00Z' }),
  ]

  it('urgentes d’abord, puis les plus récentes', () => {
    expect(filtrerDemandes(demandes, 'nouvelle', '').map((x) => x.id)).toEqual(['b', 'a'])
    expect(filtrerDemandes(demandes, 'toutes', '').map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('recherche sans casse ni accents, par numéro de demande ou par chiffres du téléphone', () => {
    expect(filtrerDemandes(demandes, 'toutes', 'jose').map((x) => x.id)).toEqual(['b'])
    expect(filtrerDemandes(demandes, 'toutes', 'TOITURE').map((x) => x.id)).toEqual(['a'])
    expect(filtrerDemandes(demandes, 'toutes', '42').map((x) => x.id)).toEqual(['c'])
    expect(filtrerDemandes(demandes, 'toutes', '912 345').map((x) => x.id)).toEqual(['b'])
    expect(filtrerDemandes(demandes, 'toutes', '91').map((x) => x.id)).toEqual([])
  })

  it('compte par onglet, recherche appliquée', () => {
    expect(compterParStatut(demandes, '')).toEqual({ nouvelle: 2, en_cours: 0, en_attente: 0, resolue: 1, toutes: 3 })
    expect(compterParStatut(demandes, 'facture')).toEqual({ nouvelle: 0, en_cours: 0, en_attente: 0, resolue: 1, toutes: 1 })
  })
})
