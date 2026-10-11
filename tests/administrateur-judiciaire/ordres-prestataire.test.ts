import { describe, expect, it } from 'vitest'
import {
  correspondanceUrgence,
  dernierOrdreParReference,
  etapesOrdre,
  filOrdre,
  libelleUrgenceOrdre,
  statutDepuisMission,
  urgenceDepuisLibelle,
  type OrdrePrestataire,
} from '@/lib/administrateur-judiciaire/ordres-prestataire'

/**
 * Boucle prestataire de l'Administrateur judiciaire : règles pures partagées par la route et l'écran Ordres de
 * service (urgences, statuts, étapes, fil d'un ordre dans la conversation partagée avec le Syndic v54).
 */

describe('urgences', () => {
  it('urgence AJ → priorité de la mission (CHECK syndic_missions) et urgence de l’ordre de mission', () => {
    expect(correspondanceUrgence('normale')).toEqual({ priorite: 'normale', urgenceOrdre: 'normale' })
    expect(correspondanceUrgence('prioritaire')).toEqual({ priorite: 'normale', urgenceOrdre: 'haute' })
    expect(correspondanceUrgence('urgence')).toEqual({ priorite: 'urgente', urgenceOrdre: 'urgente' })
  })

  it('libellés de l’écran ↔ codes', () => {
    expect(urgenceDepuisLibelle('Urgence')).toBe('urgence')
    expect(urgenceDepuisLibelle('Prioritaire')).toBe('prioritaire')
    expect(urgenceDepuisLibelle('Normale')).toBe('normale')
    expect(urgenceDepuisLibelle('autre')).toBe('normale')
    expect(libelleUrgenceOrdre('urgente')).toBe('Urgence')
    expect(libelleUrgenceOrdre('haute')).toBe('Prioritaire')
    expect(libelleUrgenceOrdre('normale')).toBe('Normale')
  })
})

describe('statuts et étapes', () => {
  it('statut de la mission → statut d’ordre', () => {
    expect(statutDepuisMission('acceptee')).toBe('accepte')
    expect(statutDepuisMission('en_cours')).toBe('en_cours')
    expect(statutDepuisMission('terminee')).toBe('termine')
    expect(statutDepuisMission('annulee')).toBe('refuse')
    expect(statutDepuisMission('en_attente')).toBe('en_attente')
    expect(statutDepuisMission(null)).toBe('en_attente')
  })

  it('Transmis → Accepté → Démarré → Terminé ; un refus s’arrête après « Transmis »', () => {
    const etats = (statut: Parameters<typeof etapesOrdre>[0]) => etapesOrdre(statut).map((e) => e.etat)
    expect(etapesOrdre('en_attente').map((e) => e.nom)).toEqual(['Transmis', 'Accepté', 'Démarré', 'Terminé'])
    expect(etats('en_attente')).toEqual(['done', 'current', 'pending', 'pending'])
    expect(etats('accepte')).toEqual(['done', 'done', 'current', 'pending'])
    expect(etats('en_cours')).toEqual(['done', 'done', 'done', 'current'])
    expect(etats('termine')).toEqual(['done', 'done', 'done', 'done'])
    expect(etapesOrdre('refuse')).toEqual([
      { nom: 'Transmis', etat: 'done' },
      { nom: 'Refusé par le prestataire', etat: 'current' },
    ])
  })
})

describe('filOrdre', () => {
  const m = (id: string, type: string, metadata: Record<string, unknown> = {}) => ({ id, type, metadata })
  const conversation = [
    m('avant', 'text'),
    m('ordre-1', 'ordre_mission', { syndic_mission_id: 'mis-1' }),
    m('accepte-1', 'system', { ordre_message_id: 'ordre-1' }),
    m('document', 'text', { cote: 'artisan', document: { type: 'devis' } }),
    m('systeme-autre', 'system', { ordre_message_id: 'ordre-0' }),
    m('reponse-autre', 'text', { syndic_mission_id: 'mis-0' }),
    m('ordre-2', 'ordre_mission', { syndic_mission_id: 'mis-2' }),
    m('apres', 'text', { cote: 'artisan' }),
    m('termine-1', 'system', { ordre_message_id: 'ordre-1' }),
    m('reponse-1', 'text', { syndic_mission_id: 'mis-1' }),
  ]

  it('messages entre l’ordre et l’ordre suivant, plus ceux rattachés à cet ordre ou à sa mission', () => {
    expect(filOrdre(conversation, 'ordre-1', 'mis-1').map((x) => x.id)).toEqual(['accepte-1', 'document', 'termine-1', 'reponse-1'])
  })

  it('dernier ordre de la conversation : tout ce qui suit, sauf ce qui est rattaché à un autre ordre', () => {
    expect(filOrdre(conversation, 'ordre-2', 'mis-2').map((x) => x.id)).toEqual(['apres'])
  })

  it('ordre absent : fil vide', () => {
    expect(filOrdre(conversation, 'inconnu', 'mis-9')).toEqual([])
  })
})

describe('dernierOrdreParReference', () => {
  const ordre = (missionId: string, referenceAj: string, creeLe: string) => ({ missionId, referenceAj, creeLe }) as OrdrePrestataire

  it('ordre le plus récent par numéro ; envois sans numéro ignorés', () => {
    const parReference = dernierOrdreParReference([
      ordre('a', 'OS-2026-051', '2026-10-12T09:00:00Z'),
      ordre('b', 'OS-2026-051', '2026-10-12T11:00:00Z'),
      ordre('c', 'OS-2026-050', '2026-10-12T10:00:00Z'),
      ordre('d', '', '2026-10-12T12:00:00Z'),
    ])
    expect(parReference.get('OS-2026-051')?.missionId).toBe('b')
    expect(parReference.get('OS-2026-050')?.missionId).toBe('c')
    expect(parReference.size).toBe(2)
  })
})
