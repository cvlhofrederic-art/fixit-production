// ── CRM du secrétariat : validation des entrées des routes app/api/crm/* ────
// Bornes identiques aux CHECK de la migration 20261122_crm_secretariat.sql : une saisie refusée ici ne part jamais en base.

import { z } from 'zod'
import { CANAUX_CRM, LANGUES_CRM, MOTIFS_CRM, PRIORITES_CRM, STATUTS_CRM } from './types'
import { normaliserTelephone } from './telephone'

const texte = (max: number) => z.string().trim().max(max)

/** Instant ISO 8601 (avec fuseau), ou null pour effacer. */
const instantOuNull = z.iso.datetime({ offset: true }).nullable()

/** Numéro saisi : normalisé en E.164, refusé s'il n'est pas reconnu ; vide → absent. */
const telephone = z
  .string()
  .max(40)
  .transform((v, ctx) => {
    if (v.trim() === '') return null
    const e164 = normaliserTelephone(v)
    if (!e164) {
      ctx.addIssue({ code: 'custom', message: 'telephone_invalide' })
      return z.NEVER
    }
    return e164
  })

const email = z
  .string()
  .trim()
  .max(254)
  .transform((v, ctx) => {
    if (v === '') return null
    if (!z.email().safeParse(v).success) {
      ctx.addIssue({ code: 'custom', message: 'email_invalide' })
      return z.NEVER
    }
    return v.toLowerCase()
  })

const uuid = z.uuid()

export const creerDemandeSchema = z
  .object({
    contact_id: uuid.optional(),
    telephone: telephone.optional(),
    nom: texte(120).optional(),
    titre: texte(160).optional(),
    description: texte(4000).default(''),
    motif: z.enum(MOTIFS_CRM),
    canal: z.enum(CANAUX_CRM),
    priorite: z.enum(PRIORITES_CRM).optional(),
    rappel_le: instantOuNull.optional(),
  })
  .strict()
  .refine((d) => (d.titre ?? '') !== '' || d.description !== '', { message: 'titre_ou_description', path: ['titre'] })

export type CreerDemandeEntree = z.infer<typeof creerDemandeSchema>

export const modifierDemandeSchema = z
  .object({
    titre: texte(160).min(1).optional(),
    description: texte(4000).optional(),
    motif: z.enum(MOTIFS_CRM).optional(),
    priorite: z.enum(PRIORITES_CRM).optional(),
    statut: z.enum(STATUTS_CRM).optional(),
    rappel_le: instantOuNull.optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'aucun_changement' })

export type ModifierDemandeEntree = z.infer<typeof modifierDemandeSchema>

export const noteSchema = z.object({ contenu: texte(4000).min(1) }).strict()

export const modifierContactSchema = z
  .object({
    nom: texte(120).optional(),
    telephone: telephone.optional(),
    email: email.optional(),
    ville: texte(120).optional(),
    langue: z.enum(LANGUES_CRM).optional(),
    notes: texte(4000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'aucun_changement' })

export type ModifierContactEntree = z.infer<typeof modifierContactSchema>

export const idSchema = uuid

/**
 * Titre d'une demande saisie sans titre : la première ligne de la description, coupée à 80 caractères. Coupe par
 * caractère (point de code) et non par unité UTF-16 : un emoji collé depuis WhatsApp n'est jamais coupé en deux.
 */
export function titreParDefaut(titre: string | undefined, description: string): string {
  const t = (titre ?? '').trim()
  if (t !== '') return t
  const caracteres = Array.from(description.trim().split('\n')[0].trim())
  return caracteres.length > 80 ? `${caracteres.slice(0, 79).join('').trimEnd()}…` : caracteres.join('')
}

/** Une demande d'urgence est urgente, sauf priorité choisie. */
export function prioriteParDefaut(motif: CreerDemandeEntree['motif'], priorite: CreerDemandeEntree['priorite']): 'normale' | 'urgente' {
  return priorite ?? (motif === 'urgence' ? 'urgente' : 'normale')
}
